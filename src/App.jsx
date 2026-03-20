import { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";

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
          localStorage.setItem('sb-user', JSON.stringify(data.user));
          // Save profile from user_metadata
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
  const { signIn, signUp } = useAuth();

  const inputStyle = { 
    width: "100%", padding: "12px 14px", fontSize: 14, 
    border: "1px solid #d4cfbd", borderRadius: 4, 
    background: "#faf8f4", color: "#0F2742", outline: "none", 
    fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" 
  };
  const labelStyle = { 
    display: "block", fontSize: 10, color: "#4D6785", 
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
        setMessage("Check your email to confirm your account!");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0F2742 0%, #1a3a5c 50%, #0F2742 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');`}</style>
      
      <div style={{ background: "#F7F5EA", borderRadius: 8, padding: "40px 36px", width: "100%", maxWidth: mode === "signup" ? 480 : 420, boxShadow: "0 25px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0F2742", fontFamily: "'Inter', sans-serif", letterSpacing: -1 }}>
            Rep<span style={{ color: "#C6A24A" }}>Track</span>
          </div>
          <div style={{ fontSize: 11, color: "#4D6785", letterSpacing: 2, textTransform: "uppercase", marginTop: 6 }}>Real Estate Professional Tracker</div>
        </div>

        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid #d4cfbd" }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setMessage(""); }}
              style={{ flex: 1, padding: "12px 0", background: "none", border: "none",
                borderBottom: mode === m ? "2px solid #C6A24A" : "2px solid transparent",
                color: mode === m ? "#C6A24A" : "#4D6785",
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
                        padding: "10px 12px", border: `2px solid ${jobType === job.id ? "#C6A24A" : "#d4cfbd"}`,
                        borderRadius: 6, background: jobType === job.id ? "#faf3dc" : "white",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s"
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{job.icon}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: "#0F2742" }}>
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

              <div style={{ borderTop: "1px solid #d4cfbd", margin: "20px 0", paddingTop: 16 }}>
                <div style={{ fontSize: 10, color: "#4D6785", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Account Credentials</div>
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
            {mode === "signup" && <div style={{ fontSize: 10, color: "#7a96b0", marginTop: 4 }}>Minimum 6 characters</div>}
          </div>

          {error && <div style={{ background: "#f5e4e4", border: "1px solid #993030", borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#7a1a1a" }}>{error}</div>}
          {message && <div style={{ background: "#e4f2ea", border: "1px solid #256b45", borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1a5c38" }}>{message}</div>}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "14px 20px", background: loading ? "#8a9aaa" : "#C6A24A", border: "none", borderRadius: 4, color: "#0F2742", fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #d4cfbd", textAlign: "center", fontSize: 11, color: "#7a96b0" }}>
          {mode === "login" ? (
            <>Don't have an account? <span onClick={() => setMode("signup")} style={{ color: "#C6A24A", cursor: "pointer" }}>Sign up</span></>
          ) : (
            <>Already have an account? <span onClick={() => setMode("login")} style={{ color: "#C6A24A", cursor: "pointer" }}>Log in</span></>
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

// HIGH CONTRAST COLORS - Accessible for 50+ vision
const C = {
  bg:"#FAFAF5", white:"#ffffff", dark:"#1a1a2e", darker:"#0d0d1a", text:"#1a1a2e",
  mid:"#3d3d5c", light:"#5a5a7a", lighter:"#8080a0", border:"#c0c0c0", borderL:"#e0e0e0",
  // High contrast gold - deeper, richer
  gold:"#8B6914", goldL:"#B8860B", goldPale:"#FFF8DC", goldBright:"#DAA520",
  // High contrast green - darker, bolder
  green:"#006400", greenPale:"#E8F5E9", greenB:"#228B22",
  // High contrast red - clear, unmistakable  
  red:"#B22222", redPale:"#FFEBEE", redB:"#DC143C",
  // High contrast blue - rich, readable
  blue:"#1E3A5F", bluePale:"#E3F2FD", blueB:"#1565C0",
  // Purple - bold
  purple:"#4B0082", purpleB:"#6A0DAD",
  // Orange - warm, visible
  orange:"#CC5500", orangePale:"#FFF3E0", orangeB:"#E65100",
};

const VIEWS = [
  { id:"assistant", icon:"◈", label:"Assistant" },
  { id:"dashboard", icon:"◉", label:"Dashboard" },
  { id:"records", icon:"⊟", label:"Records" },
  { id:"properties", icon:"⌂", label:"Properties" },
  { id:"tenants", icon:"👥", label:"Tenants" },
  { id:"vendors", icon:"🔧", label:"Vendors" },
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
const getSystemPrompt = (reHrs, rePct, entries, profile, properties) => `You are RepTrack AI, an intelligent Real Estate Professional (REP) tax documentation assistant. You help real estate investors document their activities to qualify for REP status under IRC §469(c)(7).

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

═══════════════════════════════════════════════════════════════════════════════
IRS-QUALIFYING RE CATEGORIES (IRC §469(c)(7))
═══════════════════════════════════════════════════════════════════════════════
✅ QUALIFIES as REP Work:
• Property Management - tenant relations, oversight, lease enforcement
• Maintenance & Repairs - coordinating repairs, supervising contractors
• Leasing - showings, tenant screening, lease prep, move-in/out
• Financial Management - rent collection, bookkeeping, P&L review
• Legal & Administrative - lease review, compliance, eviction process
• Vendor Coordination - contractor meetings, bids, supervising work
• Acquisition - property tours, due diligence, negotiations
• Construction - renovation oversight, permits, contractor coordination
• RE Travel - driving to properties for REP activities
• RE Education - courses, seminars specifically about real estate

❌ DOES NOT QUALIFY (Non-REPP Work Categories):
• w2_employment - W-2 Employment (regular job, employer work)
• self_employment - Self-Employment Non-REP (freelance, side business)
• consulting - Consulting Work (professional advisory)
• other_business - Other Business Income (non-REP business activities)

When logging NON-REPP work (like W-2 job hours), use category "w2_employment", "self_employment", "consulting", or "other_business" and set qualifies to false.

Example for non-REPP work:
[[SAVE_ACTIVITY:{"activity":"W-2 work shift","minutes":480,"category":"w2_employment","qualifies":false,"property":null,"irsDescription":null}]]
• Personal activities
• Investor activities (passive review of statements)

═══════════════════════════════════════════════════════════════════════════════
RED FLAGS - ALWAYS WARN ABOUT THESE
═══════════════════════════════════════════════════════════════════════════════
⚠️ WARN if:
• Single activity exceeds 4 hours (ask for breakdown)
• Vague descriptions without specific tasks
• No property mentioned for property-specific work
• Activities that sound passive (just "reviewing" without action)
• Round numbers (exactly 2 hours, 4 hours) - suggest more precision
• Activities that may not qualify being logged as REP work

EXAMPLE WARNING:
"⚠️ 6 hours for 'reviewing documents' seems high and vague. For audit protection:
• What specific documents? (leases, financials, applications?)
• Which properties?
• What decisions or actions resulted?
Can you break this down into specific tasks?"

═══════════════════════════════════════════════════════════════════════════════
OTHER CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════
• Draft professional emails to tenants, vendors, contractors
• Answer questions about REP requirements
• Explain IRS rules and documentation best practices
• Review logged activities for audit readiness
• Generate summary reports
• ADD NEW PROPERTIES to the portfolio
• ADD TENANTS to properties
• ADD VENDORS/CONTRACTORS
• Draft formal communications to tenants and vendors

═══════════════════════════════════════════════════════════════════════════════
ADDING PROPERTIES
═══════════════════════════════════════════════════════════════════════════════
When user wants to add a property (e.g., "Add my duplex at 123 Main St"), respond with:

🏠 **Property Added!**
• Address: [full address]
• Type: [single family / multi-family / commercial]
• Units: [number]
• Rent: $[amount]/mo

[[ADD_PROPERTY:{"address":"full address","type":"single_family|multi_family|commercial","units":1,"rent":0}]]

═══════════════════════════════════════════════════════════════════════════════
ADDING TENANTS
═══════════════════════════════════════════════════════════════════════════════
When user wants to add a tenant, respond with:

👤 **Tenant Added!**
• Name: [first] [last]
• Property: [property name] Unit [unit]
• Email: [email]
• Phone: [phone]

[[ADD_TENANT:{"firstName":"first","lastName":"last","email":"email","phone":"phone","propertyName":"property","unit":"A","leaseStart":"2024-01-01","leaseEnd":"2024-12-31","rent":1500}]]

═══════════════════════════════════════════════════════════════════════════════
ADDING VENDORS
═══════════════════════════════════════════════════════════════════════════════
When user wants to add a vendor/contractor, respond with:

🔧 **Vendor Added!**
• Company: [company name]
• Contact: [contact name]
• Category: [plumber/electrician/hvac/general_contractor/landscaper/handyman/roofer/cleaning/property_manager/other]
• Email: [email]
• Phone: [phone]

[[ADD_VENDOR:{"companyName":"company","contactName":"name","category":"plumber","email":"email","phone":"phone","notes":"optional notes"}]]

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
IRS §469(c)(7) - REP QUALIFICATION REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════
To qualify as a Real Estate Professional under IRC §469(c)(7):

1. MORE THAN 750 HOURS annually in real property trades or businesses
2. MORE THAN 50% of personal services performed must be in RE
3. MATERIAL PARTICIPATION in each rental property (or elect to aggregate)

Qualifying RE Activities Include:
✅ Development, redevelopment, construction, reconstruction
✅ Acquisition and conversion
✅ Rental, operation, and management
✅ Leasing and brokerage

Key Documentation Requirements:
• Contemporaneous time logs
• Detailed activity descriptions
• Property-specific records
• Third-party verification when possible

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT DISCLAIMERS
═══════════════════════════════════════════════════════════════════════════════
• You are NOT a tax advisor - remind users to consult their CPA
• You help with DOCUMENTATION only
• When in doubt about whether something qualifies, be conservative
• Always prioritize audit-defensible documentation`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp() {
  const { user, profile, signOut } = useAuth();
  const [view, setView] = useState("assistant");
  const [localEntries, setLocalEntries] = useState([]);
  const [localProperties, setLocalProperties] = useState([]);
  const [localTenants, setLocalTenants] = useState([]);
  const [localVendors, setLocalVendors] = useState([]);
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
  const [newProperty, setNewProperty] = useState({
    address: "", type: "single_family", units: 1, rent: "", purchaseDate: "",
    purchasePrice: "", downPayment: "", mortgagePayment: "", isSTR: false,
    taxes: "", insurance: "", hoa: "", utilities: "", maintenance: "", propertyMgmt: "", vacancyRate: "5",
    unitDetails: [] // Array of { unitName, beds, baths, rent }
  });
  
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

  // Load all data from Supabase
  const loadAllData = async () => {
    if (!user) return;
    setDataLoading(true);
    
    try {
      const headers = getAuthHeaders();
      
      // Load properties
      const propsRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=*&order=created_at.desc`, { headers });
      const propsData = await propsRes.json();
      if (Array.isArray(propsData)) {
        setLocalProperties(propsData.map(p => ({
          id: p.id, name: p.name, address: p.address, type: p.type,
          units: p.units, rent: p.rent, purchaseDate: p.purchase_date
        })));
      }
      
      // Load entries
      const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.desc,created_at.desc`, { headers });
      const entriesData = await entriesRes.json();
      if (Array.isArray(entriesData)) {
        setLocalEntries(entriesData.map(e => ({
          id: e.id, date: e.date, qualifies: e.qualifies, category: e.category,
          categoryLabel: e.category_label, activity: e.activity, minutes: e.minutes,
          property: e.property, irsDescription: e.irs_description
        })));
      }
      
      // Load tenants
      const tenantsRes = await fetch(`${SUPABASE_URL}/rest/v1/tenants?select=*&order=created_at.desc`, { headers });
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
      
      // Load vendors
      const vendorsRes = await fetch(`${SUPABASE_URL}/rest/v1/vendors?select=*&order=created_at.desc`, { headers });
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
          user_id: user.id, name: property.name, address: property.address,
          type: property.type, units: property.units, rent: property.rent,
          purchase_date: property.purchaseDate || null
        })
      });
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Error saving property:", err);
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
    
    setLocalProperties(prev => [...prev, property]);
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: getSystemPrompt(reHrs, rePct, localEntries, profile, localProperties),
          messages: [...messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content })), { role: "user", content: input.trim() }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const responseText = data.content[0].text;
      
      // Check for activity to save
      const activityData = parseActivityFromResponse(responseText);
      if (activityData) {
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
      }

      // Check for property data
      const propertyData = parsePropertyFromResponse(responseText);
      if (propertyData) {
        const newProperty = {
          name: propertyData.address.split(",")[0].trim(),
          address: propertyData.address,
          type: propertyData.type || "single_family",
          units: propertyData.units || 1,
          rent: propertyData.rent || 0,
          purchaseDate: propertyData.purchaseDate || null
        };
        // Save to Supabase
        const savedProp = await savePropertyToDb(newProperty);
        newProperty.id = savedProp?.id || uid();
        setLocalProperties(prev => [...prev, newProperty]);
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
    <div style={{ fontFamily: "Georgia, serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        /* ═══════════════════════════════════════════════════════════════════════
           VERY VISIBLE SCROLLBARS - Big, easy to see and grab
           ═══════════════════════════════════════════════════════════════════════ */
        
        /* Chrome, Safari, Edge scrollbars */
        ::-webkit-scrollbar { 
          width: 20px !important; 
          height: 20px !important; 
        }
        ::-webkit-scrollbar-track { 
          background: #e8e8e8 !important; 
          border-radius: 10px !important; 
          border: 2px solid #f5f5f5 !important;
          box-shadow: inset 0 0 5px rgba(0,0,0,0.1) !important;
        }
        ::-webkit-scrollbar-thumb { 
          background: linear-gradient(180deg, #B8860B 0%, #8B6914 100%) !important; 
          border-radius: 10px !important; 
          border: 3px solid #e8e8e8 !important;
          min-height: 80px !important;
        }
        ::-webkit-scrollbar-thumb:hover { 
          background: linear-gradient(180deg, #DAA520 0%, #B8860B 100%) !important;
          cursor: grab !important;
        }
        ::-webkit-scrollbar-thumb:active {
          cursor: grabbing !important;
        }
        ::-webkit-scrollbar-corner { 
          background: #e8e8e8 !important; 
        }
        
        /* Firefox scrollbar */
        * { 
          scrollbar-width: thick !important; 
          scrollbar-color: #B8860B #e8e8e8 !important; 
        }
        
        /* Ensure scrolling is enabled everywhere */
        html, body { 
          overflow-y: auto !important; 
          overflow-x: hidden !important;
        }
        
        /* Main app scrollable area */
        .main-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: calc(100vh - 90px) !important;
          padding-right: 10px !important;
        }
        
        /* Modal scrollable content */
        .modal-scroll { 
          overflow-y: auto !important; 
          overflow-x: hidden !important;
          max-height: 65vh !important;
          padding-right: 15px !important;
        }
        
        /* Tab content scrollable */
        .tab-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: calc(100vh - 150px) !important;
          padding-right: 10px !important;
          padding-bottom: 60px !important;
        }
        
        /* Card content scrollable */
        .card-scroll {
          overflow-y: auto !important;
          max-height: 400px !important;
          padding-right: 10px !important;
        }
        
        .nav-item { display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 18px; cursor:pointer; border:none; background:none; border-bottom:2px solid transparent; transition:all .15s; color:#6a5830; }
        .nav-item:hover { color:#e8c870; }
        .nav-item.active { color:#e8c870; border-bottom-color:#C6A24A; }
        .card { background:#fff; border:1px solid ${C.border}; border-radius:3px; padding:20px; }
        .btn-gold { background:#C6A24A; border:none; color:#0F2742; font-weight:600; padding:10px 22px; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; border-radius:2px; }
        .btn-outline { background:#fff; border:1px solid ${C.border}; color:${C.mid}; padding:9px 18px; font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; border-radius:2px; }
        .msg-bubble { max-width: 85%; padding: 14px 18px; border-radius: 12px; margin-bottom: 12px; }
        .msg-user { background: ${C.dark}; color: ${C.goldBright}; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg-assistant { background: white; border: 1px solid ${C.border}; color: ${C.text}; margin-right: auto; border-bottom-left-radius: 4px; }
        .msg-logged { border-left: 3px solid ${C.greenB}; }
        .progress-ring { transform: rotate(-90deg); }
      `}</style>

      {/* Header - LIGHT & ACCESSIBLE */}
      <header style={{ background: "#FFFFFF", borderBottom: "3px solid #B8860B", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ padding: "14px 0" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Inter', sans-serif" }}>
                Rep<span style={{ color: "#B8860B" }}>Track</span>
              </span>
            </div>
            <nav style={{ display: "flex", gap: 4 }}>
              {VIEWS.map(v => (
                <button 
                  key={v.id} 
                  onClick={() => setView(v.id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "12px 20px", border: "none", cursor: "pointer",
                    background: view === v.id ? "#FFF8DC" : "transparent",
                    borderBottom: view === v.id ? "4px solid #B8860B" : "4px solid transparent",
                    borderRadius: "8px 8px 0 0",
                    transition: "all 0.2s"
                  }}
                >
                  <span style={{ fontSize: 22 }}>{v.icon}</span>
                  <span style={{ 
                    fontFamily: "'Inter', sans-serif", 
                    fontSize: 14, 
                    fontWeight: view === v.id ? 700 : 500,
                    color: view === v.id ? "#8B6914" : "#424242",
                    letterSpacing: 0.5
                  }}>{v.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#1a1a2e", fontWeight: 600 }}>{displayName}</div>
              {profile?.companyName && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#616161" }}>{profile.companyName}</div>
              )}
            </div>
            <button onClick={() => setShowSettingsModal(true)} style={{ background: "#f5f5f5", border: "2px solid #e0e0e0", fontSize: 24, cursor: "pointer", padding: "8px 12px", borderRadius: 8 }} title="Settings">⚙️</button>
            <button onClick={signOut} style={{ padding: "10px 20px", fontSize: 14, color: "#616161", background: "#f5f5f5", border: "2px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Log Out</button>
          </div>
        </div>
      </header>

      {/* Main Content - SCROLLABLE */}
      <main className="main-scroll" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px", overflowY: "auto", maxHeight: "calc(100vh - 90px)" }}>
        
        {/* ASSISTANT VIEW */}
        {view === "assistant" && (
          <div style={{ display: "flex", gap: 24, height: "calc(100vh - 140px)" }}>
            {/* Chat Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>AI Documentation Assistant</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>Powered by Claude • IRS-compliant activity logging • Smart documentation</p>
              </div>

              {/* Messages */}
              <div className="card" style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column" }}>
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-assistant"} ${msg.activityLogged ? "msg-logged" : ""}`}>
                    {msg.activityLogged && (
                      <div style={{ fontSize: 10, color: C.green, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>✓</span> ACTIVITY SAVED TO RECORDS
                      </div>
                    )}
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="msg-bubble msg-assistant">
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.light }}>
                      🔍 Analyzing activity and generating IRS documentation...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "flex-end" }}>
                {/* File Upload Button */}
                <label style={{ 
                  padding: "14px 16px", background: "#f5f5f5", border: `1px solid ${C.border}`,
                  borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#eee"}
                onMouseOut={(e) => e.currentTarget.style.background = "#f5f5f5"}
                title="Upload document (mortgage statement, lease, etc.)"
                >
                  <span style={{ fontSize: 18 }}>📎</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" style={{ display: "none" }} 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setInput(prev => prev + `\n\n[Uploaded: ${file.name}]\nPlease analyze this document and extract relevant property/financial information.`);
                        };
                        reader.readAsDataURL(file);
                        // Note: Full file processing would require backend integration
                        setMessages(prev => [...prev, {
                          role: "assistant", id: uid(),
                          content: `📎 **Document Received: ${file.name}**\n\nI noticed you uploaded a document. While I can't directly read file contents in this interface, you can:\n\n1. **Copy/paste** the key information from your mortgage statement\n2. **Tell me** the details like:\n   - Monthly mortgage payment\n   - Purchase price\n   - Down payment amount\n   - Interest rate\n\nI'll help you add it to your property records!`
                        }]);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your activity or paste mortgage/property info... (Press Enter to send)"
                  style={{
                    flex: 1, padding: "14px 16px", fontSize: 14, border: `1px solid ${C.border}`,
                    borderRadius: 8, background: "white", color: C.text, outline: "none", resize: "none",
                    fontFamily: "'IBM Plex Mono', monospace", minHeight: 56
                  }}
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-gold" style={{ padding: "14px 24px", opacity: loading || !input.trim() ? 0.5 : 1 }}>
                  Send
                </button>
              </div>

              {/* Quick Actions */}
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  "I spent 2 hours on property management",
                  "Log a 45-min contractor meeting", 
                  "I showed a rental unit for 1 hour",
                  "What qualifies as REP work?",
                ].map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{
                    background: "white", border: `1px solid ${C.border}`, borderRadius: 20,
                    padding: "6px 14px", fontSize: 11, color: C.mid, cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>
                    {q}
                  </button>
                ))}
                <button 
                  onClick={() => setShowNonREModal(true)} 
                  style={{
                    background: C.redPale, border: `1px solid ${C.redB}`, borderRadius: 20,
                    padding: "6px 14px", fontSize: 11, color: C.red, cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600
                  }}>
                  ➕ Log Non-REPP Hours
                </button>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Main Hours Comparison Card */}
              <div className="card" style={{ padding: 20, border: `2px solid ${C.goldL}` }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: C.dark, letterSpacing: 1 }}>
                    🏠 REAL ESTATE PROFESSIONAL
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, marginTop: 4 }}>
                    IRS Status Tracker
                  </div>
                </div>

                {/* REP vs Non-REPP Side by Side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {/* REP Hours - Clickable */}
                  <div 
                    onClick={() => setShowREPDetailModal(true)}
                    style={{ background: C.greenPale, borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${C.greenB}`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,107,69,0.2)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ fontSize: 11, color: C.green, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginBottom: 6 }}>
                      ✅ REP HOURS
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.green }}>
                      {reHrs}h
                    </div>
                    <div style={{ fontSize: 10, color: C.mid, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
                      REP Work
                    </div>
                    <div style={{ fontSize: 9, color: C.green, fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 }}>
                      
                    </div>
                  </div>

                  {/* Non-REPP Hours - Clickable */}
                  <div 
                    onClick={() => setShowNonREPDetailModal(true)}
                    style={{ background: C.redPale, borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${C.redB}`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(153,48,48,0.2)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ fontSize: 11, color: C.red, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginBottom: 6 }}>
                      💼 NON-REP JOBP
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.red }}>
                      {nonREHrs}h
                    </div>
                    <div style={{ fontSize: 10, color: C.mid, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
                      W-2 or 1099 Job
                    </div>
                    <div style={{ fontSize: 9, color: C.red, fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 }}>
                      
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.mid }}>REP Percentage</span>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: rePct > 50 ? C.green : C.red }}>
                      {rePct.toFixed(0)}% {rePct > 50 ? "✓" : "⚠️"}
                    </span>
                  </div>
                  <div style={{ height: 12, background: C.redPale, borderRadius: 6, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${Math.min(rePct, 100)}%`, background: C.greenB, borderRadius: 6, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>RE: {rePct.toFixed(0)}%</span>
                    <span style={{ fontSize: 9, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>Non-REP: {(100-rePct).toFixed(0)}%</span>
                  </div>
                </div>

                {/* 750 Hour Progress */}
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
                      Need {hoursNeeded}h more • {hoursPerWeek}h/week
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

              {/* IRS Requirements Checklist */}
              <div className="card" style={{ background: rePct > 50 && reHrs >= 750 ? C.greenPale : C.goldPale, border: `1px solid ${rePct > 50 && reHrs >= 750 ? C.greenB : C.gold}`, padding: 14 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: rePct > 50 && reHrs >= 750 ? C.green : C.gold, letterSpacing: 2, marginBottom: 10 }}>
                  {rePct > 50 && reHrs >= 750 ? "✅ REP QUALIFIED" : "📋 REP REQUIREMENTS"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, lineHeight: 1.8 }}>
                  <div>{reHrs >= 750 ? "✅" : "⬜"} 750+ hours in REP activities</div>
                  <div>{rePct > 50 ? "✅" : "⬜"} REP work {">"} 50% of total</div>
                  <div>⬜ Material participation</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === "dashboard" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                  Dashboard {profile?.firstName && <span style={{ fontWeight: 400, color: C.light }}>— {profile.firstName}</span>}
                </h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{profile?.companyName || 'Track your real estate professional status'}</p>
              </div>
              {/* Year Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                <button onClick={exportPDFForCPA} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}>
                  📄 Export PDF for CPA
                </button>
              </div>
            </div>
            
            <div className="card" style={{ padding: 0, maxHeight: "calc(100vh - 220px)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 140px 70px", padding: "12px 16px", background: "#f5f0e8", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                {["Date", "Type", "Activity & IRS Documentation", "Category", "Time"].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {localEntries.map(e => (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 140px 70px", padding: "14px 16px", borderBottom: `1px solid ${C.borderL}`, alignItems: "start" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>{e.date}</div>
                    <div><span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "RE" : "Non-REP"}</span></div>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text, marginBottom: 4 }}>{e.activity}</div>
                      {e.irsDescription && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid, padding: "6px 8px", background: "#f8f6f0", borderRadius: 3, borderLeft: `2px solid ${C.goldL}` }}>
                          <strong style={{ color: C.gold }}>IRS Doc:</strong> {e.irsDescription}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>{e.categoryLabel}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.gold, fontWeight: 600 }}>{fmtH(e.minutes)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROPERTIES VIEW */}
        {view === "properties" && (
          <div className="tab-scroll" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Properties</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>
                  {localProperties.length} properties • {strProperties.length} STR • {ltrProperties.length} Long-Term
                </p>
              </div>
              <button 
                onClick={() => setShowAddPropertyModal(true)}
                className="btn-gold"
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, padding: "14px 24px" }}
              >
                ➕ Add Property
              </button>
            </div>

            {/* Portfolio Summary - LARGE & ACCESSIBLE */}
            {localProperties.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid ${C.greenB}`, background: "#E8F5E9" }}>
                  <div style={{ fontSize: 16, color: "#1B5E20", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>💰 RENT</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#1B5E20", fontFamily: "'Inter', sans-serif" }}>
                    ${localProperties.reduce((s, p) => s + (p.rent || 0), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 16, color: "#2E7D32", marginTop: 6, fontWeight: 500 }}>per month</div>
                </div>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid ${C.orangeB}`, background: "#FFF3E0" }}>
                  <div style={{ fontSize: 16, color: "#E65100", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>📊 EXPENSES</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#E65100", fontFamily: "'Inter', sans-serif" }}>
                    ${localProperties.reduce((s, p) => s + (p.totalExpenses || 0), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 16, color: "#F57C00", marginTop: 6, fontWeight: 500 }}>per month</div>
                </div>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid ${C.redB}`, background: "#FFEBEE" }}>
                  <div style={{ fontSize: 16, color: "#B71C1C", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>🏦 MORTGAGE</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#B71C1C", fontFamily: "'Inter', sans-serif" }}>
                    ${localProperties.reduce((s, p) => s + (p.mortgagePayment || 0), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 16, color: "#C62828", marginTop: 6, fontWeight: 500 }}>per month</div>
                </div>
              </div>
            )}
            
            {/* Performance Metrics - LARGE & ACCESSIBLE */}
            {localProperties.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid ${(() => {
                  const cf = localProperties.reduce((s, p) => {
                    const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                    return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                  }, 0);
                  return cf >= 0 ? "#2E7D32" : "#C62828";
                })()}`, background: (() => {
                  const cf = localProperties.reduce((s, p) => {
                    const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                    return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                  }, 0);
                  return cf >= 0 ? "#E8F5E9" : "#FFEBEE";
                })() }}>
                  <div style={{ fontSize: 16, color: (() => {
                    const cf = localProperties.reduce((s, p) => {
                      const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                      return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                    }, 0);
                    return cf >= 0 ? "#1B5E20" : "#B71C1C";
                  })(), letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>💵 CASH FLOW</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: (() => {
                    const cf = localProperties.reduce((s, p) => {
                      const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                      return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                    }, 0);
                    return cf >= 0 ? "#1B5E20" : "#B71C1C";
                  })(), fontFamily: "'Inter', sans-serif" }}>
                    {(() => {
                      const cf = localProperties.reduce((s, p) => {
                        const er = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                        return s + er - (p.totalExpenses || 0) - (p.mortgagePayment || 0);
                      }, 0);
                      return (cf >= 0 ? '+$' : '-$') + Math.abs(Math.round(cf)).toLocaleString();
                    })()}
                  </div>
                  <div style={{ fontSize: 16, color: "#424242", marginTop: 6, fontWeight: 500 }}>per month</div>
                </div>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid #B8860B`, background: "#FFF8DC" }}>
                  <div style={{ fontSize: 16, color: "#8B6914", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>📈 CAP RATE</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#8B6914", fontFamily: "'Inter', sans-serif" }}>
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
                  <div style={{ fontSize: 16, color: "#A67C00", marginTop: 6, fontWeight: 500 }}>annual return</div>
                </div>
                <div className="card" style={{ padding: 24, borderLeft: `8px solid #1565C0`, background: "#E3F2FD" }}>
                  <div style={{ fontSize: 16, color: "#0D47A1", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>🎯 10-YR NPV</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: (() => {
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
                    return npv >= 0 ? "#0D47A1" : "#B71C1C";
                  })(), fontFamily: "'Inter', sans-serif" }}>
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
                  <div style={{ fontSize: 16, color: "#1976D2", marginTop: 6, fontWeight: 500 }}>future value</div>
                </div>
              </div>
            )}

            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 400px)", paddingRight: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {localProperties.map(p => {
                  // Calculate with actual expenses
                  const effectiveRent = (p.rent || 0) * (1 - (p.vacancyRate || 0) / 100);
                  const noi = effectiveRent - (p.totalExpenses || 0);
                  const cashFlow = noi - (p.mortgagePayment || 0);
                  const isPositive = cashFlow >= 0;
                  const capRate = p.purchasePrice && p.rent ? ((noi * 12) / p.purchasePrice * 100) : null;
                  const cashOnCash = p.downPayment && cashFlow ? ((cashFlow * 12) / p.downPayment * 100) : null;
                  
                  // NPV Calculation (10-year horizon, 8% discount rate, 3% annual appreciation)
                  const discountRate = 0.08;
                  const appreciationRate = 0.03;
                  const holdingPeriod = 10; // years
                  const annualCashFlow = cashFlow * 12;
                  let npv = -(p.downPayment || 0); // Initial investment (negative)
                  
                  if (p.downPayment && p.purchasePrice) {
                    for (let year = 1; year <= holdingPeriod; year++) {
                      const yearCashFlow = annualCashFlow * Math.pow(1.02, year - 1);
                      npv += yearCashFlow / Math.pow(1 + discountRate, year);
                    }
                    const futureValue = (p.purchasePrice || 0) * Math.pow(1 + appreciationRate, holdingPeriod);
                    const equityAtSale = futureValue * 0.94;
                  npv += equityAtSale / Math.pow(1 + discountRate, holdingPeriod);
                }
                const npvPositive = npv >= 0;
                
                return (
                  <div 
                    key={p.id} 
                    className="card" 
                    onClick={() => setShowPropertyDetailModal(p)}
                    style={{ 
                      borderLeft: `8px solid ${isPositive ? "#2E7D32" : "#C62828"}`, 
                      cursor: "pointer",
                      transition: "transform 0.15s, box-shadow 0.15s",
                      padding: 24
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.01)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Property Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>{p.name}</span>
                        {p.isSTR ? (
                          <span style={{ padding: "6px 12px", background: "#D32F2F", color: "white", fontFamily: "'Inter', sans-serif", fontSize: 14, borderRadius: 6, fontWeight: 700 }}>STR</span>
                        ) : (
                          <span style={{ padding: "6px 12px", background: "#1565C0", color: "white", fontFamily: "'Inter', sans-serif", fontSize: 14, borderRadius: 6, fontWeight: 700 }}>LTR</span>
                        )}
                      </div>
                      <span style={{ padding: "6px 12px", background: "#f5f5f5", border: "2px solid #e0e0e0", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#424242", borderRadius: 6, fontWeight: 600 }}>{p.type?.replace("_", " ") || "Property"}</span>
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#616161", marginBottom: 20 }}>{p.address}</div>
                    
                    {/* Financial Summary - LARGE & ACCESSIBLE */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                      <div style={{ background: "#E8F5E9", padding: 16, borderRadius: 8 }}>
                        <div style={{ fontSize: 14, color: "#2E7D32", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>RENT</div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, color: "#1B5E20", fontWeight: 700 }}>${(p.rent || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ background: isPositive ? "#E8F5E9" : "#FFEBEE", padding: 16, borderRadius: 8 }}>
                        <div style={{ fontSize: 14, color: isPositive ? "#2E7D32" : "#C62828", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>CASH FLOW</div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, color: isPositive ? "#1B5E20" : "#B71C1C", fontWeight: 700 }}>
                          {isPositive ? "+" : ""}${Math.round(cashFlow).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expenses Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                      <div style={{ background: "#FFF3E0", padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: "#E65100", fontWeight: 600 }}>EXPENSES</div>
                        <div style={{ fontSize: 22, color: "#E65100", fontWeight: 700 }}>${(p.totalExpenses || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ background: "#FFEBEE", padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: "#C62828", fontWeight: 600 }}>MORTGAGE</div>
                        <div style={{ fontSize: 22, color: "#B71C1C", fontWeight: 700 }}>${(p.mortgagePayment || 0).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* ROI Metrics - LARGE & ACCESSIBLE */}
                    {(capRate || cashOnCash || (p.downPayment && p.purchasePrice)) && (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                        {capRate && (
                          <div style={{ padding: "10px 16px", background: "#FFF8DC", borderRadius: 8, border: "2px solid #B8860B" }}>
                            <span style={{ fontSize: 14, color: "#8B6914", fontWeight: 600 }}>CAP RATE </span>
                            <span style={{ fontSize: 20, color: "#8B6914", fontWeight: 800 }}>{capRate.toFixed(1)}%</span>
                          </div>
                        )}
                        {cashOnCash && (
                          <div style={{ padding: "10px 16px", background: isPositive ? "#E8F5E9" : "#FFEBEE", borderRadius: 8, border: `2px solid ${isPositive ? "#2E7D32" : "#C62828"}` }}>
                            <span style={{ fontSize: 14, color: isPositive ? "#1B5E20" : "#B71C1C", fontWeight: 600 }}>CoC </span>
                            <span style={{ fontSize: 20, color: isPositive ? "#1B5E20" : "#B71C1C", fontWeight: 800 }}>{cashOnCash.toFixed(1)}%</span>
                          </div>
                        )}
                        {p.downPayment && p.purchasePrice && (
                          <div style={{ padding: "10px 16px", background: npvPositive ? "#E3F2FD" : "#FFEBEE", borderRadius: 8, border: `2px solid ${npvPositive ? "#1565C0" : "#C62828"}` }}>
                            <span style={{ fontSize: 14, color: npvPositive ? "#0D47A1" : "#B71C1C", fontWeight: 600 }}>10yr NPV </span>
                            <span style={{ fontSize: 20, color: npvPositive ? "#0D47A1" : "#B71C1C", fontWeight: 800 }}>
                              {npvPositive ? "+" : ""}${Math.round(npv / 1000)}K
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hours logged for this property */}
                    {repByProperty[p.name] && (
                      <div style={{ paddingTop: 12, borderTop: "2px solid #e0e0e0" }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#2E7D32", fontWeight: 600 }}>
                          ✅ {(repByProperty[p.name].minutes / 60).toFixed(1)} hours logged • {repByProperty[p.name].count} activities
                        </div>
                      </div>
                    )}

                    {/* STR Platforms if STR */}
                    {p.isSTR && p.platforms && p.platforms.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        {p.platforms.map(pl => {
                          const platform = STR_PLATFORMS.find(s => s.id === pl);
                          return platform ? (
                            <span key={pl} style={{ fontSize: 12 }} title={platform.name}>{platform.icon}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Add Property Card */}
              <div 
                onClick={() => setShowAddPropertyModal(true)}
                className="card" 
                style={{ 
                  borderLeft: `4px solid ${C.border}`, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", 
                  justifyContent: "center", minHeight: 180, background: "#fafafa",
                  transition: "all 0.15s"
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderLeftColor = C.gold; e.currentTarget.style.background = "#faf8f4"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderLeftColor = C.border; e.currentTarget.style.background = "#fafafa"; }}
              >
                <div style={{ fontSize: 32, color: C.light, marginBottom: 8 }}>🏠</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>Add New Property</div>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          </div>
        )}
      </main>

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
                        padding: "16px", border: `3px solid ${fontSize === opt.id ? "#B8860B" : "#e0e0e0"}`,
                        borderRadius: 12, background: fontSize === opt.id ? "#FFF8DC" : "white",
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
                        padding: "14px 18px", border: `3px solid ${emailProvider === provider.id ? "#B8860B" : "#e0e0e0"}`,
                        borderRadius: 12, background: emailProvider === provider.id ? "#FFF8DC" : "white",
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
      <div style={{ minHeight: "100vh", background: "#0F2742", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#C6A24A", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return user ? <MainApp /> : <AuthScreen />;
}
