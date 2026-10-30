/* eslint-disable no-undef */
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import "./Approval.css";
import { jwtDecode } from "jwt-decode";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";
import { Snackbar, Alert } from "@mui/material";

const extractErrorMessage = (error, fallback = "An error occurred.") => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return fallback;
};

const Approval = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatedData, setUpdatedData] = useState({
    room: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [viewMode, setViewMode] = useState("cards");
  const [searchTerm, setSearchTerm] = useState("");

  const [filter, setFilter] = useState({
    room: "",
    date: "",
    status: "pending",
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionType, setActionType] = useState("");
  const [bookingToConfirm, setBookingToConfirm] = useState(null);
  const [remark, setRemark] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [declinedBy, setDeclinedBy] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("asc");
  const { instance, accounts } = useMsal();
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loadingApprovalId, setLoadingApprovalId] = useState(null);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [approvalConfirmation, setApprovalConfirmation] = useState({
    show: false,
    booking: null,
    status: null,
  });

  const loadingTimeoutRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || "https://192.168.0.150:5000";

  useEffect(() => {
    const abortController = new AbortController();

    const fetchBookings = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/booking`, {
          signal: abortController.signal,
        });
        setBookings(response.data);
      } catch (error) {
        if (
          axios.isCancel(error) ||
          error.name === "CanceledError" ||
          error.code === "ERR_CANCELED" ||
          abortController.signal.aborted
        ) {
          return;
        }

        console.error("Error fetching bookings:", error);
        setErrorMessage("Failed to load bookings");
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchBookings();

    return () => {
      abortController.abort();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [API_BASE_URL]);

  const handleRemarkChange = (e) => {
    setRemark(e.target.value);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetFilters = () => {
    setFilter({
      room: "",
      date: "",
      status: "pending",
    });
    setSortField("date");
    setSortOrder("asc");
    setSearchTerm("");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
      alert("✅ Login successful!");
    } catch (e) {
      console.error(e);
    }
  };

  const hasConflict = (room, date, startTime, endTime, excludeId = null) => {
    const conflict = bookings.some((b) => {
      if (b.status !== "approved" && b.status !== "ongoing") return false;
      if (excludeId && b._id === excludeId) return false;
      if (b.room !== room || b.date !== date) return false;

      const bStart = new Date(`${b.date}T${b.startTime}`);
      const bEnd = new Date(`${b.date}T${b.endTime}`);
      const newStart = new Date(`${date}T${startTime}`);
      const newEnd = new Date(`${date}T${endTime}`);

      return newStart < bEnd && newEnd > bStart;
    });

    if (conflict) {
      setErrorMessage(
        "⚠️ Conflict detected: selected time overlaps with another approved/ongoing booking.",
      );
    }
    return conflict;
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setApprovalConfirmation({ show: false, booking: null, status: null });
    setBookingToConfirm(null);
    setActionType("");
    setLoadingActionId(null);
    setErrorMessage("");
    setRemark("");

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  };

  const handleStatusChange = async (id, status, booking) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    setLoadingActionId(id);

    if (status === "approved") {
      if (
        hasConflict(
          booking.room,
          booking.date,
          booking.startTime,
          booking.endTime,
          id,
        )
      ) {
        setErrorMessage(
          "Cannot approve: selected slot conflicts with another booking.",
        );
        setLoadingActionId(null);
        return;
      }
      setApprovalConfirmation({ show: true, booking, status });
      return;
    }

    setActionType("statusChange");
    setBookingToConfirm({ id, status });
    setShowConfirmation(true);
  };



  const handleGeneralConfirm = async () => {
    const { id, status } = bookingToConfirm;
    const token = sessionStorage.getItem("token");

    try {
      await axios.put(
        `${API_BASE_URL}/api/booking/${id}`,
        {
          status: status,
          declinedBy: status === "declined" ? declinedBy : undefined,
          remark,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const updatedBookings = bookings.map((booking) =>
        booking._id === id ? { ...booking, status: status, remark } : booking,
      );
      setBookings(updatedBookings);
      setRemark("");
      setSuccessMessage(`Booking ${status} successfully!`);
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err) {
      if (err.response && err.response.data) {
        setErrorMessage(
          err.response.data.message || `Failed to ${status} booking.`,
        );
      } else {
        setErrorMessage(`Failed to ${status} booking.`);
      }
    } finally {
      setShowConfirmation(false);
      setBookingToConfirm(null);
      setActionType("");
      setLoadingActionId(null);
    }
  };

  const handleEdit = (booking) => {
    setEditMode(true);
    setCurrentBooking(booking);
    setRemark(booking.remark || "");
    setUpdatedData({
      room: booking.room,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUpdatedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleCloseEditForm = () => {
    setEditMode(false);
  };

  const handleApprovalConfirm = async () => {
    const { booking } = approvalConfirmation;
    const id = booking._id;

    if (
      hasConflict(
        booking.room,
        booking.date,
        booking.startTime,
        booking.endTime,
        id,
      )
    ) {
      setErrorMessage(
        "Cannot approve: time slot conflicts with another approved/ongoing booking.",
      );
      setApprovalConfirmation({ show: false, booking: null, status: null });
      setLoadingActionId(null);
      return;
    }

    const adminToken = sessionStorage.getItem("token");
    if (!adminToken) {
      alert("❌ Admin token missing. Please log in again.");
      setLoadingActionId(null);
      return;
    }

    let msGraphToken = null;

    try {
      if (!accounts || accounts.length === 0) {
        alert("Please sign in with Microsoft first!");
        setLoadingActionId(null);
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        msGraphToken = tokenResponse.accessToken;
      } catch (silentError) {
        const popupResponse = await instance.acquireTokenPopup(loginRequest);
        msGraphToken = popupResponse.accessToken;
      }

      const res = await axios.put(
        `${API_BASE_URL}/api/booking/${id}`,
        {
          status: "approved",
          remark,
          msGraphToken,
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      setSuccessMessage("Booking Approved! Added to Outlook Calendar.");

      setBookings((prev) =>
        prev.map((b) => (b._id === id ? res.data.booking : b)),
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, "Approval failed."));
    } finally {
      setApprovalConfirmation({ show: false, booking: null, status: null });
      setLoadingApprovalId(null);
      setLoadingActionId(null);
    }
  };

  const handleUpdate = async () => {
    const { room, date, startTime, endTime } = updatedData;

    if (!room || !date || !startTime || !endTime) {
      setErrorMessage("All fields are required!");
      return;
    }

    const now = new Date();
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (startDateTime < now) {
      setErrorMessage("Cannot book a past time.");
      return;
    }

    if (endDateTime <= startDateTime) {
      setErrorMessage("End time must be after start time.");
      return;
    }

    if (hasConflict(room, date, startTime, endTime, currentBooking._id)) {
      setErrorMessage(
        "⚠️ Cannot update: selected time conflicts with another approved/ongoing booking.",
      );
      setLoadingUpdate(false);
      return;
    }

    const adminToken = sessionStorage.getItem("token");
    if (!adminToken) {
      setErrorMessage("Please log in as admin again.");
      return;
    }

    setLoadingUpdate(true);
    let msGraphToken = null;

    try {
      if (!accounts || accounts.length === 0) {
        setErrorMessage("Please sign in with Microsoft first.");
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        msGraphToken = tokenResponse.accessToken;
      } catch (silentError) {
        const popupResponse = await instance.acquireTokenPopup(loginRequest);
        msGraphToken = popupResponse.accessToken;
      }

      const res = await axios.put(
        `${API_BASE_URL}/api/booking/update/${currentBooking._id}`,
        {
          ...updatedData,
          remark,
          status: "approved",
          msGraphToken,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      const updatedBooking = res.data;

      setBookings((prev) =>
        prev.map((b) =>
          b._id === currentBooking._id
            ? {
                ...b,
                ...updatedData,
                remark,
                status: "approved",
                meetingLink: updatedBooking.meetingLink,
              }
            : b,
        ),
      );

      setSuccessMessage(
        "Booking updated & added to Outlook Calendar successfully.",
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, "Failed to update booking."));
    } finally {
      setLoadingUpdate(false);
      setEditMode(false);
    }
  };

  const handleClose = async (bookingId) => {
    try {
      const token = sessionStorage.getItem("token");
      await axios.put(
        `${API_BASE_URL}/api/booking/${bookingId}`,
        {
          status: "completed",
          remark: "Manually completed by admin",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const updatedBookings = bookings.map((booking) =>
        booking._id === bookingId
          ? { ...booking, status: "completed" }
          : booking,
      );
      setBookings(updatedBookings);
      setSuccessMessage("Booking completed successfully!");
    } catch (err) {
      setErrorMessage("Failed to complete booking.");
    }
  };

  const getLoggedInUser = () => {
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        return jwtDecode(token);
      } catch (error) {
        console.error("Invalid token:", error);
        sessionStorage.removeItem("token");
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    const loggedInUser = getLoggedInUser();
    if (loggedInUser) {
      setApprovedBy(loggedInUser.employeeId);
      setDeclinedBy(loggedInUser.employeeId);
    }
  }, []);

  const filteredBookings = bookings.filter((booking) => {
    const matchesRoom = booking.room
      .toLowerCase()
      .includes(filter.room.toLowerCase());
    const matchesDate = filter.date ? booking.date === filter.date : true;
    const matchesStatus = filter.status
      ? booking.status === filter.status
      : true;
    return matchesRoom && matchesDate && matchesStatus;
  });

  const getStatusColor = (status) => {
    const statusColors = {
      pending: "#ffc107",
      approved: "#28a745",
      declined: "#dc3545",
      cancelled: "#6c757d",
      closed: "#343a40",
      completed: "#17a2b8",
      ongoing: "#007bff",
    };
    return statusColors[status] || "#6c757d";
  };

  const formatTime24 = (time) => {
    if (!time) return "";
    return time.substring(0, 5);
  };

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    if (sortField === "date") {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const SkeletonCard = () => (
    <div className="skeleton-card">
      <div className="skeleton-header"></div>
      <div className="skeleton-body">
        <div className="skeleton-line"></div>
        <div className="skeleton-line short"></div>
        <div className="skeleton-line medium"></div>
      </div>
      <div className="skeleton-footer">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
  );

  const SkeletonList = () => (
    <div className="skeleton-list-item">
      <div className="skeleton-avatar"></div>
      <div className="skeleton-list-content">
        <div className="skeleton-line"></div>
        <div className="skeleton-line short"></div>
      </div>
      <div className="skeleton-list-actions">
        <div className="skeleton-button small"></div>
        <div className="skeleton-button small"></div>
      </div>
    </div>
  );

  const EmptyState = () => (
    <div className="empty-state">
      <div className="empty-illustration">📭</div>
      <h3>No bookings found</h3>
      <p>Try adjusting your filters or check back later</p>
      <button onClick={resetFilters} className="reset-btn">
        Reset all filters
      </button>
    </div>
  );

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState(null);

  const handleOpenDetailsModal = (booking) => {
    setSelectedDetailsBooking(booking);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDetailsBooking(null);
  };

  const CardView = () => (
    <>
      <div className="cards-container">
        {sortedBookings.map((booking) => {
          const isToday =
            booking.date === new Date().toISOString().split("T")[0];
          return (
            <div key={booking._id} className="card">
              <div
                className="status-badge"
                style={{ backgroundColor: getStatusColor(booking.status) }}
              >
                {booking.status.toUpperCase()}
              </div>

              <div className="card-content">
                <div className="employee-info">
                  <div className="profile-avatar">
                    {booking.empName &&
                      booking.empName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="employee-name1">{booking.empName}</h3>
                    <p className="employee-id1">ID: {booking.employeeId}</p>
                  </div>
                </div>

                <div className="booking-info">
                  <div className="room-time">
                    <span className="room-name">{booking.room}</span>
                    <span className="bullet-separator">•</span>
                    <span className="booking-time">
                      {formatTime24(booking.startTime)} -{" "}
                      {formatTime24(booking.endTime)}
                    </span>
                  </div>
                  <p className="booking-date">
                    {booking.date}
                    {isToday && <span className="today-badge"> Today</span>}
                  </p>
                </div>
                <button
                  className="quick-details-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDetailsModal(booking);
                  }}
                >
                  📋 View All Details
                </button>
              </div>

              <div className="action-buttons">
                {booking.status !== "closed" &&
                  booking.status !== "completed" &&
                  new Date() <
                    new Date(`${booking.date}T${booking.endTime}`) && (
                    <>
                      <button
                        onClick={() => {
                          handleStatusChange(booking._id, "approved", booking);
                        }}
                        className="action-btn approve-btn"
                        disabled={
                          booking.status === "approved" ||
                          booking.status === "ongoing" ||
                          loadingActionId === booking._id
                        }
                      >
                        {loadingActionId === booking._id ? (
                          <span className="spinner-approve"></span>
                        ) : (
                          "✅"
                        )}{" "}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(booking._id, "declined", booking);
                        }}
                        className="action-btn decline-btn"
                        disabled={
                          booking.status === "declined" ||
                          booking.status === "ongoing" ||
                          loadingActionId === booking._id
                        }
                      >
                        {loadingActionId === booking._id ? (
                          <span className="spinner-approve"></span>
                        ) : (
                          "❌"
                        )}{" "}
                        Decline
                      </button>

                      <button
                        onClick={() => handleEdit(booking)}
                        className="action-btn edit-btn"
                        disabled={
                          booking.status === "completed" ||
                          booking.status === "closed" ||
                          booking.status === "ongoing"
                        }
                      >
                        ✏️ Edit
                      </button>
                      {booking.status === "ongoing" && (
                        <button
                          onClick={() => handleClose(booking._id)}
                          className="action-btn complete-btn"
                        >
                          ✅ Complete
                        </button>
                      )}
                    </>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {showDetailsModal && selectedDetailsBooking && (
        <div
          className="details-modal-overlay"
          onClick={handleCloseDetailsModal}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="details-modal-header">
              <h3>
                <span className="modal-header-icon">📋</span>
                Complete Meeting Details
              </h3>
              <button
                className="details-modal-close"
                onClick={handleCloseDetailsModal}
              >
                ✕
              </button>
            </div>

            <div className="details-modal-body">
              <div className="details-section">
                <h4 className="details-section-title">
                  <span>👤</span> Employee Information
                </h4>
                <div className="details-grid">
                  <div className="details-item">
                    <label>Full Name</label>
                    <p>{selectedDetailsBooking.empName}</p>
                  </div>
                  <div className="details-item">
                    <label>Employee ID</label>
                    <p>{selectedDetailsBooking.employeeId}</p>
                  </div>
                  <div className="details-item">
                    <label>Email Address</label>
                    <p>{selectedDetailsBooking.email}</p>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h4 className="details-section-title">
                  <span>📅</span> Meeting Information
                </h4>
                <div className="details-grid">
                  <div className="details-item">
                    <label>Room</label>
                    <p>{selectedDetailsBooking.room}</p>
                  </div>
                  <div className="details-item">
                    <label>Date</label>
                    <p>{selectedDetailsBooking.date}</p>
                  </div>
                  <div className="details-item">
                    <label>Status</label>
                    <p>
                      <span
                        className="status-badge-modal"
                        style={{
                          backgroundColor: getStatusColor(
                            selectedDetailsBooking.status,
                          ),
                        }}
                      >
                        {selectedDetailsBooking.status}
                      </span>
                    </p>
                  </div>
                  <div className="details-item">
                    <label>Start Time</label>
                    <p>{formatTime24(selectedDetailsBooking.startTime)}</p>
                  </div>
                  <div className="details-item">
                    <label>End Time</label>
                    <p>{formatTime24(selectedDetailsBooking.endTime)}</p>
                  </div>
                  <div className="details-item">
                    <label>Duration</label>
                    <p>
                      {(() => {
                        const start = new Date(
                          `2000-01-01T${selectedDetailsBooking.startTime}`,
                        );
                        const end = new Date(
                          `2000-01-01T${selectedDetailsBooking.endTime}`,
                        );
                        const diffHours = (end - start) / (1000 * 60 * 60);
                        return `${diffHours} hour(s)`;
                      })()}
                    </p>
                  </div>
                  
                  <div className="details-item">
                    <label>Created At</label>
                    <p>
                      {new Date(
                        selectedDetailsBooking.createdAt,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {selectedDetailsBooking.cc &&
                selectedDetailsBooking.cc.length > 0 && (
                  <div className="details-section">
                    <h4 className="details-section-title">
                      <span>👥</span> CC Recipients
                    </h4>
                    <div className="cc-list-modal">
                      {Array.isArray(selectedDetailsBooking.cc)
                        ? selectedDetailsBooking.cc.map((email, idx) => (
                            <span key={idx} className="cc-tag-modal">
                              {email}
                            </span>
                          ))
                        : typeof selectedDetailsBooking.cc === "string" &&
                          selectedDetailsBooking.cc
                            .split(",")
                            .map((email, idx) => (
                              <span key={idx} className="cc-tag-modal">
                                {email.trim()}
                              </span>
                            ))}
                    </div>
                  </div>
                )}

              <div className="details-section">
                <h4 className="details-section-title">
                  <span>📝</span> Meeting Agenda
                </h4>
                <div className="agenda-content">
                  {selectedDetailsBooking.ma ||
                    "No agenda provided for this meeting"}
                </div>
              </div>

              {selectedDetailsBooking.remark && (
                <div className="details-section">
                  <h4 className="details-section-title">
                    <span>💬</span> Admin Remarks
                  </h4>
                  <div className="remarks-content">
                    {selectedDetailsBooking.remark}
                  </div>
                </div>
              )}

              {selectedDetailsBooking.meetingLink && (
                <div className="details-section">
                  <h4 className="details-section-title">
                    <span>🔗</span> Meeting Link
                  </h4>
                  <div className="meeting-link-content">
                    <a
                      href={selectedDetailsBooking.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click here to join the meeting
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="details-modal-footer">
             
              <button
                className="modal-footer-btn close-btn"
                onClick={handleCloseDetailsModal}
              >
                Close
              </button>

              
            </div>
          </div>
        </div>
      )}
    </>
  );

const ListView = () => {
  const [expandedRow, setExpandedRow] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const handleRowClick = (bookingId) => {
    setExpandedRow(expandedRow === bookingId ? null : bookingId);
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedBooking(null);
  };

  const isUrgent = useCallback((booking) => {
    const meetingTime = new Date(`${booking.date}T${booking.startTime}`);
    const now = new Date();
    const hoursUntilMeeting = (meetingTime - now) / (1000 * 60 * 60);
    return (
      hoursUntilMeeting > 0 &&
      hoursUntilMeeting < 24 &&
      booking.status === "pending"
    );
  }, []);

  const isToday = useCallback((booking) => {
    return (
      booking.date === new Date().toISOString().split("T")[0] &&
      booking.status === "pending"
    );
  }, []);



  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return "✅";
      case "pending":
        return "⏳";
      case "declined":
        return "❌";
      case "completed":
        return "✔️";
      case "ongoing":
        return "🔄";
      default:
        return "📋";
    }
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffHours = (end - start) / (1000 * 60 * 60);
    return `${diffHours} hour(s)`;
  };

  return (
    <>
      <div className="list-view-container">
        {/* Table Header */}
        <div className="list-header">
          <div className="list-header-cell">
            <span>👤</span> Employee
          </div>
          <div className="list-header-cell">
            <span>🏢</span> Room
          </div>
          <div className="list-header-cell">
            <span>📅</span> Date & Time
          </div>
          <div className="list-header-cell">
            <span>📊</span> Status
          </div>
          <div className="list-header-cell">
            <span>⚡</span> Actions
          </div>
        </div>

        {/* Table Body */}
        {sortedBookings.map((booking) => (
          <div
            key={booking._id}
            className={`list-item-wrapper ${expandedRow === booking._id ? "expanded" : ""}`}
          >
            <div
              className={`list-item ${isUrgent(booking) ? "urgent-row" : ""} ${isToday(booking) ? "today-row" : ""}`}
              onClick={() => handleRowClick(booking._id)}
            >
              {/* Employee Info */}
              <div className="list-cell">
                <div
                  className="list-avatar"
                  style={{
                    background: isUrgent(booking)
                      ? "#dc3545"
                      : isToday(booking)
                      ? "#ff9800"
                      : "linear-gradient(135deg, #165283, #0e3d61)",
                  }}
                >
                  {booking.empName?.charAt(0).toUpperCase()}
                </div>
                <div className="employee-details">
                  <div className="list-name">{booking.empName}</div>
                  {booking.employeeId && (
                    <div className="list-employee-id">
                      ID: {booking.employeeId}
                    </div>
                  )}
                </div>
              </div>

              {/* Room Info */}
              <div className="list-cell">
                <div className="list-room">
                  <span className="room-icon">🏢</span>
                  {booking.room}
                </div>
                {booking.meetingLink && (
                  <a
                    href={booking.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="meeting-link-icon"
                    title="Join Meeting"
                  >
                    🔗
                  </a>
                )}
              </div>

              {/* Date & Time */}
              <div className="list-cell">
                <div className="datetime-info">
                  <div className="list-date">
                    <span className="date-icon">📅</span> {booking.date}
                  </div>
                  <div className="list-time">
                    <span className="time-icon">⏰</span>{" "}
                    {formatTime24(booking.startTime)} -{" "}
                    {formatTime24(booking.endTime)}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="list-cell">
                <div className="status-wrapper">
                  <span
                    className="status-badge-small"
                    style={{
                      backgroundColor: getStatusColor(booking.status),
                    }}
                  >
                    {getStatusIcon(booking.status)} {booking.status}
                  </span>
                  {isUrgent(booking) && (
                    <span className="urgent-badge-list">⚡ Urgent</span>
                  )}
                  {isToday(booking) && !isUrgent(booking) && (
                    <span className="today-badge-list">📅 Today</span>
                  )}
                </div>
              </div>

              {/* Actions - All in one row */}
              <div className="list-cell list-actions">
                <div className="actions-wrapper">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(booking._id, "approved", booking);
                    }}
                    className="list-action-btn approve"
                    disabled={
                      booking.status === "approved" ||
                      booking.status === "ongoing" ||
                      loadingActionId === booking._id
                    }
                    title="Approve Booking"
                  >
                    {loadingActionId === booking._id ? (
                      <span className="spinner-small"></span>
                    ) : (
                      "✅"
                    )}
                   
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(booking._id, "declined", booking);
                    }}
                    className="list-action-btn decline"
                    disabled={
                      booking.status === "declined" ||
                      booking.status === "ongoing" ||
                      loadingActionId === booking._id
                    }
                    title="Decline Booking"
                  >
                    {loadingActionId === booking._id ? (
                      <span className="spinner-small"></span>
                    ) : (
                      "❌"
                    )}
                  
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(booking);
                    }}
                    className="list-action-btn edit"
                    disabled={
                      booking.status === "completed" ||
                      booking.status === "closed"
                    }
                    title="Edit Booking"
                  >
                    ✏️
                   
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(booking);
                    }}
                    className="list-action-btn details"
                    title="View Full Details"
                  >
                    📋
                   
                  </button>
                  
                  {booking.status === "ongoing" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClose(booking._id);
                      }}
                      className="list-action-btn complete"
                      title="Complete Meeting"
                    >
                      ✅
                      <span className="action-label">Complete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Row Content */}
            {expandedRow === booking._id && (
              <div className="list-item-expanded">
                <div className="expanded-content">
                  <div className="expanded-grid">
                    {/* Meeting Agenda Section */}
                    <div className="expanded-section">
                      <h4>
                        <span className="section-icon">📝</span> Meeting Agenda
                      </h4>
                      <div className="expanded-text-box">
                        {booking.ma || "No agenda provided for this meeting"}
                      </div>
                    </div>

                    {/* CC Recipients Section */}
                    {booking.cc && booking.cc.length > 0 && (
                      <div className="expanded-section">
                        <h4>
                          <span className="section-icon">👥</span> CC Recipients
                        </h4>
                        <div className="expanded-cc-list">
                          {Array.isArray(booking.cc)
                            ? booking.cc.map((email, idx) => (
                                <span key={idx} className="expanded-cc-tag">
                                  📧 {email}
                                </span>
                              ))
                            : typeof booking.cc === "string" &&
                              booking.cc.split(",").map((email, idx) => (
                                <span key={idx} className="expanded-cc-tag">
                                  📧 {email.trim()}
                                </span>
                              ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Remarks Section */}
                    {booking.remark && (
                      <div className="expanded-section">
                        <h4>
                          <span className="section-icon">💬</span> Admin Remarks
                        </h4>
                        <div className="expanded-text-box remarks">
                          {booking.remark}
                        </div>
                      </div>
                    )}

                    {/* Meeting Link Section */}
                    {booking.meetingLink && (
                      <div className="expanded-section">
                        <h4>
                          <span className="section-icon">🔗</span> Meeting Link
                        </h4>
                        <div className="meeting-link-box">
                          <a
                            href={booking.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🔗 Click here to join the meeting
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Actions */}
                  <div className="expanded-actions">
                    <button
                      className="expanded-action-btn copy-btn"
                      onClick={() => {
                        const ccList =
                          booking.cc && booking.cc.length > 0
                            ? Array.isArray(booking.cc)
                              ? booking.cc.join(", ")
                              : booking.cc
                            : "No CC recipients";

                        const details = `
📋 MEETING DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 EMPLOYEE INFORMATION
• Name: ${booking.empName}
• ID: ${booking.employeeId}
• Email: ${booking.email}

📅 MEETING INFORMATION
• Room: ${booking.room}
• Date: ${booking.date}
• Time: ${formatTime24(booking.startTime)} - ${formatTime24(booking.endTime)}
• Duration: ${formatDuration(booking.startTime, booking.endTime)}
• Type: ${booking.meetingType || "Not specified"}
• Status: ${booking.status}

👥 CC RECIPIENTS
• ${ccList}

📝 AGENDA
${booking.ma || "No agenda provided"}

${booking.remark ? `💬 REMARKS\n${booking.remark}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        `;
                        navigator.clipboard.writeText(details);
                        setSuccessMessage("✅ Meeting details copied to clipboard!");
                        setTimeout(() => setSuccessMessage(""), 2000);
                      }}
                    >
                      📋 Copy All Details
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="details-modal-overlay" onClick={handleCloseModal}>
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="details-modal-header">
              <h3>
                <span className="modal-header-icon">📋</span>
                Complete Meeting Details
              </h3>
              <button className="details-modal-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <div className="details-modal-body">
              {/* Employee Information */}
              <div className="details-section">
                <h4 className="details-section-title">
                  <span>👤</span> Employee Information
                </h4>
                <div className="details-grid">
                  <div className="details-item">
                    <label>Full Name</label>
                    <p>{selectedBooking.empName}</p>
                  </div>
                  <div className="details-item">
                    <label>Employee ID</label>
                    <p>{selectedBooking.employeeId}</p>
                  </div>
                  <div className="details-item">
                    <label>Email Address</label>
                    <p>{selectedBooking.email}</p>
                  </div>
                </div>
              </div>

              {/* Meeting Information */}
              <div className="details-section">
                <h4 className="details-section-title">
                  <span>📅</span> Meeting Information
                </h4>
                <div className="details-grid">
                  <div className="details-item">
                    <label>Room</label>
                    <p>{selectedBooking.room}</p>
                  </div>
                  <div className="details-item">
                    <label>Date</label>
                    <p>{selectedBooking.date}</p>
                  </div>
                  <div className="details-item">
                    <label>Status</label>
                    <p>
                      <span
                        className="status-badge-modal"
                        style={{
                          backgroundColor: getStatusColor(selectedBooking.status),
                        }}
                      >
                        {getStatusIcon(selectedBooking.status)}{" "}
                        {selectedBooking.status}
                      </span>
                    </p>
                  </div>
                  <div className="details-item">
                    <label>Start Time</label>
                    <p>{formatTime24(selectedBooking.startTime)}</p>
                  </div>
                  <div className="details-item">
                    <label>End Time</label>
                    <p>{formatTime24(selectedBooking.endTime)}</p>
                  </div>
                  <div className="details-item">
                    <label>Duration</label>
                    <p>
                      {formatDuration(
                        selectedBooking.startTime,
                        selectedBooking.endTime,
                      )}
                    </p>
                  </div>
                  <div className="details-item">
                    <label>Created At</label>
                    <p>
                      {new Date(selectedBooking.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* CC Recipients */}
              {selectedBooking.cc && selectedBooking.cc.length > 0 && (
                <div className="details-section">
                  <h4 className="details-section-title">
                    <span>👥</span> CC Email Participants
                  </h4>
                  <div className="cc-list-modal">
                    {Array.isArray(selectedBooking.cc)
                      ? selectedBooking.cc.map((email, idx) => (
                          <span key={idx} className="cc-tag-modal">
                            📧 {email}
                          </span>
                        ))
                      : typeof selectedBooking.cc === "string" &&
                        selectedBooking.cc.split(",").map((email, idx) => (
                          <span key={idx} className="cc-tag-modal">
                            📧 {email.trim()}
                          </span>
                        ))}
                  </div>
                </div>
              )}

              {/* Meeting Agenda */}
              <div className="details-section">
                <h4 className="details-section-title">
                  <span>📝</span> Meeting Agenda
                </h4>
                <div className="agenda-content">
                  {selectedBooking.ma || "No agenda provided for this meeting"}
                </div>
              </div>

              {/* Admin Remarks */}
              {selectedBooking.remark && (
                <div className="details-section">
                  <h4 className="details-section-title">
                    <span>💬</span> Admin Remarks
                  </h4>
                  <div className="remarks-content">
                    {selectedBooking.remark}
                  </div>
                </div>
              )}

              {/* Meeting Link */}
              {selectedBooking.meetingLink && (
                <div className="details-section">
                  <h4 className="details-section-title">
                    <span>🔗</span> Meeting Link
                  </h4>
                  <div className="meeting-link-content">
                    <a
                      href={selectedBooking.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🔗 Click here to join the meeting
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="details-modal-footer">
              <button
                className="modal-footer-btn copy-btn"
                onClick={() => {
                  const ccList =
                    selectedBooking.cc && selectedBooking.cc.length > 0
                      ? Array.isArray(selectedBooking.cc)
                        ? selectedBooking.cc.join(", ")
                        : selectedBooking.cc
                      : "No CC recipients";

                  const details = `
📋 MEETING DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 EMPLOYEE INFORMATION
• Name: ${selectedBooking.empName}
• ID: ${selectedBooking.employeeId}
• Email: ${selectedBooking.email}

📅 MEETING INFORMATION
• Room: ${selectedBooking.room}
• Date: ${selectedBooking.date}
• Time: ${formatTime24(selectedBooking.startTime)} - ${formatTime24(selectedBooking.endTime)}
• Duration: ${formatDuration(selectedBooking.startTime, selectedBooking.endTime)}
• Type: ${selectedBooking.meetingType || "Not specified"}
• Status: ${selectedBooking.status}
• Created: ${new Date(selectedBooking.createdAt).toLocaleString()}

👥 CC RECIPIENTS
• ${ccList}

📝 AGENDA
${selectedBooking.ma || "No agenda provided"}

${selectedBooking.remark ? `💬 REMARKS\n${selectedBooking.remark}` : ""}
${selectedBooking.meetingLink ? `\n🔗 MEETING LINK\n${selectedBooking.meetingLink}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  `;
                  navigator.clipboard.writeText(details);
                  setSuccessMessage("✅ Meeting details copied to clipboard!");
                  setTimeout(() => setSuccessMessage(""), 2000);
                }}
              >
                📋 Copy All Details
              </button>
              <button
                className="modal-footer-btn close-btn"
                onClick={handleCloseModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

  const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [modalProcessing, setModalProcessing] = useState(false);

    const getDaysInMonth = (date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const days = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysArray = Array.from({ length: days }, (_, i) => i + 1);

    const handleEventClick = (booking) => {
      setSelectedBooking(booking);
      setShowBookingModal(true);
    };

    const closeModal = () => {
      if (!modalProcessing) {
        setShowBookingModal(false);
        setSelectedBooking(null);
      }
    };

    const handleModalApprove = async () => {
      if (selectedBooking && !modalProcessing) {
        setModalProcessing(true);
        try {
          await handleStatusChange(
            selectedBooking._id,
            "approved",
            selectedBooking,
          );
          closeModal();
        } finally {
          setModalProcessing(false);
        }
      }
    };

    const handleModalDecline = () => {
      if (selectedBooking && !modalProcessing) {
        setModalProcessing(true);
        setActionType("statusChange");
        setBookingToConfirm({ id: selectedBooking._id, status: "declined" });
        setShowConfirmation(true);
        closeModal();
        setModalProcessing(false);
      }
    };

    const handleModalEdit = () => {
      if (selectedBooking && !modalProcessing) {
        handleEdit(selectedBooking);
        closeModal();
      }
    };

    return (
      <>
        <div className="calendar-view">
          <div className="calendar-header">
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() - 1,
                  ),
                )
              }
            >
              ◀
            </button>
            <h3>
              {currentDate.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1,
                  ),
                )
              }
            >
              ▶
            </button>
          </div>
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day empty"></div>
            ))}
            {daysArray.map((day) => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayBookings = sortedBookings.filter(
                (b) => b.date === dateStr,
              );
              return (
                <div key={day} className="calendar-day">
                  <div className="calendar-day-number">{day}</div>
                  {dayBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking._id}
                      className="calendar-event"
                      style={{
                        borderLeftColor: getStatusColor(booking.status),
                      }}
                      onClick={() => handleEventClick(booking)}
                    >
                      <div className="calendar-event-time">
                        {formatTime24(booking.startTime)}-
                        {formatTime24(booking.endTime)}
                      </div>
                      <div className="calendar-event-title">
                        {booking.empName}
                      </div>
                      <div className="calendar-event-room">{booking.room}</div>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="calendar-more">
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showBookingModal && selectedBooking && (
          <div className="booking-modal-overlay" onClick={closeModal}>
            <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
              <div className="booking-modal-header">
                <h3>Meeting Details</h3>
                <button
                  className="details-modal-close"
                  onClick={closeModal}
                  disabled={modalProcessing}
                >
                  ✕
                </button>
              </div>
              <div className="booking-modal-body">
                <div className="modal-info-row">
                  <span className="modal-label">Employee:</span>
                  <span className="modal-value">{selectedBooking.empName}</span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">ID:</span>
                  <span className="modal-value">
                    {selectedBooking.employeeId}
                  </span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">Email:</span>
                  <span className="modal-value">{selectedBooking.email}</span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">Room:</span>
                  <span className="modal-value">{selectedBooking.room}</span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">Date:</span>
                  <span className="modal-value">{selectedBooking.date}</span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">Time:</span>
                  <span className="modal-value">
                    {formatTime24(selectedBooking.startTime)} -{" "}
                    {formatTime24(selectedBooking.endTime)}
                  </span>
                </div>
                <div className="modal-info-row">
                  <span className="modal-label">Status:</span>
                  <span
                    className="modal-status-badge"
                    style={{
                      backgroundColor: getStatusColor(selectedBooking.status),
                    }}
                  >
                    {selectedBooking.status}
                  </span>
                </div>
                {selectedBooking.ma && (
                  <div className="modal-info-row full-width">
                    <span className="modal-label">Agenda:</span>
                    <span className="modal-value">{selectedBooking.ma}</span>
                  </div>
                )}
                {selectedBooking.cc && selectedBooking.cc.length > 0 && (
                  <div className="modal-info-row full-width">
                    <span className="modal-label">CC:</span>
                    <div className="modal-cc-list">
                      {Array.isArray(selectedBooking.cc)
                        ? selectedBooking.cc.map((email, idx) => (
                            <span key={idx} className="modal-cc-tag">
                              {email}
                            </span>
                          ))
                        : typeof selectedBooking.cc === "string" &&
                          selectedBooking.cc.split(",").map((email, idx) => (
                            <span key={idx} className="modal-cc-tag">
                              {email.trim()}
                            </span>
                          ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="booking-modal-footer">
                {selectedBooking.status !== "closed" &&
                  selectedBooking.status !== "completed" &&
                  new Date() <
                    new Date(
                      `${selectedBooking.date}T${selectedBooking.endTime}`,
                    ) && (
                    <>
                      <button
                        onClick={handleModalApprove}
                        className="modal-action-btn approve-btn"
                        disabled={
                          selectedBooking.status === "approved" ||
                          selectedBooking.status === "ongoing" ||
                          modalProcessing
                        }
                      >
                        {modalProcessing ? (
                          <span className="spinner-small"></span>
                        ) : (
                          "✅"
                        )}{" "}
                        Approve
                      </button>
                      <button
                        onClick={handleModalDecline}
                        className="modal-action-btn decline-btn"
                        disabled={
                          selectedBooking.status === "declined" ||
                          selectedBooking.status === "ongoing" ||
                          modalProcessing
                        }
                      >
                        ❌ Decline
                      </button>
                      <button
                        onClick={handleModalEdit}
                        className="modal-action-btn edit-btn"
                        disabled={
                          selectedBooking.status === "completed" ||
                          selectedBooking.status === "closed" ||
                          modalProcessing
                        }
                      >
                        ✏️ Edit
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="main-content">
      <div
        style={{
          marginBottom: 20,
          padding: 10,
          backgroundColor: accounts.length > 0 ? "#e8f5e8" : "#ffe8e8",
          borderRadius: 5,
        }}
      >
        <strong>Microsoft Status:</strong>{" "}
        {accounts.length > 0
          ? `✅ Signed in as ${accounts[0].name}`
          : "❌ Not signed in with Microsoft"}
      </div>
      {accounts.length === 0 ? (
        <div style={{ marginBottom: 20 }}>
          <p>You need to sign in with Microsoft to approve meetings.</p>
          <button
            onClick={handleLogin}
            style={{
              padding: "10px 20px",
              backgroundColor: "#0078d4",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Sign in with Microsoft
          </button>
        </div>
      ) : (
        <div></div>
      )}

      <div className="view-toggle-container">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === "cards" ? "active" : ""}`}
            onClick={() => setViewMode("cards")}
          >
            🃏 Card View
          </button>
          <button
            className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            📋 List View
          </button>
          <button
            className={`toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
            onClick={() => setViewMode("calendar")}
          >
            📅 Calendar View
          </button>
        </div>
        <button onClick={resetFilters} className="reset-filters-btn">
          🔄 Reset Filters
        </button>
      </div>

      <div className="filter-container">
        <label>
          <b>Room:</b>
          <select name="room" value={filter.room} onChange={handleFilterChange}>
            <option value="">Select Room</option>
            <option value="Admin Conference Room">Admin Conference Room</option>
            <option value="QA Conference Room">QA Conference Room</option>
            <option value="QA Training Room">QA Training Room</option>
            <option value="Meeting Room 1">Meeting Room 1</option>
            <option value="Meeting Room 2">Meeting Room 2</option>
          </select>
        </label>
        <label>
          <b>Date:</b>
          <input
            type="date"
            name="date"
            value={filter.date}
            onChange={handleFilterChange}
          />
        </label>
        <label>
          <b>Status:</b>
          <select
            name="status"
            value={filter.status}
            onChange={handleFilterChange}
          >
            <option value="">Select Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </label>
        <label>
          <b>Sort </b>
          <button
            type="button"
            className={`sort-btn ${sortOrder}`}
            onClick={() => handleSort(sortField)}
            title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
          >
            {sortOrder === "asc" ? "⬆️" : "⬇️"}
          </button>
        </label>
      </div>

      <div className="approval-page">
        {loading ? (
          viewMode === "cards" ? (
            <div className="cards-container">
              {Array(6)
                .fill()
                .map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
            </div>
          ) : viewMode === "list" ? (
            <div className="list-view-container">
              {Array(5)
                .fill()
                .map((_, i) => (
                  <SkeletonList key={i} />
                ))}
            </div>
          ) : (
            <div className="calendar-view-skeleton">
              <div className="skeleton-calendar-header"></div>
              <div className="skeleton-calendar-grid"></div>
            </div>
          )
        ) : sortedBookings.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {viewMode === "cards" && <CardView />}
            {viewMode === "list" && <ListView />}
            {viewMode === "calendar" && <CalendarView />}
          </>
        )}

        {editMode && (
          <div className="edit-form" onClick={handleCloseEditForm}>
            <div className="overlay" />
            <div
              className="edit-form-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Edit Booking</h2>
              <div className="edit-form-row">
                <label>
                  Room:
                  <select
                    name="room"
                    value={updatedData.room}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Room</option>
                    <option value="Admin Conference Room">
                      Admin Conference Room
                    </option>
                    <option value="QA Conference Room">
                      QA Conference Room
                    </option>
                    <option value="QA Training Room">QA Training Room</option>
                    <option value="Meeting Room 1">Meeting Room 1</option>
                    <option value="Meeting Room 2">Meeting Room 2</option>
                  </select>
                </label>
                <label>
                  Date:
                  <input
                    type="date"
                    name="date"
                    value={updatedData.date}
                    onChange={handleInputChange}
                    required
                  />
                </label>
              </div>
              <div className="edit-form-row">
                <label>
                  Start Time:
                  <input
                    type="time"
                    name="startTime"
                    value={updatedData.startTime}
                    onChange={handleInputChange}
                    required
                  />
                </label>
                <label>
                  End Time:
                  <input
                    type="time"
                    name="endTime"
                    value={updatedData.endTime}
                    onChange={handleInputChange}
                    required
                  />
                </label>
              </div>
              <label>
                Remark:
                <textarea
                  value={remark}
                  onChange={handleRemarkChange}
                  placeholder="Add a remark..."
                  style={{ minHeight: 36, maxHeight: 60 }}
                />
              </label>
              <div className="edit-form-buttons">
                <button
                  onClick={handleCloseEditForm}
                  className="cancel-btn"
                  disabled={loadingUpdate}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="update-btn"
                  disabled={loadingUpdate}
                >
                  {loadingUpdate ? (
                    <span className="spinner-approve"></span>
                  ) : (
                    "Update & Approve"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmation && (
          <div className="confirmation-modal fade-in-slide">
            <div className="modal-content glass-modal">
              <div className="modal-icon-title">
                <span className="modal-icon">⚠️</span>
                <h2>Are you sure?</h2>
              </div>
              <p>Once you confirm, the status will be updated.</p>
              <div className="remark-field-group">
                <textarea
                  placeholder=" "
                  value={remark}
                  onChange={handleRemarkChange}
                  className="remark-textarea"
                  required
                  id="remark-textarea"
                />
                <label htmlFor="remark-textarea" className="remark-label">
                  Add a remark...
                </label>
              </div>
              <div className="modal-btn-group">
                <button
                  onClick={handleCancelConfirmation}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button onClick={handleGeneralConfirm} className="confirm-btn">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {processing && (
          <div className="fullscreen-overlay">
            <div className="loader-content">
              <div className="spinner"></div>
              <p>Processing your request...</p>
            </div>
          </div>
        )}

        {approvalConfirmation.show && (
          <div className="confirmation-modal fade-in-slide">
            <div className="modal-content glass-modal">
              <div className="modal-icon-title">
                <span className="modal-icon">✅</span>
                <h2>Confirm Approval</h2>
              </div>
              <p>Do you want to approve this meeting?</p>
              <div className="meeting-details-preview">
                <p>
                  <strong>Room:</strong> {approvalConfirmation.booking?.room}
                </p>
                <p>
                  <strong>Date:</strong> {approvalConfirmation.booking?.date}
                </p>
                <p>
                  <strong>Time:</strong>{" "}
                  {formatTime24(approvalConfirmation.booking?.startTime)} -{" "}
                  {formatTime24(approvalConfirmation.booking?.endTime)}
                </p>
              </div>
              <div className="modal-btn-group">
                <button
                  onClick={handleCancelConfirmation}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button onClick={handleApprovalConfirm} className="confirm-btn">
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Snackbar
        open={!!successMessage || !!errorMessage}
        autoHideDuration={4000}
        onClose={() => {
          setSuccessMessage("");
          setErrorMessage("");
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => {
            setSuccessMessage("");
            setErrorMessage("");
          }}
          severity={successMessage ? "success" : "error"}
          variant="filled"
          sx={{
            background: successMessage
              ? "linear-gradient(135deg, #00b09b, #96c93d)"
              : "linear-gradient(135deg, #ff416c, #ff4b2b)",
            color: "#fff",
            fontWeight: 500,
            fontSize: "1rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            borderRadius: "12px",
            backdropFilter: "blur(10px)",
            textAlign: "center",
            width: "100%",
            maxWidth: "420px",
            padding: "14px 18px",
          }}
        >
          {successMessage || errorMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Approval;
