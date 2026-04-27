import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getApplicationMessages,
  markApplicationMessagesRead,
  sendApplicationMessage,
} from "../services/api";
import "./ApplicationMessagesPanel.css";

const ApplicationMessagesPanel = ({ applicationId, title = "Messages" }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(
    async (signal) => {
      try {
        const data = await getApplicationMessages(applicationId, { signal });
        setMessages(data.messages || []);
        setError("");
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        setError("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    },
    [applicationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadMessages(controller.signal);
    return () => controller.abort();
  }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      const controller = new AbortController();
      loadMessages(controller.signal);
      markApplicationMessagesRead(applicationId).catch(() => {});
      setTimeout(() => controller.abort(), 10000);
    }, 15000);
    return () => clearInterval(interval);
  }, [applicationId, loadMessages]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    const optimistic = {
      id: `temp-${Date.now()}`,
      sender_username: "You",
      body: trimmed,
      created_at: new Date().toISOString(),
      is_read: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setSending(true);
    try {
      const data = await sendApplicationMessage(applicationId, trimmed);
      setMessages(data.messages || []);
      setError("");
    } catch {
      setError("Failed to send message.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-msg-panel">
      <div className="app-msg-header">
        <h4>{title}</h4>
      </div>
      {error && <div className="app-msg-error">{error}</div>}
      <div className="app-msg-body">
        {loading ? (
          <div className="app-msg-empty">Loading messages...</div>
        ) : sortedMessages.length === 0 ? (
          <div className="app-msg-empty">No messages yet.</div>
        ) : (
          sortedMessages.map((message) => (
            <div key={message.id} className="app-msg-item">
              <div className="app-msg-meta">
                <strong>{message.sender_username || "User"}</strong>
                <span>{new Date(message.created_at).toLocaleString()}</span>
              </div>
              <p>{message.body}</p>
            </div>
          ))
        )}
      </div>
      <form className="app-msg-compose" onSubmit={handleSend}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message..."
          rows={2}
          maxLength={3000}
        />
        <button type="submit" disabled={sending || !body.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default ApplicationMessagesPanel;
