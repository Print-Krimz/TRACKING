/**
 * Job List Page Component
 *
 * Browse open job positions. Candidates can view and apply to jobs.
 * Features:
 * - Job cards with key info
 * - Search/filter functionality
 * - Apply button with resume selection
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getJobs, getResumes, applyToJob } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import "./JobList.css";

const JobList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [applying, setApplying] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadData();
  }, [currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsData, resumesData] = await Promise.all([
        getJobs({ page: currentPage, limit: ITEMS_PER_PAGE }),
        getResumes().catch(() => ({ resumes: [] })),
      ]);
      setJobs(jobsData.jobs || []);
      setTotalPages(jobsData.total_pages || 1);
      setResumes(resumesData.resumes || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
      toast.error(
        err.response?.data?.detail || "Failed to load jobs. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleApplyClick = (job) => {
    setSelectedJob(job);
    setSelectedResume(resumes.length > 0 ? resumes[0].id : null);
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    if (!selectedJob) return;

    setApplying(true);
    try {
      await applyToJob(selectedJob.id, selectedResume);
      toast.success(`Successfully applied to ${selectedJob.title}!`);
      setShowApplyModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const canApply =
    user?.role_name === "Applicant";

  if (loading) {
    return (
      <div className="job-list-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-list-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Open Positions</h1>
          <p>Find your next opportunity</p>
        </div>
        {user?.role_name === "Recruiter" ||
        user?.role_name === "Admin" ||
        user?.role_name === "Control Panel Admin" ? (
          <button
            className="create-job-btn"
            onClick={() => navigate("/jobs/create")}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5V19M5 12H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Create Job
          </button>
        ) : null}
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" className="search-icon">
            <path
              d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search jobs by title, department, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Job Cards */}
      {filteredJobs.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" className="empty-icon">
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
          <h3>No jobs found</h3>
          <p>Check back later for new opportunities</p>
        </div>
      ) : (
        <div className="job-grid">
          {filteredJobs.map((job) => (
            <div key={job.id} className="job-card">
              <div className="job-card-header">
                <div className="job-icon">
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
                <span className={`job-type-badge ${job.employment_type}`}>
                  {job.employment_type}
                </span>
              </div>

              <h3 className="job-title">{job.title}</h3>

              <div className="job-meta">
                {job.department && (
                  <span className="meta-item">
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
                  <span className="meta-item">
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
              </div>

              <div className="job-card-footer">
                <button
                  className="view-btn"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  View Details
                </button>
                {canApply && (
                  <button
                    className="apply-btn"
                    onClick={() => handleApplyClick(job)}
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Apply Modal */}
      {showApplyModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="apply-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Apply to {selectedJob.title}</h2>
            <p className="modal-subtitle">
              {selectedJob.department && `${selectedJob.department} • `}
              {selectedJob.location}
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
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      Resume #{resume.id} -{" "}
                      {new Date(resume.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="no-resume-warning">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <p>
                  No resume uploaded. You can still apply, but uploading a
                  resume is recommended.
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
    </div>
  );
};

export default JobList;
