/**
 * Layout Component
 *
 * Main application shell with collapsible sidebar navigation,
 * top header with breadcrumbs, and a user dropdown.
 *
 * Features:
 * - Sidebar with role-based navigation links
 * - Collapsible sidebar (desktop: toggle, mobile: drawer)
 * - User dropdown with profile info and logout
 * - Responsive design with mobile overlay
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsMenu from "./NotificationsMenu";
import { Settings } from "lucide-react";
import "./Layout.css";

/**
 * Navigation items grouped by role.
 * Each item: { to, label, icon (SVG path), roles (who can see) }
 */
const NAV_ITEMS = [
  {
    group: "Main",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        roles: ["Applicant", "Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        to: "/jobs",
        label: "Jobs",
        roles: ["Applicant", "Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Applicant",
    roles: ["Applicant"],
    items: [
      {
        to: "/vault",
        label: "Digital 201 Vault",
        roles: ["Applicant"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 19V6C5 4.89543 5.89543 4 7 4H13.5858C13.851 4 14.1054 4.10536 14.2929 4.29289L19.7071 9.70711C19.8946 9.89464 20 10.149 20 10.4142V19C20 20.1046 19.1046 21 18 21H7C5.89543 21 5 20.1046 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 4V10H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 15H15M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        to: "/my-applications",
        label: "My Applications",
        roles: ["Applicant"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        to: "/my-resumes",
        label: "My Resumes",
        roles: ["Applicant"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Recruitment",
    roles: ["Recruiter", "Admin", "Control Panel Admin"],
    items: [
      {
        to: "/applicants",
        label: "Applicants",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21M23 21V19C22.9986 17.177 21.765 15.5857 20 15.13M16 3.13C17.7699 3.58317 19.0078 5.17799 19.0078 7.005C19.0078 8.83201 17.7699 10.4268 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        to: "/resumes",
        label: "Resumes",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6H20M4 12H20M4 18H20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        to: "/reports",
        label: "Reports",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M16 8V16M12 11V16M8 14V16M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 5 4.89543 5 6V18C5 19.1046 4.89543 20 6 20Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        to: "/talent-pool",
        label: "Talent Pool",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4C16.4183 4 20 5.79086 20 8V16C20 18.2091 16.4183 20 12 20C7.58172 20 4 18.2091 4 16V8C4 5.79086 7.58172 4 12 4Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M4 8C4 10.2091 7.58172 12 12 12C16.4183 12 20 10.2091 20 8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M9 16H9.01M12 16H12.01M15 16H15.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        to: "/deployments",
        label: "Deployments",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7H7C5.89543 7 5 7.89543 5 9V11M9 7V3M15 7V3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Admin",
    roles: ["Admin", "Control Panel Admin"],
    items: [
      {
        to: "/admin-control-panel",
        label: "Control Panel",
        roles: ["Admin", "Control Panel Admin"],
        icon: (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4.35418C12.7329 3.52375 13.8053 3 15 3C17.2091 3 19 4.79086 19 7C19 9.20914 17.2091 11 15 11C13.8053 11 12.7329 10.4762 12 9.64582M15 21H3V20C3 16.6863 5.68629 14 9 14C12.3137 14 15 16.6863 15 20V21ZM15 21H21V20C21 16.6863 18.3137 14 15 14C13.9071 14 12.8825 14.2922 12 14.8027M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
];

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Don't show layout on auth pages
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const userRole = user?.role_name || "Applicant";
  const userInitials = (user?.username || "U").slice(0, 2).toUpperCase();

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/login");
  };

  // Check if a nav item matches current path
  const isActive = (to) => {
    if (to === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/recruiter";
    }
    return location.pathname === to || location.pathname.startsWith(to + "/");
  };

  // Filter nav groups visible to this role
  const visibleGroups = NAV_ITEMS.filter(
    (group) => !group.roles || group.roles.includes(userRole),
  );

  const layoutClass = [
    "layout",
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "sidebar-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClass}>
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand */}
        <Link to="/dashboard" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 8V16M9 10V14M15 10V14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <span className="sidebar-brand-text">MEGS</span>
            <div className="sidebar-brand-subtitle">HR Pipeline</div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {visibleGroups.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-label">{group.group}</div>
              {group.items
                .filter((item) => item.roles.includes(userRole))
                .map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item ${isActive(item.to) ? "active" : ""}`}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    <span className="nav-item-label">{item.label}</span>
                  </Link>
                ))}
            </div>
          ))}
        </nav>

        {/* Footer - User Card & Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="user-avatar">{userInitials}</div>
            <div className="user-details">
              <div className="user-details-name">{user?.username}</div>
              <div className="user-details-role">{userRole}</div>
            </div>
            <div className="sidebar-actions">
              <Link to="/settings" className="logout-btn settings-btn" title="Settings">
                <Settings size={18} />
              </Link>
              <button className="logout-btn" onClick={handleLogout} title="Sign Out">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <div
        className="sidebar-overlay"
        onClick={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="layout-main">
        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="layout-modal-overlay">
            <div className="layout-modal">
              <div className="layout-modal-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 9V2M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Sign Out</h3>
              <p>Are you sure you want to log out of your account?</p>
              <div className="layout-modal-actions">
                <button className="layout-modal-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                <button className="layout-modal-confirm" onClick={confirmLogout}>Yes, Sign Out</button>
              </div>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="layout-header">
          <div className="header-left">
            <button
              className="sidebar-toggle"
              onClick={() => {
                if (window.innerWidth <= 1024) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6H20M4 12H20M4 18H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="header-right">
            <NotificationsMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="layout-content">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
