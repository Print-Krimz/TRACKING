import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { uploadDocument, getDocuments, downloadDocument, deleteDocument } from "../services/api";
import { Download, FolderOpen, IdCard, FileSignature, FileText, Trash2, UploadCloud } from "lucide-react";
import { EmptyState } from "../components/ui";
import "./DocumentVault.css";

const DocumentVault = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload state
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("Resume");
  const [expirationDate, setExpirationDate] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      addToast("error", "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      addToast("warning", "Please select a file to upload");
      return;
    }

    try {
      setUploading(true);
      const expDate = expirationDate ? new Date(expirationDate).toISOString() : null;
      await uploadDocument(file, docType, expDate);
      addToast("success", `${docType} uploaded successfully`);
      
      // Reset form
      setFile(null);
      setDocType("Resume");
      setExpirationDate("");
      // Clear the native file input so the browser visually resets
      const fileInput = document.getElementById("file-upload");
      if (fileInput) fileInput.value = "";
      
      // Refresh list — await to ensure state updates before re-render
      await fetchDocuments();
    } catch (err) {
      addToast("error", err.response?.data?.detail || "Failed to upload document");
    } finally {
      setUploading(false);
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

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    
    try {
      await deleteDocument(docId);
      addToast("success", "Document deleted successfully");
      // Optimistically remove from local state for instant UI feedback
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      // Then sync with server
      await fetchDocuments();
    } catch (err) {
      addToast("error", "Failed to delete document");
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
    <div className="vault-container">
      <div className="vault-header">
        <div>
          <h1>Digital 201 Vault</h1>
          <p>Securely upload and manage your personal documents.</p>
        </div>
      </div>

      <div className="vault-content">
        <div className="vault-upload-card">
          <h3>Upload New Document</h3>
          <form className="vault-form" onSubmit={handleUpload}>
            
            <div className="form-group">
              <label htmlFor="vault-doc-type">Document Type</label>
              <select 
                id="vault-doc-type"
                value={docType} 
                onChange={(e) => setDocType(e.target.value)}
                className="vault-select"
              >
                <option value="Resume">Resume / CV</option>
                <option value="Valid ID">Valid ID</option>
                <option value="Contract">Signed Contract</option>
                <option value="Certification">Certification / License</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="vault-expiration-date">Expiration Date (Optional)</label>
              <input 
                id="vault-expiration-date"
                type="date" 
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="vault-input"
              />
              <small className="field-hint">Leave blank if the document does not expire.</small>
            </div>

            <div className="vault-dropzone">
              <input 
                type="file" 
                onChange={handleFileChange} 
                id="file-upload" 
                className="file-input"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
              />
              <label htmlFor="file-upload" className="file-label">
                <div className="upload-icon">
                  <UploadCloud size={34} aria-hidden="true" />
                </div>
                <span className="file-name">{file ? file.name : "Click to browse or drag file here"}</span>
                <span className="file-hint">Supported formats: PDF, DOCX, JPG, PNG (Max 5MB)</span>
              </label>
            </div>

            <button 
              type="submit" 
              className="vault-btn primary"
              disabled={uploading || !file}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </form>
        </div>

        <div className="vault-list-card">
          <h3>My Uploaded Documents</h3>
          {loading ? (
            <div className="vault-loading">Loading documents...</div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents uploaded"
              description="Upload resume, ID, contract, and certification files to keep your 201 records organized."
            />
          ) : (
            <div className="document-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="document-item">
                  <div className="document-icon">
                    {doc.document_type === "Valid ID" ? <IdCard size={24} /> : doc.document_type === "Contract" ? <FileSignature size={24} /> : <FileText size={24} />}
                  </div>
                  <div className="document-info">
                    <h4>{doc.original_filename}</h4>
                    <div className="document-meta">
                      <span className="doc-type">{doc.document_type}</span>
                      <span className="doc-size">{formatFileSize(doc.file_size_bytes)}</span>
                    </div>
                    {doc.expiration_date && (
                      <div className="doc-expiration">
                        Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="document-actions">
                    <button 
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                      className="icon-btn download"
                      aria-label={`Download ${doc.original_filename}`}
                    >
                      <Download size={16} aria-hidden="true" />
                    </button>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="icon-btn delete"
                      aria-label={`Delete ${doc.original_filename}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentVault;
