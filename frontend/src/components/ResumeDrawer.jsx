import React, { useState, useEffect } from "react";
import { getResumeById } from "../services/api";
import { Star } from "lucide-react";
import "./ResumeDrawer.css";

const STATUS_COLUMNS = [
  { key: "received", label: "New" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
];

const ResumeDrawer = ({
  isOpen,
  onClose,
  application,
  onStatusChange,
  onShortlistToggle,
}) => {
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && application?.resume_id) {
      loadResume(application.resume_id);
    } else {
      setResumeData(null);
    }
  }, [isOpen, application]);

  const loadResume = async (resumeId) => {
    try {
      setLoading(true);
      setError("");
      const data = await getResumeById(resumeId);
      setResumeData(data);
    } catch (err) {
      console.error("Failed to load resume:", err);
      setError("Failed to load resume details.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <div className={`resume-drawer ${isOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-header-content">
            <h2>{application?.candidate_name}</h2>
            <p className="drawer-subtitle">
              Applied for: <strong>{application?.job_title}</strong>
            </p>
          </div>
          <button className="close-drawer-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="drawer-actions">
          <div className="drawer-score-box">
            <span className="drawer-score-label">AI Match Score</span>
            <span className="drawer-score-value">
              {application?.match_score ? `${application.match_score}%` : "N/A"}
            </span>
          </div>

          <button
            className={`drawer-shortlist-btn ${application?.is_shortlisted ? "active" : ""}`}
            onClick={() => onShortlistToggle && onShortlistToggle(application)}
            title={
              application?.is_shortlisted
                ? "Remove from shortlist"
                : "Add to shortlist"
            }
          >
            <><Star size={16} fill={application?.is_shortlisted ? "currentColor" : "none"} className="inline-icon" /> {application?.is_shortlisted ? "Shortlisted" : "Shortlist"}</>
          </button>

          <div className="drawer-status-box">
            <label>Update Status</label>
            <select
              className="drawer-status-select"
              value={application?.status || "received"}
              onChange={(e) => onStatusChange(application, e.target.value)}
            >
              {STATUS_COLUMNS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="drawer-content">
          <h3>Resume Content</h3>
          {loading ? (
            <div className="drawer-loading">
              <div className="drawer-spinner"></div>
              <p>Loading resume...</p>
            </div>
          ) : error ? (
            <div className="drawer-error">{error}</div>
          ) : resumeData?.content ? (
            <div className="resume-text-view">
              <pre>{resumeData.content}</pre>
            </div>
          ) : (
            <div className="drawer-empty-state">
              No resume text content available.
            </div>
          )}
        </div>

        {resumeData?.ai_analysis && (
          <div className="drawer-analysis">
            <h3>AI Analysis Insights</h3>
            <div className="analysis-box">
              <pre>{JSON.stringify(resumeData.ai_analysis, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ResumeDrawer;
