/**
 * API Service Module
 *
 * Centralized API communication layer using Axios.
 * Handles all HTTP requests to the FastAPI backend.
 *
 * Features:
 * - Automatic JWT token injection
 * - Base URL configuration
 * - Error handling
 * - Request/Response interceptors
 *
 * Architecture Note:
 * All API calls go through this service, ensuring consistent
 * authentication and error handling across the application.
 */

import axios from "axios";

// Base URL for API requests
// In development, this goes through Vite's proxy to avoid CORS issues
// In production, update this to the actual API URL
const API_URL = import.meta.env.VITE_API_URL || "/api";

/**
 * Create an Axios instance with default configuration.
 * This instance is used for all API requests.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Request Interceptor
 *
 * Automatically adds the JWT token to all outgoing requests.
 * The token is retrieved from localStorage where it's stored
 * after successful login.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Response Interceptor
 *
 * Handles common response scenarios:
 * - 401 Unauthorized: Clears token and redirects to login
 * - Other errors: Passes through for component-level handling
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Optionally redirect to login
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// =============================================================================
// Authentication API Methods
// =============================================================================

/**
 * Register a new user account.
 *
 * @param {Object} userData - Registration data
 * @param {string} userData.username - Desired username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password (min 6 chars)
 * @param {string} userData.role_name - Role: 'Applicant' or 'Recruiter'
 * @returns {Promise<Object>} Created user data
 */
export const register = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

/**
 * Login with username and password.
 *
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @returns {Promise<Object>} Token and user data
 */
export const login = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

// =============================================================================
// User API Methods
// =============================================================================

/**
 * Get current user's information.
 * Requires authentication.
 *
 * @returns {Promise<Object>} Current user data with role
 */
export const getCurrentUser = async () => {
  const response = await api.get("/users/me");
  return response.data;
};

/**
 * Update current user's profile.
 *
 * @param {Object} data - Profile data (username, email)
 * @returns {Promise<Object>} Updated user data
 */
export const updateProfile = async (data) => {
  const response = await api.put("/users/me", data);
  return response.data;
};

/**
 * Change current user's password.
 *
 * @param {Object} data - Password data (current_password, new_password)
 * @returns {Promise<Object>} Success message
 */
export const changePassword = async (data) => {
  const response = await api.put("/users/me/password", data);
  return response.data;
};

/**
 * Get all users in the system.
 * Requires 'manage_users' permission (Admin only).
 *
 * @returns {Promise<Object>} List of all users
 */
export const getAllUsers = async () => {
  const response = await api.get("/users/");
  return response.data;
};

/**
 * Assign a role to a user.
 * Requires 'manage_roles' permission (Admin only).
 *
 * @param {number} userId - ID of user to update
 * @param {string} roleName - New role name
 * @returns {Promise<Object>} Updated user data
 */
export const assignRole = async (userId, roleName) => {
  const response = await api.put(`/users/${userId}/role`, {
    role_name: roleName,
  });
  return response.data;
};

/**
 * Get all available roles.
 * Requires authentication.
 *
 * @returns {Promise<Array>} List of roles with permissions
 */
export const getAllRoles = async () => {
  const response = await api.get("/roles/");
  return response.data;
};

// =============================================================================
// Resume API Methods
// =============================================================================

/**
 * Submit a new resume.
 * Requires 'submit_resume' permission (Applicant only).
 *
 * @param {string} content - Resume text content
 * @returns {Promise<Object>} Created resume data
 */
export const submitResume = async (content) => {
  const response = await api.post("/resumes/", { content });
  return response.data;
};

/**
 * Upload a resume file (PDF or DOCX).
 * Requires 'submit_resume' permission (Applicant only).
 *
 * The backend will extract text from the file for AI analysis.
 *
 * @param {File} file - Resume file (PDF or DOCX)
 * @returns {Promise<Object>} Created resume data with extracted text
 */
export const submitResumeFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/resumes/upload", formData, {
    headers: {
      "Content-Type": undefined, // Let Axios auto-set with boundary
    },
  });
  return response.data;
};

/**
 * Get all accessible resumes.
 * - Applicants see only their own resumes
 * - Recruiters/Admins see all resumes
 *
 * @returns {Promise<Object>} List of resumes
 */
