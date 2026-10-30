import React, { useState, useEffect,useMemo } from "react";
import axios from "axios";
import moment from "moment";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import "./Reports.css";

const API_BASE = "https://192.168.0.150:5000/api/booking"; // Backend server address

const Reports = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("summary");
  const [dateRange, setDateRange] = useState("30");
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [employeeDateFrom, setEmployeeDateFrom] = useState("");
  const [employeeDateTo, setEmployeeDateTo] = useState("");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_BASE);
      setBookings(response.data || []);
      // Build employee options from bookings (unique)
      const map = {};
      (response.data || []).forEach((b) => {
        if (b.employeeId && !map[b.employeeId]) {
          map[b.employeeId] = b.empName || b.employeeId;
        }
      });
      setEmployeeOptions(
        Object.entries(map).map(([id, name]) => ({ id, name }))
      );
    } catch (err) {
      console.error("Error fetching bookings", err);
    } finally {
      setLoading(false);
    }
  };

  

  // Filter bookings based on client-side filters (for other report types)
  const getFilteredBookings = () => {
    const cutoffDate = moment()
      .subtract(parseInt(dateRange), "days")
      .startOf("day");

    return bookings.filter((booking) => {
      const bookingDate = moment(booking.date, "YYYY-MM-DD");
      const matchesDate = bookingDate.isSameOrAfter(cutoffDate);
      const matchesRoom =
        selectedRooms.length === 0 || selectedRooms.includes(booking.room);
      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(booking.status);

      return matchesDate && matchesRoom && matchesStatus;
    });
  };

  const filteredBookings = useMemo(
    () => getFilteredBookings(),
    [bookings, dateRange, selectedRooms, selectedStatuses]
  );

  // make generateReport async because employee report will fetch from backend
  const generateReport = async () => {
    const reportData = {
      generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
      dateRange: `${dateRange} days`,
      totalBookings: filteredBookings.length,
      filters: {
        rooms: selectedRooms.length > 0 ? selectedRooms : ["All Rooms"],
        statuses:
          selectedStatuses.length > 0 ? selectedStatuses : ["All Statuses"],
      },
    };

    switch (reportType) {
      case "summary":
        return generateSummaryReport(reportData);
      case "detailed":
        return generateDetailedReport(reportData);
      case "user":
        return generateUserReport(reportData);
      case "room":
        return generateRoomReport(reportData);
      case "trends":
        return generateTrendsReport(reportData);
      case "employeeMeetings":
        return await generateEmployeeMeetingReport(reportData);
      default:
        return generateSummaryReport(reportData);
    }
  };

  const generateSummaryReport = (reportData) => {
    const statusCounts = {};
    const roomCounts = {};
    const userCounts = {};

    filteredBookings.forEach((booking) => {
      statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
      roomCounts[booking.room] = (roomCounts[booking.room] || 0) + 1;
      userCounts[booking.empName] = (userCounts[booking.empName] || 0) + 1;
    });

    return {
      ...reportData,
      type: "Summary Report",
      summary: {
        statusBreakdown: statusCounts,
        roomUtilization: roomCounts,
        topUsers: Object.entries(userCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([user, count]) => ({ user, count })),
      },
    };
  };

  const generateDetailedReport = (reportData) => {
    const detailedBookings = filteredBookings.map((booking) => ({
      id: booking._id,
      employeeName: booking.empName,
      employeeId: booking.employeeId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      room: booking.room,
      status: booking.status,
      agenda: booking.ma,
      submittedAt: booking.submittedAt
        ? moment(booking.submittedAt).format("YYYY-MM-DD HH:mm")
        : "N/A",
      approvedAt: booking.approvedAt
        ? moment(booking.approvedAt).format("YYYY-MM-DD HH:mm")
        : "N/A",
      approvedBy: booking.approvedBy || "N/A",
      duration: moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours(),
    }));

    return {
      ...reportData,
      type: "Detailed Bookings Report",
      bookings: detailedBookings,
    };
  };

  const generateUserReport = (reportData) => {
    const userStats = {};

    filteredBookings.forEach((booking) => {
      if (!userStats[booking.empName]) {
        userStats[booking.empName] = {
          totalBookings: 0,
          approvedBookings: 0,
          pendingBookings: 0,
          declinedBookings: 0,
          completedBookings: 0,
          totalHours: 0,
          roomsUsed: new Set(),
        };
      }

      const stats = userStats[booking.empName];
      stats.totalBookings++;
      if (booking.status === "approved") stats.approvedBookings++;
      if (booking.status === "pending") stats.pendingBookings++;
      if (booking.status === "declined") stats.declinedBookings++;
      if (booking.status === "completed") stats.completedBookings++;
      stats.roomsUsed.add(booking.room);

      const duration = moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours();
      stats.totalHours += duration;
    });

    const userReport = Object.entries(userStats).map(([user, stats]) => ({
      user,
      totalBookings: stats.totalBookings,
      approvedBookings: stats.approvedBookings,
      pendingBookings: stats.pendingBookings,
      declinedBookings: stats.declinedBookings,
      completedBookings: stats.completedBookings,
      approvalRate: (
        (stats.approvedBookings / stats.totalBookings) *
        100
      ).toFixed(2),
      totalHours: stats.totalHours.toFixed(2),
      roomsUsed: Array.from(stats.roomsUsed).join(", "),
    }));

    return {
      ...reportData,
      type: "User Analytics Report",
      userStats: userReport,
    };
  };

  const generateRoomReport = (reportData) => {
    const roomStats = {};

    filteredBookings.forEach((booking) => {
      if (!roomStats[booking.room]) {
        roomStats[booking.room] = {
          totalBookings: 0,
          totalHours: 0,
          users: new Set(),
          statuses: {},
          averageDuration: 0,
        };
      }

      const stats = roomStats[booking.room];
      stats.totalBookings++;
      stats.users.add(booking.empName);
      stats.statuses[booking.status] =
        (stats.statuses[booking.status] || 0) + 1;

      const duration = moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours();
      stats.totalHours += duration;
    });

    Object.keys(roomStats).forEach((room) => {
      const stats = roomStats[room];
      stats.averageDuration = (stats.totalHours / stats.totalBookings).toFixed(
        2
      );
      stats.uniqueUsers = stats.users.size;
      stats.users = Array.from(stats.users).join(", ");
    });

    return {
      ...reportData,
      type: "Room Utilization Report",
      roomStats: Object.entries(roomStats).map(([room, stats]) => ({
        room,
        ...stats,
      })),
    };
  };

  const generateTrendsReport = (reportData) => {
    const dailyStats = {};
    const weeklyStats = {};
    const monthlyStats = {};

    filteredBookings.forEach((booking) => {
      const date = moment(booking.date, "YYYY-MM-DD");
      const dayKey = date.format("YYYY-MM-DD");
      const weekKey = date.format("YYYY-[W]WW");
      const monthKey = date.format("YYYY-MM");

      if (!dailyStats[dayKey]) dailyStats[dayKey] = { bookings: 0, hours: 0 };
      dailyStats[dayKey].bookings++;
      dailyStats[dayKey].hours += moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours();

      if (!weeklyStats[weekKey])
        weeklyStats[weekKey] = { bookings: 0, hours: 0 };
      weeklyStats[weekKey].bookings++;
      weeklyStats[weekKey].hours += moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours();

      if (!monthlyStats[monthKey])
        monthlyStats[monthKey] = { bookings: 0, hours: 0 };
      monthlyStats[monthKey].bookings++;
      monthlyStats[monthKey].hours += moment
        .duration(
          moment(booking.endTime, "HH:mm").diff(
            moment(booking.startTime, "HH:mm")
          )
        )
        .asHours();
    });

    return {
      ...reportData,
      type: "Trends Analysis Report",
      trends: {
        daily: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          bookings: stats.bookings,
          hours: Number(stats.hours).toFixed(2),
        })),
        weekly: Object.entries(weeklyStats).map(([week, stats]) => ({
          week,
          bookings: stats.bookings,
          hours: Number(stats.hours).toFixed(2),
        })),
        monthly: Object.entries(monthlyStats).map(([month, stats]) => ({
          month,
          bookings: stats.bookings,
          hours: Number(stats.hours).toFixed(2),
        })),
      },
    };
  };

  // New: fetch employee-specific bookings from backend and structure them
  const generateEmployeeMeetingReport = async (reportData) => {
    if (!selectedEmployeeId) {
      alert(
        "Please select an employee for the Employee Meeting Details report."
      );
      return null;
    }

    try {
      const params = {};
      if (employeeDateFrom) params.startDate = employeeDateFrom;
      if (employeeDateTo) params.endDate = employeeDateTo;

      const resp = await axios.get(
        `${API_BASE}/employee/${encodeURIComponent(selectedEmployeeId)}`,
        { params }
      );
      const employeeBookings = (resp.data || []).map((booking) => ({
        employeeName: booking.empName,
        employeeId: booking.employeeId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        room: booking.room,
        status: booking.status,
        agenda: booking.ma,
        submittedAt: booking.submittedAt
          ? moment(booking.submittedAt).format("YYYY-MM-DD HH:mm")
          : "N/A",
        approvedAt: booking.approvedAt
          ? moment(booking.approvedAt).format("YYYY-MM-DD HH:mm")
          : "N/A",
        approvedBy: booking.approvedBy || "N/A",
        duration: moment
          .duration(
            moment(booking.endTime, "HH:mm").diff(
              moment(booking.startTime, "HH:mm")
            )
          )
          .asHours(),
      }));

      return {
        ...reportData,
        type: `Employee Meeting Details - ${selectedEmployeeId}`,
        employeeName:
          employeeOptions.find((e) => e.id === selectedEmployeeId)?.name ||
          selectedEmployeeId,
        bookings: employeeBookings,
        totalBookings: employeeBookings.length,
      };
    } catch (err) {
      console.error("Error fetching employee meetings", err);
      alert("Failed to fetch employee meetings. See console for details.");
      return null;
    }
  };

  // Handler
  const handleGenerateReport = async () => {
    const report = await generateReport();
    if (report) setGeneratedReport(report);
  };

  // Export helpers (work with employee report as well)
  const exportToExcel = () => {
    if (!generatedReport) return;
    const workbook = XLSX.utils.book_new();
    let worksheet;

    switch (reportType) {
      case "summary":
        worksheet = XLSX.utils.json_to_sheet([
          { "Report Type": generatedReport.type },
          { "Generated At": generatedReport.generatedAt },
          { "Date Range": generatedReport.dateRange },
          { "Total Bookings": generatedReport.totalBookings },
          {},
          { Section: "Status Breakdown" },
          ...Object.entries(generatedReport.summary.statusBreakdown || {}).map(
            ([status, count]) => ({ Status: status, Count: count })
          ),
          {},
          { Section: "Room Utilization" },
          ...Object.entries(generatedReport.summary.roomUtilization || {}).map(
            ([room, count]) => ({ Room: room, Bookings: count })
          ),
        ]);
        break;

      case "detailed":
        worksheet = XLSX.utils.json_to_sheet(generatedReport.bookings || []);
        break;

      case "user":
        worksheet = XLSX.utils.json_to_sheet(generatedReport.userStats || []);
        break;

      case "room":
        worksheet = XLSX.utils.json_to_sheet(generatedReport.roomStats || []);
        break;

      case "trends":
        worksheet = XLSX.utils.json_to_sheet([
          { Section: "Daily Trends" },
          ...(generatedReport.trends?.daily || []).map((item) => ({
            Date: item.date,
            Bookings: item.bookings,
            Hours: item.hours,
          })),
          {},
          { Section: "Weekly Trends" },
          ...(generatedReport.trends?.weekly || []).map((item) => ({
            Week: item.week,
            Bookings: item.bookings,
            Hours: item.hours,
          })),
        ]);
        break;

      case "employeeMeetings":
        worksheet = XLSX.utils.json_to_sheet(
          (generatedReport.bookings || []).map((b) => ({
            Employee: generatedReport.employeeName || b.employeeName,
            EmployeeId: b.employeeId,
            Date: b.date,
            StartTime: b.startTime,
            EndTime: b.endTime,
            Room: b.room,
            Status: b.status,
            Agenda: b.agenda,
            ApprovedBy: b.approvedBy,
            DurationHours: Number(b.duration).toFixed(2),
          }))
        );
        break;

      default:
        worksheet = XLSX.utils.json_to_sheet([]);
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(
      workbook,
      `${(generatedReport.type || "report").replace(/\s+/g, "_")}_${moment().format("YYYY-MM-DD")}.xlsx`
    );
  };

  const exportToPDF = () => {
    if (!generatedReport) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(generatedReport.type, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedReport.generatedAt}`, 14, 28);
    doc.text(`Date Range: ${generatedReport.dateRange}`, 14, 34);

    let y = 42;
    switch (reportType) {
      case "summary":
        doc.autoTable({
          startY: y,
          head: [["Status", "Count"]],
          body: Object.entries(
            generatedReport.summary.statusBreakdown || {}
          ).map(([s, c]) => [s, String(c)]),
          theme: "grid",
        });
        break;

      case "detailed":
        doc.autoTable({
          startY: y,
          head: [["Employee", "Date", "Room", "Time", "Duration(h)"]],
          body: (generatedReport.bookings || []).map((b) => [
            b.employeeName,
            b.date,
            b.room,
            `${b.startTime}-${b.endTime}`,
            Number(b.duration).toFixed(2),
          ]),
        });
        break;

      case "user":
        doc.autoTable({
          startY: y,
          head: [
            [
              "User",
              "Total",
              "Approved",
              "Pending",
              "Declined",
              "Completed",
              "Total Hours",
              "Rooms",
            ],
          ],
          body: (generatedReport.userStats || []).map((u) => [
            u.user,
            u.totalBookings,
            u.approvedBookings,
            u.pendingBookings,
            u.declinedBookings,
            u.completedBookings,
            u.totalHours,
            u.roomsUsed,
          ]),
        });
        break;

      case "room":
        doc.autoTable({
          startY: y,
          head: [
            [
              "Room",
              "Total Bookings",
              "Total Hours",
              "Avg Duration",
              "Unique Users",
            ],
          ],
          body: (generatedReport.roomStats || []).map((r) => [
            r.room,
            r.totalBookings,
            Number(r.totalHours).toFixed(2),
            r.averageDuration,
            r.uniqueUsers,
          ]),
        });
        break;

      case "trends":
        if (generatedReport.trends && generatedReport.trends.daily) {
          doc.autoTable({
            startY: y,
            head: [["Date", "Bookings", "Hours"]],
            body: generatedReport.trends.daily.map((d) => [
              d.date,
              String(d.bookings),
              String(d.hours),
            ]),
          });
        }
        break;

      case "employeeMeetings":
        doc.autoTable({
          startY: y,
          head: [
            [
              "Date",
              "Time",
              "Room",
              "Status",
              "Agenda",
              "Approved By",
              "Duration(h)",
            ],
          ],
          body: (generatedReport.bookings || []).map((b) => [
            b.date,
            `${b.startTime}-${b.endTime}`,
            b.room,
            b.status,
            b.agenda || "",
            b.approvedBy,
            Number(b.duration).toFixed(2),
          ]),
        });
        break;

      default:
        doc.text("No data available for this report type", 14, y);
    }

    doc.save(
      `${(generatedReport.type || "report").replace(/\s+/g, "_")}_${moment().format("YYYY-MM-DD")}.pdf`
    );
  };

  // Unique rooms/status for filters
  const uniqueRooms = [...new Set(bookings.map((b) => b.room).filter(Boolean))];
  const uniqueStatuses = [
    ...new Set(bookings.map((b) => b.status).filter(Boolean)),
  ];

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>📊 Reports & Analytics</h1>
      </div>

      <div className="report-config">
        <div className="config-section">
          <h3>Report Type</h3>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="config-select"
          >
            <option value="summary">Summary Report</option>
            <option value="detailed">Detailed Bookings Report</option>
            <option value="user">User Analytics Report</option>
            <option value="room">Room Utilization Report</option>
            <option value="trends">Trends Analysis Report</option>
            <option value="employeeMeetings">Employee Meeting Details</option>
          </select>
        </div>

        <div className="config-section">
          <h3>Date Range</h3>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="config-select"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        <div className="config-section">
          <h3>Filter by Rooms</h3>
          <div className="filter-options">
            {uniqueRooms.map((room) => (
              <label key={room} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedRooms.includes(room)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRooms([...selectedRooms, room]);
                    else
                      setSelectedRooms(selectedRooms.filter((r) => r !== room));
                  }}
                />
                {room}
              </label>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3>Filter by Status</h3>
          <div className="filter-options">
            {uniqueStatuses.map((status) => (
              <label key={status} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(status)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedStatuses([...selectedStatuses, status]);
                    else
                      setSelectedStatuses(
                        selectedStatuses.filter((s) => s !== status)
                      );
                  }}
                />
                {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </div>

        {reportType === "employeeMeetings" && (
          <>
            <div className="config-section">
              <h3>Select Employee</h3>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="config-select"
              >
                <option value="">-- Select Employee --</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="config-section">
              <h3>Employee Date Range (optional)</h3>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="date"
                  value={employeeDateFrom}
                  onChange={(e) => setEmployeeDateFrom(e.target.value)}
                />
                <span>to</span>
                <input
                  type="date"
                  value={employeeDateTo}
                  onChange={(e) => setEmployeeDateTo(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <button onClick={handleGenerateReport} className="generate-btn">
          🔄 Generate Report
        </button>
      </div>

      {generatedReport && (
        <div className="report-display">
          <div className="report-header">
            <h2>{generatedReport.type}</h2>
            <div className="export-buttons">
              <button onClick={exportToExcel} className="export-btn excel">
                📊 Export to Excel
              </button>
              <button onClick={exportToPDF} className="export-btn pdf">
                📄 Export to PDF
              </button>
            </div>
          </div>

          <div className="report-meta">
            <p>
              <strong>Generated:</strong> {generatedReport.generatedAt}
            </p>
            <p>
              <strong>Date Range:</strong> {generatedReport.dateRange}
            </p>
            <p>
              <strong>Total Bookings:</strong>{" "}
              {generatedReport.totalBookings ?? generatedReport.totalBookings}
            </p>
            {reportType === "employeeMeetings" && (
              <p>
                <strong>Employee:</strong> {generatedReport.employeeName}
              </p>
            )}
          </div>

          <div className="report-content">
            {renderReportContent(generatedReport, reportType)}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading booking data...</p>
        </div>
      )}
    </div>
  );
};

const renderReportContent = (report, reportType) => {
  if (!report) return <p>No report available.</p>;

  switch (report.type) {
    case "Summary Report":
      return (
        <div className="summary-content">
          <div className="summary-section">
            <h3>Status Breakdown</h3>
            <div className="status-grid">
              {Object.entries(report.summary.statusBreakdown).map(
                ([status, count]) => (
                  <div key={status} className="status-item">
                    <span className="status-name">{status}</span>
                    <span className="status-count">{count}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="summary-section">
            <h3>Room Utilization</h3>
            <div className="room-grid">
              {Object.entries(report.summary.roomUtilization).map(
                ([room, count]) => (
                  <div key={room} className="room-item">
                    <span className="room-name">{room}</span>
                    <span className="room-count">{count} bookings</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="summary-section">
            <h3>Top Users</h3>
            <div className="user-grid">
              {report.summary.topUsers.map(({ user, count }) => (
                <div key={user} className="user-item">
                  <span className="user-name">{user}</span>
                  <span className="user-count">{count} bookings</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "Detailed Bookings Report":
      return (
        <div className="detailed-content">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Time</th>
                <th>Room</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {report.bookings.map((booking, index) => (
                <tr key={index}>
                  <td>{booking.employeeName}</td>
                  <td>{booking.date}</td>
                  <td>
                    {booking.startTime} - {booking.endTime}
                  </td>
                  <td>{booking.room}</td>
                  <td>{Number(booking.duration).toFixed(2)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "User Analytics Report":
      return (
        <div className="user-content">
          <table className="user-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Total Bookings</th>
                <th>Approved</th>
                <th>Pending</th>
                <th>Declined</th>
                <th>Completed</th>
                <th>Total Hours</th>
                <th>Rooms Used</th>
              </tr>
            </thead>
            <tbody>
              {report.userStats.map((user, index) => (
                <tr key={index}>
                  <td>{user.user}</td>
                  <td>{user.totalBookings}</td>
                  <td>{user.approvedBookings}</td>
                  <td>{user.pendingBookings}</td>
                  <td>{user.declinedBookings}</td>
                  <td>{user.completedBookings}</td>
                  <td>{Number(user.totalHours).toFixed(2)}h</td>
                  <td>{user.roomsUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "Room Utilization Report":
      return (
        <div className="room-content">
          <table className="room-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Total Bookings</th>
                <th>Total Hours</th>
                <th>Avg Duration</th>
                <th>Unique Users</th>
              </tr>
            </thead>
            <tbody>
              {report.roomStats.map((room, index) => (
                <tr key={index}>
                  <td>{room.room}</td>
                  <td>{room.totalBookings}</td>
                  <td>{Number(room.totalHours).toFixed(2)}h</td>
                  <td>{Number(room.averageDuration).toFixed(2)}h</td>
                  <td>{room.uniqueUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "Trends Analysis Report":
      return (
        <div className="trends-content">
          <div className="trends-section">
            <h3>Daily Trends</h3>
            <div className="trends-grid">
              {report.trends.daily.map((day, index) => (
                <div key={index} className="trend-item">
                  <span className="trend-date">{day.date}</span>
                  <span className="trend-bookings">
                    {day.bookings} bookings
                  </span>
                  <span className="trend-hours">{day.hours}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    default:
      // Employee Meeting Details will come here because its type is "Employee Meeting Details - <id>"
      if (report.bookings && report.bookings.length >= 0) {
        return (
          <div className="employee-meetings-content">
            <h3>Employee: {report.employeeName || "N/A"}</h3>
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Agenda</th>
                  <th>Approved By</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {report.bookings.map((b, i) => (
                  <tr key={i}>
                    <td>{b.date}</td>
                    <td>
                      {b.startTime} - {b.endTime}
                    </td>
                    <td>{b.room}</td>
                    <td>{b.status}</td>
                    <td>{b.agenda}</td>
                    <td>{b.approvedBy}</td>
                    <td>{Number(b.duration).toFixed(2)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return <p>No report content available.</p>;
  }
};

export default Reports;
