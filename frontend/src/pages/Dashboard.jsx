/**
 * Dashboard Page Component
 *
 * Role-based dashboard showing different content based on user role.
 * This is the main landing page after login.
 *
 * Dashboard Content by Role:
 * - Admin: User management stats, system overview
 * - Recruiter: Resume count, pending analyses
 * - Applicant: Resume submission status, quick actions
 *
 * Features:
 * - Access denied notification handling
 * - Quick action buttons based on role
 * - Stats cards
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getResumes, getAllUsers } from "../services/api";
import { useToast } from "../context/ToastContext";
import "./Dashboard.css";

const Dashboard = () => {
  const {
    user,
    isAdmin,
    isControlPanelAdmin,
    isRecruiter,
    isApplicant,
    canAnalyze,
  } = useAuth();
  const location = useLocation();

  // Stats state
  const [stats, setStats] = useState({
    totalResumes: 0,
    pendingAnalysis: 0,
    analyzedResumes: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Check for access denied state from redirect
  useEffect(() => {
    if (location.state?.accessDenied) {
      toast.error("Access denied. You don't have permission to access that page.");
      // Clear the state after showing
      window.history.replaceState({}, document.title);
    }
  }, [location, toast]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch resumes for stats
        const resumeData = await getResumes();

        const analyzed = resumeData.resumes.filter(
          (r) => r.analysis_result,
        ).length;
        const pending = resumeData.resumes.length - analyzed;

        const newStats = {
          totalResumes: resumeData.total,
          pendingAnalysis: pending,
          analyzedResumes: analyzed,
          totalUsers: 0,
        };

        // Fetch user count for admins
        if (isAdmin || isControlPanelAdmin) {
          try {
            const userData = await getAllUsers();
            newStats.totalUsers = userData.total;
          } catch (err) {
            // Ignore - admin might not have this permission initially
          }
        }

        setStats(newStats);
      } catch (err) {
        toast.error("Failed to fetch dashboard stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin, isControlPanelAdmin, toast]);

  // Get role-specific greeting
  const getRoleGreeting = () => {
    if (isAdmin || isControlPanelAdmin) return "Administrator Dashboard";
    if (isRecruiter) return "Recruiter Dashboard";
    return "Applicant Dashboard";
  };

  // Get role-specific welcome message
  const getWelcomeMessage = () => {
    if (isAdmin || isControlPanelAdmin) {
      return "Manage users, roles, and monitor system activity.";
    }
    if (isRecruiter) return "Review resumes and generate AI-powered analyses.";
    return "Submit your resume and track your applications.";
  };

  const roleBadgeClass = (user?.role_name || "applicant")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <div className="dashboard-page">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{getRoleGreeting()}</h1>
          <p className="welcome-message">
            Welcome back,{" "}
            <span className="user-highlight">{user?.username}</span>!{" "}
            {getWelcomeMessage()}
          </p>
        </div>
        <div className="role-badge">
          <span className={`badge badge-${roleBadgeClass}`}>
            {user?.role_name}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Resume Count */}
        <div className="stat-card">
          <div className="stat-icon resumes">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {loading ? "..." : stats.totalResumes}
            </span>
            <span className="stat-label">
              {isApplicant ? "My Resumes" : "Total Resumes"}
            </span>
          </div>
        </div>

        {/* Analyzed Count - Recruiters & Admins */}
        {canAnalyze && (
          <div className="stat-card">
            <div className="stat-icon analyzed">
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
            <div className="stat-content">
              <span className="stat-value">
                {loading ? "..." : stats.analyzedResumes}
              </span>
              <span className="stat-label">Analyzed</span>
            </div>
          </div>
        )}

        {/* Pending Analysis - Recruiters & Admins */}
        {canAnalyze && (
          <div className="stat-card">
            <div className="stat-icon pending">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-value">
                {loading ? "..." : stats.pendingAnalysis}
              </span>
              <span className="stat-label">Pending Analysis</span>
            </div>
          </div>
        )}

        {/* User Count - Admins only */}
        {(isAdmin || isControlPanelAdmin) && (
          <div className="stat-card">
            <div className="stat-icon users">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21M23 21V19C22.9986 17.177 21.765 15.5857 20 15.13M16 3.13C17.7699 3.58317 19.0078 5.17799 19.0078 7.005C19.0078 8.83201 17.7699 10.4268 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-value">
                {loading ? "..." : stats.totalUsers}
              </span>
              <span className="stat-label">Total Users</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          {/* Applicant Actions */}
          {isApplicant && (
            <>
              <Link to="/submit-resume" className="action-card">
                <div className="action-icon submit">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3>Submit Resume</h3>
                <p>Upload your resume for AI analysis</p>
              </Link>
              <Link to="/my-resumes" className="action-card">
                <div className="action-icon view">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M2.45801 12C3.73201 7.943 7.52301 5 12 5C16.478 5 20.268 7.943 21.542 12C20.268 16.057 16.478 19 12 19C7.52301 19 3.73201 16.057 2.45801 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <h3>View My Resumes</h3>
                <p>Check your submitted resumes and analyses</p>
              </Link>
            </>
          )}

          {/* Recruiter Actions */}
          {(isRecruiter || isAdmin || isControlPanelAdmin) && (
            <>
              <Link to="/resumes" className="action-card">
                <div className="action-icon view">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6H20M4 12H20M4 18H20"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h3>View All Resumes</h3>
                <p>Browse and analyze applicant resumes</p>
              </Link>
              <div className="action-card info-card">
                <div className="action-icon analyze">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13 10V3L4 14H11V21L20 10H13Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3>AI Analysis</h3>
                <p>Use Gemini AI to analyze resumes from the resume list</p>
              </div>
            </>
          )}

          {/* Admin Actions */}
          {(isAdmin || isControlPanelAdmin) && (
            <Link to="/admin-control-panel" className="action-card">
              <div className="action-icon users">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4.35418C12.7329 3.52375 13.8053 3 15 3C17.2091 3 19 4.79086 19 7C19 9.20914 17.2091 11 15 11C13.8053 11 12.7329 10.4762 12 9.64582M15 21H3V20C3 16.6863 5.68629 14 9 14C12.3137 14 15 16.6863 15 20V21ZM15 21H21V20C21 16.6863 18.3137 14 15 14C13.9071 14 12.8825 14.2922 12 14.8027M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Admin Control Panel</h3>
              <p>Manage users, roles, jobs, and candidate records</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
