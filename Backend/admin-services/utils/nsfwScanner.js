const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const detectVisualCppError = (err) => {
  const message = (err?.message || err || "").toString().toLowerCase();
  return (
    message.includes("0xc0000135") ||
    message.includes("dll") ||
    message.includes("module was not found") ||
    message.includes("vcruntime")
  );
};

let ortNode = null;
let ortWasm = null;
let activeOrtModule = null;

try {
  ortNode = require("onnxruntime-node");
} catch (err) {
  if (detectVisualCppError(err)) {
    console.error(
      "[nsfw] onnxruntime-node failed to load (likely missing Visual C++ runtime):",
      err?.message || err
    );
  } else {
    console.error("[nsfw] onnxruntime-node not available:", err?.message || err);
  }
}

try {
  ortWasm = require("onnxruntime-web");
} catch (err) {
  console.warn("[nsfw] onnxruntime-web not available:", err?.message || err);
}

const isX64Arch = process.arch === "x64";
if (!isX64Arch) {
  console.error(
    `[nsfw] Detected architecture ${process.arch}. Native ONNX runtime requires x64; defaulting to WASM when possible.`
  );
}

const PROVIDER_PRIORITY = ["cpu", "wasm"];
const providerConfig = {
  cpu: {
    runtime: "node",
    executionProviders: ["CPUExecutionProvider", "cpuExecutionProvider"],
    allowDefault: true,
  },
  wasm: { runtime: "wasm", executionProviders: ["wasm"] },
};

const MODEL_DIR = path.join(__dirname, "..", "nsfw");
const MODEL_PRIORITY = [
  process.env.NSFW_ONNX_MODEL_FILE,
  "vit_retrain_nsfw.onnx",
];
const resolveModelPath = (file) => (file ? path.join(MODEL_DIR, file) : null);

const DEFAULT_PREPROCESS_PATH =
  process.env.NSFW_PREPROCESSOR_PATH ||
  path.join(__dirname, "..", "nsfw", "preprocessor_config.json");
const DEFAULT_CONFIG_PATH =
  process.env.NSFW_LABEL_CONFIG_PATH ||
  path.join(__dirname, "..", "nsfw", "config.json");

const readJsonIfAvailable = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (err) {
    console.warn(`[nsfw] Cannot read ${filePath}:`, err?.message || err);
  }
  return null;
};

const preprocessorConfig = readJsonIfAvailable(DEFAULT_PREPROCESS_PATH) || {};
const modelConfig = readJsonIfAvailable(DEFAULT_CONFIG_PATH) || {};
const id2label = modelConfig.id2label || null;

const parseSize = (raw) => {
  if (!raw) return { width: 224, height: 224 };
  if (typeof raw === "number") return { width: raw, height: raw };
  if (typeof raw === "object") {
    const width = Number(raw.width || raw.shortest_edge || raw.max_size || 224);
    const height = Number(raw.height || raw.shortest_edge || raw.max_size || 224);
    return { width, height };
  }
  return { width: 224, height: 224 };
};

const targetSize = parseSize(preprocessorConfig.size);
const CHANNELS = 3;
const DO_RESCALE = preprocessorConfig.do_rescale !== false;
const DO_NORMALIZE = preprocessorConfig.do_normalize !== false;
const RESCALE_FACTOR = Number(preprocessorConfig.rescale_factor) || 1 / 255;
const IMAGE_MEAN = Array.isArray(preprocessorConfig.image_mean)
  ? preprocessorConfig.image_mean
  : [0.5, 0.5, 0.5];
const IMAGE_STD = Array.isArray(preprocessorConfig.image_std)
  ? preprocessorConfig.image_std
  : [0.5, 0.5, 0.5];

const SHOULD_LOG_SOFTMAX = (process.env.NSFW_LOG_SCORES || "1") !== "0";
const AUTO_WARMUP_ENABLED = (process.env.NSFW_AUTO_WARMUP || "1") !== "0";

