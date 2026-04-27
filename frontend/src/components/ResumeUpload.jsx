/**
 * Resume Submit Page Component
 *
 * Page for Applicants to submit their resume.
 * Accessible only to users with 'submit_resume' permission.
 *
 * Features:
 * - File upload (PDF/DOCX) with drag-and-drop
 * - Text area for manual paste
 * - Format validation
 * - Success/error feedback
 */

import { useState, useRef } from "react";
import { submitResume, submitResumeFile } from "../services/api";
import { useToast } from "../context/ToastContext";
import "./ResumeUpload.css";

const ResumeUpload = ({ onSuccess, onCancel }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Form state
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMode, setUploadMode] = useState("file"); // 'file' or 'text'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Validation
  const minChars = 50;
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const allowedExtensions = [".pdf", ".docx"];

  const charCount = content.length;
  const isTextValid = charCount >= minChars;
  const isFileValid = file !== null;
  const isValid = uploadMode === "file" ? isFileValid : isTextValid;

  /**
   * Handle file selection
   */
  const handleFileSelect = (selectedFile) => {
    setError("");

    if (!selectedFile) return;

    // Validate file type
    const ext = selectedFile.name
      .toLowerCase()
      .slice(selectedFile.name.lastIndexOf("."));
    if (!allowedExtensions.includes(ext)) {
      toast.error("Invalid file type. Please upload a PDF or DOCX file.");
      return;
    }

    // Validate file size
    if (selectedFile.size > maxFileSize) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setFile(selectedFile);
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files?.[0];
    handleFileSelect(selectedFile);
  };

  /**
   * Handle drag events
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFileSelect(droppedFile);
  };

  /**
   * Handle click on drop zone
   */
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Remove selected file
   */
  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValid) {
      if (uploadMode === "file") {
        toast.warning("Please select a file to upload");
      } else {
        toast.warning(`Resume must be at least ${minChars} characters`);
      }
      return;
    }

    setLoading(true);

    try {
      if (uploadMode === "file" && file) {
        await submitResumeFile(file);
      } else {
        await submitResume(content);
      }
      
      toast.success("Resume submitted successfully!");
      if (onSuccess) onSuccess();
      
      // Reset form
      setFile(null);
      setContent("");
      
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-submit-page">
      <div className="page-header">
        <h1>Submit Your Resume</h1>
        <p>
          Upload a file or paste your resume content for AI-powered analysis
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${uploadMode === "file" ? "active" : ""}`}
          onClick={() => setUploadMode("file")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 2V8H20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 18V12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 15L12 12L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Upload File
        </button>
        <button
          type="button"
          className={`mode-btn ${uploadMode === "text" ? "active" : ""}`}
          onClick={() => setUploadMode("text")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 2V8H20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 13H8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 17H8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 9H8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Paste Text
        </button>
      </div>

      {/* Tips Section */}
      <div className="tips-card">
        <div className="tips-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9.66347 17H14.3364M12 3V4M18.364 5.63604L17.6569 6.34315M21 12H20M4 12H3M6.34309 6.34315L5.63599 5.63604M8.46441 15.5356C6.51179 13.5829 6.51179 10.4171 8.46441 8.46449C10.417 6.51187 13.5829 6.51187 15.5355 8.46449C17.4881 10.4171 17.4881 13.5829 15.5355 15.5356L14.9884 16.0827C14.3555 16.7155 14 17.5739 14 18.469V19C14 20.1046 13.1045 21 12 21C10.8954 21 9.99996 20.1046 9.99996 19V18.469C9.99996 17.5739 9.64447 16.7155 9.01153 16.0827L8.46441 15.5356Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="tips-content">
          <h3>Tips for Better Analysis</h3>
          <ul>
            <li>
              Include your full work experience with specific achievements
            </li>
            <li>List relevant technical skills and certifications</li>
            <li>Add education details and notable projects</li>
            <li>Use clear formatting and action verbs</li>
          </ul>
        </div>
      </div>

      {/* Error Display is now handled by Toasts globally */}

      {/* Resume Form */}
      <form onSubmit={handleSubmit} className="resume-form">
        {uploadMode === "file" ? (
          /* File Upload Section */
          <div className="form-group">
            <label>Resume File</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,.docx"
              style={{ display: "none" }}
            />

            {!file ? (
              <div
                className={`drop-zone ${isDragging ? "dragging" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleDropZoneClick}
              >
                <div className="drop-zone-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17 8L12 3L7 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 3V15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="drop-zone-text">
                  <span className="drop-zone-primary">Click to upload</span> or
                  drag and drop
                </p>
                <p className="drop-zone-hint">PDF or DOCX (max 5MB)</p>
              </div>
            ) : (
              <div className="file-preview">
                <div className="file-info">
                  <div className="file-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2V8H20"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={handleRemoveFile}
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
            )}
          </div>
        ) : (
          /* Text Input Section */
          <div className="form-group">
            <label htmlFor="resume-content">Resume Content</label>
            <textarea
              id="resume-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your resume content here...

Example:
John Doe
Software Engineer

EXPERIENCE
Senior Developer at Tech Corp (2020-Present)
- Led development of microservices architecture
- Improved system performance by 40%

SKILLS
Python, JavaScript, React, Node.js, PostgreSQL

EDUCATION
B.S. Computer Science, University of Technology"
              disabled={loading}
              rows={20}
            />
            <div className="char-count">
              <span className={isTextValid ? "valid" : "invalid"}>
                {charCount} characters
              </span>
              <span className="min-chars">(minimum {minChars})</span>
            </div>
          </div>
        )}

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !isValid}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                Submitting...
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
                Submit Resume
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResumeUpload;
