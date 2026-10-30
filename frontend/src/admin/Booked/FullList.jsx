import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "./FullList.css";
import { Button, Chip, IconButton } from "@mui/material";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { 
  FileDownload, 
  PictureAsPdf, 
  Schedule,
  Person,
  Room,
  Email,
  Description,
  CalendarToday,
  TrendingUp,
  TrendingDown
} from "@mui/icons-material";

applyPlugin(jsPDF);

const FullList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    room: "",
    date: "",
    status: "",
  });
  const [searchTerm, ] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          "https://192.168.0.150:5000/api/booking"
        );
        setBookings(response.data);
      } catch (err) {
        console.error("Error fetching bookings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 600000);

    return () => clearInterval(interval);
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort bookings
  const filteredAndSortedBookings = bookings
    .filter((booking) => {
      const matchesRoom = booking.room
        .toLowerCase()
        .includes(filter.room.toLowerCase());
      const matchesDate = filter.date ? booking.date === filter.date : true;
      const matchesStatus = filter.status
        ? booking.status === filter.status
        : true;
      const matchesSearch = searchTerm
        ? booking.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.room.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      
      return matchesRoom && matchesDate && matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === "date") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStatusColor = (status) => {
    const statusColors = {
      pending: "#ffc107",
      approved: "#28a745",
      declined: "#dc3545",
      cancelled: "#6c757d",
      closed: "#343a40",
      completed: "#17a2b8",
      ongoing: "#007bff"
    };
    return statusColors[status] || "#6c757d";
  };

  const formatTime = (time) => {
    return time ? time.substring(0, 5) : "";
  };

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = bookings.map((booking) => ({
      "Employee Name": booking.empName,
      "Employee ID": booking.employeeId,
      Room: booking.room,
      Date: booking.date,
      "Start Time": booking.startTime,
      "End Time": booking.endTime,
      Purpose: booking.ma,
      Status: booking.status,
      Email: booking.email,
      "CC Mail": booking.cc ? booking.cc.join(", ") : "",
      BookedBy: booking.bookedBy,
      ApprovedBy: booking.approvedBy,
      DeclinedBy: booking.declinedBy,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    XLSX.writeFile(wb, "BookingsDetails.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Room Booking Report", 14, 18);

    // Subtitle with filters
    let subtitle = '';
    if (filter.date) subtitle += `Date: ${filter.date}  `;
    if (filter.month) subtitle += `Month: ${filter.month}  `;
    if (filter.room) subtitle += `Room: ${filter.room}  `;
    if (filter.status) subtitle += `Status: ${filter.status}  `;
    if (subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(subtitle.trim(), 14, 26);
    }

    const headers = [
      [
        "Employee Name",
        "Employee ID",
        "Room",
        "Date",
        "Start",
        "End",
        "Purpose",
        "Status",
      ],
    ];

    const data = filteredAndSortedBookings.map((b) => [
      b.empName,
      b.employeeId,
      b.room,
      b.date,
      b.startTime,
      b.endTime,
      b.ma,
      b.status,
    ]);

    doc.autoTable({
      startY: subtitle ? 32 : 26,
      head: headers,
      body: data,
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [40, 167, 69], textColor: 255, fontStyle: 'bold', fontSize: 11 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      columnStyles: {
        0: { cellWidth: 32 }, // Employee Name
        1: { cellWidth: 22 }, // Employee ID
        2: { cellWidth: 32 }, // Room
        3: { cellWidth: 22 }, // Date
        4: { cellWidth: 16 }, // Start
        5: { cellWidth: 16 }, // End
        6: { cellWidth: 38 }, // Purpose
        7: { cellWidth: 20 }, // Status
      },
      didDrawPage: function (data) {
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(150);
        const pageStr = `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`;
        const exportDate = `Exported: ${new Date().toLocaleString()}`;
        doc.text(pageStr, data.settings.margin.left, doc.internal.pageSize.height - 6);
        doc.text(exportDate, data.settings.margin.left + 60, doc.internal.pageSize.height - 6);
      },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    });

    let fileLabel = filter.date || filter.month || 'All';
    doc.save(`RoomBookings-${fileLabel}.pdf`);
  };

  return (
    <div className="full-list-container">
        <div className="filter-container">
        <label>
          <b>Room:</b>
          <select
              name="room"
              placeholder="Filter by Room"
              value={filter.room}
              onChange={handleFilterChange}
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
            type="text"
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
        <IconButton 
              onClick={() => handleSort("date")}
              className={`sort-btn ${sortBy === "date" ? "active" : ""}`}
            >
              {sortBy === "date" && sortOrder === "asc" ? <TrendingUp /> : <TrendingDown />}
            </IconButton>
        </label>
      </div>
      {/* Export Buttons */}
      <div className="export-section">
        <Button
          startIcon={<FileDownload />}
          onClick={exportToExcel}
          className="export-btn excel-btn"
          variant="contained"
        >
          Export Excel
        </Button>
        <Button
          startIcon={<PictureAsPdf />}
          onClick={exportToPDF}
          className="export-btn pdf-btn"
          variant="contained"
        >
          Export PDF
        </Button>
      </div>
      {/* Loading State */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading bookings...</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {filteredAndSortedBookings.map((booking, index) => (
            <div 
              key={booking._id} 
              className="booking-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Card Header */}
              <div className="card-header">
                <div className="employee-info">
                  <Person className="employee-icon" />
                  <div>
                    <h3 className="employee-name">{booking.empName}</h3>
                    <p className="employee-id">ID: {booking.employeeId}</p>
                  </div>
                </div>
                <Chip
                  label={booking.status.toUpperCase()}
                  style={{ backgroundColor: getStatusColor(booking.status), color: "white" }}
                  className="status-chip"
                />
              </div>

              {/* Card Content */}
              <div className="card-content">
                <div className="info-row">
                  <Room className="info-icon" />
                  <span className="info-label">Room:</span>
                  <span className="info-value">{booking.room}</span>
                </div>

                <div className="info-row">
                  <CalendarToday className="info-icon" />
                  <span className="info-label">Date:</span>
                  <span className="info-value">{booking.date}</span>
                </div>

                <div className="info-row">
                  <Schedule className="info-icon" />
                  <span className="info-label">Time:</span>
                  <span className="info-value">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </span>
                </div>

                {booking.email && (
                  <div className="info-row">
                    <Email className="info-icon" />
                    <span className="info-label">Email:</span>
                    <span className="info-value email-value">{booking.email}</span>
                  </div>
                )}

                {booking.ma && (
                  <div className="info-row">
                    <Description className="info-icon" />
                    <span className="info-label">Purpose:</span>
                    <span className="info-value purpose-value">{booking.ma}</span>
                  </div>
                )}

             
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                {booking.approvedBy && (
                  <span className="approval-info">✓ Approved by: {booking.approvedBy}</span>
                )}
                {booking.declinedBy && (
                  <span className="approval-info">✗ Declined by: {booking.declinedBy}</span>
                )}
                {booking.remark && (
                  <span className="remark-info">💬 {booking.remark}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedBookings.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No bookings found</h3>
          <p>Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default FullList;
