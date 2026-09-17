import React, { useEffect, useState } from "react";
import axios from "axios";
import { Pie, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale
} from "chart.js";
import moment from "moment";
import "./OverallDashboard.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale
);

const OverallDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30"); // days
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          "https://01-30225:1010/api/booking"
        );
        setBookings(response.data);
      } catch (err) {
        console.error("Error fetching bookings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 600000); // Fetch every 10 minutes

    return () => clearInterval(interval);
  }, []);

  // Filter bookings based on time range and selections
  const getFilteredBookings = () => {
    const cutoffDate = moment().subtract(parseInt(timeRange), 'days').format('YYYY-MM-DD');
    
    return bookings.filter((booking) => {
      const matchesRoom = selectedRoom === "all" || booking.room === selectedRoom;
      const matchesStatus = selectedStatus === "all" || booking.status === selectedStatus;
      const matchesTimeRange = moment(booking.date).isAfter(cutoffDate);
      
      return matchesRoom && matchesStatus && matchesTimeRange;
    });
  };

  const filteredBookings = getFilteredBookings();

  // Analytics Calculations
  const calculateAnalytics = () => {
    const statusCounts = {};
    const roomCounts = {};
    const dailyBookings = {};
    const userCounts = {};
    const dailyMeetingHours = {};

    filteredBookings.forEach((booking) => {
      // Status counts
      statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
      
      // Room counts
      roomCounts[booking.room] = (roomCounts[booking.room] || 0) + 1;
      
      // Daily bookings
      dailyBookings[booking.date] = (dailyBookings[booking.date] || 0) + 1;
      
      // User counts
      userCounts[booking.empName] = (userCounts[booking.empName] || 0) + 1;
      
      // Daily meeting hours calculation
      if (booking.startTime && booking.endTime) {
        const startTime = moment(booking.startTime, 'HH:mm');
        const endTime = moment(booking.endTime, 'HH:mm');
        const duration = endTime.diff(startTime, 'hours', true);
        
        if (!dailyMeetingHours[booking.date]) {
          dailyMeetingHours[booking.date] = 0;
        }
        dailyMeetingHours[booking.date] += duration;
      }
    });

    return {
      statusCounts,
      roomCounts,
      dailyBookings,
      userCounts,
      dailyMeetingHours
    };
  };

  const analytics = calculateAnalytics();

  // KPI Calculations
  const calculateKPIs = () => {
    const totalBookings = filteredBookings.length;
    const approvedBookings = analytics.statusCounts.approved || 0;
    const pendingBookings = analytics.statusCounts.pending || 0;
    const declinedBookings = analytics.statusCounts.declined || 0;
    const completedBookings = analytics.statusCounts.completed || 0;
    
    const declineRate = totalBookings > 0 ? ((declinedBookings / totalBookings) * 100).toFixed(1) : 0;
    const completionRate = totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0;
    
    // Calculate average daily meeting hours
    const dailyHoursArray = Object.values(analytics.dailyMeetingHours);
    const avgDailyMeetingHours = dailyHoursArray.length > 0 
      ? (dailyHoursArray.reduce((a, b) => a + b, 0) / dailyHoursArray.length).toFixed(1)
      : 0;

    return {
      totalBookings,
      approvedBookings,
      pendingBookings,
      declinedBookings,
      completedBookings,
      declineRate,
      completionRate,
      avgDailyMeetingHours
    };
  };

  const kpis = calculateKPIs();

  // Chart Data

const statusColors = {
  approved: "#2ecc71",     // green
  pending: "#f1c40f",      // yellow
  declined: "#e74c3c",     // red
  completed: "#1b53f0ff",  // blue
  cancelled: "#9b59b6",    // purple
  closed: "#1f2224ff",
  ongoing:"#a120ddff",   // orange        // gray-blue
  Default: "#b9c0c5ff"     // default/fallback
};

