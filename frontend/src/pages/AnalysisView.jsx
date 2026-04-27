/**
 * Analysis View Page Component
 *
 * Displays a single resume with its AI analysis.
 * Recruiters/Admins can trigger analysis from this page.
 *
 * Features:
 * - Full resume content display
 * - AI analysis results with score, strengths, weaknesses
 * - "Generate AI Analysis" button for Recruiters/Admins
 * - Loading state during analysis
 * - Job role selection for analysis context
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getResumeById, analyzeResume, deleteResume } from "../services/api";
import Loading from "../components/Loading";
import AnonymousName from "../components/AnonymousName";
import { anonymizeContent } from "../utils/anonymize";
import "./AnalysisView.css";

const AnalysisView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAnalyze, isApplicant, isAdmin, isControlPanelAdmin } = useAuth();

  // State
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [jobRole, setJobRole] = useState("software engineer");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contentRevealed, setContentRevealed] = useState(false);

  // Fetch resume
  useEffect(() => {
    const fetchResume = async () => {
      try {
        const data = await getResumeById(id);
        setResume(data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load resume");
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, [id]);

  /**
   * Handle AI analysis
   */
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError("");

    try {
      const result = await analyzeResume(id, { job_role: jobRole });
      setResume((prev) => ({
        ...prev,
        analysis_result: result.analysis_result,
      }));
    } catch (err) {
      setAnalysisError(
        err.response?.data?.detail || "Analysis failed. Please try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Handle resume deletion
   */
  const handleDelete = async () => {
    try {
      await deleteResume(id);
      navigate(isApplicant ? "/my-resumes" : "/resumes", {
        state: { success: "Resume deleted successfully" },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete resume");
      setShowDeleteConfirm(false);
    }
  };

  /**
   * Parse analysis result JSON
   */
  const parseAnalysis = () => {
    if (!resume?.analysis_result) return null;

    try {
      return JSON.parse(resume.analysis_result);
    } catch {
      return { summary: resume.analysis_result };
    }
  };

  /**
   * Get score color based on value
   */
  const getScoreColor = (score) => {
    if (score >= 8) return "#10b981"; // Green
    if (score >= 6) return "#fbbf24"; // Yellow
    if (score >= 4) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <Loading message="Loading resume..." />;
  }

  if (error) {
    return (
      <div className="analysis-view-page">
        <div className="error-state">
          <div className="error-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2>Error Loading Resume</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="back-btn">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const analysis = parseAnalysis();

  return (
    <div className="analysis-view-page">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Resume?</h3>
            <p>
              This action cannot be undone. Are you sure you want to delete this
              resume?
            </p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button className="delete-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="back-link">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 19L8 12L15 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Resumes
        </button>

        <div className="header-actions">
          {(isApplicant || isAdmin || isControlPanelAdmin) && (
            <button
              className="delete-trigger-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Resume Meta */}
      <div className="resume-meta-card">
        <div className="meta-info">
          {resume.username && (
            <div className="meta-item">
              <span className="meta-label">Applicant</span>
              <span className="meta-value">
                <AnonymousName
                  name={resume.username}
                  id={resume.id}
                  showAvatar={false}
                />
              </span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Submitted</span>
            <span className="meta-value">{formatDate(resume.created_at)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <span
              className={`status-badge ${analysis ? "analyzed" : "pending"}`}
            >
              {analysis ? "Analyzed" : "Pending Analysis"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Resume Content */}
        <div className="content-section resume-content-section">
          <div className="resume-content-header">
            <h2>Resume Content</h2>
            {!isApplicant && (
              <button
                className={`reveal-content-btn ${contentRevealed ? "revealed" : ""}`}
                onClick={() => setContentRevealed(!contentRevealed)}
              >
                {contentRevealed ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                      <path
                        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="1"
                        y1="1"
                        x2="23"
                        y2="23"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Hide Identity
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                      <path
                        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Reveal Identity
                  </>
                )}
              </button>
            )}
          </div>
          <div className="resume-content-box">
            <pre>
              {!isApplicant && !contentRevealed
                ? anonymizeContent(resume.content)
                : resume.content}
            </pre>
          </div>
        </div>

        {/* Analysis Section */}
        <div className="content-section analysis-section">
          <h2>AI Analysis</h2>

          {/* Analysis Error */}
          {analysisError && (
            <div className="analysis-error">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{analysisError}</span>
            </div>
          )}

          {/* No Analysis Yet */}
          {!analysis && !analyzing && (
            <div className="no-analysis">
              <div className="no-analysis-icon">
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
              <h3>No Analysis Yet</h3>
              <p>
                {canAnalyze
                  ? "Click the button below to generate an AI-powered analysis of this resume."
                  : "A recruiter has not yet analyzed this resume."}
              </p>

              {canAnalyze && (
                <div className="analyze-form">
                  <div className="job-role-select">
                    <label htmlFor="job-role">Target Job Role</label>
                    <select
                      id="job-role"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                    >
                      <option value="software engineer">
                        Software Engineer
                      </option>
                      <option value="data scientist">Data Scientist</option>
                      <option value="product manager">Product Manager</option>
                      <option value="frontend developer">
                        Frontend Developer
                      </option>
                      <option value="backend developer">
                        Backend Developer
                      </option>
                      <option value="full stack developer">
                        Full Stack Developer
                      </option>
                      <option value="devops engineer">DevOps Engineer</option>
                      <option value="ux designer">UX Designer</option>
                    </select>
                  </div>

                  <button
                    className="analyze-btn"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
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
                    Generate AI Analysis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Analyzing State */}
          {analyzing && (
            <div className="analyzing-state">
              <div className="analyzing-spinner"></div>
              <h3>Analyzing Resume...</h3>
              <p>
                Google Gemini is analyzing this resume. This may take a few
                moments.
              </p>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && !analyzing && (
            <div className="analysis-results">
              {/* Score */}
              {analysis.score !== undefined && (
                <div className="score-section">
                  <div
                    className="score-circle"
                    style={{ "--score-color": getScoreColor(analysis.score) }}
                  >
                    <span className="score-value">{analysis.score}</span>
                    <span className="score-max">/10</span>
                  </div>
                  <span className="score-label">Overall Score</span>
                </div>
              )}

              {/* Summary */}
              {analysis.summary && (
                <div className="analysis-card summary">
                  <h4>Summary</h4>
                  <p>{analysis.summary}</p>
                </div>
              )}

              {/* Strengths */}
              {analysis.strengths?.length > 0 && (
                <div className="analysis-card strengths">
                  <h4>
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
                    Strengths
                  </h4>
                  <ul>
                    {analysis.strengths.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {analysis.weaknesses?.length > 0 && (
                <div className="analysis-card weaknesses">
                  <h4>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 9V12M12 16H12.01M4.93 4.93L19.07 19.07M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Areas for Improvement
                  </h4>
                  <ul>
                    {analysis.weaknesses.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations?.length > 0 && (
                <div className="analysis-card recommendations">
                  <h4>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9.66347 17H14.3364M12 3V4M18.364 5.63604L17.6569 6.34315M21 12H20M4 12H3M6.34309 6.34315L5.63599 5.63604M8.46441 15.5356C6.51179 13.5829 6.51179 10.4171 8.46441 8.46449C10.417 6.51187 13.5829 6.51187 15.5355 8.46449C17.4881 10.4171 17.4881 13.5829 15.5355 15.5356L14.9884 16.0827C14.3555 16.7155 14 17.5739 14 18.469V19C14 20.1046 13.1045 21 12 21C10.8954 21 9.99996 20.1046 9.99996 19V18.469C9.99996 17.5739 9.64447 16.7155 9.01153 16.0827L8.46441 15.5356Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Recommendations
                  </h4>
                  <ul>
                    {analysis.recommendations.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-analyze button */}
              {canAnalyze && (
                <button
                  className="re-analyze-btn"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Re-analyze
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
