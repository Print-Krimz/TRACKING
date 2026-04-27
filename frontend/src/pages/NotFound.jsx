/**
 * NotFound (404) Page
 *
 * Displayed when a user navigates to a nonexistent route.
 * Provides a clear message and a link back to the dashboard.
 */

import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "2rem",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          fontSize: "5rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          marginBottom: "0.5rem",
        }}
      >
        404
      </div>
      <h2
        style={{
          color: "#e2e8f0",
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        Page Not Found
      </h2>
      <p
        style={{
          color: "#94a3b8",
          fontSize: "1rem",
          maxWidth: "400px",
          marginBottom: "1.5rem",
          lineHeight: 1.6,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.65rem 1.25rem",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "0.9rem",
          textDecoration: "none",
          transition: "opacity 0.2s ease",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          style={{ width: 18, height: 18 }}
        >
          <path
            d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Go to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
