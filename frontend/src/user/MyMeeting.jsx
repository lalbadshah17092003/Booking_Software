import React, { useState, useEffect } from "react";
import axios from "axios";
import "./MyMeeting.css";

// Import Material-UI components for dialogs
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Snackbar,
  Alert,
  Typography,
} from "@mui/material";

const MyMeeting = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    date: "",
    room: "",
    status: "approved", // Default to only approved meetings
    search: "",
  });

  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [updatedData, setUpdatedData] = useState({
    room: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [conflictDetails, setConflictDetails] = useState(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Room options with images
  const roomOptions = [
    { name: "Admin Conference Room", image: require("../styles/AUM_0334.webp") },
    {
      name: "QA Conference Room",
      image: require("../styles/QA_conference.webp"),
    },
    { name: "QA Training Room", image: require("../styles/QA_Training.webp") },
    { name: "Meeting Room 1", image: require("../styles/training.webp") },
    { name: "Meeting Room 2", image: require("../styles/training.webp") },
  ];

  useEffect(() => {
    fetchMyMeetings();
  }, []);

  const fetchMyMeetings = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("token");

      if (!token) {
        throw new Error("No token found");
      }

      const response = await axios.get(
        "https://192.168.0.150:5000/api/booking/my-booking",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMeetings(response.data);
    } catch (err) {
      console.error("Error fetching meetings:", err);
      setError("Failed to load your meetings");
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleEditMeeting = (meeting) => {
    setCurrentMeeting(meeting);
    setSelectedRoom(meeting.room);
    setUpdatedData({
      room: meeting.room,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
    });
    setEditDialogOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUpdatedData((prev) => ({ ...prev, [name]: value }));
  };

  const validateTime = () => {
    setConflictDetails(null);
    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const { date, startTime, endTime } = updatedData;

    if (!startTime || !endTime) return false;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    if (start >= end) {
      setConflictDetails({
        message: "Start time must be before end time.",
      });
      return false;
    }

    if (date < todayDate || (date === todayDate && start < now)) {
      setConflictDetails({
        message:
          "You cannot set a meeting in the past. Please change the meeting time.",
      });
      return false;
    }

    const conflict = meetings.find((m) => {
      if (
        m._id === currentMeeting._id ||
        m.status === "cancelled" ||
        m.room !== selectedRoom ||
        m.date !== date
      )
        return false;
      const mStart = new Date(`${m.date}T${m.startTime}`);
      const mEnd = new Date(`${m.date}T${m.endTime}`);
      return start < mEnd && end > mStart;
    });

    if (conflict) {
      setConflictDetails({
        message: "This time slot conflicts with an existing meeting.",
        room: conflict.room,
        date: conflict.date,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
      });
      return false;
    }

    return true;
  };

  const handleUpdateMeeting = async () => {
    if (!validateTime()) return;

    try {
      const token = sessionStorage.getItem("token");
      await axios.put(
        `https://192.168.0.150:5000/update-byuser/${currentMeeting._id}`,
        {
          ...updatedData,
          room: selectedRoom,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMeetings((prev) =>
        prev.map((m) =>
          m._id === currentMeeting._id
            ? { ...m, ...updatedData, room: selectedRoom }
            : m
        )
      );
      setEditDialogOpen(false);
      handleSnackbar("Meeting updated successfully");
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.response?.data ||
        error.message ||
        "Failed to update meeting.";
      handleSnackbar(msg, "error");
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    if (window.confirm("Are you sure you want to cancel this meeting?")) {
      try {
        const token = sessionStorage.getItem("token");
        await axios.put(
          `https://192.168.0.150:5000/api/booking/${meetingId}`,
          { status: "cancelled" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setMeetings((prev) =>
          prev.map((m) =>
            m._id === meetingId ? { ...m, status: "cancelled" } : m
          )
        );
        handleSnackbar("Meeting cancelled successfully");
      } catch (error) {
        const msg =
          error.response?.data?.message ||
          error.response?.data ||
          error.message ||
          "Failed to cancel meeting.";
        handleSnackbar(msg, "error");
      }
    }
  };

  const handleCloseMeeting = async (meetingId) => {
    try {
      const token = sessionStorage.getItem("token");
      await axios.post(
        "https://192.168.0.150:5000/api/booking/close",
        { bookingId: meetingId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMeetings((prev) =>
        prev.map((m) =>
          m._id === meetingId ? { ...m, status: "completed" } : m
        )
      );
      handleSnackbar("Meeting marked as completed");
    } catch (error) {
      handleSnackbar("Failed to complete meeting.", "error");
    }
  };
  const filteredMeetings = meetings
    .filter((meeting) => {
      // By default only show approved meetings if no other status is selected
      const matchesStatus = filter.status
        ? meeting.status === filter.status
        : meeting.status === "approved";

      const matchesDate = filter.date ? meeting.date === filter.date : true;
      const matchesRoom = filter.room
        ? meeting.room.toLowerCase().includes(filter.room.toLowerCase())
        : true;
      const matchesSearch = filter.search
        ? meeting.subject
            ?.toLowerCase()
            .includes(filter.search.toLowerCase()) ||
          meeting.room.toLowerCase().includes(filter.search.toLowerCase())
        : true;

      return matchesStatus && matchesDate && matchesRoom && matchesSearch;
    })
    .sort((a, b) => {
      // Sort by date and start time (upcoming first)
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA - dateB;
    });

  const getMeetingStatus = (meeting) => {
    const now = new Date();

    // Ensure time format is correct (add seconds if missing)
    const startTime = meeting.startTime.includes(":")
      ? meeting.startTime.split(":").length === 2
        ? `${meeting.startTime}:00`
        : meeting.startTime
      : meeting.startTime;
    const endTime = meeting.endTime.includes(":")
      ? meeting.endTime.split(":").length === 2
        ? `${meeting.endTime}:00`
        : meeting.endTime
      : meeting.endTime;

    const meetingStart = new Date(`${meeting.date}T${startTime}`);
    const meetingEnd = new Date(`${meeting.date}T${endTime}`);

    // For debugging - you can uncomment these lines to see the times in console
    console.log("Meeting:", meeting.ma || "Meeting", "Status:", meeting.status);
    console.log("Now:", now.toISOString());
    console.log("Start:", meetingStart.toISOString());
    console.log("End:", meetingEnd.toISOString());
    console.log("Is ongoing:", now >= meetingStart && now <= meetingEnd);

    if (meeting.status === "cancelled") {
      return { status: "cancelled", text: "Cancelled", color: "#6c757d" };
    } else if (meeting.status === "completed") {
      return { status: "completed", text: "Completed", color: "#28a745" };
    } else if (meeting.status === "pending") {
      return { status: "pending", text: "Pending", color: "#ffc107" };
    } else if (meeting.status === "declined") {
      return { status: "declined", text: "Declined", color: "#dc3545" };
    } else if (meeting.status === "closed") {
      return { status: "closed", text: "Closed", color: "#6c757d" };
    } else if (meeting.status === "ongoing") {
      return { status: "ongoing", text: "Live Now", color: "#dc3545" };
    } else if (meeting.status === "approved") {
      // Convert to timestamps for more accurate comparison
      const nowTime = now.getTime();
      const startTime = meetingStart.getTime();
      const endTime = meetingEnd.getTime();

      if (nowTime < startTime) {
        return { status: "apprvoed", text: "Upcoming", color: "#17a2b8" };
      } else if (nowTime >= startTime && nowTime <= endTime) {
        return { status: "ongoing", text: "Live Now", color: "#dc3545" };
      } else {
        return { status: "approved", text: "upcoming", color: "#6c757d" };
      }
    } else {
      return { status: "unknown", text: "Unknown", color: "#6c757d" };
    }
  };

  const formatTime = (time) => {
    return time.substring(0, 5); // Remove seconds if present
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="my-meeting-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-meeting-container">
      <div className="my-meeting-header">
        <h1>📅 My Meetings</h1>
      </div>

      {error && <div className="error-message">{error}</div>}
      <div className="filter-section">

            <div className="filter-container">
              <label>
                <b>Date:</b>
                <input
                  type="date"
                  name="date"
                  value={filter.date}
                  onChange={(e) =>
                    setFilter({ ...filter, date: e.target.value })
                  }
                />
              </label>
              <label>
                <b>Status:</b>
                <select
                  type="text"
                  name="status"
                  value={filter.status}
                  onChange={(e) =>
                    setFilter({ ...filter, status: e.target.value })
                  }
                >
                  <option value="">Select Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="declined">Declined</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="closed">Closed</option>
                  <option value="completed">Completed</option>
                  
                </select>
              </label>
              <label>
                <b>Room:</b>
                <select
                  name="room"
                  placeholder="Filter by Room"
                  value={filter.room}
                  onChange={(e) =>
                    setFilter({ ...filter, room: e.target.value })
                  }
                >
                  <option value="">Select Room</option>
                  <option value="Admin Conference Room">
                    Admin Conference Room
                  </option>
                  <option value="QA Conference Room">QA Conference Room</option>
                  <option value="QA Training Room">QA Training Room</option>
                  <option value="Meeting Room 1">Meeting Room 1</option>
                  <option value="Meeting Room 2">Meeting Room 2</option>
                </select>
              </label>
            </div>
      </div>

      <div className="meetings-grid">
        {filteredMeetings.length === 0 ? (
          <div className="no-meetings">
            <div className="no-meetings-icon">📅</div>
            <h3>No meetings found</h3>
          </div>
        ) : (
          filteredMeetings.map((meeting) => {
            const status = getMeetingStatus(meeting);
            return (
              <div key={meeting._id} className="meeting-card">
                <div className="meeting-header">
                  <span
                    className="meeting-status"
                    style={{ backgroundColor: status.color }}
                  >
                    {status.text}
                  </span>
                </div>

                <div className="meeting-details">
                  <div className="meeting-info">
                    <div className="info-item">
                      <span className="info-label">📅 Date:</span>
                      <span className="info-value">
                        {formatDate(meeting.date)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">⏰ Time:</span>
                      <span className="info-value">
                        {formatTime(meeting.startTime)} -{" "}
                        {formatTime(meeting.endTime)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">🏢 Room:</span>
                      <span className="info-value">{meeting.room}</span>
                    </div>
                    <div>
                      <h3 className="meeting-title">
                        {meeting.ma || "Meeting"}
                      </h3>
                    </div>
                  </div>

                  <div className="meeting-actions">
                    {/* Always show join button if meetingLink is present and not cancelled/completed/declined */}

                    {meeting.status === "pending" && (
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEditMeeting(meeting)}
                          className="edit-button"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleCancelMeeting(meeting._id)}
                          className="cancel-button"
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    )}
                    {status.status === "ongoing" && (
                      <div className="action-buttons side-by-side">
                        <button
                          onClick={() => handleCloseMeeting(meeting._id)}
                          className="complete-button"
                        >
                          ✅ Complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="refresh-section">
        <button onClick={fetchMyMeetings} className="refresh-button">
          🔄 Refresh Meetings
        </button>
      </div>

      {/* Edit Meeting Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setConflictDetails(null);
        }}
        fullWidth
        maxWidth="sm"
        className="edit-dialog"
      >
        <DialogTitle>Edit Meeting</DialogTitle>
        <DialogContent>
          {conflictDetails && (
            <div className="conflict-banner">
              <span className="msg-icon" role="img" aria-label="Conflict">
                ⚠️
              </span>
              <span>
                {conflictDetails.message}
                {conflictDetails.room && (
                  <>
                    <br />
                    <b>Room:</b> {conflictDetails.room} <b>Date:</b>{" "}
                    {conflictDetails.date} <b>Time:</b>{" "}
                    {conflictDetails.startTime} - {conflictDetails.endTime}
                  </>
                )}
              </span>
            </div>
          )}
          <TextField
            label="Room"
            value={selectedRoom}
            onClick={() => setRoomModalOpen(true)}
            fullWidth
            margin="normal"
            InputProps={{ readOnly: true }}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                name="date"
                label="Date"
                fullWidth
                margin="normal"
                InputProps={{
                  inputProps: {
                    min: new Date().toISOString().split("T")[0], // disables past dates
                  },
                }}
                InputLabelProps={{ shrink: true }}
                value={updatedData.date}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="time"
                name="startTime"
                label="Start Time"
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
                value={updatedData.startTime}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="time"
                name="endTime"
                label="End Time"
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
                value={updatedData.endTime}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDialogOpen(false);
              setConflictDetails(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateMeeting}
            disabled={!!conflictDetails}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Room Selection Dialog */}
      <Dialog
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        maxWidth="md"
        fullWidth
        className="room-dialog"
      >
        <DialogTitle>Select a Room</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {roomOptions.map((option) => (
              <Grid item xs={12} sm={6} md={4} key={option.name}>
                <Card
                  className={`room-card ${selectedRoom === option.name ? "selected" : ""}`}
                >
                  <CardActionArea
                    onClick={() => {
                      setSelectedRoom(option.name);
                      setRoomModalOpen(false);
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="140"
                      image={option.image}
                      alt={option.name}
                    />
                    <CardContent>
                      <Typography variant="h6" align="center">
                        {option.name}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        className="custom-snackbar"
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={handleCloseSnackbar}
          sx={{
            width: "100%",
            backgroundColor: "transparent",
            boxShadow: "none",
            color: "inherit",
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default MyMeeting;
