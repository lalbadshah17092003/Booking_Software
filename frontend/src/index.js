import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import { ThemeProvider } from './context/TheamContext';
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./authConfig";

const root = ReactDOM.createRoot(document.getElementById('root'));
const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

if (!isSecureContext) {
  console.warn("⚠️ Warning: MSAL requires HTTPS for full functionality. Some features may not work properly.");
}

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <MsalProvider instance={msalInstance}>
            <App />
          </MsalProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
reportWebVitals();
