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
            data: options?.data || {}
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
  // RE Qualifying Categories
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

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_PROPERTIES = [
  { id:"p1", name:"Oak Street Duplex", address:"123 Oak St, Pittsburgh PA 15213", type:"multi_family", units:2, rent:3400 },
  { id:"p2", name:"Downtown Studio", address:"88 Fifth Ave #4C, Pittsburgh PA 15219", type:"single_family", units:1, rent:1650 },
  { id:"p3", name:"Squirrel Hill 4-Plex", address:"501 Murray Ave, Pittsburgh PA 15217", type:"multi_family", units:4, rent:6800 },
  { id:"p4", name:"Lawrenceville Commercial", address:"4200 Butler St, Pittsburgh PA 15201", type:"commercial", units:1, rent:4200 },
];

const SAMPLE_ENTRIES = [
  { id:"e1", date:"2024-11-01", qualifies:true, category:"management", categoryLabel:"Property Management", activity:"Called tenant re maintenance request — Oak St Unit A", minutes:30, irsDescription: "Coordinated tenant maintenance request for Oak Street Duplex Unit A. Documented issue, contacted service provider, and followed up with tenant on resolution timeline." },
  { id:"e2", date:"2024-11-01", qualifies:false, category:"non_re", categoryLabel:"Non-REPP Work", activity:"W-2 work shift", minutes:480, irsDescription: null },
  { id:"e3", date:"2024-11-02", qualifies:true, category:"maintenance", categoryLabel:"Maintenance & Repairs", activity:"Supervised plumber — Oak St hot water heater repair", minutes:90, irsDescription: "On-site supervision of licensed plumber performing hot water heater replacement at Oak Street Duplex. Verified work quality, approved invoice, and documented repair for property records." },
  { id:"e4", date:"2024-11-04", qualifies:true, category:"leasing", categoryLabel:"Leasing", activity:"Showed vacant unit — Downtown Studio #4C", minutes:120, irsDescription: "Conducted property showing for prospective tenant at Downtown Studio Unit 4C. Discussed lease terms, property features, and tenant requirements. Collected rental application." },
  { id:"e5", date:"2024-11-05", qualifies:true, category:"financial", categoryLabel:"Financial Management", activity:"Reviewed monthly rent rolls and P&L", minutes:75, irsDescription: "Monthly financial review for rental portfolio. Analyzed rent collection status, reviewed profit and loss statements, and reconciled property expenses across all units." },
];

