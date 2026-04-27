import { useEffect, useState } from "react";
import { getApplicationInterviews } from "../services/api";
import "./ApplicationInterviewTimeline.css";

const ApplicationInterviewTimeline = ({ applicationId }) => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getApplicationInterviews(applicationId);
        if (mounted) setInterviews(data.interviews || []);
      } catch {
        if (mounted) setInterviews([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applicationId]);

  if (loading) {
    return <div className="iv-timeline">Loading interview timeline...</div>;
  }

  if (interviews.length === 0) {
    return <div className="iv-timeline">No interviews scheduled yet.</div>;
  }

  return (
    <div className="iv-timeline">
      {interviews.slice(0, 3).map((iv) => (
        <div key={iv.id} className={`iv-item status-${iv.status}`}>
          <div className="iv-item-row">
            <strong>{iv.mode.toUpperCase()}</strong>
            <span>{iv.status.replace("_", " ")}</span>
          </div>
          <div className="iv-time">
            {new Date(iv.scheduled_start_at).toLocaleString()} -{" "}
            {new Date(iv.scheduled_end_at).toLocaleTimeString()}
          </div>
          {iv.location_or_link && <div className="iv-location">{iv.location_or_link}</div>}
        </div>
      ))}
    </div>
  );
};

export default ApplicationInterviewTimeline;
