/**
 * Navbar Component
 *
 * Main navigation bar with role-based menu items.
 * Shows different options based on user's role.
 *
 * Features:
 * - Responsive design with mobile menu
 * - Role-based navigation items
 * - User info display
 * - Logout functionality
 *
 * Navigation Items by Role:
 * - Admin: Dashboard, All Resumes, Users
 * - Recruiter: Dashboard, All Resumes
 * - Applicant: Dashboard, My Resumes, Submit Resume
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Settings } from "lucide-react";
import "./Navbar.css";

const Navbar = () => {
  const {
    user,
    logout,
    isAuthenticated,
    isAdmin,
    isControlPanelAdmin,
    isRecruiter,
    isApplicant,
  } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Handle logout - clears auth state and redirects to login
   */
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  /**
   * Toggle mobile menu visibility
   */
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Don't render navbar on login/register pages when not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/Brand */}
        <Link to="/dashboard" className="navbar-brand">
          <div className="brand-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="brand-text">Resume Analyzer</span>
        </Link>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
          <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}></span>
        </button>

        {/* Navigation Links */}
        <div className={`navbar-menu ${mobileMenuOpen ? "open" : ""}`}>
          <div className="navbar-links">
            {/* Dashboard - All users */}
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>

            {/* Jobs - All users */}
            <Link to="/jobs" className="nav-link">
              Jobs
            </Link>

            {/* Applicant-specific links */}
            {isApplicant && (
              <>
                <Link to="/my-applications" className="nav-link">
                  My Applications
                </Link>
                <Link to="/my-resumes" className="nav-link">
                  My Resumes
                </Link>
                <Link to="/submit-resume" className="nav-link">
                  Submit Resume
                </Link>
              </>
            )}

            {/* Recruiter & Admin links */}
            {(isRecruiter || isAdmin || isControlPanelAdmin) && (
              <>
                <Link to="/recruiter" className="nav-link">
                  Pipeline
                </Link>
                <Link to="/resumes" className="nav-link">
                  All Resumes
                </Link>
                <Link to="/analytics" className="nav-link">
                  Analytics
                </Link>
                <Link to="/reports" className="nav-link">
                  Reports
                </Link>
              </>
            )}

            {/* Admin-only links */}
            {(isAdmin || isControlPanelAdmin) && (
              <Link to="/admin-control-panel" className="nav-link">
                Control Panel
              </Link>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className="navbar-user">
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">{user?.role_name}</span>
            </div>
            <Link to="/settings" className="settings-icon-btn" aria-label="Settings" title="Settings">
              <Settings size={20} />
            </Link>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
