import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

const ProtectedRoute = ({ children, requiredRole, path }) => {
  const { user, loading, hasCompletedPasswordReset } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;

  // If no user is logged in, redirect to login page
  if (!user) return <Navigate to="/" />;

  // Handle role-based access
  if (
    requiredRole &&
    (
      (Array.isArray(requiredRole) && !requiredRole.includes(user.role)) ||
      (!Array.isArray(requiredRole) && user.role !== requiredRole)
    )
  ) {
    return <Navigate to="/forbidden" />;
  }

  // Check if the user has completed password reset and is trying to access /newpassword
  if (path === '/newpassword' && hasCompletedPasswordReset) {
    return <Navigate to="/dashboard" />; // Redirect to dashboard if password has been reset
  }

  return children;
};

export default ProtectedRoute;
