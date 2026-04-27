/**
 * Job Create Page Component
 *
 * Page for Recruiters/Admins to create a new job requisition.
 * Accessible only to users with 'manage_jobs' permission.
 *
 * Features:
 * - Full job details form (title, description, department, etc.)
 * - Salary range fields
 * - Dynamic criteria management (add/remove skills)
 * - Validation and error feedback
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob } from "../services/api";
import "./JobCreate.css";

const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const EDUCATION_LEVELS = [
  "High School",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Any",
];

const JobCreate = () => {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    location: "",
    employment_type: "full-time",
    status: "open",
    experience_years: "",
    education_level: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "USD",
  });

  // Criteria (skills) state
  const [criteria, setCriteria] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [newSkillMustHave, setNewSkillMustHave] = useState(false);
  const [newSkillWeight, setNewSkillWeight] = useState(5);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validation
  const isValid =
    formData.title.trim().length > 0 &&
    formData.description.trim().length >= 20;

  /**
   * Handle form field changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Add a skill criterion
   */
  const handleAddCriteria = () => {
    if (!newSkill.trim()) return;

    setCriteria((prev) => [
      ...prev,
      {
        skill_name: newSkill.trim(),
        is_must_have: newSkillMustHave,
        weight: newSkillWeight,
      },
    ]);
    setNewSkill("");
    setNewSkillMustHave(false);
    setNewSkillWeight(5);
  };

  /**
   * Handle Enter key in skill input
   */
  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCriteria();
    }
  };

  /**
   * Remove a skill criterion
   */
  const handleRemoveCriteria = (index) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValid) {
      setError(
        "Please fill in the job title and a description (at least 20 characters).",
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        department: formData.department.trim() || null,
        location: formData.location.trim() || null,
        employment_type: formData.employment_type,
        experience_years: formData.experience_years
          ? parseInt(formData.experience_years, 10)
          : null,
        education_level: formData.education_level || null,
        salary_min: formData.salary_min
          ? parseInt(formData.salary_min, 10)
          : null,
        salary_max: formData.salary_max
          ? parseInt(formData.salary_max, 10)
          : null,
        salary_currency: formData.salary_currency,
        status: formData.status,
        criteria,
      };

      await createJob(payload);
      navigate("/jobs", {
        state: { success: "Job requisition created successfully!" },
      });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to create job requisition.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="job-create-page">
      <div className="page-header">
        <h1>Create Job Requisition</h1>
        <p>Post a new open position for candidates to apply to</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
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
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="job-form">
        {/* Basic Info Section */}
        <div className="form-section">
          <h2 className="section-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Basic Information
          </h2>

          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Senior Software Engineer"
              disabled={loading}
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Job Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              disabled={loading}
              rows={8}
            />
            <div className="char-count">
              <span
                className={
                  formData.description.length >= 20 ? "valid" : "invalid"
                }
              >
                {formData.description.length} characters
              </span>
              <span className="min-chars">(minimum 20)</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g., Engineering"
                disabled={loading}
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                type="text"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Remote, New York, NY"
                disabled={loading}
                maxLength={200}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employment_type">Employment Type</label>
              <select
                id="employment_type"
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
                disabled={loading}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Publish Status</label>
              <div className="status-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${formData.status === "open" ? "active open" : ""}`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, status: "open" }))
                  }
                  disabled={loading}
                >
                  <span className="toggle-dot open"></span>
                  Open — Visible to candidates
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${formData.status === "draft" ? "active draft" : ""}`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, status: "draft" }))
                  }
                  disabled={loading}
                >
                  <span className="toggle-dot draft"></span>
                  Draft — Hidden until published
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="experience_years">Experience (years)</label>
              <input
                id="experience_years"
                name="experience_years"
                type="number"
                min="0"
                max="50"
                value={formData.experience_years}
                onChange={handleChange}
                placeholder="e.g., 3"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="education_level">Education Level</label>
              <select
                id="education_level"
                name="education_level"
                value={formData.education_level}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Not specified</option>
                {EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Compensation Section */}
        <div className="form-section">
          <h2 className="section-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 1V23M17 5H9.5C7.01 5 5 7.01 5 9.5S7.01 14 9.5 14H14.5C16.99 14 19 16.01 19 18.5S16.99 23 14.5 23H6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Compensation (Optional)
          </h2>

          <div className="form-row salary-row">
            <div className="form-group">
              <label htmlFor="salary_currency">Currency</label>
              <select
                id="salary_currency"
                name="salary_currency"
                value={formData.salary_currency}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="PHP">PHP (₱)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="salary_min">Min Salary</label>
              <input
                id="salary_min"
                name="salary_min"
                type="number"
                min="0"
                value={formData.salary_min}
                onChange={handleChange}
                placeholder="e.g., 80000"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="salary_max">Max Salary</label>
              <input
                id="salary_max"
                name="salary_max"
                type="number"
                min="0"
                value={formData.salary_max}
                onChange={handleChange}
                placeholder="e.g., 120000"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Skills / Criteria Section */}
        <div className="form-section">
          <h2 className="section-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.76489 14.1003 1.98232 16.07 2.85999"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 4L12 14.01L9 11.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Required Skills & Criteria
          </h2>

          {/* Existing criteria list */}
          {criteria.length > 0 && (
            <div className="criteria-list">
              {criteria.map((c, index) => (
                <div key={index} className="criteria-chip">
                  <span className="criteria-name">{c.skill_name}</span>
                  {c.is_must_have && (
                    <span className="must-have-tag">Required</span>
                  )}
                  <span className="weight-tag">W:{c.weight}</span>
                  <button
                    type="button"
                    className="remove-criteria-btn"
                    onClick={() => handleRemoveCriteria(index)}
                    aria-label={`Remove ${c.skill_name}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6 6L18 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new criterion */}
          <div className="add-criteria">
            <div className="criteria-input-row">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="e.g., React, Python, Leadership"
                disabled={loading}
                className="criteria-input"
              />
              <label className="must-have-check">
                <input
                  type="checkbox"
                  checked={newSkillMustHave}
                  onChange={(e) => setNewSkillMustHave(e.target.checked)}
                  disabled={loading}
                />
                Must-have
              </label>
              <div className="weight-input">
                <label>Weight</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newSkillWeight}
                  onChange={(e) =>
                    setNewSkillWeight(parseInt(e.target.value, 10) || 5)
                  }
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                className="add-criteria-btn"
                onClick={handleAddCriteria}
                disabled={!newSkill.trim() || loading}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate("/jobs")}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !isValid}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                Creating...
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Create Job
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobCreate;
