import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, changePassword } from "../services/api";
import { User, Lock, Bell, CheckCircle2, AlertTriangle, Moon, Sun } from "lucide-react";
import "./UserSettings.css";

const UserSettings = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile State
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    phone: "",
    location: "",
    current_title: "",
    years_experience: "",
    linkedin_url: "",
    portfolio_url: "",
    professional_summary: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password State
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Preferences State
  const [darkMode, setDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );
  const [emailAlerts, setEmailAlerts] = useState(true);

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        location: user.location || "",
        current_title: user.current_title || "",
        years_experience:
          user.years_experience === null || user.years_experience === undefined
            ? ""
            : String(user.years_experience),
        linkedin_url: user.linkedin_url || "",
        portfolio_url: user.portfolio_url || "",
        professional_summary: user.professional_summary || "",
      });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    setPasswordError(""); // Clear error on type
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const urlPattern = /^https?:\/\/.+/i;
    if (profileForm.linkedin_url && !urlPattern.test(profileForm.linkedin_url)) {
      showToast("LinkedIn URL must start with http:// or https://", "error");
      return;
    }
    if (profileForm.portfolio_url && !urlPattern.test(profileForm.portfolio_url)) {
      showToast("Portfolio URL must start with http:// or https://", "error");
      return;
    }
    const exp =
      profileForm.years_experience === ""
        ? null
        : Number(profileForm.years_experience);
    if (exp !== null && (!Number.isFinite(exp) || exp < 0)) {
      showToast("Years of experience must be 0 or greater.", "error");
      return;
    }
    setProfileLoading(true);
    try {
      const payload = {
        ...profileForm,
        years_experience: exp,
        linkedin_url: profileForm.linkedin_url || null,
        portfolio_url: profileForm.portfolio_url || null,
      };
      const updatedUser = await updateProfile(payload);
      setUser(updatedUser); // Update Auth Context
      
      // Update local storage if needed
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, ...updatedUser }));

      showToast("Profile updated successfully", "success");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to update profile", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New passwords do not match.");
      return;
    }
    
    setPasswordLoading(true);
    try {
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      showToast("Password changed successfully", "success");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
    } catch (err) {
      console.error(err);
      setPasswordError(err.response?.data?.detail || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const nextTheme = !darkMode ? "dark" : "light";
    setDarkMode(!darkMode);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Account Settings</h1>
        <p>Manage your profile, security, and preferences.</p>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar" role="tablist" aria-label="Settings sections">
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={`settings-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={18} /> Profile Information
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            className={`settings-tab ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <Lock size={18} /> Security & Password
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === "preferences"}
            className={`settings-tab ${activeTab === "preferences" ? "active" : ""}`}
            onClick={() => setActiveTab("preferences")}
          >
            <Bell size={18} /> App Preferences
          </button>
        </div>

        <div className="settings-content">
          
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="settings-panel animate-fadeIn">
              <h2>Profile Information</h2>
              <p className="panel-desc">Update your personal details and how we can reach you.</p>
              
              <form onSubmit={handleProfileSubmit} className="settings-form">
                <div className="form-group">
                  <label htmlFor="settings-username">Username</label>
                  <input 
                    id="settings-username"
                    type="text" 
                    name="username" 
                    value={profileForm.username} 
                    onChange={handleProfileChange}
                    required
                    minLength="3"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-email">Email Address</label>
                  <input 
                    id="settings-email"
                    type="email" 
                    name="email" 
                    value={profileForm.email} 
                    onChange={handleProfileChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-phone">Phone</label>
                  <input
                    id="settings-phone"
                    type="text"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                    maxLength="30"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-location">Location</label>
                  <input
                    id="settings-location"
                    type="text"
                    name="location"
                    value={profileForm.location}
                    onChange={handleProfileChange}
                    maxLength="120"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-current-title">Current Title</label>
                  <input
                    id="settings-current-title"
                    type="text"
                    name="current_title"
                    value={profileForm.current_title}
                    onChange={handleProfileChange}
                    maxLength="120"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-years-experience">Years of Experience</label>
                  <input
                    id="settings-years-experience"
                    type="number"
                    name="years_experience"
                    value={profileForm.years_experience}
                    onChange={handleProfileChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-linkedin-url">LinkedIn URL</label>
                  <input
                    id="settings-linkedin-url"
                    type="url"
                    name="linkedin_url"
                    value={profileForm.linkedin_url}
                    onChange={handleProfileChange}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-portfolio-url">Portfolio URL</label>
                  <input
                    id="settings-portfolio-url"
                    type="url"
                    name="portfolio_url"
                    value={profileForm.portfolio_url}
                    onChange={handleProfileChange}
                    placeholder="https://..."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-professional-summary">Professional Summary</label>
                  <textarea
                    id="settings-professional-summary"
                    name="professional_summary"
                    value={profileForm.professional_summary}
                    onChange={handleProfileChange}
                    rows={4}
                    maxLength="2000"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-role">Role</label>
                  <input id="settings-role" type="text" value={user?.role_name || "Unknown"} disabled className="disabled-input" />
                  <small className="help-text">Roles cannot be changed by the user. Contact an administrator.</small>
                </div>
                
                <button type="submit" className="save-btn" disabled={profileLoading}>
                  {profileLoading ? <span className="btn-spinner"></span> : <><CheckCircle2 size={16} /> Save Changes</>}
                </button>
              </form>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <div className="settings-panel animate-fadeIn">
              <h2>Security & Password</h2>
              <p className="panel-desc">Ensure your account stays secure with a strong password.</p>
              
              {passwordError && (
                <div className="settings-error">
                  <AlertTriangle size={16} /> {passwordError}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="settings-form">
                <div className="form-group">
                  <label htmlFor="settings-current-password">Current Password</label>
                  <input 
                    id="settings-current-password"
                    type="password" 
                    name="current_password" 
                    value={passwordForm.current_password} 
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className="divider"></div>
                <div className="form-group">
                  <label htmlFor="settings-new-password">New Password</label>
                  <input 
                    id="settings-new-password"
                    type="password" 
                    name="new_password" 
                    value={passwordForm.new_password} 
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-confirm-password">Confirm New Password</label>
                  <input 
                    id="settings-confirm-password"
                    type="password" 
                    name="confirm_password" 
                    value={passwordForm.confirm_password} 
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>
                
                <button type="submit" className="save-btn" disabled={passwordLoading}>
                  {passwordLoading ? <span className="btn-spinner"></span> : <><Lock size={16} /> Update Password</>}
                </button>
              </form>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === "preferences" && (
            <div className="settings-panel animate-fadeIn">
              <h2>App Preferences</h2>
              <p className="panel-desc">Customize your system experience.</p>
              
              <div className="preference-list">
                <div className="preference-item">
                  <div className="pref-info">
                    <div className="pref-icon">
                      {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                    </div>
                    <div>
                      <h4>Dark Mode</h4>
                      <p>Switch between light and dark themes.</p>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} aria-label="Toggle dark mode" />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="pref-info">
                    <div className="pref-icon"><Bell size={20} /></div>
                    <div>
                      <h4>Email Notifications</h4>
                      <p>Receive updates about applications and system alerts.</p>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} aria-label="Toggle email notifications" />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UserSettings;