export const getResumes = async (options = {}) => {
  const response = await api.get("/resumes/", { params: options });
  return response.data;
};

/**
 * Get a specific resume by ID.
 *
 * @param {number} resumeId - ID of resume to retrieve
 * @returns {Promise<Object>} Resume data
 */
export const getResumeById = async (resumeId) => {
  const response = await api.get(`/resumes/${resumeId}`);
  return response.data;
};

/**
 * Trigger AI analysis on a resume.
 * Requires 'analyze_resume' permission (Recruiter/Admin only).
 *
 * This calls the Gemini API to analyze the resume and returns
 * structured feedback including score, strengths, and recommendations.
 *
 * @param {number} resumeId - ID of resume to analyze
 * @param {Object} options - Analysis options
 * @param {string} options.job_role - Target job role for context
 * @returns {Promise<Object>} Resume with analysis result
 */
export const analyzeResume = async (resumeId, options = {}) => {
  const response = await api.post(`/resumes/${resumeId}/analyze`, {
    job_role: options.job_role || "software engineer",
    additional_context: options.additional_context || null,
  });
  return response.data;
};

/**
 * Delete a resume.
 * Users can delete their own resumes; Admins can delete any.
 *
 * @param {number} resumeId - ID of resume to delete
 * @returns {Promise<void>}
 */
export const deleteResume = async (resumeId) => {
  await api.delete(`/resumes/${resumeId}`);
};

// =============================================================================
// Job API Functions
// =============================================================================

/**
 * Get all job requisitions.
 * Candidates see only OPEN jobs; Recruiters/Admins see all.
 *
 * @param {Object} options - Query options
 * @returns {Promise<Object>} List of jobs
 */
export const getJobs = async (options = {}) => {
  const response = await api.get("/jobs/", { params: options });
  return response.data;
};

/**
 * Get a specific job by ID.
 *
 * @param {number} jobId - ID of job to retrieve
 * @returns {Promise<Object>} Job data
 */
export const getJobById = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const getJob = getJobById;

/**
 * Create a new job requisition.
 * Requires 'manage_jobs' permission (Recruiter/Admin).
 *
 * @param {Object} jobData - Job details and criteria
 * @returns {Promise<Object>} Created job data
 */
export const createJob = async (jobData) => {
  const response = await api.post("/jobs/", jobData);
  return response.data;
};

/**
 * @returns {Promise<Object>} Updated job
 */
export const updateJob = async (jobId, jobData) => {
  const response = await api.put(`/jobs/${jobId}`, jobData);
  return response.data;
};

/**
 * Delete a job requisition.
 * Requires 'manage_jobs' permission.
 *
 * @param {number} jobId - ID of job to delete
 * @returns {Promise<void>}
 */
export const deleteJob = async (jobId) => {
  await api.delete(`/jobs/${jobId}`);
};

/**
 * Extract keywords from job description using AI.
 * Requires 'manage_jobs' permission.
 *
 * @param {number} jobId - ID of job
 * @returns {Promise<Object>} Extracted keywords
 */
