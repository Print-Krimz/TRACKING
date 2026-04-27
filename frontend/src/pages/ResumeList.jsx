/**
 * Resume List Page Component
 *
 * Displays resumes based on user role:
 * - Applicants see only their own resumes (used for 'My Resumes')
 * - Recruiters/Admins see all resumes
 *
 * Features:
 * - Resume card grid
 * - Search and filter
 * - Click to view details
 * - Analysis status indicator
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getResumes } from "../services/api";
import Loading from "../components/Loading";
import AnonymousName from "../components/AnonymousName";
import ResumeUpload from "../components/ResumeUpload";
import { useToast } from "../context/ToastContext";
import { anonymizeContent } from "../utils/anonymize";
import { deleteResume } from "../services/api";
import "./ResumeList.css";

const ResumeList = () => {
  const { canAnalyze, isApplicant } = useAuth();
  const { toast } = useToast();

  // State
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUpload, setShowUpload] = useState(false);

  // Fetch resumes
  const fetchResumes = async () => {
    try {
      setLoading(true);
      const data = await getResumes();
      setResumes(data.resumes);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleDelete = async (e, resumeId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this resume?")) return;
    
    try {
      await deleteResume(resumeId);
      toast.success("Resume deleted successfully");
      fetchResumes();
    } catch (err) {
      toast.error("Failed to delete resume");
    }
  };

  // Filter and search resumes
  const filteredResumes = resumes.filter((resume) => {
    // Search filter
    const matchesSearch =
      resume.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resume.content.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (filterStatus === "analyzed") {
      matchesStatus = !!resume.analysis_result;
    } else if (filterStatus === "pending") {
      matchesStatus = !resume.analysis_result;
    }

    return matchesSearch && matchesStatus;
  });

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Truncate content for preview
  const truncateContent = (content, maxLength = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  if (loading) {
    return <Loading message="Loading resumes..." />;
  }

  return (
    <div className="resume-list-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>{isApplicant ? "My Resumes" : "All Resumes"}</h1>
          {isApplicant && (
            <button 
              className="upload-toggle-btn"
              onClick={() => setShowUpload(!showUpload)}
            >
              {showUpload ? "Cancel Upload" : "Submit New Resume"}
            </button>
          )}
          <p>
            {isApplicant
              ? "View and manage your submitted resumes"
              : "Browse and analyze applicant resumes"}
          </p>
        </div>
        {isApplicant && !showUpload && (
          <button onClick={() => setShowUpload(true)} className="add-resume-btn">
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
            Submit New Resume
          </button>
        )}
      </div>

      {showUpload && (
        <div className="upload-container">
          <ResumeUpload 
            onSuccess={() => {
              setShowUpload(false);
              fetchResumes();
            }} 
            onCancel={() => setShowUpload(false)} 
          />
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search resumes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {canAnalyze && (
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
              onClick={() => setFilterStatus("all")}
            >
              All ({resumes.length})
            </button>
            <button
              className={`filter-btn ${filterStatus === "analyzed" ? "active" : ""}`}
              onClick={() => setFilterStatus("analyzed")}
            >
              Analyzed ({resumes.filter((r) => r.analysis_result).length})
            </button>
            <button
              className={`filter-btn ${filterStatus === "pending" ? "active" : ""}`}
              onClick={() => setFilterStatus("pending")}
            >
              Pending ({resumes.filter((r) => !r.analysis_result).length})
            </button>
          </div>
        )}
      </div>

      {showUpload && isApplicant && (
        <div className="upload-section-container">
          <ResumeUpload 
            onSuccess={() => {
              setShowUpload(false);
              fetchResumes();
            }} 
            onCancel={() => setShowUpload(false)} 
          />
        </div>
      )}

      {/* Resume Grid */}
      {filteredResumes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
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
          <h3>No resumes found</h3>
          <p>
            {searchTerm || filterStatus !== "all"
              ? "Try adjusting your search or filter"
              : isApplicant
                ? "Submit your first resume to get started"
                : "No resumes have been submitted yet"}
          </p>
          {isApplicant && !searchTerm && filterStatus === "all" && !showUpload && (
            <button onClick={() => setShowUpload(true)} className="empty-action-btn">
              Submit Your Resume
            </button>
          )}
        </div>
      ) : (
        <div className="resume-grid">
          {filteredResumes.map((resume) => {
            // Try to extract a score from the analysis result
            let score = null;
            if (resume.analysis_result) {
              try {
                const analysis =
                  typeof resume.analysis_result === "string"
                    ? JSON.parse(resume.analysis_result)
                    : resume.analysis_result;
                score =
                  analysis.score ??
                  analysis.overall_score ??
                  analysis.rating ??
                  null;
              } catch {
                // analysis_result isn't JSON, that's okay
              }
            }

            const getScoreColor = (s) => {
              if (s >= 8) return "#10b981";
              if (s >= 6) return "#f59e0b";
              return "#ef4444";
            };

            return (
              <Link
                to={`/resumes/${resume.id}`}
                key={resume.id}
                className="resume-card"
              >
                <div className="resume-card-header">
                  <div className="resume-meta">
                    <span className="resume-author">
                      {!isApplicant && resume.username ? (
                        <AnonymousName
                          name={resume.username}
                          id={resume.id}
                          showAvatar={false}
                        />
                      ) : (
                        `Resume #${resume.id}`
                      )}
                    </span>
                    <span className="resume-date">
                      Submitted {formatDate(resume.created_at)}
                    </span>
                  </div>
                  {resume.analysis_result ? (
                    score !== null ? (
                      <span
                        className="score-badge"
                        style={{
                          background: `${getScoreColor(score)}20`,
                          color: getScoreColor(score),
                          borderColor: `${getScoreColor(score)}40`,
                        }}
                      >
                        {score}/10
                      </span>
                    ) : (
                      <span className="status-badge analyzed">Analyzed</span>
                    )
                  ) : (
                    <span className="status-badge pending">Pending</span>
                  )}
                </div>

                <div className="resume-preview">
                  {truncateContent(
                    !isApplicant
                      ? anonymizeContent(resume.content)
                      : resume.content,
                    120,
                  )}
                </div>

                <div className="resume-card-footer">
                  <span className="view-link">
                    {resume.analysis_result
                      ? "View Analysis"
                      : canAnalyze
                        ? "Analyze Resume"
                        : "View Details"}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 5L16 12L9 19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {isApplicant && (
                    <button 
                      className="delete-card-btn"
                      onClick={(e) => handleDelete(e, resume.id)}
                      title="Delete Resume"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResumeList;
