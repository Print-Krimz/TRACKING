/**
 * PrivateRoute Component
 *
 * Higher-Order Component for role-based route protection.
 * Wraps protected pages and redirects unauthorized users.
 *
 * Features:
 * - Redirects unauthenticated users to login
 * - Supports single role or multiple roles
 * - Shows loading state during auth check
 * - Redirects unauthorized users to dashboard
 *
 * Usage:
 *   <PrivateRoute>
 *     <Dashboard />
 *   </PrivateRoute>
 *
 *   <PrivateRoute allowedRoles={['Admin', 'Recruiter']}>
 *     <ResumeList />
 *   </PrivateRoute>
 *
 * RBAC Logic:
 * - If no allowedRoles specified, any authenticated user can access
 * - If allowedRoles specified, user must have one of those roles
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./Loading";

/**
 * PrivateRoute Component
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Protected content to render
 * @param {string[]} props.allowedRoles - Optional array of allowed role names
 */
const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (loading) {
    return <Loading message="Checking authentication..." />;
  }

  // Not authenticated - redirect to login
  // Save the attempted URL to redirect back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If roles are specified, check if user has one of them
  if (allowedRoles.length > 0) {
    const hasRequiredRole = allowedRoles.includes(user?.role_name);

    if (!hasRequiredRole) {
      // User is authenticated but doesn't have the required role
      // Redirect to dashboard with access denied message
      return (
        <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
      );
    }
  }

  // User is authenticated and has required role (if any)
  return children;
};

export default PrivateRoute;