// Chart Data
const pieData = {
  labels: Object.keys(analytics.statusCounts).map(status =>
    status.charAt(0).toUpperCase() + status.slice(1)
  ),
  datasets: [{
    data: Object.values(analytics.statusCounts),
    backgroundColor: Object.keys(analytics.statusCounts).map(status =>
      statusColors[status] || statusColors.Default
    ),
    borderWidth: 2,
    borderColor: "#fff"
  }]
};

  const barData = {
    labels: Object.keys(analytics.roomCounts),
    datasets: [{
      label: "Bookings per Room",
      data: Object.values(analytics.roomCounts),
      backgroundColor: "rgba(52, 152, 219, 0.8)",
      borderColor: "#2980b9",
      borderWidth: 2,
      borderRadius: 5
    }]
  };

  // Time series data for bookings over time
  const timeSeriesData = {
    labels: Object.keys(analytics.dailyBookings).sort(),
    datasets: [{
      label: "Daily Bookings",
      data: Object.keys(analytics.dailyBookings).sort().map(date => analytics.dailyBookings[date]),
      borderColor: "#e74c3c",
      backgroundColor: "rgba(231, 76, 60, 0.1)",
      borderWidth: 3,
      fill: true,
      tension: 0.4
    }]
  };

  // Top users chart
  const topUsersData = {
    labels: Object.keys(analytics.userCounts)
      .sort((a, b) => analytics.userCounts[b] - analytics.userCounts[a])
      .slice(0, 10),
    datasets: [{
      label: "Bookings by User",
      data: Object.keys(analytics.userCounts)
        .sort((a, b) => analytics.userCounts[b] - analytics.userCounts[a])
        .slice(0, 10)
        .map(user => analytics.userCounts[user]),
      backgroundColor: "rgba(155, 89, 182, 0.8)",
      borderColor: "#8e44ad",
      borderWidth: 2,
      borderRadius: 5
    }]
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      }
    }
  };

  const lineChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  return (
    <div className="dashboard-container-overall">
      {/* Header with filters */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Analytics Dashboard</h1>
        <div className="dashboard-filters">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="filter-select"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          
          <select 
            value={selectedRoom} 
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Rooms</option>
            {Object.keys(analytics.roomCounts).map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
          
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All</option>
            {Object.keys(analytics.statusCounts).map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-container">
        <div className="kpi-card total">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <h3>Total Bookings</h3>
            <p className="kpi-value">{kpis.totalBookings}</p>
          </div>
        </div>
        
        <div className="kpi-card approved">
          <div className="kpi-icon">✅</div>
          <div className="kpi-content">
            <h3>Approved Meetings</h3>
            <p className="kpi-value">{kpis.approvedBookings}</p>
          </div>
        </div>
        
        <div className="kpi-card pending">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-content">
            <h3>Pending</h3>
            <p className="kpi-value">{kpis.pendingBookings}</p>
          </div>
        </div>
        
        <div className="kpi-card time">
          <div className="kpi-icon">⏱️</div>
          <div className="kpi-content">
            <h3>Avg per DAY MEETING Time</h3>
            <p className="kpi-value">{kpis.avgDailyMeetingHours}h</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Status Distribution */}
        <div className="chart-card">
          <h3>Booking Status Distribution</h3>
          <div className="chart-container">
            <Pie data={pieData} options={chartOptions} />
          </div>
        </div>

        {/* Room Usage */}
        <div className="chart-card">
          <h3>Room Usage Analytics</h3>
          <div className="chart-container">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>

        {/* Time Series */}
        <div className="chart-card full-width">
          <h3>Booking Trends Over Time</h3>
          <div className="chart-container">
            <Line data={timeSeriesData} options={lineChartOptions} />
          </div>
        </div>

        {/* Top Users */}
        <div className="chart-card">
          <h3>Top Booking Users</h3>
          <div className="chart-container">
            <Bar data={topUsersData} options={chartOptions} />
          </div>
        </div>

      </div>

      {/* Detailed Statistics */}
      <div className="stats-section">
        <h3>Detailed Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Number of Meeting Requests:</span>
            <span className="stat-value">{kpis.totalBookings}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Rooms Used:</span>
            <span className="stat-value">{Object.keys(analytics.roomCounts).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Active Users:</span>
            <span className="stat-value">{Object.keys(analytics.userCounts).length}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      )}
    </div>
  );
};

export default OverallDashboard;
