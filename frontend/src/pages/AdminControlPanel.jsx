import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  archiveUser,
  assignRole,
  deleteApplication,
  deleteJob,
  deleteUser,
  getAllRoles,
  getAllUsers,
  getAnalyticsOverview,
  getApplications,
  getJobs,
  restoreUser,
  toggleShortlist,
  updateApplicationStatus,
  updateJob,
  getAuditLogs,
  getSystemStats,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BarChart3, Users, ClipboardList, Briefcase, Search, Settings, Star, CheckCircle2, Building2, Database } from "lucide-react";
import "./AdminControlPanel.css";

const JOB_STATUS_OPTIONS = ["draft", "open", "paused", "closed", "filled"];

const AdminControlPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    kind: null,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    confirmTone: "default",
    requireReason: false,
    reasonLabel: "",
    reasonPlaceholder: "",
    reasonOptional: false,
    reason: "",
    payload: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Data
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [overview, setOverview] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);

  // Audit filters
  const [auditFilter, setAuditFilter] = useState({ action: "", entity_type: "" });
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 20;

  useEffect(() => {
    loadPanelData();
  }, []);

  useEffect(() => {
    if (activeTab === "audit") loadAuditLogs();
  }, [activeTab, auditPage, auditFilter]);

  const loadPanelData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, appsData, jobsData, overviewData, statsData] =
        await Promise.all([
          getAllUsers(),
          getAllRoles(),
          getApplications(),
          getJobs({ include_closed: true }),
          getAnalyticsOverview().catch(() => null),
          getSystemStats().catch(() => null),
        ]);

      setUsers(usersData.users || []);
      setRoles(rolesData || []);
      setApplications(appsData.applications || []);
      setJobs(jobsData.jobs || []);
      setOverview(overviewData);
      setSystemStats(statsData);
    } catch (err) {
      toast.error(err.response?.data?.detail || "We couldn't load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const params = {
        limit: AUDIT_PAGE_SIZE,
        offset: auditPage * AUDIT_PAGE_SIZE,
      };
      if (auditFilter.action) params.action = auditFilter.action;
      if (auditFilter.entity_type) params.entity_type = auditFilter.entity_type;
      const data = await getAuditLogs(params);
      setAuditLogs(data.logs || []);
      setAuditTotal(data.total || 0);
    } catch (err) {
      // Silently fail if no audit logs exist yet
      setAuditLogs([]);
      setAuditTotal(0);
    }
  };

  const rolePermissions = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => map.set(role.name, role.permissions || []));
    return map;
  }, [roles]);

  const sortedApplications = useMemo(
    () =>
      [...applications].sort(
        (a, b) => new Date(b.updated_at || b.applied_at) - new Date(a.updated_at || a.applied_at),
      ),
    [applications],
  );

  const counters = useMemo(() => {
    const shortlisted = applications.filter((a) => a.is_shortlisted).length;
    const hired = applications.filter((a) => a.status === "hired").length;
    return { users: users.length, applicants: applications.length, shortlisted, hired, jobs: jobs.length };
  }, [applications, jobs, users]);

  const openConfirmDialog = (config) => {
    setConfirmDialog({
      isOpen: true,
      kind: config.kind,
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel || "Confirm",
      confirmTone: config.confirmTone || "default",
      requireReason: Boolean(config.requireReason),
      reasonLabel: config.reasonLabel || "",
      reasonPlaceholder: config.reasonPlaceholder || "",
      reasonOptional: Boolean(config.reasonOptional),
      reason: config.reason || "",
      payload: config.payload || null,
    });
  };

  const closeConfirmDialog = () => {
    if (confirmBusy) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // --- Handlers ---
  const handleRoleChange = async (targetUserId, roleName) => {
    try {
      const updated = await assignRole(targetUserId, roleName);
      setUsers((prev) => prev.map((u) => (u.id === targetUserId ? updated : u)));
      toast.success("Role updated successfully.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update role.");
    }
  };

  const handleArchiveUser = (entry) => {
    openConfirmDialog({
      kind: "archive-user",
      title: "Archive User",
      message: `Archive ${entry.username}? They will lose access to all modules immediately.`,
      confirmLabel: "Archive",
      confirmTone: "danger",
      requireReason: true,
      reasonLabel: "Reason",
      reasonPlaceholder: "Enter archive reason",
      reason: "Access revoked",
      payload: entry,
    });
  };

  const handleRestoreUser = (entry) => {
    openConfirmDialog({
      kind: "restore-user",
      title: "Restore User",
      message: `Restore ${entry.username}? Their role-based access will be re-enabled.`,
      confirmLabel: "Restore",
      requireReason: true,
      reasonOptional: true,
      reasonLabel: "Reason (Optional)",
      reasonPlaceholder: "Optional note for audit trail",
      payload: entry,
    });
  };

  const handleDeleteUser = (entry) => {
    openConfirmDialog({
      kind: "delete-user",
      title: "Delete User Permanently",
      message: `Delete ${entry.username} permanently? This cannot be undone and only works when no dependent records exist.`,
      confirmLabel: "Delete Permanently",
      confirmTone: "danger",
      payload: entry,
    });
  };

  const handleApproveCandidate = async (applicationId) => {
    try {
      const updated = await updateApplicationStatus(applicationId, "hired");
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...updated } : a)));
      toast.success("Candidate approved and marked as hired.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to approve candidate.");
    }
  };

  const handleToggleShortlist = async (applicationId) => {
    try {
      const updated = await toggleShortlist(applicationId);
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...updated } : a)));
      toast.success(updated.is_shortlisted ? "Candidate shortlisted." : "Removed from shortlist.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update shortlist.");
    }
  };

  const handleRemoveCandidate = (applicationId) => {
    openConfirmDialog({
      kind: "delete-candidate",
      title: "Remove Candidate Record",
      message: "Remove this candidate record permanently?",
      confirmLabel: "Remove",
      confirmTone: "danger",
      payload: { applicationId },
    });
  };

  const handleJobStatusChange = async (jobId, nextStatus) => {
    try {
      const updated = await updateJob(jobId, { status: nextStatus });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updated } : j)));
      toast.success("Job posting updated.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update job status.");
    }
  };

  const handleDeleteJob = (jobId) => {
    openConfirmDialog({
      kind: "delete-job",
      title: "Delete Job Posting",
      message: "Delete this job posting permanently?",
      confirmLabel: "Delete",
      confirmTone: "danger",
      payload: { jobId },
    });
  };

  // --- Helpers ---
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "--";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const handleConfirmDialogAction = async () => {
    const { kind, payload, reason, requireReason, reasonOptional } = confirmDialog;
    if (requireReason && !reasonOptional && !reason.trim()) {
      toast.warning("Please provide a reason before continuing.");
      return;
    }

    setConfirmBusy(true);
    try {
      if (kind === "archive-user") {
        const updated = await archiveUser(payload.id, reason.trim());
        setUsers((prev) => prev.map((u) => (u.id === payload.id ? updated : u)));
        toast.success("User archived successfully.");
      } else if (kind === "restore-user") {
        const updated = await restoreUser(payload.id, reason.trim());
        setUsers((prev) => prev.map((u) => (u.id === payload.id ? updated : u)));
        toast.success("User restored successfully.");
      } else if (kind === "delete-user") {
        await deleteUser(payload.id);
        setUsers((prev) => prev.filter((u) => u.id !== payload.id));
        toast.success("User deleted successfully.");
      } else if (kind === "delete-candidate") {
        await deleteApplication(payload.applicationId);
        setApplications((prev) => prev.filter((a) => a.id !== payload.applicationId));
        toast.success("Candidate record removed.");
      } else if (kind === "delete-job") {
        await deleteJob(payload.jobId);
        setJobs((prev) => prev.filter((j) => j.id !== payload.jobId));
        toast.success("Job posting removed.");
      }

      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action failed. Please try again.");
    } finally {
      setConfirmBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-control-panel">
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading admin control panel...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <BarChart3 size={18} /> },
    { id: "users", label: "Users & Roles", icon: <Users size={18} /> },
    { id: "candidates", label: "Candidates", icon: <ClipboardList size={18} /> },
    { id: "jobs", label: "Job Postings", icon: <Briefcase size={18} /> },
    { id: "audit", label: "Audit Trail", icon: <Search size={18} /> },
    { id: "system", label: "System", icon: <Settings size={18} /> },
  ];

  return (
    <div className="admin-control-panel">
      {/* Header */}
      <div className="admin-panel-header">
        <div>
          <h1>Admin Control Panel</h1>
          <p>System oversight, user management, audit trail, and compliance monitoring.</p>
        </div>
        <div className="admin-panel-links">
          <Link to="/reports" className="panel-link">Reports</Link>
          <Link to="/dashboard" className="panel-link">Analytics</Link>
          <Link to="/jobs/create" className="panel-link primary">+ New Job</Link>
        </div>
      </div>

      {confirmDialog.isOpen && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeConfirmDialog}
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            {confirmDialog.requireReason && (
              <div className="confirm-field">
                <label htmlFor="confirm-reason">{confirmDialog.reasonLabel}</label>
                <input
                  id="confirm-reason"
                  type="text"
                  value={confirmDialog.reason}
                  onChange={(e) =>
                    setConfirmDialog((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder={confirmDialog.reasonPlaceholder}
                  disabled={confirmBusy}
                />
              </div>
            )}
            <div className="confirm-actions">
              <button className="mini-btn" onClick={closeConfirmDialog} disabled={confirmBusy}>
                Cancel
              </button>
              <button
                className={`mini-btn ${confirmDialog.confirmTone === "danger" ? "danger" : ""}`}
                onClick={handleConfirmDialogAction}
                disabled={confirmBusy}
              >
                {confirmBusy ? "Processing..." : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Tabs */}
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">

        {/* â”€â”€ OVERVIEW â”€â”€ */}
        {activeTab === "overview" && (
          <div className="tab-pane fade-in">
            <div className="overview-grid">
              <div className="overview-card accent-indigo">
                <div className="ov-icon"><Users size={24} /></div>
                <div className="ov-data">
                  <span className="ov-value">{counters.users}</span>
                  <span className="ov-label">Total Users</span>
                </div>
              </div>
              <div className="overview-card accent-cyan">
                <div className="ov-icon"><ClipboardList size={24} /></div>
                <div className="ov-data">
                  <span className="ov-value">{counters.applicants}</span>
                  <span className="ov-label">Applications</span>
                </div>
              </div>
              <div className="overview-card accent-amber">
                <div className="ov-icon"><Star size={24} /></div>
                <div className="ov-data">
                  <span className="ov-value">{counters.shortlisted}</span>
                  <span className="ov-label">Shortlisted</span>
                </div>
              </div>
              <div className="overview-card accent-emerald">
                <div className="ov-icon"><CheckCircle2 size={24} /></div>
                <div className="ov-data">
                  <span className="ov-value">{counters.hired}</span>
                  <span className="ov-label">Hired</span>
                </div>
              </div>
              <div className="overview-card accent-rose">
                <div className="ov-icon"><Briefcase size={24} /></div>
                <div className="ov-data">
                  <span className="ov-value">{counters.jobs}</span>
                  <span className="ov-label">Job Postings</span>
                </div>
              </div>
            </div>

            {overview && (
              <div className="overview-meta">
                <span>Open Jobs: {overview.open_jobs ?? 0}</span>
                <span>Recent Applications (7d): {overview.recent_applications ?? 0}</span>
                <span>Total Applications: {overview.total_applications ?? 0}</span>
              </div>
            )}

            {systemStats && (
              <div className="system-quick-stats">
                <h3>Platform Summary</h3>
                <div className="quick-stats-grid">
                  <div className="qs-item"><span className="qs-num">{systemStats.total_resumes}</span><span className="qs-label">Resumes</span></div>
                  <div className="qs-item"><span className="qs-num">{systemStats.total_documents}</span><span className="qs-label">Documents</span></div>
                  <div className="qs-item"><span className="qs-num">{systemStats.total_clients}</span><span className="qs-label">Clients</span></div>
                  <div className="qs-item"><span className="qs-num">{systemStats.active_deployments}</span><span className="qs-label">Active Deployments</span></div>
                  <div className="qs-item"><span className="qs-num">{formatBytes(systemStats.storage_bytes)}</span><span className="qs-label">Storage Used</span></div>
                  <div className="qs-item"><span className="qs-num">{systemStats.audit_log_count}</span><span className="qs-label">Audit Events</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ USERS & ROLES â”€â”€ */}
        {activeTab === "users" && (
          <div className="tab-pane fade-in">
            <section className="panel-section">
              <h2>User Directory & Permission Control</h2>
              <div className="table-wrap">
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Role</th>
                      <th>Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((entry) => {
                      const permissions = rolePermissions.get(entry.role_name) || [];
                      const moduleAccess = entry.effective_modules || {};
                      const enabledModules = Object.entries(moduleAccess)
                        .filter(([, isEnabled]) => Boolean(isEnabled))
                        .map(([key]) => key.replace(/_/g, " "));
                      const isArchived = entry.status === "archived";
                      const disableActions = entry.id === user?.id;
                      return (
                        <tr key={entry.id}>
                          <td>
                            <div className="name-cell">
                              <div className="user-avatar-mini">{(entry.username || "U").slice(0, 2).toUpperCase()}</div>
                              <div>
                                <strong>{entry.username}</strong>
                                {entry.id === user?.id && <span className="you-pill">You</span>}
                              </div>
                            </div>
                          </td>
                          <td className="text-muted">{entry.email}</td>
                          <td>
                            <span className={`account-status-pill ${isArchived ? "archived" : "active"}`}>
                              {entry.status || "active"}
                            </span>
                          </td>
                          <td>
                            <select
                              className="role-select"
                              value={entry.role_name || ""}
                              onChange={(e) => handleRoleChange(entry.id, e.target.value)}
                              disabled={disableActions}
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="access-cell">
                              <span className="perm-badge">{permissions.length} permissions</span>
                              <div className="module-tags">
                                {enabledModules.length === 0 ? (
                                  <span className="module-tag muted">No module access</span>
                                ) : (
                                  enabledModules.map((moduleName) => (
                                    <span key={`${entry.id}-${moduleName}`} className="module-tag">
                                      {moduleName}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="action-row">
                              {isArchived ? (
                                <button
                                  className="mini-btn"
                                  disabled={disableActions}
                                  onClick={() => handleRestoreUser(entry)}
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  className="mini-btn"
                                  disabled={disableActions}
                                  onClick={() => handleArchiveUser(entry)}
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                className="mini-btn danger"
                                disabled={disableActions}
                                onClick={() => handleDeleteUser(entry)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* â”€â”€ CANDIDATES â”€â”€ */}
        {activeTab === "candidates" && (
          <div className="tab-pane fade-in">
            <section className="panel-section">
              <h2>Applicant Records</h2>
              <div className="table-wrap">
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApplications.map((app) => (
                      <tr key={app.id}>
                        <td>{app.candidate_name || `Candidate #${app.candidate_id}`}</td>
                        <td>{app.job_title || `Job #${app.job_id}`}</td>
                        <td><span className={`status-pill status-${app.status}`}>{app.status}</span></td>
                        <td>{app.match_score ?? "â€”"}</td>
                        <td>
                          <div className="action-row">
                            <button className="mini-btn" disabled={app.status === "hired"} onClick={() => handleApproveCandidate(app.id)}>Approve</button>
                            <button className="mini-btn" onClick={() => handleToggleShortlist(app.id)}>{app.is_shortlisted ? "Unshortlist" : "Shortlist"}</button>
                            <button className="mini-btn danger" onClick={() => handleRemoveCandidate(app.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* â”€â”€ JOB POSTINGS â”€â”€ */}
        {activeTab === "jobs" && (
          <div className="tab-pane fade-in">
            <section className="panel-section">
              <h2>Job Posting Management</h2>
              <div className="table-wrap">
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td><strong>{job.title}</strong></td>
                        <td>{job.department || "â€”"}</td>
                        <td>
                          <select
                            className="role-select"
                            value={job.status}
                            onChange={(e) => handleJobStatusChange(job.id, e.target.value)}
                          >
                            {JOB_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="action-row">
                            <Link to={`/jobs/${job.id}`} className="mini-link">View</Link>
                            <button className="mini-btn danger" onClick={() => handleDeleteJob(job.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* â”€â”€ AUDIT TRAIL â”€â”€ */}
        {activeTab === "audit" && (
          <div className="tab-pane fade-in">
            <section className="panel-section">
              <div className="audit-header">
                <h2>System Audit Trail</h2>
                <div className="audit-filters">
                  <input
                    type="text"
                    placeholder="Filter by action..."
                    value={auditFilter.action}
                    onChange={(e) => { setAuditFilter({ ...auditFilter, action: e.target.value }); setAuditPage(0); }}
                    className="audit-filter-input"
                  />
                  <input
                    type="text"
                    placeholder="Filter by entity..."
                    value={auditFilter.entity_type}
                    onChange={(e) => { setAuditFilter({ ...auditFilter, entity_type: e.target.value }); setAuditPage(0); }}
                    className="audit-filter-input"
                  />
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="empty-state">
                  <p>No audit log entries found. System activity will appear here as users perform actions.</p>
                </div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="panel-table audit-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>User</th>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="text-muted ts-cell">{formatTimestamp(log.timestamp)}</td>
                            <td><strong>{log.username}</strong></td>
                            <td><span className="action-badge">{log.action}</span></td>
                            <td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}</td>
                            <td className="text-muted detail-cell">{log.details || "â€”"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="audit-pagination">
                    <button
                      className="mini-btn"
                      disabled={auditPage === 0}
                      onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                    >â† Previous</button>
                    <span className="page-info">
                      Showing {auditPage * AUDIT_PAGE_SIZE + 1}â€“{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal)} of {auditTotal}
                    </span>
                    <button
                      className="mini-btn"
                      disabled={(auditPage + 1) * AUDIT_PAGE_SIZE >= auditTotal}
                      onClick={() => setAuditPage((p) => p + 1)}
                    >Next â†’</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* â”€â”€ SYSTEM â”€â”€ */}
        {activeTab === "system" && (
          <div className="tab-pane fade-in">
            <section className="panel-section">
              <h2>Platform Health & System Metrics</h2>
              {systemStats ? (
                <div className="system-grid">
                  <div className="sys-card">
                    <h4 className="flex-title"><Users size={20} /> Users</h4>
                    <div className="sys-breakdown">
                      <div className="sys-row"><span>Applicants</span><strong>{systemStats.total_applicants}</strong></div>
                      <div className="sys-row"><span>Recruiters</span><strong>{systemStats.total_recruiters}</strong></div>
                      <div className="sys-row"><span>Admins</span><strong>{systemStats.total_admins}</strong></div>
                      <div className="sys-row total"><span>Total</span><strong>{systemStats.total_users}</strong></div>
                    </div>
                  </div>
                  <div className="sys-card">
                    <h4 className="flex-title"><ClipboardList size={20} /> Pipeline</h4>
                    <div className="sys-breakdown">
                      <div className="sys-row"><span>Applications</span><strong>{systemStats.total_applications}</strong></div>
                      <div className="sys-row"><span>Resumes</span><strong>{systemStats.total_resumes}</strong></div>
                      <div className="sys-row"><span>Open Jobs</span><strong>{systemStats.open_jobs}</strong></div>
                      <div className="sys-row total"><span>Total Jobs</span><strong>{systemStats.total_jobs}</strong></div>
                    </div>
                  </div>
                  <div className="sys-card">
                    <h4 className="flex-title"><Building2 size={20} /> ERP</h4>
                    <div className="sys-breakdown">
                      <div className="sys-row"><span>Clients</span><strong>{systemStats.total_clients}</strong></div>
                      <div className="sys-row"><span>Active Deployments</span><strong>{systemStats.active_deployments}</strong></div>
                      <div className="sys-row total"><span>Total Deployments</span><strong>{systemStats.total_deployments}</strong></div>
                    </div>
                  </div>
                  <div className="sys-card">
                    <h4 className="flex-title"><Database size={20} /> Storage & Logs</h4>
                    <div className="sys-breakdown">
                      <div className="sys-row"><span>Documents</span><strong>{systemStats.total_documents}</strong></div>
                      <div className="sys-row"><span>Storage Used</span><strong>{formatBytes(systemStats.storage_bytes)}</strong></div>
                      <div className="sys-row"><span>Audit Events</span><strong>{systemStats.audit_log_count}</strong></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Unable to load system statistics. Ensure the backend is running.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminControlPanel;
