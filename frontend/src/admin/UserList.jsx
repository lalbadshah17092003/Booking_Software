import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  listUsers,
  createUser,
  editUser,
  deleteUser,
  changePassword,
  validateUserFields,
  validateEmployeeId,
  validateEmail,
  validatePassword,
} from "./userManagement";
import "./UserList.css";

import { motion, AnimatePresence } from "framer-motion";

const initialForm = {
  name: "",
  employeeId: "",
  email: "",
  userRole: "",
  password: "",
  confirmPassword: "",
};

const UserList = () => {
  // State
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'delete' | 'password' | null
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [processing, setProcessing] = useState(false);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listUsers();
      setEmployees(res.data);
    } catch (err) {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  // Search and pagination
  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.userRole.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const paginated = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handlers
  const handleOpenModal = (type, user = null) => {
    setError("");
    setSuccess("");
    setModal(type);
    if (type === "edit" && user) {
      setEditId(user._id);
      setForm({
        name: user.name,
        employeeId: user.employeeId,
        email: user.email || "",
        userRole: user.userRole,
        password: "",
        confirmPassword: "",
      });
    } else if (type === "password" && user) {
      setEditId(user._id);
      setForm({
        name: user.name,
        employeeId: user.employeeId,
        email: user.email || "",
        userRole: user.userRole,
        password: "",
        confirmPassword: "",
      });
    } else if (type === "delete" && user) {
      setDeleteId(user._id);
    } else {
      setForm(initialForm);
      setEditId(null);
      setDeleteId(null);
    }
  };

  const handleCloseModal = () => {
    setModal(null);
    setForm(initialForm);
    setEditId(null);
    setDeleteId(null);
    setError("");
    setSuccess("");
  };

  // Create user
  const handleCreate = async (e) => {
    setProcessing(true);
    e.preventDefault();
    setError("");
    setSuccess("");
    const validation = validateUserFields(form);
    if (validation) {
      setError(validation);
      setProcessing(false);
      return;
    }
    try {
      await createUser({
        ...form,
        createdBy: sessionStorage.getItem("employeeId"), // or however you store the admin's ID
      });
      setSuccess("User created successfully!");
      fetchUsers();
      setTimeout(handleCloseModal, 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user.");
    } finally {
      setProcessing(false);
    }
  };

  // Edit user
  const handleEdit = async (e) => {
    setProcessing(true);
    e.preventDefault();
    setError("");
    setSuccess("");
    // Only validate password if provided
    if (form.password || form.confirmPassword) {
      const validation = validateUserFields(form);
      if (validation) {
        setError(validation);
        setProcessing(false);
        return;
      }
    } else if (
      !form.name ||
      !form.employeeId ||
      !form.email ||
      !form.userRole ||
      !validateEmployeeId(form.employeeId) ||
      !validateEmail(form.email)
    ) {
      setError(
        !form.name || !form.employeeId || !form.email || !form.userRole
          ? "Name, Employee ID, Email, and User Role are required."
          : !validateEmployeeId(form.employeeId)
          ? "Employee ID must be in the format AP followed by 4 digits."
          : "Please enter a valid email address."
      );
      setProcessing(false);
      return;
    }
    try {
      await editUser(editId, {
        name: form.name,
        employeeId: form.employeeId,
        email: form.email,
        userRole: form.userRole,
        ...(form.password
          ? { password: form.password, confirmPassword: form.confirmPassword }
          : {}),
      });
      setSuccess("User updated successfully!");
      fetchUsers();
      setTimeout(handleCloseModal, 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user.");
    } finally {
      setProcessing(false);
    }
  };

  // Delete user
  const handleDelete = async () => {
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      await deleteUser(deleteId);
      setSuccess("User deleted successfully!");
      fetchUsers();
      setTimeout(handleCloseModal, 1200);
    } catch (err) {
      setError("Failed to delete user.");
    } finally {
      setProcessing(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    setProcessing(true);
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validatePassword(form.password)) {
      setError(
        "Password must be at least 8 characters, include a number, a letter, and a special character."
      );
      setProcessing(false);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setProcessing(false);
      return;
    }
    try {
      await changePassword(editId, form.password, form.confirmPassword);
      setSuccess("Password changed successfully!");
      fetchUsers();
      setTimeout(handleCloseModal, 1200);
    } catch (err) {
      setError("Failed to change password.");
    } finally {
      setProcessing(false);
    }
  };
const getRandomColor = (name, darker = false) => {
  const colors = darker 
    ? ["#1e3c72", "#2c3e50", "#1a472a", "#4a1a2e", "#2d1b4e"]
    : ["#4facfe", "#43e97b", "#fa709a", "#fee140", "#30cfd0"];
  const index = name?.length % colors.length || 0;
  return colors[index];
};
  // Export to Excel
  const handleExport = () => {
    try {
      const dataToExport = employees.map((employee) => ({
        "Employee Name": employee.name,
        "Employee ID": employee.employeeId,
        Email: employee.email || "",
        "User Role": employee.userRole,
        "Created By": employee.createdBy,
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, "EmployeeList.xlsx");
      setSuccess("Exported to Excel!");
      setTimeout(() => setSuccess(""), 1200);
    } catch (error) {
      setError("Export failed. Please try again.");
    }
  };

  // Calculate total pages
const totalPages = Math.ceil(filtered.length / rowsPerPage);

  // Pagination
  const handleChangePage = (newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // UI
 // UI
return (
  <div className="user-management-container">
    {/* Error and Success Messages */}
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -50, x: "-50%" }}
          className="floating-message error"
        >
          <span className="msg-icon">❌</span>
          <span>{error}</span>
          <button onClick={() => setError("")} className="close-msg">
            ×
          </button>
        </motion.div>
      )}
      
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -50, x: "-50%" }}
          className="floating-message success"
        >
          <span className="msg-icon">✅</span>
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="close-msg">
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Main Content */}
    <div className="user-management-content">
      {/* Header Section */}
      <div className="user-header glass-card">
        <div className="header-top">
          <div className="title-section">
            <div className="title-icon">👥</div>
            <div>
              <h1>User Management</h1>
              <p className="subtitle">Manage system users and their permissions</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => handleOpenModal("create")}>
              <span>➕</span> Create User
            </button>
            <button className="btn-secondary" onClick={handleExport}>
              <span>📊</span> Export
            </button>
          </div>
        </div>
        
        <div className="header-bottom">
          <div className="stats-badge">
            <span className="stat-icon">👥</span>
            <span className="stat-count">{employees.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              className="user-search"
              type="text"
              placeholder="Search by name, ID, email or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm("")}>
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="user-table-wrapper glass-card">
        {loading ? (
          <div className="loading-container">
            <div className="custom-loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Email</th>
                  <th>User Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length > 0 ? (
                  paginated.map((user, index) => (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td>
                        <div className="user-name-cell">
                          <div className="user-avatar" style={{
                            background: `linear-gradient(135deg, ${getRandomColor(user.name)}, ${getRandomColor(user.name, true)})`
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="user-name">{user.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="employee-id-badge">{user.employeeId}</span>
                      </td>
                      <td>
                        <span className="user-email">{user.email || "-"}</span>
                      </td>
                      <td>
                        <span className={`role-badge role-${user.userRole?.toLowerCase()}`}>
                          {user.userRole === "Admin"}
                          {user.userRole === "Hr"}
                          {user.userRole === "User"}
                          {" "}{user.userRole}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            className="action-icon-btn edit"
                            onClick={() => handleOpenModal("edit", user)}
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button
                            className="action-icon-btn password"
                            onClick={() => handleOpenModal("password", user)}
                            title="Change Password"
                          >
                            🔐
                          </button>
                          <button
                            className="action-icon-btn delete"
                            onClick={() => handleOpenModal("delete", user)}
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h3>No results found</h3>
                        <p>Try adjusting your search or create a new user</p>
                        <button className="btn-primary" onClick={() => handleOpenModal("create")}>
                          + Create User
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Section */}
      {filtered.length > 0 && (
        <div className="pagination-section glass-card">
          <div className="pagination-info">
            Showing {page * rowsPerPage + 1} to{" "}
            {Math.min((page + 1) * rowsPerPage, filtered.length)} of{" "}
            {filtered.length} entries
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handleChangePage(Math.max(page - 1, 0))}
              disabled={page === 0}
            >
              ◀ Previous
            </button>
            <div className="pagination-pages">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 3) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-page ${page === pageNum ? "active" : ""}`}
                    onClick={() => handleChangePage(pageNum)}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <button
              className="pagination-btn"
              onClick={() =>
                handleChangePage(
                  Math.min(page + 1, Math.ceil(filtered.length / rowsPerPage) - 1)
                )
              }
              disabled={page >= Math.ceil(filtered.length / rowsPerPage) - 1}
            >
              Next ▶
            </button>
            <select
              className="pagination-select"
              value={rowsPerPage}
              onChange={handleChangeRowsPerPage}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      )}
    </div>

    {/* Modals */}
    <AnimatePresence>
      {modal === "create" && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <motion.div
            className="modal-container glass-card"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                <span>➕</span> Create User
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Employee ID</label>
                <input
                  type="text"
                  placeholder="AP1234"
                  value={form.employeeId}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, "");
                    if (digits.length > 4) digits = digits.slice(0, 4);
                    setForm({ ...form, employeeId: "AP" + digits });
                  }}
                  required
                  maxLength={6}
                />
                <small>Format: AP followed by 4 digits (e.g., AP1234)</small>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>User Role</label>
                <select
                  value={form.userRole}
                  onChange={(e) => setForm({ ...form, userRole: e.target.value })}
                  required
                >
                  <option value="">Select Role</option>
                  <option value="Admin">👑 Admin</option>
                  <option value="Hr">🤝 HR</option>
                  <option value="User">👤 User</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create User
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {modal === "edit" && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <motion.div
            className="modal-container glass-card"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                <span>✏️</span> Edit User
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Employee ID</label>
                <input
                  type="text"
                  placeholder="AP1234"
                  value={form.employeeId}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, "");
                    if (digits.length > 4) digits = digits.slice(0, 4);
                    setForm({ ...form, employeeId: "AP" + digits });
                  }}
                  required
                  maxLength={6}
                  disabled
                />
                <small>Employee ID cannot be changed</small>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>User Role</label>
                <select
                  value={form.userRole}
                  onChange={(e) => setForm({ ...form, userRole: e.target.value })}
                  required
                >
                  <option value="">Select Role</option>
                  <option value="Admin">👑 Admin</option>
                  <option value="Hr">🤝 HR</option>
                  <option value="User">👤 User</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {modal === "password" && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <motion.div
            className="modal-container glass-card"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                <span>🔐</span> Change Password
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>User</label>
                <input
                  type="text"
                  value={form.name}
                  disabled
                  className="disabled-input"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Change Password
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {modal === "delete" && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <motion.div
            className="modal-container delete-modal glass-card"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                <span>🗑️</span> Delete User
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <div className="delete-warning">
              <div className="warning-icon">⚠️</div>
              <h3>Are you sure?</h3>
              <p>
                You are about to delete <strong>{form.name}</strong> with employee ID{" "}
                <strong>{form.employeeId}</strong>.
              </p>
              <p className="warning-text">This action cannot be undone!</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                Cancel
              </button>
              <button type="button" className="btn-delete" onClick={handleDelete}>
                Delete Permanently
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Processing Overlay */}
    {processing && (
      <motion.div
        className="fullscreen-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="loader-content">
          <div className="spinner"></div>
          <p>Processing your request...</p>
        </div>
      </motion.div>
    )}
  </div>
);
};

export default UserList;
