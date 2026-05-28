// src\AuthContext.js
import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Function to log in a user
  const login = (userData) => {
    setUser(userData);
    // Store user data in local storage or session storage
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Function to log out a user
  const logout = () => {
    setUser(null);
    // Clear user data from local storage or session storage
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
