import { useState } from "react";
import { updateJob } from "../services/api";
import { FileText, GraduationCap, Target, AlertTriangle } from "lucide-react";
import "./EditJobModal.css";

const EditJobModal = ({ job, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: job.title || "",
    description: job.description || "",
    department: job.department || "",
    location: job.location || "",
    employment_type: job.employment_type || "full-time",
    experience_years: job.experience_years || "",
    education_level: job.education_level || "",
    salary_min: job.salary_min || "",
    salary_max: job.salary_max || "",
    status: job.status || "draft",
  });

  const [criteria, setCriteria] = useState(
    job.criteria?.map((c) => ({
      skill_name: c.skill_name,
      is_must_have: c.is_must_have,
      weight: c.weight,
    })) || [],
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCriteriaChange = (index, field, value) => {
    const newCriteria = [...criteria];
    newCriteria[index][field] =
      field === "is_must_have"
        ? value === "true"
        : field === "weight"
          ? parseInt(value) || 5
          : value;
    setCriteria(newCriteria);
  };

  const addCriteria = () => {
    setCriteria([
      ...criteria,
      { skill_name: "", is_must_have: false, weight: 5 },
    ]);
  };

  const removeCriteria = (index) => {
    const newCriteria = criteria.filter((_, i) => i !== index);
    setCriteria(newCriteria);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formattedData = {
        ...formData,
        experience_years: formData.experience_years
          ? parseInt(formData.experience_years)
          : null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        // Filter out empty criteria
        criteria: criteria.filter((c) => c.skill_name.trim() !== ""),
      };

      await updateJob(job.id, formattedData);
      onSuccess(); // Close modal and refresh data
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-job-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Job Requisition</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-content">
          {error && <div className="jc-error"><AlertTriangle size={16} className="inline-icon"/> {error}</div>}

          <form id="edit-job-form" onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div className="form-section">
              <h3 className="flex-title"><FileText size={20}/> Basic Details</h3>

              <div className="form-group full-width">
                <label>Job Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Job Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows="6"
                  placeholder="Editing this will re-trigger AI keyword extraction..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="status-select"
                  >
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                    <option value="filled">Filled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Employment Type</label>
                  <select
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleInputChange}
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Application Requirements */}
            <div className="form-section">
              <h3 className="flex-title"><GraduationCap size={20}/> Requirements & Comp</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Experience Needed (Years)</label>
                  <input
                    type="number"
                    name="experience_years"
                    value={formData.experience_years}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Education Level</label>
                  <input
                    type="text"
                    name="education_level"
                    value={formData.education_level}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Min Salary (USD)</label>
                  <input
                    type="number"
                    name="salary_min"
                    value={formData.salary_min}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Max Salary (USD)</label>
                  <input
                    type="number"
                    name="salary_max"
                    value={formData.salary_max}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Criteria List */}
            <div className="form-section">
              <h3 className="flex-title"><Target size={20}/> Matching Criteria</h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                Define skills to score candidate resumes against.
              </p>

              <div className="criteria-list">
                {criteria.map((crit, index) => (
                  <div key={index} className="criteria-item animate-fadeIn">
                    <div className="form-group">
                      <label>Skill / Tool</label>
                      <input
                        type="text"
                        value={crit.skill_name}
                        onChange={(e) =>
                          handleCriteriaChange(
                            index,
                            "skill_name",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Python"
                      />
                    </div>
                    <div className="form-group">
                      <label>Requirement</label>
                      <select
                        value={crit.is_must_have.toString()}
                        onChange={(e) =>
                          handleCriteriaChange(
                            index,
                            "is_must_have",
                            e.target.value,
                          )
                        }
                      >
                        <option value="false">Nice to have</option>
                        <option value="true">Must have</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Weight (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={crit.weight}
                        onChange={(e) =>
                          handleCriteriaChange(index, "weight", e.target.value)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="remove-criteria-btn"
                      onClick={() => removeCriteria(index)}
                      title="Remove criteria"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="add-criteria-btn"
                onClick={addCriteria}
              >
                + Add Criteria
              </button>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-job-form"
            className="save-btn"
            disabled={loading}
          >
            {loading ? <span className="btn-spinner"></span> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditJobModal;
