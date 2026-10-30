import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./NewPassword.css";

const NewPassword = () => {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [employeeInfo, setEmployeeInfo] = useState({
    employeeId: "",
    name: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const token = sessionStorage.getItem("token");

  // Redirect if the user has already reset the password
  useEffect(() => {
    const hasCompletedPasswordReset = sessionStorage.getItem('hasCompletedPasswordReset') === 'true';
    if (hasCompletedPasswordReset) {
      navigate("/dashboard"); // Redirect to dashboard or another page after reset
      return; // Prevents further execution if the user shouldn't access the page
    }

    if (token) {
      const decoded = jwtDecode(token);
      const empId = decoded.employeeId;
      setEmployeeInfo((prev) => ({ ...prev, employeeId: empId }));

      // Fetch employee name using employeeId
      axios
        .get(`https://192.168.0.150:5000/api/employees/${empId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setEmployeeInfo((prev) => ({
            ...prev,
            name: res.data.name,
          }));
        })
        .catch((err) => {
          console.error("Failed to fetch employee details", err);
        });
    }
  }, [token, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

  if (!passwordRegex.test(formData.newPassword)) {
    setError(
      "Password must be at least 6 characters long, contain at least one number, one letter, and one special character."
    );
    return;
  }

  if (formData.newPassword !== formData.confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  if (formData.newPassword.length < 6) {
    setError("Password must be at least 6 characters.");
    return;
  }

  try {
  await axios.put(
    `https://192.168.0.150:5000/api/employees/${employeeInfo.employeeId}/update-password`,
    { newPassword: formData.newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // ✅ Remove all session info and set reset-complete flag
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("employeeId");
  sessionStorage.removeItem("requiresPasswordReset");
  sessionStorage.setItem("hasCompletedPasswordReset", "true");

  alert("Password updated successfully. Please log in again.");
  navigate("/login");
} catch (err) {
  console.error("Password update failed:", err.response?.data || err);
  setError("Failed to update password. Please try again.");
}
};


  return (
    <div className="new-password-container">
      <div className="new-password-page">
        <h2>Create New Password</h2>
        <div>
          <p className="employee-info"><strong>Employee ID:</strong> {employeeInfo.employeeId}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            required
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm New Password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
          />
          <button type="submit" className="button-mypassword">Update Password</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default NewPassword;
