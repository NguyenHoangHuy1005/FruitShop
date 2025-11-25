import { memo, useMemo } from "react";
import { STATUS_LABELS, normalizeOrderStatus } from "./OrderStatusTag";
import "./orderTimeline.scss";

const DEFAULT_TEXTS = {
  title: "Order history",
  actorLabel: "Actor",
  empty: "No status updates yet.",
  createdLabel: "Order created",
  defaultActor: "System",
  defaultNote: "",
  actorTypes: {
    admin: "Admin",
    staff: "Staff",
    user: "Customer",
    guest: "Guest",
    shipper: "Shipper",
    system: "System",
  },
  defaultNotes: {},
};

const defaultFormatTimestamp = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
};

const toKey = (value) => {
  if (!value) return "";
  const raw = String(value).trim().toLowerCase();
  if (!raw) return "";
  if (raw === "created" || raw === "create" || raw === "new") return "created";
  return normalizeOrderStatus(raw);
};

const pickActor = (entry, texts) => {
  if (entry?.actorName && String(entry.actorName).trim()) {
    return String(entry.actorName).trim();
  }
  if (entry?.actorType) {
    const mapped = texts.actorTypes[String(entry.actorType).toLowerCase()];
    if (mapped) return mapped;
  }
  return texts.defaultActor;
};

const pickNote = (status, note, texts) => {
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (trimmed) return trimmed;
  if (status && texts.defaultNotes[status]) {
    return texts.defaultNotes[status];
  }
  return texts.defaultNote;
};

const parseTimestamp = (value) => {
  if (!value) return null;
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const buildEntries = ({ history, createdAt, updatedAt, currentStatus, texts }) => {
  const normalizedHistory = (Array.isArray(history) ? history : [])
    .map((entry, idx) => {
      const key = toKey(entry?.status);
      if (!key) return null;
      const timestamp = parseTimestamp(entry?.createdAt);
      return {
        id: `${key}-${idx}-${entry?.createdAt || "no-time"}`,
        status: key,
        label: STATUS_LABELS[key] || texts.createdLabel,
        note: pickNote(key, entry?.note, texts),
        actor: pickActor(entry, texts),
        iso: entry?.createdAt || (timestamp ? timestamp.toISOString() : ""),
        sort: timestamp ? timestamp.getTime() : Number.MAX_SAFE_INTEGER - idx,
        isFallback: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort);

  const output = [...normalizedHistory];
  const createdTime = parseTimestamp(createdAt);
  if (createdTime) {
    output.unshift({
      id: `created-${createdTime.toISOString()}`,
      status: "created",
      label: texts.createdLabel,
      note: texts.defaultNotes.created || texts.defaultNote,
      actor: output[0]?.actor || texts.defaultActor,
      iso: createdTime.toISOString(),
      sort: createdTime.getTime() - 1,
      isFallback: false,
    });
  }

  const normalizedCurrent = toKey(currentStatus);
  const currentExists = normalizedCurrent
    ? output.some((entry) => entry.status === normalizedCurrent)
    : false;

  if (normalizedCurrent && !currentExists) {
    const fallbackTime = parseTimestamp(updatedAt);
    output.push({
      id: `fallback-${normalizedCurrent}`,
      status: normalizedCurrent,
      label: STATUS_LABELS[normalizedCurrent] || normalizedCurrent,
      note: pickNote(normalizedCurrent, "", texts),
      actor: texts.defaultActor,
      iso: fallbackTime ? fallbackTime.toISOString() : "",
      sort: fallbackTime ? fallbackTime.getTime() : Number.MAX_SAFE_INTEGER,
      isFallback: true,
    });
  }

  output.sort((a, b) => a.sort - b.sort);

  let currentIndex = -1;
  if (normalizedCurrent) {
    output.forEach((entry, idx) => {
      if (entry.status === normalizedCurrent) currentIndex = idx;
    });
  }

  return output.map((entry, idx) => ({
    ...entry,
    isCurrent: idx === currentIndex,
  }));
};

const OrderStatusTimeline = ({
  history,
  createdAt,
  updatedAt,
  currentStatus,
  texts = {},
  formatTimestamp,
  className = "",
}) => {
  const mergedTexts = useMemo(() => {
    const actorTypes = {
      ...DEFAULT_TEXTS.actorTypes,
      ...(texts.actorTypes || {}),
    };
    const defaultNotes = {
      ...DEFAULT_TEXTS.defaultNotes,
      ...(texts.defaultNotes || {}),
    };
    return {
      ...DEFAULT_TEXTS,
      ...texts,
      actorTypes,
      defaultNotes,
    };
  }, [texts]);

  const formatter = typeof formatTimestamp === "function" ? formatTimestamp : defaultFormatTimestamp;
  const entries = useMemo(
    () =>
      buildEntries({
        history,
        createdAt,
        updatedAt,
        currentStatus,
        texts: mergedTexts,
      }),
    [history, createdAt, updatedAt, currentStatus, mergedTexts]
  );

  if (!entries.length) {
    return (
      <div className={`order-status-timeline ${className}`.trim()}>
        {mergedTexts.title && <h4 className="order-status-timeline__title">{mergedTexts.title}</h4>}
        <p className="order-status-timeline__empty">{mergedTexts.empty}</p>
      </div>
    );
  }

  return (
    <div className={`order-status-timeline ${className}`.trim()}>
      {mergedTexts.title && <h4 className="order-status-timeline__title">{mergedTexts.title}</h4>}
      <ol className="timeline-list">
        {entries.map((entry, idx) => {
          const itemClasses = [
            "timeline-item",
            entry.status ? `timeline-item--${entry.status}` : "",
            entry.isCurrent ? "timeline-item--current" : "",
            entry.isFallback ? "timeline-item--fallback" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li className={itemClasses} key={entry.id}>
              <div className="timeline-marker" aria-hidden="true">
                <span className="timeline-dot" />
                {idx !== entries.length - 1 && <span className="timeline-line" />}
              </div>
              <div className="timeline-content">
                <div className="timeline-content__head">
                  <span className="timeline-status">{entry.label}</span>
                  {entry.iso && (
                    <span className="timeline-time">{formatter(entry.iso)}</span>
                  )}
                </div>
                {(entry.note || entry.actor) && (
                  <div className="timeline-content__body">
                    {entry.note && <p className="timeline-note">{entry.note}</p>}
                    {entry.actor && (
                      <div className="timeline-actor">
                        <span className="timeline-actor-label">{mergedTexts.actorLabel}</span>
                        <strong>{entry.actor}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default memo(OrderStatusTimeline);
