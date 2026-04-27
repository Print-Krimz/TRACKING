/**
 * Job Applicants Page Component
 *
 * Shows all applicants for a specific job with:
 * - Applicant name, status, match score, applied date
 * - Resume link for each applicant
 * - Inline status update dropdown
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getJobById,
  getApplications,
  updateApplicationStatus,
  toggleShortlist,
} from "../services/api";
import { CheckCircle2, Users, Star, FileText } from "lucide-react";
import AnonymousName from "../components/AnonymousName";
import ApplicationMessagesPanel from "../components/ApplicationMessagesPanel";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import "./JobApplicants.css";

const STATUS_OPTIONS = [
  { value: "received", label: "Received", color: "#6366f1" },
  { value: "screening", label: "Screening", color: "#f59e0b" },
  { value: "interview", label: "Interview", color: "#8b5cf6" },
  { value: "offer", label: "Offer", color: "#10b981" },
  { value: "hired", label: "Hired", color: "#06b6d4" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
];

const JobApplicants = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeMessagesAppId, setActiveMessagesAppId] = useState(null);
  const [interviewApp, setInterviewApp] = useState(null);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [jobData, appsData] = await Promise.all([
        getJobById(jobId),
        getApplications(jobId),
      ]);
      setJob(jobData);
      setApplicants(appsData.applications || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load applicant data");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId, newStatus) => {
    try {
      const updated = await updateApplicationStatus(appId, newStatus);
      setApplicants((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, status: updated.status } : a,
        ),
      );
      setSuccess("Status updated");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status");
    }
  };

  const handleToggleShortlist = async (appId) => {
    try {
      const updated = await toggleShortlist(appId);
      setApplicants((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, is_shortlisted: updated.is_shortlisted } : a,
        ),
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to toggle shortlist");
    }
  };

  const getStatusColor = (status) => {
    const found = STATUS_OPTIONS.find((s) => s.value === status);
    return found ? found.color : "#94a3b8";
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div className="job-applicants-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading applicants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-applicants-page">
      {/* Back button */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5M5 12L12 19M5 12L12 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>

      {/* Page header */}
      <div className="applicants-header">
        <div className="header-info">
          <h1>Applicants</h1>
          {job && (
            <div className="header-meta">
              <h2>{job.title}</h2>
              <div className="meta-tags">
                {job.department && (
                  <span className="meta-tag">{job.department}</span>
                )}
                {job.location && (
                  <span className="meta-tag">{job.location}</span>
                )}
                <span
                  className="meta-tag status"
                  style={{
                    color: job.status === "open" ? "#34d399" : "#94a3b8",
                  }}
                >
                  {job.status?.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="header-stats">
          <div className="stat-pill">
            <span className="stat-value">{applicants.length}</span>
            <span className="stat-label">Total Applicants</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="success-banner">
          <span><CheckCircle2 size={16} className="inline-icon" /> {success}</span>
        </div>
      )}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Applicant list */}
      {applicants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Users size={48} /></div>
          <h3>No Applicants Yet</h3>
          <p>
            No one has applied to this position yet. Applications will appear
            here once candidates submit them.
          </p>
        </div>
      ) : (
        <div className="applicants-list">
          {/* Table header */}
          <div className="applicant-row header-row">
            <span className="col-name">Applicant</span>
            <span className="col-status">Status</span>
            <span className="col-score">Match Score</span>
            <span className="col-date">Applied</span>
            <span className="col-actions">Actions</span>
          </div>

          {/* Applicant rows */}
          {applicants.map((app) => (
            <div key={app.id} className="applicant-row">
              <div className="col-name">
                <AnonymousName
                  name={app.candidate_name}
                  id={app.candidate_id}
                />
                <span className="applicant-id">ID #{app.candidate_id}</span>
              </div>

              <div className="col-status">
                <select
                  className="status-select"
                  value={app.status}
                  onChange={(e) => handleStatusChange(app.id, e.target.value)}
                  style={{
                    borderColor: getStatusColor(app.status),
                    color: getStatusColor(app.status),
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-score">
                {app.match_score != null ? (
                  <span
                    className="score-badge"
                    style={{
                      backgroundColor: `${getScoreColor(app.match_score)}20`,
                      color: getScoreColor(app.match_score),
                      borderColor: `${getScoreColor(app.match_score)}40`,
                    }}
                  >
                    {app.match_score}%
                  </span>
                ) : (
                  <span className="no-score">—</span>
                )}
              </div>

              <div className="col-date">
                {new Date(app.applied_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>

              <div className="col-actions">
                <button
                  className={`shortlist-btn ${app.is_shortlisted ? "active" : ""}`}
                  onClick={() => handleToggleShortlist(app.id)}
                  title={
                    app.is_shortlisted
                      ? "Remove from shortlist"
                      : "Add to shortlist"
                  }
                >
                  <Star size={18} fill={app.is_shortlisted ? "currentColor" : "none"} />
                </button>
                {app.resume_id ? (
                  <button
                    className="action-link"
                    onClick={() => navigate(`/resumes/${app.resume_id}`)}
                  >
                    <FileText size={16} className="inline-icon" /> View Resume
                  </button>
                ) : (
                  <span className="no-resume">No resume</span>
                )}
                <button
                  className="action-link"
                  onClick={() =>
                    setActiveMessagesAppId((prev) => (prev === app.id ? null : app.id))
                  }
                >
                  {activeMessagesAppId === app.id ? "Hide Messages" : "Messages"}
                </button>
                <button className="action-link" onClick={() => setInterviewApp(app)}>
                  Schedule Interview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeMessagesAppId && (
        <div style={{ marginTop: "16px" }}>
          <ApplicationMessagesPanel applicationId={activeMessagesAppId} />
        </div>
      )}
      {interviewApp && (
        <ScheduleInterviewModal
          application={interviewApp}
          onClose={() => setInterviewApp(null)}
          onScheduled={() => setSuccess("Interview scheduled")}
        />
      )}
    </div>
  );
};

export default JobApplicants;
