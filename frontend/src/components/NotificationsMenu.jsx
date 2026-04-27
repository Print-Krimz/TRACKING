import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getDashboardAlerts,
  getDeploymentContractAlerts,
  getNotifications,
  getMyApplications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { AlertTriangle, AlertCircle, Lightbulb } from "lucide-react";
import "./NotificationsMenu.css";

const NotificationsMenu = () => {
  const navigate = useNavigate();
  const { user, isRecruiter, isAdmin, isControlPanelAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [readIds, setReadIds] = useState(new Set());
  const menuRef = useRef(null);

  const readStorageKey = useMemo(
    () => `hireflow:notifications:read:${user?.id ?? "guest"}`,
    [user?.id],
  );

  const saveReadIds = useCallback(
    (nextSet) => {
      setReadIds(nextSet);
      localStorage.setItem(readStorageKey, JSON.stringify(Array.from(nextSet)));
    },
    [readStorageKey],
  );

  const markAsRead = useCallback(
    async (notificationId) => {
      if (readIds.has(notificationId)) return;
      const next = new Set(readIds);
      next.add(notificationId);
      saveReadIds(next);
      if (notificationId.startsWith("notif-")) {
        const rawId = notificationId.replace("notif-", "");
        markNotificationRead(rawId).catch(() => {});
      }
    },
    [readIds, saveReadIds],
  );

  const markAllAsRead = useCallback(() => {
    const next = new Set(readIds);
    notifications.forEach((item) => next.add(item.id));
    saveReadIds(next);
    markAllNotificationsRead().catch(() => {});
  }, [notifications, readIds, saveReadIds]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)).length,
    [notifications, readIds],
  );

  const visibleNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((item) => !readIds.has(item.id));
    }
    return notifications;
  }, [activeTab, notifications, readIds]);

  const unreadBadgeCount = unreadCount > 99 ? "99+" : unreadCount;

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(readStorageKey) || "[]");
      if (Array.isArray(parsed)) {
        setReadIds(new Set(parsed));
      } else {
        setReadIds(new Set());
      }
    } catch {
      setReadIds(new Set());
    }
  }, [readStorageKey]);

  useEffect(() => {
    // Handle click outside to close
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatNotificationTime = (isoDate) => {
    if (!isoDate) return "Just now";

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Just now";

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const mapStatusToNotificationType = (status) => {
    if (["rejected", "withdrawn"].includes(status)) return "error";
    if (["offer", "hired", "deployed"].includes(status)) return "info";
    return "warning";
  };

  const mapApplicationStatusMessage = (application) => {
    const status = application.status;
    const jobTitle = application.job_title;

    const messages = {
      received: `Your application for ${jobTitle} was received.`,
      screening: `Great news - your ${jobTitle} application is now in screening.`,
      interview: `You have moved to interview stage for ${jobTitle}.`,
      offer: `You have an offer update for ${jobTitle}.`,
      hired: `Congratulations! You were marked hired for ${jobTitle}.`,
      deployed: `You were deployed for ${jobTitle}.`,
      rejected: `Your ${jobTitle} application was not selected this time.`,
      withdrawn: `Your ${jobTitle} application was withdrawn.`,
    };

    return (
      messages[status] || `Your application status changed to ${status} for ${jobTitle}.`
    );
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      if (isRecruiter || isAdmin || isControlPanelAdmin) {
        const [notifData, analyticsData, contractData] = await Promise.all([
          getNotifications({ limit: 100 }),
          getDashboardAlerts(),
          getDeploymentContractAlerts({ limit: 100 }),
        ]);

        const mappedSystemNotifications = (notifData?.notifications || []).map((n) => ({
          id: `notif-${n.id}`,
          type: n.type || "info",
          message: n.message,
          timestamp: n.created_at,
          link: n.link || "/dashboard",
        }));

        const mappedContractAlerts = (contractData?.alerts || []).map((alert) => ({
          id: `contract-alert-${alert.id}`,
          type: alert.type || "warning",
          message: alert.message,
          timestamp: alert.created_at,
          link: alert.link || "/deployments",
        }));

        const mappedAnalyticsAlerts = (analyticsData?.alerts || []).map((alert) => ({
          id: `analytics-alert-${alert.id}-${alert.count ?? 0}`,
          type: alert.type || "info",
          message: alert.message,
          timestamp: new Date().toISOString(),
          link: "/dashboard",
        }));

        const merged = [
          ...mappedSystemNotifications,
          ...mappedContractAlerts,
          ...mappedAnalyticsAlerts,
        ].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
        );

        setNotifications(merged);
      } else {
        const [notifData, data] = await Promise.all([
          getNotifications({ limit: 100 }),
          getMyApplications(),
        ]);
        const mappedSystemNotifications = (notifData?.notifications || []).map((n) => ({
          id: `notif-${n.id}`,
          type: n.type || "info",
          message: n.message,
          timestamp: n.created_at,
          link: n.link || "/my-applications",
        }));
        const mappedApplications = (data?.applications || [])
          .map((application) => ({
            id: `application-${application.id}-${application.status}`,
            type: mapStatusToNotificationType(application.status),
            message: mapApplicationStatusMessage(application),
            timestamp: application.updated_at || application.applied_at,
            link: `/jobs/${application.job_id}`,
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(
          [...mappedSystemNotifications, ...mappedApplications].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          ),
        );
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  }, [isRecruiter, isAdmin, isControlPanelAdmin]);

  useEffect(() => {
    fetchNotifications();
  }, [isRecruiter, isAdmin, isControlPanelAdmin, fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [isOpen, fetchNotifications]);

  const toggleMenu = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      fetchNotifications();
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "warning": return <AlertTriangle size={16} />;
      case "error": return <AlertCircle size={16} />;
      default: return <Lightbulb size={16} />;
    }
  };

  return (
    <div className="notifications-wrapper" ref={menuRef}>
      <button 
        type="button"
        className={`notification-bell ${isOpen ? "active" : ""}`} 
        onClick={toggleMenu}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22C13.1046 22 14 21.1046 14 20H10C10 21.1046 10.8954 22 12 22Z" />
          <path d="M18 16V11C18 7.93175 15.7538 5.40578 12.83 4.90807C12.83 4.90807 12.83 4.90807 12.83 4.90807V4C12.83 3.44772 12.3823 3 11.83 3C11.2777 3 10.83 3.44772 10.83 4V4.90807C10.83 4.90807 10.83 4.90807 10.83 4.90807C7.90616 5.40578 5.66003 7.93175 5.66003 11V16L4 18V19H19.66V18L18 16Z" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadBadgeCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <button
              type="button"
              className="dots-btn"
              onClick={markAllAsRead}
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
          <div className="notifications-tabs-container">
            <button
              type="button"
              className={`tab-pill ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`tab-pill ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => setActiveTab("unread")}
            >
              Unread
            </button>
          </div>
          
          <div className="notifications-body">
            <div className="notifications-section-title">Recent</div>
            {loading ? (
              <div className="notifications-empty">Loading notifications...</div>
            ) : visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => {
                const isUnread = !readIds.has(notification.id);
                return (
                <div
                  className={`notification-item ${isUnread ? "unread" : "read"}`}
                  key={notification.id}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) {
                      navigate(notification.link);
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className={`notification-icon-bg bg-${notification.type}`}>
                    {getAlertIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <p className="notification-text">
                      {notification.message}
                    </p>
                    <span className="notification-time">
                      {formatNotificationTime(notification.timestamp)}
                    </span>
                  </div>
                  {isUnread && <div className="unread-dot"></div>}
                </div>
                );
              })
            ) : (
              <div className="notifications-empty">
                <div className="empty-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                {activeTab === "unread"
                  ? "No unread notifications."
                  : "You have no notifications right now."}
              </div>
            )}
          </div>
          <div className="notifications-footer">
            <button
              type="button"
              className="see-all-btn"
              onClick={() => {
                setIsOpen(false);
                navigate(
                  isRecruiter ||
                    isAdmin ||
                    isControlPanelAdmin ||
                    user?.role_name !== "Applicant"
                    ? "/dashboard"
                    : "/my-applications",
                );
              }}
            >
              See all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu;
