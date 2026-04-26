import { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";
import { AccountingView, BankingView, QuickBillModal } from "./lib/AccountingModule.jsx";
import { getAccountingPromptExtension, parseExpenseFromResponse, stripExpenseTag } from "./lib/accountingPrompts.js";
import { FinancialDashboardWidgets, MaintenanceView, TenantLedgerPanel, Vendor1099Hub, EmailRobot } from "./lib/PropertyManagementModule.jsx";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://lzxutumsrzjovjmebqns.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eHV0dW1zcnpqb3ZqbWVicW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODAzNzAsImV4cCI6MjA4ODI1NjM3MH0.WuZsLON6sZ2Oe7uEKOZysZzcQXOGwFDaK5doxhulEAA";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
// API calls go through our backend to keep the key secure

// Simple Supabase client
const supabase = {
  auth: {
    getSession: async () => {
      // Check URL for email confirmation token (from email link)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          try {
            // Get user info from token
            const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_ANON_KEY
              }
            });
            const userData = await res.json();
            if (userData && userData.id) {
              localStorage.setItem('sb-token', accessToken);
              localStorage.setItem('sb-user', JSON.stringify(userData));
              if (userData.user_metadata) {
                localStorage.setItem('sb-profile', JSON.stringify(userData.user_metadata));
              }
              // Clean URL - remove hash
              window.history.replaceState(null, '', window.location.pathname);
              return { data: { session: { user: userData, access_token: accessToken } } };
            }
          } catch (err) {
            console.error("Error getting user from confirmation token:", err);
          }
        }
      }
      
      const token = localStorage.getItem('sb-token');
      const user = localStorage.getItem('sb-user');
      if (token && user) {
        return { data: { session: { access_token: token, user: JSON.parse(user) } } };
      }
      return { data: { session: null } };
    },
    signUp: async ({ email, password, options }) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY 
          },
          body: JSON.stringify({ 
            email, 
            password,
            data: options?.data || {},
            options: {
              emailRedirectTo: window.location.origin
            }
          })
        });
        const data = await res.json();
        if (data.error) return { error: data.error };
        if (data.access_token) {
          localStorage.setItem('sb-token', data.access_token);
          localStorage.setItem('sb-user', JSON.stringify(data.user));
        }
        if (options?.data) {
          localStorage.setItem('sb-profile', JSON.stringify(options.data));
        }
        return { data, error: null };
      } catch (err) {
        return { error: { message: err.message } };
      }
    },
    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY 
          },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.error) return { error: data.error };
        if (data.access_token) {
  localStorage.setItem('sb-token', data.access_token);
  localStorage.setItem('sb-refresh-token', data.refresh_token || '');
  localStorage.setItem('sb-token-expires', String(Date.now() + (data.expires_in || 3600) * 1000));
  localStorage.setItem('sb-user', JSON.stringify(data.user));
  if (data.user?.user_metadata) {
    localStorage.setItem('sb-profile', JSON.stringify(data.user.user_metadata));
  }
}
        return { data, error: null };
      } catch (err) {
        return { error: { message: err.message } };
      }
    },
    signOut: async () => {
      localStorage.removeItem('sb-token');
      localStorage.removeItem('sb-user');
      localStorage.removeItem('sb-profile');
      localStorage.removeItem('reptrack-chat-history');
      return { error: null };
    },
    onAuthStateChange: (callback) => {
      const token = localStorage.getItem('sb-token');
      const user = localStorage.getItem('sb-user');
      if (token && user) {
        callback('SIGNED_IN', { access_token: token, user: JSON.parse(user) });
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  }
};

