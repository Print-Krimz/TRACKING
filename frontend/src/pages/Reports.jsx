import { useState, useEffect } from "react";
import {
  getAnalyticsOverview,
  getTimeToHire,
  getPipelineByJob,
  getApplicationTrends,
  downloadReport,
  getJobs,
  getApplications,
  createReportSchedule,
  deleteReportSchedule,
  getReportSchedules,
  getAutomationMetrics,
} from "../services/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from "recharts";
import { Download, RefreshCw, ChevronDown, Calendar } from "lucide-react";
import "./Reports.css";
import { useToast } from "../context/ToastContext";

const Reports = () => {
  const { showToast } = useToast();
  const formatScheduleDate = (value) => {
    if (!value) return "Never";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  // Data States
  const [overview, setOverview] = useState(null);
  const [timeToHire, setTimeToHire] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [trends, setTrends] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentCandidates, setRecentCandidates] = useState([]);
  const [automationMetrics, setAutomationMetrics] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    name: "Weekly Pipeline Report",
    report_type: "pipeline",
    format: "json",
    cadence: "weekly",
    delivery_channel: "in_app",
    recipient_email: "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Pagination States
  const [candidatePage, setCandidatePage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Date Range (Mock logic for UI, defaults to this year)
  const [dateRange, setDateRange] = useState("This year, Jan 1 2026 - Dec 31 2026");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        overviewData,
        hireData,
        pipelineData,
        trendsData,
        jobsData,
        applicantsData,
        automationData,
        schedulesData,
      ] = await Promise.all([
        getAnalyticsOverview().catch(() => ({ open_jobs: 0, total_applications: 0 })),
        getTimeToHire(365).catch(() => ({ average_days: 0 })),
        getPipelineByJob(5).catch(() => ({ jobs: [] })),
        getApplicationTrends(30).catch(() => ({ trends: [] })),
        getJobs().catch(() => ({ jobs: [] })),
        getApplications().catch(() => ({ applications: [] })),
        getAutomationMetrics().catch(() => null),
        getReportSchedules().catch(() => ({ schedules: [] })),
      ]);

      setOverview(overviewData);
      setTimeToHire(hireData);
      setPipeline(pipelineData.jobs || []);
      setTrends(trendsData.trends || []);
      
      setRecentJobs(jobsData.jobs || []);
      setRecentCandidates(applicantsData.applications || []);
      setAutomationMetrics(automationData);
      setSchedules(schedulesData.schedules || []);
      setCandidatePage(1);
      setJobPage(1);
      
    } catch (err) {
      console.error("Error loading reports data:", err);
      showToast("Failed to load some report data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    setSavingSchedule(true);
    try {
      const created = await createReportSchedule({
        ...scheduleForm,
        config: {},
      });
      setSchedules((prev) => [created, ...prev]);
      showToast("Scheduled report created", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to create schedule", "error");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await deleteReportSchedule(scheduleId);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      showToast("Scheduled report removed", "success");
    } catch {
      showToast("Failed to delete schedule", "error");
    }
  };

  const handleDownload = async (format) => {
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      const response = await downloadReport({
        report_type: "pipeline",
        format: format,
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Recruitment_Report_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Report downloaded as ${format.toUpperCase()}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to download report", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Funnel Data Calculation
  const totalReceived = pipeline.reduce((acc, job) => acc + (job.breakdown?.received || 0), 0);
  const totalHired = pipeline.reduce((acc, job) => acc + (job.breakdown?.hired || 0), 0);
  const hiringRate = totalReceived > 0 ? ((totalHired / totalReceived) * 100).toFixed(1) : 0;
  
  // Create funnel stages for the chart
  const funnelData = [
    { name: "Application", value: totalReceived },
    { name: "Screening", value: pipeline.reduce((acc, job) => acc + (job.breakdown?.screening || 0), 0) },
    { name: "Interview", value: pipeline.reduce((acc, job) => acc + (job.breakdown?.interview || 0), 0) },
    { name: "Offer", value: pipeline.reduce((acc, job) => acc + (job.breakdown?.offer || 0), 0) },
    { name: "Hired", value: totalHired },
  ];

  // Pagination Helpers
  const paginatedCandidates = recentCandidates.slice((candidatePage - 1) * ITEMS_PER_PAGE, candidatePage * ITEMS_PER_PAGE);
  const totalCandidatePages = Math.ceil(recentCandidates.length / ITEMS_PER_PAGE);

  const paginatedJobs = recentJobs.slice((jobPage - 1) * ITEMS_PER_PAGE, jobPage * ITEMS_PER_PAGE);
  const totalJobPages = Math.ceil(recentJobs.length / ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="reports-loading">
        <div className="spinner"></div>
        <p>Loading Reports...</p>
      </div>
    );
  }

  return (
    <div className="reports-dashboard">
      {/* HEADER ROW */}
      <div className="reports-header-row">
        <div>
          <h1>Reports</h1>
          <p>Monitor key metrics, spot trends, and improve your hiring process with updated reports.</p>
        </div>
        <div className="reports-actions">
          <div className="download-dropdown-container">
            <button 
              className="btn-primary" 
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={downloading}
            >
              <Download size={16} /> 
              {downloading ? "Downloading..." : "Download"}
              <ChevronDown size={16} style={{ marginLeft: "4px" }} />
            </button>
            {showDownloadMenu && (
              <div className="download-menu">
                <button onClick={() => handleDownload("csv")}>Download as CSV</button>
                <button onClick={() => handleDownload("pdf")}>Download as PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILTER ROW */}
      <div className="reports-filter-row">
        <div className="filters-left">
          <button className="filter-btn">
            Company Reports <ChevronDown size={14} />
          </button>
          <button className="filter-btn date-filter">
            <Calendar size={14} /> {dateRange} <ChevronDown size={14} />
          </button>
          <span className="reset-link">Reset</span>
        </div>
        <button className="refresh-btn" onClick={fetchDashboardData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="reports-kpi-grid">
        <div className="kpi-card">
          <h4>Total Candidates</h4>
          <h2>{overview?.total_applications || 0}</h2>
          <span className="kpi-subtext">New Candidates</span>
        </div>
        <div className="kpi-card">
          <h4>Open Jobs</h4>
          <h2>{overview?.open_jobs || 0}</h2>
          <span className="kpi-subtext">New jobs</span>
        </div>
        <div className="kpi-card">
          <h4>Open Jobs Progress</h4>
          <h2>0%</h2>
          <span className="kpi-subtext">Completed</span>
        </div>
        <div className="kpi-card">
          <h4>Avg. Time to Hire</h4>
          <h2>{timeToHire?.average_days || 0} days</h2>
          <span className="kpi-subtext">Hired</span>
        </div>
        <div className="kpi-card">
          <h4>Avg. Time to Deploy</h4>
          <h2>0 days</h2>
          <span className="kpi-subtext">Deployed</span>
        </div>
        <div className="kpi-card">
          <h4>Automation Success</h4>
          <h2>{automationMetrics?.success_rate || 0}%</h2>
          <span className="kpi-subtext">{automationMetrics?.avg_latency_ms || 0} ms avg</span>
        </div>
      </div>

      <div className="report-panel" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-header">
          <h3>Scheduled Reports</h3>
        </div>
        <div className="panel-body">
          <div className="form-row" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <input value={scheduleForm.name} onChange={(e) => setScheduleForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Schedule name" />
            <select value={scheduleForm.report_type} onChange={(e) => setScheduleForm((prev) => ({ ...prev, report_type: e.target.value }))}>
              <option value="pipeline">Pipeline</option>
              <option value="match_scores">Match Scores</option>
              <option value="usage">Usage</option>
            </select>
            <select value={scheduleForm.format} onChange={(e) => setScheduleForm((prev) => ({ ...prev, format: e.target.value }))}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="pdf">PDF</option>
            </select>
            <select value={scheduleForm.cadence} onChange={(e) => setScheduleForm((prev) => ({ ...prev, cadence: e.target.value }))}>
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select value={scheduleForm.delivery_channel} onChange={(e) => setScheduleForm((prev) => ({ ...prev, delivery_channel: e.target.value }))}>
              <option value="in_app">In App</option>
              <option value="email">Email</option>
              <option value="both">Both</option>
            </select>
            <input
              value={scheduleForm.recipient_email}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, recipient_email: e.target.value }))}
              placeholder="Recipient email (optional)"
            />
            <button className="btn-primary" onClick={handleCreateSchedule} disabled={savingSchedule}>
              {savingSchedule ? "Saving..." : "Create Schedule"}
            </button>
          </div>
          <div className="simple-list" style={{ marginTop: "1rem" }}>
            {schedules.length === 0 ? (
              <div className="empty-state">No scheduled reports yet.</div>
            ) : (
              schedules.map((schedule) => (
                <div key={schedule.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <span>{schedule.name} - {schedule.cadence}</span>
                    <small style={{ color: "var(--text-muted, #6b7280)" }}>
                      Last run: {formatScheduleDate(schedule.last_run_at)} | Next run: {formatScheduleDate(schedule.next_run_at)}
                    </small>
                  </div>
                  <button onClick={() => handleDeleteSchedule(schedule.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2-COLUMN GRID (Top Panels) */}
      <div className="reports-split-grid">
        {/* New Candidates Panel */}
        <div className="report-panel">
          <div className="panel-header">
            <h3>New Candidates</h3>
            <a href="/applicants">Show All</a>
          </div>
          <div className="panel-body">
            {recentCandidates.length > 0 ? (
              <>
                <ul className="simple-list">
                  {paginatedCandidates.map(c => (
                    <li key={c.id}>{c.applicant?.user?.username || `Applicant #${c.id}`} - {c.status}</li>
                  ))}
                </ul>
                {totalCandidatePages > 1 && (
                  <div className="pagination-controls">
                    <button 
                      onClick={() => setCandidatePage(p => Math.max(1, p - 1))}
                      disabled={candidatePage === 1}
                    >Prev</button>
                    <span>Page {candidatePage} of {totalCandidatePages}</span>
                    <button 
                      onClick={() => setCandidatePage(p => Math.min(totalCandidatePages, p + 1))}
                      disabled={candidatePage === totalCandidatePages}
                    >Next</button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">No candidates data found.</div>
            )}
          </div>
        </div>

        {/* Empty Placeholder Panel */}
        <div className="report-panel">
          <div className="panel-body">
            <div className="empty-state">No candidate data to display.</div>
          </div>
        </div>
      </div>

      {/* FULL WIDTH JOBS PANEL */}
      <div className="report-panel full-width">
        <div className="panel-header">
          <h3>Jobs</h3>
          <a href="/dashboard">Show All</a>
        </div>
        <div className="panel-body">
          {recentJobs.length > 0 ? (
             <>
               <ul className="simple-list horizontal">
                 {paginatedJobs.map(j => (
                   <li key={j.id}>{j.title} <span className="badge">{j.status}</span></li>
                 ))}
               </ul>
               {totalJobPages > 1 && (
                 <div className="pagination-controls">
                   <button 
                     onClick={() => setJobPage(p => Math.max(1, p - 1))}
                     disabled={jobPage === 1}
                   >Prev</button>
                   <span>Page {jobPage} of {totalJobPages}</span>
                   <button 
                     onClick={() => setJobPage(p => Math.min(totalJobPages, p + 1))}
                     disabled={jobPage === totalJobPages}
                   >Next</button>
                 </div>
               )}
             </>
          ) : (
            <div className="empty-state">No job data found.</div>
          )}
        </div>
      </div>

      {/* 2-COLUMN GRID (Middle Panels) */}
      <div className="reports-split-grid">
        {/* Hiring Lead Time Chart */}
        <div className="report-panel">
          <div className="panel-header">
            <h3>Hiring Lead Time</h3>
            <a href="#">Show All</a>
          </div>
          <div className="panel-body">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} allowDecimals={false} />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#dbeafe" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No Hiring data found for this period.</div>
            )}
          </div>
        </div>

        {/* Hiring Source Table */}
        <div className="report-panel">
          <div className="panel-header">
            <h3>Hiring Source</h3>
          </div>
          <div className="panel-body">
             <div className="source-legend">
               <span className="dot applications"></span> Applications
               <span className="dot hired"></span> Hired
             </div>
             <table className="source-table">
               <tbody>
                 <tr><td>New candidate</td><td>0</td><td>0</td></tr>
                 <tr><td>Application Link</td><td>{totalReceived}</td><td>{totalHired}</td></tr>
                 <tr><td>Shared Resume (Explore Jobs)</td><td>0</td><td>0</td></tr>
                 <tr><td>Facebook</td><td>0</td><td>0</td></tr>
                 <tr><td>Add to Job</td><td>0</td><td>0</td></tr>
               </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* FULL WIDTH FUNNEL PANEL */}
      <div className="report-panel full-width">
        <div className="panel-header">
          <h3>Hiring Funnel</h3>
        </div>
        <div className="panel-body funnel-body">
          <div className="funnel-kpis">
            <div className="fkpi">
              <span>Hiring Rate</span>
              <h3>{hiringRate}%</h3>
            </div>
            <div className="fkpi">
              <span>Deployed Rate</span>
              <h3>0%</h3>
            </div>
          </div>
          
          <div className="funnel-chart-container">
            {totalReceived > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="#2563eb">
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === funnelData.length - 1 ? "#10b981" : "#2563eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="empty-state">Not enough data to display funnel.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Reports;
