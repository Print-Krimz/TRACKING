import { useState, useEffect } from "react";
import { 
  getAnalyticsOverview, 
  getTimeToHire, 
  getPipelineByJob, 
  getApplicationTrends, 
  getSkillDistribution,
  getDashboardAlerts 
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
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { 
  Briefcase, 
  Users, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Lightbulb,
  TrendingUp,
  BarChart3
} from "lucide-react";
import "./AnalyticsDashboard.css";

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(30);

  // Data states
  const [overview, setOverview] = useState(null);
  const [timeToHire, setTimeToHire] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [trends, setTrends] = useState([]);
  const [skills, setSkills] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewData,
        hireData,
        pipelineData,
        trendsData,
        skillsData,
        alertsData
      ] = await Promise.all([
        getAnalyticsOverview(),
        getTimeToHire(timeRange),
        getPipelineByJob(5), // Top 5 jobs
        getApplicationTrends(timeRange),
        getSkillDistribution(),
        getDashboardAlerts()
      ]);

      setOverview(overviewData);
      setTimeToHire(hireData);
      setPipeline(pipelineData.jobs || []);
      setTrends(trendsData.trends || []);
      setSkills(skillsData.skills || []);
      setAlerts(alertsData.alerts || []);
    } catch (err) {
      console.error("Failed to load analytics data", err);
      setError("Unable to load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "warning": return <AlertTriangle size={18} />;
      case "error": return <AlertCircle size={18} />;
      default: return <Lightbulb size={18} />;
    }
  };

  // Format pipeline data for Stacked Bar Chart
  const formattedPipeline = pipeline.map(job => ({
    name: job.job_title.length > 20 ? job.job_title.substring(0, 20) + "..." : job.job_title,
    Received: job.breakdown.received || 0,
    Screening: job.breakdown.screening || 0,
    Interview: job.breakdown.interview || 0,
    Offer: job.breakdown.offer || 0,
    Hired: job.breakdown.hired || 0,
  }));

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Crunching the numbers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <AlertTriangle size={48} />
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={fetchDashboardData}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1><BarChart3 size={28} className="inline-icon" /> Professional Analytics</h1>
          <p className="analytics-subtitle">Track recruitment performance and pipeline health.</p>
        </div>
        <div className="time-filter">
          <label>Time Range:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><Briefcase size={24} /></div>
          <div className="kpi-info">
            <h3>Total Open Jobs</h3>
            <span className="kpi-value">{overview?.open_jobs || 0}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Users size={24} /></div>
          <div className="kpi-info">
            <h3>Total Applications</h3>
            <span className="kpi-value">{overview?.total_applications || 0}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Clock size={24} /></div>
          <div className="kpi-info">
            <h3>Avg. Time to Hire</h3>
            <span className="kpi-value">{timeToHire?.average_days || 0} <small>days</small></span>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Main Chart: Volume Trends */}
        <div className="chart-card span-2">
          <div className="chart-header">
            <h3><TrendingUp size={20} className="inline-icon" /> Application Volume Trends</h3>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#4f46e5" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actionable Alerts */}
        <div className="chart-card alerts-panel">
          <div className="chart-header">
            <h3>Intelligent Alerts</h3>
          </div>
          <div className="alerts-body">
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <div key={idx} className={`analytics-alert alert-${alert.type}`}>
                  <div className="alert-icon-wrapper">
                    {getAlertIcon(alert.type)}
                  </div>
                  <p>{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="empty-alerts">
                <CheckCircle2 size={48} />
                <p>All clear! No critical alerts right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Stacked Bar */}
        <div className="chart-card span-2">
          <div className="chart-header">
            <h3>Pipeline Health by Job</h3>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={formattedPipeline} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  cursor={{fill: '#334155', opacity: 0.4}}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Received" stackId="a" fill="#64748b" />
                <Bar dataKey="Screening" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Interview" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Offer" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Hired" stackId="a" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skill Distribution Radar */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Skill Supply vs Demand</h3>
          </div>
          <div className="chart-body" style={{ display: 'flex', justifyContent: 'center' }}>
            {skills.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skills}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} stroke="#475569" />
                  <Radar name="Required" dataKey="required" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.3} />
                  <Radar name="Found in Resumes" dataKey="matched" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
                  <Legend />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-skills">
                <p>Not enough skill data to generate radar chart.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsDashboard;
