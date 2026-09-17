import React, { createContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const hasCompletedPasswordReset = sessionStorage.getItem('hasCompletedPasswordReset') === 'true';

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded); // Store the user object (including role, employeeId, etc.)
      } catch (err) {
        console.error('Token decoding failed:', err);
        setUser(null);
      }
    }

    // If the user has already reset the password, we ensure that `hasCompletedPasswordReset` is true
    if (hasCompletedPasswordReset) {
      sessionStorage.setItem('hasCompletedPasswordReset', 'true');
    }

    setLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem('token', userData.token);
    sessionStorage.setItem('hasCompletedPasswordReset', !userData.requiresPasswordReset);
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('hasCompletedPasswordReset');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
