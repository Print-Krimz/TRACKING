/**
 * Job Detail Page Component
 *
 * Full view of a job requisition with:
 * - Job info (title, department, location, salary, description)
 * - Required skills / criteria
 * - AI-extracted keywords
 * - Recruiter actions (change status, extract keywords, delete)
 * - Candidate action (apply)
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getJobById,
  updateJob,
  deleteJob,
  extractJobKeywords,
  applyToJob,
  getResumes,
} from "../services/api";
import EditJobModal from "../components/EditJobModal";
import "./JobDetail.css";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "#94a3b8" },
  { value: "open", label: "Open", color: "#10b981" },
  { value: "paused", label: "Paused", color: "#f59e0b" },
  { value: "closed", label: "Closed", color: "#ef4444" },
  { value: "filled", label: "Filled", color: "#6366f1" },
];

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Recruiter action states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Candidate apply states
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [applying, setApplying] = useState(false);

  const isRecruiter =
    user?.role_name === "Recruiter" ||
    user?.role_name === "Admin" ||
    user?.role_name === "Control Panel Admin";
  const canApply =
    user?.role_name === "Applicant";

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getJobById(id);
      setJob(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    setError("");
    try {
      const updated = await updateJob(job.id, { status: newStatus });
      setJob(updated);
      setSuccess(`Status updated to ${newStatus}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleExtractKeywords = async () => {
    setExtractingKeywords(true);
    setError("");
    try {
      await extractJobKeywords(job.id);
      await loadJob(); // Refresh to get new keywords
      setSuccess("Keywords extracted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to extract keywords");
    } finally {
      setExtractingKeywords(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJob(job.id);
      navigate("/jobs", {
        state: { success: "Job deleted successfully" },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete job");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleApplyClick = async () => {
    try {
      const data = await getResumes();
      setResumes(data.resumes || []);
      setSelectedResume(data.resumes?.length > 0 ? data.resumes[0].id : null);
    } catch {
      setResumes([]);
    }
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyToJob(job.id, selectedResume);
      setShowApplyModal(false);
      setSuccess("Application submitted successfully!");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit application");
    } finally {
      setApplying(false);
    }
  };

  const formatSalary = (min, max, currency) => {
    if (!min && !max) return null;
    const fmt = (n) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(n);
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max)}`;
  };

  const getStatusInfo = (status) =>
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  if (loading) {
    return (
      <div className="job-detail-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="job-detail-page">
        <div className="error-state">
          <h2>Job Not Found</h2>
          <p>{error}</p>
          <button className="back-btn" onClick={() => navigate("/jobs")}>
            ← Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const statusInfo = getStatusInfo(job.status);
  const salary = formatSalary(
    job.salary_min,
    job.salary_max,
    job.salary_currency,
  );

  return (
    <div className="job-detail-page">
      {/* Back Button */}
      <button className="back-btn" onClick={() => navigate("/jobs")}>
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5M5 12L12 19M5 12L12 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to Jobs
      </button>

      {/* Messages */}
      {success && (
        <div className="success-banner">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>{success}</span>
        </div>
      )}
      {error && job && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="job-detail-layout">
        {/* Left Column — Job Info */}
        <div className="job-detail-main">
          <div className="job-detail-header">
            <div className="header-top">
              <h1>{job.title}</h1>
              <div className="header-actions">
                <span
                  className="status-pill"
                  style={{
                    background: `${statusInfo.color}20`,
                    color: statusInfo.color,
                    borderColor: `${statusInfo.color}40`,
                  }}
                >
                  {statusInfo.label}
                </span>
                {isRecruiter && (
                  <button
                    className="action-btn"
                    onClick={() => setShowEditModal(true)}
                    style={{ marginLeft: "1rem" }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      width="18"
                      height="18"
                      style={{
                        marginRight: "0.25rem",
                        verticalAlign: "text-bottom",
                      }}
                    >
                      <path
                        d="M12 20H21M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5C20.3284 4.32843 20.3284 5.67157 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit Job
                  </button>
                )}
              </div>
            </div>

            <div className="job-detail-meta">
              {job.department && (
                <span className="meta-tag">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 21V5C19 3.89543 18.1046 3 17 3H7C5.89543 3 5 3.89543 5 5V21M3 21H21M9 7H10M9 11H10M14 7H15M14 11H15M9 15H15V21H9V15Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  {job.department}
                </span>
              )}
              {job.location && (
                <span className="meta-tag">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 21C12 21 19 13.5 19 9C19 5.13401 15.866 2 12 2C8.13401 2 5 5.13401 5 9C5 13.5 12 21 12 21Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle
                      cx="12"
                      cy="9"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.employment_type && (
                <span className="meta-tag">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 6V12L16 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  {job.employment_type}
                </span>
              )}
              {salary && (
                <span className="meta-tag salary">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 1V23M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  {salary}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="detail-section">
            <h2>Description</h2>
            <div className="job-description">
              {job.description.split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* Requirements */}
          {job.experience_years || job.education_level ? (
            <div className="detail-section">
              <h2>Requirements</h2>
              <div className="requirements-grid">
                {job.experience_years != null && (
                  <div className="requirement-item">
                    <span className="req-label">Experience</span>
                    <span className="req-value">
                      {job.experience_years}+ years
                    </span>
                  </div>
                )}
                {job.education_level && (
                  <div className="requirement-item">
                    <span className="req-label">Education</span>
                    <span className="req-value">{job.education_level}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Skills & Criteria */}
          {job.criteria?.length > 0 && (
            <div className="detail-section">
              <h2>Skills & Criteria</h2>
              <div className="criteria-list">
                {job.criteria.map((c) => (
                  <div
                    key={c.id}
                    className={`criteria-chip ${c.is_must_have ? "must-have" : "nice-to-have"}`}
                  >
                    <span className="chip-name">{c.skill_name}</span>
                    {c.is_must_have && (
                      <span className="chip-badge">Required</span>
                    )}
                    {c.weight && (
                      <span className="chip-weight">{c.weight}/10</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {job.keywords?.length > 0 && (
            <div className="detail-section">
              <h2>AI-Extracted Keywords</h2>
              <div className="keywords-cloud">
                {job.keywords.map((kw) => (
                  <span key={kw.id} className="keyword-tag">
                    {kw.keyword}
                    {kw.category && (
                      <span className="kw-category">{kw.category}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Actions Sidebar */}
        <div className="job-detail-sidebar">
          {/* Candidate: Apply */}
          {canApply && job.status === "open" && (
            <div className="sidebar-card apply-card">
              <h3>Interested?</h3>
              <p>Submit your application for this position</p>
              <button className="apply-btn-lg" onClick={handleApplyClick}>
                Apply Now
              </button>
            </div>
          )}

          {/* Recruiter: Status Control */}
          {isRecruiter && (
            <div className="sidebar-card">
              <h3>Manage Job</h3>

              <div className="action-group">
                <label>Status</label>
                <div className="status-buttons">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`status-btn ${job.status === opt.value ? "active" : ""}`}
                      style={{
                        "--btn-color": opt.color,
                      }}
                      onClick={() => handleStatusChange(opt.value)}
                      disabled={updatingStatus || job.status === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="action-group">
                <label>AI Tools</label>
                <button
                  className="action-btn extract-btn"
                  onClick={handleExtractKeywords}
                  disabled={extractingKeywords}
                >
                  {extractingKeywords ? (
                    <>
                      <div className="btn-spinner"></div>
                      Extracting...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9.663 17H4.242L2.343 15.107C1.953 14.716 1.953 14.083 2.343 13.693L13.586 2.45C14.367 1.663 15.633 1.663 16.414 2.45L17.586 3.621C18.367 4.408 18.367 5.663 17.586 6.45L6.343 17.693"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M14 6L18 10"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                      Extract Keywords
                    </>
                  )}
                </button>
                <button
                  className="action-btn rank-btn"
                  onClick={() => navigate(`/jobs/${job.id}/ranking`)}
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
                    color: "#fff",
                    border: "none",
                    marginTop: "0.5rem",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Rank Candidates
                </button>
              </div>

              <div className="action-group danger-zone">
                <label>Danger Zone</label>
                {!showDeleteConfirm ? (
                  <button
                    className="action-btn delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 6H5H21M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Delete Job
                  </button>
                ) : (
                  <div className="delete-confirm">
                    <p>Are you sure? This cannot be undone.</p>
                    <div className="confirm-actions">
                      <button
                        className="confirm-yes"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Yes, Delete"}
                      </button>
                      <button
                        className="confirm-no"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Info Card */}
          <div className="sidebar-card info-card">
            <h3>Job Info</h3>
            <div className="info-row">
              <span className="info-label">Posted</span>
              <span className="info-value">
                {new Date(job.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            {job.updated_at && job.updated_at !== job.created_at && (
              <div className="info-row">
                <span className="info-label">Updated</span>
                <span className="info-value">
                  {new Date(job.updated_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Job ID</span>
              <span className="info-value">#{job.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="apply-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Apply to {job.title}</h2>
            <p className="modal-subtitle">
              {job.department && `${job.department} • `}
              {job.location}
            </p>

            {resumes.length > 0 ? (
              <div className="resume-selection">
                <label>Select Resume</label>
                <select
                  value={selectedResume || ""}
                  onChange={(e) =>
                    setSelectedResume(
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      Resume #{r.id} –{" "}
                      {new Date(r.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="no-resume-warning">
                <p>
                  No resume uploaded yet. You can still apply, but a resume is
                  recommended.
                </p>
                <button
                  className="upload-resume-link"
                  onClick={() => navigate("/submit-resume")}
                >
                  Upload Resume
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowApplyModal(false)}
                disabled={applying}
              >
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleApply}
                disabled={applying}
              >
                {applying ? "Applying..." : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && (
        <EditJobModal
          job={job}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            setSuccess("Job updated successfully!");
            loadJob();
            setTimeout(() => setSuccess(""), 4000);
          }}
        />
      )}
    </div>
  );
};

export default JobDetail;
