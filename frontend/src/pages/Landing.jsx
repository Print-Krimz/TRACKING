import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Rocket, TrendingDown, Target, Folder } from "lucide-react";
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
          <span className="brand-name">MEGS</span>
        </div>
        <div className="landing-nav-links">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-outline">Log In</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <section className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-content">
          <div className="hero-badge">MAR Employment for Good Services</div>
          <h1 className="hero-title">
            Smarter Recruitment.<br />
            <span className="text-gradient">Faster Deployment.</span>
          </h1>
          <p className="hero-subtitle">
            Empower your HR pipeline with AI-driven resume analysis, intelligent talent matching, and end-to-end deployment tracking.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Get Started</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Login as Recruiter</Link>
          </div>
        </div>
      </section>

      {/* 2. About the System */}
      <section id="about" className="about-section">
        <div className="container about-grid">
          <div className="about-text">
            <h2 className="section-title">Transform Your Hiring Workflow</h2>
            <p className="section-description">
              MEGS is a next-generation Web-Based Intelligent Human Resources Pipeline designed to handle large volumes of applicants effortlessly. From initial screening to final deployment, our platform ensures you find the right talent at the right time.
            </p>
            <ul className="about-list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                AI-Powered Resume Parsing
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Automated Candidate Matching
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                End-to-End HR Pipeline
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
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle">Everything you need to manage the modern workforce</p>
          </div>
          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon icon-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3>AI Resume Analysis</h3>
              <p>Instantly parse and score resumes based on specific job requirements.</p>
            </div>
            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon icon-indigo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3>Applicant Tracking (ATS)</h3>
              <p>Track candidates seamlessly through every stage of the hiring pipeline.</p>
            </div>
            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon icon-emerald">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3>Talent Pooling</h3>
              <p>Automatically match qualified candidates to the right opportunities.</p>
            </div>
            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon icon-amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3>Deployment Tracking</h3>
              <p>Seamlessly transition hired candidates into active manpower deployments.</p>
            </div>
            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon icon-rose">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3>Digital Archiving</h3>
              <p>Maintain secure, organized, and compliant digital 201 records.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="container">
          <div className="section-header text-center">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">A streamlined flow from application to deployment</p>
          </div>
          <div className="timeline-flow">
            <div className="flow-step">
              <div className="step-number">1</div>
              <h4>Applicant Applies</h4>
              <p>Candidates submit their resumes and profiles digitally.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">2</div>
              <h4>AI Analyzes</h4>
              <p>The system intelligently parses and scores the resume.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <h4>System Matches</h4>
              <p>Top candidates are matched to relevant open positions.</p>
            </div>
            <div className="flow-connector"></div>
            <div className="flow-step">
              <div className="step-number">4</div>
              <h4>Recruiter Deploys</h4>
              <p>Recruiters hire, deploy, and archive digital records seamlessly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <div className="benefits-card">
            <div className="benefits-content">
              <h2 className="section-title">Why Choose MEGS?</h2>
              <div className="benefits-list">
                <div className="benefit-item">
                  <div className="benefit-icon"><Rocket size={32} /></div>
                  <div>
                    <h4>Faster Hiring Process</h4>
                    <p>Reduce time-to-hire by automating initial candidate screenings.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><TrendingDown size={32} /></div>
                  <div>
                    <h4>Reduced Manual Work</h4>
                    <p>Eliminate tedious data entry and manual resume filtering.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><Target size={32} /></div>
                  <div>
                    <h4>Better Matching</h4>
                    <p>Leverage AI to identify the perfect fit for specific roles.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon"><Folder size={32} /></div>
                  <div>
                    <h4>Organized Digital Records</h4>
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
          <h2>Ready to Modernize Your HR Pipeline?</h2>
          <p>Join the future of intelligent recruitment and deployment today.</p>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Start Using the System</Link>
            <Link to="/login" className="btn btn-outline btn-lg cta-outline">Login as Recruiter / Admin</Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
