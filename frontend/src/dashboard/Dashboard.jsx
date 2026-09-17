// dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../Sidebar-component/Sidebar"; // Sidebar component import
import "./dashboard.css"; // Import dashboard styles
import { useNavigate } from "react-router-dom";
// Import different components based on role
import BookingForm from "../user/BookingForm";
import SuccessfulBooking from "../user/SuccessfullBooking";
import MyMeeting from "../user/MyMeeting";
import MyCalendar from "../user/MyCalendar";
import { useLocation } from "react-router-dom";
import CreateUser from "../admin/CreateUser";
import UserList from "../admin/UserList";
import Approval from "../admin/Booked/Approval";
import ForgotPassword from "../admin/ForgotPassword";
import FullList from "../admin/Booked/FullList";
import OverallDashboard from "../admin/OverallDashboard";
import Reports from "../admin/Reports";
import axios from "axios";
import EmailEntry from './../admin/EmailEntry';

function Dashboard() {
  const [selectedSection, setSelectedSection] = useState("conference"); // Default to conference section
  const [selectedItem, setSelectedItem] = useState(null); // Tracks selected item from the sidebar
  const [role, setRole] = useState("User"); // Default role is 'User'
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // State to control sidebar visibility
  const [sessionExpired, setSessionExpired] = useState(false);
  const idleTimeoutRef = useRef(null);
  const idleTimeLimit = 10 * 60 * 1000; 

  useEffect(() => {
    // Get role from sessionStorage
    const userRole = sessionStorage.getItem("role");
    if (userRole) {
      setRole(userRole); // Set the user role if available in sessionStorage
    }
  }, []);

  const logout = async () => {
    const employeeId = sessionStorage.getItem("employeeId");

    try {
      // Notify the backend to clear activeToken
      await axios.post("https://01-30225:1010/logout", { employeeId });
    } catch (err) {
      console.error("Error during backend logout:", err);
    } finally {
      // Clear session on frontend
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("employeeId");
      sessionStorage.removeItem("requiresPasswordReset");

      // Redirect to login
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

  // Handle visibility (tab/background)
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      resetIdleTimer();
    }
  };

  // Init session watcher
  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetIdleTimer(); // start the timer

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetIdleTimer)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  // Confirm session expiry
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

  // Render content dynamically based on selected section and item
  const renderContent = () => {
    // Common logic for both Admin and User
    if (selectedSection === "conference") {
      switch (selectedItem) {
        case "booking":
          return <BookingForm />;
        case "checking":
          return <SuccessfulBooking />;
        case "mymeeting":
          return <MyMeeting />;
        case "calendar":
          return <MyCalendar />;
        default:
          return (
           <div className="db2-welcome-card">
            <div className="db2-card-content">
              <h2 className="db2-welcome-title">𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐀𝐩𝐨𝐭𝐡𝐞𝐜𝐨𝐧𝐩𝐡𝐚𝐫𝐦𝐚</h2>
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
          ): (
            <FullList />
          );

        case "create":
        case "userlist":
        case "forgot":
           case"emailentry":
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

    return null; // Fallback content if no valid section/item is selected
  };

  return (
    <div className="dashboard-container">
      {/* Pass the role prop and sidebar state/toggle function to Sidebar */}
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

      {/* Display the content based on the selected section/item */}
      <div
        className={`dashboard ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export default Dashboard;
