/**
 * My Applications Page Component
 *
 * Candidate dashboard showing application status timeline.
 * Features:
 * - Visual status tracker
 * - Application history
 * - Status updates
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyApplications } from "../services/api";
import { Inbox, Search, MessageSquare, ClipboardList, Award, MapPin, XCircle, Undo2 } from "lucide-react";
import "./MyApplications.css";

// Application status stages for timeline
const STATUS_STAGES = [
  { key: "received", label: "Received", icon: <Inbox size={18} /> },
  { key: "screening", label: "Screening", icon: <Search size={18} /> },
  { key: "interview", label: "Interview", icon: <MessageSquare size={18} /> },
  { key: "offer", label: "Offer", icon: <ClipboardList size={18} /> },
  { key: "hired", label: "Hired", icon: <Award size={18} /> },
];

const STATUS_COLORS = {
  received: "#6366f1",
  screening: "#f59e0b",
  interview: "#8b5cf6",
  offer: "#10b981",
  hired: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#64748b",
};

const MyApplications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getMyApplications();
      setApplications(data.applications || []);
    } catch (err) {
      console.error("Failed to load applications:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to load applications. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status) => {
    return STATUS_STAGES.findIndex((s) => s.key === status);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeSince = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="my-applications-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-applications-page">
      <div className="page-header">
        <div className="header-content">
          <h1>My Applications</h1>
          <p>Track the status of your job applications</p>
        </div>
        <button className="browse-jobs-btn" onClick={() => navigate("/jobs")}>
          Browse Jobs
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ClipboardList size={48} /></div>
          <h3>No applications yet</h3>
          <p>Start applying to jobs to track your progress here</p>
          <button className="browse-btn" onClick={() => navigate("/jobs")}>
            Browse Open Positions
          </button>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map((app) => {
            const statusIndex = getStatusIndex(app.status);
            const isTerminal =
              app.status === "hired" ||
              app.status === "rejected" ||
              app.status === "withdrawn";

            return (
              <div key={app.id} className={`application-card ${app.status}`}>
                <div className="application-header">
                  <div className="job-info">
                    <h3>{app.job_title}</h3>
                    <div className="job-meta">
                      {app.company_department && (
                        <span className="department">
                          {app.company_department}
                        </span>
                      )}
                      {app.location && (
                        <span className="location"><MapPin size={14} className="inline-icon" /> {app.location}</span>
                      )}
                    </div>
                  </div>
                  <div className="application-timing">
                    <span className="applied-date">
                      Applied {getTimeSince(app.applied_at)}
                    </span>
                    <span className={`status-badge ${app.status}`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Status Timeline */}
                {!isTerminal || app.status === "hired" ? (
                  <div className="status-timeline">
                    {STATUS_STAGES.map((stage, index) => {
                      const isCompleted = index <= statusIndex;
                      const isCurrent = index === statusIndex;

                      return (
                        <div
                          key={stage.key}
                          className={`timeline-step ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                        >
                          <div
                            className="step-dot"
                            style={
                              isCompleted
                                ? { backgroundColor: STATUS_COLORS[stage.key] }
                                : {}
                            }
                          >
                            {isCompleted ? stage.icon : index + 1}
                          </div>
                          <span className="step-label">{stage.label}</span>
                          {index < STATUS_STAGES.length - 1 && (
                            <div
                              className={`step-line ${isCompleted && index < statusIndex ? "completed" : ""}`}
                            ></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`terminal-status ${app.status}`}>
                    <span className="terminal-icon">
                      {app.status === "rejected" ? <XCircle size={24} /> : <Undo2 size={24} />}
                    </span>
                    <span className="terminal-text">
                      {app.status === "rejected"
                        ? "Application not selected to move forward"
                        : "Application withdrawn"}
                    </span>
                  </div>
                )}

                <div className="application-footer">
                  <span className="last-updated">
                    Last updated: {formatDate(app.updated_at)}
                  </span>
                  <button
                    className="view-job-btn"
                    onClick={() => navigate(`/jobs/${app.job_id}`)}
                  >
                    View Job Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyApplications;
