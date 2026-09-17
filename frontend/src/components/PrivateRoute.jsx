import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

const ProtectedRoute = ({ children, requiredRole, path }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
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

  // Check if the user has completed the password reset and is trying to access /newpassword
  const hasCompletedPasswordReset = sessionStorage.getItem('hasCompletedPasswordReset') === 'true';
  if (path === '/newpassword' && hasCompletedPasswordReset) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default ProtectedRoute;
