// sidebar.jsx
import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Button,
  IconButton,
  Chip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  MeetingRoom as MeetingRoomIcon,
  FormatListBulleted as FormatListBulletedIcon,
  ChecklistRtl as ChecklistRtlIcon,
  AppRegistration as AppRegistrationIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import "./Sidebar.css";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SettingsAccessibilityIcon from "@mui/icons-material/SettingsAccessibility";
import GridViewIcon from "@mui/icons-material/GridView";
import ListAltIcon from "@mui/icons-material/ListAlt";

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
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingsStartingSoon, setMeetingsStartingSoon] = useState([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setEmployees(decoded);
      fetchUpcomingMeetings(token);

      // Refresh meetings every 5 minutes
      const interval = setInterval(
        () => {
          fetchUpcomingMeetings(token);
        },
        5 * 60 * 1000
      );

      return () => clearInterval(interval);
    }
  }, []);

  // Check for meetings starting soon (within 15 minutes)
  useEffect(() => {
    const checkMeetingsStartingSoon = () => {
      const now = new Date();
      const soonMeetings = upcomingMeetings.filter((meeting) => {
        const meetingStart = new Date(`${meeting.date}T${meeting.startTime}`);
        const diffMs = meetingStart - now;
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins >= 0 && diffMins <= 15; // Within 15 minutes
      });

      setMeetingsStartingSoon(soonMeetings);
    };

    checkMeetingsStartingSoon();
    const interval = setInterval(checkMeetingsStartingSoon, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [upcomingMeetings]);

  const fetchUpcomingMeetings = async (token) => {
    try {
      setLoadingMeetings(true);
      const response = await axios.get(
        "https://01-30225:1010/api/booking/my-booking",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const now = new Date();
      const upcoming = response.data.filter((booking) => {
        // Show all bookings that haven't ended yet
        const meetingEndTime = new Date(`${booking.date}T${booking.endTime}`);
        return meetingEndTime > now;
      });

      // Sort by start time (earliest first)
      upcoming.sort((a, b) => {
        const aStart = new Date(`${a.date}T${a.startTime}`);
        const bStart = new Date(`${b.date}T${b.startTime}`);
        return aStart - bStart;
      });

      setUpcomingMeetings(upcoming.slice(0, 99)); // Show up to 8 meetings
    } catch (error) {
      console.error("Error fetching upcoming meetings:", error);
    } finally {
      setLoadingMeetings(false);
    }
  };

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
            onClick={() => handleClick("conference", "checking")}
            startIcon={<ChecklistRtlIcon />}
            sx={{
              fontWeight: "bold",
              color: "#333",
              display: "flex",
              width: "100%",
              justifyContent: isSidebarOpen ? "flex-start" : "center",
            }}
          >
            {isSidebarOpen && "Check Meeting"}
          </Button>
          <Button
            onClick={() => handleClick("conference", "mymeeting")}
            startIcon={<SettingsAccessibilityIcon />}
            sx={{
              fontWeight: "bold",
              color: "#333",
              display: "flex",
              width: "100%",
              justifyContent: isSidebarOpen ? "flex-start" : "center",
              position: "relative",
            }}
          >
            {isSidebarOpen && "My Meeting"}
            {isSidebarOpen && upcomingMeetings.length > 0 && (
              <Chip
                label={upcomingMeetings.length}
                size="small"
                color={meetingsStartingSoon.length > 0 ? "error" : "primary"}
                sx={{
                  ml: 1,
                  fontSize: "0.7rem",
                  height: "20px",
                  minWidth: "20px",
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            )}
          </Button>
          <Button
            onClick={() => handleClick("conference", "calendar")}
            startIcon={<CalendarMonthIcon />}
            sx={{
              fontWeight: "bold",
              color: "#333",
              display: "flex",
              width: "100%",
              justifyContent: isSidebarOpen ? "flex-start" : "center",
            }}
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