const runtimeStatus = {
  provider: null,
  sessionReady: false,
  reason: "not_initialized",
  arch: process.arch,
  availableProviders: [],
  lastWarmup: null,
  lastError: null,
  modelPath: null,
};

const warmupStatus = {
  startedAt: null,
  finishedAt: null,
  ok: false,
  error: null,
  label: null,
  provider: null,
  lastWarmup: null,
};

let sessionPromise = null;
let activeSession = null;
let loggedMissingModel = false;
let warmupPromise = null;
const modelBufferCache = new Map();
let currentModelPath = null;

const isBenignProviderError = (err) => {
  const msg = (err?.message || err || "").toString().toLowerCase();
  return (
    msg.includes("backend not found") ||
    msg.includes("executionprovider") ||
    msg.includes("cuda is not enabled") ||
    msg.includes("cpu vendor") ||
    msg.includes("convinteger")
  );
};

const isProviderUsable = (providerName) => {
  if (providerName === "wasm") return !!ortWasm;
  if (providerName === "cpu") return isX64Arch && !!ortNode;
  return false;
};

const resolveModelCandidates = () => {
  const candidates = [];
  if (process.env.NSFW_ONNX_MODEL_PATH) {
    candidates.push(process.env.NSFW_ONNX_MODEL_PATH);
  }
  for (const name of MODEL_PRIORITY) {
    if (!name) continue;
    const fullPath = resolveModelPath(name);
    if (fullPath) candidates.push(fullPath);
  }
  const unique = [];
  const seen = new Set();
  for (const p of candidates) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    if (fs.existsSync(p)) unique.push(p);
  }
  return unique;
};

const refreshAvailableProviders = () => {
  const available = PROVIDER_PRIORITY.filter((name) => isProviderUsable(name));
  runtimeStatus.availableProviders = available;
  return available;
};

const getAvailableProviders = () => {
  const providers = refreshAvailableProviders();
  console.info(
    "[nsfw] Available ONNX providers:",
    providers.length ? providers.join(", ") : "none"
  );
  return [...providers];
};

refreshAvailableProviders();

const getModelBuffer = (modelPath) => {
  if (!fs.existsSync(modelPath)) {
    throw new Error("model_missing");
  }
  if (!modelBufferCache.has(modelPath)) {
    modelBufferCache.set(modelPath, fs.readFileSync(modelPath));
  }
  return modelBufferCache.get(modelPath);
};

