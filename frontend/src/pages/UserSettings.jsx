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
    email: ""
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
        email: user.email || ""
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
    setProfileLoading(true);
    try {
      const updatedUser = await updateProfile(profileForm);
      setUser(updatedUser); // Update Auth Context
      
      // Update local storage if needed
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, ...updatedUser }));

      showToast("Profile updated successfully!", "success");
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
      showToast("Password changed successfully!", "success");
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
        <div className="settings-sidebar">
          <button 
            className={`settings-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={18} /> Profile Information
          </button>
          <button 
            className={`settings-tab ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <Lock size={18} /> Security & Password
          </button>
          <button 
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
                  <label>Username</label>
                  <input 
                    type="text" 
                    name="username" 
                    value={profileForm.username} 
                    onChange={handleProfileChange}
                    required
                    minLength="3"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={profileForm.email} 
                    onChange={handleProfileChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input type="text" value={user?.role_name || "Unknown"} disabled className="disabled-input" />
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
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    name="current_password" 
                    value={passwordForm.current_password} 
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className="divider"></div>
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    name="new_password" 
                    value={passwordForm.new_password} 
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
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
                    <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
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
                    <input type="checkbox" checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} />
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
