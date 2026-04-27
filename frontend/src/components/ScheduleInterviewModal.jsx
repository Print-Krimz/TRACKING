import { useState } from "react";
import { createInterview } from "../services/api";
import "./ScheduleInterviewModal.css";

const ScheduleInterviewModal = ({ application, onClose, onScheduled }) => {
  const [form, setForm] = useState({
    scheduled_start_at: "",
    scheduled_end_at: "",
    timezone: "UTC",
    mode: "virtual",
    location_or_link: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        scheduled_start_at: new Date(form.scheduled_start_at).toISOString(),
        scheduled_end_at: new Date(form.scheduled_end_at).toISOString(),
      };
      await createInterview(application.id, payload);
      onScheduled?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to schedule interview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="iv-modal-overlay" onClick={onClose}>
      <div className="iv-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Schedule Interview</h3>
        <p>{application?.candidate_name} - {application?.job_title}</p>
        {error && <div className="iv-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Start</label>
          <input
            type="datetime-local"
            required
            value={form.scheduled_start_at}
            onChange={(e) => update("scheduled_start_at", e.target.value)}
          />
          <label>End</label>
          <input
            type="datetime-local"
            required
            value={form.scheduled_end_at}
            onChange={(e) => update("scheduled_end_at", e.target.value)}
          />
          <label>Mode</label>
          <select value={form.mode} onChange={(e) => update("mode", e.target.value)}>
            <option value="virtual">Virtual</option>
            <option value="onsite">Onsite</option>
            <option value="phone">Phone</option>
          </select>
          <label>Location/Link</label>
          <input
            value={form.location_or_link}
            onChange={(e) => update("location_or_link", e.target.value)}
            placeholder="Meeting link or location"
          />
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
          />
          <div className="iv-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleInterviewModal;
