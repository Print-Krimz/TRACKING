/**
 * Candidate Ranking Component
 *
 * Displays AI-ranked candidates for a specific job.
 * Features:
 * - List of matched candidates sorted by score
 * - Detailed score breakdown
 * - Match recommendation
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJobMatches, getJob, scoreJobApplications, getJobAiSummary } from "../services/api";
import { Sparkles, BarChart3, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import AnonymousName from "../components/AnonymousName";
import "./CandidateRanking.css";

const CandidateRanking = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [scoring, setScoring] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobData, matchesData] = await Promise.all([
        getJob(jobId),
        getJobMatches(jobId),
      ]);
      setJob(jobData);
      setCandidates(matchesData.candidates || []);
    } catch (err) {
      setError("Failed to load ranking data");
    } finally {
      setLoading(false);
    }
  };

  const handleScoreAll = async () => {
    try {
      setScoring(true);
      await scoreJobApplications(jobId);
      // Reload to get new scores
      const matchesData = await getJobMatches(jobId);
      setCandidates(matchesData.candidates || []);
      setScoring(false);
    } catch (err) {
      setError("Failed to score applications");
      setScoring(false);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true);
      const data = await getJobAiSummary(jobId);
      setAiSummary(data.summary);
    } catch (err) {
      setError("Failed to generate AI summary.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#10b981"; // Green
    if (score >= 60) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  if (loading) {
    return (
      <div className="ranking-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Analyzing candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ranking-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Candidate Ranking</h1>
          <p>
            {job?.title} • {candidates.length} Candidates
          </p>
        </div>
        <div className="header-actions">
          <button
            className="score-btn"
            onClick={handleScoreAll}
            disabled={scoring}
          >
            {scoring ? "Scoring..." : "Run AI Scoring"}
          </button>
          <button className="back-btn" onClick={() => navigate("/recruiter")}>
            Back to Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="ai-summary-section" style={{marginBottom: "2rem", padding: "1.5rem", background: "rgba(99, 102, 241, 0.05)", borderRadius: "12px", border: "1px solid rgba(99, 102, 241, 0.3)"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSummary ? "1rem" : "0"}}>
            <h3 style={{margin: 0, display: "flex", alignItems: "center", gap: "0.5rem"}}>
              <Sparkles className="inline-icon" size={24} /> AI Talent Pool Summary
            </h3>
            {!aiSummary && (
              <button 
                className="primary-btn" 
                onClick={handleGenerateSummary} 
                disabled={generatingSummary}
                style={{padding: "0.5rem 1rem", fontSize: "0.9rem"}}
              >
                {generatingSummary ? "Generating..." : "Generate AI Summary"}
              </button>
            )}
          </div>
          
          {aiSummary && (
            <div style={{color: "#e2e8f0", lineHeight: "1.6", fontSize: "0.95rem"}}>
              {aiSummary.split('\n\n').map((paragraph, idx) => (
                <p key={idx} style={{marginBottom: "0.75rem"}}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BarChart3 size={48} /></div>
          <h3>No ranked candidates</h3>
          <p>Run AI scoring to analyze applications for this job.</p>
          <button
            className="primary-btn"
            onClick={handleScoreAll}
            disabled={scoring}
          >
            Start Scoring
          </button>
        </div>
      ) : (
        <div className="candidates-list">
          {candidates.map((candidate, index) => (
            <div key={candidate.application_id} className="candidate-card">
              <div
                className="card-header"
                onClick={() => toggleExpand(candidate.application_id)}
              >
                <div className="rank-badge">#{index + 1}</div>

                <div className="candidate-info">
                  <AnonymousName
                    name={candidate.candidate_name}
                    id={candidate.application_id}
                    revealed={expandedId === candidate.application_id}
                  />
                  <p
                    style={{
                      color: "#94a3b8",
                      fontSize: "0.85rem",
                      margin: "0.25rem 0 0.5rem",
                    }}
                  >
                    {candidate.match_score >= 80
                      ? `Excellent fit — strong alignment with ${job?.title || "this role"} requirements`
                      : candidate.match_score >= 60
                        ? `Good potential — meets most requirements for ${job?.title || "this role"}`
                        : candidate.match_score >= 40
                          ? `Partial match — some relevant skills but gaps exist`
                          : `Limited match — significant gaps in key requirements`}
                    {candidate.score_breakdown?.strengths?.length > 0 &&
                      `. Key strength: ${candidate.score_breakdown.strengths[0]}`}
                  </p>
                  <span className={`status-pill ${candidate.status}`}>
                    {candidate.status}
                  </span>
                </div>

                <div className="score-display">
                  <div
                    className="score-circle"
                    style={{
                      borderColor: getScoreColor(candidate.match_score),
                    }}
                  >
                    <span
                      className="score-value"
                      style={{ color: getScoreColor(candidate.match_score) }}
                    >
                      {candidate.match_score}%
                    </span>
                  </div>
                  <span className="match-label">Match</span>
                </div>

                <div
                  className={`expand-icon ${expandedId === candidate.application_id ? "open" : ""}`}
                >
                  <ChevronDown size={20} />
                </div>
              </div>

              {expandedId === candidate.application_id &&
                candidate.score_breakdown && (
                  <div className="card-details">
                    <div className="breakdown-grid">
                      <div className="breakdown-item">
                        <label>Skills</label>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${candidate.score_breakdown.skills_score}%`,
                              backgroundColor: "#6366f1",
                            }}
                          ></div>
                        </div>
                        <span>{candidate.score_breakdown.skills_score}%</span>
                      </div>

                      <div className="breakdown-item">
                        <label>Experience</label>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${candidate.score_breakdown.experience_score}%`,
                              backgroundColor: "#8b5cf6",
                            }}
                          ></div>
                        </div>
                        <span>
                          {candidate.score_breakdown.experience_score}%
                        </span>
                      </div>

                      <div className="breakdown-item">
                        <label>Education</label>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${candidate.score_breakdown.education_score}%`,
                              backgroundColor: "#ec4899",
                            }}
                          ></div>
                        </div>
                        <span>
                          {candidate.score_breakdown.education_score}%
                        </span>
                      </div>
                    </div>

                    <div className="analysis-section">
                      <div className="analysis-block">
                        <h4>Strengths</h4>
                        <ul>
                          {candidate.score_breakdown.strengths?.map((s, i) => (
                            <li key={i}><CheckCircle2 size={16} className="inline-icon" /> {s}</li>
                          )) || <li>No specific strengths identified</li>}
                        </ul>
                      </div>

                      <div className="analysis-block">
                        <h4>Missing / Gaps</h4>
                        <ul>
                          {candidate.score_breakdown.missing_requirements?.map(
                            (m, i) => <li key={i}><AlertTriangle size={16} className="inline-icon" /> {m}</li>,
                          ) || <li>No major gaps identified</li>}
                        </ul>
                      </div>
                    </div>

                    <div className="recommendation">
                      <strong>AI Recommendation:</strong>
                      <span className="rec-text">
                        {candidate.score_breakdown.recommendation
                          ?.replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>

                    <div className="action-buttons">
                      <button
                        className="view-app-btn"
                        onClick={() =>
                          navigate(`/resumes/${candidate.resume_id}`)
                        }
                      >
                        View Full Application
                      </button>
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidateRanking;