const getProfile = () => {
  const profile = localStorage.getItem('sb-profile');
  return profile ? JSON.parse(profile) : null;
};

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthContext = createContext({});

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setProfile(getProfile());
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setProfile(getProfile());
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, profileData) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: { data: profileData }
    });
    if (!error && data?.user) {
      setUser(data.user);
      setProfile(profileData);
    }
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      setUser(data.user);
      setProfile(getProfile());
    }
    return { data, error };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  // Job info
  const [jobType, setJobType] = useState("w2");
  const [employerName, setEmployerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { signIn, signUp } = useAuth();

  const inputStyle = { 
    width: "100%", padding: "12px 14px", fontSize: 14, 
    border: "1px solid #E2E8F0", borderRadius: 4, 
    background: "#F1F5F9", color: "#0D1B2A", outline: "none", 
    fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" 
  };
  const labelStyle = { 
    display: "block", fontSize: 10, color: "#64748B", 
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 
  };

  const jobTypes = [
    { id: "w2", label: "W-2 Employee", icon: "💼" },
    { id: "1099", label: "1099 Contractor", icon: "📋" },
    { id: "self", label: "Self-Employed", icon: "🏢" },
    { id: "multiple", label: "Multiple Jobs", icon: "📊" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        setLoading(false);
        return;
      }
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        jobType: jobType,
        employerName: employerName.trim(),
        createdAt: new Date().toISOString()
      };
      const { data, error } = await signUp(email, password, profileData);
      if (error) {
        setError(error.message);
      } else if (data?.user?.identities?.length === 0) {
        setError("This email is already registered. Please log in.");
      } else {
        // Show confirmation screen
        setShowConfirmation(true);
      }
    }
    setLoading(false);
  };

  const goToLogin = () => {
    setShowConfirmation(false);
    setMode("login");
    setError("");
    setMessage("");
    // Keep email so user doesn't have to retype it
  };

  // ═══ EMAIL CONFIRMATION SCREEN ═══
  if (showConfirmation) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(150deg, #0D1B2A 0%, #0A2A3A 50%, #0D1B2A 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');`}</style>
        
        <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 25px 80px rgba(0,0,0,0.4)", textAlign: "center" }}>
          {/* Success Icon */}
          <div style={{ 
            width: 80, height: 80, borderRadius: "50%", 
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", fontSize: 40
          }}>
            ✉️
          </div>
          
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0D1B2A", fontFamily: "'Inter', sans-serif", margin: "0 0 12px" }}>
            Check Your Email
          </h1>
          
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px" }}>
            We sent a confirmation link to:<br/>
            <strong style={{ color: "#0D1B2A" }}>{email}</strong>
          </p>
          
          <div style={{ 
            background: "#e8f4ec", border: "1px solid #86efac", borderRadius: 8, 
            padding: 16, marginBottom: 24, textAlign: "left" 
          }}>
            <div style={{ fontSize: 13, color: "#166534", fontWeight: 600, marginBottom: 8 }}>
              📋 Next Steps:
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#166534", lineHeight: 1.8 }}>
              <li>Open your email inbox</li>
              <li>Click the confirmation link from RepTrack</li>
              <li>Come back here and log in!</li>
            </ol>
          </div>
          
          <button 
            onClick={goToLogin}
            style={{ 
              width: "100%", padding: "14px 20px", 
              background: "#00C9A7", border: "none", borderRadius: 4, 
              color: "#0D1B2A", fontSize: 14, fontWeight: 600, 
              cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
              marginBottom: 16
            }}
          >
            ← Go to Login
          </button>
          
          <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
            Didn't receive the email? Check your spam folder or{" "}
            <span 
              onClick={() => { setShowConfirmation(false); setMode("signup"); }}
              style={{ color: "#00C9A7", cursor: "pointer", textDecoration: "underline" }}
            >
              try again
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ═══ MAIN LOGIN/SIGNUP SCREEN ═══
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(150deg, #0D1B2A 0%, #0A2A3A 50%, #0D1B2A 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');`}</style>
      
      <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "40px 36px", width: "100%", maxWidth: mode === "signup" ? 480 : 420, boxShadow: "0 25px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0D1B2A", fontFamily: "'Inter', sans-serif", letterSpacing: -1 }}>
            Rep<span style={{ color: "#00C9A7" }}>Track</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", letterSpacing: 2, textTransform: "uppercase", marginTop: 6 }}>Real Estate Professional Tracker</div>
        </div>

        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid #E2E8F0" }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setMessage(""); }}
              style={{ flex: 1, padding: "12px 0", background: "none", border: "none",
                borderBottom: mode === m ? "2px solid #00C9A7" : "2px solid transparent",
                color: mode === m ? "#00C9A7" : "#64748B",
                fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase",
                cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required={mode === "signup"} style={inputStyle} placeholder="John" />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required={mode === "signup"} style={inputStyle} placeholder="Smith" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} placeholder="Smith Properties LLC" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="(555) 123-4567" />
              </div>

              {/* Job Type Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Primary Job Type *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {jobTypes.map(job => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setJobType(job.id)}
                      style={{
                        padding: "10px 12px", border: `2px solid ${jobType === job.id ? "#00C9A7" : "#E2E8F0"}`,
                        borderRadius: 6, background: jobType === job.id ? "#E0F7F4" : "white",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s"
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{job.icon}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: "#0D1B2A" }}>
                        {job.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Employer/Company Name based on job type */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  {jobType === "w2" ? "Employer Name" : jobType === "1099" ? "Client/Company Name" : jobType === "self" ? "Business Name" : "Primary Employer/Client"}
                </label>
                <input 
                  type="text" 
                  value={employerName} 
                  onChange={(e) => setEmployerName(e.target.value)} 
                  style={inputStyle} 
                  placeholder={jobType === "w2" ? "ABC Hospital" : jobType === "1099" ? "XYZ Consulting Inc" : jobType === "self" ? "My Business LLC" : "Primary employer name"}
                />
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", margin: "20px 0", paddingTop: 16 }}>
                <div style={{ fontSize: 10, color: "#64748B", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Account Credentials</div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inputStyle} placeholder="••••••••" />
            {mode === "signup" && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>Minimum 6 characters</div>}
          </div>

          {error && <div style={{ background: "#f5e4e4", border: "1px solid #993030", borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#7a1a1a" }}>{error}</div>}
          {message && <div style={{ background: "#e4f2ea", border: "1px solid #256b45", borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1a5c38" }}>{message}</div>}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "14px 20px", background: loading ? "#94A3B8" : "#00C9A7", border: "none", borderRadius: 8, color: "#0D1B2A", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif" }}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #E2E8F0", textAlign: "center", fontSize: 11, color: "#94A3B8" }}>
          {mode === "login" ? (
            <>Don't have an account? <span onClick={() => setMode("signup")} style={{ color: "#00C9A7", cursor: "pointer", fontWeight: 600 }}>Sign up</span></>
          ) : (
            <>Already have an account? <span onClick={() => setMode("login")} style={{ color: "#00C9A7", cursor: "pointer", fontWeight: 600 }}>Log in</span></>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── IRS CATEGORIES & RULES ───────────────────────────────────────────────────
const IRS_CATEGORIES = {
  // RE Qualifying Categories - Long Term Rentals
  management: { label: "Property Management", qualifies: true, examples: "tenant relations, property oversight, lease enforcement" },
  maintenance: { label: "Maintenance & Repairs", qualifies: true, examples: "coordinating repairs, supervising contractors, property inspections" },
  leasing: { label: "Leasing", qualifies: true, examples: "showings, tenant screening, lease preparation, move-in/out" },
  financial: { label: "Financial Management", qualifies: true, examples: "rent collection, bookkeeping, P&L review, expense tracking" },
  legal: { label: "Legal & Administrative", qualifies: true, examples: "lease review, compliance, eviction process, insurance" },
  vendor: { label: "Vendor Coordination", qualifies: true, examples: "contractor meetings, getting bids, supervising work" },
  acquisition: { label: "Acquisition", qualifies: true, examples: "property tours, due diligence, market research, negotiations" },
  construction: { label: "Construction", qualifies: true, examples: "renovation oversight, permits, contractor coordination" },
  travel: { label: "RE Travel", qualifies: true, examples: "driving to properties, travel for REP activities" },
  education: { label: "RE Education", qualifies: true, examples: "RE courses, seminars, studying RE topics" },
  // STR Qualifying Categories
  guest_communication: { label: "Guest Communication", qualifies: true, examples: "responding to inquiries, booking questions, issue resolution", isSTR: true },
  turnover_coordination: { label: "Turnover Coordination", qualifies: true, examples: "scheduling cleaners, coordinating access, quality checks", isSTR: true },
  cleaning_supervision: { label: "Cleaning Supervision", qualifies: true, examples: "inspecting cleanliness, restocking supplies, turnover walks", isSTR: true },
  platform_management: { label: "Platform Management", qualifies: true, examples: "updating listings, photos, descriptions, availability", isSTR: true },
  pricing_optimization: { label: "Pricing & Revenue", qualifies: true, examples: "dynamic pricing, rate adjustments, competitor analysis", isSTR: true },
  checkin_checkout: { label: "Check-in/Check-out", qualifies: true, examples: "guest arrivals, key handoffs, departure inspections", isSTR: true },
  review_management: { label: "Review Management", qualifies: true, examples: "responding to reviews, addressing feedback, reputation", isSTR: true },
  supplies_restocking: { label: "Supplies & Restocking", qualifies: true, examples: "purchasing supplies, inventory management, deliveries", isSTR: true },
  // Non-REP Categories (for tracking total work hours)
  w2_employment: { label: "W-2 Employment", qualifies: false, examples: "regular job, employer work, scheduled shifts" },
  self_employment: { label: "Self-Employment (Non-REP)", qualifies: false, examples: "non-REP business, freelance, side business" },
  consulting: { label: "Consulting Work", qualifies: false, examples: "professional consulting, advisory work" },
  other_business: { label: "Other Business Income", qualifies: false, examples: "other business activities, non-REP income work" },
  non_re: { label: "Non-REPP Work (General)", qualifies: false, examples: "other non-qualifying work" }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAINTENANCE — request types and urgency levels
// ═══════════════════════════════════════════════════════════════════════════
const REQUEST_TYPES = [
  { id: "hvac",          label: "HVAC" },
  { id: "plumbing",      label: "Plumbing" },
  { id: "electrical",    label: "Electrical" },
  { id: "painting",      label: "Painting" },
  { id: "appliance",     label: "Appliance" },
  { id: "flooring",      label: "Flooring" },
  { id: "pest_control",  label: "Pest Control" },
  { id: "landscaping",   label: "Landscaping" },
  { id: "general",       label: "General" },
  { id: "emergency",     label: "Emergency" },
];

const URGENCY_LEVELS = [
  { id: "low",       label: "Low",       color: "#6b7280", sla: "7 days"  },
  { id: "medium",    label: "Medium",    color: "#2563eb", sla: "3 days"  },
  { id: "high",      label: "High",      color: "#d97706", sla: "24 hrs"  },
  { id: "emergency", label: "Emergency", color: "#dc2626", sla: "2 hrs"   },
];

const STATUS_COLUMNS = [
  { id: "new",         label: "New",         description: "Not yet triaged" },
  { id: "assigned",    label: "Assigned",    description: "Vendor notified" },
  { id: "in_progress", label: "In Progress", description: "Work underway"   },
  { id: "completed",   label: "Completed",   description: "Resolved"        },
];

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTING — Chart of Accounts with Schedule E line tagging
// Every expense account maps to a Schedule E (Form 1040) line number so
// year-end reports can aggregate directly into the tax form.
// ═══════════════════════════════════════════════════════════════════════════
const CHART_OF_ACCOUNTS = [
  // Assets (1xxx)
  { code: "1010", name: "Operating Cash",      type: "asset",     schE: null },
  { code: "1020", name: "Security Deposits Held", type: "asset",  schE: null },
  { code: "1500", name: "Buildings",           type: "asset",     schE: null },
  { code: "1510", name: "Accumulated Depreciation", type: "asset", schE: null },

  // Liabilities (2xxx)
  { code: "2010", name: "Accounts Payable",    type: "liability", schE: null },
  { code: "2020", name: "Security Deposits Owed", type: "liability", schE: null },
  { code: "2500", name: "Mortgage Payable",    type: "liability", schE: null },

  // Equity (3xxx)
  { code: "3010", name: "Owner Capital",       type: "equity",    schE: null },
  { code: "3020", name: "Owner Draws",         type: "equity",    schE: null },

  // Income (4xxx) → Schedule E line 3
  { code: "4010", name: "Rental Income",       type: "income",    schE: 3 },
  { code: "4020", name: "Late Fees",           type: "income",    schE: 3 },
  { code: "4030", name: "Pet Fees",            type: "income",    schE: 3 },
  { code: "4090", name: "Other Rental Income", type: "income",    schE: 3 },

  // Expenses (5xxx) → Schedule E lines 5–19
  { code: "5050", name: "Advertising",         type: "expense",   schE: 5  },
  { code: "5060", name: "Auto & Travel",       type: "expense",   schE: 6  },
  { code: "5070", name: "Cleaning & Maintenance", type: "expense", schE: 7 },
  { code: "5080", name: "Commissions",         type: "expense",   schE: 8  },
  { code: "5090", name: "Insurance",           type: "expense",   schE: 9  },
  { code: "5100", name: "Legal & Professional", type: "expense",  schE: 10 },
  { code: "5110", name: "Management Fees",     type: "expense",   schE: 11 },
  { code: "5120", name: "Mortgage Interest",   type: "expense",   schE: 12 },
  { code: "5130", name: "Other Interest",      type: "expense",   schE: 13 },
  { code: "5140", name: "Repairs",             type: "expense",   schE: 14 },
  { code: "5150", name: "Supplies",            type: "expense",   schE: 15 },
  { code: "5160", name: "Taxes",               type: "expense",   schE: 16 },
  { code: "5170", name: "Utilities",           type: "expense",   schE: 17 },
  { code: "5180", name: "Depreciation",        type: "expense",   schE: 18 },
  { code: "5900", name: "Other Expenses",      type: "expense",   schE: 19 },
];

// Non-REP quick add options
const NON_RE_QUICK_OPTIONS = [
  { id: "w2_employment", label: "W-2 Job", icon: "💼" },
  { id: "self_employment", label: "Self-Employment", icon: "📊" },
  { id: "consulting", label: "Consulting", icon: "🎯" },
  { id: "other_business", label: "Other Business", icon: "📁" },
];

// ─── Helper Functions ────────────────────────────────────────────────────────
const fmtH = (m) => { const h=Math.floor(m/60),mn=m%60; return !h&&!mn?"0h":`${h>0?h+"h":""}${mn>0?" "+mn+"m":""}`.trim(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const todayStr = () => new Date().toISOString().split("T")[0];

// Single palette: dark navy + teal accent + grays only
const C = {
  bg:"#F4F6F9", white:"#ffffff", dark:"#0D1B2A", darker:"#060F1A", text:"#1E293B",
  mid:"#475569", light:"#64748B", lighter:"#94A3B8", border:"#E2E8F0", borderL:"#EEF2F7",
  // Teal — THE accent color
  gold:"#00A88C", goldL:"#00C9A7", goldPale:"#E0F7F4", goldBright:"#00E5C4",
  // "Green" → teal (positive uses accent, not green)
  green:"#007A6A", greenPale:"#E0F7F4", greenB:"#00C9A7",
  // "Red" → dark gray (alerts use dark, not red)
  red:"#475569", redPale:"#F1F5F9", redB:"#64748B",
  // "Blue" → same gray family
  blue:"#334155", bluePale:"#F4F6F9", blueB:"#475569",
  // Orange/Purple → gray
  purple:"#475569", purpleB:"#64748B",
  orange:"#475569", orangePale:"#F4F6F9", orangeB:"#64748B",
};

// SVG icon components — render in currentColor so they respect CSS color
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const NAV_ICONS = {
  assistant:   "M12 2a7 7 0 0 1 7 7v3a7 7 0 1 1-14 0V9a7 7 0 0 1 7-7zM9 10h.01M15 10h.01M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5",
  dashboard:   "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z",
  records:     "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  properties:  "M3 12l9-9 9 9M5 10v10h14V10",
  tenants:     "M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  vendors:     "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  maintenance: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  accounting:  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  banking:     "M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3",
};
const VIEWS = [
  { id:"assistant",   label:"Assistant"   },
  { id:"dashboard",   label:"Dashboard"   },
  { id:"records",     label:"Records"     },
  { id:"properties",  label:"Properties"  },
  { id:"tenants",     label:"Tenants"     },
  { id:"vendors",     label:"Vendors"     },
  { id:"maintenance", label:"Maintenance" },
  { id:"accounting",  label:"Accounting"  },
  { id:"banking",     label:"Banking"     },
];

// STR Platforms
const STR_PLATFORMS = [
  { id: "airbnb", name: "Airbnb", icon: "🏠", color: "#FF5A5F" },
  { id: "vrbo", name: "VRBO", icon: "🏡", color: "#3B5998" },
  { id: "padslip", name: "Padslip", icon: "📱", color: "#00C853" },
  { id: "direct", name: "Direct Booking", icon: "📧", color: "#FFA000" },
  { id: "other", name: "Other", icon: "🔗", color: "#757575" },
];

// STR IRS Categories (all qualify for REP)
const STR_CATEGORIES = {
  guest_communication: { label: "Guest Communication", qualifies: true, examples: "responding to inquiries, booking questions, issue resolution" },
  turnover_coordination: { label: "Turnover Coordination", qualifies: true, examples: "scheduling cleaners, coordinating access, quality checks" },
  cleaning_supervision: { label: "Cleaning Supervision", qualifies: true, examples: "inspecting cleanliness, restocking supplies, turnover walks" },
  platform_management: { label: "Platform Management", qualifies: true, examples: "updating listings, photos, descriptions, availability" },
  pricing_optimization: { label: "Pricing & Revenue", qualifies: true, examples: "dynamic pricing, rate adjustments, competitor analysis" },
  checkin_checkout: { label: "Check-in/Check-out", qualifies: true, examples: "guest arrivals, key handoffs, departure inspections" },
  review_management: { label: "Review Management", qualifies: true, examples: "responding to reviews, addressing feedback, reputation" },
  supplies_restocking: { label: "Supplies & Restocking", qualifies: true, examples: "purchasing supplies, inventory management, deliveries" },
  maintenance_str: { label: "STR Maintenance", qualifies: true, examples: "quick fixes between guests, appliance issues, repairs" },
};

// Vendor categories
const VENDOR_CATEGORIES = [
  { id: "plumber", label: "Plumber", icon: "🔧" },
  { id: "electrician", label: "Electrician", icon: "⚡" },
  { id: "hvac", label: "HVAC", icon: "❄️" },
  { id: "general_contractor", label: "General Contractor", icon: "🏗️" },
  { id: "landscaper", label: "Landscaper", icon: "🌳" },
  { id: "handyman", label: "Handyman", icon: "🔨" },
  { id: "roofer", label: "Roofer", icon: "🏠" },
  { id: "cleaning", label: "Cleaning Service", icon: "🧹" },
  { id: "property_manager", label: "Property Manager", icon: "📋" },
  { id: "other", label: "Other", icon: "📁" },
];

// Email provider URLs for mailto links
const EMAIL_PROVIDERS = {
  gmail: { name: "Gmail", url: "https://mail.google.com/mail/?view=cm&to=" },
  outlook: { name: "Outlook", url: "https://outlook.live.com/mail/0/deeplink/compose?to=" },
  apple: { name: "Apple Mail", url: "mailto:" },
  default: { name: "Default", url: "mailto:" }
};

// ─── ENHANCED CLAUDE AI SYSTEM PROMPT ─────────────────────────────────────────
const getSystemPrompt = (reHrs, rePct, entries, profile, properties) => `You are RepTrack — an INTELLIGENT ORGANIZER for real estate professionals. You are NOT a tax advisor; you do NOT give tax advice or legal opinions. Your job is to ORGANIZE, STRUCTURE, and DOCUMENT the user's day-to-day real estate work so it survives IRS scrutiny under IRC §469(c)(7).

═══════════════════════════════════════════════════════════════════════════════
WHO YOU ARE — POSITIONING (NEVER VIOLATE)
═══════════════════════════════════════════════════════════════════════════════
• ORGANIZER, not advisor. You sort, log, and format — you do not opine on what users should claim.
• You apply IRS §469(c)(7) rules and Treasury Regulations §1.469-9 / §1.469-5T to CATEGORIZE activity, not to recommend tax positions.
• If the user asks "should I claim this?" or "will the IRS allow this?", you respond:
  > "I'm an organizer, not your CPA. Here's what the IRS rule says about activities like this — your tax professional makes the final call."
• You are smart, contemporaneous, and audit-aware. You write the LOG ENTRY exactly the way Tax Court precedent (Moss, Almquist, Truskowsky) requires.
• Always speak in plain language first, then add the IRS citation in parentheses.

═══════════════════════════════════════════════════════════════════════════════
INTELLIGENCE STANDARDS
═══════════════════════════════════════════════════════════════════════════════
You are not a transcription bot. Before logging, you should:
1. CROSS-REFERENCE the user's properties and prior entries. If they say "the rental on Oak", match it to the actual property name.
2. INFER the missing details when reasonable — e.g. "spent 45 min with the plumber" → category=vendor, qualifies=true, ask only what's truly missing.
3. CHALLENGE vague entries before logging. If the user says "did property stuff for 3 hours", ASK: "Which property? What specifically — repair coordination, tenant calls, listings, what?" Then log.
4. WARN if an entry pattern looks risky (round numbers, vague descriptions, single 6+ hour blocks) per Moss v. Commissioner.
5. CONNECT activities to the §469(c)(7)(C) category that fits BEST — operation, management, leasing, acquisition, etc.

═══════════════════════════════════════════════════════════════════════════════
COMPREHENSIVE IRS CODE §469 KNOWLEDGE
═══════════════════════════════════════════════════════════════════════════════

📜 IRC §469 - PASSIVE ACTIVITY LOSSES AND CREDITS
────────────────────────────────────────────────────────────────────────────────
The passive activity loss (PAL) rules under IRC §469 generally DISALLOW the deduction of passive activity losses against non-passive income (wages, portfolio income, active business income). Rental real estate is PRESUMED PASSIVE under §469(c)(2).

HOWEVER, §469(c)(7) provides a crucial exception: Real Estate Professionals can treat rental real estate income as NON-PASSIVE, allowing them to deduct rental losses against other income (like W-2 wages).

📜 IRC §469(c)(7) - REAL ESTATE PROFESSIONAL EXCEPTION (THE CORE RULE)
────────────────────────────────────────────────────────────────────────────────
To qualify as a Real Estate Professional, a taxpayer must meet BOTH requirements:

TEST #1 - THE 750-HOUR TEST (§469(c)(7)(B)(ii))
• More than 750 hours of services performed in real property trades or businesses
• This is an ANNUAL requirement - must be met each tax year
• Hours from ALL real property trades/businesses can be aggregated
• Part-time real estate work CAN qualify if hours threshold is met

TEST #2 - THE 50% TEST (§469(c)(7)(B)(i))
• More than 50% of personal services performed during the tax year must be in real property trades or businesses
• "Personal services" = all work performed for compensation or in a trade/business
• W-2 employment hours COUNT AGAINST this percentage
• Example: If you work 2,000 W-2 hours + 1,500 RE hours = 43% RE (FAILS)
• Example: If you work 1,000 W-2 hours + 1,500 RE hours = 60% RE (PASSES)

📜 §469(c)(7)(C) - WHAT IS A "REAL PROPERTY TRADE OR BUSINESS"?
────────────────────────────────────────────────────────────────────────────────
A "real property trade or business" means any real property:
1. DEVELOPMENT
2. REDEVELOPMENT  
3. CONSTRUCTION
4. RECONSTRUCTION
5. ACQUISITION
6. CONVERSION
7. RENTAL
8. OPERATION
9. MANAGEMENT
10. LEASING
11. BROKERAGE TRADE OR BUSINESS

IMPORTANT: The taxpayer must have a PERSONAL SERVICE role, not just investment.

📜 §469(c)(7)(A) - MATERIAL PARTICIPATION STILL REQUIRED
────────────────────────────────────────────────────────────────────────────────
Even after qualifying as a REP, each rental activity must be "materially participated in" OR the taxpayer must make a GROUPING ELECTION under §469(c)(7)(A) to treat all rental properties as ONE activity.

MATERIAL PARTICIPATION TESTS (Treasury Reg. §1.469-5T):
1. 500+ hours in the activity during the year
2. Substantially all participation in the activity
3. 100+ hours AND no one else participates more
4. "Significant participation activity" with 500+ aggregate hours across all SPAs
5. Material participation in 5 of prior 10 years
6. Personal service activity with 3 prior years
7. Facts and circumstances: regular, continuous, substantial participation

📜 TREASURY REGULATION §1.469-9 - RULES FOR REAL ESTATE PROFESSIONALS
────────────────────────────────────────────────────────────────────────────────
Key provisions:
• Election to aggregate rental activities must be made on timely-filed return
• Once made, the election is binding for all future years unless material change
• A "real property trade or business" includes services rendered IN CAPACITY AS an employee
• Time logs should be CONTEMPORANEOUS (made at or near time of activity)

📜 WHAT COUNTS AS "PERSONAL SERVICES" IN RE? (Treas. Reg. §1.469-9(b)(4))
────────────────────────────────────────────────────────────────────────────────
✅ QUALIFYING ACTIVITIES (count toward 750 hours):
• Property management and oversight
• Tenant screening, showings, lease negotiation, move-in/out coordination
• Rent collection and enforcement
• Maintenance coordination and supervision (not passive ownership)
• Contractor/vendor management and supervision
• Property inspections and walk-throughs
• Financial management: bookkeeping, budgeting, P&L analysis for properties
• Legal work: lease drafting, eviction proceedings, compliance
• Acquisition activities: property tours, due diligence, negotiations, closings
• Construction/renovation: permits, contractor coordination, site visits
• Insurance claims management
• Tax and accounting specifically for rental properties
• Travel TO properties for any qualifying activity
• RE education/courses that maintain RE knowledge
• Marketing: listing properties, photography, advertising

❌ NON-QUALIFYING ACTIVITIES:
• Passive investment review (just reading statements)
• General financial planning (not property-specific)
• Attending seminars as an "investor" vs operator
• Time spent as a passive LP in a syndication
• Activities where taxpayer has no management/operations role

📜 IRS AUDIT FOCUS AREAS - WHAT TRIGGERS SCRUTINY
────────────────────────────────────────────────────────────────────────────────
The IRS closely scrutinizes REP claims. Common audit triggers:
1. High W-2 income with large rental losses claimed
2. Lack of contemporaneous time logs
3. Vague activity descriptions ("managed properties" - too general)
4. Round-number hour entries (exactly 4.00 hours suggests estimation)
5. Hours that seem unrealistic for property count
6. No third-party verification (receipts, contractor invoices, emails)
7. Activities logged that are clearly passive (e.g., "reviewed investment")

📜 TAX COURT CASES - KEY PRECEDENTS
────────────────────────────────────────────────────────────────────────────────
• Moss v. Commissioner - Contemporaneous logs critical; reconstructed logs given less weight
• Almquist v. Commissioner - Specific, detailed descriptions required
• Truskowsky v. Commissioner - Professional standards apply even to self-managed properties
• Bailey v. Commissioner - Burden of proof is on taxpayer
• Goshorn v. Commissioner - Reasonable estimates acceptable if methodology is sound

📜 DOCUMENTATION BEST PRACTICES (IRS AUDIT-PROOF)
────────────────────────────────────────────────────────────────────────────────
Every logged activity should include:
1. DATE of activity
2. START/END TIME or DURATION (in hours/minutes)
3. SPECIFIC DESCRIPTION (what was done, not just "property management")
4. PROPERTY ADDRESS affected
5. OUTCOME or RESULT when applicable
6. SUPPORTING EVIDENCE: emails, texts, photos, receipts, invoices

Example of GOOD documentation:
"March 15, 2024, 10:00 AM - 11:30 AM (1.5 hrs): Met with ABC Plumbing at 123 Main St Unit 2B to review water heater replacement options. Selected 50-gallon Rheem model, scheduled installation for March 18. Obtained quote: $1,850 installed."

Example of BAD documentation:
"March 15: Dealt with plumbing issue (1.5 hrs)" - Too vague, no property, no specifics

📜 JOINT RETURNS AND SPOUSES (§469(c)(7)(B))
────────────────────────────────────────────────────────────────────────────────
On a JOINT RETURN, only ONE spouse needs to qualify as a REP. However:
• Cannot combine hours between spouses for the 750-hour test
• One spouse must independently meet BOTH tests
• If both spouses participate, track hours separately
• The qualifying spouse's hours determine REP status for the joint return

═══════════════════════════════════════════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════════════════════════════════════════
Name: ${profile?.firstName || 'User'} ${profile?.lastName || ''}
Company: ${profile?.companyName || 'Not specified'}

═══════════════════════════════════════════════════════════════════════════════
CURRENT REP STATUS
═══════════════════════════════════════════════════════════════════════════════
• REP Hours Logged: ${reHrs} hours (NEED 750+ for REP status)
• RE % of Total Work: ${rePct.toFixed(1)}% (NEED >50% for REP status)
• Total Entries: ${entries.length}
• Progress: ${Math.min(100, (reHrs/750*100)).toFixed(0)}% toward 750-hour threshold

${reHrs >= 750 && rePct > 50 ? "✅ ON TRACK: User appears to meet REP requirements!" : 
  reHrs < 750 ? `⚠️ NEEDS ${750 - reHrs} MOREP HOURS to reach 750-hour threshold` :
  "⚠️ REP percentage below 50% - may not qualify"}

═══════════════════════════════════════════════════════════════════════════════
USER'S PROPERTIES
═══════════════════════════════════════════════════════════════════════════════
${properties.map(p => `• ${p.name} (${p.address})`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
YOUR CORE FUNCTION: ACTIVITY LOGGING
═══════════════════════════════════════════════════════════════════════════════
When a user describes ANY real estate activity, you MUST:

1. EXTRACT the activity details:
   - What they did (specific task)
   - Duration (in minutes)
   - Which property (if mentioned)
   - Category (see below)

2. GENERATE an IRS-ready description that:
   - Uses professional, specific language
   - Includes the property address when known
   - Describes the actual work performed
   - Is suitable for audit documentation

3. RESPOND with a structured activity card using this EXACT format:

───────────────────────────────────────
📋 ACTIVITY LOGGED
───────────────────────────────────────
Activity: [Brief description]
Duration: [X hours Y minutes]
Category: [Category name]
Property: [Property name or "General"]
Qualifies: [✅ Yes - REP Work] or [❌ No - Non-REP]

📝 IRS Documentation:
"[Professional, audit-ready description of the activity that would satisfy IRS requirements. 2-3 sentences.]"

💡 Progress Update:
• New RE Total: [X] hours ([Y]% toward 750h)
• REP Percentage: [Z]% of total work
───────────────────────────────────────

[[SAVE_ACTIVITY:{"activity":"brief description","minutes":X,"category":"category_key","qualifies":true/false,"property":"property name or null","irsDescription":"full IRS description"}]]

⚠️ CRITICAL - AVOID DUPLICATE LOGGING:
═══════════════════════════════════════════════════════════════════════════════
• ONLY include [[SAVE_ACTIVITY:...]] tag ONCE when the user FIRST reports an activity
• If user asks follow-up questions about the SAME activity (clarification, more details, etc.), DO NOT include the [[SAVE_ACTIVITY:...]] tag again
• If user wants to EDIT or CORRECT an already-logged activity, tell them to go to the Records tab
• If user reports a NEW, DIFFERENT activity, then include [[SAVE_ACTIVITY:...]] for the new one
• When in doubt, ASK: "Would you like me to log this as a new activity, or are we still discussing the previous one?"

Examples:
- User: "I spent 4 hours on property management" → LOG IT (first mention)
- User: "What category is that?" → DO NOT LOG AGAIN (follow-up question)
- User: "Actually it was more like 4.5 hours" → DO NOT LOG (tell them to edit in Records)
- User: "I also spent 2 hours on tenant screening" → LOG IT (new activity)

═══════════════════════════════════════════════════════════════════════════════
IRS-QUALIFYING RE CATEGORIES (Per IRC §469(c)(7)(C) & Treas. Reg. §1.469-9)
═══════════════════════════════════════════════════════════════════════════════
✅ QUALIFIES as REP Work (count toward 750 hours):

PROPERTY MANAGEMENT (§469(c)(7)(C) - "operation" and "management"):
• Tenant relations, communications, conflict resolution
• Lease enforcement and compliance monitoring
• Move-in/move-out coordination and inspections
• Rent collection, payment tracking, late notices
• Overseeing day-to-day property operations

MAINTENANCE & REPAIRS (§469(c)(7)(C) - "operation"):
• Coordinating repairs with vendors/contractors
• Supervising contractors on-site
• Performing hands-on maintenance work
• Emergency response and coordination
• Preventive maintenance planning and execution

LEASING (§469(c)(7)(C) - "leasing"):
• Property showings to prospective tenants
• Tenant screening (applications, background checks, references)
• Lease preparation, negotiation, and execution
• Marketing and advertising rental units
• Photography, listing creation, social media promotion

FINANCIAL MANAGEMENT (Treas. Reg. §1.469-9 - real property operations):
• Rent collection and deposit processing
• Property-specific bookkeeping and accounting
• P&L review, budget planning, expense tracking
• Vendor payment processing
• Insurance management and claims for properties

LEGAL & ADMINISTRATIVE (§469(c)(7)(C) - "operation"):
• Lease drafting, review, and renewal
• Fair housing compliance activities
• Eviction proceedings and court appearances
• Entity formation/management (LLCs for properties)
• Regulatory compliance (local ordinances, safety codes)

ACQUISITION (§469(c)(7)(C) - "acquisition"):
• Property tours, showings, and inspections
• Due diligence (financials, title, environmental, inspections)
• Negotiating purchase agreements
• Closing coordination and document review
• Market research for target properties

CONSTRUCTION/DEVELOPMENT (§469(c)(7)(C) - "development, construction"):
• Renovation planning and project management
• Permit applications and governmental approvals
• Contractor coordination and supervision
• Site visits during construction/renovation
• Final inspections, punch lists, and sign-offs

VENDOR COORDINATION:
• Meeting with contractors/vendors for bids and quotes
• Supervising repair and maintenance work on-site
• Coordinating multiple vendors on projects
• Quality control inspections after work completion

RE TRAVEL (Treas. Reg. §1.469-5T(f)(4) - travel time counts):
• Driving to/from properties for qualifying activities
• Travel to meet tenants, vendors, or inspect properties
• Must be connected to an otherwise qualifying RE activity

RE EDUCATION (maintaining RE knowledge):
• Landlord-tenant law courses and updates
• Property management certifications
• Real estate continuing education credits
• Industry conferences (content-focused, not networking-only)

❌ DOES NOT QUALIFY (Non-REP Work - counts AGAINST 50% test):
• w2_employment - W-2 Employment (regular job hours)
• self_employment - Self-Employment Non-RE (freelance, consulting)
• consulting - Consulting Work (unless RE-specific)
• other_business - Other Business Income (non-RE business)
• Personal activities, hobbies, and leisure
• Passive investor activities (reviewing K-1s, distributions)
• Managing REIT or syndication investments as passive LP

CRITICAL: When logging NON-REP work (like W-2 job hours), use category "w2_employment", "self_employment", "consulting", or "other_business" and set qualifies to false. These hours COUNT IN THE DENOMINATOR for the 50% test.

Example for non-REP work:
[[SAVE_ACTIVITY:{"activity":"W-2 work shift","minutes":480,"category":"w2_employment","qualifies":false,"property":null,"irsDescription":null}]]

═══════════════════════════════════════════════════════════════════════════════
RED FLAGS - IRS AUDIT TRIGGERS (ALWAYS WARN)
═══════════════════════════════════════════════════════════════════════════════
⚠️ WARN if (these trigger IRS scrutiny per Moss v. Commissioner, Truskowsky):
• Single activity exceeds 4 hours without breakdown
• Vague descriptions ("managed properties" - too general)
• No property address for property-specific work
• Activities that sound passive ("just reviewing" without action)
• Round numbers (exactly 2.00, 4.00 hours suggests estimation)
• Activities that may not qualify being logged as REP work
• Unrealistic hours relative to property count
• No supporting documentation mentioned

EXAMPLE WARNING:
"⚠️ Per Moss v. Commissioner, 6 hours for 'reviewing documents' may be challenged:
• What SPECIFIC documents? (leases, applications, financials?)
• Which PROPERTY ADDRESS was this for?
• What DECISIONS or ACTIONS resulted?
• Do you have emails/notes documenting this?
Can you break this into specific, property-linked tasks?"

═══════════════════════════════════════════════════════════════════════════════
OTHER CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════
• Draft professional emails to tenants, vendors, contractors
• Answer questions about REP requirements and §469 rules

• Explain IRS rules and documentation best practices
• Review logged activities for audit readiness
• Generate summary reports
• ADD NEW PROPERTIES to the portfolio
• ADD TENANTS to properties
• ADD VENDORS/CONTRACTORS
• Draft formal communications to tenants and vendors

═══════════════════════════════════════════════════════════════════════════════
ADDING PROPERTIES - STEP BY STEP
═══════════════════════════════════════════════════════════════════════════════
When a user wants to add a property, DO NOT add it immediately. Instead, ask for ALL details step by step:

STEP 1 - If they just mention an address or "add a property", ask:
"I'd love to help you add this property! Let me get the details:

📍 **Property Address:** [confirm or ask]
🏠 **Property Type:** Single-family, Multi-family (duplex/triplex/etc), or Commercial?
🛏️ **Number of Units:** How many rental units?
📅 **Is this a Short-Term Rental (STR)?** Like Airbnb/VRBO, or Long-Term (LTR)?

Please provide these details and I'll continue with the financial info."

STEP 2 - After getting basic info, ask for financial details:
"Great! Now let's add the financial details:

💰 **Monthly Rent:** Total rent collected per month?
🏦 **Purchase Info:**
   • Purchase price?
   • Down payment?
   • Monthly mortgage payment?

📊 **Operating Expenses (monthly):**
   • Property taxes?
   • Insurance?
   • HOA fees? (if applicable)
   • Utilities? (if owner-paid)
   • Maintenance budget?
   • Property management fee?

🏖️ **Vacancy Rate:** What vacancy rate to assume? (default 5%)"

STEP 3 - For MULTI-FAMILY (2+ units), also ask:
"Since this is a multi-family property with [X] units, please provide details for each unit:

**Unit 1:**
• Unit name/number (e.g., 'Unit A' or '101')
• Bedrooms / Bathrooms
• Monthly rent

**Unit 2:**
[repeat for each unit]"

STEP 4 - Once you have ALL information, THEN add the property:
🏠 **Property Added Successfully!**

📍 Address: [full address]
🏠 Type: [type] | Units: [X] | [STR/LTR]
💰 Rent: $[total]/mo
🏦 Mortgage: $[X]/mo
📊 Expenses: $[total]/mo
💵 Cash Flow: $[calculated]/mo
📈 Cap Rate: [X]%

[[ADD_PROPERTY:{"address":"full address","type":"single_family|multi_family|commercial","units":1,"rent":0,"isSTR":false,"purchasePrice":0,"downPayment":0,"mortgagePayment":0,"taxes":0,"insurance":0,"hoa":0,"utilities":0,"maintenance":0,"propertyMgmt":0,"vacancyRate":5,"unitDetails":[]}]]

IMPORTANT: Only use [[ADD_PROPERTY:...]] AFTER collecting all relevant information!

═══════════════════════════════════════════════════════════════════════════════
ADDING TENANTS - STEP BY STEP
═══════════════════════════════════════════════════════════════════════════════
When a user wants to add a tenant, ask for complete information:

"I'll help you add this tenant. Please provide:

👤 **Tenant Name:** First and last name?
🏠 **Property:** Which property? Which unit?
📧 **Contact Info:**
   • Email address?
   • Phone number?
📅 **Lease Details:**
   • Lease start date?
   • Lease end date?
   • Monthly rent amount?
🎂 **Date of Birth?** (optional, for records)
🛡️ **Renter's Insurance?** Yes/No"

Once you have the info:
👤 **Tenant Added!**
• Name: [First Last]
• Property: [Property Name] - Unit [X]
• Lease: [start] to [end]
• Rent: $[X]/mo
• Contact: [email] | [phone]

[[ADD_TENANT:{"firstName":"first","lastName":"last","email":"email@example.com","phone":"555-1234","propertyName":"property name","unit":"A","leaseStart":"2024-01-01","leaseEnd":"2024-12-31","rent":1500,"hasInsurance":false}]]

═══════════════════════════════════════════════════════════════════════════════
ADDING VENDORS - STEP BY STEP
═══════════════════════════════════════════════════════════════════════════════
When a user wants to add a vendor or contractor, ask:

"I'll add this vendor to your contacts. Please provide:

🏢 **Company Name:**
👤 **Contact Person:** (name of your main contact)
🔧 **Service Category:** 
   Plumber / Electrician / HVAC / General Contractor / Landscaper / Handyman / Roofer / Cleaning / Property Manager / Other
📧 **Email:**
📱 **Phone:**
🏙️ **City/Area they serve:**
📝 **Notes:** (specialties, rates, etc.)"

Once you have the info:
🔧 **Vendor Added!**
• Company: [Company Name]
• Contact: [Contact Name]
• Category: [Category]
• Phone: [phone] | Email: [email]
• Area: [city]

[[ADD_VENDOR:{"companyName":"company","contactName":"name","category":"plumber","email":"email","phone":"phone","city":"Miami","notes":"optional notes"}]]

═══════════════════════════════════════════════════════════════════════════════
DRAFTING COMMUNICATIONS
═══════════════════════════════════════════════════════════════════════════════
When asked to draft emails or messages to tenants or vendors:
• Use professional, formal language
• Be clear and specific
• Include relevant details (dates, amounts, addresses)
• Offer to customize before sending

Example: "Draft a rent reminder email to [tenant]"
Example: "Write a service request to [vendor] about the water heater"

═══════════════════════════════════════════════════════════════════════════════
QUICK REFERENCE: §469(c)(7) REP QUALIFICATION SUMMARY
═══════════════════════════════════════════════════════════════════════════════
To qualify as a Real Estate Professional under IRC §469(c)(7):

TEST 1 - 750+ HOURS (§469(c)(7)(B)(ii)):
• More than 750 hours annually in real property trades or businesses
• Hours from ALL RE activities aggregate (management, acquisition, etc.)
• Must be met EACH tax year independently

TEST 2 - 50%+ OF WORK (§469(c)(7)(B)(i)):
• More than 50% of personal services in RE trades or businesses
• FORMULA: RE Hours ÷ (RE Hours + All Other Work Hours) > 50%
• W-2 job hours COUNT AGAINST this percentage
• Example: 800 RE hours + 1,400 W-2 hours = 800/2200 = 36% (FAILS)
• Example: 1,200 RE hours + 800 W-2 hours = 1200/2000 = 60% (PASSES)

TEST 3 - MATERIAL PARTICIPATION (§469(c)(7)(A)):
• Must materially participate in EACH rental activity, OR
• Make §469(c)(7)(A) election to treat ALL rentals as ONE activity
• Material participation: 500+ hours, or substantial involvement

Qualifying RE Activities per §469(c)(7)(C):
✅ Development, redevelopment, construction, reconstruction
✅ Acquisition and conversion
✅ Rental, operation, and management
✅ Leasing and brokerage trade or business

DOCUMENTATION REQUIREMENTS (per Moss, Truskowsky, Bailey):
• CONTEMPORANEOUS time logs (created at or near time of activity)
• SPECIFIC activity descriptions (what, where, why, outcome)
• PROPERTY-SPECIFIC records (address for each activity)
• SUPPORTING EVIDENCE (emails, receipts, photos, contractor invoices)
• REASONABLE precision (avoid round numbers that suggest estimation)

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT DISCLAIMERS
═══════════════════════════════════════════════════════════════════════════════
• You are NOT a tax advisor or CPA - always recommend consulting a qualified tax professional
• You help with DOCUMENTATION and EDUCATION only
• Tax code interpretation may vary - err on the side of caution
• When in doubt about whether something qualifies, be CONSERVATIVE
• State and local rules may differ from federal requirements
• Always prioritize AUDIT-DEFENSIBLE documentation over convenience`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp() {
  const { user, profile, signOut } = useAuth();
  const [view, setView] = useState("assistant");
  const [localEntries, setLocalEntries] = useState([]);
  const [localProperties, setLocalProperties] = useState([]);
  const [localTenants, setLocalTenants] = useState([]);
  const [localVendors, setLocalVendors] = useState([]);
  const [localExpenses, setLocalExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem('reptrack-expenses');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showQuickBill, setShowQuickBill] = useState(false);
  const [emailRobot, setEmailRobot] = useState({ open: false, trigger: {} });
  const [robotEnabled, setRobotEnabled] = useState(() => localStorage.getItem('reptrack-robot-enabled') !== 'false');
  const toggleRobot = () => setRobotEnabled(v => { const n = !v; localStorage.setItem('reptrack-robot-enabled', String(n)); return n; });

  // Email Robot contacts — stored per-user in localStorage
  const [emailContacts, setEmailContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reptrack-email-contacts') || '{}'); } catch { return {}; }
  });
  const saveEmailContacts = (updated) => {
    setEmailContacts(updated);
    localStorage.setItem('reptrack-email-contacts', JSON.stringify(updated));
  };
  // emailContacts shape:
  // { pmEmail, autoSend,
  //   technicians: { plumbing, hvac, electrical, roofing, painting, general, … } }
  const [dataLoading, setDataLoading] = useState(true);
  
  // Chat state - load from localStorage
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('reptrack-chat-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Save chat messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Only keep last 50 messages to avoid localStorage limits
      const toSave = messages.slice(-50);
      localStorage.setItem('reptrack-chat-history', JSON.stringify(toSave));
    }
  }, [messages]);

  // Persist expenses ledger to localStorage
  useEffect(() => {
    localStorage.setItem('reptrack-expenses', JSON.stringify(localExpenses.slice(0, 500)));
  }, [localExpenses]);

  // Quick-add non-REP modal state
  const [showNonREModal, setShowNonREModal] = useState(false);
  const [nonRECategory, setNonRECategory] = useState("w2_employment");
  const [nonREHours, setNonREHours] = useState("");
  const [nonREDescription, setNonREDescription] = useState("");

  // Detail modals
  const [showREPDetailModal, setShowREPDetailModal] = useState(false);
  const [showNonREPDetailModal, setShowNonREPDetailModal] = useState(false);

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showREPCalculator, setShowREPCalculator] = useState(false);
  const [repCalcData, setRepCalcData] = useState({
    annualIncome: '',
    filingStatus: 'married',
    numProperties: '',
    rentalLosses: '',
    jobHoursPerWeek: '40',
    spouseWorks: 'no',
    spouseJobHours: '0'
  });
  const [emailProvider, setEmailProvider] = useState(() => localStorage.getItem('reptrack-email-provider') || 'gmail');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('reptrack-font-size') || 'medium');
  
  // Font size multipliers
  const fontSizes = {
    small: { base: 14, label: 12, title: 20, big: 28 },
    medium: { base: 16, label: 14, title: 24, big: 32 },
    large: { base: 18, label: 16, title: 28, big: 38 },
    xlarge: { base: 22, label: 20, title: 34, big: 46 }
  };
  const fs = fontSizes[fontSize] || fontSizes.medium;
  
  // Save font size preference
  const saveFontSize = (size) => {
    setFontSize(size);
    localStorage.setItem('reptrack-font-size', size);
  };
  
  // Year selection for viewing historical data
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Property modals
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showPropertyDetailModal, setShowPropertyDetailModal] = useState(null);
  const [showEditPropertyModal, setShowEditPropertyModal] = useState(null);
  const [showEditEntryModal, setShowEditEntryModal] = useState(null);
  const [showDeleteEntryConfirm, setShowDeleteEntryConfirm] = useState(null);
  const [showDeletePropertyConfirm, setShowDeletePropertyConfirm] = useState(null);
  const [newProperty, setNewProperty] = useState({
    address: "", type: "single_family", units: 1, rent: "", purchaseDate: "",
    purchasePrice: "", downPayment: "", mortgagePayment: "", isSTR: false,
    taxes: "", insurance: "", hoa: "", utilities: "", maintenance: "", propertyMgmt: "", vacancyRate: "5",
    unitDetails: [] // Array of { unitName, beds, baths, rent }
  });
  
  // Edit property handler
  const startEditProperty = (property) => {
    setShowPropertyDetailModal(null);
    setShowEditPropertyModal({
      ...property,
      taxes: property.taxes || "",
      insurance: property.insurance || "",
      hoa: property.hoa || "",
      utilities: property.utilities || "",
      maintenance: property.maintenance || "",
      propertyMgmt: property.propertyMgmt || "",
      vacancyRate: property.vacancyRate || "5"
    });
  };
  
  // Save edited property
  const saveEditedProperty = async () => {
    if (!showEditPropertyModal) return;
    
    const taxes = parseInt(showEditPropertyModal.taxes) || 0;
    const insurance = parseInt(showEditPropertyModal.insurance) || 0;
    const hoa = parseInt(showEditPropertyModal.hoa) || 0;
    const utilities = parseInt(showEditPropertyModal.utilities) || 0;
    const maintenance = parseInt(showEditPropertyModal.maintenance) || 0;
    const propertyMgmt = parseInt(showEditPropertyModal.propertyMgmt) || 0;
    const totalExpenses = taxes + insurance + hoa + utilities + maintenance + propertyMgmt;
    const vacancyRate = parseInt(showEditPropertyModal.vacancyRate) || 5;
    
    const updatedProperty = {
      ...showEditPropertyModal,
      rent: parseInt(showEditPropertyModal.rent) || 0,
      units: parseInt(showEditPropertyModal.units) || 1,
      purchasePrice: parseInt(showEditPropertyModal.purchasePrice) || 0,
      downPayment: parseInt(showEditPropertyModal.downPayment) || 0,
      mortgagePayment: parseInt(showEditPropertyModal.mortgagePayment) || 0,
      taxes, insurance, hoa, utilities, maintenance, propertyMgmt, vacancyRate, totalExpenses
    };
    
    // Update local state
    setLocalProperties(prev => prev.map(p => p.id === updatedProperty.id ? updatedProperty : p));
    
    // Update in Supabase - save ALL fields
    await updatePropertyInDb(updatedProperty);
    
    setShowEditPropertyModal(null);
  };
  
  // Delete property
  const deleteProperty = async (propertyId) => {
    // Update local state
    const updatedProperties = localProperties.filter(p => p.id !== propertyId);
    setLocalProperties(updatedProperties);
    setShowPropertyDetailModal(null);
    setShowEditPropertyModal(null);
    setShowDeletePropertyConfirm(null);
    
    // Update localStorage backup
    if (user) {
      localStorage.setItem(`reptrack-properties-${user.id}`, JSON.stringify(updatedProperties));
    }
    
    // Delete from Supabase
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propertyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        console.error("Error deleting from Supabase");
      }
      console.log("✅ Property deleted:", propertyId);
    } catch (err) {
      console.error("Error deleting property:", err);
    }
  };

  // Remove duplicate entries (same activity, minutes, and date)
  const removeDuplicateEntries = async () => {
    const seen = new Map();
    const duplicates = [];
    const unique = [];
    
    localEntries.forEach(entry => {
      const key = `${entry.date}-${entry.activity}-${entry.minutes}`;
      if (seen.has(key)) {
        duplicates.push(entry);
      } else {
        seen.set(key, entry);
        unique.push(entry);
      }
    });
    
    if (duplicates.length === 0) {
      alert("No duplicate entries found!");
      return;
    }
    
    const confirmed = confirm(`Found ${duplicates.length} duplicate entries. Remove them?`);
    if (!confirmed) return;
    
    // Delete duplicates from Supabase
    for (const dup of duplicates) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${dup.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } catch (err) {
        console.error("Error deleting duplicate:", err);
      }
    }
    
    // Update local state
    setLocalEntries(unique);
    alert(`✅ Removed ${duplicates.length} duplicate entries!`);
  };
  
  // Helper to update unit details for multifamily
  const updateUnitDetail = (index, field, value) => {
    const updatedUnits = [...newProperty.unitDetails];
    updatedUnits[index] = { ...updatedUnits[index], [field]: value };
    setNewProperty({ ...newProperty, unitDetails: updatedUnits });
  };
  
  // Generate unit details when units count changes
  const handleUnitsChange = (numUnits) => {
    const num = parseInt(numUnits) || 1;
    const currentUnits = newProperty.unitDetails;
    let newUnits = [];
    for (let i = 0; i < num; i++) {
      newUnits.push(currentUnits[i] || { unitName: `Unit ${i + 1}`, beds: 1, baths: 1, rent: '' });
    }
    setNewProperty({ ...newProperty, units: num, unitDetails: newUnits });
  };

  // Tenant modals
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [showTenantDetailModal, setShowTenantDetailModal] = useState(null);
  const [newTenant, setNewTenant] = useState({
    firstName: "", lastName: "", email: "", phone: "", propertyId: "", unit: "",
    leaseStart: "", leaseEnd: "", rent: "", dob: "", hasInsurance: false
  });

  // Vendor modals
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showVendorDetailModal, setShowVendorDetailModal] = useState(null);
  const [newVendor, setNewVendor] = useState({
    companyName: "", contactName: "", category: "plumber", email: "", phone: "", 
    propertyIds: [], notes: ""
  });

  // STR state
  const [strBookings, setStrBookings] = useState([]);
  const [strCleaners, setStrCleaners] = useState([]);
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [showAddCleanerModal, setShowAddCleanerModal] = useState(false);
  const [showLogSTRTimeModal, setShowLogSTRTimeModal] = useState(false);
  const [newBooking, setNewBooking] = useState({
    propertyId: "", guestName: "", platform: "airbnb", checkIn: "", checkOut: "", 
    guests: 1, totalAmount: "", notes: ""
  });
  const [newCleaner, setNewCleaner] = useState({
    name: "", phone: "", email: "", rate: "", propertyIds: []
  });
  const [strTimeLog, setStrTimeLog] = useState({
    propertyId: "", category: "guest_communication", minutes: "", description: ""
  });

  // Get STR properties (properties flagged as STR)
  const strProperties = localProperties.filter(p => p.isSTR);
  const ltrProperties = localProperties.filter(p => !p.isSTR);

  // Save email provider preference
  const saveEmailProvider = (provider) => {
    setEmailProvider(provider);
    localStorage.setItem('reptrack-email-provider', provider);
  };

  // Generate email link based on provider
  const getEmailLink = (toEmail, subject = "", body = "") => {
    const provider = EMAIL_PROVIDERS[emailProvider] || EMAIL_PROVIDERS.default;
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    if (emailProvider === 'gmail') {
      return `${provider.url}${toEmail}&su=${encodedSubject}&body=${encodedBody}`;
    } else if (emailProvider === 'outlook') {
      return `${provider.url}${toEmail}&subject=${encodedSubject}&body=${encodedBody}`;
    } else {
      return `mailto:${toEmail}?subject=${encodedSubject}&body=${encodedBody}`;
    }
  };

  // Get available years from entries
  const getAvailableYears = () => {
    const years = new Set(localEntries.map(e => new Date(e.date).getFullYear()));
    years.add(currentYear); // Always include current year
    return Array.from(years).sort((a, b) => b - a);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF EXPORT FOR CPA - IRS-Ready Documentation
  // ═══════════════════════════════════════════════════════════════════════════
  const exportPDFForCPA = async () => {
    // Dynamically load jsPDF
    if (!window.jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Colors
    const navy = [15, 39, 66];
    const gold = [198, 162, 74];
    const green = [34, 139, 34];
    const red = [178, 34, 34];
    
    // Get data for selected year
    const yearEntries = localEntries.filter(e => new Date(e.date).getFullYear() === selectedYear);
    const repEntries = yearEntries.filter(e => e.qualifies);
    const nonRepEntries = yearEntries.filter(e => !e.qualifies);
    const totalRepMinutes = repEntries.reduce((s, e) => s + e.minutes, 0);
    const totalNonRepMinutes = nonRepEntries.reduce((s, e) => s + e.minutes, 0);
    const totalMinutes = totalRepMinutes + totalNonRepMinutes;
    const repHours = (totalRepMinutes / 60).toFixed(1);
    const nonRepHours = (totalNonRepMinutes / 60).toFixed(1);
    const repPct = totalMinutes > 0 ? ((totalRepMinutes / totalMinutes) * 100).toFixed(1) : 0;
    const meetsHours = totalRepMinutes >= 45000; // 750 hours
    const meetsPct = totalRepMinutes > totalNonRepMinutes;
    const qualifies = meetsHours && meetsPct;
    
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // ═══ HEADER ═══
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RepTrack', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Real Estate Professional Tax Documentation', margin, 35);
    
    doc.setFontSize(12);
    doc.text(`Tax Year ${selectedYear}`, pageWidth - margin, 30, { align: 'right' });
    
    y = 55;
    
    // ═══ TAXPAYER INFO ═══
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAXPAYER INFORMATION', margin, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Name: ${profile?.firstName || ''} ${profile?.lastName || ''}`, margin, y);
    y += 6;
    doc.text(`Company: ${profile?.companyName || 'N/A'}`, margin, y);
    y += 6;
    doc.text(`Email: ${profile?.email || user?.email || 'N/A'}`, margin, y);
    y += 6;
    doc.text(`Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    y += 12;
    
    // ═══ QUALIFICATION STATUS ═══
    doc.setFillColor(...(qualifies ? green : red));
    doc.rect(margin, y, contentWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(qualifies ? '✓ QUALIFIES FOR REP STATUS' : '✗ DOES NOT QUALIFY FOR REP STATUS', margin + 10, y + 10);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`IRC §469(c)(7) Real Estate Professional Status for Tax Year ${selectedYear}`, margin + 10, y + 18);
    y += 35;
    
    // ═══ SUMMARY STATISTICS ═══
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('QUALIFICATION SUMMARY', margin, y);
    y += 10;
    
    // Stats box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(margin, y, contentWidth, 40, 'FD');
    
    const col1 = margin + 10;
    const col2 = margin + 60;
    const col3 = margin + 120;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('REQUIREMENT', col1, y + 8);
    doc.text('YOUR STATUS', col2, y + 8);
    doc.text('RESULT', col3, y + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    // Row 1: 750 hours
    doc.text('750+ RE Hours', col1, y + 20);
    doc.text(`${repHours} hours logged`, col2, y + 20);
    doc.setTextColor(...(meetsHours ? green : red));
    doc.text(meetsHours ? '✓ MET' : '✗ NOT MET', col3, y + 20);
    
    // Row 2: >50%
    doc.setTextColor(60, 60, 60);
    doc.text('>50% RE Work', col1, y + 32);
    doc.text(`${repPct}% real estate`, col2, y + 32);
    doc.setTextColor(...(meetsPct ? green : red));
    doc.text(meetsPct ? '✓ MET' : '✗ NOT MET', col3, y + 32);
    
    y += 50;
    
    // ═══ HOURS BREAKDOWN ═══
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HOURS BREAKDOWN', margin, y);
    y += 10;
    
    // RE Hours
    doc.setFillColor(...green);
    doc.rect(margin, y, contentWidth / 2 - 5, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Real Estate Hours', margin + 5, y + 8);
    doc.setFontSize(14);
    doc.text(`${repHours} hrs`, margin + 5, y + 16);
    
    // Non-RE Hours
    doc.setFillColor(...red);
    doc.rect(margin + contentWidth / 2 + 5, y, contentWidth / 2 - 5, 20, 'F');
    doc.text('Non-RE Hours', margin + contentWidth / 2 + 10, y + 8);
    doc.setFontSize(14);
    doc.text(`${nonRepHours} hrs`, margin + contentWidth / 2 + 10, y + 16);
    
    y += 30;
    
    // ═══ ACTIVITY LOG ═══
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED ACTIVITY LOG', margin, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${repEntries.length} qualifying activities documented`, margin + 80, y);
    y += 8;
    
    // Table header
    doc.setFillColor(...navy);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', margin + 2, y + 5.5);
    doc.text('CATEGORY', margin + 28, y + 5.5);
    doc.text('ACTIVITY & IRS DOCUMENTATION', margin + 65, y + 5.5);
    doc.text('TIME', pageWidth - margin - 15, y + 5.5);
    y += 10;
    
    // Activity rows (only REP entries for CPA)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    // Sort by date descending
    const sortedEntries = [...repEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const entry of sortedEntries) {
      // Check for page break
      if (y > 270) {
        doc.addPage();
        y = 20;
        
        // Add header on new page
        doc.setFillColor(...navy);
        doc.rect(margin, y, contentWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('DATE', margin + 2, y + 5.5);
        doc.text('CATEGORY', margin + 28, y + 5.5);
        doc.text('ACTIVITY & IRS DOCUMENTATION', margin + 65, y + 5.5);
        doc.text('TIME', pageWidth - margin - 15, y + 5.5);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
      }
      
      // Alternate row colors
      const rowIndex = sortedEntries.indexOf(entry);
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 3, contentWidth, 10, 'F');
      }
      
      doc.setTextColor(60, 60, 60);
      doc.text(entry.date || '', margin + 2, y + 3);
      
      // Truncate category if needed
      const category = (entry.categoryLabel || '').substring(0, 18);
      doc.text(category, margin + 28, y + 3);
      
      // Activity with IRS description
      let activity = entry.activity || '';
      if (entry.irsDescription) {
        activity = `${activity.substring(0, 40)}${activity.length > 40 ? '...' : ''} [IRS: ${entry.irsDescription.substring(0, 30)}${entry.irsDescription.length > 30 ? '...' : ''}]`;
      } else {
        activity = activity.substring(0, 80);
      }
      doc.text(activity, margin + 65, y + 3);
      
      // Time
      const hours = Math.floor(entry.minutes / 60);
      const mins = entry.minutes % 60;
      const timeStr = `${hours}h ${mins}m`;
      doc.text(timeStr, pageWidth - margin - 15, y + 3);
      
      y += 8;
    }
    
    // ═══ FOOTER ON LAST PAGE ═══
    y = Math.max(y + 10, 250);
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    
    // Legal notice
    doc.setFillColor(248, 246, 240);
    doc.rect(margin, y, contentWidth, 25, 'F');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('DISCLAIMER: This report is generated by RepTrack for informational purposes. It documents real estate', margin + 5, y + 6);
    doc.text('professional activities for potential IRC §469(c)(7) qualification. Consult a qualified tax professional or CPA', margin + 5, y + 11);
    doc.text('for official tax advice. RepTrack is not a substitute for professional tax guidance.', margin + 5, y + 16);
    
    // Footer
    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Generated by RepTrack • reptrack.ai', pageWidth / 2, y + 23, { align: 'center' });
    
    // Save PDF
    const fileName = `RepTrack_REP_Report_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Export Weekly Summary PDF
  const exportWeeklyPDF = async () => {
    // Dynamically load jsPDF
    if (!window.jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Colors
    const navy = [15, 39, 66];
    const gold = [198, 162, 74];
    const green = [34, 139, 34];
    
    // Get this week's entries (last 7 days)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekEntries = localEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= weekAgo && entryDate <= today;
    });
    
    const weekRepEntries = weekEntries.filter(e => e.qualifies);
    const weekNonRepEntries = weekEntries.filter(e => !e.qualifies);
    const weekRepMinutes = weekRepEntries.reduce((s, e) => s + e.minutes, 0);
    const weekNonRepMinutes = weekNonRepEntries.reduce((s, e) => s + e.minutes, 0);
    const weekRepHours = (weekRepMinutes / 60).toFixed(1);
    
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // ═══ HEADER ═══
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RepTrack Weekly Summary', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const weekStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEnd = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(`${weekStart} - ${weekEnd}`, pageWidth - margin, 25, { align: 'right' });
    
    y = 50;
    
    // ═══ WEEKLY STATS ═══
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('THIS WEEK', margin, y);
    y += 10;
    
    // Stats box
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 25, 'FD');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...green);
    doc.text(`${weekRepHours} REP Hours`, margin + 10, y + 10);
    
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`${weekRepEntries.length} activities logged`, margin + 10, y + 18);
    
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.text(`YTD: ${(reHrs).toFixed(1)}h / 750h`, pageWidth - margin - 10, y + 14, { align: 'right' });
    
    y += 35;
    
    // ═══ ACTIVITIES ═══
    doc.setTextColor(...navy);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ACTIVITIES THIS WEEK', margin, y);
    y += 8;
    
    // Group by date
    const entriesByDate = {};
    weekEntries.forEach(e => {
      if (!entriesByDate[e.date]) entriesByDate[e.date] = [];
      entriesByDate[e.date].push(e);
    });
    
    const sortedDates = Object.keys(entriesByDate).sort((a, b) => new Date(b) - new Date(a));
    
    doc.setFontSize(9);
    sortedDates.forEach(date => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const dateStr = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...navy);
      doc.text(dateStr, margin, y);
      y += 5;
      
      entriesByDate[date].forEach(entry => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const hours = (entry.minutes / 60).toFixed(1);
        const qualifier = entry.qualifies ? '✓' : '○';
        const text = `${qualifier} ${hours}h - ${entry.activity}`;
        
        // Word wrap if too long
        const lines = doc.splitTextToSize(text, contentWidth - 10);
        lines.forEach(line => {
          doc.text(line, margin + 5, y);
          y += 4;
        });
        y += 2;
      });
      
      y += 4;
    });
    
    if (weekEntries.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.text('No activities logged this week', margin, y);
      y += 10;
    }
    
    // ═══ FOOTER ═══
    y = Math.max(y + 10, 270);
    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Generated by RepTrack • reptrack.ai', pageWidth / 2, y, { align: 'center' });
    
    // Save
    const fileName = `RepTrack_Weekly_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Filter entries by selected year
  const entriesForYear = localEntries.filter(e => new Date(e.date).getFullYear() === selectedYear);
  const repEntriesForYear = entriesForYear.filter(e => e.qualifies);
  const nonRepEntriesForYear = entriesForYear.filter(e => !e.qualifies);
  
  // Calculate yearly stats
  const yearlyRepMinutes = repEntriesForYear.reduce((s, e) => s + e.minutes, 0);
  const yearlyNonRepMinutes = nonRepEntriesForYear.reduce((s, e) => s + e.minutes, 0);
  const yearlyRepHours = Math.round(yearlyRepMinutes / 60 * 10) / 10;
  const yearlyTotalMinutes = yearlyRepMinutes + yearlyNonRepMinutes;
  const yearlyRepPct = yearlyTotalMinutes > 0 ? Math.round((yearlyRepMinutes / yearlyTotalMinutes) * 100) : 0;
  
  // Check if qualified for year
  const meetsHoursRequirement = yearlyRepHours >= 750;
  const meetsPercentRequirement = yearlyRepPct > 50;
  const qualifiedForYear = meetsHoursRequirement && meetsPercentRequirement;

  // ═══ SUPABASE DATA FUNCTIONS ═══════════════════════════════════════════════
  const getAuthHeaders = () => {
    const token = localStorage.getItem('sb-token');
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    };
  };

  // ═══ CHAT API HELPER ═══════════════════════════════════════════════════════
  // Centralized call to /api/chat. Sends Supabase JWT so the serverless
  // function can authenticate the user and enforce per-user rate limits.
  // Handles 401 (expired session) and 429 (rate limited) cleanly.
  const callChatApi = async (system, messages) => {
    const token = localStorage.getItem('sb-token');
    if (!token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ system, messages })
    });

    if (response.status === 401) {
      // Token is invalid/expired — force a clean re-auth
      await supabase.auth.signOut();
      window.location.reload();
      throw new Error("Session expired. Please sign in again.");
    }
    if (response.status === 429) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Too many requests. Please wait a moment and try again.");
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Chat service is temporarily unavailable.");
    }

    return response.json();
  };

  // Load all data from Supabase
  const loadAllData = async () => {
    if (!user) return;
    setDataLoading(true);
    
    try {
      const headers = getAuthHeaders();
      
      // Load properties - ALL FIELDS with user_id filter
      const propsRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?user_id=eq.${user.id}&select=*&order=created_at.desc`, { headers });
      const propsData = await propsRes.json();
      console.log("Loaded properties from DB:", propsData); // Debug log
      
      if (Array.isArray(propsData) && propsData.length > 0) {
        const mappedProps = propsData.map(p => ({
          id: p.id,
          name: p.name || '',
          address: p.address || '',
          type: p.type || 'single_family',
          units: p.units || 1,
          rent: p.rent || 0,
          purchaseDate: p.purchase_date,
          purchasePrice: p.purchase_price || 0,
          downPayment: p.down_payment || 0,
          mortgagePayment: p.mortgage_payment || 0,
          isSTR: p.is_str || false,
          platforms: p.platforms || [],
          taxes: p.taxes || 0,
          insurance: p.insurance || 0,
          hoa: p.hoa || 0,
          utilities: p.utilities || 0,
          maintenance: p.maintenance || 0,
          propertyMgmt: p.property_mgmt || 0,
          vacancyRate: p.vacancy_rate || 5,
          totalExpenses: p.total_expenses || 0,
          unitDetails: p.unit_details || []
        }));
        setLocalProperties(mappedProps);
        // Backup to localStorage
        localStorage.setItem(`reptrack-properties-${user.id}`, JSON.stringify(mappedProps));
      } else {
        // Try to restore from localStorage backup
        const backup = localStorage.getItem(`reptrack-properties-${user.id}`);
        if (backup) {
          try {
            const backupProps = JSON.parse(backup);
            if (Array.isArray(backupProps) && backupProps.length > 0) {
              console.log("Restored properties from localStorage backup");
              setLocalProperties(backupProps);
            }
          } catch (e) {}
        }
      }
      
      // Load entries with user_id filter
      const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?user_id=eq.${user.id}&select=*&order=date.desc,created_at.desc`, { headers });
      const entriesData = await entriesRes.json();
      if (Array.isArray(entriesData)) {
        setLocalEntries(entriesData.map(e => ({
          id: e.id, date: e.date, qualifies: e.qualifies, category: e.category,
          categoryLabel: e.category_label, activity: e.activity, minutes: e.minutes,
          property: e.property, irsDescription: e.irs_description
        })));
      }
      
      // Load tenants with user_id filter
      const tenantsRes = await fetch(`${SUPABASE_URL}/rest/v1/tenants?user_id=eq.${user.id}&select=*&order=created_at.desc`, { headers });
      const tenantsData = await tenantsRes.json();
      if (Array.isArray(tenantsData)) {
        setLocalTenants(tenantsData.map(t => ({
          id: t.id, firstName: t.first_name, lastName: t.last_name, email: t.email,
          phone: t.phone, propertyId: t.property_id, propertyName: t.property_name,
          unit: t.unit, leaseStart: t.lease_start, leaseEnd: t.lease_end, rent: t.rent,
          dob: t.dob, hasInsurance: t.has_insurance, bio: t.bio,
          latePayments: t.late_payments
        })));
      }
      
      // Load vendors with user_id filter
      const vendorsRes = await fetch(`${SUPABASE_URL}/rest/v1/vendors?user_id=eq.${user.id}&select=*&order=created_at.desc`, { headers });
      const vendorsData = await vendorsRes.json();
      if (Array.isArray(vendorsData)) {
        setLocalVendors(vendorsData.map(v => ({
          id: v.id, companyName: v.company_name, contactName: v.contact_name,
          category: v.category, email: v.email, phone: v.phone, city: v.city,
          propertyIds: v.property_ids || [], serviceHistory: v.service_history || [],
          notes: v.notes
        })));
      }
    } catch (err) {
      console.error("Error loading data:", err);
      // Try to restore from localStorage on error
      const backup = localStorage.getItem(`reptrack-properties-${user.id}`);
      if (backup) {
        try {
          setLocalProperties(JSON.parse(backup));
        } catch (e) {}
      }
    }
    
    setDataLoading(false);
  };

  // Save property to Supabase
  const savePropertyToDb = async (property) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: user.id,
          name: property.name,
          address: property.address,
          type: property.type,
          units: property.units || 1,
          rent: property.rent || 0,
          purchase_date: property.purchaseDate || null,
          purchase_price: property.purchasePrice || 0,
          down_payment: property.downPayment || 0,
          mortgage_payment: property.mortgagePayment || 0,
          is_str: property.isSTR || false,
          platforms: property.platforms || [],
          taxes: property.taxes || 0,
          insurance: property.insurance || 0,
          hoa: property.hoa || 0,
          utilities: property.utilities || 0,
          maintenance: property.maintenance || 0,
          property_mgmt: property.propertyMgmt || 0,
          vacancy_rate: property.vacancyRate || 0,
          total_expenses: property.totalExpenses || 0,
          unit_details: property.unitDetails || null
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Supabase error:", errorData);
        return null;
      }
      const data = await res.json();
      console.log("Property saved to Supabase successfully:", data[0]?.id);
      return data[0];
    } catch (err) {
      console.error("Error saving property:", err);
      return null;
    }
  };

  // Update property in Supabase
  const updatePropertyInDb = async (property) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          name: property.name,
          address: property.address,
          type: property.type,
          units: property.units || 1,
          rent: property.rent || 0,
          purchase_date: property.purchaseDate || null,
          purchase_price: property.purchasePrice || 0,
          down_payment: property.downPayment || 0,
          mortgage_payment: property.mortgagePayment || 0,
          is_str: property.isSTR || false,
          platforms: property.platforms || [],
          taxes: property.taxes || 0,
          insurance: property.insurance || 0,
          hoa: property.hoa || 0,
          utilities: property.utilities || 0,
          maintenance: property.maintenance || 0,
          property_mgmt: property.propertyMgmt || 0,
          vacancy_rate: property.vacancyRate || 0,
          total_expenses: property.totalExpenses || 0,
          unit_details: property.unitDetails || null
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Supabase update error:", errorData);
        return null;
      }
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Error updating property:", err);
      return null;
    }
  };

  // Save entry to Supabase
  const saveEntryToDb = async (entry) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/entries`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: user.id, date: entry.date, qualifies: entry.qualifies,
          category: entry.category, category_label: entry.categoryLabel,
          activity: entry.activity, minutes: entry.minutes,
          property: entry.property, irs_description: entry.irsDescription
        })
      });
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Error saving entry:", err);
      return null;
    }
  };

  // Update entry in Supabase
  const updateEntryInDb = async (entry) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          date: entry.date, qualifies: entry.qualifies,
          category: entry.category, category_label: entry.categoryLabel,
          activity: entry.activity, minutes: entry.minutes,
          property: entry.property, irs_description: entry.irsDescription
        })
      });
      const data = await res.json();
      console.log("✅ Entry updated in Supabase:", entry.id);
      return data[0];
    } catch (err) {
      console.error("Error updating entry:", err);
      return null;
    }
  };

  // Delete entry from Supabase
  const deleteEntryFromDb = async (entryId) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${entryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      console.log("✅ Entry deleted from Supabase:", entryId);
      return true;
    } catch (err) {
      console.error("Error deleting entry:", err);
      return false;
    }
  };

  // Save edited entry
  const saveEditedEntry = async () => {
    if (!showEditEntryModal) return;
    
    const updatedEntry = {
      ...showEditEntryModal,
      minutes: parseInt(showEditEntryModal.minutes) || 0,
      categoryLabel: IRS_CATEGORIES[showEditEntryModal.category]?.label || showEditEntryModal.category
    };
    
    // Update in Supabase
    await updateEntryInDb(updatedEntry);
    
    // Update local state
    setLocalEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    setShowEditEntryModal(null);
  };

  // Delete entry
  const deleteEntry = async (entryId) => {
    // Delete from Supabase
    await deleteEntryFromDb(entryId);
    
    // Remove from local state
    setLocalEntries(prev => prev.filter(e => e.id !== entryId));
    setShowDeleteEntryConfirm(null);
  };

  // Save tenant to Supabase
  const saveTenantToDb = async (tenant) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tenants`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: user.id, first_name: tenant.firstName, last_name: tenant.lastName,
          email: tenant.email, phone: tenant.phone, property_id: tenant.propertyId || null,
          property_name: tenant.propertyName, unit: tenant.unit,
          lease_start: tenant.leaseStart || null, lease_end: tenant.leaseEnd || null,
          rent: tenant.rent || 0, dob: tenant.dob || null, has_insurance: tenant.hasInsurance,
          bio: tenant.bio, late_payments: tenant.latePayments || 0
        })
      });
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Error saving tenant:", err);
      return null;
    }
  };

  // Save vendor to Supabase
  const saveVendorToDb = async (vendor) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/vendors`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: user.id, company_name: vendor.companyName, contact_name: vendor.contactName,
          category: vendor.category, email: vendor.email, phone: vendor.phone,
          city: vendor.city, property_ids: vendor.propertyIds || [],
          service_history: vendor.serviceHistory || [], notes: vendor.notes
        })
      });
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Error saving vendor:", err);
      return null;
    }
  };

  // Load data when user logs in
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // CRITICAL: Backup properties to localStorage whenever they change
  useEffect(() => {
    if (user && localProperties.length > 0) {
      try {
        localStorage.setItem(`reptrack-properties-${user.id}`, JSON.stringify(localProperties));
        console.log(`✅ Properties backed up: ${localProperties.length} properties`);
      } catch (e) {
        console.error("Failed to backup properties:", e);
      }
    }
  }, [localProperties, user]);

  // Copy to clipboard helper
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  // Add tenant function
  const addTenant = async () => {
    if (!newTenant.firstName.trim() || !newTenant.lastName.trim()) return;
    
    const property = localProperties.find(p => p.id === newTenant.propertyId);
    const tenant = {
      ...newTenant,
      propertyName: property?.name || "",
      rent: parseInt(newTenant.rent) || 0,
      latePayments: 0
    };
    
    // Save to Supabase
    const savedTenant = await saveTenantToDb(tenant);
    if (savedTenant) {
      tenant.id = savedTenant.id;
    } else {
      tenant.id = uid();
    }
    
    setLocalTenants(prev => [tenant, ...prev]);
    setShowAddTenantModal(false);
    setNewTenant({ firstName: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", leaseStart: "", leaseEnd: "", rent: "", dob: "", hasInsurance: false });
    
    setMessages(prev => [...prev, {
      role: "assistant", id: uid(),
      content: `👤 **Tenant Added!**\n\n• Name: ${tenant.firstName} ${tenant.lastName}\n• Property: ${tenant.propertyName}${tenant.unit ? ` Unit ${tenant.unit}` : ""}\n• Email: ${tenant.email}\n• Phone: ${tenant.phone}`,
      activityLogged: true
    }]);
  };

  // Add vendor function
  const addVendor = async () => {
    if (!newVendor.companyName.trim()) return;
    
    const vendor = { ...newVendor };
    
    // Save to Supabase
    const savedVendor = await saveVendorToDb(vendor);
    if (savedVendor) {
      vendor.id = savedVendor.id;
    } else {
      vendor.id = uid();
    }
    
    setLocalVendors(prev => [vendor, ...prev]);
    setShowAddVendorModal(false);
    setNewVendor({ companyName: "", contactName: "", category: "plumber", email: "", phone: "", propertyIds: [], notes: "", city: "" });
    
    const categoryLabel = VENDOR_CATEGORIES.find(c => c.id === vendor.category)?.label || vendor.category;
    setMessages(prev => [...prev, {
      role: "assistant", id: uid(),
      content: `🔧 **Vendor Added!**\n\n• Company: ${vendor.companyName}\n• Contact: ${vendor.contactName}\n• Category: ${categoryLabel}\n• Email: ${vendor.email}\n• Phone: ${vendor.phone}`,
      activityLogged: true
    }]);
  };

  // Add property function
  const addProperty = async () => {
    if (!newProperty.address.trim()) return;
    
    // Parse expense values
    const taxes = parseInt(newProperty.taxes) || 0;
    const insurance = parseInt(newProperty.insurance) || 0;
    const hoa = parseInt(newProperty.hoa) || 0;
    const utilities = parseInt(newProperty.utilities) || 0;
    const maintenance = parseInt(newProperty.maintenance) || 0;
    const propertyMgmt = parseInt(newProperty.propertyMgmt) || 0;
    const vacancyRate = parseInt(newProperty.vacancyRate) || 5;
    const totalExpenses = taxes + insurance + hoa + utilities + maintenance + propertyMgmt;
    
    const property = {
      name: newProperty.address.split(",")[0].trim(),
      address: newProperty.address.trim(),
      type: newProperty.type,
      units: parseInt(newProperty.units) || 1,
      rent: parseInt(newProperty.rent) || 0,
      purchaseDate: newProperty.purchaseDate || null,
      purchasePrice: parseInt(newProperty.purchasePrice) || 0,
      downPayment: parseInt(newProperty.downPayment) || 0,
      mortgagePayment: parseInt(newProperty.mortgagePayment) || 0,
      isSTR: newProperty.isSTR || false,
      // Operating expenses
      taxes, insurance, hoa, utilities, maintenance, propertyMgmt, vacancyRate,
      totalExpenses,
      // Unit details for multifamily
      unitDetails: newProperty.unitDetails || []
    };
    
    // Calculate metrics with actual expenses
    const effectiveRent = property.rent * (1 - vacancyRate / 100); // Account for vacancy
    const noi = effectiveRent - totalExpenses; // Net Operating Income (before mortgage)
    const cashFlow = noi - property.mortgagePayment; // After mortgage
    const capRate = property.purchasePrice ? ((noi * 12) / property.purchasePrice * 100).toFixed(1) : null;
    const cashOnCash = property.downPayment ? ((cashFlow * 12) / property.downPayment * 100).toFixed(1) : null;
    
    // Save to Supabase
    const savedProperty = await savePropertyToDb(property);
    if (savedProperty) {
      property.id = savedProperty.id;
    } else {
      property.id = uid();
    }
    
    // Update local state and backup to localStorage
    setLocalProperties(prev => {
      const updated = [...prev, property];
      // Backup to localStorage for persistence
      if (user) {
        localStorage.setItem(`reptrack-properties-${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    setShowAddPropertyModal(false);
    setNewProperty({ 
      address: "", type: "single_family", units: 1, rent: "", purchaseDate: "", 
      purchasePrice: "", downPayment: "", mortgagePayment: "", isSTR: false,
      taxes: "", insurance: "", hoa: "", utilities: "", maintenance: "", propertyMgmt: "", vacancyRate: "5",
      unitDetails: []
    });
    
    // Confirmation in chat with ROI info
    let roiInfo = "";
    if (capRate) roiInfo += `\n• Cap Rate: ${capRate}%`;
    if (cashOnCash) roiInfo += `\n• Cash-on-Cash: ${cashOnCash}%`;
    if (property.mortgagePayment) roiInfo += `\n• Monthly Cash Flow: ${cashFlow >= 0 ? '+' : ''}$${cashFlow.toLocaleString()}`;
    
    // Add unit breakdown for multifamily
    let unitInfo = "";
    if (property.units > 1 && property.unitDetails.length > 0) {
      unitInfo = `\n\n**Unit Breakdown:**\n${property.unitDetails.map(u => `• ${u.unitName}: ${u.beds} bed/${u.baths} bath - $${parseInt(u.rent || 0).toLocaleString()}/mo`).join('\n')}`;
    }
    
    setMessages(prev => [...prev, {
      role: "assistant",
      id: uid(),
      content: `🏠 **Property Added!**\n\n• Address: ${property.address}\n• Type: ${property.isSTR ? 'Short-Term Rental' : 'Long-Term Rental'}\n• Units: ${property.units}\n• Total Rent: $${property.rent.toLocaleString()}/mo${roiInfo}${unitInfo}\n\nYou can now log REP hours for this property!`,
      activityLogged: true
    }]);
  };

  // Calculate REP stats for modals
  const repEntries = localEntries.filter(e => e.qualifies);
  const nonRepEntries = localEntries.filter(e => !e.qualifies);
  
  // Group REP entries by category
  const repByCategory = repEntries.reduce((acc, e) => {
    const cat = e.categoryLabel || e.category;
    if (!acc[cat]) acc[cat] = { minutes: 0, count: 0 };
    acc[cat].minutes += e.minutes;
    acc[cat].count += 1;
    return acc;
  }, {});

  // Group REP entries by property
  const repByProperty = repEntries.reduce((acc, e) => {
    const prop = e.property || "General";
    if (!acc[prop]) acc[prop] = { minutes: 0, count: 0 };
    acc[prop].minutes += e.minutes;
    acc[prop].count += 1;
    return acc;
  }, {});

  // Group Non-REPP entries by category
  const nonRepByCategory = nonRepEntries.reduce((acc, e) => {
    const cat = e.categoryLabel || e.category;
    if (!acc[cat]) acc[cat] = { minutes: 0, count: 0 };
    acc[cat].minutes += e.minutes;
    acc[cat].count += 1;
    return acc;
  }, {});

  // Group entries by date (last 7 days)
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };
  
  const repByDay = getLast7Days().map(date => ({
    date,
    minutes: repEntries.filter(e => e.date === date).reduce((s, e) => s + e.minutes, 0)
  }));
  
  const nonRepByDay = getLast7Days().map(date => ({
    date,
    minutes: nonRepEntries.filter(e => e.date === date).reduce((s, e) => s + e.minutes, 0)
  }));

  // Quick add non-REP hours function
  const addNonREHours = async () => {
    if (!nonREHours || parseFloat(nonREHours) <= 0) return;
    
    const minutes = Math.round(parseFloat(nonREHours) * 60);
    const category = IRS_CATEGORIES[nonRECategory];
    
    const newEntry = {
      date: todayStr(),
      qualifies: false,
      category: nonRECategory,
      categoryLabel: category?.label || "Non-REPP Work",
      activity: nonREDescription || `${category?.label || "Non-REPP work"} - ${nonREHours} hours`,
      minutes: minutes,
      property: null,
      irsDescription: null
    };
    
    // Save to Supabase
    const savedEntry = await saveEntryToDb(newEntry);
    newEntry.id = savedEntry?.id || uid();
    
    setLocalEntries(prev => [newEntry, ...prev]);
    setShowNonREModal(false);
    setNonREHours("");
    setNonREDescription("");
    setNonRECategory("w2_employment");
    
    // Add confirmation message to chat
    setMessages(prev => [...prev, {
      role: "assistant",
      id: uid(),
      content: `✅ **Non-REPP Hours Logged**\n\n• Type: ${category?.label}\n• Duration: ${nonREHours} hours\n• Activity: ${nonREDescription || "Work shift"}\n\nThis helps track your REP percentage accurately. Your REP work must exceed 50% of total work time for REP status.`,
      activityLogged: true
    }]);
  };

  // Initialize welcome message with profile (only if no saved messages)
  useEffect(() => {
    if (profile && messages.length === 0 && !dataLoading) {
      // Check if there are saved messages first
      const savedMessages = localStorage.getItem('reptrack-chat-history');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          if (parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        } catch {}
      }
      
      const reEntries = localEntries.filter(e => e.qualifies);
      const totalREMins = reEntries.reduce((s, e) => s + e.minutes, 0);
      const reHrs = Math.round(totalREMins / 60 * 10) / 10;
      
      setMessages([{
        role: "assistant",
        id: "welcome",
        content: `Hi ${profile?.firstName || 'there'}! I'm your RepTrack AI assistant. 🏠

**Your Current Status:**
• REP Hours: ${reHrs}h of 750h needed
• Progress: ${Math.min(100, (reHrs/750*100)).toFixed(0)}% toward REP qualification

**I can help you:**
• Log real estate activities with IRS-ready documentation
• Track your progress toward 750-hour threshold
• Draft professional emails to tenants and vendors
• Answer questions about REP requirements

**Just tell me what you worked on today!**

For example: "I spent 2 hours showing my Oak Street duplex to potential tenants"`
      }]);
    }
  }, [profile, dataLoading]);

  const reEntries = localEntries.filter(e => e.qualifies);
  const totalREMins = reEntries.reduce((s, e) => s + e.minutes, 0);
  const reHrs = Math.round(totalREMins / 60 * 10) / 10;
  const nonREMins = localEntries.filter(e => !e.qualifies).reduce((s, e) => s + e.minutes, 0);
  const nonREHrs = Math.round(nonREMins / 60 * 10) / 10;
  const totalMins = totalREMins + nonREMins;
  const rePct = totalMins > 0 ? (totalREMins / totalMins) * 100 : 0;

  const displayName = profile?.firstName && profile?.lastName 
    ? `${profile.firstName} ${profile.lastName}` 
    : user?.email;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Parse AI response for activity data
  const parseActivityFromResponse = (text) => {
    const match = text.match(/\[\[SAVE_ACTIVITY:(.*?)\]\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse activity:", e);
      }
    }
    return null;
  };

  // Parse AI response for property data
  const parsePropertyFromResponse = (text) => {
    const match = text.match(/\[\[ADD_PROPERTY:(.*?)\]\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse property:", e);
      }
    }
    return null;
  };

  // Parse AI response for tenant data
  const parseTenantFromResponse = (text) => {
    const match = text.match(/\[\[ADD_TENANT:(.*?)\]\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse tenant:", e);
      }
    }
    return null;
  };

  // Parse AI response for vendor data
  const parseVendorFromResponse = (text) => {
    const match = text.match(/\[\[ADD_VENDOR:(.*?)\]\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse vendor:", e);
      }
    }
    return null;
  };

  // Remove all tags from displayed message
  const cleanResponseText = (text) => {
    return text
      .replace(/\[\[SAVE_ACTIVITY:.*?\]\]/g, '')
      .replace(/\[\[SAVE_EXPENSE:.*?\]\]/g, '')
      .replace(/\[\[ADD_PROPERTY:.*?\]\]/g, '')
      .replace(/\[\[ADD_TENANT:.*?\]\]/g, '')
      .replace(/\[\[ADD_VENDOR:.*?\]\]/g, '')
      .trim();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", id: uid(), content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

      try {
      const system = getSystemPrompt(reHrs, rePct, localEntries, profile, localProperties) + getAccountingPromptExtension();
      const apiMessages = messages
        .filter(m => m.id !== "welcome")
        .concat(userMessage)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const data = await callChatApi(system, apiMessages);
      const responseText = data.content[0].text;

      // Check for accounting expense to save (alongside any activity)
      const expenseData = parseExpenseFromResponse(responseText);
      if (expenseData) {
        setLocalExpenses(prev => [{ ...expenseData, id: uid(), savedAt: new Date().toISOString() }, ...prev]);
      }

      // Check for activity to save - WITH DUPLICATE DETECTION
      const activityData = parseActivityFromResponse(responseText);
      if (activityData) {
        // Check for duplicate: same activity description AND minutes logged in last 5 minutes
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        const isDuplicate = localEntries.some(entry => {
          // Check if same activity and minutes
          if (entry.activity?.toLowerCase() === activityData.activity?.toLowerCase() && 
              entry.minutes === activityData.minutes) {
            // Check if logged recently (within same session)
            const entryDate = new Date(entry.date);
            // If it's today and similar content, likely duplicate
            if (entry.date === todayStr()) {
              console.log("⚠️ Duplicate activity detected, skipping save:", activityData.activity);
              return true;
            }
          }
          return false;
        });
        
        if (!isDuplicate) {
          const newEntry = {
            date: todayStr(),
            qualifies: activityData.qualifies,
            category: activityData.category,
            categoryLabel: IRS_CATEGORIES[activityData.category]?.label || activityData.category,
            activity: activityData.activity,
            minutes: activityData.minutes,
            property: activityData.property,
            irsDescription: activityData.irsDescription
          };
          // Save to Supabase
          const savedEntry = await saveEntryToDb(newEntry);
          newEntry.id = savedEntry?.id || uid();
          setLocalEntries(prev => [newEntry, ...prev]);
          console.log("✅ Activity logged:", newEntry.activity, newEntry.minutes, "minutes");
        }
      }

      // Check for property data - SAVE ALL FIELDS AND BACKUP
      const propertyData = parsePropertyFromResponse(responseText);
      if (propertyData) {
        // Calculate total expenses
        const taxes = parseInt(propertyData.taxes) || 0;
        const insurance = parseInt(propertyData.insurance) || 0;
        const hoa = parseInt(propertyData.hoa) || 0;
        const utilities = parseInt(propertyData.utilities) || 0;
        const maintenance = parseInt(propertyData.maintenance) || 0;
        const propertyMgmt = parseInt(propertyData.propertyMgmt) || 0;
        const totalExpenses = taxes + insurance + hoa + utilities + maintenance + propertyMgmt;
        
        const newProperty = {
          name: propertyData.name || propertyData.address.split(",")[0].trim(),
          address: propertyData.address,
          type: propertyData.type || "single_family",
          units: parseInt(propertyData.units) || 1,
          rent: parseInt(propertyData.rent) || 0,
          purchaseDate: propertyData.purchaseDate || null,
          purchasePrice: parseInt(propertyData.purchasePrice) || 0,
          downPayment: parseInt(propertyData.downPayment) || 0,
          mortgagePayment: parseInt(propertyData.mortgagePayment) || 0,
          isSTR: propertyData.isSTR || false,
          platforms: propertyData.platforms || [],
          taxes,
          insurance,
          hoa,
          utilities,
          maintenance,
          propertyMgmt,
          vacancyRate: parseInt(propertyData.vacancyRate) || 5,
          totalExpenses,
          unitDetails: propertyData.unitDetails || []
        };
        
        // Save to Supabase with ALL fields
        const savedProp = await savePropertyToDb(newProperty);
        if (savedProp && savedProp.id) {
          newProperty.id = savedProp.id;
          console.log("✅ Property saved to Supabase:", savedProp.id);
        } else {
          newProperty.id = uid();
          console.warn("⚠️ Supabase save failed, using local ID:", newProperty.id);
        }
        
        // Update state AND backup to localStorage
        setLocalProperties(prev => {
          const updated = [...prev, newProperty];
          // CRITICAL: Backup to localStorage for persistence
          if (user) {
            try {
              localStorage.setItem(`reptrack-properties-${user.id}`, JSON.stringify(updated));
              console.log("✅ Property backed up to localStorage");
            } catch (e) {
              console.error("localStorage backup failed:", e);
            }
          }
          return updated;
        });
      }

      // Check for tenant data
      const tenantData = parseTenantFromResponse(responseText);
      if (tenantData) {
        const newTenant = {
          firstName: tenantData.firstName,
          lastName: tenantData.lastName,
          email: tenantData.email || "",
          phone: tenantData.phone || "",
          propertyName: tenantData.propertyName || "",
          unit: tenantData.unit || "",
          leaseStart: tenantData.leaseStart || "",
          leaseEnd: tenantData.leaseEnd || "",
          rent: tenantData.rent || 0,
          dob: tenantData.dob || "",
          hasInsurance: tenantData.hasInsurance || false,
          latePayments: 0
        };
        // Save to Supabase
        const savedTenant = await saveTenantToDb(newTenant);
        newTenant.id = savedTenant?.id || uid();
        setLocalTenants(prev => [newTenant, ...prev]);
      }

      // Check for vendor data
      const vendorData = parseVendorFromResponse(responseText);
      if (vendorData) {
        const newVendor = {
          companyName: vendorData.companyName,
          contactName: vendorData.contactName || "",
          category: vendorData.category || "other",
          email: vendorData.email || "",
          phone: vendorData.phone || "",
          city: vendorData.city || "",
          notes: vendorData.notes || ""
        };
        // Save to Supabase
        const savedVendor = await saveVendorToDb(newVendor);
        newVendor.id = savedVendor?.id || uid();
        setLocalVendors(prev => [newVendor, ...prev]);
      }

      const assistantMessage = {
        role: "assistant",
        id: uid(),
        content: cleanResponseText(responseText),
        activityLogged: !!activityData || !!propertyData || !!tenantData || !!vendorData
      };
     setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        id: uid(),
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`
      }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Calculate days/weeks remaining in year
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  const daysRemaining = Math.ceil((endOfYear - now) / (1000 * 60 * 60 * 24));
  const weeksRemaining = Math.ceil(daysRemaining / 7);
  const hoursNeeded = Math.max(0, 750 - reHrs);
  const hoursPerWeek = weeksRemaining > 0 ? (hoursNeeded / weeksRemaining).toFixed(1) : 0;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.bg, minHeight: "100vh", color: C.text, display: "flex", height: "100vh", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 230px;
          min-width: 230px;
          background: #0D1B2A;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: fixed;
          left: 0; top: 0; bottom: 0;
          z-index: 200;
          overflow: hidden;
        }
        .sidebar-logo {
          padding: 24px 20px 18px;
          border-bottom: 1px solid rgba(0,201,167,0.15);
        }
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          border-radius: 10px;
          transition: background 0.15s, color 0.15s;
        }
        .sidebar-nav-item:hover {
          background: rgba(255,255,255,0.06);
        }
        .sidebar-nav-item.active {
          background: rgba(0,201,167,0.16);
        }
        .sidebar-nav-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          color: rgba(255,255,255,0.85);
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .sidebar-nav-item.active .sidebar-nav-icon { color: #00C9A7; }
        .sidebar-nav-item:hover .sidebar-nav-icon { color: #ffffff; }
        .sidebar-nav-label {
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          color: rgba(255,255,255,0.58);
          white-space: nowrap;
          transition: color 0.15s;
        }
        .sidebar-nav-item.active .sidebar-nav-label { color: #00C9A7; font-weight: 600; }
        .sidebar-nav-item:hover .sidebar-nav-label { color: rgba(255,255,255,0.92); }
        .sidebar-footer {
          padding: 16px 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .app-content {
          margin-left: 230px;
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .top-bar {
          background: #FFFFFF;
          border-bottom: 1px solid #E2E8F0;
          padding: 0 28px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          box-shadow: 0 1px 6px rgba(13,27,42,0.05);
        }

        /* ── SCROLLING ── */
        html, body { overflow: hidden !important; height: 100% !important; }
        .main-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          flex: 1;
          max-height: calc(100vh - 58px);
          -webkit-overflow-scrolling: touch !important;
          padding-bottom: 20px !important;
        }
        .tab-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: calc(100vh - 130px) !important;
          -webkit-overflow-scrolling: touch !important;
          padding-bottom: 80px !important;
        }
        .modal-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: 70vh !important;
          -webkit-overflow-scrolling: touch !important;
          padding-right: 10px !important;
        }
        .card-scroll {
          overflow-y: auto !important;
          max-height: 400px !important;
          -webkit-overflow-scrolling: touch !important;
        }

        /* ── SCROLLBARS ── */
        ::-webkit-scrollbar { width: 7px !important; height: 7px !important; }
        ::-webkit-scrollbar-track { background: #F1F5F9 !important; }
        ::-webkit-scrollbar-thumb { background: #00C9A7 !important; border-radius: 6px !important; }
        ::-webkit-scrollbar-thumb:hover { background: #00A88C !important; }
        * { scrollbar-width: thin !important; scrollbar-color: #00C9A7 #F1F5F9 !important; }

        /* ── MOBILE: bottom nav bar, hide sidebar ── */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .app-content { margin-left: 0; }
          .bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: #0D1B2A;
            border-top: 2px solid #00C9A7;
            z-index: 200;
            overflow-x: auto;
          }
          .main-scroll { padding-bottom: 70px !important; max-height: calc(100vh - 58px) !important; }
          .tab-scroll { max-height: calc(100vh - 100px) !important; padding-bottom: 100px !important; }
          .modal-scroll { max-height: 60vh !important; }
          .main-scroll { padding: 12px !important; }
          button, select, input { min-height: 44px !important; font-size: 16px !important; }
          .card { padding: 16px !important; }
        }
        @media (min-width: 769px) {
          .bottom-nav { display: none !important; }
          .mobile-stats-bar { display: none !important; }
        }
        @media (max-width: 480px) { .tiny-hide { display: none !important; } }

        /* ── COMPONENTS ── */
        .nav-item { display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 18px; cursor:pointer; border:none; background:none; border-bottom:2px solid transparent; transition:all .15s; color:#94A3B8; }
        .nav-item:hover { color:#00C9A7; }
        .nav-item.active { color:#00C9A7; border-bottom-color:#00C9A7; }
        .card { background:#fff; border:1px solid #E8EDF4; border-radius:14px; padding:22px; box-shadow:0 2px 10px rgba(13,27,42,0.05); transition:box-shadow 0.2s; }
        .card:hover { box-shadow:0 4px 18px rgba(13,27,42,0.09); }
        .btn-gold { background:#00C9A7; border:none; color:#0D1B2A; font-weight:700; padding:11px 24px; font-family:'Inter',sans-serif; font-size:13px; cursor:pointer; border-radius:10px; transition:all 0.15s; }
        .btn-gold:hover { background:#00B396; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,201,167,0.3); }
        .btn-outline { background:#fff; border:1px solid #E2E8F0; color:#475569; padding:10px 20px; font-family:'Inter',sans-serif; font-size:13px; cursor:pointer; border-radius:10px; transition:all 0.15s; }
        .btn-outline:hover { border-color:#00C9A7; color:#00A88C; background:#F0FDFB; }
        .msg-bubble { max-width: 85%; padding: 14px 18px; border-radius: 14px; margin-bottom: 12px; }
        .msg-user { background: ${C.dark}; color: #00E5C4; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg-assistant { background: white; border: 1px solid ${C.border}; color: ${C.text}; margin-right: auto; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(13,27,42,0.06); }
        .msg-logged { border-left: 3px solid ${C.greenB}; }
        .progress-ring { transform: rotate(-90deg); }

        /* ── RESPONSIVE GRIDS ── */
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        @media (max-width: 768px) { .grid-2,.grid-3 { grid-template-columns:1fr !important; } .mobile-hide { display:none !important; } .mobile-stack { grid-template-columns:1fr !important; } }

        /* ── MOBILE NAV ── */
        @media (max-width: 768px) {
          .mobile-stats-bar { display: block !important; }
          .desktop-sidebar { display: none !important; }
          .assistant-layout { flex-direction: column !important; }
          .chat-area { min-height: 300px !important; }
          .upload-text { display: none !important; }
          .quick-actions-row { overflow-x:auto !important; flex-wrap:nowrap !important; -webkit-overflow-scrolling:touch !important; }
        }`}
        
        /* ═══════════════════════════════════════════════════════════════════════
           MOBILE RESPONSIVE STYLES
           ═══════════════════════════════════════════════════════════════════════ */
        
        /* ═══ ASSISTANT MOBILE LAYOUT ═══ */
        @media (min-width: 769px) {
          .mobile-stats-bar { display: none !important; }
        }
        @media (max-width: 768px) {
          .mobile-stats-bar { display: block !important; }
          .desktop-sidebar { display: none !important; }
          .assistant-layout { flex-direction: column !important; }
          .chat-area { min-height: 300px !important; }
          .upload-text { display: none !important; }
          .quick-actions-row { 
            overflow-x: auto !important; 
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch !important;
          }
        }
        
        /* Mobile nav - icon only */
        @media (max-width: 768px) {
          .mobile-hide { display: none !important; }
          .mobile-show { display: flex !important; }
          .mobile-full { width: 100% !important; }
          .mobile-col { flex-direction: column !important; }
          .mobile-gap { gap: 8px !important; }
          .mobile-pad { padding: 12px !important; }
          .mobile-text-sm { font-size: 12px !important; }
          .mobile-text-lg { font-size: 18px !important; }
          
          /* Stack grids on mobile */
          .mobile-stack {
            grid-template-columns: 1fr !important;
          }
          
          /* Bigger touch targets */
          button, select, input {
            min-height: 44px !important;
            font-size: 16px !important;
          }
          
          /* Full width cards */
          .card {
            padding: 16px !important;
          }
          
          /* Modal adjustments */
          .modal-scroll {
            max-height: 75vh !important;
          }
        }
        
        @media (max-width: 480px) {
          .tiny-hide { display: none !important; }
        }
        
        /* Responsive grids */
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 768px) {
          .grid-2, .grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header - MOBILE RESPONSIVE */}
      {/* ── LEFT SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", fontFamily: "'Inter', sans-serif", letterSpacing: -0.5 }}>
            Rep<span style={{ color: "#00C9A7" }}>Track</span>
          </span>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Property Manager</div>
        </div>
        <nav className="sidebar-nav">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`sidebar-nav-item${view === v.id ? " active" : ""}`}>
              <span className="sidebar-nav-icon"><Icon d={NAV_ICONS[v.id]} size={18} /></span>
              <span className="sidebar-nav-label">{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.email || user?.email}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowSettingsModal(true)} style={{ flex: 1, padding: "7px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer" }}>⚙️ Settings</button>
            <button onClick={signOut} style={{ flex: 1, padding: "7px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer" }}>↪ Log Out</button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="app-content">
        {/* Top bar */}
        <div className="top-bar">
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.dark }}>
            {VIEWS.find(v => v.id === view)?.label || "RepTrack"}
            {profile?.companyName && <span style={{ fontSize: 12, fontWeight: 400, color: C.light, marginLeft: 10 }}>{profile.companyName}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {view === "accounting" && <button onClick={() => setShowQuickBill(true)} className="btn-gold" style={{ padding: "7px 16px", fontSize: 12 }}>+ QuickBill</button>}
            {/* Robot on/off toggle */}
            <button onClick={toggleRobot} title={robotEnabled ? "Email Robot is ON — click to disable" : "Email Robot is OFF — click to enable"} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 20,
              background: robotEnabled ? C.goldPale : C.borderL,
              border: `1px solid ${robotEnabled ? C.goldL : C.border}`,
              cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600,
              color: robotEnabled ? C.gold : C.lighter, transition: "all 0.2s",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: robotEnabled ? C.goldL : C.lighter }} />
              Robot {robotEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 14px", border: "none", cursor: "pointer", background: view === v.id ? "rgba(0,201,167,0.15)" : "transparent", borderTop: view === v.id ? "2px solid #00C9A7" : "2px solid transparent", color: view === v.id ? "#00C9A7" : "rgba(255,255,255,0.85)" }}>
              <Icon d={NAV_ICONS[v.id]} size={18} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: view === v.id ? 700 : 500, whiteSpace: "nowrap" }}>{v.label}</span>
            </button>
          ))}
        </nav>

      <main className="main-scroll" style={{ padding: "16px", flex: 1 }}>
        
        {/* ASSISTANT VIEW */}

        {/* ═══════════════════════════════════════════════════════════════════
            ASSISTANT VIEW - Mobile Friendly with Original Colors
            ═══════════════════════════════════════════════════════════════════ */}
        {view === "assistant" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
            
            {/* MOBILE STATS BAR - Light theme matching original */}
            <div className="mobile-stats-bar" style={{ 
              background: "#FFFFFF",
              borderRadius: 12, padding: 14, marginBottom: 12,
              border: `2px solid ${C.goldL}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: C.dark, letterSpacing: 1 }}>
                  🏠 REAL ESTATE PROFESSIONAL
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {/* REP Hours */}
                <div 
                  onClick={() => setShowREPDetailModal(true)}
                  style={{ flex: 1, background: C.greenPale, borderRadius: 8, padding: "10px", textAlign: "center", border: `1px solid ${C.greenB}`, cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>✅ REP</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{reHrs}h</div>
                </div>
                
                {/* Progress Ring */}
                <div style={{ position: "relative", width: 65, height: 65, flexShrink: 0 }}>
                  <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: 65, height: 65 }}>
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke={C.borderL} strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke={reHrs >= 750 ? C.greenB : C.goldL} strokeWidth="3"
                      strokeDasharray={`${Math.min((reHrs/750)*100, 100)}, 100`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{Math.min(100, Math.round(reHrs/750*100))}%</div>
                    <div style={{ fontSize: 8, color: C.gold }}>750h</div>
                  </div>
                </div>
                
                {/* Non-REP Hours */}
                <div 
                  onClick={() => setShowNonREPDetailModal(true)}
                  style={{ flex: 1, background: C.redPale, borderRadius: 8, padding: "10px", textAlign: "center", border: `1px solid ${C.redB}`, cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>💼 JOB</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{nonREHrs}h</div>
                </div>
              </div>
              
              {/* REP Percentage Bar */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.mid }}>REP: {rePct.toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: rePct > 50 ? C.green : C.red, fontWeight: 600 }}>{rePct > 50 ? "✓ Above 50%" : "⚠️ Need >50%"}</span>
                </div>
                <div style={{ height: 8, background: C.redPale, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(rePct, 100)}%`, height: "100%", background: C.greenB, borderRadius: 4 }} />
                </div>
              </div>
            </div>

            {/* MAIN LAYOUT - Chat + Sidebar */}
            <div className="assistant-layout" style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
              
              {/* CHAT AREA */}
              <div className="chat-area" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
                
                {/* Chat Header */}
                <div style={{ marginBottom: 12 }}>
                  <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: fs.title, fontWeight: 700, color: C.dark, margin: 0 }}>AI Assistant</h1>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light, margin: 0, marginTop: 2 }}>IRS-compliant activity logging</p>
                </div>

                {/* Messages Container */}
                <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", WebkitOverflowScrolling: "touch", minHeight: 200 }}>
                  {messages.map(msg => (
                    <div key={msg.id} className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-assistant"} ${msg.activityLogged ? "msg-logged" : ""}`}>
                      {msg.activityLogged && (
                        <div style={{ fontSize: 10, color: C.green, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>✓</span> ACTIVITY SAVED TO RECORDS
                        </div>
                      )}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: fs.base - 1, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    </div>
                  ))}
                  {loading && (
                    <div className="msg-bubble msg-assistant">
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.light }}>🔍 Analyzing activity and generating IRS documentation...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area with Upload */}
                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
                  {/* File Upload Button */}
                  <label style={{ 
                    padding: "12px 14px", background: "#f8f8f8", border: `2px solid ${C.border}`,
                    borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s", flexShrink: 0
                  }}
                  title="Upload document (mortgage, lease, HUD-1, etc.)"
                  >
                    <span style={{ fontSize: 20 }}>📎</span>
                    <span className="upload-text" style={{ fontSize: 11, color: C.mid, fontFamily: "'IBM Plex Mono', monospace" }}>Upload</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" style={{ display: "none" }} 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Show uploading message
                          setMessages(prev => [...prev, {
                            role: "user", id: uid(),
                            content: `📎 Uploading: ${file.name}`
                          }]);
                          
                          setLoading(true);
                          
                          // Convert file to base64 for AI analysis
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            const base64 = event.target.result.split(',')[1];
                            const fileType = file.type;
                            const fileName = file.name.toLowerCase();
                            
                            // Determine document type from filename
                            let docType = "real estate document";
                            if (fileName.includes("mortgage") || fileName.includes("loan") || fileName.includes("mtg")) {
                              docType = "mortgage statement";
                            } else if (fileName.includes("lease") || fileName.includes("rental agreement")) {
                              docType = "lease agreement";
                            } else if (fileName.includes("hud") || fileName.includes("closing") || fileName.includes("settlement")) {
                              docType = "HUD-1 closing document";
                            } else if (fileName.includes("insurance") || fileName.includes("policy")) {
                              docType = "insurance policy";
                            } else if (fileName.includes("tax") || fileName.includes("1098")) {
                              docType = "tax document";
                            }
                            
                            // Send to AI for smart extraction
                            try {
                              const isImage = fileType.startsWith('image/');
                              
                              const systemPrompt = `You are a smart real estate document analyzer. The user uploaded a ${docType}. 

EXTRACT the following information if visible:
- Property address (CRITICAL - find any address)
- Purchase price or property value
- Down payment amount
- Monthly mortgage/loan payment
- Interest rate and loan term
- Monthly rent (for leases)
- Tenant name (for leases)
- Lease start/end dates
- Annual property taxes
- Annual insurance premium
- HOA fees (monthly)

RESPOND in this format:
📋 **Document Analysis: ${file.name}**

**Property Identified:**
• Address: [extracted address or "Not found"]

**Key Financial Data:**
• [List all extracted values with labels]

**To Add This Property:**
Tell me any details I couldn't extract:
- Purchase price?
- Down payment?
- Monthly mortgage payment?
- Monthly rent?
- Property taxes (annual)?
- Insurance (annual)?

Once you provide the details, I'll add it with full financial tracking!

If you extracted enough info, use:
[[ADD_PROPERTY:{"address":"full address","type":"single_family","units":1,"rent":0,"purchasePrice":0,"downPayment":0,"mortgagePayment":0,"taxes":0,"insurance":0,"hoa":0,"utilities":0,"maintenance":0,"propertyMgmt":0,"vacancyRate":5}]]

IMPORTANT: Always include ALL fields in ADD_PROPERTY, use 0 for unknown values.`;

                              const messageContent = isImage ? [
                                { type: "image", source: { type: "base64", media_type: fileType, data: base64 } },
                                { type: "text", text: `Please analyze this ${docType} and extract property/financial information. Look for any property address, purchase price, mortgage details, rent amounts, or lease terms.` }
                              ] : [
                                { type: "text", text: `I uploaded a ${docType} named "${file.name}". Please help me extract the key information. The document appears to be a ${docType}.

Since I can't directly read the document content, please ask me for the specific details you need to add this to my records:
- What is the property address?
- What is the monthly payment amount?
- What other key details should I provide?` }
                              ];

                              const data = await callChatApi(
                                systemPrompt,
                                [{ role: "user", content: messageContent }]
                              );
                              let aiResponse = data.content?.[0]?.text || data.error || "I couldn't analyze the document. Please describe what's in it.";
                              
                              // Check for property add tag
                              const propMatch = aiResponse.match(/\[\[ADD_PROPERTY:(.*?)\]\]/);
                              if (propMatch) {
                                try {
                                  const propData = JSON.parse(propMatch[1]);
                                  // Offer to add but don't auto-add
                                  aiResponse = aiResponse.replace(/\[\[ADD_PROPERTY:.*?\]\]/g, '');
                                } catch (e) {}
                              }
                              
                              setMessages(prev => [...prev, {
                                role: "assistant", id: uid(),
                                content: aiResponse
                              }]);
                              
                            } catch (err) {
                              console.error("Document analysis error:", err);
                              setMessages(prev => [...prev, {
                                role: "assistant", id: uid(),
                                content: `📎 **Document Received: ${file.name}**\n\nI received your ${docType}. Please tell me the key details:\n\n• **Property address?**\n• **Purchase price?** (for closing docs)\n• **Monthly mortgage payment?**\n• **Monthly rent?** (for leases)\n\nJust type the information and I'll help add it to your records!`
                              }]);
                            }
                            
                            setLoading(false);
                          };
                          
                          reader.onerror = () => {
                            setMessages(prev => [...prev, {
                              role: "assistant", id: uid(),
                              content: `❌ Error reading file. Please try again or manually enter the property details.`
                            }]);
                            setLoading(false);
                          };
                          
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your activity... (Enter to send)"
                    style={{
                      flex: 1, padding: "12px 14px", fontSize: fs.base, border: `2px solid ${C.border}`,
                      borderRadius: 8, background: "white", color: C.text, outline: "none", resize: "none",
                      fontFamily: "'IBM Plex Mono', monospace", minHeight: 50
                    }}
                  />
                  <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-gold" 
                    style={{ padding: "12px 20px", opacity: loading || !input.trim() ? 0.5 : 1, minHeight: 50 }}>
                    Send
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="quick-actions-row" style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {[
                    "2 hours property management",
                    "45-min contractor meeting", 
                    "1 hour showing unit",
                  ].map(q => (
                    <button key={q} onClick={() => setInput(`I spent ${q}`)} style={{
                      background: "white", border: `1px solid ${C.border}`, borderRadius: 20,
                      padding: "6px 12px", fontSize: 11, color: C.mid, cursor: "pointer",
                      fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap"
                    }}>
                      {q}
                    </button>
                  ))}
                  <button 
                    onClick={() => setShowNonREModal(true)} 
                    style={{
                      background: C.redPale, border: `2px solid ${C.redB}`, borderRadius: 20,
                      padding: "6px 12px", fontSize: 11, color: C.red, cursor: "pointer",
                      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600
                    }}>
                    ➕ Log Job Hours
                  </button>
                </div>
              </div>

              {/* DESKTOP SIDEBAR - Original Light Theme */}
              <div className="desktop-sidebar" style={{ width: 320, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
                
                {/* Main Hours Card */}
                <div className="card" style={{ padding: 20, border: `2px solid ${C.goldL}` }}>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: C.dark, letterSpacing: 1 }}>
                      🏠 REAL ESTATE PROFESSIONAL
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, marginTop: 4 }}>
                      IRS Status Tracker
                    </div>
                  </div>

                  {/* REP vs Non-REP Side by Side */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {/* REP Hours */}
                    <div 
                      onClick={() => setShowREPDetailModal(true)}
                      style={{ background: C.greenPale, borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${C.greenB}`, cursor: "pointer", transition: "transform 0.15s" }}>
                      <div style={{ fontSize: 11, color: C.green, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginBottom: 6 }}>✅ REP HOURS</div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.green }}>{reHrs}h</div>
                      <div style={{ fontSize: 10, color: C.mid, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>RE Work</div>
                    </div>

                    {/* Non-REP Hours */}
                    <div 
                      onClick={() => setShowNonREPDetailModal(true)}
                      style={{ background: C.redPale, borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${C.redB}`, cursor: "pointer", transition: "transform 0.15s" }}>
                      <div style={{ fontSize: 11, color: C.red, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginBottom: 6 }}>💼 JOB HOURS</div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.red }}>{nonREHrs}h</div>
                      <div style={{ fontSize: 10, color: C.mid, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>W-2 / 1099</div>
                    </div>
                  </div>

                  {/* REP Percentage Progress Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.mid }}>REP Percentage</span>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: rePct > 50 ? C.green : C.red }}>
                        {rePct.toFixed(0)}% {rePct > 50 ? "✓" : "⚠️"}
                      </span>
                    </div>
                    <div style={{ height: 12, background: C.redPale, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(rePct, 100)}%`, background: C.greenB, height: "100%", borderRadius: 6, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>RE: {rePct.toFixed(0)}%</span>
                      <span style={{ fontSize: 9, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>Job: {(100-rePct).toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* 750h Progress */}
                  <div style={{ background: "#f8f6f0", borderRadius: 6, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.mid }}>750h Threshold</span>
                      <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: reHrs >= 750 ? C.green : C.gold }}>
                        {reHrs}/750h
                      </span>
                    </div>
                    <div style={{ height: 8, background: C.borderL, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min((reHrs/750)*100, 100)}%`, height: "100%", background: reHrs >= 750 ? C.greenB : C.goldL, borderRadius: 4 }} />
                    </div>
                    {reHrs < 750 && (
                      <div style={{ fontSize: 10, color: C.orange, fontFamily: "'IBM Plex Mono', monospace", marginTop: 6, textAlign: "center" }}>
                        Need {hoursNeeded.toFixed(0)}h more • {hoursPerWeek}h/week
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.light, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>ENTRIES</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.blue, fontFamily: "'Inter', sans-serif" }}>{localEntries.length}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.light, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>QUALIFYING</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: "'Inter', sans-serif" }}>{localEntries.filter(e => e.qualifies).length}</div>
                    </div>
                  </div>
                </div>

                {/* IRS Requirements */}
                <div className="card" style={{ background: rePct > 50 && reHrs >= 750 ? C.greenPale : C.goldPale, border: `1px solid ${rePct > 50 && reHrs >= 750 ? C.greenB : C.gold}`, padding: 14 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: rePct > 50 && reHrs >= 750 ? C.green : C.gold, letterSpacing: 2, marginBottom: 10 }}>
                    {rePct > 50 && reHrs >= 750 ? "✅ REP QUALIFIED" : "📋 REP REQUIREMENTS"}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, lineHeight: 1.8 }}>
                    <div>{reHrs >= 750 ? "✅" : "⬜"} 750+ hours in RE activities</div>
                    <div>{rePct > 50 ? "✅" : "⬜"} RE work {">"} 50% of total</div>
                    <div>⬜ Material participation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                  Dashboard {profile?.firstName && <span style={{ fontWeight: 400, color: C.light }}>— {profile.firstName}</span>}
                </h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{profile?.companyName || 'Track your real estate professional status'}</p>
              </div>
              {/* Year Selector + Calculator Button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button 
                  onClick={() => setShowREPCalculator(true)}
                  style={{ 
                    padding: "8px 14px", background: "#0D1B2A", color: "white", 
                    border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, 
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  🧮 Do I Need REP?
                </button>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light }}>Tax Year:</span>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, background: "white", cursor: "pointer" }}
                >
                  {getAvailableYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year Qualification Status Banner */}
            <div style={{ 
              background: qualifiedForYear ? C.greenPale : C.orangePale, 
              border: `2px solid ${qualifiedForYear ? C.greenB : C.orangeB}`, 
              borderRadius: 12, 
              padding: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: qualifiedForYear ? C.green : C.orange, marginBottom: 4 }}>
                  {qualifiedForYear ? "✅ REP Status Qualified" : "⚠️ REP Status Not Yet Qualified"} — {selectedYear}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>
                  {meetsHoursRequirement ? "✓" : "✗"} 750+ hours ({yearlyRepHours}h logged) &nbsp;&nbsp;
                  {meetsPercentRequirement ? "✓" : "✗"} 50%+ REP time ({yearlyRepPct}% REP)
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: qualifiedForYear ? C.green : C.orange }}>
                  {yearlyRepHours}h
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid }}>
                  {meetsHoursRequirement ? "Threshold met!" : `${Math.max(0, 750 - yearlyRepHours).toFixed(1)}h to go`}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              <div className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>REP HOURS ({selectedYear})</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.green }}>{yearlyRepHours}h</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>of 750h threshold</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.redB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>NON-REP HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.red }}>{Math.round(yearlyNonRepMinutes / 60 * 10) / 10}h</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>W-2 & other work</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.goldL}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>REP PERCENTAGE</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.gold }}>{yearlyRepPct}%</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>of total work time</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.blueB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>ENTRIES ({selectedYear})</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.blue }}>{entriesForYear.length}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>activities logged</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.purpleB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>PROPERTIES</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.purple }}>{localProperties.length}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>in portfolio</div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Activity ({selectedYear})</h2>
              {entriesForYear.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: C.light }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>No activities logged for {selectedYear}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, marginTop: 8 }}>Go to Assistant to start logging REP hours</div>
                </div>
              ) : (
                entriesForYear.slice(0, 5).map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.borderL}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{e.activity}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light, marginTop: 2 }}>{e.date} · {e.categoryLabel}</div>
                      {e.irsDescription && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid, marginTop: 6, padding: "6px 8px", background: C.greenPale, borderRadius: 3, borderLeft: `2px solid ${C.greenB}` }}>
                          📝 {e.irsDescription.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginLeft: 16 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.gold, fontWeight: 600 }}>{fmtH(e.minutes)}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "REP" : "Non-REP"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial dashboard widgets */}
            <FinancialDashboardWidgets C={C} properties={localProperties} tenants={localTenants} localExpenses={localExpenses} />
          </div>
        )}

        {/* RECORDS VIEW */}
        {view === "records" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Activity Records</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>IRS-compliant documentation for audit protection</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light }}>Export Year:</span>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={{ padding: "8px 12px", borderRadius: 6, border: `2px solid ${C.gold}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, background: "white", cursor: "pointer", color: C.dark }}
                >
                  {getAvailableYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <button onClick={removeDuplicateEntries} style={{ 
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 14px",
                  background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 8,
                  color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>
                  🧹 Remove Duplicates
                </button>
                <button onClick={exportWeeklyPDF} style={{ 
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                  background: "white", border: `2px solid ${C.dark}`, borderRadius: 8,
                  color: C.dark, fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}>
                  📅 Weekly Summary
                </button>
                <button onClick={exportPDFForCPA} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}>
                  📄 Export PDF for CPA
                </button>
              </div>
            </div>
            
            <div className="card" style={{ padding: 0, maxHeight: "calc(100vh - 220px)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 70px 1fr 130px 60px 80px", padding: "12px 16px", background: "#f5f0e8", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                {["Date", "Type", "Activity & IRS Documentation", "Category", "Time", "Actions"].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {localEntries.map(e => (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "90px 70px 1fr 130px 60px 80px", padding: "14px 16px", borderBottom: `1px solid ${C.borderL}`, alignItems: "start" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>{e.date}</div>
                    <div><span style={{ padding: "2px 6px", borderRadius: 2, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "REP" : "Non"}</span></div>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text, marginBottom: 4 }}>{e.activity}</div>
                      {e.irsDescription && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid, padding: "6px 8px", background: "#f8f6f0", borderRadius: 3, borderLeft: `2px solid ${C.goldL}` }}>
                          <strong style={{ color: C.gold }}>IRS Doc:</strong> {e.irsDescription}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid }}>{e.categoryLabel}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.gold, fontWeight: 600 }}>{fmtH(e.minutes)}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button 
                        onClick={() => setShowEditEntryModal({...e})}
                        style={{ 
                          padding: "4px 8px", fontSize: 10, background: "#f0f0f0", 
                          border: "1px solid #ddd", borderRadius: 4, cursor: "pointer",
                          fontFamily: "'IBM Plex Mono', monospace"
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => setShowDeleteEntryConfirm(e)}
                        style={{ 
                          padding: "4px 8px", fontSize: 10, background: "#fee2e2", 
                          border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer",
                          color: "#dc2626", fontFamily: "'IBM Plex Mono', monospace"
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROPERTIES VIEW */}
        {view === "properties" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Properties</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#888" }}>
                  {localProperties.length} properties • ${localProperties.reduce((s, p) => s + (p.rent || 0), 0).toLocaleString()}/mo portfolio rent
                </p>
              </div>
              <button 
                onClick={() => setShowAddPropertyModal(true)}
                style={{ 
                  background: "#1a1a2e", color: "white", border: "none", borderRadius: 8,
                  padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8
                }}
              >
                <span style={{ fontSize: 16 }}>+</span> Add Property
              </button>
            </div>

            {/* Portfolio Summary - Elegant minimal cards */}
            {localProperties.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {/* Total Rent */}
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>MONTHLY RENT</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>
                    ${localProperties.reduce((s, p) => s + (p.rent || 0), 0).toLocaleString()}
                  </div>
                </div>
                
                {/* Cash Flow */}
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>CASH FLOW</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: (() => {
                    const cf = localProperties.reduce((s, p) => {
                      const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                      return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                    }, 0);
                    return cf >= 0 ? "#22c55e" : "#ef4444";
                  })() }}>
                    {(() => {
                      const cf = localProperties.reduce((s, p) => {
                        const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                        return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                      }, 0);
                      return (cf >= 0 ? '+$' : '-$') + Math.abs(Math.round(cf)).toLocaleString();
                    })()}
                  </div>
                </div>

                {/* Avg Cap Rate */}
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>AVG CAP RATE</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>
                    {(() => {
                      const propsWithValue = localProperties.filter(p => p.purchasePrice && p.rent);
                      if (propsWithValue.length === 0) return "—";
                      const avgCapRate = propsWithValue.reduce((s, p) => {
                        const effectiveRent = p.rent * (1 - (p.vacancyRate || 5) / 100);
                        const noi = effectiveRent - (p.totalExpenses || 0);
                        return s + (noi * 12 / p.purchasePrice * 100);
                      }, 0) / propsWithValue.length;
                      return avgCapRate.toFixed(1) + "%";
                    })()}
                  </div>
                </div>

                {/* Total NPV */}
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>10-YR NPV</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: (() => {
                    const dr = 0.08, ar = 0.03, hp = 10;
                    let npv = 0;
                    localProperties.forEach(p => {
                      if (!p.downPayment || !p.purchasePrice) return;
                      const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                      const noi = er - (p.totalExpenses || 0);
                      const cf = noi - (p.mortgagePayment || 0);
                      let pnpv = -(p.downPayment || 0);
                      for (let y = 1; y <= hp; y++) pnpv += (cf * 12 * Math.pow(1.02, y - 1)) / Math.pow(1 + dr, y);
                      pnpv += ((p.purchasePrice || 0) * Math.pow(1 + ar, hp) * 0.94) / Math.pow(1 + dr, hp);
                      npv += pnpv;
                    });
                    return npv >= 0 ? "#22c55e" : "#ef4444";
                  })() }}>
                    {(() => {
                      const dr = 0.08, ar = 0.03, hp = 10;
                      let npv = 0;
                      localProperties.forEach(p => {
                        if (!p.downPayment || !p.purchasePrice) return;
                        const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                        const noi = er - (p.totalExpenses || 0);
                        const cf = noi - (p.mortgagePayment || 0);
                        let pnpv = -(p.downPayment || 0);
                        for (let y = 1; y <= hp; y++) pnpv += (cf * 12 * Math.pow(1.02, y - 1)) / Math.pow(1 + dr, y);
                        pnpv += ((p.purchasePrice || 0) * Math.pow(1 + ar, hp) * 0.94) / Math.pow(1 + dr, hp);
                        npv += pnpv;
                      });
                      if (localProperties.filter(p => p.downPayment && p.purchasePrice).length === 0) return "—";
                      return (npv >= 0 ? '+$' : '-$') + Math.abs(Math.round(npv / 1000)).toLocaleString() + 'K';
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Property Cards - Clean minimal design */}
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 340px)", paddingRight: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {localProperties.map(p => {
                  const effectiveRent = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                  const noi = effectiveRent - (p.totalExpenses || 0);
                  const cashFlow = noi - (p.mortgagePayment || 0);
                  const isPositive = cashFlow >= 0;
                  const capRate = p.purchasePrice && p.rent ? ((noi * 12) / p.purchasePrice * 100) : null;
                  const cashOnCash = p.downPayment && cashFlow ? ((cashFlow * 12) / p.downPayment * 100) : null;
                  
                  // NPV
                  const dr = 0.08, ar = 0.03, hp = 10;
                  let npv = -(p.downPayment || 0);
                  if (p.downPayment && p.purchasePrice) {
                    for (let y = 1; y <= hp; y++) npv += (cashFlow * 12 * Math.pow(1.02, y - 1)) / Math.pow(1 + dr, y);
                    npv += ((p.purchasePrice || 0) * Math.pow(1 + ar, hp) * 0.94) / Math.pow(1 + dr, hp);
                  }
                  
                  return (
                    <div key={p.id} style={{ 
                      background: "white", borderRadius: 12, border: "1px solid #e8e8e8",
                      overflow: "hidden", transition: "box-shadow 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"}
                    onMouseOut={(e) => e.currentTarget.style.boxShadow = "none"}
                    >
                      {/* Header bar */}
                      <div style={{ 
                        background: p.isSTR ? "#fef2f2" : "#f0f9ff", 
                        padding: "12px 16px", 
                        borderBottom: "1px solid #e8e8e8",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{p.isSTR ? "🏖️" : "🏠"}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1a1a2e", fontSize: 15 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: "#888" }}>{p.isSTR ? "Short-Term Rental" : "Long-Term Rental"}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditProperty(p); }}
                            style={{ 
                              padding: "6px 12px", background: "#f5f5f5", color: "#666", 
                              border: "1px solid #ddd", borderRadius: 6, fontSize: 12, 
                              cursor: "pointer", fontWeight: 500
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowDeletePropertyConfirm(p); }}
                            style={{ 
                              padding: "6px 10px", background: "#fef2f2", color: "#dc2626", 
                              border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, 
                              cursor: "pointer"
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div style={{ padding: 16 }}>
                        <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{p.address}</div>
                        
                        {/* Main metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4 }}>RENT</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>${(p.rent || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4 }}>CASH FLOW</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: isPositive ? "#22c55e" : "#ef4444" }}>
                              {isPositive ? "+" : ""}${Math.round(cashFlow).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        
                        {/* Secondary metrics */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                          <div style={{ background: "#f5f5f5", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ fontSize: 11, color: "#888" }}>Expenses </span>
                            <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 600 }}>${(p.totalExpenses || 0).toLocaleString()}</span>
                          </div>
                          <div style={{ background: "#f5f5f5", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ fontSize: 11, color: "#888" }}>Mortgage </span>
                            <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 600 }}>${(p.mortgagePayment || 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* ROI metrics */}
                        {(capRate || cashOnCash || (p.downPayment && p.purchasePrice)) && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                            {capRate && (
                              <div style={{ background: "#fafafa", padding: "6px 10px", borderRadius: 6, border: "1px solid #e8e8e8" }}>
                                <span style={{ fontSize: 11, color: "#888" }}>Cap </span>
                                <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 700 }}>{capRate.toFixed(1)}%</span>
                              </div>
                            )}
                            {cashOnCash && (
                              <div style={{ background: "#fafafa", padding: "6px 10px", borderRadius: 6, border: "1px solid #e8e8e8" }}>
                                <span style={{ fontSize: 11, color: "#888" }}>CoC </span>
                                <span style={{ fontSize: 13, color: isPositive ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{cashOnCash.toFixed(1)}%</span>
                              </div>
                            )}
                            {p.downPayment && p.purchasePrice && (
                              <div style={{ background: "#fafafa", padding: "6px 10px", borderRadius: 6, border: "1px solid #e8e8e8" }}>
                                <span style={{ fontSize: 11, color: "#888" }}>NPV </span>
                                <span style={{ fontSize: 13, color: npv >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                                  {npv >= 0 ? "+" : ""}${Math.round(npv / 1000)}K
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hours logged */}
                        {repByProperty[p.name] && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0", fontSize: 13, color: "#22c55e", fontWeight: 500 }}>
                            ✓ {(repByProperty[p.name].minutes / 60).toFixed(1)}h logged
                          </div>
                        )}

                        {/* STR Platforms */}
                        {p.isSTR && p.platforms && p.platforms.length > 0 && (
                          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                            {p.platforms.map(pl => {
                              const platform = STR_PLATFORMS.find(s => s.id === pl);
                              return platform ? <span key={pl} style={{ fontSize: 14 }} title={platform.name}>{platform.icon}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* Footer */}
                      <div 
                        onClick={() => setShowPropertyDetailModal(p)}
                        style={{ 
                          padding: "12px 16px", background: "#fafafa", borderTop: "1px solid #e8e8e8",
                          textAlign: "center", cursor: "pointer", fontSize: 13, color: "#666", fontWeight: 500
                        }}
                      >
                        View Details →
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Property Card */}
                <div 
                  onClick={() => setShowAddPropertyModal(true)}
                  style={{ 
                    background: "#fafafa", borderRadius: 12, border: "2px dashed #ddd",
                    display: "flex", flexDirection: "column", alignItems: "center", 
                    justifyContent: "center", minHeight: 200, cursor: "pointer",
                    transition: "border-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = "#1a1a2e"}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = "#ddd"}
                >
                  <div style={{ fontSize: 32, color: "#888", marginBottom: 8 }}>+</div>
                  <div style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>Add Property</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TENANTS VIEW */}
        {view === "tenants" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Tenants</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{localTenants.length} tenants across your properties</p>
              </div>
              <button onClick={() => setShowAddTenantModal(true)} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                ➕ Add Tenant
              </button>
            </div>


            {/* Scrollable Tenants List */}
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)", paddingRight: 10 }}>
              {/* Group by property */}
              {localProperties.map(property => {
                const propertyTenants = localTenants.filter(t => t.propertyId === property.id || t.propertyName === property.name);
                if (propertyTenants.length === 0) return null;
                
                return (
                  <div key={property.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      🏠 {property.name}
                      <span style={{ fontSize: 11, color: C.light, fontWeight: 400 }}>• {property.address}</span>
                    </div>
                    <div className="grid-2">
                      {propertyTenants.map(tenant => (
                        <div 
                          key={tenant.id} 
                          className="card" 
                          onClick={() => setShowTenantDetailModal(tenant)}
                          style={{ borderLeft: `4px solid ${C.blueB}`, cursor: "pointer", transition: "transform 0.15s" }}
                          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.01)"}
                          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark }}>
                                {tenant.firstName} {tenant.lastName}
                              </div>
                              {tenant.unit && (
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>Unit {tenant.unit}</div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <span style={{ 
                                padding: "2px 8px", fontSize: 10, borderRadius: 10,
                                background: tenant.hasInsurance ? C.greenPale : C.orangePale,
                                color: tenant.hasInsurance ? C.green : C.orange,
                                fontFamily: "'IBM Plex Mono', monospace"
                              }}>
                                {tenant.hasInsurance ? "✓ Ins" : "⚠️"}
                              </span>
                              {tenant.latePayments > 0 && (
                                <span style={{ padding: "2px 8px", fontSize: 10, borderRadius: 10, background: C.redPale, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {tenant.latePayments} late
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Icon-only action buttons */}
                          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          <a 
                            href={getEmailLink(tenant.email, `Regarding Your Lease at ${tenant.propertyName}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: "8px 12px", background: C.blueB, border: "none", borderRadius: 4, color: "white", cursor: "pointer", textDecoration: "none", fontSize: 14 }}
                            title="Send Email"
                          >
                            ✉️
                          </a>
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(tenant.email); }}
                            style={{ padding: "8px 12px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                            title="Copy Email"
                          >
                            📋
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(tenant.phone); }}
                            style={{ padding: "8px 12px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                            title="Copy Phone"
                          >
                            📱
                          </button>
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.light, fontFamily: "'IBM Plex Mono', monospace" }}>
                          <span>Lease: {tenant.leaseStart?.slice(5)} - {tenant.leaseEnd?.slice(5)}</span>
                          <span style={{ color: C.green, fontWeight: 600 }}>${tenant.rent}/mo</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Tenants without property assignment */}
            {localTenants.filter(t => !localProperties.find(p => p.id === t.propertyId || p.name === t.propertyName)).length > 0 && (
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: C.light, marginBottom: 12 }}>
                  Unassigned Tenants
                </div>
                {/* Similar card layout */}
              </div>
            )}

            {localTenants.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: C.mid, marginBottom: 8 }}>No tenants yet</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light, marginBottom: 16 }}>
                  Add tenants to track leases and communicate easily
                </div>
                <button onClick={() => setShowAddTenantModal(true)} className="btn-gold">Add First Tenant</button>
              </div>
            )}
            </div>

            {/* Tenant payment ledger */}
            <TenantLedgerPanel C={C} tenants={localTenants} onEmailRobot={(trigger) => setEmailRobot({ open: true, trigger })} />
          </div>
        )}

        {/* VENDORS VIEW */}
        {view === "vendors" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Vendors</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{localVendors.length} contractors & service providers</p>
              </div>
              <button onClick={() => setShowAddVendorModal(true)} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                ➕ Add Vendor
              </button>
            </div>

            {/* Scrollable Vendors List */}
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)", paddingRight: 10 }}>
              {/* Group by city first, then category */}
              {[...new Set(localVendors.map(v => v.city || "Other"))].map(city => {
                const cityVendors = localVendors.filter(v => (v.city || "Other") === city);
                if (cityVendors.length === 0) return null;
                
                return (
                  <div key={city} style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${C.gold}` }}>
                      📍 {city}
                      <span style={{ fontSize: 12, color: C.light, fontWeight: 400, marginLeft: 8 }}>• {cityVendors.length} vendor{cityVendors.length !== 1 ? 's' : ''}</span>
                    </div>
                    
                    {/* Group by category within city */}
                    {VENDOR_CATEGORIES.map(category => {
                      const categoryVendors = cityVendors.filter(v => v.category === category.id);
                      if (categoryVendors.length === 0) return null;
                      
                      return (
                        <div key={category.id} style={{ marginBottom: 12, marginLeft: 12 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: C.mid, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            {category.icon} {category.label}
                          </div>
                          <div className="grid-2">
                            {categoryVendors.map(vendor => (
                              <div 
                                key={vendor.id} 
                                className="card" 
                                onClick={() => setShowVendorDetailModal(vendor)}
                                style={{ borderLeft: `4px solid ${C.goldL}`, cursor: "pointer", transition: "transform 0.15s" }}
                                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.01)"}
                                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                              >
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark }}>
                                    {vendor.companyName}
                                  </div>
                                  {vendor.contactName && (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>{vendor.contactName}</div>
                                  )}
                                </div>
                              
                              {/* Icon-only action buttons */}
                              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                <a 
                                  href={getEmailLink(vendor.email, "Service Request")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ padding: "8px 12px", background: C.goldL, border: "none", borderRadius: 4, color: C.dark, cursor: "pointer", textDecoration: "none", fontSize: 14 }}
                                  title="Send Email"
                                >
                                  ✉️
                                </a>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(vendor.email); }}
                                  style={{ padding: "8px 12px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                                  title="Copy Email"
                                >
                                  📋
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(vendor.phone); }}
                                  style={{ padding: "8px 12px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                                  title="Copy Phone"
                                >
                                  📱
                                </button>
                              </div>
                              
                              {/* Service History */}
                              {vendor.serviceHistory && vendor.serviceHistory.length > 0 && (
                                <div style={{ fontSize: 10, color: C.mid, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>
                                  <div style={{ color: C.light, marginBottom: 2 }}>Service History:</div>
                                  {vendor.serviceHistory.slice(0, 2).map((s, i) => (
                                    <div key={i}>• {s}</div>
                                  ))}
                                </div>
                              )}
                              
                              {vendor.notes && (
                                <div style={{ fontSize: 10, color: C.green, fontFamily: "'IBM Plex Mono', monospace", fontStyle: "italic" }}>
                                  ✓ {vendor.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {localVendors.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: C.mid, marginBottom: 8 }}>No vendors yet</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light, marginBottom: 16 }}>
                  Add contractors and service providers for easy contact
                </div>
                <button onClick={() => setShowAddVendorModal(true)} className="btn-gold">Add First Vendor</button>
              </div>
            )}
            </div>

            {/* IRS 469(c) Qualifications Reference */}
            <div className="card" style={{ background: C.goldPale, border: `1px solid ${C.gold}`, marginTop: 16 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>
                📋 IRS §469(c)(7) QUALIFYING ACTIVITIES
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, lineHeight: 1.8 }}>
                <div><strong>Vendor coordination qualifies as REP work:</strong></div>
                <div>✅ Hiring and supervising contractors</div>
                <div>✅ Getting bids and comparing quotes</div>
                <div>✅ Coordinating repairs and maintenance</div>
                <div>✅ On-site supervision of work</div>
                <div>✅ Reviewing and approving invoices</div>
                <div style={{ marginTop: 8, color: C.light, fontSize: 10 }}>
                  Document all vendor interactions for IRS audit protection
                </div>
              </div>
            </div>

            {/* Vendor 1099 hub */}
            <Vendor1099Hub C={C} vendors={localVendors} />
          </div>
        )}

        {/* MAINTENANCE VIEW */}
        {view === "maintenance" && (
          <div className="tab-scroll">
            <MaintenanceView C={C} fs={fs} properties={localProperties} vendors={localVendors} onEmailRobot={(trigger) => setEmailRobot({ open: true, trigger })} />
          </div>
        )}

        {/* ACCOUNTING VIEW */}
        {view === "accounting" && (
          <div className="tab-scroll">
            <AccountingView
              C={C}
              fs={fs}
              entries={localEntries}
              expenses={localExpenses}
              properties={localProperties}
              onOpenQuickBill={() => setShowQuickBill(true)}
            />
          </div>
        )}

        {/* BANKING VIEW */}
        {view === "banking" && (
          <div className="tab-scroll">
            <BankingView C={C} fs={fs} />
          </div>
        )}
      </main>
      </div>{/* end app-content */}

      {/* Email Robot Modal */}
      <EmailRobot
        C={C}
        isOpen={emailRobot.open}
        onClose={() => setEmailRobot({ open: false, trigger: {} })}
        trigger={emailRobot.trigger}
        properties={localProperties}
        vendors={localVendors}
        robotEnabled={robotEnabled}
        onToggleRobot={toggleRobot}
        emailContacts={emailContacts}
        onSaveContacts={saveEmailContacts}
      />

      {/* QuickBill AI Invoice Modal */}
      <QuickBillModal
        C={C}
        fs={fs}
        isOpen={showQuickBill}
        onClose={() => setShowQuickBill(false)}
        properties={localProperties}
        onSave={(data) => {
          setLocalExpenses(prev => [{ ...data, id: uid(), savedAt: new Date().toISOString(), accountType: data.accountType || 'expense' }, ...prev]);
        }}
      />

      {/* Non-REPP Hours Quick Add Modal */}
      {showNonREModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.85)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: C.bg, borderRadius: 8, padding: 32, width: "100%",
            maxWidth: 440, boxShadow: "0 25px 80px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.dark }}>
                Log Non-REPP Work Hours
              </h2>
              <button onClick={() => setShowNonREModal(false)} style={{
                background: "none", border: "none", fontSize: 24, color: C.light, cursor: "pointer"
              }}>×</button>
            </div>

            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid, marginBottom: 20, lineHeight: 1.6 }}>
              Track your non-REPP work to ensure your REP percentage stays above 50% for REP qualification.
            </p>

            {/* Category Selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                Work Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {NON_RE_QUICK_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setNonRECategory(opt.id)}
                    style={{
                      padding: "12px 14px", border: `2px solid ${nonRECategory === opt.id ? C.redB : C.border}`,
                      borderRadius: 6, background: nonRECategory === opt.id ? C.redPale : "white",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: C.dark }}>
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hours Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                Hours Worked
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={nonREHours}
                onChange={(e) => setNonREHours(e.target.value)}
                placeholder="e.g., 8"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: 16, border: `1px solid ${C.border}`,
                  borderRadius: 6, background: "white", color: C.text, outline: "none",
                  fontFamily: "'IBM Plex Mono', monospace"
                }}
              />
            </div>

            {/* Description (optional) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                Description (Optional)
              </label>
              <input
                type="text"
                value={nonREDescription}
                onChange={(e) => setNonREDescription(e.target.value)}
                placeholder="e.g., Regular shift at hospital"
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`,
                  borderRadius: 6, background: "white", color: C.text, outline: "none",
                  fontFamily: "'IBM Plex Mono', monospace"
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowNonREModal(false)}
                style={{
                  flex: 1, padding: "14px 20px", background: "white", border: `1px solid ${C.border}`,
                  borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase"
                }}
              >
                Cancel
              </button>
              <button
                onClick={addNonREHours}
                disabled={!nonREHours || parseFloat(nonREHours) <= 0}
                style={{
                  flex: 1, padding: "14px 20px", background: !nonREHours ? C.border : C.redB,
                  border: "none", borderRadius: 4, color: "white", fontSize: 12, fontWeight: 600,
                  cursor: !nonREHours ? "not-allowed" : "pointer",
                  fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase"
                }}
              >
                Log Hours
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REP HOURS DETAIL MODAL ═══ */}
      {showREPDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20, overflowY: "scroll"
        }}>
          <div className="modal-scroll" style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 700, maxHeight: "85vh", overflowY: "scroll",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Header */}
            <div style={{ 
              background: C.greenB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, zIndex: 1
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: "white", margin: 0 }}>
                  ✅ REP Hours Breakdown
                </h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  Real Estate Professional Activities
                </div>
              </div>
              <button onClick={() => setShowREPDetailModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Total Summary */}
              <div style={{ 
                background: C.greenPale, border: `2px solid ${C.greenB}`, borderRadius: 8, 
                padding: 20, marginBottom: 24, textAlign: "center" 
              }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 48, fontWeight: 700, color: C.green }}>
                  {reHrs}h
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>
                  Total REP Hours • {repEntries.length} activities logged
                </div>
                <div style={{ marginTop: 12, height: 8, background: C.border, borderRadius: 4 }}>
                  <div style={{ width: `${Math.min((reHrs/750)*100, 100)}%`, height: "100%", background: C.greenB, borderRadius: 4 }} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.green, marginTop: 8 }}>
                  {reHrs >= 750 ? "✅ 750h threshold met!" : `${Math.max(0, 750 - reHrs).toFixed(1)}h more needed for 750h threshold`}
                </div>
              </div>

              {/* Breakdown by Category */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📂 Hours by Category
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {Object.entries(repByCategory).length > 0 ? Object.entries(repByCategory)
                    .sort((a, b) => b[1].minutes - a[1].minutes)
                    .map(([cat, data], i) => (
                      <div key={cat} style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderBottom: i < Object.entries(repByCategory).length - 1 ? `1px solid ${C.borderL}` : "none"
                      }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{cat}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light }}>{data.count} activities</div>
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.green }}>
                          {(data.minutes / 60).toFixed(1)}h
                        </div>
                      </div>
                    )) : (
                      <div style={{ padding: 16, textAlign: "center", color: C.light, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                        No REP activities logged yet
                      </div>
                    )}
                </div>
              </div>

              {/* Breakdown by Property */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  🏠 Hours by Property
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {Object.entries(repByProperty).length > 0 ? Object.entries(repByProperty)
                    .sort((a, b) => b[1].minutes - a[1].minutes)
                    .map(([prop, data], i) => (
                      <div key={prop} style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderBottom: i < Object.entries(repByProperty).length - 1 ? `1px solid ${C.borderL}` : "none"
                      }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{prop}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light }}>{data.count} activities</div>
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.green }}>
                          {(data.minutes / 60).toFixed(1)}h
                        </div>
                      </div>
                    )) : (
                      <div style={{ padding: 16, textAlign: "center", color: C.light, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                        No property data available
                      </div>
                    )}
                </div>
              </div>

              {/* Daily Summary (Last 7 Days) */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📅 Last 7 Days
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {repByDay.map((day, i) => (
                    <div key={day.date} style={{ 
                      background: day.minutes > 0 ? C.greenPale : "white", 
                      border: `1px solid ${day.minutes > 0 ? C.greenB : C.border}`,
                      borderRadius: 6, padding: 10, textAlign: "center"
                    }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.light }}>
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: day.minutes > 0 ? C.green : C.border }}>
                        {(day.minutes / 60).toFixed(1)}h
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activities */}
              <div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📝 Recent REP Activities
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {repEntries.slice(0, 5).map((e, i) => (
                    <div key={e.id} style={{ 
                      padding: "12px 16px", 
                      borderBottom: i < Math.min(repEntries.length, 5) - 1 ? `1px solid ${C.borderL}` : "none"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{e.activity}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, marginTop: 2 }}>
                            {e.date} • {e.categoryLabel}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: C.green, marginLeft: 12 }}>
                          {fmtH(e.minutes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NON-REPP HOURS DETAIL MODAL ═══ */}
      {showNonREPDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20, overflowY: "scroll"
        }}>
          <div className="modal-scroll" style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 700, maxHeight: "85vh", overflowY: "scroll",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Header */}
            <div style={{ 
              background: C.redB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, zIndex: 1
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: "white", margin: 0 }}>
                  💼 Non-REPP Hours Breakdown
                </h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  W-2 or 1099 Job
                </div>
              </div>
              <button onClick={() => setShowNonREPDetailModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Total Summary */}
              <div style={{ 
                background: C.redPale, border: `2px solid ${C.redB}`, borderRadius: 8, 
                padding: 20, marginBottom: 24, textAlign: "center" 
              }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 48, fontWeight: 700, color: C.red }}>
                  {nonREHrs}h
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>
                  Total Non-REPP Hours • {nonRepEntries.length} activities logged
                </div>
              </div>

              {/* Impact on REP Status */}
              <div style={{ 
                background: rePct > 50 ? C.greenPale : C.orangePale, 
                border: `2px solid ${rePct > 50 ? C.greenB : C.orange}`, 
                borderRadius: 8, padding: 16, marginBottom: 24 
              }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: rePct > 50 ? C.green : C.orange, marginBottom: 8 }}>
                  {rePct > 50 ? "✅ REP Percentage OK" : "⚠️ REP Percentage Warning"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid, lineHeight: 1.6 }}>
                  Your REP work is <strong>{rePct.toFixed(1)}%</strong> of total work time.
                  {rePct > 50 
                    ? " You're above the 50% threshold needed for REP status."
                    : ` You need REP work to exceed 50%. Consider logging more REP activities or reducing non-REP hours.`
                  }
                </div>
                <div style={{ marginTop: 12, height: 12, background: C.redPale, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${rePct}%`, height: "100%", background: C.greenB, borderRadius: 6 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>RE: {rePct.toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>Non-REP: {(100-rePct).toFixed(0)}%</span>
                </div>
              </div>

              {/* Breakdown by Type */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📂 Hours by Type
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {Object.entries(nonRepByCategory).length > 0 ? Object.entries(nonRepByCategory)
                    .sort((a, b) => b[1].minutes - a[1].minutes)
                    .map(([cat, data], i) => (
                      <div key={cat} style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderBottom: i < Object.entries(nonRepByCategory).length - 1 ? `1px solid ${C.borderL}` : "none"
                      }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{cat}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light }}>{data.count} entries</div>
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.red }}>
                          {(data.minutes / 60).toFixed(1)}h
                        </div>
                      </div>
                    )) : (
                      <div style={{ padding: 16, textAlign: "center", color: C.light, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                        No Non-REPP hours logged yet
                      </div>
                    )}
                </div>
              </div>

              {/* Daily Summary (Last 7 Days) */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📅 Last 7 Days
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {nonRepByDay.map((day, i) => (
                    <div key={day.date} style={{ 
                      background: day.minutes > 0 ? C.redPale : "white", 
                      border: `1px solid ${day.minutes > 0 ? C.redB : C.border}`,
                      borderRadius: 6, padding: 10, textAlign: "center"
                    }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.light }}>
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: day.minutes > 0 ? C.red : C.border }}>
                        {(day.minutes / 60).toFixed(1)}h
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activities */}
              <div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📝 Recent Non-REPP Activities
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {nonRepEntries.length > 0 ? nonRepEntries.slice(0, 5).map((e, i) => (
                    <div key={e.id} style={{ 
                      padding: "12px 16px", 
                      borderBottom: i < Math.min(nonRepEntries.length, 5) - 1 ? `1px solid ${C.borderL}` : "none"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{e.activity}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, marginTop: 2 }}>
                            {e.date} • {e.categoryLabel}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: C.red, marginLeft: 12 }}>
                          {fmtH(e.minutes)}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ padding: 16, textAlign: "center", color: C.light, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                      No Non-REPP activities logged yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD PROPERTY MODAL ═══ */}
      {showAddPropertyModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Header - Fixed at top */}
            <div style={{ 
              background: "#228B22", padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center",
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: "white", margin: 0 }}>
                  🏠 Add New Property
                </h2>
              </div>
              <button onClick={() => setShowAddPropertyModal(false)} style={{
                background: "rgba(255,255,255,0.3)", border: "none", fontSize: 24, color: "white", 
                cursor: "pointer", width: 44, height: 44, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontWeight: 700
              }}>×</button>
            </div>

            {/* Scrollable Content - VISIBLE SCROLLBAR */}
            <div className="modal-scroll" style={{ padding: 24, overflowY: "scroll", flex: 1, maxHeight: "70vh" }}>
              {/* Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                  Property Address *
                </label>
                <input
                  type="text"
                  value={newProperty.address}
                  onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
                  placeholder="123 Main St, Pittsburgh PA 15213"
                  style={{
                    width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0",
                    borderRadius: 8, background: "white", color: "#1a1a2e", outline: "none",
                    fontFamily: "'Inter', sans-serif", boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Property Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                  Property Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { id: "single_family", label: "Single Family", icon: "🏠" },
                    { id: "multi_family", label: "Multi-Family", icon: "🏢" },
                    { id: "commercial", label: "Commercial", icon: "🏪" },
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewProperty({...newProperty, type: type.id})}
                      style={{
                        padding: "10px", border: `2px solid ${newProperty.type === type.id ? C.greenB : C.border}`,
                        borderRadius: 6, background: newProperty.type === type.id ? C.greenPale : "white",
                        cursor: "pointer", textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{type.icon}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.text }}>{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Units and Rent */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                    Number of Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newProperty.units}
                    onChange={(e) => handleUnitsChange(e.target.value)}
                    style={{
                      width: "100%", padding: "14px 16px", fontSize: 18, border: "2px solid #e0e0e0",
                      borderRadius: 8, background: "white", color: "#1a1a2e", outline: "none",
                      fontFamily: "'Inter', sans-serif", boxSizing: "border-box", fontWeight: 600
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                    {newProperty.units > 1 ? "Total Monthly Rent ($)" : "Monthly Rent ($)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProperty.rent}
                    onChange={(e) => setNewProperty({...newProperty, rent: e.target.value})}
                    placeholder={newProperty.units > 1 ? "Combined rent" : "2500"}
                    style={{
                      width: "100%", padding: "14px 16px", fontSize: 18, border: "2px solid #e0e0e0",
                      borderRadius: 8, background: "white", color: "#1a1a2e", outline: "none",
                      fontFamily: "'Inter', sans-serif", boxSizing: "border-box", fontWeight: 600
                    }}
                  />
                </div>
              </div>

              {/* Multifamily Unit Details */}
              {newProperty.units > 1 && (
                <div style={{ marginBottom: 20, background: "#E3F2FD", border: "2px solid #1565C0", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 16, color: "#0D47A1", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    🏢 UNIT DETAILS ({newProperty.units} units)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto" }}>
                    {newProperty.unitDetails.map((unit, idx) => (
                      <div key={idx} style={{ background: "white", borderRadius: 8, padding: 16, border: "1px solid #BBDEFB" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1565C0", marginBottom: 12 }}>
                          Unit {idx + 1}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#616161", marginBottom: 4 }}>Unit Name</label>
                            <input
                              type="text"
                              value={unit.unitName || ''}
                              onChange={(e) => updateUnitDetail(idx, 'unitName', e.target.value)}
                              placeholder="1A, 2B..."
                              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 6, boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#616161", marginBottom: 4 }}>Beds</label>
                            <select
                              value={unit.beds || 1}
                              onChange={(e) => updateUnitDetail(idx, 'beds', e.target.value)}
                              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 6 }}
                            >
                              <option value="0">Studio</option>
                              <option value="1">1 Bed</option>
                              <option value="2">2 Bed</option>
                              <option value="3">3 Bed</option>
                              <option value="4">4 Bed</option>
                              <option value="5">5+ Bed</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#616161", marginBottom: 4 }}>Baths</label>
                            <select
                              value={unit.baths || 1}
                              onChange={(e) => updateUnitDetail(idx, 'baths', e.target.value)}
                              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 6 }}
                            >
                              <option value="1">1 Bath</option>
                              <option value="1.5">1.5 Bath</option>
                              <option value="2">2 Bath</option>
                              <option value="2.5">2.5 Bath</option>
                              <option value="3">3+ Bath</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#616161", marginBottom: 4 }}>Rent/mo ($)</label>
                            <input
                              type="number"
                              min="0"
                              value={unit.rent || ''}
                              onChange={(e) => updateUnitDetail(idx, 'rent', e.target.value)}
                              placeholder="1500"
                              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 6, boxSizing: "border-box" }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 14, color: "#1565C0", fontWeight: 600 }}>
                    💡 Total from units: ${newProperty.unitDetails.reduce((sum, u) => sum + (parseInt(u.rent) || 0), 0).toLocaleString()}/mo
                  </div>
                </div>
              )}

              {/* Rental Type - STR vs LTR */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                  Rental Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setNewProperty({...newProperty, isSTR: false})}
                    style={{
                      padding: "12px", border: `2px solid ${!newProperty.isSTR ? C.blueB : C.border}`,
                      borderRadius: 6, background: !newProperty.isSTR ? C.bluePale : "white",
                      cursor: "pointer", textAlign: "center"
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🏠</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: C.text }}>Long-Term Rental</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.light }}>12+ month leases</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProperty({...newProperty, isSTR: true})}
                    style={{
                      padding: "12px", border: `2px solid ${newProperty.isSTR ? "#FF5A5F" : C.border}`,
                      borderRadius: 6, background: newProperty.isSTR ? "#fff5f5" : "white",
                      cursor: "pointer", textAlign: "center"
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🏖️</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: C.text }}>Short-Term Rental</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.light }}>Airbnb, VRBO, etc.</div>
                  </button>
                </div>
              </div>

              {/* Financial Info Section */}
              <div style={{ background: "#f8f8f5", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
                  💰 PURCHASE INFO
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Purchase Price ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.purchasePrice}
                      onChange={(e) => setNewProperty({...newProperty, purchasePrice: e.target.value})}
                      placeholder="350000"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Down Payment ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.downPayment}
                      onChange={(e) => setNewProperty({...newProperty, downPayment: e.target.value})}
                      placeholder="70000"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Mortgage/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.mortgagePayment}
                      onChange={(e) => setNewProperty({...newProperty, mortgagePayment: e.target.value})}
                      placeholder="1800"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div style={{ background: "#fff5f5", border: `1px solid ${C.redB}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
                  📊 MONTHLY OPERATING EXPENSES
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Taxes/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.taxes}
                      onChange={(e) => setNewProperty({...newProperty, taxes: e.target.value})}
                      placeholder="250"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Insurance/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.insurance}
                      onChange={(e) => setNewProperty({...newProperty, insurance: e.target.value})}
                      placeholder="150"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      HOA/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.hoa}
                      onChange={(e) => setNewProperty({...newProperty, hoa: e.target.value})}
                      placeholder="0"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Utilities/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.utilities}
                      onChange={(e) => setNewProperty({...newProperty, utilities: e.target.value})}
                      placeholder="0"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Maintenance/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.maintenance}
                      onChange={(e) => setNewProperty({...newProperty, maintenance: e.target.value})}
                      placeholder="100"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 6 }}>
                      Prop Mgmt/mo ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProperty.propertyMgmt}
                      onChange={(e) => setNewProperty({...newProperty, propertyMgmt: e.target.value})}
                      placeholder="0"
                      style={{
                        width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`,
                        borderRadius: 4, background: "white", color: C.text, outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 10, color: C.light, letterSpacing: 1 }}>Vacancy Rate:</label>
                  <select 
                    value={newProperty.vacancyRate} 
                    onChange={(e) => setNewProperty({...newProperty, vacancyRate: e.target.value})}
                    style={{ padding: "6px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="8">8%</option>
                    <option value="10">10%</option>
                  </select>
                  <span style={{ fontSize: 10, color: C.light }}>(typical: 5-8%)</span>
                </div>
              </div>

              {/* Purchase Date */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={newProperty.purchaseDate}
                  onChange={(e) => setNewProperty({...newProperty, purchaseDate: e.target.value})}
                  style={{
                    width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`,
                    borderRadius: 6, background: "white", color: C.text, outline: "none",
                    fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setShowAddPropertyModal(false)}
                  style={{
                    flex: 1, padding: "14px 20px", background: "white", border: `1px solid ${C.border}`,
                    borderRadius: 8, color: "#616161", fontSize: 16, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addProperty}
                  disabled={!newProperty.address.trim()}
                  style={{
                    flex: 1, padding: "16px 24px", background: !newProperty.address.trim() ? "#e0e0e0" : "#228B22",
                    border: "none", borderRadius: 8, color: "white", fontSize: 18, fontWeight: 700,
                    cursor: !newProperty.address.trim() ? "not-allowed" : "pointer",
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  ✓ Add Property
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROPERTY DETAIL MODAL ═══ */}
      {showPropertyDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20, overflowY: "scroll"
        }}>
          <div className="modal-scroll" style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 600, maxHeight: "85vh", overflowY: "scroll",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Header */}
            <div style={{ 
              background: C.greenB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                  🏠 {showPropertyDetailModal.name}
                </h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  {showPropertyDetailModal.type.replace("_", " ")}
                </div>
              </div>
              <button onClick={() => setShowPropertyDetailModal(null)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Property Info */}
              <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>ADDRESS</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{showPropertyDetailModal.address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>TYPE</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{showPropertyDetailModal.type.replace("_", " ")}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>UNITS</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{showPropertyDetailModal.units}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>MONTHLY RENT</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: C.green }}>${showPropertyDetailModal.rent.toLocaleString()}</div>
                  </div>
                  {showPropertyDetailModal.purchaseDate && (
                    <div>
                      <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>PURCHASE DATE</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{showPropertyDetailModal.purchaseDate}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* REP Hours for this property */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  ✅ REP Hours Logged
                </h3>
                {repByProperty[showPropertyDetailModal.name] ? (
                  <div style={{ background: C.greenPale, border: `1px solid ${C.greenB}`, borderRadius: 8, padding: 16, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.green }}>
                      {(repByProperty[showPropertyDetailModal.name].minutes / 60).toFixed(1)}h
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>
                      {repByProperty[showPropertyDetailModal.name].count} activities
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#f8f8f8", border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: "center" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>
                      No hours logged yet for this property
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activities */}
              <div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                  📝 Recent Activities
                </h3>
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {repEntries.filter(e => e.property === showPropertyDetailModal.name).length > 0 ? (
                    repEntries.filter(e => e.property === showPropertyDetailModal.name).slice(0, 5).map((e, i, arr) => (
                      <div key={e.id} style={{ 
                        padding: "12px 16px", 
                        borderBottom: i < arr.length - 1 ? `1px solid ${C.borderL}` : "none"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{e.activity}</div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, marginTop: 2 }}>{e.date} • {e.categoryLabel}</div>
                          </div>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: C.green }}>{fmtH(e.minutes)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 16, textAlign: "center", color: C.light, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                      No activities logged for this property
                    </div>
                  )}
                </div>
              </div>
              
              {/* Edit & Delete Buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button 
                  onClick={() => startEditProperty(showPropertyDetailModal)}
                  style={{ 
                    flex: 1, padding: "16px", background: "#00C9A7", color: "white", 
                    border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, 
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    minHeight: 54
                  }}
                >
                  ✏️ Edit Property
                </button>
                <button 
                  onClick={() => deleteProperty(showPropertyDetailModal.id)}
                  style={{ 
                    padding: "16px 24px", background: "#FFEBEE", color: "#C62828", 
                    border: "2px solid #C62828", borderRadius: 8, fontSize: 16, fontWeight: 700, 
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    minHeight: 54
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT PROPERTY MODAL ═══ */}
      {showEditPropertyModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.95)", display: "flex",
          alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", overflowY: "auto", WebkitOverflowScrolling: "touch"
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, width: "100%",
            maxWidth: 550, boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
            marginTop: 20, marginBottom: 40
          }}>
            {/* Header */}
            <div style={{ 
              background: "#00C9A7", padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, zIndex: 10
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                ✏️ Edit Property
              </h2>
              <button onClick={() => setShowEditPropertyModal(null)} style={{
                background: "rgba(255,255,255,0.3)", border: "none", fontSize: 24, color: "white", 
                cursor: "pointer", width: 44, height: 44, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Property Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>
                  Property Name *
                </label>
                <input
                  type="text"
                  value={showEditPropertyModal.name || ""}
                  onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, name: e.target.value})}
                  style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                />
              </div>
              
              {/* Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>
                  Address
                </label>
                <input
                  type="text"
                  value={showEditPropertyModal.address || ""}
                  onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, address: e.target.value})}
                  style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                />
              </div>
              
              {/* Units & Rent */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Units</label>
                  <input
                    type="number"
                    value={showEditPropertyModal.units || 1}
                    onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, units: e.target.value})}
                    style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Monthly Rent ($)</label>
                  <input
                    type="number"
                    value={showEditPropertyModal.rent || ""}
                    onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, rent: e.target.value})}
                    style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                  />
                </div>
              </div>
              
              {/* Purchase & Down Payment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Purchase Price ($)</label>
                  <input
                    type="number"
                    value={showEditPropertyModal.purchasePrice || ""}
                    onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, purchasePrice: e.target.value})}
                    style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Down Payment ($)</label>
                  <input
                    type="number"
                    value={showEditPropertyModal.downPayment || ""}
                    onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, downPayment: e.target.value})}
                    style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                  />
                </div>
              </div>
              
              {/* Mortgage */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Monthly Mortgage ($)</label>
                <input
                  type="number"
                  value={showEditPropertyModal.mortgagePayment || ""}
                  onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, mortgagePayment: e.target.value})}
                  style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50 }}
                />
              </div>
              
              {/* Operating Expenses */}
              <div style={{ background: "#E0F7F4", border: "2px solid #00C9A7", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#8B6914", marginBottom: 16 }}>📊 Monthly Operating Expenses</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>Taxes/mo</label>
                    <input type="number" value={showEditPropertyModal.taxes || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, taxes: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>Insurance/mo</label>
                    <input type="number" value={showEditPropertyModal.insurance || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, insurance: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>HOA/mo</label>
                    <input type="number" value={showEditPropertyModal.hoa || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, hoa: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>Utilities/mo</label>
                    <input type="number" value={showEditPropertyModal.utilities || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, utilities: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>Maintenance/mo</label>
                    <input type="number" value={showEditPropertyModal.maintenance || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, maintenance: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#8B6914", fontWeight: 600, marginBottom: 6 }}>Property Mgmt/mo</label>
                    <input type="number" value={showEditPropertyModal.propertyMgmt || ""} onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, propertyMgmt: e.target.value})}
                      style={{ width: "100%", padding: "12px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 48 }} placeholder="0" />
                  </div>
                </div>
              </div>
              
              {/* Vacancy Rate */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 14, color: "#1a1a2e", fontWeight: 600, marginBottom: 8 }}>Vacancy Rate</label>
                <select
                  value={showEditPropertyModal.vacancyRate || "5"}
                  onChange={(e) => setShowEditPropertyModal({...showEditPropertyModal, vacancyRate: e.target.value})}
                  style={{ width: "100%", padding: "14px 16px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8, minHeight: 50, background: "white" }}
                >
                  <option value="0">0% - No vacancy</option>
                  <option value="5">5% - Low vacancy</option>
                  <option value="8">8% - Average vacancy</option>
                  <option value="10">10% - High vacancy</option>
                </select>
              </div>
              
              {/* Save Button */}
              <button 
                onClick={saveEditedProperty}
                style={{ 
                  width: "100%", padding: "18px", background: "#228B22", color: "white", 
                  border: "none", borderRadius: 8, fontSize: 18, fontWeight: 700, 
                  cursor: "pointer", minHeight: 56
                }}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD TENANT MODAL ═══ */}
      {showAddTenantModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, overflowY: "scroll"
        }}>
          <div className="modal-scroll" style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 550, maxHeight: "85vh", overflowY: "scroll",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.blueB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                👤 Add New Tenant
              </h2>
              <button onClick={() => setShowAddTenantModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>FIRST NAME *</label>
                  <input type="text" value={newTenant.firstName} onChange={(e) => setNewTenant({...newTenant, firstName: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>LAST NAME *</label>
                  <input type="text" value={newTenant.lastName} onChange={(e) => setNewTenant({...newTenant, lastName: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* DOB */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>DATE OF BIRTH</label>
                <input type="date" value={newTenant.dob} onChange={(e) => setNewTenant({...newTenant, dob: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              {/* Contact */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>EMAIL</label>
                  <input type="email" value={newTenant.email} onChange={(e) => setNewTenant({...newTenant, email: e.target.value})}
                    placeholder="tenant@email.com"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PHONE</label>
                  <input type="tel" value={newTenant.phone} onChange={(e) => setNewTenant({...newTenant, phone: e.target.value})}
                    placeholder="(412) 555-1234"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Property & Unit */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PROPERTY</label>
                  <select value={newTenant.propertyId} onChange={(e) => setNewTenant({...newTenant, propertyId: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }}>
                    <option value="">Select property...</option>
                    {localProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>UNIT</label>
                  <input type="text" value={newTenant.unit} onChange={(e) => setNewTenant({...newTenant, unit: e.target.value})}
                    placeholder="A, B, 101..."
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Lease Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>LEASE START</label>
                  <input type="date" value={newTenant.leaseStart} onChange={(e) => setNewTenant({...newTenant, leaseStart: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>LEASE END</label>
                  <input type="date" value={newTenant.leaseEnd} onChange={(e) => setNewTenant({...newTenant, leaseEnd: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>RENT $/MO</label>
                  <input type="number" value={newTenant.rent} onChange={(e) => setNewTenant({...newTenant, rent: e.target.value})}
                    placeholder="1500"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Bio / Notes */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>BIO / NOTES</label>
                <textarea value={newTenant.bio || ""} onChange={(e) => setNewTenant({...newTenant, bio: e.target.value})}
                  placeholder="Occupation, pets, special notes..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box", resize: "none" }} />
              </div>

              {/* Insurance */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={newTenant.hasInsurance} onChange={(e) => setNewTenant({...newTenant, hasInsurance: e.target.checked})}
                    style={{ width: 18, height: 18 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>Has Renter's Insurance</span>
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowAddTenantModal(false)}
                  style={{ flex: 1, padding: "12px 20px", background: "white", border: `1px solid ${C.border}`, borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Cancel
                </button>
                <button onClick={addTenant} disabled={!newTenant.firstName || !newTenant.lastName}
                  style={{ flex: 1, padding: "12px 20px", background: !newTenant.firstName || !newTenant.lastName ? C.border : C.blueB, border: "none", borderRadius: 4, color: "white", fontSize: 12, fontWeight: 600, cursor: !newTenant.firstName || !newTenant.lastName ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Add Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TENANT DETAIL MODAL ═══ */}
      {showTenantDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 550, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.blueB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                  👤 {showTenantDetailModal.firstName} {showTenantDetailModal.lastName}
                </h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  {showTenantDetailModal.propertyName}{showTenantDetailModal.unit ? ` • Unit ${showTenantDetailModal.unit}` : ""}
                </div>
              </div>
              <button onClick={() => setShowTenantDetailModal(null)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Quick Actions - Icon buttons + Send Email */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <a 
                  href={getEmailLink(showTenantDetailModal.email, `Regarding Your Lease at ${showTenantDetailModal.propertyName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: "12px", background: C.blueB, border: "none", borderRadius: 6, color: "white", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  ✉️ Send Email
                </a>
                <button onClick={() => copyToClipboard(showTenantDetailModal.email)}
                  style={{ padding: "12px 16px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 16 }}
                  title="Copy Email"
                >
                  📋
                </button>
                <button onClick={() => copyToClipboard(showTenantDetailModal.phone)}
                  style={{ padding: "12px 16px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 16 }}
                  title="Copy Phone"
                >
                  📱
                </button>
              </div>

              {/* Bio Section */}
              {showTenantDetailModal.bio && (
                <div style={{ background: C.bluePale || "#e8f4fc", border: `1px solid ${C.blueB}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.blueB, letterSpacing: 1, marginBottom: 6 }}>BIO / NOTES</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                    {showTenantDetailModal.bio}
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>EMAIL</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showTenantDetailModal.email || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>PHONE</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showTenantDetailModal.phone || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>DATE OF BIRTH</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showTenantDetailModal.dob || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>RENT</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: C.green }}>${showTenantDetailModal.rent}/mo</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>LEASE PERIOD</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showTenantDetailModal.leaseStart} to {showTenantDetailModal.leaseEnd}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>INSURANCE</div>
                    <span style={{ 
                      padding: "4px 10px", fontSize: 11, borderRadius: 10,
                      background: showTenantDetailModal.hasInsurance ? C.greenPale : C.redPale,
                      color: showTenantDetailModal.hasInsurance ? C.green : C.red,
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}>
                      {showTenantDetailModal.hasInsurance ? "✓ Has Insurance" : "✗ No Insurance"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Late Payments */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: showTenantDetailModal.latePayments > 0 ? C.redPale : C.greenPale, border: `1px solid ${showTenantDetailModal.latePayments > 0 ? C.redB : C.greenB}`, borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: showTenantDetailModal.latePayments > 0 ? C.red : C.green, letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>PAYMENT STATUS</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: showTenantDetailModal.latePayments > 0 ? C.red : C.green }}>
                    {showTenantDetailModal.latePayments > 0 ? `${showTenantDetailModal.latePayments} Late Payment${showTenantDetailModal.latePayments > 1 ? 's' : ''}` : "Good Standing ✓"}
                  </div>
                </div>
              </div>

              {/* AI Communication Help */}
              <div style={{ padding: 16, background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 8 }}>💡 AI ASSISTANT</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>
                  Ask the AI to draft formal communications: lease renewal notices, maintenance updates, rent reminders, or late payment notices.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD VENDOR MODAL ═══ */}
      {showAddVendorModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 550, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.goldL, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>
                🔧 Add New Vendor
              </h2>
              <button onClick={() => setShowAddVendorModal(false)} style={{
                background: "rgba(0,0,0,0.1)", border: "none", fontSize: 20, color: C.dark, 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Company & Contact */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>COMPANY NAME *</label>
                  <input type="text" value={newVendor.companyName} onChange={(e) => setNewVendor({...newVendor, companyName: e.target.value})}
                    placeholder="ABC Plumbing LLC"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>CONTACT NAME</label>
                  <input type="text" value={newVendor.contactName} onChange={(e) => setNewVendor({...newVendor, contactName: e.target.value})}
                    placeholder="John Smith"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>CATEGORY</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {VENDOR_CATEGORIES.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setNewVendor({...newVendor, category: cat.id})}
                      style={{
                        padding: "8px 4px", border: `2px solid ${newVendor.category === cat.id ? C.goldL : C.border}`,
                        borderRadius: 6, background: newVendor.category === cat.id ? C.goldPale : "white",
                        cursor: "pointer", textAlign: "center"
                      }}>
                      <div style={{ fontSize: 16 }}>{cat.icon}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: C.text, marginTop: 2 }}>{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>EMAIL</label>
                  <input type="email" value={newVendor.email} onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                    placeholder="vendor@email.com"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PHONE</label>
                  <input type="tel" value={newVendor.phone} onChange={(e) => setNewVendor({...newVendor, phone: e.target.value})}
                    placeholder="(412) 555-1234"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* City */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>CITY / SERVICE AREA</label>
                <input type="text" value={newVendor.city || ""} onChange={(e) => setNewVendor({...newVendor, city: e.target.value})}
                  placeholder="Pittsburgh"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>NOTES</label>
                <textarea value={newVendor.notes} onChange={(e) => setNewVendor({...newVendor, notes: e.target.value})}
                  placeholder="24/7 emergency service, licensed & insured..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box", resize: "none" }} />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowAddVendorModal(false)}
                  style={{ flex: 1, padding: "12px 20px", background: "white", border: `1px solid ${C.border}`, borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Cancel
                </button>
                <button onClick={addVendor} disabled={!newVendor.companyName}
                  style={{ flex: 1, padding: "12px 20px", background: !newVendor.companyName ? C.border : C.gold, border: "none", borderRadius: 4, color: C.dark, fontSize: 12, fontWeight: 600, cursor: !newVendor.companyName ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Add Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VENDOR DETAIL MODAL ═══ */}
      {showVendorDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.goldL, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>
                  {VENDOR_CATEGORIES.find(c => c.id === showVendorDetailModal.category)?.icon} {showVendorDetailModal.companyName}
                </h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid, marginTop: 4 }}>
                  {VENDOR_CATEGORIES.find(c => c.id === showVendorDetailModal.category)?.label}
                </div>
              </div>
              <button onClick={() => setShowVendorDetailModal(null)} style={{
                background: "rgba(0,0,0,0.1)", border: "none", fontSize: 20, color: C.dark, 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Quick Actions */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <a 
                  href={getEmailLink(showVendorDetailModal.email, "Service Request")}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: "12px", background: C.goldL, border: "none", borderRadius: 6, color: C.dark, fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  ✉️ Send Email
                </a>
                <button onClick={() => copyToClipboard(showVendorDetailModal.email)}
                  style={{ padding: "12px 16px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 16 }}
                  title="Copy Email"
                >
                  📋
                </button>
                <button onClick={() => copyToClipboard(showVendorDetailModal.phone)}
                  style={{ padding: "12px 16px", background: "#f5f5f5", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 16 }}
                  title="Copy Phone"
                >
                  📱
                </button>
              </div>

              {/* Info */}
              <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>CONTACT</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showVendorDetailModal.contactName || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>EMAIL</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showVendorDetailModal.email || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>PHONE</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showVendorDetailModal.phone || "—"}</div>
                  </div>
                  {showVendorDetailModal.notes && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 10, color: C.light, letterSpacing: 1, marginBottom: 4 }}>NOTES</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{showVendorDetailModal.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Communication Help */}
              <div style={{ marginTop: 16, padding: 16, background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 8 }}>💡 AI ASSISTANT</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>
                  Ask the AI to draft formal service requests, quote requests, or follow-up communications to this vendor.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT ENTRY MODAL ═══ */}
      {showEditEntryModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ 
              padding: "16px 20px", borderBottom: "1px solid #e8e8e8",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#0D1B2A"
            }}>
              <h2 style={{ margin: 0, color: "white", fontSize: 18, fontWeight: 700 }}>
                ✏️ Edit Activity
              </h2>
              <button onClick={() => setShowEditEntryModal(null)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
                width: 32, height: 32, cursor: "pointer", color: "white", fontSize: 16
              }}>✕</button>
            </div>
            
            {/* Content */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gap: 16 }}>
                {/* Date */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📅 Date
                  </label>
                  <input
                    type="date"
                    value={showEditEntryModal.date}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, date: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                </div>

                {/* Activity Description */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📝 Activity Description
                  </label>
                  <input
                    type="text"
                    value={showEditEntryModal.activity}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, activity: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                </div>

                {/* Minutes */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    ⏱️ Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={showEditEntryModal.minutes}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, minutes: parseInt(e.target.value) || 0})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                  <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    = {((showEditEntryModal.minutes || 0) / 60).toFixed(1)} hours
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📂 Category
                  </label>
                  <select
                    value={showEditEntryModal.category}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, category: e.target.value, categoryLabel: IRS_CATEGORIES[e.target.value]?.label || e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  >
                    <optgroup label="✅ REP Qualifying">
                      {Object.entries(IRS_CATEGORIES).filter(([k, v]) => v.qualifies).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="❌ Non-REP">
                      {Object.entries(IRS_CATEGORIES).filter(([k, v]) => !v.qualifies).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Qualifies Toggle */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    ✅ Counts Toward REP?
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setShowEditEntryModal({...showEditEntryModal, qualifies: true})}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: showEditEntryModal.qualifies ? "#22c55e" : "#f0f0f0",
                        color: showEditEntryModal.qualifies ? "white" : "#666",
                        border: showEditEntryModal.qualifies ? "2px solid #16a34a" : "2px solid #ddd",
                        fontWeight: 600
                      }}
                    >
                      ✅ Yes - REP Hours
                    </button>
                    <button
                      onClick={() => setShowEditEntryModal({...showEditEntryModal, qualifies: false})}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: !showEditEntryModal.qualifies ? "#ef4444" : "#f0f0f0",
                        color: !showEditEntryModal.qualifies ? "white" : "#666",
                        border: !showEditEntryModal.qualifies ? "2px solid #dc2626" : "2px solid #ddd",
                        fontWeight: 600
                      }}
                    >
                      ❌ No - Non-REP
                    </button>
                  </div>
                </div>

                {/* Property */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    🏠 Property (optional)
                  </label>
                  <select
                    value={showEditEntryModal.property || ""}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, property: e.target.value || null})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  >
                    <option value="">General / No specific property</option>
                    {localProperties.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* IRS Description */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📋 IRS Documentation
                  </label>
                  <textarea
                    value={showEditEntryModal.irsDescription || ""}
                    onChange={(e) => setShowEditEntryModal({...showEditEntryModal, irsDescription: e.target.value})}
                    rows={3}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #e0e0e0", borderRadius: 8, resize: "vertical" }}
                    placeholder="Professional description for IRS audit documentation..."
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div style={{ 
              padding: "16px 20px", borderTop: "1px solid #e8e8e8",
              display: "flex", gap: 12, justifyContent: "flex-end"
            }}>
              <button
                onClick={() => setShowEditEntryModal(null)}
                style={{
                  padding: "10px 20px", background: "#f0f0f0", color: "#333",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEditedEntry}
                style={{
                  padding: "10px 24px", background: "#0D1B2A", color: "white",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE ENTRY CONFIRM MODAL ═══ */}
      {showDeleteEntryConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 24, width: "100%",
            maxWidth: 400, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#dc2626" }}>
                Delete Activity?
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
                This will permanently remove this entry from your records.
              </p>
            </div>
            
            <div style={{ 
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, 
              padding: 12, marginBottom: 20 
            }}>
              <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}>
                {showDeleteEntryConfirm.date} • {fmtH(showDeleteEntryConfirm.minutes)}
              </div>
              <div style={{ fontSize: 14, color: "#333", marginTop: 4 }}>
                {showDeleteEntryConfirm.activity}
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowDeleteEntryConfirm(null)}
                style={{
                  flex: 1, padding: "12px", background: "#f0f0f0", color: "#333",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEntry(showDeleteEntryConfirm.id)}
                style={{
                  flex: 1, padding: "12px", background: "#dc2626", color: "white",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE PROPERTY CONFIRM MODAL ═══ */}
      {showDeletePropertyConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 24, width: "100%",
            maxWidth: 420, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#dc2626" }}>
                Delete Property?
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
                This will permanently remove this property and all its data.
              </p>
            </div>
            
            <div style={{ 
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, 
              padding: 16, marginBottom: 20 
            }}>
              <div style={{ fontSize: 16, color: "#991b1b", fontWeight: 700, marginBottom: 4 }}>
                {showDeletePropertyConfirm.name}
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                {showDeletePropertyConfirm.address}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                {showDeletePropertyConfirm.isSTR ? "🏖️ STR" : "🏠 LTR"} • 
                ${(showDeletePropertyConfirm.rent || 0).toLocaleString()}/mo
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowDeletePropertyConfirm(null)}
                style={{
                  flex: 1, padding: "12px", background: "#f0f0f0", color: "#333",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProperty(showDeletePropertyConfirm.id)}
                style={{
                  flex: 1, padding: "12px", background: "#dc2626", color: "white",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                🗑️ Delete Property
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REP CALCULATOR MODAL ═══ */}
      {showREPCalculator && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.95)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 0, width: "100%",
            maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ 
              padding: "20px 24px", borderBottom: "1px solid #e8e8e8",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "linear-gradient(135deg, #0D1B2A 0%, #0A2A3A 100%)"
            }}>
              <div>
                <h2 style={{ margin: 0, color: "white", fontSize: 20, fontWeight: 700 }}>
                  🧮 Do I Need REP Status?
                </h2>
                <p style={{ margin: "4px 0 0", color: "#00C9A7", fontSize: 12 }}>
                  Calculate your potential tax savings
                </p>
              </div>
              <button onClick={() => setShowREPCalculator(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
                width: 36, height: 36, cursor: "pointer", color: "white", fontSize: 18
              }}>✕</button>
            </div>
            
            {/* Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* Input Fields */}
              <div style={{ display: "grid", gap: 16 }}>
                {/* Annual Income */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    💰 Your Annual Income (W-2 + Self-Employment)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 120000"
                    value={repCalcData.annualIncome}
                    onChange={(e) => setRepCalcData({...repCalcData, annualIncome: e.target.value})}
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                </div>

                {/* Filing Status */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📋 Filing Status
                  </label>
                  <select
                    value={repCalcData.filingStatus}
                    onChange={(e) => setRepCalcData({...repCalcData, filingStatus: e.target.value})}
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  >
                    <option value="single">Single</option>
                    <option value="married">Married Filing Jointly</option>
                    <option value="head">Head of Household</option>
                  </select>
                </div>

                {/* Number of Properties */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    🏠 Number of Rental Properties
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 3"
                    value={repCalcData.numProperties}
                    onChange={(e) => setRepCalcData({...repCalcData, numProperties: e.target.value})}
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                </div>

                {/* Rental Losses */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    📉 Total Annual Rental Losses (including depreciation)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 40000"
                    value={repCalcData.rentalLosses}
                    onChange={(e) => setRepCalcData({...repCalcData, rentalLosses: e.target.value})}
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  />
                  <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    Tip: Depreciation alone is often $10K-15K per property
                  </p>
                </div>

                {/* Job Hours */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                    ⏰ Your Work Hours Per Week (W-2 or Self-Employed)
                  </label>
                  <select
                    value={repCalcData.jobHoursPerWeek}
                    onChange={(e) => setRepCalcData({...repCalcData, jobHoursPerWeek: e.target.value})}
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                  >
                    <option value="0">0 - Not working / Retired</option>
                    <option value="10">10 hours (very part-time)</option>
                    <option value="20">20 hours (part-time)</option>
                    <option value="30">30 hours (reduced)</option>
                    <option value="40">40 hours (full-time)</option>
                    <option value="50">50+ hours (heavy workload)</option>
                  </select>
                </div>

                {/* Spouse */}
                {repCalcData.filingStatus === 'married' && (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                        👫 Does Your Spouse Work?
                      </label>
                      <select
                        value={repCalcData.spouseWorks}
                        onChange={(e) => setRepCalcData({...repCalcData, spouseWorks: e.target.value})}
                        style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "2px solid #e0e0e0", borderRadius: 8 }}
                      >
                        <option value="no">No - Stay-at-home / Retired</option>
                        <option value="part">Part-time (under 20 hrs/week)</option>
                        <option value="full">Full-time (40+ hrs/week)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Results */}
              {repCalcData.annualIncome && repCalcData.rentalLosses && (() => {
                const income = parseInt(repCalcData.annualIncome) || 0;
                const losses = parseInt(repCalcData.rentalLosses) || 0;
                const jobHours = parseInt(repCalcData.jobHoursPerWeek) || 0;
                const annualJobHours = jobHours * 50; // 50 work weeks
                
                // Calculate $25K allowance based on income
                let allowance = 0;
                if (income < 100000) {
                  allowance = Math.min(25000, losses);
                } else if (income < 150000) {
                  allowance = Math.max(0, 25000 - ((income - 100000) / 2));
                  allowance = Math.min(allowance, losses);
                }
                
                // Without REP - only get allowance
                const deductionWithoutREP = allowance;
                const suspendedLosses = Math.max(0, losses - allowance);
                
                // With REP - full deduction
                const deductionWithREP = losses;
                
                // Tax rate estimate (simplified)
                let taxRate = 0.22;
                if (income > 500000) taxRate = 0.37;
                else if (income > 200000) taxRate = 0.35;
                else if (income > 150000) taxRate = 0.32;
                else if (income > 80000) taxRate = 0.24;
                else if (income > 40000) taxRate = 0.22;
                else taxRate = 0.12;
                
                const savingsWithoutREP = deductionWithoutREP * taxRate;
                const savingsWithREP = deductionWithREP * taxRate;
                const additionalSavings = savingsWithREP - savingsWithoutREP;
                
                // Can they qualify?
                const reHoursNeeded = annualJobHours + 1; // Need more than job hours
                const canQualifySelf = annualJobHours < 750 || (losses > 25000 && annualJobHours < 1500);
                const spouseCanQualify = repCalcData.filingStatus === 'married' && 
                  (repCalcData.spouseWorks === 'no' || repCalcData.spouseWorks === 'part');
                
                const needsREP = losses > allowance || income >= 100000;
                
                return (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ 
                      background: "linear-gradient(135deg, #0D1B2A 0%, #0A2A3A 100%)", 
                      borderRadius: 12, padding: 20, color: "white" 
                    }}>
                      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#00C9A7" }}>
                        📊 Your REP Analysis
                      </h3>
                      
                      {/* Current Situation */}
                      <div style={{ marginBottom: 16, padding: 16, background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>WITHOUT REP STATUS</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#888" }}>$25K Allowance</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: income >= 150000 ? "#ef4444" : "#22c55e" }}>
                              ${Math.round(allowance).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#888" }}>Suspended (Wasted)</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>
                              ${Math.round(suspendedLosses).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* With REP */}
                      <div style={{ marginBottom: 16, padding: 16, background: "rgba(34,197,94,0.2)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)" }}>
                        <div style={{ fontSize: 13, color: "#22c55e", marginBottom: 8 }}>WITH REP STATUS</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#888" }}>Full Deduction</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>
                              ${Math.round(losses).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#888" }}>Suspended</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>
                              $0
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Savings */}
                      <div style={{ 
                        padding: 16, 
                        background: additionalSavings > 1000 ? "rgba(0,201,167,0.2)" : "rgba(255,255,255,0.1)", 
                        borderRadius: 8,
                        border: additionalSavings > 1000 ? "2px solid #00C9A7" : "none"
                      }}>
                        <div style={{ fontSize: 13, color: "#00C9A7", marginBottom: 8 }}>💰 POTENTIAL TAX SAVINGS</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#888" }}>Per Year</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#00C9A7" }}>
                              ${Math.round(additionalSavings).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#888" }}>Over 5 Years</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#00C9A7" }}>
                              ${Math.round(additionalSavings * 5).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#888" }}>Over 10 Years</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#00C9A7" }}>
                              ${Math.round(additionalSavings * 10).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Recommendation */}
                    <div style={{ 
                      marginTop: 16, padding: 16, borderRadius: 8,
                      background: needsREP ? "#fef3c7" : "#d1fae5",
                      border: needsREP ? "2px solid #f59e0b" : "2px solid #10b981"
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: needsREP ? "#92400e" : "#065f46", marginBottom: 8 }}>
                        {needsREP ? "⚠️ You Should Consider REP Status" : "✅ REP Status May Be Optional"}
                      </div>
                      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>
                        {needsREP ? (
                          <>
                            {income >= 150000 && <p style={{margin:"0 0 8px"}}>• Your income exceeds $150K, so you get <strong>$0</strong> passive loss allowance</p>}
                            {income >= 100000 && income < 150000 && <p style={{margin:"0 0 8px"}}>• Your income is phasing out the $25K allowance</p>}
                            {losses > 25000 && <p style={{margin:"0 0 8px"}}>• Your rental losses exceed $25K, leaving ${suspendedLosses.toLocaleString()} unused</p>}
                            <p style={{margin:"0 0 8px"}}>• <strong>Annual savings with REP: ${Math.round(additionalSavings).toLocaleString()}</strong></p>
                          </>
                        ) : (
                          <>
                            <p style={{margin:"0 0 8px"}}>• Your $25K passive loss allowance covers your rental losses</p>
                            <p style={{margin:0}}>• However, as you scale up or income grows, REP will become valuable</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Can You Qualify? */}
                    <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "#f8f8f8", border: "1px solid #e0e0e0" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 12 }}>
                        🎯 Can You Qualify for REP Status?
                      </div>
                      
                      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8 }}>
                        <div style={{ marginBottom: 8 }}>
                          <strong>Your job:</strong> {jobHours} hrs/week = {annualJobHours.toLocaleString()} hrs/year
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <strong>RE hours needed for 50%:</strong> {(annualJobHours + 1).toLocaleString()}+ hours
                        </div>
                        
                        {annualJobHours === 0 ? (
                          <div style={{ color: "#22c55e", fontWeight: 600 }}>
                            ✅ You can easily qualify! Just log 750+ hours of RE activities.
                          </div>
                        ) : annualJobHours <= 750 ? (
                          <div style={{ color: "#22c55e", fontWeight: 600 }}>
                            ✅ Very achievable! You need {annualJobHours + 1}+ RE hours to hit 50%.
                          </div>
                        ) : annualJobHours <= 1500 ? (
                          <div style={{ color: "#f59e0b", fontWeight: 600 }}>
                            ⚠️ Challenging but possible with {annualJobHours + 1}+ RE hours.
                          </div>
                        ) : (
                          <div style={{ color: "#ef4444", fontWeight: 600 }}>
                            ❌ Difficult - you'd need {annualJobHours + 1}+ RE hours.
                          </div>
                        )}
                        
                        {spouseCanQualify && (
                          <div style={{ marginTop: 12, padding: 12, background: "#d1fae5", borderRadius: 6 }}>
                            <strong style={{ color: "#065f46" }}>💡 SPOUSE STRATEGY:</strong>
                            <div style={{ color: "#047857", marginTop: 4 }}>
                              Your spouse {repCalcData.spouseWorks === 'no' ? "doesn't work" : "works part-time"}, 
                              so THEY can qualify as REP with just 750+ hours!
                              This is the most common strategy for high-income households.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* CTA */}
                    <button
                      onClick={() => setShowREPCalculator(false)}
                      style={{
                        width: "100%", marginTop: 20, padding: "14px 20px",
                        background: "#0D1B2A", color: "white", border: "none",
                        borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer"
                      }}
                    >
                      Start Tracking My REP Hours →
                    </button>
                  </div>
                );
              })()}
              
              {/* Disclaimer */}
              <p style={{ 
                fontSize: 10, color: "#888", marginTop: 20, padding: 12, 
                background: "#f8f8f8", borderRadius: 6, lineHeight: 1.5 
              }}>
                ⚠️ <strong>Disclaimer:</strong> This calculator provides estimates only and is not tax advice. 
                Actual tax savings depend on many factors including state taxes, AMT, and other deductions. 
                Consult a qualified CPA or tax attorney for personalized advice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS MODAL ═══ */}
      {showSettingsModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: "#1a1a2e", padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center",
              flexShrink: 0
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: "white", margin: 0 }}>
                ⚙️ Settings
              </h2>
              <button onClick={() => setShowSettingsModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 24, color: "white", 
                cursor: "pointer", width: 44, height: 44, borderRadius: "50%"
              }}>×</button>
            </div>

            <div className="modal-scroll" style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* Font Size Selection */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: "#1a1a2e", letterSpacing: 2, marginBottom: 12, fontWeight: 700 }}>🔤 TEXT SIZE</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#616161", marginBottom: 12 }}>
                  Make text easier to read
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { id: 'small', name: 'Small', sample: 'Aa', size: 14 },
                    { id: 'medium', name: 'Medium', sample: 'Aa', size: 18 },
                    { id: 'large', name: 'Large', sample: 'Aa', size: 24 },
                    { id: 'xlarge', name: 'Extra Large', sample: 'Aa', size: 30 }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => saveFontSize(opt.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                        padding: "16px", border: `3px solid ${fontSize === opt.id ? "#00C9A7" : "#E2E8F0"}`,
                        borderRadius: 12, background: fontSize === opt.id ? "#E0F7F4" : "white",
                        cursor: "pointer"
                      }}
                    >
                      <span style={{ fontSize: opt.size, fontWeight: 700, color: "#1a1a2e" }}>{opt.sample}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: fontSize === opt.id ? "#8B6914" : "#616161" }}>{opt.name}</span>
                      {fontSize === opt.id && (
                        <span style={{ color: "#2E7D32", fontSize: 20 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Provider Selection */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: "#1a1a2e", letterSpacing: 2, marginBottom: 12, fontWeight: 700 }}>📧 EMAIL PROVIDER</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#616161", marginBottom: 12 }}>
                  Choose which email app opens when you click "Send Email"
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { id: 'gmail', name: 'Gmail', icon: '📧', desc: 'Opens Gmail in browser' },
                    { id: 'outlook', name: 'Outlook', icon: '📬', desc: 'Opens Outlook.com' },
                    { id: 'apple', name: 'Apple Mail', icon: '✉️', desc: 'Opens default mail app' }
                  ].map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => saveEmailProvider(provider.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 18px", border: `3px solid ${emailProvider === provider.id ? "#00C9A7" : "#E2E8F0"}`,
                        borderRadius: 12, background: emailProvider === provider.id ? "#E0F7F4" : "white",
                        cursor: "pointer", textAlign: "left"
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{provider.icon}</span>
                      <div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: "#1a1a2e" }}>{provider.name}</div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#616161" }}>{provider.desc}</div>
                      </div>
                      {emailProvider === provider.id && (
                        <span style={{ marginLeft: "auto", color: "#2E7D32", fontSize: 20 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Info */}
              <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>ACCOUNT</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>
                  {profile?.firstName} {profile?.lastName}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>
                  {user?.email}
                </div>
                {profile?.companyName && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light, marginTop: 4 }}>
                    {profile.companyName}
                  </div>
                )}
              </div>

              {/* Chat History */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 12 }}>CHAT HISTORY</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{messages.length} messages saved</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light }}>Chat history persists across sessions</div>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm("Clear all chat history? This cannot be undone.")) {
                        setMessages([]);
                        localStorage.removeItem('reptrack-chat-history');
                      }
                    }}
                    style={{ padding: "6px 12px", background: C.redB, color: "white", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Clear Chat
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ width: "100%", padding: "12px 20px", background: C.gold, border: "none", borderRadius: 6, color: C.dark, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD BOOKING MODAL ═══ */}
      {showAddBookingModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: "#FF5A5F", padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                📅 Add Booking
              </h2>
              <button onClick={() => setShowAddBookingModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Property */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PROPERTY *</label>
                <select value={newBooking.propertyId} onChange={(e) => setNewBooking({...newBooking, propertyId: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }}>
                  <option value="">Select STR property...</option>
                  {strProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Platform */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>PLATFORM</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {STR_PLATFORMS.map(pl => (
                    <button key={pl.id} type="button" onClick={() => setNewBooking({...newBooking, platform: pl.id})}
                      style={{
                        flex: 1, padding: "10px", border: `2px solid ${newBooking.platform === pl.id ? pl.color : C.border}`,
                        borderRadius: 6, background: newBooking.platform === pl.id ? `${pl.color}20` : "white",
                        cursor: "pointer", textAlign: "center"
                      }}>
                      <div style={{ fontSize: 18 }}>{pl.icon}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.text, marginTop: 2 }}>{pl.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guest Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>GUEST NAME *</label>
                <input type="text" value={newBooking.guestName} onChange={(e) => setNewBooking({...newBooking, guestName: e.target.value})}
                  placeholder="John Smith"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>CHECK-IN</label>
                  <input type="date" value={newBooking.checkIn} onChange={(e) => setNewBooking({...newBooking, checkIn: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>CHECK-OUT</label>
                  <input type="date" value={newBooking.checkOut} onChange={(e) => setNewBooking({...newBooking, checkOut: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Guests & Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>GUESTS</label>
                  <input type="number" value={newBooking.guests} onChange={(e) => setNewBooking({...newBooking, guests: parseInt(e.target.value) || 1})}
                    min="1"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>TOTAL $</label>
                  <input type="number" value={newBooking.totalAmount} onChange={(e) => setNewBooking({...newBooking, totalAmount: e.target.value})}
                    placeholder="500"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowAddBookingModal(false)}
                  style={{ flex: 1, padding: "12px 20px", background: "white", border: `1px solid ${C.border}`, borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!newBooking.propertyId || !newBooking.guestName) return;
                    const booking = { id: uid(), ...newBooking };
                    setStrBookings(prev => [booking, ...prev]);
                    setShowAddBookingModal(false);
                    setNewBooking({ propertyId: "", guestName: "", platform: "airbnb", checkIn: "", checkOut: "", guests: 1, totalAmount: "", notes: "" });
                  }}
                  disabled={!newBooking.propertyId || !newBooking.guestName}
                  style={{ flex: 1, padding: "12px 20px", background: !newBooking.propertyId || !newBooking.guestName ? C.border : "#FF5A5F", border: "none", borderRadius: 4, color: "white", fontSize: 12, fontWeight: 600, cursor: !newBooking.propertyId || !newBooking.guestName ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Add Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD CLEANER MODAL ═══ */}
      {showAddCleanerModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 450, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.goldL, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>
                🧹 Add Cleaner
              </h2>
              <button onClick={() => setShowAddCleanerModal(false)} style={{
                background: "rgba(0,0,0,0.1)", border: "none", fontSize: 20, color: C.dark, 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>NAME *</label>
                <input type="text" value={newCleaner.name} onChange={(e) => setNewCleaner({...newCleaner, name: e.target.value})}
                  placeholder="Maria's Cleaning"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PHONE</label>
                  <input type="tel" value={newCleaner.phone} onChange={(e) => setNewCleaner({...newCleaner, phone: e.target.value})}
                    placeholder="(412) 555-1234"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>RATE $/TURNOVER</label>
                  <input type="number" value={newCleaner.rate} onChange={(e) => setNewCleaner({...newCleaner, rate: e.target.value})}
                    placeholder="75"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>EMAIL</label>
                <input type="email" value={newCleaner.email} onChange={(e) => setNewCleaner({...newCleaner, email: e.target.value})}
                  placeholder="cleaner@email.com"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowAddCleanerModal(false)}
                  style={{ flex: 1, padding: "12px 20px", background: "white", border: `1px solid ${C.border}`, borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!newCleaner.name) return;
                    const cleaner = { id: uid(), ...newCleaner };
                    setStrCleaners(prev => [...prev, cleaner]);
                    setShowAddCleanerModal(false);
                    setNewCleaner({ name: "", phone: "", email: "", rate: "", propertyIds: [] });
                  }}
                  disabled={!newCleaner.name}
                  style={{ flex: 1, padding: "12px 20px", background: !newCleaner.name ? C.border : C.gold, border: "none", borderRadius: 4, color: C.dark, fontSize: 12, fontWeight: 600, cursor: !newCleaner.name ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Add Cleaner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOG STR TIME MODAL ═══ */}
      {showLogSTRTimeModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 39, 66, 0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ 
              background: C.greenB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                ⏱️ Log STR Time
              </h2>
              <button onClick={() => setShowLogSTRTimeModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Property */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>PROPERTY</label>
                <select value={strTimeLog.propertyId} onChange={(e) => setStrTimeLog({...strTimeLog, propertyId: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }}>
                  <option value="">All STR Properties</option>
                  {strProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>ACTIVITY TYPE</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(IRS_CATEGORIES).filter(([k, v]) => v.isSTR).map(([key, cat]) => (
                    <button key={key} type="button" onClick={() => setStrTimeLog({...strTimeLog, category: key})}
                      style={{
                        padding: "10px", border: `2px solid ${strTimeLog.category === key ? C.greenB : C.border}`,
                        borderRadius: 6, background: strTimeLog.category === key ? C.greenPale : "white",
                        cursor: "pointer", textAlign: "left"
                      }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: C.dark }}>{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>DURATION (minutes)</label>
                <input type="number" value={strTimeLog.minutes} onChange={(e) => setStrTimeLog({...strTimeLog, minutes: e.target.value})}
                  placeholder="30"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>DESCRIPTION</label>
                <textarea value={strTimeLog.description} onChange={(e) => setStrTimeLog({...strTimeLog, description: e.target.value})}
                  placeholder="Responded to guest inquiry about check-in..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box", resize: "none" }} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowLogSTRTimeModal(false)}
                  style={{ flex: 1, padding: "12px 20px", background: "white", border: `1px solid ${C.border}`, borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!strTimeLog.minutes || parseInt(strTimeLog.minutes) <= 0) return;
                    const property = strProperties.find(p => p.id === strTimeLog.propertyId);
                    const category = IRS_CATEGORIES[strTimeLog.category];
                    const newEntry = {
                      id: uid(),
                      date: todayStr(),
                      qualifies: true,
                      category: strTimeLog.category,
                      categoryLabel: category?.label || "STR Activity",
                      activity: strTimeLog.description || `${category?.label} - STR`,
                      minutes: parseInt(strTimeLog.minutes),
                      property: property?.name || "STR General",
                      irsDescription: `Short-term rental ${category?.label.toLowerCase()}: ${strTimeLog.description || 'STR management activity'}. Property: ${property?.name || 'General STR'}.`
                    };
                    setLocalEntries(prev => [newEntry, ...prev]);
                    setShowLogSTRTimeModal(false);
                    setStrTimeLog({ propertyId: "", category: "guest_communication", minutes: "", description: "" });
                    
                    setMessages(prev => [...prev, {
                      role: "assistant", id: uid(),
                      content: `⏱️ **STR Time Logged!**\n\n• Activity: ${category?.label}\n• Duration: ${strTimeLog.minutes} minutes\n• Property: ${property?.name || "General STR"}\n\n✅ This counts toward your 750-hour REP requirement!`,
                      activityLogged: true
                    }]);
                  }}
                  disabled={!strTimeLog.minutes || parseInt(strTimeLog.minutes) <= 0}
                  style={{ flex: 1, padding: "12px 20px", background: !strTimeLog.minutes ? C.border : C.greenB, border: "none", borderRadius: 4, color: "white", fontSize: 12, fontWeight: 600, cursor: !strTimeLog.minutes ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Log Time
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ ROOT COMPONENT ════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D1B2A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00C9A7", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return user ? <MainApp /> : <AuthScreen />;
}