const createSessionForProvider = async (providerName, modelPath) => {
  const config = providerConfig[providerName];
  if (!config) throw new Error(`unknown_provider_${providerName}`);

  if (config.runtime === "node") {
    if (!ortNode) throw new Error("onnxruntime_node_unavailable");
    if (!isX64Arch) throw new Error("node_runtime_requires_x64");

    let lastError = null;
    const epNames = Array.isArray(config.executionProviders)
      ? config.executionProviders
      : [];
    for (const ep of epNames) {
      try {
        const session = await ortNode.InferenceSession.create(modelPath, {
          executionProviders: [ep],
        });
        activeOrtModule = ortNode;
        runtimeStatus.provider = providerName;
        runtimeStatus.sessionReady = true;
        runtimeStatus.reason = `initialized_${providerName}_${ep}`;
        runtimeStatus.lastError = null;
        console.info(
          `[nsfw] ONNX runtime ready via ${providerName.toUpperCase()} (${path.basename(
            modelPath
          )})`
        );
        return session;
      } catch (err) {
        lastError = err;
        if (!isBenignProviderError(err)) {
          console.error(
            `[nsfw] onnxruntime-node provider ${ep} failed:`,
            err?.message || err
          );
        }
      }
    }

    if (config.allowDefault) {
      try {
        const session = await ortNode.InferenceSession.create(modelPath);
        activeOrtModule = ortNode;
        runtimeStatus.provider = providerName;
        runtimeStatus.sessionReady = true;
        runtimeStatus.reason = `initialized_${providerName}_default`;
        runtimeStatus.lastError = null;
        console.info(
          `[nsfw] ONNX runtime ready via ${providerName.toUpperCase()} (default) (${path.basename(
            modelPath
          )})`
        );
        return session;
      } catch (err) {
        lastError = err;
        if (!isBenignProviderError(err)) {
          console.error(
            `[nsfw] onnxruntime-node default session failed:`,
            err?.message || err
          );
        }
      }
    }

    throw lastError || new Error("node_session_create_failed");
  }

  if (!ortWasm) throw new Error("onnxruntime_wasm_unavailable");
  const wasmModel = getModelBuffer(modelPath);
  let wasmSession = null;
  let lastError = null;
  const wasmProviders = Array.isArray(config.executionProviders)
    ? config.executionProviders
    : [];
  for (const provider of wasmProviders) {
    try {
      wasmSession = await ortWasm.InferenceSession.create(wasmModel, {
        executionProviders: [provider],
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!wasmSession) {
    throw lastError || new Error("wasm_session_create_failed");
  }
  activeOrtModule = ortWasm;
  runtimeStatus.provider = "wasm";
  runtimeStatus.sessionReady = true;
  runtimeStatus.reason = "initialized_wasm";
  runtimeStatus.lastError = null;
  console.warn("[nsfw] running in WASM mode (CPU-only, slower but stable)");
  return wasmSession;
};

const loadSessionInternal = async () => {
  const modelCandidates = resolveModelCandidates();
  if (!modelCandidates.length) {
    const defaultPath = resolveModelPath(process.env.NSFW_ONNX_MODEL_FILE || "model_int8.onnx");
    if (!loggedMissingModel) {
      console.error("[nsfw] No ONNX model files found under", MODEL_DIR);
      loggedMissingModel = true;
    }
    runtimeStatus.provider = null;
    runtimeStatus.sessionReady = false;
    runtimeStatus.reason = "model_missing";
    runtimeStatus.modelPath = defaultPath;
    return null;
  }
  loggedMissingModel = false;

  const available = refreshAvailableProviders();
  if (!available.length) {
    runtimeStatus.provider = null;
    runtimeStatus.sessionReady = false;
    runtimeStatus.reason = "no_provider_detected";
    runtimeStatus.modelPath = modelCandidates[0];
    return null;
  }

  for (const modelPath of modelCandidates) {
    runtimeStatus.modelPath = modelPath;
    currentModelPath = modelPath;
    let session = null;
    for (const providerName of PROVIDER_PRIORITY) {
      if (!isProviderUsable(providerName)) continue;
      try {
        session = await createSessionForProvider(providerName, modelPath);
        if (session) break;
      } catch (err) {
        runtimeStatus.lastError = err?.message || String(err);
        const errLower = runtimeStatus.lastError.toLowerCase();
        if (errLower.includes("convinteger")) {
          console.warn(
            `[nsfw] Provider ${providerName} cannot run quantized model (${path.basename(
              modelPath
            )}). Trying next model variant.`
          );
        } else if (!isBenignProviderError(err)) {
          console.error(`[nsfw] Provider ${providerName} init failed:`, runtimeStatus.lastError);
        }
        if (
          providerName !== "wasm" &&
          isProviderUsable("wasm") &&
          !isBenignProviderError(err)
        ) {
          console.warn("[nsfw] failed to initialize session, fallback to wasm");
        }
      }
    }
    if (session) {
      activeSession = session;
      runtimeStatus.modelPath = modelPath;
      currentModelPath = modelPath;
      return session;
    }
  }

  runtimeStatus.provider = null;
  runtimeStatus.sessionReady = false;
  runtimeStatus.reason = "provider_init_failed";
  return null;
};

const ensureModelLoaded = async () => {
  if (activeSession) return activeSession;
  if (!sessionPromise) {
    sessionPromise = loadSessionInternal()
      .then((session) => {
        sessionPromise = null;
        return session;
      })
      .catch((err) => {
        runtimeStatus.lastError = err?.message || String(err);
        runtimeStatus.sessionReady = false;
        sessionPromise = null;
        return null;
      });
  }
  return sessionPromise;
};

const getTensorCtor = () => {
  const ctor = activeOrtModule?.Tensor || ortNode?.Tensor || ortWasm?.Tensor || null;
  if (!ctor) {
    console.error("[nsfw] Tensor constructor unavailable; ensure ONNX runtime dependencies are installed.");
  }
  return ctor;
};

const warmupModel = async (label = "manual") => {
  if (warmupPromise) return warmupPromise;

  warmupStatus.startedAt = new Date();
  warmupStatus.finishedAt = null;
  warmupStatus.ok = false;
  warmupStatus.error = null;
  warmupStatus.label = label;

  const promise = (async () => {
    const session = await ensureModelLoaded();
    if (!session) throw new Error(runtimeStatus.reason || "session_unavailable");
    if (!runtimeStatus.sessionReady) throw new Error(runtimeStatus.reason || "not_ready");

    const tensorCtor = getTensorCtor();
    if (!tensorCtor) throw new Error("tensor_constructor_missing");

    try {
      const { width, height } = targetSize;
      const dims = [1, CHANNELS, height, width];
      const dummy = new Float32Array(CHANNELS * width * height);
      const inputName =
        (Array.isArray(session.inputNames) && session.inputNames[0]) || "pixel_values";
      await session.run({
        [inputName]: new tensorCtor("float32", dummy, dims),
      });
    } catch (err) {
      console.warn("[nsfw] Warmup inference skipped:", err?.message || err);
    }

    warmupStatus.ok = true;
    warmupStatus.provider = runtimeStatus.provider;
    warmupStatus.finishedAt = new Date();
    warmupStatus.lastWarmup = warmupStatus.finishedAt;
    runtimeStatus.lastWarmup = warmupStatus.lastWarmup;
    runtimeStatus.reason = "warmup_ok";
    return session;
  })()
    .catch((err) => {
      warmupStatus.ok = false;
      warmupStatus.error = err?.message || String(err);
      warmupStatus.finishedAt = new Date();
      runtimeStatus.lastError = warmupStatus.error;
      throw err;
    })
    .finally(() => {
      warmupPromise = null;
    });

  warmupPromise = promise;
  return promise;
};

if (AUTO_WARMUP_ENABLED) {
  const timer = setTimeout(() => {
    warmupModel("startup").catch((err) =>
      console.error("[nsfw] Startup warmup crash:", err?.message || err)
    );
  }, 10);
  if (typeof timer?.unref === "function") timer.unref();
}

const softmax = (logits) => {
  if (!Array.isArray(logits)) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - maxLogit));
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1;
  return exps.map((v) => v / sum);
};

const normalizePixel = (value, channelIndex) => {
  let result = value;
  if (DO_RESCALE) result *= RESCALE_FACTOR;
  if (DO_NORMALIZE) {
    const mean = IMAGE_MEAN[channelIndex] ?? IMAGE_MEAN[0] ?? 0;
    const std = IMAGE_STD[channelIndex] ?? IMAGE_STD[0] ?? 1;
    result = (result - mean) / std;
  }
  return result;
};

const buildSharpPipeline = (inputBuffer) => {
  const { width, height } = targetSize;
  return sharp(inputBuffer, { failOn: "none", limitInputPixels: false })
    .rotate()
    .withMetadata()
    .resize(width, height, { fit: "cover" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw();
};

const tensorizeImage = async (buffer) => {
  let processed = null;
  try {
    processed = await buildSharpPipeline(buffer).toBuffer({ resolveWithObject: true });
  } catch (err) {
    const msg = err?.message || "";
    if (!msg.toLowerCase().includes("vips_colourspace")) {
      throw err;
    }
    // Attempt a fallback: re-encode to PNG in sRGB before resizing/raw conversion.
    const safeBuffer = await sharp(buffer, { failOn: "none", limitInputPixels: false })
      .withMetadata()
      .toColorspace("srgb")
      .removeAlpha()
      .png()
      .toBuffer();
    processed = await buildSharpPipeline(safeBuffer).toBuffer({ resolveWithObject: true });
  }

  const { data, info } = processed;
  const pixelCount = info.width * info.height;
  const tensorData = new Float32Array(CHANNELS * pixelCount);

  for (let idx = 0; idx < pixelCount; idx += 1) {
    const base = idx * CHANNELS;
    for (let c = 0; c < CHANNELS; c += 1) {
      const rawValue = data[base + c];
      tensorData[c * pixelCount + idx] = normalizePixel(rawValue, c);
    }
  }

  return { data: tensorData, dims: [1, CHANNELS, info.height, info.width] };
};

const buildSoftmaxLog = (predictions) =>
  predictions.map((p) => `${p.label}:${(p.probability * 100).toFixed(2)}%`).join(", ");

const getLabels = () => {
  if (!id2label) return [];
  return Object.keys(id2label)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => id2label[key]);
};

const classifyImage = async (buffer, options = {}) => {
  try {
    const session = await ensureModelLoaded();
    if (!session) return null;

    const tensorCtor = getTensorCtor();
    if (!tensorCtor) return null;

    const input = await tensorizeImage(buffer);
    const inputName =
      (Array.isArray(session.inputNames) && session.inputNames[0]) || "pixel_values";
    const feeds = {
      [inputName]: new tensorCtor("float32", input.data, input.dims),
    };

    const output = await session.run(feeds);
    const outputName =
      (Array.isArray(session.outputNames) && session.outputNames[0]) ||
      Object.keys(output)[0];
    const logitsTensor = output[outputName];
    if (!logitsTensor?.data) return null;

    const logits = Array.from(logitsTensor.data);
    const probabilities = softmax(logits);
    const predictions = probabilities.map((prob, idx) => {
      const label = id2label
        ? id2label[String(idx)] || id2label[idx] || `label_${idx}`
        : `label_${idx}`;
      return { label, probability: prob };
    });

    const sorted = predictions.sort((a, b) => b.probability - a.probability);

    const shouldLog = options.logSoftmax ?? SHOULD_LOG_SOFTMAX;
    if (shouldLog && sorted.length) {
      const subject = options.fileName || options.meta || "buffer";
      console.info(`[nsfw] softmax ${subject}: ${buildSoftmaxLog(sorted)}`);
    }

    return sorted;
  } catch (err) {
    console.error("[nsfw] Failed to classify image buffer:", err?.message || err);
    runtimeStatus.lastError = err?.message || String(err);
    runtimeStatus.sessionReady = false;
    return null;
  }
};

const getEffectiveModelPath = () => {
  if (runtimeStatus.modelPath && fs.existsSync(runtimeStatus.modelPath)) {
    return runtimeStatus.modelPath;
  }
  if (currentModelPath && fs.existsSync(currentModelPath)) return currentModelPath;
  const candidates = resolveModelCandidates();
  if (candidates.length) return candidates[0];
  const fallback = resolveModelPath(process.env.NSFW_ONNX_MODEL_FILE || "model_int8.onnx");
  return fallback;
};

const getStatusSnapshot = () => {
  const modelPath = getEffectiveModelPath();
  return {
    runtime: {
      ...runtimeStatus,
      availableProviders: [...runtimeStatus.availableProviders],
      modelPath,
    },
    warmup: { ...warmupStatus },
    modelPath,
    modelExists: modelPath ? fs.existsSync(modelPath) : false,
    labels: getLabels(),
    autoWarmup: AUTO_WARMUP_ENABLED,
    logging: {
      softmax: SHOULD_LOG_SOFTMAX,
    },
  };
};

module.exports = {
  classifyImage,
  warmupModel,
  getStatusSnapshot,
  getAvailableProviders,
  ensureModelLoaded,
  getLabels,
};
