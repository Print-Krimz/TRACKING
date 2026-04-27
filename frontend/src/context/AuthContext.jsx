/**
 * Authentication Context
 *
 * React Context for managing authentication state across the application.
 * Provides user information, login/logout functions, and role-based access.
 *
 * Features:
 * - JWT token storage in localStorage for persistence
 * - User role tracking for RBAC
 * - Loading state during initial authentication check
 * - Login, register, and logout functions
 *
 * Usage:
 *   const { user, login, logout, isAuthenticated } = useAuth();
 *
 * Architecture Note:
 * This context wraps the entire application and provides authentication
 * state to all components. It persists the login state across page refreshes
 * by storing the token and user data in localStorage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
} from "../services/api";

// Create the authentication context
const AuthContext = createContext(null);

/**
 * Custom hook to access authentication context.
 * Must be used within an AuthProvider.
 *
 * @returns {Object} Authentication state and methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Authentication Provider Component
 *
 * Wraps the application and provides authentication state to all children.
 * Handles:
 * - Initial auth state recovery from localStorage
 * - Login/register/logout operations
 * - Token and user data persistence
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  // User state - contains user info when logged in, null otherwise
  const [user, setUser] = useState(null);

  // Loading state - true during initial authentication check
  const [loading, setLoading] = useState(true);

  // Error state for authentication failures
  const [error, setError] = useState(null);

  /**
   * Check for existing authentication on mount.
   *
   * If a token exists in localStorage, validates it by fetching
   * the current user info. If validation fails, clears the stored data.
   */
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (token && storedUser) {
        try {
          // Validate the token by fetching current user
          const userData = await getCurrentUser();
          setUser({
            ...JSON.parse(storedUser),
            ...userData,
          });
        } catch (err) {
          // Token invalid or expired - clear storage
          console.error("Auth validation failed:", err);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login function.
   *
   * Authenticates with the API and stores the token and user data.
   *
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @returns {Promise<Object>} Logged in user data
   * @throws {Error} If login fails
   */
  const login = useCallback(async (username, password) => {
    setError(null);
    try {
      const response = await apiLogin({ username, password });

      // Store token and user data
      localStorage.setItem("token", response.access_token);
      localStorage.setItem("user", JSON.stringify(response.user));

      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err.response?.data?.detail || "Login failed";
      setError(message);
      throw new Error(message);
    }
  }, []);

  /**
   * Register function.
   *
   * Creates a new user account. Does NOT automatically log in.
   *
   * @param {Object} userData - Registration data
   * @returns {Promise<Object>} Created user data
   * @throws {Error} If registration fails
   */
  const register = useCallback(async (userData) => {
    setError(null);
    try {
      const response = await apiRegister(userData);
      return response;
    } catch (err) {
      const message = err.response?.data?.detail || "Registration failed";
      setError(message);
      throw new Error(message);
    }
  }, []);

  /**
   * Logout function.
   *
   * Clears authentication state and localStorage.
   */
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  }, []);

  /**
   * Check if user has a specific role.
   *
   * @param {string} roleName - Role to check (e.g., 'Admin', 'Recruiter')
   * @returns {boolean} True if user has the role
   */
  const hasRole = useCallback(
    (roleName) => {
      return user?.role_name === roleName;
    },
    [user],
  );

  /**
   * Check if user has one of the specified roles.
   *
   * @param {string[]} roles - Array of role names
   * @returns {boolean} True if user has any of the roles
   */
  const hasAnyRole = useCallback(
    (roles) => {
      return roles.includes(user?.role_name);
    },
    [user],
  );

  // Context value - all auth state and methods
  const value = {
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,

    // Methods
    login,
    register,
    logout,
    hasRole,
    hasAnyRole,

    // Convenience properties for role checks
    isAdmin: user?.role_name === "Admin",
    isControlPanelAdmin: user?.role_name === "Control Panel Admin",
    isRecruiter: user?.role_name === "Recruiter",
    isApplicant: user?.role_name === "Applicant",

    // Can analyze resumes (Recruiter or Admin)
    canAnalyze:
      user?.role_name === "Admin" ||
      user?.role_name === "Control Panel Admin" ||
      user?.role_name === "Recruiter",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
