/**
 * All Applicants Page
 *
 * Central view for recruiters showing every applicant across all jobs.
 * Features: search by name, filter by job & status, sortable columns,
 * inline status updates, and clear job-applicant relationships.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getApplications,
  getJobs,
  saveToTalentPool,
  updateApplicationStatus,
  toggleShortlist,
} from "../services/api";
import AnonymousName from "../components/AnonymousName";
import DocumentViewerModal from "../components/DocumentViewerModal";
import {
  CheckCircle2,
  Star,
  Search,
  FileText,
  Archive,
  ExternalLink,
  Users,
  FolderPlus,
  DatabaseZap,
} from "lucide-react";
import "./AllApplicants.css";

const STATUS_OPTIONS = [
  { value: "received", label: "Received", color: "#6366f1" },
  { value: "screening", label: "Screening", color: "#f59e0b" },
  { value: "interview", label: "Interview", color: "#8b5cf6" },
  { value: "offer", label: "Offer", color: "#10b981" },
  { value: "hired", label: "Hired", color: "#06b6d4" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
];

const SORT_OPTIONS = [
  { value: "applied_desc", label: "Newest First" },
  { value: "applied_asc", label: "Oldest First" },
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "score_desc", label: "Highest Score" },
  { value: "job_asc", label: "Job Title A→Z" },
];

const AllApplicants = () => {
  const navigate = useNavigate();
  const { jobId: routeJobId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Vault Modal State
  const [vaultModalUser, setVaultModalUser] = useState(null);
  const [vaultModalName, setVaultModalName] = useState("");

  // Filters from URL params for shareable state
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [jobFilter, setJobFilter] = useState(
    searchParams.get("job") || routeJobId || "all",
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all",
  );
  const [sortBy, setSortBy] = useState(
    searchParams.get("sort") || "applied_desc",
  );
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadData();
  }, [currentPage]);

  useEffect(() => {
    if (routeJobId && !searchParams.get("job")) {
      setJobFilter(routeJobId);
    }
  }, [routeJobId, searchParams]);

  // Sync filters to URL
  useEffect(() => {
    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (jobFilter !== "all") params.job = jobFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (sortBy !== "applied_desc") params.sort = sortBy;
    setSearchParams(params, { replace: true });
  }, [searchTerm, jobFilter, statusFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appsData, jobsData] = await Promise.all([
        getApplications(null, { page: currentPage, limit: ITEMS_PER_PAGE }),
        getJobs({ limit: 100 }), // Backend max limit is 100
      ]);
      setApplications(appsData.applications || []);
      setTotalPages(appsData.total_pages || 1);
      setJobs(jobsData.jobs || []);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' 
        ? detail 
        : (Array.isArray(detail) ? detail[0]?.msg : "Failed to load data");
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Filtered + sorted applications
  const filteredApps = useMemo(() => {
    let result = [...applications];

    // Search by name or job title
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          (a.candidate_name || "").toLowerCase().includes(q) ||
          (a.job_title || "").toLowerCase().includes(q),
      );
    }

    // Filter by job
    if (jobFilter !== "all") {
      result = result.filter((a) => String(a.job_id) === jobFilter);
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Filter by shortlisted
    if (shortlistedOnly) {
      result = result.filter((a) => a.is_shortlisted);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "applied_asc":
          return new Date(a.applied_at) - new Date(b.applied_at);
        case "applied_desc":
          return new Date(b.applied_at) - new Date(a.applied_at);
        case "name_asc":
          return (a.candidate_name || "").localeCompare(b.candidate_name || "");
        case "name_desc":
          return (b.candidate_name || "").localeCompare(a.candidate_name || "");
        case "score_desc":
          return (b.match_score || 0) - (a.match_score || 0);
        case "job_asc":
          return (a.job_title || "").localeCompare(b.job_title || "");
        default:
          return 0;
      }
    });

    return result;
  }, [
    applications,
    searchTerm,
    jobFilter,
    statusFilter,
    sortBy,
    shortlistedOnly,
  ]);

  const handleStatusChange = async (appId, newStatus) => {
    try {
      const updated = await updateApplicationStatus(appId, newStatus);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? {
                ...a,
                status: updated.status,
                in_talent_pool: updated.in_talent_pool,
              }
            : a,
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
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, is_shortlisted: updated.is_shortlisted } : a,
        ),
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to toggle shortlist");
    }
  };

  const handleSaveToTalentPool = async (application) => {
    try {
      const response = await saveToTalentPool(application.id);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === application.id ? { ...item, in_talent_pool: true } : item,
        ),
      );
      setSuccess(
        response.created
          ? "Candidate saved to talent pool"
          : "Candidate is already in the talent pool",
      );
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save candidate to talent pool");
    }
  };

  const getStatusColor = (status) => {
    const found = STATUS_OPTIONS.find((s) => s.value === status);
    return found ? found.color : "#94a3b8";
  };

  const getScoreLevel = (score) => {
    if (score >= 80)
      return { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "Strong" };
    if (score >= 60)
      return { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Good" };
    if (score >= 40)
      return { color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "Fair" };
    return { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Low" };
  };

  const clearFilters = () => {
    setSearchTerm("");
    setJobFilter("all");
    setStatusFilter("all");
    setSortBy("applied_desc");
    setShortlistedOnly(false);
  };

  const hasActiveFilters =
    searchTerm ||
    jobFilter !== "all" ||
    statusFilter !== "all" ||
    sortBy !== "applied_desc" ||
    shortlistedOnly;

  // Unique jobs from applications for the filter dropdown
  const jobOptions = useMemo(() => {
    const seen = new Map();
    applications.forEach((a) => {
      if (a.job_id && a.job_title && !seen.has(a.job_id)) {
        seen.set(a.job_id, a.job_title);
      }
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  if (loading) {
    return (
      <div className="all-applicants-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading applicants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="all-applicants-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate("/recruiter")}>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Dashboard
          </button>
          <h1>All Applicants</h1>
          <p className="subtitle">
            Showing {filteredApps.length} of {applications.length} applicant
            {applications.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="talent-pool-link-btn"
            onClick={() => navigate("/talent-pool")}
          >
            <DatabaseZap size={16} className="inline-icon" /> Talent Pool
          </button>
        </div>
      </div>

      {/* Messages */}
      {success && <div className="success-banner"><CheckCircle2 size={16} className="inline-icon" /> {success}</div>}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Toolbar: Search + Filters + Sort */}
      <div className="toolbar">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none">
            <circle
              cx="11"
              cy="11"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M21 21L16.65 16.65"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm("")}>
              ×
            </button>
          )}
        </div>

        <div className="filter-group">
          <label>Job:</label>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Jobs</option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <button
          className={`shortlist-filter-btn ${shortlistedOnly ? "active" : ""}`}
          onClick={() => setShortlistedOnly(!shortlistedOnly)}
          title="Show only shortlisted candidates"
        >
          <><Star size={16} fill={shortlistedOnly ? "currentColor" : "none"} className="inline-icon" /> Shortlisted</>
        </button>

        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All
          </button>
        )}
      </div>

      {/* Results */}
      {filteredApps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Search size={48} /></div>
          <h3>
            {applications.length === 0 ? "No Applicants Yet" : "No Matches"}
          </h3>
          <p>
            {applications.length === 0
              ? "Applications will appear here once candidates apply to your jobs."
              : "Try adjusting your search or filters to find applicants."}
          </p>
          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="applicants-table">
          {/* Table header */}
          <div className="table-row table-header">
            <span className="col-applicant">Applicant</span>
            <span className="col-job">Job Applied To</span>
            <span className="col-status">Status</span>
            <span className="col-score">Score</span>
            <span className="col-date">Applied</span>
            <span className="col-actions">Actions</span>
          </div>

          {/* Rows */}
          {filteredApps.map((app) => (
            <div key={app.id} className="table-row">
              {/* Applicant */}
              <div className="col-applicant">
                <AnonymousName
                  name={app.candidate_name}
                  id={app.candidate_id}
                />
                <span className="id-tag">ID #{app.candidate_id}</span>
              </div>

              {/* Job Applied To — prominent display */}
              <div className="col-job">
                <div
                  className="job-pill"
                  onClick={() => navigate(`/jobs/${app.job_id}`)}
                  title={`View ${app.job_title}`}
                >
                  <svg className="job-icon" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 7H4C2.9 7 2 7.9 2 9V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V9C22 7.9 21.1 7 20 7Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M16 7V5C16 3.9 15.1 3 14 3H10C8.9 3 8 3.9 8 5V7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="job-name">
                    {app.job_title || "Unknown Job"}
                  </span>
                </div>
              </div>

              {/* Status */}
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

              {/* Score */}
              <div className="col-score">
                {app.match_score != null ? (
                  (() => {
                    const level = getScoreLevel(app.match_score);
                    return (
                      <div className="score-cell">
                        <span
                          className="score-badge"
                          style={{
                            backgroundColor: level.bg,
                            color: level.color,
                            borderColor: `${level.color}40`,
                          }}
                        >
                          {app.match_score}%
                        </span>
                        <span
                          className="score-label"
                          style={{ color: level.color }}
                        >
                          {level.label}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <span className="no-score">—</span>
                )}
              </div>

              {/* Date */}
              <div className="col-date">
                <span className="date-text">
                  {new Date(app.applied_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {/* Actions */}
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
                <button
                  className={`action-btn ${app.in_talent_pool ? "is-active" : ""}`}
                  onClick={() => handleSaveToTalentPool(app)}
                  title={
                    app.in_talent_pool
                      ? "Already saved to talent pool"
                      : app.status === "rejected"
                        ? "Save candidate to talent pool"
                        : "Set status to Rejected before saving to talent pool"
                  }
                  disabled={app.in_talent_pool || app.status !== "rejected"}
                >
                  <FolderPlus size={18} />
                </button>
                {app.resume_id && (
                  <button
                    className="action-btn"
                    onClick={() => navigate(`/resumes/${app.resume_id}`)}
                    title="View Resume"
                  >
                    <FileText size={18} />
                  </button>
                )}
                {app.candidate_id && (
                  <button
                    className="action-btn"
                    onClick={() => {
                      setVaultModalUser(app.candidate_id);
                      setVaultModalName(app.candidate_name);
                    }}
                    title="View 201 File (Vault)"
                  >
                    <Archive size={18} />
                  </button>
                )}
                <button
                  className="action-btn"
                  onClick={() => navigate(`/jobs/${app.job_id}`)}
                  title="View Job"
                >
                  <ExternalLink size={18} />
                </button>
                <button
                  className="action-btn"
                  onClick={() => navigate(`/jobs/${app.job_id}/applicants`)}
                  title="All Applicants for This Job"
                >
                  <Users size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="server-pagination">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-page"
              >
                Previous
              </button>
              <span className="page-info">Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-page"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {vaultModalUser && (
        <DocumentViewerModal 
          userId={vaultModalUser}
          candidateName={vaultModalName}
          onClose={() => {
            setVaultModalUser(null);
            setVaultModalName("");
          }}
        />
      )}
    </div>
  );
};

export default AllApplicants;
