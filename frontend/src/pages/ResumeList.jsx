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
import {
  Button,
  EmptyState,
  FilterBar,
  SearchBar,
  StatusBadge,
} from "../components/ui";
import { ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
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
      <div className="page-header">
        <div className="header-content">
          <h1>{isApplicant ? "My Resumes" : "All Resumes"}</h1>
          <p>
            {isApplicant
              ? "View and manage your submitted resumes"
              : "Browse and analyze applicant resumes"}
          </p>
        </div>
        {isApplicant && (
          <Button
            icon={showUpload ? undefined : Plus}
            variant={showUpload ? "secondary" : "success"}
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? "Cancel upload" : "Submit new resume"}
          </Button>
        )}
      </div>

      {showUpload && (
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

      <FilterBar
        className="filters-bar"
        search={
          <SearchBar
            placeholder="Search resumes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        }
        filters={canAnalyze && (
          <div className="filter-buttons" aria-label="Resume status filters">
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
      />

      {/* Resume Grid */}
      {filteredResumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes found"
          description={
            searchTerm || filterStatus !== "all"
              ? "Adjust the search or status filter to find a submitted resume."
              : isApplicant
                ? "Submit your first resume to start AI analysis."
                : "No resumes have been submitted yet."
          }
          action={
            isApplicant && !searchTerm && filterStatus === "all" && !showUpload ? (
              <Button icon={Plus} variant="primary" onClick={() => setShowUpload(true)}>
                Submit resume
              </Button>
            ) : null
          }
        />
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

            const getScoreTone = (s) => {
              if (s >= 8) return "strong";
              if (s >= 6) return "medium";
              return "low";
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
                      <span className={`score-badge score-${getScoreTone(score)}`}>
                        {score}/10
                      </span>
                    ) : (
                      <StatusBadge tone="success">Analyzed</StatusBadge>
                    )
                  ) : (
                    <StatusBadge tone="warning">Pending</StatusBadge>
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
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                  {isApplicant && (
                    <button 
                      className="delete-card-btn"
                      onClick={(e) => handleDelete(e, resume.id)}
                      aria-label={`Delete resume ${resume.id}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
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
