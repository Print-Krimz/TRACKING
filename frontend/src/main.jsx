/**
 * Application Entry Point
 *
 * This is the main entry point for the React application.
 * It renders the App component into the DOM and sets up providers.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./design-tokens.css";
import "./App.css";

/**
 * React 18 createRoot API for concurrent features
 *
 * The application is wrapped with:
 * - BrowserRouter: Enables client-side routing
 * - AuthProvider: Provides authentication context to all components
 * - ToastProvider: Global toast notification system
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
