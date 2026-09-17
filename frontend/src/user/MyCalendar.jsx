import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import "./MyCalendar.css";

const MyCalendar = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    room: "",
    date: "",
    title: "",
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("timeGridWeek");

  // Reference to FullCalendar component
  const calendarRef = useRef(null);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const response = await axios.get("https://01-30225:1010/api/booking");

        // Filter bookings by status ("approved" and "ongoing")
        const filteredBookings = response.data.filter(
          (booking) =>
            booking.status === "approved" || booking.status === "ongoing",
        );

        setBookings(filteredBookings);
      } catch (err) {
        console.error("Error fetching bookings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 300000); // Fetch every 5 minutes

    return () => clearInterval(interval);
  }, []);


  // Filter bookings based on room, date, and title
  const filteredBookings = bookings.filter((booking) => {
    const matchesRoom = filter.room ? booking.room === filter.room : true;
    const matchesDate = filter.date ? booking.date === filter.date : true;
    const matchesTitle = booking.empName
      .toLowerCase()
      .includes(filter.title.toLowerCase());
    return matchesRoom && matchesDate && matchesTitle;
  });

  // Convert bookings to FullCalendar event format
  const formattedBookings = filteredBookings.map((booking) => ({
    id: booking._id,
    title: `${booking.empName} - ${booking.room}`,
    start: `${booking.date}T${booking.startTime}`,
    end: `${booking.date}T${booking.endTime}`,
    extendedProps: {
      description: booking.ma || "No agenda provided",
      room: booking.room,
      status: booking.status,
      employeeName: booking.empName,
      employeeId: booking.employeeId,
      email: booking.email,
      cc: booking.cc,
      startTime: booking.startTime,
      endTime: booking.endTime,
      date: booking.date,
    },
    className: `calendar-event-${booking.status}`,
    backgroundColor: booking.status === "approved" ? "#28a745" : "#007bff",
    borderColor: booking.status === "approved" ? "#28a745" : "#007bff",
    textColor: "#ffffff",
  }));

  const handleEventClick = (info) => {
    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      room: info.event.extendedProps.room,
      description: info.event.extendedProps.description,
      startTime: new Date(info.event.start).toLocaleString(),
      endTime: new Date(info.event.end).toLocaleString(),
      status: info.event.extendedProps.status,
      employeeName: info.event.extendedProps.employeeName,
      employeeId: info.event.extendedProps.employeeId,
      email: info.event.extendedProps.email,
      cc: info.event.extendedProps.cc,
      date: info.event.extendedProps.date,
      startTimeOnly: info.event.extendedProps.startTime,
      endTimeOnly: info.event.extendedProps.endTime,
    });
    setShowEventDetails(true);
  };

  const handleCloseEventDetails = () => {
    setShowEventDetails(false);
  };

  const makePopupDraggable = (e) => {
    const popup = document.getElementById("event-details-popup");
    if (!popup) return;
    let offsetX = e.clientX - popup.getBoundingClientRect().left;
    let offsetY = e.clientY - popup.getBoundingClientRect().top;

    const handleMouseMove = (moveEvent) => {
      popup.style.left = `${moveEvent.clientX - offsetX}px`;
      popup.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Calendar view control methods
  const changeView = (view) => {
    setCurrentView(view);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(view);
      // Update current date after view change
      const date = calendarApi.getDate();
      setCurrentDate(date);
    }
  };

  const goToToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      const date = calendarApi.getDate();
      setCurrentDate(date);
    }
  };

  const goToPrev = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
      const date = calendarApi.getDate();
      setCurrentDate(date);
    }
  };

  const goToNext = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
      const date = calendarApi.getDate();
      setCurrentDate(date);
    }
  };

  // Handle date change from calendar
  const handleDatesSet = (dateInfo) => {
    setCurrentDate(dateInfo.view.currentStart);
  };

  // Format the current date range display
  const getDateRangeDisplay = () => {
    if (!calendarRef.current) return "";

    const calendarApi = calendarRef.current.getApi();
    const view = calendarApi.view;
    const currentViewType = view.type;

    if (currentViewType === "dayGridMonth") {
      return currentDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    } else if (currentViewType === "timeGridWeek") {
      const start = view.currentStart;
      const end = view.currentEnd;
      const endDate = new Date(end);
      endDate.setDate(endDate.getDate() - 1);

      if (start.getMonth() === endDate.getMonth()) {
        return `${start.toLocaleString("default", { month: "long" })} ${start.getDate()} - ${endDate.getDate()}, ${start.getFullYear()}`;
      } else {
        return `${start.toLocaleString("default", { month: "short" })} ${start.getDate()} - ${endDate.toLocaleString("default", { month: "short" })} ${endDate.getDate()}, ${start.getFullYear()}`;
      }
    } else if (currentViewType === "timeGridDay") {
      return currentDate.toLocaleString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    return "";
  };

  const getStatusBadgeClass = (status) => {
    return status === "approved" ? "status-approved" : "status-ongoing";
  };

  // Skeleton Loader
  const SkeletonLoader = () => (
    <div className="calendar-skeleton">
      <div className="skeleton-stats">
        <div className="skeleton-stat-card"></div>
        <div className="skeleton-stat-card"></div>
        <div className="skeleton-stat-card"></div>
        <div className="skeleton-stat-card"></div>
      </div>
      <div className="skeleton-filters">
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
      </div>
      <div className="skeleton-calendar"></div>
    </div>
  );

  return (
    <div className="calendar-page">
      {/* Hero Section */}
      <div className="calendar-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-icon">📅</span>
            Meeting Calendar
          </h1>
          <p className="hero-subtitle">
            View all approved and ongoing meetings in calendar
            view
          </p>
        </div>
      </div>

      {/* Filters Section 
      <div className="calendar-filters-container">
        <div className="filters-header">
          <h3 className="filters-title">
            <span>🔍</span> Filter Meetings
          </h3>
          <button onClick={resetFilters} className="reset-filters-btn-calendar">
            🔄 Reset Filters
          </button>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">
              <span>🏢</span> Room
            </label>
            <select
              name="room"
              value={filter.room}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Rooms</option>
              <option value="Admin Conference Room">
                Admin Conference Room
              </option>
              <option value="QA Conference Room">QA Conference Room</option>
              <option value="QA Training Room">QA Training Room</option>
              <option value="Meeting Room 1">Meeting Room 1</option>
              <option value="Meeting Room 2">Meeting Room 2</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">
              <span>📅</span> Date
            </label>
            <input
              type="date"
              name="date"
              value={filter.date}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">
              <span>👤</span> Employee Name
            </label>
            <input
              type="text"
              name="title"
              placeholder="Search by employee name..."
              value={filter.title}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
        </div>
      </div>
*/}


      {/* Custom Calendar Controls */}
      <div className="calendar-controls-wrapper">
        <div className="calendar-nav-buttons">
          <button onClick={goToPrev} className="nav-btn" title="Previous">
            ◀ Prev
          </button>
          <button
            onClick={goToToday}
            className="nav-btn today-btn"
            title="Today"
          >
            📅 Today
          </button>
          <button onClick={goToNext} className="nav-btn" title="Next">
            Next ▶
          </button>
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color approved"></div>
            <span>Approved Meetings</span>
          </div>
          <div className="legend-item">
            <div className="legend-color ongoing"></div>
            <span>Ongoing Meetings</span>
          </div>
        </div>

        <div className="view-buttons">
          <button
            className={`view-btn ${currentView === "timeGridWeek" ? "active" : ""}`}
            onClick={() => changeView("timeGridWeek")}
          >
            📅 Week
          </button>
          <button
            className={`view-btn ${currentView === "timeGridDay" ? "active" : ""}`}
            onClick={() => changeView("timeGridDay")}
          >
            📆 Day
          </button>
          <button
            className={`view-btn ${currentView === "dayGridMonth" ? "active" : ""}`}
            onClick={() => changeView("dayGridMonth")}
          >
            📊 Month
          </button>
        </div>
      </div>

        <div className="current-date-display">
        <div className="date-range-card">
          <span className="date-icon">📅</span>
          <span className="date-range-text">{getDateRangeDisplay()}</span>
        </div>
      </div>

      {/* Calendar Container */}
      {loading ? (
        <SkeletonLoader />
      ) : (
        <div className="calendar-container-enhanced">
    
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
            initialView="timeGridWeek"
            events={formattedBookings}
            headerToolbar={false}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            nowIndicator={true}
            weekends={true}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "09:00",
              endTime: "18:00",
            }}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false, // This sets 24-hour format
            }}
            views={{
              timeGridWeek: {
                titleFormat: { year: "numeric", month: "long", day: "numeric" },
              },
              timeGridDay: {
                titleFormat: { year: "numeric", month: "long", day: "numeric" },
              },
              dayGridMonth: {
                titleFormat: { year: "numeric", month: "long" },
              },
            }}
            dayMaxEvents={true}
            eventDisplay="block"
          />
        </div>
      )}

      {/* Event Details Popup */}
      {showEventDetails && selectedEvent && (
        <div
          id="event-details-popup"
          className={`event-details-popup-enhanced ${selectedEvent.status}`}
          onMouseDown={makePopupDraggable}
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="popup-header">
            <div className="popup-header-icon">
              {selectedEvent.status === "approved" ? "✅" : "🔄"}
            </div>
            <h3 className="popup-title">Meeting Details</h3>
            <button onClick={handleCloseEventDetails} className="popup-close">
              ✕
            </button>
          </div>
          <div className="popup-body">
          
            <div className="detail-section">
              <div className="detail-item">
                <span className="detail-icon">🏢</span>
                <div className="detail-content">
                  <label>Room</label>
                  <p>{selectedEvent.room}</p>
                </div>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📅</span>
                <div className="detail-content">
                  <label>Date</label>
                  <p>{selectedEvent.date}</p>
                </div>
              </div>
              <div className="detail-item">
                <span className="detail-icon">⏰</span>
                <div className="detail-content">
                  <label>Time</label>
                  <p>
                    {selectedEvent.startTimeOnly} - {selectedEvent.endTimeOnly}
                  </p>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-item">
                <span className="detail-icon">📊</span>
                <div className="detail-content">
                  <label>Status</label>
                  <span
                    className={`status-badge-calendar ${getStatusBadgeClass(selectedEvent.status)}`}
                  >
                    {selectedEvent.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section full-width">
              <div className="detail-item">
                <span className="detail-icon">📝</span>
                <div className="detail-content">
                  <label>Agenda</label>
                  <p className="agenda-text">{selectedEvent.description}</p>
                </div>
              </div>
            </div>

          
          </div>
        </div>
      )}

      {/* Floating Action Button for Refresh 
      <button
        className="fab-refresh"
        onClick={() => window.location.reload()}
        title="Refresh Calendar"
      >
        🔄
      </button>
      */}
    </div>
  );
};

export default MyCalendar;
