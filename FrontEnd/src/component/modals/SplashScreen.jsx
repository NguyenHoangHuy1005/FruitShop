import { motion } from "framer-motion";
//import logo from "https://res.cloudinary.com/dnk3xed3n/video/upload/v1755961018/videobanner_hfhhoc.mp4"; // video mp4

const SplashScreen = () => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#fff",
        objectFit: 'cover',
      }}
    >
      <motion.video
        src="https://res.cloudinary.com/dnk3xed3n/video/upload/v1755961018/videobanner_hfhhoc.mp4"
        autoPlay
        muted
        playsInline
        onEnded={() => console.log("Video finished")}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />

    </div>
  );
};

export default SplashScreen;
