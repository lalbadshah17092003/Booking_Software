// sidebar.jsx
import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Button,
  IconButton,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  MeetingRoom as MeetingRoomIcon,
  FormatListBulleted as FormatListBulletedIcon,
  AppRegistration as AppRegistrationIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import { jwtDecode } from "jwt-decode";
import "./Sidebar.css";
import GridViewIcon from "@mui/icons-material/GridView";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

function Sidebar({
  setSelectedSection,
  setSelectedItem,
  role,
  logout,
  isSidebarOpen,
  toggleSidebar,
}) {
  const [employees, setEmployees] = useState(null);
  const [expanded, setExpanded] = useState(null); // State to track which accordion is expanded

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setEmployees(decoded);
    }
  }, []);

  const buttonStyle = {
    fontWeight: "bold",
    color: "#333",
    display: "flex",
    width: "100%",
    justifyContent: isSidebarOpen ? "flex-start" : "center",
  };

  const handleClick = (section, item) => {
    setSelectedSection(section);
    setSelectedItem(item);
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : null); // Set expanded to the panel or null if closed
  };

  return (
    <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        {isSidebarOpen ? (
          <>
            <IconButton onClick={toggleSidebar}>
              <MenuIcon />
              <ChevronLeftIcon />
            </IconButton>
          </>
        ) : (
          <IconButton onClick={toggleSidebar}>
            <MenuIcon />

            <ChevronRight />
          </IconButton>
        )}
      </div>

      {/* User Accordion */}
      <Accordion
        expanded={expanded === "user"}
        onChange={handleAccordionChange("user")}
      >
        <AccordionSummary
          expandIcon={isSidebarOpen && <ExpandMoreIcon />}
          aria-controls="user-content"
          id="user-header"
        >
          <Typography sx={{ fontWeight: "bold", color: "#333" }}>
            {isSidebarOpen ? "Book Meetings" : <MeetingRoomIcon />}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            onClick={() => handleClick("conference", "booking")}
            startIcon={<MeetingRoomIcon />}
            sx={{
              fontWeight: "bold",
              color: "#333",
              display: "flex",
              width: "100%",
              justifyContent: isSidebarOpen ? "flex-start" : "center",
            }}
          >
            {isSidebarOpen && "Book Meeting"}
          </Button>
          <Button
            onClick={() => handleClick("conference", "calendar")}
            startIcon={<CalendarMonthIcon />}
            sx={buttonStyle}
          >
            {isSidebarOpen && "Calendar"}
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* Admin Accordion (only for Admin or HR) */}
      {(role === "Admin" || role === "Hr") && (
        <Accordion
          expanded={expanded === "admin"}
          onChange={handleAccordionChange("admin")}
        >
          <AccordionSummary
            expandIcon={isSidebarOpen && <ExpandMoreIcon />}
            aria-controls="admin-content"
            id="admin-header"
          >
            <Typography sx={{ fontWeight: "bold", color: "#333" }}>
              {isSidebarOpen ? "Admin" : <GridViewIcon />}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Button
              onClick={() => handleClick("admin", "overalldashboard")}
              startIcon={<GridViewIcon />}
              sx={buttonStyle}
            >
              {isSidebarOpen && "Dashboard"}
            </Button>
            <Button
              onClick={() => handleClick("admin", "approval")}
              startIcon={<AppRegistrationIcon />}
              sx={buttonStyle}
            >
              {isSidebarOpen && "Approval"}
            </Button>
            <Button
              onClick={() => handleClick("admin", "fulllist")}
              startIcon={<ListAltIcon />}
              sx={buttonStyle}
            >
              {isSidebarOpen && "Meetings"}
            </Button>
            <Button
                  onClick={() => handleClick("admin", "reports")}
                  startIcon={<AssessmentIcon />}
                  sx={buttonStyle}
                >
                  {isSidebarOpen && "Reports "}
                </Button>
               


            {role === "Admin" && (
              <>
               
                <Button
                  onClick={() => handleClick("admin", "userlist")}
                  startIcon={<FormatListBulletedIcon />}
                  sx={buttonStyle}
                >
                  {isSidebarOpen && "Users "}
                </Button>
                 <Button
                  onClick={() => handleClick("admin", "emailentry")}
                  startIcon={<AssessmentIcon />}
                  sx={buttonStyle}
                >
                  {isSidebarOpen && "Email Entry"}
                </Button>
              </>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Logout Button */}
      <Button
        onClick={logout}
        startIcon={<LogoutIcon />}
        color="error"
        variant="contained"
        className="logout-btn"
        sx={{
          display: "flex",
          justifyContent: isSidebarOpen ? "flex-start" : "center",
          paddingLeft: isSidebarOpen ? "16px" : "8px",
          paddingRight: isSidebarOpen ? "16px" : "8px",
        }}
      >
        {isSidebarOpen && "Logout"}
        {!isSidebarOpen && <LogoutIcon />}
      </Button>

      {/* Profile Info */}
      {isSidebarOpen && (
        <div className="profile-container">
          <div className="profile-details">
            <Typography
              variant="body2"
              sx={{ fontWeight: "bold", color: "#333" }}
            >
              <b>Employee ID:</b> {employees?.employeeId}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: "bold", color: "#333" }}
            >
              <b>Role:</b> {role}
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
