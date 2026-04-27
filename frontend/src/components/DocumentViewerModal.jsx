import { useState, useEffect } from "react";
import { getUserDocuments, downloadDocument } from "../services/api";
import { useToast } from "../context/ToastContext";
import "./DocumentViewerModal.css";

const DocumentViewerModal = ({ userId, candidateName, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchDocuments();
    }
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await getUserDocuments(userId);
      setDocuments(data.documents || []);
    } catch (err) {
      addToast("error", "Failed to load applicant's documents.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId, filename) => {
    try {
      const blob = await downloadDocument(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      addToast("error", "Failed to download document");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="viewer-modal-overlay" onClick={onClose}>
      <div 
        className="viewer-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="viewer-modal-header">
          <h2>Digital 201 File: {candidateName || "Applicant"}</h2>
          <button className="viewer-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="viewer-modal-body">
          {loading ? (
            <div className="viewer-loading">
              <div className="spinner"></div>
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="viewer-empty">
              <div className="viewer-empty-icon">📁</div>
              <p>This applicant has not uploaded any documents.</p>
            </div>
          ) : (
            <div className="viewer-document-list">
              {documents.map((doc) => (
                <div key={doc.id} className="viewer-document-item">
                  <div className="viewer-doc-icon">
                    {doc.document_type === "Valid ID" ? "🪪" : doc.document_type === "Contract" ? "📝" : "📄"}
                  </div>
                  <div className="viewer-doc-info">
                    <h4>{doc.original_filename}</h4>
                    <div className="viewer-doc-meta">
                      <span className="viewer-tag">{doc.document_type}</span>
                      <span className="viewer-size">{formatFileSize(doc.file_size_bytes)}</span>
                    </div>
                    {doc.expiration_date && (
                      <div className="viewer-expiry">
                        Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDownload(doc.id, doc.original_filename)}
                    className="viewer-download-btn"
                    title="Download File"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
