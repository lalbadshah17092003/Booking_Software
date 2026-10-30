// dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../Sidebar-component/Sidebar"; // Sidebar component import
import "./dashboard.css"; // Import dashboard styles
import { useNavigate, useLocation } from "react-router-dom";
import BookingForm from "../user/BookingForm";
import MyCalendar from "../user/MyCalendar";
import CreateUser from "../admin/CreateUser";
import UserList from "../admin/UserList";
import Approval from "../admin/Booked/Approval";
import ForgotPassword from "../admin/ForgotPassword";
import FullList from "../admin/Booked/FullList";
import OverallDashboard from "../admin/OverallDashboard";
import Reports from "../admin/Reports";
import axios from "axios";
import EmailEntry from "./../admin/EmailEntry";

function Dashboard() {
  const [selectedSection, setSelectedSection] = useState("conference");
  const [selectedItem, setSelectedItem] = useState(null);
  const [role, setRole] = useState("User");
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const idleTimeoutRef = useRef(null);
  const idleTimeLimit = 10 * 60 * 1000;

  useEffect(() => {
    const userRole = sessionStorage.getItem("role");
    if (userRole) {
      setRole(userRole);
    }
  }, []);

  const logout = async () => {
    const employeeId = sessionStorage.getItem("employeeId");

    try {
      await axios.post("https://192.168.0.150:5000/logout", { employeeId });
    } catch (err) {
      console.error("Error during backend logout:", err);
    } finally {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("employeeId");
      sessionStorage.removeItem("requiresPasswordReset");

      navigate("/");
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const location = useLocation();

  // Resets timer on user activity
  const resetIdleTimer = () => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      setSessionExpired(true);
    }, idleTimeLimit);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      resetIdleTimer();
    }
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetIdleTimer();

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetIdleTimer)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  const handleSessionLogout = () => {
    sessionStorage.clear();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (location.state?.section && location.state?.item) {
      setSelectedSection(location.state.section);
      setSelectedItem(location.state.item);
    }
  }, [location.state]);

  // ---------------------------------------------------------------------------
  // Render content
  // ---------------------------------------------------------------------------
  const renderContent = () => {
    // Conference section
    if (selectedSection === "conference") {
      if (selectedItem === "booking") return <BookingForm />;
      if (selectedItem === "calendar") return <MyCalendar />;

      // Default: welcome card (unchanged)
      return (
        <div className="db2-welcome-card">
          <div className="db2-card-content">
            <h2 className="db2-welcome-title">
              𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐀𝐩𝐨𝐭𝐡𝐞𝐜𝐨𝐧𝐩𝐡𝐚𝐫𝐦𝐚
            </h2>
            <div className="db2-welcome-sub">Caring for Humanity</div>

            <div className="icon-row">
              <span>🧪</span>
              <span>💊</span>
              <span>🌿</span>
              <span>⚕️</span>
            </div>
          </div>
        </div>
      );
    }

    if (selectedSection === "admin") {
      switch (selectedItem) {
        case "overalldashboard":
        case "approval":
        case "fulllist":
        case "reports":
          // Accessible to both Admin and HR
          return selectedItem === "overalldashboard" ? (
            <OverallDashboard />
          ) : selectedItem === "approval" ? (
            <Approval />
          ) : selectedItem === "reports" ? (
            <Reports />
          ) : (
            <FullList />
          );

        case "create":
        case "userlist":
        case "forgot":
        case "emailentry":
          // Accessible to Admin only
          if (role === "Admin") {
            if (selectedItem === "create") return <CreateUser />;
            if (selectedItem === "userlist") return <UserList />;
            if (selectedItem === "emailentry") return <EmailEntry />;
            if (selectedItem === "forgot") return <ForgotPassword />;
          } else {
            return (
              <div className="unauthorized-message">
                <h3>Access Denied</h3>
                <p>You do not have permission to view this page.</p>
              </div>
            );
          }
          break;

        default:
          return <OverallDashboard />;
      }
    }

    return null;
  };

  return (
    <div className="dashboard-container">
      {sessionExpired && (
        <div className="session-expired-modal">
          <div className="modal-content">
            <h2>Session Expired</h2>
            <p>Your session expired due to inactivity.</p>
            <button onClick={handleSessionLogout}>OK</button>
          </div>
        </div>
      )}

      <Sidebar
        setSelectedSection={setSelectedSection}
        setSelectedItem={setSelectedItem}
        role={role}
        logout={logout}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div
        className={`dashboard ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export default Dashboard;
