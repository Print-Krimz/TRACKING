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

import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsMenu from "./NotificationsMenu";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Database,
  FileStack,
  FileText,
  FolderLock,
  Hexagon,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  Users,
} from "lucide-react";
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
        icon: Home,
      },
      {
        to: "/jobs",
        label: "Jobs",
        roles: ["Applicant", "Recruiter", "Admin", "Control Panel Admin"],
        icon: BriefcaseBusiness,
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
        icon: FolderLock,
      },
      {
        to: "/my-applications",
        label: "My Applications",
        roles: ["Applicant"],
        icon: FileStack,
      },
      {
        to: "/my-resumes",
        label: "My Resumes",
        roles: ["Applicant"],
        icon: FileText,
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
        icon: Users,
      },
      {
        to: "/resumes",
        label: "Resumes",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: FileText,
      },
      {
        to: "/reports",
        label: "Reports",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: BarChart3,
      },
      {
        to: "/talent-pool",
        label: "Talent Pool",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: Database,
      },
      {
        to: "/deployments",
        label: "Deployments",
        roles: ["Recruiter", "Admin", "Control Panel Admin"],
        icon: CalendarDays,
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
        icon: PanelLeftClose,
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
      <a className="skip-link" href="#main-content">Skip to content</a>
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand */}
        <Link to="/dashboard" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Hexagon size={20} aria-hidden="true" />
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
                .map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`nav-item ${isActive(item.to) ? "active" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-item-icon">
                        <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <span className="nav-item-label">{item.label}</span>
                    </Link>
                  );
                })}
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
                <LogOut size={18} aria-hidden="true" />
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
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => {
                if (window.innerWidth <= 1024) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="header-right">
            <NotificationsMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="layout-content" id="main-content" tabIndex="-1">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
