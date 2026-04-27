/**
 * Recruiter Dashboard Component
 *
 * Main dashboard for recruiters showing:
 * - Pipeline overview with Kanban-style columns
 * - Key metrics cards
 * - Bulk actions for managing applications
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAnalyticsOverview,
  getApplications,
  getJobs,
  getSkillDistribution,
  getUpcomingInterviews,
  updateApplicationStatus,
} from "../services/api";
import { Users, FileText, DatabaseZap } from "lucide-react";
import ResumeDrawer from "../components/ResumeDrawer";
import "./RecruiterDashboard.css";

const STATUS_COLUMNS = [
  { key: "received", label: "New", color: "#6366f1" },
  { key: "screening", label: "Screening", color: "#f59e0b" },
  { key: "interview", label: "Interview", color: "#8b5cf6" },
  { key: "offer", label: "Offer", color: "#10b981" },
  { key: "deployed", label: "Deployed", color: "#0ea5e9" },
];

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [skillData, setSkillData] = useState([]);
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [drawerApp, setDrawerApp] = useState(null);
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedJobId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const jobIdParam = selectedJobId ? parseInt(selectedJobId) : null;

      const [overviewData, appsData, jobsData, skillsData] =
        await Promise.all([
          getAnalyticsOverview(jobIdParam).catch(() => null),
          getApplications(jobIdParam),
          getJobs(),
          getSkillDistribution(jobIdParam).catch(() => ({ skills: [] })),
        ]);
      const upcomingData = await getUpcomingInterviews().catch(() => ({ interviews: [] }));
      setOverview(overviewData);
      setApplications(appsData.applications || []);
      setJobs(jobsData.jobs || []);
      setSkillData(skillsData.skills || []);
      setUpcomingInterviews(upcomingData.interviews || []);
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleCardStatusChange = async (app, newStatus) => {
    if (app.status === newStatus) return;
    setUpdatingAppId(app.id);
    try {
      await updateApplicationStatus(app.id, newStatus);
      setApplications((prevApps) =>
        prevApps.map((a) =>
          a.id === app.id ? { ...a, status: newStatus } : a,
        ),
      );
      const newOverview = await getAnalyticsOverview().catch(() => null);
      if (newOverview) setOverview(newOverview);
    } catch (err) {
      setError("Failed to update application status");
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleDrawerStatusChange = async (app, newStatus) => {
    // Optimistically update the drawer state to feel instant
    setDrawerApp((prev) => (prev ? { ...prev, status: newStatus } : null));
    await handleCardStatusChange(app, newStatus);
  };

  const toggleAppSelection = (appId) => {
    setSelectedAppIds((prev) =>
      prev.includes(appId)
        ? prev.filter((id) => id !== appId)
        : [...prev, appId],
    );
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedAppIds.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await Promise.all(
        selectedAppIds.map((appId) =>
          updateApplicationStatus(appId, newStatus),
        ),
      );

      // Optimistically update local state
      setApplications((prevApps) =>
        prevApps.map((a) =>
          selectedAppIds.includes(a.id) ? { ...a, status: newStatus } : a,
        ),
      );

      setSelectedAppIds([]);

      const newOverview = await getAnalyticsOverview().catch(() => null);
      if (newOverview) setOverview(newOverview);
    } catch (err) {
      setError(
        "Failed to batch update application statuses. Some updates may have failed.",
      );
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getApplicationsByStatus = (status) => {
    return applications.filter((app) => app.status === status);
  };

  if (loading) {
    return (
      <div className="recruiter-dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recruiter-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard</h1>
          <p>
            {selectedJobId
              ? `Viewing metrics for: ${jobs.find((j) => j.id === parseInt(selectedJobId))?.title || "Unknown Job"}`
              : "Manage your hiring pipeline"}
          </p>
        </div>
        <div className="header-actions">
          <div className="global-filter">
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="job-filter-select"
            >
              <option value="">All Jobs</option>
              {jobs
                .filter((j) => j.status === "open")
                .map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
            </select>
          </div>
          <button
            className="view-applicants-btn"
            onClick={() => navigate("/applicants")}
          >
            <Users size={16} className="inline-icon"/> View All Applicants
          </button>
          <button
            className="view-applicants-btn"
            onClick={() => navigate("/talent-pool")}
          >
            <DatabaseZap size={16} className="inline-icon"/> Talent Pool
          </button>
          <button
            className="create-job-btn"
            onClick={() => navigate("/jobs/create")}
          >
            + Post New Job
          </button>
        </div>
      </div>



      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon open-jobs">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="metric-content">
            <span className="metric-value">
              {overview?.open_jobs ??
                jobs.filter((j) => j.status === "open").length}
            </span>
            <span className="metric-label">Open Jobs</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon total-apps">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M16 4H8C6.89543 4 6 4.89543 6 6V20C6 21.1046 6.89543 22 8 22H16C17.1046 22 18 21.1046 18 20V6C18 4.89543 17.1046 4 16 4Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 9H15M9 13H15M9 17H12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="metric-content">
            <span className="metric-value">
              {overview?.total_applications || 0}
            </span>
            <span className="metric-label">Total Applications</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon recent">
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
          </div>
          <div className="metric-content">
            <span className="metric-value">
              {overview?.recent_applications || 0}
            </span>
            <span className="metric-label">This Week</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon interview">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="9"
                cy="7"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M23 21V19C22.9986 17.1771 21.765 15.5857 20 15.13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M16 3.13C17.7699 3.58395 19.0078 5.17834 19.0078 7.005C19.0078 8.83166 17.7699 10.4261 16 10.88"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="metric-content">
            <span className="metric-value">
              {overview?.applications_by_status?.interview || 0}
            </span>
            <span className="metric-label">In Interview</span>
          </div>
        </div>
      </div>
      <div className="pipeline-section" style={{ marginTop: "20px" }}>
        <h2>Upcoming Interviews</h2>
        {upcomingInterviews.length === 0 ? (
          <p className="pipeline-hint">No upcoming interviews.</p>
        ) : (
          <div className="kanban-board">
            {upcomingInterviews.slice(0, 6).map((interview) => (
              <div key={interview.id} className="kanban-card">
                <div className="card-title">Application #{interview.application_id}</div>
                <div className="card-meta">
                  {new Date(interview.scheduled_start_at).toLocaleString()}
                </div>
                <div className="card-job">
                  {interview.mode} • {interview.status.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kanban Pipeline */}
      <div className="pipeline-section">
        <h2>Hiring Pipeline</h2>
        <p className="pipeline-hint">
          Use the dropdown on each card to change status
        </p>

        <div className="kanban-board">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.key} className="kanban-column">
              <div
                className="column-header"
                style={{ borderColor: column.color }}
              >
                <span className="column-title">{column.label}</span>
                <span
                  className="column-count"
                  style={{ backgroundColor: column.color }}
                >
                  {getApplicationsByStatus(column.key).length}
                </span>
              </div>
              <div className="column-content">
                {getApplicationsByStatus(column.key).map((app) => (
                  <div
                    key={app.id}
                    className={`kanban-card ${selectedAppIds.includes(app.id) ? "selected" : ""}`}
                  >
                    <div className="card-header-row">
                      <div className="card-title">{app.candidate_name}</div>
                      <input
                        type="checkbox"
                        className="card-checkbox"
                        checked={selectedAppIds.includes(app.id)}
                        onChange={() => toggleAppSelection(app.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="card-job">{app.job_title}</div>
                    <div className="card-meta">
                      {new Date(app.applied_at).toLocaleDateString()}
                      {app.match_score && (
                        <span className="match-score">{app.match_score}%</span>
                      )}
                    </div>
                    <select
                      className="card-status-select"
                      value={app.status}
                      onChange={(e) =>
                        handleCardStatusChange(app, e.target.value)
                      }
                      disabled={updatingAppId === app.id}
                      style={{ borderColor: column.color }}
                    >
                      {STATUS_COLUMNS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    {app.resume_id && (
                      <button
                        className="card-resume-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerApp(app);
                        }}
                      >
                        <FileText size={16} className="inline-icon"/> View Resume
                      </button>
                    )}
                  </div>
                ))}
                {getApplicationsByStatus(column.key).length === 0 && (
                  <div className="empty-column">
                    {column.key === "new"
                      ? "No new applications yet"
                      : `No candidates in ${column.label.toLowerCase()}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedAppIds.length > 0 && (
        <div className="bulk-action-bar">
          <div className="bulk-action-info">
            <span className="bulk-count">
              {selectedAppIds.length} candidates selected
            </span>
          </div>
          <div className="bulk-action-controls">
            <span className="bulk-action-label">Move selected to:</span>
            <select
              className="bulk-status-select"
              defaultValue=""
              onChange={(e) =>
                e.target.value && handleBulkStatusChange(e.target.value)
              }
              disabled={isBulkUpdating}
            >
              <option value="" disabled>
                Select Status...
              </option>
              {STATUS_COLUMNS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="bulk-cancel-btn"
              onClick={() => setSelectedAppIds([])}
              disabled={isBulkUpdating}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ResumeDrawer
        isOpen={!!drawerApp}
        onClose={() => setDrawerApp(null)}
        application={drawerApp}
        onStatusChange={handleDrawerStatusChange}
      />
    </div>
  );
};

export default RecruiterDashboard;
