import { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://lzxutumsrzjovjmebqns.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eHV0dW1zcnpqb3ZqbWVicW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODAzNzAsImV4cCI6MjA4ODI1NjM3MH0.WuZsLON6sZ2Oe7uEKOZysZzcQXOGwFDaK5doxhulEAA";

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
    signUp: async ({ email, password }) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
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
      return { error: null };
    },
    onAuthStateChange: (callback) => {
      // Simple implementation - check on load
      const token = localStorage.getItem('sb-token');
      const user = localStorage.getItem('sb-user');
      if (token && user) {
        callback('SIGNED_IN', { access_token: token, user: JSON.parse(user) });
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  }
};

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthContext = createContext({});

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data?.user) {
      setUser(data.user);
    }
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      setUser(data.user);
    }
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { data, error } = await signUp(email, password);
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
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F2742 0%, #1a3a5c 50%, #0F2742 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "'IBM Plex Mono', monospace"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
      `}</style>
      
      <div style={{
        background: "#F7F5EA",
        borderRadius: 8,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 25px 80px rgba(0,0,0,0.4)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#0F2742",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: -1
          }}>
            Rep<span style={{ color: "#C6A24A" }}>Track</span>
          </div>
          <div style={{
            fontSize: 11,
            color: "#4D6785",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 6
          }}>
            Real Estate Professional Tracker
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: 28, borderBottom: "1px solid #d4cfbd" }}>
          {["login", "signup"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setMessage(""); }}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "none",
                border: "none",
                borderBottom: mode === m ? "2px solid #C6A24A" : "2px solid transparent",
                color: mode === m ? "#C6A24A" : "#4D6785",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "'IBM Plex Mono', monospace"
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: "block",
              fontSize: 10,
              color: "#4D6785",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 6
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                border: "1px solid #d4cfbd",
                borderRadius: 4,
                background: "#faf8f4",
                color: "#0F2742",
                outline: "none",
                fontFamily: "'IBM Plex Mono', monospace",
                boxSizing: "border-box",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#C6A24A"}
              onBlur={(e) => e.target.style.borderColor = "#d4cfbd"}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block",
              fontSize: 10,
              color: "#4D6785",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 6
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                border: "1px solid #d4cfbd",
                borderRadius: 4,
                background: "#faf8f4",
                color: "#0F2742",
                outline: "none",
                fontFamily: "'IBM Plex Mono', monospace",
                boxSizing: "border-box",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#C6A24A"}
              onBlur={(e) => e.target.style.borderColor = "#d4cfbd"}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              background: "#f5e4e4",
              border: "1px solid #993030",
              borderRadius: 4,
              padding: "10px 14px",
              marginBottom: 18,
              fontSize: 12,
              color: "#7a1a1a"
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              background: "#e4f2ea",
              border: "1px solid #256b45",
              borderRadius: 4,
              padding: "10px 14px",
              marginBottom: 18,
              fontSize: 12,
              color: "#1a5c38"
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: loading ? "#8a9aaa" : "#C6A24A",
              border: "none",
              borderRadius: 4,
              color: "#0F2742",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              transition: "background 0.2s",
              boxShadow: "0 2px 8px rgba(198,162,74,0.3)"
            }}
            onMouseOver={(e) => !loading && (e.target.style.background = "#d4b060")}
            onMouseOut={(e) => !loading && (e.target.style.background = "#C6A24A")}
          >
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: "1px solid #d4cfbd",
          textAlign: "center",
          fontSize: 11,
          color: "#7a96b0"
        }}>
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

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_PROPERTIES = [
  { id:"p1", name:"Oak Street Duplex",       address:"123 Oak St, Pittsburgh PA 15213",      type:"multi_family", units:2, rent:3400 },
  { id:"p2", name:"Downtown Studio",          address:"88 Fifth Ave #4C, Pittsburgh PA 15219", type:"single_family",units:1, rent:1650 },
  { id:"p3", name:"Squirrel Hill 4-Plex",    address:"501 Murray Ave, Pittsburgh PA 15217",  type:"multi_family", units:4, rent:6800 },
  { id:"p4", name:"Lawrenceville Commercial", address:"4200 Butler St, Pittsburgh PA 15201",  type:"commercial",   units:1, rent:4200 },
];
const SAMPLE_TENANTS = [
  { id:"t1", name:"James & Priya Okafor", email:"okafor@email.com",  phone:"412-555-0182", property:"p1", unit:"Unit A", rent:1700, leaseEnd:"2025-01-31" },
  { id:"t2", name:"Derek Shin",           email:"dshin@gmail.com",   phone:"412-555-0391", property:"p1", unit:"Unit B", rent:1700, leaseEnd:"2025-05-31" },
  { id:"t3", name:"Anika Thompson",       email:"anika.t@email.com", phone:"412-555-0714", property:"p2", unit:"#4C",    rent:1650, leaseEnd:"2025-11-30" },
  { id:"t4", name:"Rivera Family",        email:"rivera@email.com",  phone:"412-555-0823", property:"p3", unit:"Unit 1", rent:1700, leaseEnd:"2025-08-31" },
  { id:"t5", name:"Chen Properties LLC",  email:"chen.llc@biz.com",  phone:"412-555-0944", property:"p4", unit:"Full",   rent:4200, leaseEnd:"2026-12-31" },
];
const SAMPLE_SUPPLIERS = [
  { id:"s1", name:"Kowalski Plumbing",         type:"plumber",     email:"kowalski@plumb.com",       phone:"412-555-1100", notes:"License #PL-8821 · $95/hr · 24hr emergency" },
  { id:"s2", name:"Three Rivers Electric",     type:"electrician", email:"info@3riverselectric.com", phone:"412-555-2200", notes:"Master license #EL-4401" },
  { id:"s3", name:"Allegheny HVAC Solutions",  type:"hvac",        email:"service@alleghenyhvac.com",phone:"412-555-3300", notes:"Annual service contracts available" },
  { id:"s4", name:"Steel City Contractors",    type:"contractor",  email:"bids@steelcitycon.com",    phone:"412-555-4400", notes:"GC license #GC-7733" },
  { id:"s5", name:"Greenleaf Landscaping",     type:"landscaping", email:"green@greenleaf.com",      phone:"412-555-5500", notes:"Monthly contracts · Snow removal" },
];
const SAMPLE_ENTRIES = [
  { id:"e1",  date:"2024-11-01", qualifies:true,  category:"management",    categoryLabel:"Property Management",    activity:"Called tenant re maintenance request — Oak St Unit A",    minutes:30  },
  { id:"e2",  date:"2024-11-01", qualifies:false, category:"non_re",        categoryLabel:"Non-RE Work",            activity:"Dr. Rodriguez W-2 physician shift",                       minutes:480 },
  { id:"e3",  date:"2024-11-02", qualifies:true,  category:"maintenance",   categoryLabel:"Maintenance & Repairs",  activity:"Supervised plumber — Oak St hot water heater repair",     minutes:90  },
  { id:"e4",  date:"2024-11-04", qualifies:true,  category:"leasing",       categoryLabel:"Leasing",                activity:"Showed vacant unit — Downtown Studio #4C (2 showings)",   minutes:120 },
  { id:"e5",  date:"2024-11-05", qualifies:true,  category:"financial_mgmt",categoryLabel:"Financial Management",   activity:"Reviewed monthly rent rolls and P&L — all 4 properties",  minutes:75  },
];
const SAMPLE_EMAILS = [
  { id:"em1", to:"kowalski@plumb.com", subject:"Invoice #1022 — Oak St Hot Water Heater", type:"supplier", status:"sent", date:"2024-11-04", body:"Hi Mike,\n\nThank you for the prompt service..." },
];
const SAMPLE_PLANS = [
  { id:"ap1", date:"2024-11-14", title:"CPA Meeting — Cost Segregation Follow-Up", notes:"Notes from Nov 14 meeting.", items:["Order cost segregation study","Request depreciation schedule"] },
];

const fmtH = (m) => { const h=Math.floor(m/60),mn=m%60; return !h&&!mn?"0h":`${h>0?h+"h":""}${mn>0?" "+mn+"m":""}`.trim(); };
const uid  = () => Date.now()+Math.random().toString(36).slice(2);
const todayStr = () => new Date().toISOString().split("T")[0];

// ── RepTrack Brand System ──────────────────────────────────────────────────
const C = {
  bg:"#F7F5EA", white:"#ffffff", dark:"#0F2742", darker:"#091e33", text:"#0F2742",
  mid:"#2d4a6a", light:"#4D6785", lighter:"#7a96b0", border:"#d4cfbd", borderL:"#e8e4d4",
  gold:"#9a7830", goldL:"#C6A24A", goldPale:"#faf3dc", goldBright:"#e8c870",
  green:"#1a5c38", greenPale:"#e4f2ea", greenB:"#256b45",
  red:"#7a1a1a", redPale:"#f5e4e4", redB:"#993030",
  blue:"#2d4f6e", bluePale:"#e4edf5", blueB:"#3d6080",
  purple:"#3a2060", purpleB:"#5a3a90",
};

const VIEWS = [
  { id:"dashboard", icon:"◉", label:"Dashboard" },
  { id:"records",   icon:"⊟", label:"Records" },
  { id:"properties",icon:"⌂", label:"Properties" },
];

// ═══ MAIN APP (after login) ════════════════════════════════════════════════
function MainApp() {
  const { user, signOut } = useAuth();
  const [view, setView] = useState("dashboard");
  const [localEntries, setLocalEntries] = useState(SAMPLE_ENTRIES);
  const [localEmails, setLocalEmails] = useState(SAMPLE_EMAILS);
  const [localPlans, setLocalPlans] = useState(SAMPLE_PLANS);

  const reEntries = localEntries.filter(e => e.qualifies);
  const totalREMins = reEntries.reduce((s, e) => s + e.minutes, 0);
  const nonREMins = localEntries.filter(e => !e.qualifies).reduce((s, e) => s + e.minutes, 0);
  const totalMins = totalREMins + nonREMins;
  const rePct = totalMins > 0 ? (totalREMins / totalMins) * 100 : 0;

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
      `}</style>

      {/* Header */}
      <header style={{ background: C.darker, borderBottom: `1px solid ${C.gold}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ padding: "14px 0", display: "flex", alignItems: "center", gap: 10 }}>
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
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.goldL }}>{user?.email}</span>
            <button onClick={signOut} className="btn-outline" style={{ padding: "6px 14px", fontSize: 10, color: "#aaa", borderColor: "#444" }}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {view === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Dashboard</h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>Track your real estate professional status</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <div className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>RE HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.green }}>{fmtH(totalREMins)}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid, marginTop: 4 }}>of 750 hr threshold</div>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${C.goldL}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>RE PERCENTAGE</div>
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
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.text }}>{e.activity}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light, marginTop: 2 }}>{e.date} · {e.categoryLabel}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.gold, fontWeight: 600 }}>{fmtH(e.minutes)}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "RE" : "Non-RE"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "records" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Records</h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>All your logged activities</p>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 160px 80px", padding: "12px 16px", background: "#f5f0e8", borderBottom: `1px solid ${C.border}` }}>
                {["Date", "Type", "Activity", "Category", "Time"].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              {localEntries.map(e => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 160px 80px", padding: "12px 16px", borderBottom: `1px solid ${C.borderL}`, alignItems: "center" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid }}>{e.date}</div>
                  <div><span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", background: e.qualifies ? C.greenPale : C.redPale, color: e.qualifies ? C.green : C.red }}>{e.qualifies ? "RE" : "Non-RE"}</span></div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.text }}>{e.activity}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>{e.categoryLabel}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.gold, fontWeight: 600 }}>{fmtH(e.minutes)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "properties" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Properties</h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>Your real estate portfolio</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {SAMPLE_PROPERTIES.map(p => (
                <div key={p.id} className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: C.dark }}>{p.name}</div>
                    <span style={{ padding: "2px 8px", background: "#f0ece4", border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.mid, borderRadius: 2 }}>{p.type.replace("_", " ")}</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.mid, marginBottom: 12 }}>{p.address}</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light }}>{p.units} unit{p.units !== 1 ? "s" : ""}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.green, fontWeight: 600 }}>${p.rent.toLocaleString()}<span style={{ fontSize: 10, color: C.light }}>/mo</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
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
