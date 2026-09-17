import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './SuccessfullBooking.css';

const SuccessfullBooking = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRoom, setFilterRoom] = useState('');

  // Get unique room names for dropdown
  const roomOptions = Array.from(new Set(bookings.map(b => b.room))).filter(Boolean);

  useEffect(() => {
    const fetchSuccessfulBookings = async () => {
      try {
        setLoading(true);
        const response = await axios.get('https://01-30225:1010/api/booking/successful');
        setBookings(response.data);
      } catch (err) {
        setError('Failed to fetch booking data');
      } finally {
        setLoading(false);
      }
    };
    fetchSuccessfulBookings();
  }, []);

  const formatTime = (time) => {
    return time ? time.substring(0, 5) : '';
  };

  const getStatusColor = (status) => {
    const statusColors = {
      approved: '#28a745',
      ongoing: '#007bff',
      completed: '#17a2b8'
    };
    return statusColors[status] || '#28a745';
  };

  return (
    <div className="successful-bookings">
      <h1>🎉 Confirmed Bookings</h1>
      {/* Filters */}
      <div className="filters-section" style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ fontWeight: 600 }}>Date: </label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 600 }}>Room: </label>
          <select
            value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #ccc', minWidth: 120 }}
          >
            <option value="All Rooms">All Rooms</option>
            <option value="Admin Conference Room">Admin Conference Room</option>
            <option value="QA Conference Room">QA Conference Room</option>
            <option value="QA Training Room">QA Training Room</option>
            <option value="Meeting Room 1">Meeting Room 1</option>
            <option value="Meeting Room 2">Meeting Room 2</option>
          </select>
        </div>
      </div>
      {/* Filtered bookings */}
      {loading ? (
        <div className="custom-loading-spinner" />
      ) : error ? (
        <div className="custom-error-message">{error}</div>
      ) : (
        <div className="booking-cards-container">
          {bookings.filter(booking => {
            const matchesDate = filterDate ? booking.date === filterDate : true;
            const matchesRoom = filterRoom ? booking.room === filterRoom : true;
            return matchesDate && matchesRoom;
          }).length > 0 ? (
            bookings.filter(booking => {
              const matchesDate = filterDate ? booking.date === filterDate : true;
              const matchesRoom = filterRoom ? booking.room === filterRoom : true;
              return matchesDate && matchesRoom;
            }).map((booking, idx) => (
              <div
                className="booking-card fade-in-slide modern-card"
                key={booking._id}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {/* Card Header */}
                <div className="card-header">
                  <div className="room-info">
                    <span className="room-icon" role="img" aria-label="room">🏢</span>
                    <h3 className="room-name">{booking.room}</h3>
                  </div>
                  <div 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(booking.status) }}
                  >
                    {booking.status === 'approved' && '✅ Approved'}
                    {booking.status === 'ongoing' && '🔄 Ongoing'}
                    {booking.status === 'completed' && '✅ Completed'}
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body">
                  {/* Date and Time */}
                  <div className="booking-details">
                    <div className="detail-item">
                      <span className="detail-icon" role="img" aria-label="date">📅</span>
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{booking.date}</span>
                    </div><br/>
                    <div className="detail-item">
                      <span className="detail-icon" role="img" aria-label="time">⏰</span>
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                    </div>
                  </div>

                </div>
              </div>
            ))
          ) : (
            <div className="empty-success-state">
              <span className="empty-icon" role="img" aria-label="no bookings">📭</span>
              <h3>No confirmed bookings found</h3>
              <p>Your approved bookings will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuccessfullBooking;
