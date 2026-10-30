import React, { useEffect, useState } from "react";
import axios from "axios";
import "./EmailEntry.css";

const EmailEntry = () => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    emailId: ""
  });

  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [uploadResults, setUploadResults] = useState(null);
  const [showUploadResults, setShowUploadResults] = useState(false);

  const BASE_URL = "https://192.168.0.150:5000/api/email-entry";

  const fetchData = async (page = 1, search = "") => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/list`, {
        params: {
          page,
          limit: pagination.limit,
          search
        }
      });
      setData(res.data.data || res.data);
      
      if (res.data.pagination) {
        setPagination(res.data.pagination);
        setTotalPages(res.data.pagination.pages);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      showMessage("Error fetching data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, searchTerm);
  }, [currentPage]);

  const showMessage = (message, type = "success") => {
    if (type === "success") {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(""), 1010);
    } else {
      alert(message);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    

// First name: optional, but if provided, must be at least 1 char
if (form.firstName && form.firstName.trim().length < 1) {
  newErrors.firstName = "First name must contain at least 1 character";
}

// Last name: optional, but if provided, must be at least 1 char
if (form.lastName && form.lastName.trim().length < 1) {
  newErrors.lastName = "Last name must contain at least 1 character";
}

// At least one of firstName OR lastName is required
if (!form.firstName.trim() && !form.lastName.trim()) {
  newErrors.bothNames = "At least First Name or Last Name is required";
}


    // Email is REQUIRED
    if (!form.emailId.trim()) {
      newErrors.emailId = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailId)) {
      newErrors.emailId = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
    
    // Clear the "both names" error if either field is filled
    if ((name === "firstName" || name === "lastName") && value.trim() && errors.bothNames) {
      setErrors({ ...errors, bothNames: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await axios.post(`${BASE_URL}/add`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        emailId: form.emailId.trim()
      });
      
      setForm({ firstName: "", lastName: "", emailId: "" });
      showMessage("Entry added successfully!");
      fetchData(currentPage, searchTerm);
      setErrors({});
    } catch (err) {
      if (err.response?.status === 409) {
        setErrors({ emailId: "This email already exists" });
      } else {
        showMessage(err.response?.data?.error || "Failed to add entry", "error");
      }
    }
  };

  const handleBulkUpload = async () => {
    if (!file) {
      showMessage("Please select a CSV file before uploading.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadLoading(true);
    setUploadResults(null);
    setShowUploadResults(true);

    try {
      const res = await axios.post(
        `${BASE_URL}/bulk-upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      console.log("Bulk upload response:", res.data);
      
      // Show detailed results
      setUploadResults(res.data);
      
      if (res.data.summary?.failed === 0) {
        showMessage("All entries uploaded successfully!");
      } else if (res.data.summary?.successful > 0) {
        showMessage(`${res.data.summary.successful} entries uploaded successfully (${res.data.summary.failed} failed)`);
      }
      
      setFile(null);
      const input = document.querySelector('.emailentry-file-input');
      if (input) input.value = "";
      
      fetchData(currentPage, searchTerm);
    } catch (err) {
      console.error("Bulk upload error:", err);
      
      let message = "Upload failed";
      if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      
      showMessage(message, "error");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      setCurrentPage(1);
      fetchData(1, searchTerm);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
    fetchData(1, "");
  };

  const downloadCSVTemplate = () => {
    const template = `firstName,lastName,emailId\nJohn,Doe,john@example.com\nJane,,jane@example.com\n,Smith,mike@example.com\nNote: At least one of firstName OR lastName is required. Email is always required.`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email_entries_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showMessage("CSV template downloaded!");
  };

  const clearUploadResults = () => {
    setUploadResults(null);
    setShowUploadResults(false);
  };

  const exportToCSV = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/export-csv`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'email-entries-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showMessage("Data exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      showMessage("Failed to export data", "error");
    }
  };

  return (
    <div className="emailentry-container">
      <header className="emailentry-header">
        <h1 className="emailentry-title">📧 Email Entry Management</h1>
        <p className="emailentry-subtitle">Manage email entries with flexible name requirements</p>
        <div className="emailentry-header-note">
          ⚠️ Email is required. At least one of First Name or Last Name is required.
        </div>
      </header>

      {successMessage && (
        <div className="emailentry-success-message">
          ✅ {successMessage}
        </div>
      )}

      <main className="emailentry-main">
        {/* Single Entry Form */}
        <section className="emailentry-section emailentry-form-section">
          <div className="emailentry-section-header">
            <h2 className="emailentry-section-title">➕ Add Single Entry</h2>
            <div className="emailentry-form-requirements">
              <span className="emailentry-requirement-item">📧 Email: <strong>Required</strong></span>
              <span className="emailentry-requirement-item">👤 First Name: <em>Optional</em></span>
              <span className="emailentry-requirement-item">👤 Last Name: <em>Optional</em></span>
              <span className="emailentry-requirement-item">✅ At least one name is required</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="emailentry-form">
            <div className="emailentry-form-row">
              <div className="emailentry-form-group">
                <label htmlFor="firstName" className="emailentry-label">
                  First Name <span className="emailentry-optional">(Optional)</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="Enter first name (optional)"
                  value={form.firstName}
                  onChange={handleChange}
                  className={`emailentry-input ${errors.firstName ? 'emailentry-input-error' : ''}`}
                />
                {errors.firstName && (
                  <span className="emailentry-error">{errors.firstName}</span>
                )}
                <div className="emailentry-input-hint">Leave empty if not available</div>
              </div>

              <div className="emailentry-form-group">
                <label htmlFor="lastName" className="emailentry-label">
                  Last Name <span className="emailentry-optional">(Optional)</span>
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Enter last name (optional)"
                  value={form.lastName}
                  onChange={handleChange}
                  className={`emailentry-input ${errors.lastName ? 'emailentry-input-error' : ''}`}
                />
                {errors.lastName && (
                  <span className="emailentry-error">{errors.lastName}</span>
                )}
                <div className="emailentry-input-hint">Leave empty if not available</div>
              </div>

              <div className="emailentry-form-group">
                <label htmlFor="emailId" className="emailentry-label">
                  Email Address <span className="emailentry-required">* Required</span>
                </label>
                <input
                  id="emailId"
                  name="emailId"
                  type="email"
                  placeholder="Enter email address (required)"
                  value={form.emailId}
                  onChange={handleChange}
                  className={`emailentry-input ${errors.emailId ? 'emailentry-input-error' : ''}`}
                  required
                />
                {errors.emailId && (
                  <span className="emailentry-error">{errors.emailId}</span>
                )}
                <div className="emailentry-input-hint">Must be a valid email address</div>
              </div>
            </div>

            {errors.bothNames && (
              <div className="emailentry-error emailentry-both-names-error">
                ⚠️ {errors.bothNames}
              </div>
            )}

            <div className="emailentry-form-actions">
              <button type="submit" className="emailentry-btn emailentry-btn-primary">
                Add Entry
              </button>
              <button 
                type="button" 
                onClick={() => setForm({ firstName: "", lastName: "", emailId: "" })}
                className="emailentry-btn emailentry-btn-outline"
              >
                Clear Form
              </button>
            </div>
          </form>
        </section>

        {/* Bulk Upload Section */}
        <section className="emailentry-section emailentry-upload-section">
          <h2 className="emailentry-section-title">📤 Bulk Upload CSV</h2>
          
          <div className="emailentry-upload-area">
            <div className="emailentry-upload-instructions">
              <div className="emailentry-instruction-content">
                <h3>📋 CSV Format Instructions:</h3>
                <ul className="emailentry-instruction-list">
                  <li>✅ Required column: <code>emailId</code> (or <code>email</code>)</li>
                  <li>✅ Optional columns: <code>firstName</code> and/or <code>lastName</code></li>
                  <li>✅ At least one name column must contain data for each row</li>
                  <li>✅ File must be in CSV format (.csv extension)</li>
                  <li>✅ Maximum file size: 10MB</li>
                  <li>✅ Supported column names: <code>firstName</code>, <code>first name</code>, <code>lastName</code>, <code>last name</code>, <code>emailId</code>, <code>email</code>, <code>email address</code></li>
                </ul>
                <button 
                  type="button" 
                  onClick={downloadCSVTemplate}
                  className="emailentry-btn emailentry-btn-outline emailentry-btn-template"
                >
                  📄 Download CSV Template
                </button>
              </div>
            </div>

            <div className="emailentry-file-upload">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setFile(e.target.files[0])}
                className="emailentry-file-input"
                id="csvFileInput"
              />
              <label htmlFor="csvFileInput" className="emailentry-file-label">
                <span className="emailentry-file-icon">📁</span>
                <span className="emailentry-file-label-text">Choose CSV File</span>
              </label>
              
              <div className="emailentry-file-info">
                {file ? (
                  <>
                    <span className="emailentry-file-name">📎 {file.name}</span>
                    <span className="emailentry-file-size">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </>
                ) : (
                  <span className="emailentry-file-placeholder">No file chosen</span>
                )}
              </div>
              
              <div className="emailentry-upload-actions">
                <button
                  onClick={handleBulkUpload}
                  disabled={!file || uploadLoading}
                  className="emailentry-btn emailentry-btn-upload"
                >
                  {uploadLoading ? (
                    <>
                      <span className="emailentry-spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    '📤 Upload CSV'
                  )}
                </button>
                <button 
                  onClick={() => {
                    setFile(null);
                    document.querySelector('.emailentry-file-input').value = "";
                  }}
                  className="emailentry-btn emailentry-btn-clear"
                  disabled={!file}
                >
                  Clear
                </button>
              </div>
            </div>

            {showUploadResults && uploadResults && (
              <div className="emailentry-upload-results">
                <div className="emailentry-results-header">
                  <h3>📊 Upload Results</h3>
                  <button 
                    onClick={clearUploadResults}
                    className="emailentry-btn-close"
                  >
                    ×
                  </button>
                </div>
                
                <div className="emailentry-results-summary">
                  <div className="emailentry-results-grid">
                    <div className="emailentry-result-card emailentry-result-success">
                      <span className="emailentry-result-icon">✅</span>
                      <span className="emailentry-result-count">{uploadResults.summary?.successful || 0}</span>
                      <span className="emailentry-result-label">Successful</span>
                    </div>
                    <div className="emailentry-result-card emailentry-result-failed">
                      <span className="emailentry-result-icon">❌</span>
                      <span className="emailentry-result-count">{uploadResults.summary?.failed || 0}</span>
                      <span className="emailentry-result-label">Failed</span>
                    </div>
                    <div className="emailentry-result-card emailentry-result-duplicates">
                      <span className="emailentry-result-icon">⚠️</span>
                      <span className="emailentry-result-count">{uploadResults.summary?.duplicates || 0}</span>
                      <span className="emailentry-result-label">Duplicates</span>
                    </div>
                    <div className="emailentry-result-card emailentry-result-invalid">
                      <span className="emailentry-result-icon">✋</span>
                      <span className="emailentry-result-count">{uploadResults.summary?.invalidRows || 0}</span>
                      <span className="emailentry-result-label">Invalid</span>
                    </div>
                  </div>
                </div>
                
                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div className="emailentry-errors-list">
                    <h4>Error Details ({uploadResults.errors.length}):</h4>
                    <div className="emailentry-errors-container">
                      {uploadResults.errors.slice(0, 100).map((error, index) => (
                        <div key={index} className="emailentry-error-item">
                          <span className="emailentry-error-icon">❌</span>
                          <span className="emailentry-error-text">{error}</span>
                        </div>
                      ))}
                      {uploadResults.errors.length > 100 && (
                        <div className="emailentry-error-more">
                          ... and {uploadResults.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {uploadResults.sampleEntries && uploadResults.sampleEntries.length > 0 && (
                  <div className="emailentry-sample-entries">
                    <h4>Sample of Successful Entries:</h4>
                    <div className="emailentry-sample-grid">
                      {uploadResults.sampleEntries.map((entry, index) => (
                        <div key={index} className="emailentry-sample-card">
                          <div className="emailentry-sample-name">
                            {entry.firstName || entry.lastName ? 
                              `${entry.firstName || ''} ${entry.lastName || ''}`.trim() : 
                              '(No Name)'
                            }
                          </div>
                          <div className="emailentry-sample-email">{entry.emailId}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadResults.fileInfo && (
                  <div className="emailentry-file-details">
                    <h4>File Information:</h4>
                    <div className="emailentry-file-details-grid">
                      <div className="emailentry-file-detail">
                        <span className="emailentry-file-detail-label">File Name:</span>
                        <span className="emailentry-file-detail-value">{uploadResults.fileInfo.originalName}</span>
                      </div>
                      <div className="emailentry-file-detail">
                        <span className="emailentry-file-detail-label">File Size:</span>
                        <span className="emailentry-file-detail-value">{uploadResults.fileInfo.size}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Data Table Section */}
        <section className="emailentry-section emailentry-table-section">
          <div className="emailentry-table-header">
            <div className="emailentry-table-title-section">
              <h2 className="emailentry-section-title">📥 Email Entries ({pagination.total})</h2>
              <button 
                onClick={exportToCSV}
                className="emailentry-btn emailentry-btn-export"
              >
                📥 Export to CSV
              </button>
            </div>
            
            <div className="emailentry-table-controls">
              <div className="emailentry-search-box">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearch}
                  className="emailentry-search-input"
                />
                <button 
                  onClick={() => handleSearch({ type: 'click' })}
                  className="emailentry-btn emailentry-btn-search"
                >
                  🔍 Search
                </button>
                {searchTerm && (
                  <button 
                    onClick={clearSearch}
                    className="emailentry-btn emailentry-btn-clear"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="emailentry-table-actions">
                <button 
                  onClick={() => fetchData(currentPage, searchTerm)}
                  className="emailentry-btn emailentry-btn-refresh"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="emailentry-loading">
              <div className="emailentry-spinner-large"></div>
              <p>Loading email entries...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="emailentry-empty-state">
              <div className="emailentry-empty-icon">📭</div>
              <h3>No entries found</h3>
              <p>Add your first email entry using the form above or upload a CSV file.</p>
              <button 
                onClick={downloadCSVTemplate}
                className="emailentry-btn emailentry-btn-outline"
              >
                📄 Download CSV Template
              </button>
            </div>
          ) : (
            <>
              <div className="emailentry-table-container">
                <table className="emailentry-table">
                  <thead>
                    <tr>
                      <th className="emailentry-th">First Name</th>
                      <th className="emailentry-th">Last Name</th>
                      <th className="emailentry-th">Email Address</th>
                      <th className="emailentry-th">Added Date</th>
                      <th className="emailentry-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr key={item._id} className="emailentry-tr">
                        <td className="emailentry-td">
                          {item.firstName ? (
                            item.firstName
                          ) : (
                            <span className="emailentry-missing-data">
                              <span className="emailentry-missing-icon">—</span>
                              <span className="emailentry-missing-text">Not Provided</span>
                            </span>
                          )}
                        </td>
                        <td className="emailentry-td">
                          {item.lastName ? (
                            item.lastName
                          ) : (
                            <span className="emailentry-missing-data">
                              <span className="emailentry-missing-icon">—</span>
                              <span className="emailentry-missing-text">Not Provided</span>
                            </span>
                          )}
                        </td>
                        <td className="emailentry-td emailentry-email-cell">
                          <a href={`mailto:${item.emailId}`} className="emailentry-email-link">
                            {item.emailId}
                          </a>
                        </td>
                        <td className="emailentry-td emailentry-date-cell">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </td>
                        <td className="emailentry-td">
                          <span className={`emailentry-status ${
                            !item.firstName && !item.lastName ? 'emailentry-status-warning' :
                            (!item.firstName || !item.lastName) ? 'emailentry-status-partial' :
                            'emailentry-status-complete'
                          }`}>
                            {!item.firstName && !item.lastName ? 'No Names' :
                             (!item.firstName || !item.lastName) ? 'Partial' :
                             'Complete'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="emailentry-pagination">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="emailentry-btn emailentry-btn-pagination"
                  >
                    ⏮ First
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="emailentry-btn emailentry-btn-pagination"
                  >
                    ← Previous
                  </button>
                  
                  <div className="emailentry-page-numbers">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`emailentry-btn emailentry-page-btn ${
                            currentPage === pageNum ? 'emailentry-page-btn-active' : ''
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="emailentry-btn emailentry-btn-pagination"
                  >
                    Next →
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="emailentry-btn emailentry-btn-pagination"
                  >
                    Last ⏭
                  </button>
                  
                  <div className="emailentry-page-info">
                    Page {currentPage} of {totalPages}
                    <span className="emailentry-total-info">
                      • Total: {pagination.total} entries
                    </span>
                  </div>
                </div>
              )}
              
              <div className="emailentry-table-footer">
                <div className="emailentry-table-stats">
                  <div className="emailentry-stat-item">
                    <span className="emailentry-stat-label">Showing:</span>
                    <span className="emailentry-stat-value">
                      {Math.min((currentPage - 1) * pagination.limit + 1, pagination.total)}-
                      {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total}
                    </span>
                  </div>
                  <div className="emailentry-stat-item">
                    <span className="emailentry-stat-label">Page Size:</span>
                    <select 
                      value={pagination.limit}
                      onChange={(e) => {
                        setPagination({...pagination, limit: parseInt(e.target.value)});
                        setCurrentPage(1);
                        fetchData(1, searchTerm);
                      }}
                      className="emailentry-page-size-select"
                    >
                      <option value="10">10 per page</option>
                      <option value="25">25 per page</option>
                      <option value="50">50 per page</option>
                      <option value="100">100 per page</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="emailentry-footer">
        <div className="emailentry-footer-content">
          <div className="emailentry-footer-section">
            <h4>📧 Email Entry System</h4>
            <p>Version 2.0 • Flexible name requirements</p>
          </div>
          
          <div className="emailentry-footer-section">
            <h4>Requirements:</h4>
            <ul className="emailentry-footer-list">
              <li>✅ Email address is always required</li>
              <li>✅ At least one name (first or last) is required</li>
              <li>✅ Email must be unique</li>
              <li>✅ Names must be 2+ characters if provided</li>
            </ul>
          </div>
          
          <div className="emailentry-footer-section">
            <h4>Features:</h4>
            <ul className="emailentry-footer-list">
              <li>📤 Bulk CSV upload with validation</li>
              <li>📥 CSV export functionality</li>
              <li>🔍 Search and pagination</li>
              <li>📊 Detailed upload statistics</li>
            </ul>
          </div>
        </div>
        
        <div className="emailentry-footer-bottom">
          <p className="emailentry-footer-copyright">
            © {new Date().getFullYear()} Email Entry Management System
          </p>
          <p className="emailentry-footer-note">
            ⚠️ Ensure all email addresses are valid and unique
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EmailEntry;