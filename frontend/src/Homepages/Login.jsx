// Login.jsx - Enhanced Apothecon Style
import React, { useState, useEffect, useRef, useContext } from "react";
import "./Login.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";
import imagelogin from "../styles/APOLOGO-removebg-preview.png";

function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showIdNotice, setShowIdNotice] = useState(false);
  const [idError, setIdError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  const authCardRef = useRef(null);
  const sheenRef = useRef(null);

  // --- Mouse tracking for 3D effects ---
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [authTransform, setAuthTransform] = useState({ rotateX: 0, rotateY: 0 });
  const [clusterOffsets, setClusterOffsets] = useState({
    c1: { x: 0, y: 0 },
    c2: { x: 0, y: 0 },
    c3: { x: 0, y: 0 }
  });

  // --- Particle Network (Canvas) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    const PCOUNT = 200;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < PCOUNT; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          r: Math.random() * 1.4 + 0.6
        });
      }
      particlesRef.current = particles;
    };

    resize();
    initParticles();

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mouseX = mousePosition.x;
      const mouseY = mousePosition.y;

      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          const f = (120 - d) / 120;
          p.x -= dx * 0.01 * f;
          p.y -= dy * 0.01 * f;
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.strokeStyle = `rgba(61,219,209,${(1 - d / 110) * 0.18})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180,225,235,0.55)';
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      resize();
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mousePosition]);

  // --- 3D Card and Cluster Effects ---
  useEffect(() => {
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let targetParX = 0;
    let targetParY = 0;
    let currentParX = 0;
    let currentParY = 0;
    let animFrame;

    const animate = () => {
      currentTiltX += (targetTiltX - currentTiltX) * 0.07;
      currentTiltY += (targetTiltY - currentTiltY) * 0.07;
      currentParX += (targetParX - currentParX) * 0.06;
      currentParY += (targetParY - currentParY) * 0.06;

      setAuthTransform({ rotateX: currentTiltX, rotateY: currentTiltY });
      setClusterOffsets({
        c1: { x: currentParX * -55, y: currentParY * -35 },
        c2: { x: currentParX * 65, y: currentParY * 50 },
        c3: { x: currentParX * 40, y: currentParY * -28 }
      });

      animFrame = requestAnimationFrame(animate);
    };

    const mouseMoveHandler = (e) => {
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      targetTiltY = nx * 16;
      targetTiltX = -ny * 14;
      targetParX = nx;
      targetParY = ny;

      setMousePosition({ x: e.clientX, y: e.clientY });

      if (sheenRef.current && authCardRef.current) {
        const rect = authCardRef.current.getBoundingClientRect();
        sheenRef.current.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
        sheenRef.current.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      }
    };

    window.addEventListener('mousemove', mouseMoveHandler);
    animate();

    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, []);

  const validateEmployeeId = (value) => {
    const idPattern = /^AP\d{4}$/;
    return idPattern.test(value);
  };

  const handleEmployeeIdChange = (e) => {
    let value = e.target.value;
    if (value.startsWith("AP")) {
      value = value.slice(0, 6);
    }
    setEmployeeId(value);

    if (value && !validateEmployeeId(value)) {
      setIdError(
        "Employee ID must be in format: AP followed by 4 digits (e.g., AP1234)",
      );
    } else {
      setIdError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

   
    try {
      setLoading(true);
      setError("");
      
      const response = await axios.post("https://01-30225:1010/api/login", {
        employeeId,
        password,
      });

      const {
        token,
        role,
        requiresPasswordReset,
        employeeId: id,
      } = response.data;

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("requiresPasswordReset", requiresPasswordReset);
      sessionStorage.setItem("employeeId", id);

      const decoded = jwtDecode(token);
      setUser(decoded);

      if (requiresPasswordReset) {
        sessionStorage.setItem("hasCompletedPasswordReset", "false");
        navigate("/newpassword");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError(
          "It appears that this account is currently active on another device, or you may have forgotten to log out from a previous session. Please wait 3 minutes before attempting to log in again. We appreciate your patience.",
        );
      } else {
        setError(
          err.response?.data?.error ||
            "An error occurred during login. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gls-login-container">
      <canvas ref={canvasRef} className="gls-particle-bg"></canvas>
      
      <div className="gls-orbit-field">
        {/* Cluster 1 */}
        <div
          className="gls-cluster"
          style={{
            left: '10%',
            top: '14%',
            transform: `translate3d(${clusterOffsets.c1.x}px, ${clusterOffsets.c1.y}px, 0)`
          }}
        >
          <div className="gls-nucleus"></div>
          <div className="gls-ring" style={{ transform: 'rotateX(62deg) rotateY(0deg)' }}>
            <div className="gls-spin" style={{ animationDuration: '9s' }}>
              <div style={{ position: 'absolute', transform: 'rotateZ(0deg) translateX(50px)' }}>
                <div className="gls-electron" style={{ color: '#3ddbd1' }}></div>
              </div>
            </div>
          </div>
          <div className="gls-ring" style={{ transform: 'rotateX(-50deg) rotateY(25deg)' }}>
            <div className="gls-spin" style={{ animationDuration: '6s' }}>
              <div style={{ position: 'absolute', transform: 'rotateZ(0deg) translateX(36px)' }}>
                <div className="gls-electron" style={{ color: '#3ddbd1' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Cluster 2 */}
        <div
          className="gls-cluster"
          style={{
            right: '10%',
            bottom: '12%',
            transform: `translate3d(${clusterOffsets.c2.x}px, ${clusterOffsets.c2.y}px, 0)`
          }}
        >
          <div className="gls-nucleus"></div>
          <div className="gls-ring" style={{ transform: 'rotateX(55deg) rotateY(10deg)' }}>
            <div className="gls-spin" style={{ animationDuration: '7s' }}>
              <div style={{ position: 'absolute', transform: 'rotateZ(0deg) translateX(34px)' }}>
                <div className="gls-electron" style={{ color: '#8b90fb' }}></div>
              </div>
            </div>
          </div>
          <div className="gls-ring" style={{ transform: 'rotateX(-40deg) rotateY(30deg)' }}>
            <div className="gls-spin" style={{ animationDuration: '5s' }}>
              <div style={{ position: 'absolute', transform: 'rotateZ(0deg) translateX(24px)' }}>
                <div className="gls-electron" style={{ color: '#8b90fb' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Cluster 3 */}
        <div
          className="gls-cluster"
          style={{
            right: '22%',
            top: '18%',
            transform: `translate3d(${clusterOffsets.c3.x}px, ${clusterOffsets.c3.y}px, 0)`
          }}
        >
          <div className="gls-nucleus"></div>
          <div className="gls-ring" style={{ transform: 'rotateX(48deg) rotateY(-15deg)' }}>
            <div className="gls-spin" style={{ animationDuration: '6s' }}>
              <div style={{ position: 'absolute', transform: 'rotateZ(0deg) translateX(26px)' }}>
                <div className="gls-electron" style={{ color: '#f0a93f' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="gls-login-wrapper">
        <div
          ref={authCardRef}
          className="gls-login-card"
          style={{
            transform: `rotateX(${authTransform.rotateX}deg) rotateY(${authTransform.rotateY}deg)`
          }}
        >
          <div ref={sheenRef} className="gls-sheen"></div>
          
          <div className="gls-login-left">
          
              <div className="gls-brand-image-wrapper">
                <img 
                  src={imagelogin} 
                  alt="ApotheconPharma" 
                  className="gls-brand-image"
                />
              </div>
          </div>

          <div className="gls-login-right">
            <h1 className="gls-sign-title">Sign In</h1>
            
            <div className="gls-notice">
              <span className="gls-notice-icon">ℹ️</span>
              <span>Important Note: Employee ID Format</span>
              <span 
                className="gls-notice-dot"
                onClick={() => setShowIdNotice(!showIdNotice)}
                style={{ cursor: 'pointer' }}
              >
                {showIdNotice ? '✕' : 'i'}
              </span>
            </div>

            {showIdNotice && (
              <div className="gls-notice-content">
                <p>✓ Employee ID must start with <strong>"AP"</strong> in capital letters</p>
                <p>✓ Followed by exactly <strong>4 digits</strong> (0-9)</p>
                <p>✓ Example: <strong>AP1234</strong>, <strong>AP5678</strong>, <strong>AP9012</strong></p>
                <p>✓ Maximum 6 characters total</p>
                <div className="gls-format-example">
                  <span>Format: </span>
                  <code>AP + 4 digits (e.g., AP1234)</code>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="gls-login-form">
              <div className="gls-form-group">
                <label className="gls-form-label">
                  <span className="gls-label-icon">👤</span>
                  Employee ID <span className="gls-required">*</span>
                </label>
                <div className="gls-input-wrapper">
                  <input
                    type="text"
                    name="employee_id"
                    className={`gls-form-input ${idError || error ? "gls-input-error" : ""}`}
                    value={employeeId}
                    onChange={handleEmployeeIdChange}
                    placeholder="Enter AP followed by 4 digits (e.g., AP1234)"
                    autoComplete="username"
                    maxLength={6}
                    disabled={loading}
                  />
                </div>
                {idError && (
                  <span className="gls-error-field">{idError}</span>
                )}
              </div>

              <div className="gls-form-group">
                <label className="gls-form-label">
                  <span className="gls-label-icon">🔒</span>
                  Password <span className="gls-required">*</span>
                </label>
                <div className="gls-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className={`gls-form-input ${error && !idError ? "gls-input-error" : ""}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="gls-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    tabIndex="-1"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                {error && (
                  <span className="gls-error-field">{error}</span>
                )}
              </div>

              <button
                type="submit"
                className="gls-login-button"
                disabled={loading}
              >
                {loading ? (
                  <span className="gls-button-loader">
                    <span className="gls-spinner"></span>
                    Authenticating...
                  </span>
                ) : (
                  <>
                    <span>Login</span>
                    <span className="gls-arrow">→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;