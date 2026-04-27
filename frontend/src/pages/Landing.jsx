import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  Folder,
  Gauge,
  Hexagon,
  ListChecks,
  Target,
  TrendingDown,
  UsersRound,
} from "lucide-react";
import "./Landing.css";

const Landing = () => {
  const { isAuthenticated } = useAuth();

  // If the user is already logged in, redirect them to the dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <div className="landing-logo">
            <Hexagon size={22} aria-hidden="true" />
          </div>
          <span className="brand-name">MEGS</span>
        </div>
        <div className="landing-nav-links">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">Workflow</a>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-outline">Log In</Link>
          <Link to="/register" className="btn btn-primary">Create account</Link>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <section className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-layout">
          <div className="hero-content">
            <div className="hero-badge">MAR Employment for Good Services</div>
            <h1 className="hero-title">
              MEGS HR Pipeline
            </h1>
            <p className="hero-subtitle">
              One operating view for applicant intake, resume review, interviews, records, and deployed personnel.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">Create Account</Link>
              <Link to="/login" className="btn btn-outline btn-lg">Recruiter login</Link>
            </div>
          </div>

          <div className="hero-product-preview" aria-label="MEGS dashboard preview">
            <div className="preview-toolbar">
              <span>Recruiter control view</span>
              <strong>Live</strong>
            </div>
            <div className="preview-metrics">
              <div><strong>4</strong><span>Applications</span></div>
              <div><strong>2</strong><span>Open jobs</span></div>
              <div><strong>1</strong><span>Interview</span></div>
            </div>
            <div className="preview-board">
              <div className="preview-column">
                <span>Screening</span>
                <div className="preview-candidate">
                  <FileSearch size={16} />
                  <strong>Candidate #2</strong>
                  <em>AI 22%</em>
                </div>
              </div>
              <div className="preview-column highlighted">
                <span>Interview</span>
                <div className="preview-candidate">
                  <UsersRound size={16} />
                  <strong>Candidate #3</strong>
                  <em>AI 92%</em>
                </div>
              </div>
              <div className="preview-column">
                <span>Deploy</span>
                <div className="preview-candidate">
                  <BriefcaseBusiness size={16} />
                  <strong>Nath</strong>
                  <em>Active</em>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. About the System */}
      <section id="about" className="about-section">
        <div className="container about-grid">
          <div className="about-text">
            <h2 className="section-title">Hiring operations without scattered records</h2>
            <p className="section-description">
              MEGS keeps applicants, recruiters, documents, interviews, and manpower deployments in one role-aware system. Teams can review candidate evidence faster while keeping records organized.
            </p>
            <ul className="about-list">
              <li>
                <CheckCircle2 size={18} />
                AI-assisted resume parsing
              </li>
              <li>
                <CheckCircle2 size={18} />
                Candidate status tracking
              </li>
              <li>
                <CheckCircle2 size={18} />
                Digital 201 record storage
              </li>
            </ul>
          </div>
          <div className="about-visual">
            <div className="mockup-card">
              <div className="mockup-header">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <div className="mockup-body">
                <div className="mockup-line title"></div>
                <div className="mockup-line"></div>
                <div className="mockup-line"></div>
                <div className="mockup-stats">
                  <div className="stat-box"></div>
                  <div className="stat-box"></div>
                  <div className="stat-box"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header text-center">
            <h2 className="section-title">Pipeline tools</h2>
            <p className="section-subtitle">The work stays visible from first application to active assignment.</p>
          </div>
          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon icon-blue">
                <FileSearch size={28} />
              </div>
              <h3>AI resume analysis</h3>
              <p>Parse resumes, extract signals, and score candidates against role requirements.</p>
            </div>
            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon icon-indigo">
                <ListChecks size={28} />
              </div>
              <h3>Applicant tracking</h3>
              <p>Track received, screening, interview, rejected, shortlisted, and deployed states.</p>
            </div>
            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon icon-emerald">
                <UsersRound size={28} />
              </div>
              <h3>Talent pooling</h3>
              <p>Save strong candidates and rescan them against newly opened roles.</p>
            </div>
            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon icon-amber">
                <BriefcaseBusiness size={28} />
              </div>
              <h3>Deployment tracking</h3>
              <p>Monitor active assignments, clients, contract dates, and manpower status.</p>
            </div>
            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon icon-rose">
                <Archive size={28} />
              </div>
              <h3>Digital archiving</h3>
              <p>Keep resume, contract, certification, and valid ID files in one applicant vault.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="container">
          <div className="section-header text-center">
            <h2 className="section-title">How work moves</h2>
            <p className="section-subtitle">A clear path from application to deployment.</p>
          </div>
          <div className="timeline-flow">
            <div className="flow-step">
              <div className="step-number">1</div>
              <h4>Applicant applies</h4>
              <p>Candidates submit resumes, profile details, and supporting documents.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">2</div>
              <h4>AI analyzes</h4>
              <p>MEGS extracts role signals and gives recruiters a review starting point.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <h4>Recruiter reviews</h4>
              <p>Recruiters compare status, score, notes, messages, and interview history.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">4</div>
              <h4>Recruiter deploys</h4>
              <p>Hired personnel move into deployment tracking with 201 records attached.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <div className="benefits-card">
            <div className="benefits-content">
              <h2 className="section-title">Why teams use MEGS</h2>
              <div className="benefits-list">
                <div className="benefit-item">
                  <div className="benefit-icon"><Gauge size={32} /></div>
                  <div>
                    <h4>Faster hiring process</h4>
                    <p>Reduce time-to-hire by automating initial candidate screenings.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><TrendingDown size={32} /></div>
                  <div>
                    <h4>Reduced manual work</h4>
                    <p>Eliminate tedious data entry and manual resume filtering.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><Target size={32} /></div>
                  <div>
                    <h4>Better matching</h4>
                    <p>Leverage AI to identify the perfect fit for specific roles.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><Folder size={32} /></div>
                  <div>
                    <h4>Organized digital records</h4>
                    <p>Keep all applicant and employee data in a secure, digital vault.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Call-to-Action Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Run the next hiring cycle in MEGS</h2>
          <p>Start with applicant intake, then keep every review, message, and deployment record in one place.</p>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Start Using the System</Link>
            <Link to="/login" className="btn btn-outline btn-lg cta-outline">Login as recruiter / admin</Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">
                <Hexagon size={18} aria-hidden="true" />
              </div>
              <span className="brand-name">MEGS</span>
            </div>
            <div className="footer-links">
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
              <a href="#about">About</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} MAR Employment for Good Services (MEGS). All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
