import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DatabaseZap,
  ExternalLink,
  FileText,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import {
  getTalentPoolEntries,
  rescanTalentPool,
  rescanTalentPoolEntry,
} from "../services/api";
import AnonymousName from "../components/AnonymousName";
import "./TalentPool.css";

const MATCH_FILTERS = [
  { value: "all", label: "All Matches" },
  { value: "strong", label: "80% and above" },
  { value: "promising", label: "60% and above" },
  { value: "low", label: "Below 60%" },
  { value: "unmatched", label: "No Open Matches" },
];

const normalizeErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") {
      return first;
    }
    if (first?.msg) {
      return first.msg;
    }
  }

  if (detail && typeof detail === "object") {
    if (detail.msg) {
      return detail.msg;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const TalentPool = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescanningAll, setRescanningAll] = useState(false);
  const [rescanningId, setRescanningId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [matchFilter, setMatchFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getTalentPoolEntries({ limit: 100 });
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err) {
      setError(normalizeErrorMessage(err, "Failed to load talent pool"));
    } finally {
      setLoading(false);
    }
  };

  const safeEntries = Array.isArray(entries) ? entries : [];

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return safeEntries.filter((entry) => {
      const matchesSearch =
        !term ||
        [
          entry.candidate_name,
          entry.source_job_title,
          entry.best_match_job_title,
          entry.notes,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      switch (matchFilter) {
        case "strong":
          return (entry.best_match_score || 0) >= 80;
        case "promising":
          return (entry.best_match_score || 0) >= 60;
        case "low":
          return entry.best_match_score != null && entry.best_match_score < 60;
        case "unmatched":
          return entry.matched_open_jobs_count === 0;
        default:
          return true;
      }
    });
  }, [safeEntries, matchFilter, searchTerm]);

  const stats = useMemo(() => {
    const promising = safeEntries.filter(
      (entry) => (entry.best_match_score || 0) >= 60,
    ).length;
    const strong = safeEntries.filter(
      (entry) => (entry.best_match_score || 0) >= 80,
    ).length;
    const unmatched = safeEntries.filter(
      (entry) => entry.matched_open_jobs_count === 0,
    ).length;

    return {
      total: safeEntries.length,
      promising,
      strong,
      unmatched,
    };
  }, [safeEntries]);

  const handleRescanAll = async () => {
    try {
      setRescanningAll(true);
      const data = await rescanTalentPool();
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setSuccess(
        `Rescanned ${data.rescanned_count} talent pool entries${data.skipped_count ? `, skipped ${data.skipped_count}` : ""}`,
      );
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(normalizeErrorMessage(err, "Failed to rescan talent pool"));
    } finally {
      setRescanningAll(false);
    }
  };

  const handleRescanOne = async (entryId) => {
    try {
      setRescanningId(entryId);
      const data = await rescanTalentPoolEntry(entryId);
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...data.entry,
                last_rescan_delta: data.delta,
                last_rescan_message: data.message,
              }
            : entry,
        ),
      );
      if (data?.delta) {
        setSuccess(
          `${data.delta.old_score ?? 0}% -> ${data.delta.new_score ?? 0}% (${data.delta.matched_jobs_delta >= 0 ? "+" : ""}${data.delta.matched_jobs_delta} matches)`,
        );
        setTimeout(() => setSuccess(""), 2500);
      }
    } catch (err) {
      setError(normalizeErrorMessage(err, "Failed to rescan candidate"));
    } finally {
      setRescanningId(null);
    }
  };

  const getScoreTone = (score) => {
    if (score == null) return "neutral";
    if (score >= 80) return "strong";
    if (score >= 60) return "promising";
    return "low";
  };

  if (loading) {
    return (
      <div className="talent-pool-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading talent pool...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="talent-pool-page">
      <div className="talent-pool-header">
        <div>
          <h1>Talent Pool</h1>
          <p>Saved candidates ready for rescanning against open roles.</p>
        </div>
        <div className="talent-pool-actions">
          <button
            className="secondary-btn"
            onClick={() => navigate("/applicants?status=rejected")}
          >
            <Users size={16} className="inline-icon" /> Rejected Applicants
          </button>
          <button
            className="primary-btn"
            onClick={handleRescanAll}
            disabled={rescanningAll}
          >
            <RefreshCcw size={16} className="inline-icon" />
            {rescanningAll ? "Rescanning..." : "Rescan Pool"}
          </button>
        </div>
      </div>

      {success && <div className="success-banner">{success}</div>}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>x</button>
        </div>
      )}

      <div className="talent-pool-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Saved Candidates</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.promising}</span>
          <span className="stat-label">60%+ Matches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.strong}</span>
          <span className="stat-label">80%+ Matches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.unmatched}</span>
          <span className="stat-label">Need Review</span>
        </div>
      </div>

      <div className="talent-pool-toolbar">
        <div className="talent-pool-search-box">
          <Search size={16} className="talent-pool-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by candidate, source job, or matched job..."
          />
        </div>
        <select
          value={matchFilter}
          onChange={(event) => setMatchFilter(event.target.value)}
          className="talent-pool-filter-select"
        >
          {MATCH_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="empty-state">
          <DatabaseZap size={44} />
          <h2>No talent pool candidates found</h2>
          <p>
            Save rejected applicants to the pool, then rescan them when new jobs
            open.
          </p>
        </div>
      ) : (
        <div className="talent-pool-table">
          <div className="table-row table-header">
            <span>Candidate</span>
            <span>Source Role</span>
            <span>Best Current Match</span>
            <span>Signals</span>
            <span>Last Rescanned</span>
            <span>Actions</span>
          </div>

          {filteredEntries.map((entry) => (
            <div key={entry.id} className="table-row talent-pool-entry">
              <div className="candidate-cell">
                <AnonymousName name={entry.candidate_name} id={entry.candidate_id} />
                <span>ID #{entry.candidate_id}</span>
              </div>

              <div className="source-cell">
                <span className="source-title">
                  {entry.source_job_title || "Unknown role"}
                </span>
                <span className="source-status">
                  Source status: {entry.source_status}
                </span>
              </div>

              <div className="match-cell">
                <span className="match-title">
                  {entry.best_match_job_title || "No open match yet"}
                </span>
                {entry.best_match_score != null && (
                  <span className={`score-badge ${getScoreTone(entry.best_match_score)}`}>
                    {entry.best_match_score}%
                  </span>
                )}
                {entry.last_rescan_delta && (
                  <span className="match-delta">
                    {entry.last_rescan_delta.old_score ?? 0}% {"->"} {entry.last_rescan_delta.new_score ?? 0}%
                  </span>
                )}
              </div>

              <div className="signal-cell">
                <span>{entry.matched_open_jobs_count} open role(s) above 60%</span>
                <span>{entry.notes || "No recruiter note"}</span>
              </div>

              <div className="rescan-cell">
                {entry.last_rescanned_at
                  ? new Date(entry.last_rescanned_at).toLocaleString()
                  : "Never"}
              </div>

              <div className="actions-cell">
                <button
                  className="icon-btn"
                  onClick={() => handleRescanOne(entry.id)}
                  disabled={rescanningId === entry.id}
                  title="Rescan this candidate"
                >
                  <RefreshCcw size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => navigate(`/resumes/${entry.resume_id}`)}
                  title="Open resume"
                >
                  <FileText size={16} />
                </button>
                {entry.source_job_id && (
                  <button
                    className="icon-btn"
                    onClick={() => navigate(`/jobs/${entry.source_job_id}`)}
                    title="Open source job"
                  >
                    <ExternalLink size={16} />
                  </button>
                )}
                {entry.best_match_job_id && (
                  <button
                    className="match-link-btn"
                    onClick={() => navigate(`/jobs/${entry.best_match_job_id}`)}
                  >
                    Open Match
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TalentPool;
