/**
 * Main App Component
 *
 * Root component that sets up routing for the application.
 * Uses a Layout shell with sidebar navigation for authenticated users.
 *
 * Route Structure:
 * - Public: /login, /register
 * - Protected (any role): /dashboard, /jobs
 * - Applicant: /my-resumes, /my-applications
 * - Recruiter/Admin/Control Panel Admin: /applicants, /resumes, /reports
 * - Admin roles: /admin-control-panel
 * - Shared: /resumes/:id, /jobs/:id (with role-based permissions)
 */

import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Components
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Loading from "./components/Loading";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import ResumeList from "./pages/ResumeList";
import DocumentVault from "./pages/DocumentVault";
import AnalysisView from "./pages/AnalysisView";
import JobList from "./pages/JobList";
import MyApplications from "./pages/MyApplications";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import CandidateRanking from "./pages/CandidateRanking";
import JobCreate from "./pages/JobCreate";
import JobDetail from "./pages/JobDetail";
import AllApplicants from "./pages/AllApplicants";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import ManpowerDeployment from "./pages/ManpowerDeployment";
import AdminControlPanel from "./pages/AdminControlPanel";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import UserSettings from "./pages/UserSettings";

/**
 * DashboardRouter
 *
 * Renders the appropriate dashboard based on user role:
 * - Recruiter/Admin/Control Panel Admin → RecruiterDashboard (pipeline view)
 * - Applicant → Applicant Dashboard (stats + quick actions)
 */
const DashboardRouter = () => {
  const { isRecruiter, isAdmin, isControlPanelAdmin } = useAuth();

  if (isRecruiter || isAdmin || isControlPanelAdmin) {
    return <RecruiterDashboard />;
  }

  return <Dashboard />;
};

/**
 * App Component
 *
 * Sets up the application routes with role-based access control.
 * - Public routes are accessible to all (no Layout)
 * - Protected routes require authentication (wrapped in Layout)
 * - Some routes are restricted to specific roles
 */
function App() {
  const { loading } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark"); // Default
    }
  }, []);

  // Show loading screen during initial auth check
  if (loading) {
    return <Loading message="Loading application..." />;
  }

  return (
    <Layout>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard — role-based rendering */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardRouter />
            </PrivateRoute>
          }
        />

        {/* Legacy recruiter route → redirect to dashboard */}
        <Route
          path="/recruiter"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Jobs - All authenticated users */}
        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              <JobList />
            </PrivateRoute>
          }
        />

        {/* Job Creation - Recruiters and Admins */}
        <Route
          path="/jobs/create"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <JobCreate />
            </PrivateRoute>
          }
        />

        {/* Job Detail - All authenticated users */}
        <Route
          path="/jobs/:id"
          element={
            <PrivateRoute>
              <JobDetail />
            </PrivateRoute>
          }
        />

        {/* Candidate Ranking - Recruiters and Admins */}
        <Route
          path="/jobs/:jobId/ranking"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <CandidateRanking />
            </PrivateRoute>
          }
        />

        {/* Job Applicants - redirect to AllApplicants with job filter */}
        <Route
          path="/jobs/:jobId/applicants"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <AllApplicants />
            </PrivateRoute>
          }
        />

        {/* All Applicants - Recruiters and Admins */}
        <Route
          path="/applicants"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <AllApplicants />
            </PrivateRoute>
          }
        />

        {/* Reports - Recruiters and Admins */}
        <Route
          path="/reports"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <Reports />
            </PrivateRoute>
          }
        />

        {/* Vault (Digital 201 File) - Applicants only */}
        <Route
          path="/vault"
          element={
            <PrivateRoute allowedRoles={["Applicant"]}>
              <DocumentVault />
            </PrivateRoute>
          }
        />

        {/* My Applications - Applicants only */}
        <Route
          path="/my-applications"
          element={
            <PrivateRoute allowedRoles={["Applicant"]}>
              <MyApplications />
            </PrivateRoute>
          }
        />

        {/* My Resumes - Applicants only (includes upload) */}
        <Route
          path="/my-resumes"
          element={
            <PrivateRoute allowedRoles={["Applicant"]}>
              <ResumeList />
            </PrivateRoute>
          }
        />

        {/* Legacy submit-resume → redirect to my-resumes */}
        <Route
          path="/submit-resume"
          element={<Navigate to="/my-resumes" replace />}
        />

        {/* All Resumes - Recruiters and Admins */}
        <Route
          path="/resumes"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <ResumeList />
            </PrivateRoute>
          }
        />

        {/* Single Resume View */}
        <Route
          path="/resumes/:id"
          element={
            <PrivateRoute>
              <AnalysisView />
            </PrivateRoute>
          }
        />

        {/* User Settings - All authenticated users */}
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <UserSettings />
            </PrivateRoute>
          }
        />

        {/* Analytics Dashboard - Recruiters and Admins */}
        <Route
          path="/analytics"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <AnalyticsDashboard />
            </PrivateRoute>
          }
        />

        {/* Admin Control Panel */}
        <Route
          path="/admin-control-panel"
          element={
            <PrivateRoute allowedRoles={["Admin", "Control Panel Admin"]}>
              <AdminControlPanel />
            </PrivateRoute>
          }
        />

        {/* Legacy admin route */}
        <Route
          path="/users"
          element={
            <PrivateRoute allowedRoles={["Admin", "Control Panel Admin"]}>
              <Navigate to="/admin-control-panel" replace />
            </PrivateRoute>
          }
        />

        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Phase 3: Manpower Deployments (ERP) */}
        <Route
          path="/deployments"
          element={
            <PrivateRoute
              allowedRoles={["Recruiter", "Admin", "Control Panel Admin"]}
            >
              <ManpowerDeployment />
            </PrivateRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
