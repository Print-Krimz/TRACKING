/**
 * Loading Component
 *
 * A reusable loading spinner with optional message.
 * Used during async operations and initial auth checks.
 *
 * Features:
 * - Animated spinner with modern design
 * - Optional customizable message
 * - Centered layout with backdrop
 */

import "./Loading.css";

/**
 * Loading Component
 *
 * @param {Object} props - Component props
 * @param {string} props.message - Optional loading message
 */
const Loading = ({ message = "Loading..." }) => {
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export default Loading;
