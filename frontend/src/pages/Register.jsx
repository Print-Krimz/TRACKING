/**
 * Register Page Component
 *
 * Public page for new user registration.
 * Allows users to create an account as Applicant or Recruiter.
 *
 * Features:
 * - Form validation
 * - Role selection dropdown
 * - Password confirmation
 * - Error display
 * - Redirect to login after success
 *
 * Note: Admin accounts can only be created by existing Admins
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const Register = () => {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role_name: "Applicant",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.username.length < 3) {
      setError("Username must be at least 3 characters");
      return false;
    }
    return true;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role_name: formData.role_name,
      });

      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Success message
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-bg-gradient"></div>
          <div className="auth-bg-grid"></div>

          <Link to="/" className="auth-back-link">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Home
          </Link>

          <div className="auth-card success-card">
            <div className="success-icon">
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
            </div>
            <h2>Registration Successful!</h2>
            <p>Your account has been created. Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-bg-gradient"></div>
        <div className="auth-bg-grid"></div>

        <Link to="/" className="auth-back-link">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Home
        </Link>

        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 8V16M9 10V14M15 10V14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1>Join MEGS</h1>
            <p>Create your account to get started</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="auth-error">
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

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role_name">Role</label>
              <select
                id="role_name"
                name="role_name"
                value={formData.role_name}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Applicant">
                  Applicant - Submit and track resumes
                </option>
                <option value="Recruiter">
                  Recruiter - Review and analyze resumes
                </option>
              </select>
              <span className="form-hint">
                Choose Applicant if you want to submit resumes, or Recruiter if
                you want to analyze them.
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="auth-footer">
            <p>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
