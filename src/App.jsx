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
        // Also save profile data locally
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

// Get profile from localStorage
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { signIn, signUp } = useAuth();

  const inputStyle = { 
    width: "100%", 
    padding: "12px 14px", 
    fontSize: 14, 
    border: "1px solid #d4cfbd", 
    borderRadius: 4, 
    background: "#faf8f4", 
    color: "#0F2742", 
    outline: "none", 
    fontFamily: "'IBM Plex Mono', monospace", 
    boxSizing: "border-box" 
  };

  const labelStyle = { 
    display: "block", 
    fontSize: 10, 
    color: "#4D6785", 
    letterSpacing: 2, 
    textTransform: "uppercase", 
    marginBottom: 6 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      // Validate required fields for signup
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
        padding: "40px 36px",
        width: "100%",
        maxWidth: mode === "signup" ? 480 : 420,
        boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
        transition: "max-width 0.3s ease"
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0F2742", fontFamily: "'Inter', sans-serif", letterSpacing: -1 }}>
            Rep<span style={{ color: "#C6A24A" }}>Track</span>
          </div>
          <div style={{ fontSize: 11, color: "#4D6785", letterSpacing: 2, textTransform: "uppercase", marginTop: 6 }}>
            Real Estate Professional Tracker
          </div>
        </div>

        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid #d4cfbd" }}>
          {["login", "signup"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setMessage(""); }}
              style={{
                flex: 1, padding: "12px 0", background: "none", border: "none",
                borderBottom: mode === m ? "2px solid #C6A24A" : "2px solid transparent",
                color: mode === m ? "#C6A24A" : "#4D6785",
                fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase",
                cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace"
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Signup-only fields */}
          {mode === "signup" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    required={mode === "signup"}
                    style={inputStyle}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    required={mode === "signup"}
                    style={inputStyle}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Company Name</label>
                <input
                  type="text" 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)}
                  style={inputStyle}
                  placeholder="Smith Properties LLC"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Phone Number</label>
                <input
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div style={{ borderTop: "1px solid #d4cfbd", margin: "20px 0", paddingTop: 16 }}>
                <div style={{ fontSize: 10, color: "#4D6785", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                  Account Credentials
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password *</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              style={inputStyle}
              placeholder="••••••••"
            />
            {mode === "signup" && (
              <div style={{ fontSize: 10, color: "#7a96b0", marginTop: 4 }}>Minimum 6 characters</div>
            )}
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

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_PROPERTIES = [
  { id:"p1", name:"Oak Street Duplex", address:"123 Oak St, Pittsburgh PA 15213", type:"multi_family", units:2, rent:3400 },
  { id:"p2", name:"Downtown Studio", address:"88 Fifth Ave #4C, Pittsburgh PA 15219", type:"single_family", units:1, rent:1650 },
  { id:"p3", name:"Squirrel Hill 4-Plex", address:"501 Murray Ave, Pittsburgh PA 15217", type:"multi_family", units:4, rent:6800 },
  { id:"p4", name:"Lawrenceville Commercial", address:"4200 Butler St, Pittsburgh PA 15201", type:"commercial", units:1, rent:4200 },
];

const SAMPLE_ENTRIES = [
  { id:"e1", date:"2024-11-01", qualifies:true, category:"management", categoryLabel:"Property Management", activity:"Called tenant re maintenance request — Oak St Unit A", minutes:30 },
  { id:"e2", date:"2024-11-01", qualifies:false, category:"non_re", categoryLabel:"Non-RE Work", activity:"W-2 work shift", minutes:480 },
  { id:"e3", date:"2024-11-02", qualifies:true, category:"maintenance", categoryLabel:"Maintenance & Repairs", activity:"Supervised plumber — Oak St hot water heater repair", minutes:90 },
  { id:"e4", date:"2024-11-04", qualifies:true, category:"leasing", categoryLabel:"Leasing", activity:"Showed vacant unit — Downtown Studio #4C", minutes:120 },
  { id:"e5", date:"2024-11-05", qualifies:true, category:"financial_mgmt", categoryLabel:"Financial Management", activity:"Reviewed monthly rent rolls and P&L", minutes:75 },
];

const fmtH = (m) => { const h=Math.floor(m/60),mn=m%60; return !h&&!mn?"0h":`${h>0?h+"h":""}${mn>0?" "+mn+"m":""}`.trim(); };
const uid = () => Date.now()+Math.random().toString(36).slice(2);
const todayStr = () => new Date().toISOString().split("T")[0];

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
  { id:"assistant", icon:"◈", label:"Assistant" },
  { id:"dashboard", icon:"◉", label:"Dashboard" },
  { id:"records", icon:"⊟", label:"Records" },
  { id:"properties", icon:"⌂", label:"Properties" },
];

// ─── CLAUDE AI SYSTEM PROMPT ──────────────────────────────────────────────────
const getSystemPrompt = (reHrs, rePct, entries, profile) => `You are an AI assistant for RepTrack, a Real Estate Professional (REP) tax documentation platform. Your role is to help users log their real estate activities, organize records, and draft communications.

USER PROFILE:
- Name: ${profile?.firstName || 'User'} ${profile?.lastName || ''}
- Company: ${profile?.companyName || 'Not specified'}
- Phone: ${profile?.phone || 'Not specified'}

CURRENT USER STATUS:
- RE hours logged: ${reHrs} hours (need 750 for REP status)
- RE percentage of work: ${rePct.toFixed(1)}% (need >50% for REP status)
- Total entries: ${entries.length}

YOUR CAPABILITIES:
1. LOG ACTIVITIES: When users describe real estate work, help them log it. Extract: activity description, duration (in minutes), category, and whether it qualifies as RE work.

2. CATEGORIES for RE work:
- Property Management (tenant relations, oversight)
- Maintenance & Repairs (coordinating/supervising repairs)
- Leasing (showings, applications, lease prep)
- Financial Management (rent collection, bookkeeping, P&L)
- Legal & Administrative (lease review, compliance)
- Vendor Coordination (contractor meetings, bids)
- Acquisition (property tours, due diligence)
- Construction (renovation oversight)

3. NON-RE WORK: W-2 jobs, non-real-estate businesses, etc.

4. DRAFT EMAILS: Help draft professional emails to tenants, vendors, etc.

5. ANSWER QUESTIONS: About REP status requirements, documentation best practices, etc.

RESPONSE FORMAT:
- Be concise and professional
- Address the user by their first name when appropriate
- When logging an activity, confirm the details
- If you need clarification, ask specific questions
- Don't give tax advice - remind users to consult their CPA

IMPORTANT: You are NOT a tax advisor. You help with DOCUMENTATION only.`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp() {
  const { user, profile, signOut } = useAuth();
  const [view, setView] = useState("assistant");
  const [localEntries, setLocalEntries] = useState(SAMPLE_ENTRIES);
  
  // Chat state
  const [messages, setMessages] = useState([
    { role: "assistant", id: "welcome", content: `Hi${profile?.firstName ? ` ${profile.firstName}` : ''}! I'm your RepTrack assistant. I can help you:\n\n• Log real estate activities\n• Track your hours toward REP status\n• Draft emails to tenants and vendors\n• Answer questions about documentation\n\nWhat did you work on today?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const reEntries = localEntries.filter(e => e.qualifies);
  const totalREMins = reEntries.reduce((s, e) => s + e.minutes, 0);
  const reHrs = Math.round(totalREMins / 60 * 10) / 10;
  const nonREMins = localEntries.filter(e => !e.qualifies).reduce((s, e) => s + e.minutes, 0);
  const totalMins = totalREMins + nonREMins;
  const rePct = totalMins > 0 ? (totalREMins / totalMins) * 100 : 0;

  // Display name
  const displayName = profile?.firstName && profile?.lastName 
    ? `${profile.firstName} ${profile.lastName}` 
    : user?.email;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", id: uid(), content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system: getSystemPrompt(reHrs, rePct, localEntries, profile),
          messages: [...messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content })), { role: "user", content: input.trim() }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage = {
        role: "assistant",
        id: uid(),
        content: data.content[0].text
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
        .msg-bubble { max-width: 80%; padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; }
        .msg-user { background: ${C.dark}; color: ${C.goldBright}; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg-assistant { background: white; border: 1px solid ${C.border}; color: ${C.text}; margin-right: auto; border-bottom-left-radius: 4px; }
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
                <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>AI Assistant</h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>Powered by Claude • Log activities, draft emails, get answers</p>
              </div>

              {/* Messages */}
              <div className="card" style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column" }}>
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-assistant"}`}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="msg-bubble msg-assistant">
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.light }}>Thinking...</div>
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
                  placeholder="Tell me what you worked on, or ask a question..."
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
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["I reviewed leases for 2 hours", "Log a 45-min contractor call", "Draft email to tenant about rent", "What counts as RE work?"].map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{
                    background: "white", border: `1px solid ${C.border}`, borderRadius: 20,
                    padding: "6px 14px", fontSize: 11, color: C.mid, cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar Stats */}
            <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>RE HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.green }}>{reHrs}h</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>of 750h threshold</div>
                <div style={{ marginTop: 8, height: 6, background: C.borderL, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${Math.min((reHrs/750)*100, 100)}%`, background: C.greenB, borderRadius: 3 }} />
                </div>
              </div>

              <div className="card" style={{ borderLeft: `4px solid ${C.goldL}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>RE PERCENTAGE</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.gold }}>{rePct.toFixed(0)}%</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>of total work time</div>
                <div style={{ marginTop: 8, height: 6, background: C.borderL, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${Math.min(rePct, 100)}%`, background: C.goldL, borderRadius: 3 }} />
                </div>
              </div>

              <div className="card" style={{ borderLeft: `4px solid ${C.blueB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 6 }}>ENTRIES</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 32, fontWeight: 700, color: C.blue }}>{localEntries.length}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.mid }}>activities logged</div>
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
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>
                {profile?.companyName || 'Track your real estate professional status'}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <div className="card" style={{ borderLeft: `4px solid ${C.greenB}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 2, marginBottom: 8 }}>RE HOURS</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 700, color: C.green }}>{reHrs}h</div>
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

        {/* RECORDS VIEW */}
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

        {/* PROPERTIES VIEW */}
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
