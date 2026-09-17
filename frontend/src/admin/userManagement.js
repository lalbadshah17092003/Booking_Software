// userManagement.js
// Centralized user management logic for create, list, edit, delete, and password change
// Modern, clean, and ready for integration with animated, responsive UI

import axios from "axios";

const API_BASE = "https://01-30225:1010/api";

/**
 * Validate Employee ID (must be AP followed by 4 digits)
 * @param {string} id
 * @returns {boolean}
 */
export function validateEmployeeId(id) {
  return /^AP\d{4}$/.test(id);
}

/**
 * Validate password (min 8 chars, 1 letter, 1 number, 1 special char)
 * @param {string} password
 * @returns {boolean}
 */
export function validatePassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
}

/**
 * Validate all user fields for create/edit
 * @param {object} fields
 * @returns {string|null} Error message or null if valid
 */
export function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function validateUserFields({ name, employeeId, email, userRole, password, confirmPassword }) {
  if (!name || !employeeId || !email || !userRole || !password || !confirmPassword) {
    return "All fields are required.";
  }
  if (!validateEmployeeId(employeeId)) {
    return "Employee ID must be in the format AP followed by 4 digits.";
  }
  if (!validateEmail(email)) {
    return "Please enter a valid email address.";
  }
  if (!validatePassword(password)) {
    return "Password must be at least 8 characters, include a number, a letter, and a special character.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

/**
 * Create a new user
 * @param {object} data
 * @returns {Promise}
 */
export async function createUser(data) {
  return axios.post(`${API_BASE}/register`, data);
}

/**
 * List all users
 * @returns {Promise}
 */
export async function listUsers() {
  return axios.get(`${API_BASE}/employees`, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` }
  });
}

/**
 * Edit a user
 * @param {string} id
 * @param {object} data
 * @returns {Promise}
 */
export async function editUser(id, data) {
  return axios.put(`${API_BASE}/employees/${id}`, data);
}

/**
 * Delete a user
 * @param {string} id
 * @returns {Promise}
 */
export async function deleteUser(id) {
  return axios.delete(`${API_BASE}/employees/${id}`);
}

/**
 * Change a user's password
 * @param {string} employeeId
 * @param {string} newPassword
 * @param {string} confirmPassword
 * @returns {Promise}
 */
export async function changePassword(employeeId, newPassword, confirmPassword) {
  return axios.put(
    `${API_BASE}/employees/${employeeId}/change-password`,
    { newPassword, confirmPassword },
    { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } }
  );
}

// You can now import these functions in your UI components and build modern, animated, responsive UIs around them. 
