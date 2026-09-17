import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./LandingPage.css";
import video1 from "../styles/Apothecon.mp4";
import Contact from "../pages/Contact";


const LandingPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [showTourVideo, setShowTourVideo] = useState(false);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

   

  return (
    <>
      <div className="page-wrapper">
        <div className="hero-section">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            onClick={handleVideoClick}
            className="video-bg"
          >
            <source src={video1} type="video/mp4" />
          </video>
          <div className="gradient-overlay" />
          <div className="hero-content">
            <motion.button
              onClick={() => navigate("/login")}
               className="scroll-button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3, duration: 0.8 }}
              whileHover={{ scale: 1.05 }}
            >
                𝑬𝒙𝒑𝒍𝒐𝒓𝒆 𝑴𝒐𝒓𝒆
            </motion.button>
          </div>
        </div>
      
        
      </div>
      <AnimatePresence>
        {showTourVideo && (
          <motion.div
            className="video-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="modal-content">
              <button
                className="close-btn"
                onClick={() => setShowTourVideo(false)}
              >
                ✖
              </button>
              <video controls className="tour-video">
                <source src={video1} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Contact/>
    </>
  );
};

export default LandingPage;