export const extractJobKeywords = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/extract-keywords`);
  return response.data;
};

// =============================================================================
// Application API Functions
// =============================================================================

/**
 * Get role-based quiz questions for a job application.
 *
 * @param {number} jobId - ID of job to apply to
 * @returns {Promise<Object>} Quiz payload
 */
export const getJobQuiz = async (jobId) => {
  const response = await api.get(`/applications/quiz/${jobId}`);
  return response.data;
};

/**
 * Apply to a job with completed quiz answers.
 * Requires 'apply_to_job' permission (Candidate only).
 *
 * @param {number} jobId - ID of job to apply to
 * @param {number} resumeId - Optional resume ID
 * @param {Array} quizAnswers - Required quiz answers
 * @returns {Promise<Object>} Created application with quiz result
 */
export const applyToJob = async (jobId, resumeId = null, quizAnswers = []) => {
  const response = await api.post("/applications/", {
    job_id: jobId,
    resume_id: resumeId,
    quiz_answers: quizAnswers,
  });
  return response.data;
};

/**
 * Get all applications.
 * Candidates see only their own; Recruiters/Admins see all.
 *
 * @param {number} jobId - Optional job ID filter
 * @returns {Promise<Object>} List of applications
 */
export const getApplications = async (jobId = null, options = {}) => {
  const params = { ...options };
  if (jobId) params.job_id = jobId;
  const response = await api.get("/applications/", { params });
  return response.data;
};

// ==========================================
// DOCUMENTS (DIGITAL 201 VAULT)
// ==========================================

export const uploadDocument = async (file, type, expirationDate = null) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", type);
  if (expirationDate) {
    formData.append("expiration_date", expirationDate);
  }
  
  const response = await api.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getDocuments = async () => {
  const response = await api.get("/documents/");
  return response.data;
};

export const getUserDocuments = async (userId) => {
  const response = await api.get(`/documents/user/${userId}`);
  return response.data;
};

export const downloadDocument = async (docId) => {
  const response = await api.get(`/documents/${docId}/download`, {
    responseType: "blob",
  });
  return response.data;
};

export const deleteDocument = async (docId) => {
  const response = await api.delete(`/documents/${docId}`);
  return response.data;
};

/**
 * Get candidate's own applications with timeline.
 *
 * @returns {Promise<Object>} List of candidate's applications
 */
export const getMyApplications = async (options = {}) => {
  const response = await api.get("/applications/my-applications", { params: options });
  return response.data;
};

export const getApplicationMessages = async (
  applicationId,
  { page = 1, limit = 50, signal } = {},
) => {
  const response = await api.get(`/applications/${applicationId}/messages`, {
    params: { page, limit },
    signal,
  });
  return response.data;
};

export const sendApplicationMessage = async (applicationId, body) => {
  const response = await api.post(`/applications/${applicationId}/messages`, { body });
  return response.data;
};

export const markApplicationMessagesRead = async (applicationId, messageIds = null) => {
  const response = await api.patch(`/applications/${applicationId}/messages/read`, {
    message_ids: messageIds,
  });
  return response.data;
};

export const getUnreadMessageCount = async () => {
  const response = await api.get("/messages/unread-count");
  return response.data;
};

export const createInterview = async (applicationId, data) => {
  const response = await api.post(`/applications/${applicationId}/interviews`, data);
  return response.data;
};

export const getApplicationInterviews = async (applicationId) => {
  const response = await api.get(`/applications/${applicationId}/interviews`);
  return response.data;
};

export const updateInterview = async (interviewId, data) => {
  const response = await api.patch(`/interviews/${interviewId}`, data);
  return response.data;
};

export const getUpcomingInterviews = async (params = {}) => {
  const response = await api.get("/interviews/upcoming", { params });
  return response.data;
};

export const getNotifications = async (params = {}) => {
  const response = await api.get("/notifications/", { params });
  return response.data;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

export const getJobMatchBreakdown = async (appId) => {
  const response = await api.get(`/matching/applications/${appId}/breakdown`);
  return response.data;
};

export const getJobAiSummary = async (jobId) => {
  const response = await api.get(`/matching/jobs/${jobId}/ai-summary`);
  return response.data;
};

// ==========================================
// Phase 3: ERP Modules (Clients & Deployments)
// ==========================================

export const getClients = async () => {
  const response = await api.get("/clients/");
  return response.data;
};

export const createClient = async (clientData) => {
  const response = await api.post("/clients/", clientData);
  return response.data;
};

export const updateClient = async (clientId, clientData) => {
  const response = await api.put(`/clients/${clientId}`, clientData);
  return response.data;
};

export const getDeployments = async (status = "") => {
  const url = status ? `/deployments/?status=${status}` : "/deployments/";
  const response = await api.get(url);
  return response.data;
};

export const createDeployment = async (deploymentData) => {
  const response = await api.post("/deployments/", deploymentData);
  return response.data;
};

export const updateDeploymentStatus = async (deploymentId, updateData) => {
  const response = await api.put(`/deployments/${deploymentId}`, updateData);
  return response.data;
};

export const getDeploymentContractAlerts = async (params = {}) => {
  const response = await api.get("/deployments/contract-alerts", { params });
  return response.data;
};

/**
 * Get a specific application by ID.
 *
 * @param {number} applicationId - ID of application
 * @returns {Promise<Object>} Application data
 */
export const getApplicationById = async (applicationId) => {
  const response = await api.get(`/applications/${applicationId}`);
  return response.data;
};

/**
 * Update application status.
 * Requires 'manage_applications' permission (Recruiter/Admin).
 *
 * @param {number} applicationId - ID of application
 * @param {string} status - New status
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated application
 */
export const updateApplicationStatus = async (
  applicationId,
  status,
  notes = null,
) => {
  const response = await api.patch(`/applications/${applicationId}/status`, {
    status,
    notes,
  });
  return response.data;
};

/**
 * Toggle shortlist status for an application.
 * Requires 'manage_applications' permission (Recruiter/Admin).
 *
 * @param {number} applicationId - ID of application
 * @returns {Promise<Object>} Updated application with is_shortlisted toggled
 */
export const toggleShortlist = async (applicationId) => {
  const response = await api.patch(`/applications/${applicationId}/shortlist`);
  return response.data;
};

/**
 * Delete an application/candidate record.
 * Requires 'manage_users' permission (Admin roles).
 *
 * @param {number} applicationId - ID of application to remove
 * @returns {Promise<void>}
 */
export const deleteApplication = async (applicationId) => {
  await api.delete(`/applications/${applicationId}`);
};

/**
 * Save a rejected or unselected application into the dedicated talent pool.
 *
 * @param {number} applicationId - Source application ID
 * @param {Object} options - Save options
 * @param {string|null} options.notes - Optional recruiter note
 * @param {boolean} options.auto_rescan - Whether to rescan immediately
 * @returns {Promise<Object>} Save result
 */
export const saveToTalentPool = async (
  applicationId,
  { notes = null, auto_rescan = true } = {},
) => {
  const response = await api.post("/talent-pool/entries", {
    application_id: applicationId,
    notes,
    auto_rescan,
  });
  return response.data;
};

/**
 * Browse dedicated talent pool entries.
 *
 * @param {Object} params - Query params
 * @returns {Promise<Object>} Talent pool list
 */
export const getTalentPoolEntries = async (params = {}) => {
  const response = await api.get("/talent-pool/entries", { params });
  return response.data;
};

/**
 * Rescan one talent pool entry against open jobs.
 *
 * @param {number} entryId - Talent pool entry ID
 * @param {Object} params - Optional target job filter
 * @returns {Promise<Object>} Rescan result
 */
export const rescanTalentPoolEntry = async (entryId, params = {}) => {
  const response = await api.post(`/talent-pool/entries/${entryId}/rescan`, null, {
    params,
  });
  return response.data;
};

/**
 * Bulk rescan active talent pool entries.
 *
 * @param {Object} params - Optional target job filter
 * @returns {Promise<Object>} Bulk rescan result
 */
export const rescanTalentPool = async (params = {}) => {
  const response = await api.post("/talent-pool/rescan", null, { params });
  return response.data;
};

// =============================================================================
// Analytics API Functions
// =============================================================================

/**
 * Get dashboard overview metrics.
 * Requires 'view_analytics' permission (Recruiter/Admin).
 *
 * @param {number} jobId - Optional job ID filter
 * @returns {Promise<Object>} Dashboard metrics
 */
export const getAnalyticsOverview = async (jobId = null) => {
  const params = jobId ? { job_id: jobId } : {};
  const response = await api.get("/analytics/overview", { params });
  return response.data;
};

/**
 * Get time to hire metrics.
 *
 * @param {number} days - Time period in days
 * @returns {Promise<Object>} Time to hire data
 */
export const getTimeToHire = async (days = 90) => {
  const response = await api.get("/analytics/time-to-hire", {
    params: { days },
  });
  return response.data;
};

/**
 * Get pipeline breakdown by job.
 *
 * @param {number} limit - Number of jobs to return
 * @returns {Promise<Object>} Pipeline data by job
 */
export const getPipelineByJob = async (limit = 10) => {
  const response = await api.get("/analytics/pipeline-by-job", {
    params: { limit },
  });
  return response.data;
};

/**
 * Get application trends over time.
 *
 * @param {number} days - Time period in days
 * @returns {Promise<Object>} Trend data
 */
export const getApplicationTrends = async (days = 30) => {
  const response = await api.get("/analytics/trends", { params: { days } });
  return response.data;
};

// =============================================================================
// Matching API Functions
// =============================================================================

/**
 * Get dashboard actionable alerts.
 * Requires 'view_analytics' permission.
 *
 * @param {number} jobId - Optional job ID filter
 * @returns {Promise<Object>} Dashboard alerts
 */
export const getDashboardAlerts = async (jobId = null) => {
  const params = jobId ? { job_id: jobId } : {};
  const response = await api.get("/analytics/alerts", { params });
  return response.data;
};

/**
 * Get skill distribution among applicants.
 * Requires 'view_analytics' permission.
 *
 * @param {number} jobId - Optional job ID filter
 * @returns {Promise<Object>} Skill distribution data
 */
export const getSkillDistribution = async (jobId = null) => {
  const params = jobId ? { job_id: jobId } : {};
  const response = await api.get("/analytics/skill-distribution", { params });
  return response.data;
};

/**
 * Get matched candidates for a job.
 * Requires 'view_all_applications' permission.
 *
 * @param {number} jobId - Job ID
 * @param {number} minScore - Minimum score filter
 * @returns {Promise<Object>} Matched candidates
 */
export const getJobMatches = async (jobId, minScore = 0) => {
  const response = await api.get(`/matching/jobs/${jobId}/candidates`, {
    params: { min_score: minScore },
  });
  return response.data;
};

/**
 * Score a single application.
 * Requires 'manage_applications' permission.
 *
 * @param {number} applicationId - Application ID
 * @returns {Promise<Object>} Score result
 */
export const scoreApplication = async (applicationId) => {
  const response = await api.post(
    `/matching/applications/${applicationId}/score`,
  );
  return response.data;
};

/**
 * Batch score all applications for a job.
 * Requires 'manage_applications' permission.
 *
 * @param {number} jobId - Job ID
 * @returns {Promise<Object>} Batch results
 */
export const scoreJobApplications = async (jobId) => {
  const response = await api.post(`/matching/jobs/${jobId}/score-all`);
  return response.data;
};

// =============================================================================
// Report API Functions
// =============================================================================

/**
 * Get available report types.
 * Requires 'view_analytics' permission (Recruiter/Admin).
 *
 * @returns {Promise<Object>} Available report types
 */
export const getAvailableReports = async () => {
  const response = await api.get("/analytics/reports");
  return response.data;
};

/**
 * Generate a report (JSON format).
 * Requires 'view_analytics' permission.
 *
 * @param {Object} params - Report parameters
 * @param {string} params.report_type - "pipeline", "match_scores", or "usage"
 * @param {string} params.format - "json"
 * @param {number} params.job_id - Optional job filter
 * @param {string} params.date_from - Optional ISO date
 * @param {string} params.date_to - Optional ISO date
 * @returns {Promise<Object>} Report data
 */
export const generateReport = async (params) => {
  const response = await api.post("/analytics/reports/generate", {
    ...params,
    format: "json",
  });
  return response.data;
};

/**
 * Download a report file (CSV/XLSX/PDF).
 * Requires 'view_analytics' permission.
 *
 * @param {Object} params - Report parameters
 * @param {string} params.report_type - Report type
 * @param {string} params.format - "csv", "xlsx", or "pdf"
 * @returns {Promise<Blob>} File blob for download
 */
export const downloadReport = async (params) => {
  const response = await api.post("/analytics/reports/generate", params, {
    responseType: "blob",
  });
  return response;
};

// =============================================================================
// Admin API Functions
// =============================================================================

/**
 * Get system audit logs. Requires 'manage_users' permission (Admin only).
 *
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max results (default 50)
 * @param {number} params.offset - Pagination offset
 * @param {number} params.user_id - Filter by user ID
 * @param {string} params.action - Filter by action keyword
 * @param {string} params.entity_type - Filter by entity type
 * @returns {Promise<Object>} Audit logs list
 */
export const getAuditLogs = async (params = {}) => {
  const response = await api.get("/admin/audit-logs", { params });
  return response.data;
};

/**
 * Get system-wide statistics. Requires 'manage_users' permission (Admin only).
 *
 * @returns {Promise<Object>} System stats
 */
export const getSystemStats = async () => {
  const response = await api.get("/admin/system-stats");
  return response.data;
};

// Export the axios instance for direct use if needed
export default api;
