import { useState, useEffect } from "react";
import {
  getDeployments,
  getClients,
  createClient,
  createDeployment,
  updateDeploymentStatus,
  getApplications,
} from "../services/api";
import { Rocket, CheckCircle2, Clock, Building2, ClipboardList, Search, MapPin, AlertCircle, AlertTriangle } from "lucide-react";
import "./ManpowerDeployment.css";

const ManpowerDeployment = () => {
  const [deployments, setDeployments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStr, setFilterStr] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("assignments"); // "assignments" or "clients"

  // New Deployment Modal
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployForm, setDeployForm] = useState({
    application_id: "",
    client_id: "",
    end_date: "",
    notes: "",
  });
  const [deployLoading, setDeployLoading] = useState(false);

  // New Client Modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    location: "",
  });

  // Hired applications for the deploy modal
  const [hiredApps, setHiredApps] = useState([]);

  useEffect(() => {
    loadData();
  }, [filterStr]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deployData, clientData] = await Promise.all([
        getDeployments(filterStr === "all" ? "" : filterStr),
        getClients(),
      ]);
      setDeployments(deployData.deployments || []);
      setClients(clientData || []);
    } catch (err) {
      setError("Failed to load deployment data.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateDeploymentStatus(id, { status: newStatus });
      await loadData();
    } catch (err) {
      setError("Failed to update status.");
    }
  };

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    const now = new Date();
    const diff = end - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const openDeployModal = async () => {
    try {
      const appsData = await getApplications();
      const hired = (appsData.applications || []).filter(
        (a) => a.status === "hired" || a.status === "offer"
      );
      setHiredApps(hired);
      setShowDeployModal(true);
    } catch {
      setError("Failed to load applications.");
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    try {
      setDeployLoading(true);
      await createDeployment({
        application_id: parseInt(deployForm.application_id),
        client_id: parseInt(deployForm.client_id),
        end_date: deployForm.end_date
          ? new Date(deployForm.end_date).toISOString()
          : null,
        notes: deployForm.notes || null,
      });
      setShowDeployModal(false);
      setDeployForm({ application_id: "", client_id: "", end_date: "", notes: "" });
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to deploy candidate."
      );
    } finally {
      setDeployLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await createClient(clientForm);
      setShowClientModal(false);
      setClientForm({ company_name: "", contact_person: "", email: "", phone: "", location: "" });
      await loadData();
    } catch (err) {
      setError("Failed to create client.");
    }
  };

  // Stats
  const activeCount = deployments.filter((d) => d.status === "active").length;
  const completedCount = deployments.filter((d) => d.status === "completed").length;
  const expiringCount = deployments.filter((d) => {
    const days = getDaysRemaining(d.end_date);
    return days !== null && days >= 0 && days <= 30 && d.status === "active";
  }).length;

  return (
    <div className="deploy-page">
      {/* Header */}
      <div className="deploy-header">
        <div>
          <h1>Workforce Deployment</h1>
          <p>Manage manpower assignments, client tracking, and contract monitoring</p>
        </div>
        <div className="deploy-header-actions">
          <button className="deploy-btn secondary" onClick={() => setShowClientModal(true)}>
            + Add Client
          </button>
          <button className="deploy-btn primary" onClick={openDeployModal}>
            + New Deployment
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="deploy-stats">
        <div className="stat-card stat-active">
          <div className="stat-icon"><Rocket size={24} /></div>
          <div className="stat-body">
            <span className="stat-value">{activeCount}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
        <div className="stat-card stat-completed">
          <div className="stat-icon"><CheckCircle2 size={24} /></div>
          <div className="stat-body">
            <span className="stat-value">{completedCount}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card stat-expiring">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-body">
            <span className="stat-value">{expiringCount}</span>
            <span className="stat-label">Expiring Soon</span>
          </div>
        </div>
        <div className="stat-card stat-clients">
          <div className="stat-icon"><Building2 size={24} /></div>
          <div className="stat-body">
            <span className="stat-value">{clients.length}</span>
            <span className="stat-label">Clients</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="deploy-error">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="deploy-tabs">
        <button 
          className={`tab-link ${activeTab === "assignments" ? "active" : ""}`}
          onClick={() => setActiveTab("assignments")}
        >
          <ClipboardList size={18} className="inline-icon" /> Active Assignments
        </button>
        <button 
          className={`tab-link ${activeTab === "clients" ? "active" : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          <Building2 size={18} className="inline-icon" /> Client Directory
        </button>
      </div>

      {/* Filter Controls */}
      <div className="deploy-controls">
        <div className="deploy-filter-group">
          {activeTab === "assignments" ? (
            ["all", "active", "completed", "terminated"].map((f) => (
              <button
                key={f}
                className={`filter-chip ${filterStr === f ? "active" : ""}`}
                onClick={() => setFilterStr(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))
          ) : (
            <span className="control-label">Managing {clients.length} Organizations</span>
          )}
        </div>
        <div className="deploy-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input 
            type="text" 
            placeholder={activeTab === "assignments" ? "Search personnel, job or client..." : "Search company, contact or location..."} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {activeTab === "assignments" ? (
        /* Deployment Table */
        <div className="deploy-table-wrap">
          <table className="deploy-table">
            <thead>
              <tr>
                <th>Personnel</th>
                <th>Assignment</th>
                <th>Client</th>
                <th>Status</th>
                <th>Deployed</th>
                <th>Contract Countdown</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    <div className="loading-pulse">Loading deployments...</div>
                  </td>
                </tr>
              ) : deployments.filter(d => 
                    d.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    <div className="empty-state-inline">
                      <span className="empty-icon-lg"><Search size={48} /></span>
                      <p>No deployments matching "{searchTerm}"</p>
                    </div>
                  </td>
                </tr>
              ) : (
                deployments
                  .filter(d => 
                    d.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((d) => {
                  const days = getDaysRemaining(d.end_date);
                  const isExpired = days !== null && days < 0;
                  const isExpiring = days !== null && days >= 0 && days <= 30;
                  const autoTerminatedByContract = (d.notes || "").includes(
                    "[AUTO_TERMINATED_CONTRACT_EXPIRED",
                  );

                  return (
                    <tr key={d.id} className={`row-${d.status}`}>
                      <td>
                        <div className="personnel-info">
                          <div className="avatar-sm">
                            {d.candidate_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="personnel-name">{d.candidate_name}</span>
                        </div>
                      </td>
                      <td className="assignment-cell">{d.job_title}</td>
                      <td>
                        <div className="client-info">
                          <span className="client-company">{d.client?.company_name}</span>
                          {d.client?.location && (
                            <span className="client-location"><MapPin size={14} className="inline-icon"/> {d.client.location}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="status-cell">
                          <span className={`status-pill pill-${d.status}`}>
                            {d.status}
                          </span>
                          {autoTerminatedByContract && (
                            <span className="status-hint">
                              Auto-terminated (Contract Expired)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="date-cell">
                        {new Date(d.start_date).toLocaleDateString()}
                      </td>
                      <td>
                        {days === null ? (
                          <span className="countdown-na">No end date</span>
                        ) : isExpired ? (
                          <span className="countdown-expired">
                            <AlertCircle size={14} className="inline-icon"/> Expired ({Math.abs(days)}d ago)
                          </span>
                        ) : isExpiring ? (
                          <span className="countdown-warning">
                            <AlertTriangle size={14} className="inline-icon"/> {days} days left
                          </span>
                        ) : (
                          <span className="countdown-ok">
                            {days} days left
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          value={d.status}
                          onChange={(e) => handleStatusChange(d.id, e.target.value)}
                          className="action-select"
                        >
                          <option value="active">Active</option>
                          <option value="completed">Complete</option>
                          <option value="terminated">Terminate</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Client Directory View */
        <div className="client-grid">
          {clients.filter(c => 
              c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.location?.toLowerCase().includes(searchTerm.toLowerCase())
            ).length === 0 ? (
            <div className="empty-state-full">
               <span className="empty-icon-lg"><Building2 size={48} /></span>
               <p>No clients found matching "{searchTerm}"</p>
               <button className="deploy-btn primary" onClick={() => setShowClientModal(true)}>
                 Add Your First Client
               </button>
            </div>
          ) : (
            clients.filter(c => 
              c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.location?.toLowerCase().includes(searchTerm.toLowerCase())
            ).map(client => (
              <div key={client.id} className="client-card">
                <div className="client-card-header">
                  <div className="client-logo-placeholder">
                    {client.company_name?.charAt(0)}
                  </div>
                  <div className="client-main-info">
                    <h3>{client.company_name}</h3>
                    <span className="client-loc-badge"><MapPin size={14} className="inline-icon"/> {client.location || "Remote"}</span>
                  </div>
                </div>
                <div className="client-card-body">
                  <div className="contact-row">
                    <span className="contact-label">Contact</span>
                    <span className="contact-value">{client.contact_person || "Not specified"}</span>
                  </div>
                  <div className="contact-row">
                    <span className="contact-label">Email</span>
                    <span className="contact-value">{client.email || "---"}</span>
                  </div>
                  <div className="contact-row">
                    <span className="contact-label">Phone</span>
                    <span className="contact-value">{client.phone || "---"}</span>
                  </div>
                </div>
                <div className="client-card-footer">
                  <div className="client-stats-mini">
                    <span className="mini-stat">
                      <strong>{deployments.filter(d => d.client_id === client.id && d.status === "active").length}</strong> Active
                    </span>
                  </div>
                  <button className="edit-client-btn" onClick={() => {
                    setClientForm(client);
                    setShowClientModal(true);
                  }}>
                    Edit Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="modal-overlay" onClick={() => setShowDeployModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex-title"><Rocket size={24} /> Deploy Candidate</h2>
            <form onSubmit={handleDeploy}>
              <div className="modal-field">
                <label>Candidate (Hired/Offered)</label>
                <select
                  required
                  value={deployForm.application_id}
                  onChange={(e) =>
                    setDeployForm({ ...deployForm, application_id: e.target.value })
                  }
                >
                  <option value="">Select candidate...</option>
                  {hiredApps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.candidate_name} — {a.job_title} ({a.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label>Client Organization</label>
                <select
                  required
                  value={deployForm.client_id}
                  onChange={(e) =>
                    setDeployForm({ ...deployForm, client_id: e.target.value })
                  }
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} — {c.location || "No location"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label>Contract End Date</label>
                <input
                  type="date"
                  value={deployForm.end_date}
                  onChange={(e) =>
                    setDeployForm({ ...deployForm, end_date: e.target.value })
                  }
                />
              </div>
              <div className="modal-field">
                <label>Notes (Optional)</label>
                <textarea
                  value={deployForm.notes}
                  onChange={(e) =>
                    setDeployForm({ ...deployForm, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Any additional deployment details..."
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="deploy-btn secondary"
                  onClick={() => setShowDeployModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="deploy-btn primary"
                  disabled={deployLoading}
                >
                  {deployLoading ? "Deploying..." : "Deploy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Modal */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex-title"><Building2 size={24} /> Add New Client</h2>
            <form onSubmit={handleCreateClient}>
              <div className="modal-field">
                <label>Company Name *</label>
                <input
                  required
                  value={clientForm.company_name}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, company_name: e.target.value })
                  }
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Contact Person</label>
                  <input
                    value={clientForm.contact_person}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, contact_person: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="modal-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, email: e.target.value })
                    }
                    placeholder="john@acme.com"
                  />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Phone</label>
                  <input
                    value={clientForm.phone}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, phone: e.target.value })
                    }
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <div className="modal-field">
                  <label>Location</label>
                  <input
                    value={clientForm.location}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, location: e.target.value })
                    }
                    placeholder="Makati City"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="deploy-btn secondary"
                  onClick={() => setShowClientModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="deploy-btn primary">
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManpowerDeployment;