const fmtH = (m) => { const h=Math.floor(m/60),mn=m%60; return !h&&!mn?"0h":`${h>0?h+"h":""}${mn>0?" "+mn+"m":""}`.trim(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const todayStr = () => new Date().toISOString().split("T")[0];

const C = {
  bg:"#F7F5EA", white:"#ffffff", dark:"#0F2742", darker:"#091e33", text:"#0F2742",
  mid:"#2d4a6a", light:"#4D6785", lighter:"#7a96b0", border:"#d4cfbd", borderL:"#e8e4d4",
  gold:"#9a7830", goldL:"#C6A24A", goldPale:"#faf3dc", goldBright:"#e8c870",
  green:"#1a5c38", greenPale:"#e4f2ea", greenB:"#256b45",
  red:"#7a1a1a", redPale:"#f5e4e4", redB:"#993030",
  blue:"#2d4f6e", bluePale:"#e4edf5", blueB:"#3d6080",
  purple:"#3a2060", purpleB:"#5a3a90",
  orange:"#8a5a20", orangePale:"#fdf4e4", orangeB:"#b87820",
};

const VIEWS = [
  { id:"assistant", icon:"◈", label:"Assistant" },
  { id:"dashboard", icon:"◉", label:"Dashboard" },
  { id:"records", icon:"⊟", label:"Records" },
  { id:"properties", icon:"⌂", label:"Properties" },
  { id:"tenants", icon:"👥", label:"Tenants" },
  { id:"vendors", icon:"🔧", label:"Vendors" },
];

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

// Sample tenants
const SAMPLE_TENANTS = [
  { 
    id: "t1", 
    firstName: "John", 
    lastName: "Smith", 
    email: "john.smith@email.com", 
    phone: "(412) 555-1234",
    propertyId: "p1",
    propertyName: "Oak Street Duplex",
    unit: "A",
    leaseStart: "2024-01-01",
    leaseEnd: "2024-12-31",
    rent: 1700,
    dob: "1985-03-15",
    hasInsurance: true,
    bio: "Works in tech, quiet tenant. Has a small dog (approved).",
    deductible: 250,
    latePayments: 0
  },
  { 
    id: "t2", 
    firstName: "Sarah", 
    lastName: "Johnson", 
    email: "sarah.j@email.com", 
    phone: "(412) 555-5678",
    propertyId: "p1",
    propertyName: "Oak Street Duplex",
    unit: "B",
    leaseStart: "2024-03-01",
    leaseEnd: "2025-02-28",
    rent: 1700,
    dob: "1990-07-22",
    hasInsurance: true,
    bio: "Nurse at UPMC. Very responsible tenant.",
    deductible: 250,
    latePayments: 1
  },
];

// Sample vendors
const SAMPLE_VENDORS = [
  {
    id: "v1",
    companyName: "Pittsburgh Plumbing Pros",
    contactName: "Mike Wilson",
    category: "plumber",
    email: "mike@pghplumbing.com",
    phone: "(412) 555-9876",
    city: "Pittsburgh",
    propertyIds: ["p1", "p3"],
    serviceHistory: ["Oak Street Duplex - Water heater 2024", "Squirrel Hill 4-Plex - Pipe repair 2024"],
    notes: "24/7 emergency service available"
  },
  {
    id: "v2",
    companyName: "Sparks Electric LLC",
    contactName: "Tom Garcia",
    category: "electrician",
    email: "tom@sparkselectric.com",
    phone: "(412) 555-4321",
    city: "Pittsburgh",
    propertyIds: ["p1", "p2", "p3", "p4"],
    serviceHistory: ["Oak Street Duplex - Panel upgrade 2023", "Downtown Studio - Outlet repair 2024"],
    notes: "Licensed and insured"
  },
];

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
  const [localEntries, setLocalEntries] = useState(SAMPLE_ENTRIES);
  const [localProperties, setLocalProperties] = useState(SAMPLE_PROPERTIES);
  const [localTenants, setLocalTenants] = useState(SAMPLE_TENANTS);
  const [localVendors, setLocalVendors] = useState(SAMPLE_VENDORS);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Quick-add non-REP modal state
  const [showNonREModal, setShowNonREModal] = useState(false);
  const [nonRECategory, setNonRECategory] = useState("w2_employment");
  const [nonREHours, setNonREHours] = useState("");
  const [nonREDescription, setNonREDescription] = useState("");

  // Detail modals
  const [showREPDetailModal, setShowREPDetailModal] = useState(false);
  const [showNonREPDetailModal, setShowNonREPDetailModal] = useState(false);

  // Property modals
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showPropertyDetailModal, setShowPropertyDetailModal] = useState(null);
  const [newProperty, setNewProperty] = useState({
    address: "", type: "single_family", units: 1, rent: "", purchaseDate: ""
  });

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

  // Copy to clipboard helper
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  // Add tenant function
  const addTenant = () => {
    if (!newTenant.firstName.trim() || !newTenant.lastName.trim()) return;
    
    const property = localProperties.find(p => p.id === newTenant.propertyId);
    const tenant = {
      id: uid(),
      ...newTenant,
      propertyName: property?.name || "Unknown",
      rent: parseInt(newTenant.rent) || 0
    };
    
    setLocalTenants(prev => [...prev, tenant]);
    setShowAddTenantModal(false);
    setNewTenant({ firstName: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", leaseStart: "", leaseEnd: "", rent: "", dob: "", hasInsurance: false });
    
    setMessages(prev => [...prev, {
      role: "assistant", id: uid(),
      content: `👤 **Tenant Added!**\n\n• Name: ${tenant.firstName} ${tenant.lastName}\n• Property: ${tenant.propertyName}${tenant.unit ? ` Unit ${tenant.unit}` : ""}\n• Email: ${tenant.email}\n• Phone: ${tenant.phone}`,
      activityLogged: true
    }]);
  };

  // Add vendor function
  const addVendor = () => {
    if (!newVendor.companyName.trim()) return;
    
    const vendor = {
      id: uid(),
      ...newVendor
    };
    
    setLocalVendors(prev => [...prev, vendor]);
    setShowAddVendorModal(false);
    setNewVendor({ companyName: "", contactName: "", category: "plumber", email: "", phone: "", propertyIds: [], notes: "" });
    
    const categoryLabel = VENDOR_CATEGORIES.find(c => c.id === vendor.category)?.label || vendor.category;
    setMessages(prev => [...prev, {
      role: "assistant", id: uid(),
      content: `🔧 **Vendor Added!**\n\n• Company: ${vendor.companyName}\n• Contact: ${vendor.contactName}\n• Category: ${categoryLabel}\n• Email: ${vendor.email}\n• Phone: ${vendor.phone}`,
      activityLogged: true
    }]);
  };

  // Add property function
  const addProperty = () => {
    if (!newProperty.address.trim()) return;
    
    const property = {
      id: uid(),
      name: newProperty.address.split(",")[0].trim(),
      address: newProperty.address.trim(),
      type: newProperty.type,
      units: parseInt(newProperty.units) || 1,
      rent: parseInt(newProperty.rent) || 0,
      purchaseDate: newProperty.purchaseDate || null
    };
    
    setLocalProperties(prev => [...prev, property]);
    setShowAddPropertyModal(false);
    setNewProperty({ address: "", type: "single_family", units: 1, rent: "", purchaseDate: "" });
    
    // Confirmation in chat
    setMessages(prev => [...prev, {
      role: "assistant",
      id: uid(),
      content: `🏠 **Property Added!**\n\n• Address: ${property.address}\n• Type: ${property.type.replace("_", " ")}\n• Units: ${property.units}\n• Rent: $${property.rent.toLocaleString()}/mo\n\nYou can now log REP hours for this property!`,
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
  const addNonREHours = () => {
    if (!nonREHours || parseFloat(nonREHours) <= 0) return;
    
    const minutes = Math.round(parseFloat(nonREHours) * 60);
    const category = IRS_CATEGORIES[nonRECategory];
    
    const newEntry = {
      id: uid(),
      date: todayStr(),
      qualifies: false,
      category: nonRECategory,
      categoryLabel: category?.label || "Non-REPP Work",
      activity: nonREDescription || `${category?.label || "Non-REPP work"} - ${nonREHours} hours`,
      minutes: minutes,
      property: null,
      irsDescription: null
    };
    
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

  // Initialize welcome message with profile
  useEffect(() => {
    if (profile && messages.length === 0) {
      const reEntries = SAMPLE_ENTRIES.filter(e => e.qualifies);
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
  }, [profile]);

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
          system: getSystemPrompt(reHrs, rePct, localEntries, profile, SAMPLE_PROPERTIES),
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
          id: uid(),
          date: todayStr(),
          qualifies: activityData.qualifies,
          category: activityData.category,
          categoryLabel: IRS_CATEGORIES[activityData.category]?.label || activityData.category,
          activity: activityData.activity,
          minutes: activityData.minutes,
          property: activityData.property,
          irsDescription: activityData.irsDescription
        };
        setLocalEntries(prev => [newEntry, ...prev]);
      }

      // Check for property data
      const propertyData = parsePropertyFromResponse(responseText);
      if (propertyData) {
        const newProperty = {
          id: uid(),
          name: propertyData.address.split(",")[0].trim(),
          address: propertyData.address,
          type: propertyData.type || "single_family",
          units: propertyData.units || 1,
          rent: propertyData.rent || 0,
          purchaseDate: propertyData.purchaseDate || null
        };
        setLocalProperties(prev => [...prev, newProperty]);
      }

      // Check for tenant data
      const tenantData = parseTenantFromResponse(responseText);
      if (tenantData) {
        const newTenant = {
          id: uid(),
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
          hasInsurance: tenantData.hasInsurance || false
        };
        setLocalTenants(prev => [...prev, newTenant]);
      }

      // Check for vendor data
      const vendorData = parseVendorFromResponse(responseText);
      if (vendorData) {
        const newVendor = {
          id: uid(),
          companyName: vendorData.companyName,
          contactName: vendorData.contactName || "",
          category: vendorData.category || "other",
          email: vendorData.email || "",
          phone: vendorData.phone || "",
          notes: vendorData.notes || ""
        };
        setLocalVendors(prev => [...prev, newVendor]);
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

      {/* Header */}
      <header style={{ background: C.darker, borderBottom: `1px solid ${C.gold}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ padding: "14px 0" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.goldBright, fontFamily: "'Inter', sans-serif" }}>
                Rep<span style={{ color: "#fff" }}>Track</span>
              </span>
            </div>
            <nav style={{ display: "flex", gap: 0 }}>
              {VIEWS.map(v => (
                <button key={v.id} className={`nav-item ${view === v.id ? "active" : ""}`} onClick={() => setView(v.id)}>
                  <span style={{ fontSize: 15 }}>{v.icon}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>{v.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.goldL }}>{displayName}</div>
              {profile?.companyName && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.lighter }}>{profile.companyName}</div>
              )}
            </div>
            <button onClick={signOut} className="btn-outline" style={{ padding: "6px 14px", fontSize: 10, color: "#aaa", borderColor: "#444" }}>Log Out</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        
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
              <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your real estate activity... (e.g., 'I spent 2 hours showing properties today')"
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                Dashboard {profile?.firstName && <span style={{ fontWeight: 400, color: C.light }}>— {profile.firstName}</span>}
              </h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{profile?.companyName || 'Track your real estate professional status'}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              <div className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>REP HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.green }}>{reHrs}h</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>of 750h threshold</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.redB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>NON-REPP HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.red }}>{nonREHrs}h</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>W-2 & other work</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.goldL}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>REP PERCENTAGE</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.gold }}>{rePct.toFixed(0)}%</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>of total work time</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.blueB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>ENTRIES</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.blue }}>{localEntries.length}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>activities logged</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.purpleB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>PROPERTIES</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.purple }}>{SAMPLE_PROPERTIES.length}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>in portfolio</div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h2>
              {localEntries.slice(0, 5).map(e => (
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
                    <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "RE" : "Non-REP"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECORDS VIEW */}
        {view === "records" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Activity Records</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>IRS-compliant documentation for audit protection</p>
              </div>
              <button className="btn-gold">Export for CPA</button>
            </div>
            
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 140px 70px", padding: "12px 16px", background: "#f5f0e8", borderBottom: `1px solid ${C.border}` }}>
                {["Date", "Type", "Activity & IRS Documentation", "Category", "Time"].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
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
        )}

        {/* PROPERTIES VIEW */}
        {view === "properties" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Properties</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>Your real estate portfolio • {localProperties.length} properties</p>
              </div>
              <button 
                onClick={() => setShowAddPropertyModal(true)}
                className="btn-gold"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                ➕ Add Property
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {localProperties.map(p => (
                <div 
                  key={p.id} 
                  className="card" 
                  onClick={() => setShowPropertyDetailModal(p)}
                  style={{ 
                    borderLeft: `4px solid ${C.greenB}`, cursor: "pointer",
                    transition: "transform 0.15s, box-shadow 0.15s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: C.dark }}>{p.name}</div>
                    <span style={{ padding: "2px 8px", background: "#f0ece4", border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid, borderRadius: 2 }}>{p.type.replace("_", " ")}</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid, marginBottom: 12 }}>{p.address}</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light }}>{p.units} unit{p.units !== 1 ? "s" : ""}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.green, fontWeight: 600 }}>${p.rent.toLocaleString()}<span style={{ fontSize: 10, color: C.light }}>/mo</span></div>
                  </div>
                  {/* Hours logged for this property */}
                  {repByProperty[p.name] && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderL}` }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>
                        ✅ {(repByProperty[p.name].minutes / 60).toFixed(1)}h logged • {repByProperty[p.name].count} activities
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add Property Card */}
              <div 
                onClick={() => setShowAddPropertyModal(true)}
                className="card" 
                style={{ 
                  borderLeft: `4px solid ${C.border}`, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", 
                  justifyContent: "center", minHeight: 140, background: "#fafafa",
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
        )}

        {/* TENANTS VIEW */}
        {view === "tenants" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Tenants</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{localTenants.length} tenants across your properties</p>
              </div>
              <button onClick={() => setShowAddTenantModal(true)} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                ➕ Add Tenant
              </button>
            </div>

            {/* Deductible Info Banner */}
            <div style={{ background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 8, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>
                <strong>Maintenance Coverage:</strong> First $250 covered by landlord. Repairs exceeding $250 are tenant responsibility per lease agreement.
              </div>
            </div>

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
                            href={`mailto:${tenant.email}?subject=Regarding Your Lease at ${tenant.propertyName}`}
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
                          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 10, color: C.light, fontFamily: "'IBM Plex Mono', monospace" }}>${tenant.deductible || 250} deductible</span>
                          </div>
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
        )}

        {/* VENDORS VIEW */}
        {view === "vendors" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Vendors</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>{localVendors.length} contractors & service providers</p>
              </div>
              <button onClick={() => setShowAddVendorModal(true)} className="btn-gold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                ➕ Add Vendor
              </button>
            </div>

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
                                  href={`mailto:${vendor.email}?subject=Service Request`}
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

            {/* IRS 469(c) Qualifications Reference */}
            <div className="card" style={{ background: C.goldPale, border: `1px solid ${C.gold}` }}>
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
          padding: 20, overflowY: "auto"
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 700, maxHeight: "90vh", overflowY: "auto",
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
          padding: 20, overflowY: "auto"
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 700, maxHeight: "90vh", overflowY: "auto",
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
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 500, boxShadow: "0 25px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Header */}
            <div style={{ 
              background: C.greenB, padding: "20px 24px", 
              borderRadius: "12px 12px 0 0", display: "flex", 
              justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
                  🏠 Add New Property
                </h2>
              </div>
              <button onClick={() => setShowAddPropertyModal(false)} style={{
                background: "rgba(255,255,255,0.2)", border: "none", fontSize: 20, color: "white", 
                cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                  Property Address *
                </label>
                <input
                  type="text"
                  value={newProperty.address}
                  onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
                  placeholder="123 Main St, Pittsburgh PA 15213"
                  style={{
                    width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`,
                    borderRadius: 6, background: "white", color: C.text, outline: "none",
                    fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
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
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                    Number of Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newProperty.units}
                    onChange={(e) => setNewProperty({...newProperty, units: e.target.value})}
                    style={{
                      width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`,
                      borderRadius: 6, background: "white", color: C.text, outline: "none",
                      fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                    Monthly Rent ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProperty.rent}
                    onChange={(e) => setNewProperty({...newProperty, rent: e.target.value})}
                    placeholder="2500"
                    style={{
                      width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`,
                      borderRadius: 6, background: "white", color: C.text, outline: "none",
                      fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box"
                    }}
                  />
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
                    borderRadius: 4, color: C.mid, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addProperty}
                  disabled={!newProperty.address.trim()}
                  style={{
                    flex: 1, padding: "14px 20px", background: !newProperty.address.trim() ? C.border : C.greenB,
                    border: "none", borderRadius: 4, color: "white", fontSize: 12, fontWeight: 600,
                    cursor: !newProperty.address.trim() ? "not-allowed" : "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase"
                  }}
                >
                  Add Property
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
          padding: 20
        }}>
          <div style={{
            background: C.bg, borderRadius: 12, padding: 0, width: "100%",
            maxWidth: 600, maxHeight: "90vh", overflowY: "auto",
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
                  href={`mailto:${showTenantDetailModal.email}?subject=Regarding Your Lease at ${showTenantDetailModal.propertyName}`}
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

              {/* Deductible & Late Payments */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>DEDUCTIBLE</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.gold }}>${showTenantDetailModal.deductible || 250}</div>
                  <div style={{ fontSize: 9, color: C.mid, fontFamily: "'IBM Plex Mono', monospace" }}>Landlord covers first ${showTenantDetailModal.deductible || 250}</div>
                </div>
                <div style={{ background: showTenantDetailModal.latePayments > 0 ? C.redPale : C.greenPale, border: `1px solid ${showTenantDetailModal.latePayments > 0 ? C.redB : C.greenB}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: showTenantDetailModal.latePayments > 0 ? C.red : C.green, letterSpacing: 1, marginBottom: 4 }}>LATE PAYMENTS</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: showTenantDetailModal.latePayments > 0 ? C.red : C.green }}>{showTenantDetailModal.latePayments || 0}</div>
                  <div style={{ fontSize: 9, color: C.mid, fontFamily: "'IBM Plex Mono', monospace" }}>{showTenantDetailModal.latePayments > 0 ? "Payment history" : "Good standing"}</div>
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
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <button onClick={() => copyToClipboard(showVendorDetailModal.email)}
                  style={{ flex: 1, padding: "12px", background: C.goldL, border: "none", borderRadius: 6, color: C.dark, fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  📧 Copy Email
                </button>
                <button onClick={() => copyToClipboard(showVendorDetailModal.phone)}
                  style={{ flex: 1, padding: "12px", background: C.greenB, border: "none", borderRadius: 6, color: "white", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  📱 Copy Phone
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
