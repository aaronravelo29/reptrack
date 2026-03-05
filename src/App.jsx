import { useState, useRef, useEffect, useMemo } from "react";

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
  { id:"e6",  date:"2024-11-06", qualifies:true,  category:"legal_admin",   categoryLabel:"Legal & Administrative", activity:"Reviewed new lease draft — Downtown Studio tenant",        minutes:60  },
  { id:"e7",  date:"2024-11-07", qualifies:false, category:"non_re",        categoryLabel:"Non-RE Work",            activity:"Dr. Rodriguez W-2 physician shift",                       minutes:480 },
  { id:"e8",  date:"2024-11-08", qualifies:true,  category:"vendor_mgmt",   categoryLabel:"Vendor Coordination",    activity:"Met with landscaping contractor — Squirrel Hill 4-Plex",  minutes:45  },
  { id:"e9",  date:"2024-11-10", qualifies:true,  category:"acquisition",   categoryLabel:"Acquisition",            activity:"Property tour — potential 6-unit in Shadyside",            minutes:180 },
  { id:"e10", date:"2024-11-11", qualifies:true,  category:"management",    categoryLabel:"Property Management",    activity:"Lease renewal negotiation — Murray Ave Unit 2",            minutes:50  },
  { id:"e11", date:"2024-11-12", qualifies:true,  category:"rental_ops",    categoryLabel:"Rental Operations",      activity:"Quarterly property walkthrough — all 4 properties",        minutes:240 },
  { id:"e12", date:"2024-11-13", qualifies:false, category:"non_re",        categoryLabel:"Non-RE Work",            activity:"Dr. Rodriguez W-2 physician shift",                       minutes:480 },
  { id:"e13", date:"2024-11-14", qualifies:true,  category:"financial_mgmt",categoryLabel:"Financial Management",   activity:"Met with CPA re: cost segregation study",                  minutes:90  },
  { id:"e14", date:"2024-11-15", qualifies:true,  category:"construction",  categoryLabel:"Construction",           activity:"Reviewed contractor bid — kitchen reno Oak St Unit B",    minutes:60  },
  { id:"e15", date:"2024-11-18", qualifies:true,  category:"management",    categoryLabel:"Property Management",    activity:"Responded to 6 tenant emails across portfolio",           minutes:55  },
  { id:"e16", date:"2024-11-19", qualifies:true,  category:"leasing",       categoryLabel:"Leasing",                activity:"Background check & application review — Studio tenant",    minutes:40  },
  { id:"e17", date:"2024-11-20", qualifies:false, category:"non_re",        categoryLabel:"Non-RE Work",            activity:"Dr. Rodriguez W-2 physician shift",                       minutes:480 },
  { id:"e18", date:"2024-11-21", qualifies:true,  category:"vendor_mgmt",   categoryLabel:"Vendor Coordination",    activity:"Coordinated HVAC inspection — Butler St Commercial",       minutes:70  },
  { id:"e19", date:"2024-11-22", qualifies:true,  category:"financial_mgmt",categoryLabel:"Financial Management",   activity:"Prepared 2024 RE income/expense summary for CPA",         minutes:120 },
  { id:"e20", date:"2024-11-25", qualifies:true,  category:"acquisition",   categoryLabel:"Acquisition",            activity:"Due diligence review — Shadyside 6-unit deal",             minutes:150 },
  { id:"e21", date:"2024-11-26", qualifies:true,  category:"management",    categoryLabel:"Property Management",    activity:"Move-in walkthrough — new Downtown Studio tenant",         minutes:60  },
  { id:"e22", date:"2024-11-27", qualifies:true,  category:"legal_admin",   categoryLabel:"Legal & Administrative", activity:"Reviewed eviction notice process — Murray Ave Unit 3",    minutes:45  },
];
const SAMPLE_EMAILS = [
  { id:"em1", to:"kowalski@plumb.com",    subject:"Invoice #1022 — Oak St Hot Water Heater",          type:"supplier", status:"sent",  date:"2024-11-04", body:"Hi Mike,\n\nThank you for the prompt service on November 3rd at 123 Oak St. The repair was completed professionally and the tenant confirmed the issue is resolved.\n\nCould you please send the formal invoice to maria@rodriguez-re.com for our records? We'll process payment within 5 business days.\n\nThank you,\nMaria Rodriguez" },
  { id:"em2", to:"bids@steelcitycon.com", subject:"Kitchen Renovation — Oak St Unit B Confirmation",  type:"supplier", status:"sent",  date:"2024-11-16", body:"Hi Tom,\n\nFollowing our meeting on the 15th, I'm confirming we'd like to proceed with the kitchen renovation at 123 Oak St, Unit B per your bid of $12,400.\n\nPlease send the formal contract and expected start date. We're targeting completion before February 1, 2025.\n\nMaria Rodriguez" },
  { id:"em3", to:"okafor@email.com",      subject:"Lease Renewal Offer — 123 Oak St Unit A",          type:"tenant",   status:"draft", date:"2024-11-27", body:"Dear James and Priya,\n\nI hope you're doing well! Your current lease expires January 31, 2025. I'd love to have you continue.\n\nI'm prepared to offer a renewal at $1,751/month (3% increase), with all other terms remaining the same.\n\nPlease let me know by December 15th.\n\nWarm regards,\nMaria Rodriguez" },
  { id:"em4", to:"chen.llc@biz.com",      subject:"Annual Inspection — 4200 Butler St, Dec 10",       type:"tenant",   status:"draft", date:"2024-11-22", body:"Dear Chen Properties,\n\nPer our lease agreement, I'll be conducting the annual property inspection at 4200 Butler St on December 10, 2024 between 10:00 AM and 12:00 PM.\n\nPlease ensure access is available.\n\nThank you,\nMaria Rodriguez" },
];
const SAMPLE_PLANS = [
  { id:"ap1", date:"2024-11-14", title:"CPA Meeting — Cost Segregation Follow-Up",
    notes:"Notes from Nov 14 meeting. Organized and filed for records.",
    items:["Order cost segregation study for Squirrel Hill 4-Plex and Oak St Duplex","Request full depreciation schedule from CPA by Dec 1","Confirm RE hours logged through year-end","Schedule year-end review meeting with CPA for Dec 20","File all November receipts and invoices"] },
  { id:"ap2", date:"2024-11-20", title:"Shadyside 6-Unit — Due Diligence Checklist",
    notes:"Organized from due diligence session. Filed under Acquisitions.",
    items:["Complete inspection report review by Nov 25","Request 3-year operating history from seller","Get lender pre-approval for $680K","Review title search results with attorney","Make formal offer if inspection clears"] },
];

const fmtH = (m) => { const h=Math.floor(m/60),mn=m%60; return !h&&!mn?"0h":`${h>0?h+"h":""}${mn>0?" "+mn+"m":""}`.trim(); };
const uid  = () => Date.now()+Math.random().toString(36).slice(2);
const todayStr = () => new Date().toISOString().split("T")[0];

// ── RepTrack Brand System ──────────────────────────────────────────────────
// Midnight Navy #0F2742 · Proof Gold #C6A24A · Slate Steel #4D6785 · Paper Ivory #F7F5EA
const C = {
  bg:"#F7F5EA",          // Paper Ivory — app background
  white:"#ffffff",
  dark:"#0F2742",        // Midnight Navy — primary dark
  darker:"#091e33",      // Deeper navy for header
  text:"#0F2742",        // Navy for body text
  mid:"#2d4a6a",         // Mid navy
  light:"#4D6785",       // Slate Steel — secondary text
  lighter:"#7a96b0",     // Light slate
  border:"#d4cfbd",      // Ivory border
  borderL:"#e8e4d4",     // Light ivory border
  // Gold system (Proof Gold)
  gold:"#9a7830",        // Deep gold
  goldL:"#C6A24A",       // Proof Gold — primary accent
  goldPale:"#faf3dc",    // Pale gold background
  goldBright:"#e8c870",  // Bright gold highlight
  // Status: green
  green:"#1a5c38",
  greenPale:"#e4f2ea",
  greenB:"#256b45",
  // Status: red
  red:"#7a1a1a",
  redPale:"#f5e4e4",
  redB:"#993030",
  // Slate Steel used as blue-equivalent
  blue:"#2d4f6e",        // Deep slate — used for comms/email
  bluePale:"#e4edf5",
  blueB:"#3d6080",
  // Purple — kept for suppliers
  purple:"#3a2060",
  purpleB:"#5a3a90",
};

const VIEWS = [
  { id:"assistant", icon:"◈", label:"Assistant"    },
  { id:"dashboard", icon:"◉", label:"Dashboard"    },
  { id:"records",   icon:"⊟", label:"Records"      },
  { id:"properties",icon:"⌂", label:"Properties"   },
  { id:"comms",     icon:"✉", label:"Communications"},
  { id:"rules",     icon:"⚑", label:"Rules Engine" },
  { id:"cpa",       icon:"⚖", label:"CPA Portal"   },
];

const SYSTEM_PROMPT = (reHrs, rePct, entries) => `You are an organizational assistant for a Real Estate Professional (REP) documentation platform. You are NOT a financial advisor, tax advisor, or attorney. Your only job is to help the user ORGANIZE, FILE, and DOCUMENT their real estate activities.

## YOUR ROLE
- Listen to what the user tells you they did
- Help them organize and file it in the right category
- Draft communications (emails) when asked
- Summarize sessions into organized notes
- Redirect information to the correct section of the platform
- Ask clarifying questions only to organize things correctly

## WHAT YOU DO NOT DO
- You do not give tax advice
- You do not interpret tax law
- You do not tell users if they qualify for anything
- You do not make recommendations about their financial situation
- If asked for advice, say: "I'm here to help organize your records. For tax questions, please consult your CPA or tax attorney."

## CURRENT RECORD STATUS
- RE hours filed this year: ${reHrs} hours
- RE percentage of logged time: ${rePct.toFixed(1)}%
- Total entries in record: ${entries.length}
- Qualifier: Maria Rodriguez

## IRS CATEGORIES (for filing only — you file into these, you don't advise on them)
development, construction, acquisition, rental_ops, management, leasing, brokerage, maintenance, financial_mgmt, legal_admin, vendor_mgmt, non_re

## ⚠ IRS FILING FLAGS — detect these patterns and attach the appropriate flag_code to the LOG

You are a filing assistant, not a tax advisor. When you detect any of the patterns below, FILE the activity normally but attach the flag so the CPA can review. Never tell the user they qualify or don't qualify — only flag for review.

FLAG CODES and their trigger patterns:

FLAG: "investor_activity"
- "Reviewing finances/P&L/statements" (passive monitoring, not hands-on)
- "Researching deals", "analyzing market", "looking at listings" (no active acquisition role)
- "Investor meetings", "investment review", "partner update calls"
- "Watching the market", "monitoring portfolio performance"
- "Reading about real estate", "following trends"
NOTE to attach: "The IRS may classify this as an Investor Activity that does not count toward Material Participation. Discuss with your CPA."

FLAG: "employee_hours_risk"  
- User describes RE work done as a W-2 EMPLOYEE (not as owner/self-employed)
- "My job at the property management company", "hours at my employer's properties", "work I did for my boss"
- EXCEPTION: Do NOT flag if user says they own more than 5% of the employer
NOTE: "Hours worked as a W-2 employee in real estate do NOT count toward REP tests unless you own more than 5% of that employer (IRC §469(c)(7)(D)). Discuss with your CPA."

FLAG: "third_party_mgmt_risk"
- User mentions a property management company handling their rental
- "My property manager handles it", "PM company takes care of it", "I have a property manager"
- "I'm hands-off on that one", "the management company deals with tenants"
NOTE: "When a third-party property manager handles day-to-day operations, the IRS scrutinizes whether you materially participate. Only the 500-hour test may be available. Discuss with your CPA."

FLAG: "travel_time_risk"
- User logs travel/commute time as RE hours
- "Drive to the property", "commute to check on", "travel time to visit", "flight to see property"
NOTE: "Commute and travel time generally do not count toward RE professional hours. Log the activity at the destination, not the travel. Confirm with your CPA."

FLAG: "reconstructed_log_risk"
- User describes logging activities from memory for past weeks/months all at once
- "Let me catch up on last month", "logging everything from the past few weeks", "I forgot to track"
NOTE: "The IRS requires contemporaneous logs — recorded at the time of activity. Reconstructed logs are frequently rejected in audits. Log activities daily or weekly going forward."

FLAG: "str_bypass_note"
- User describes a SHORT-TERM RENTAL (average stay 7 days or less: Airbnb, VRBO, vacation rental)
NOTE: "Short-term rentals (avg stay ≤7 days) are NOT 'rental activities' under IRC §469 — they may bypass REP rules entirely, but you must still materially participate. This could be a planning opportunity. Discuss with your CPA."

WHEN A FLAG IS TRIGGERED:
- File the activity normally (correct category, qualifies true/false as appropriate)
- Add "flag_code": "[code]" and "flag_note": "[note text]" to the LOG block
- Mention it briefly in your response: "I've filed this and added a flag your CPA should review."
- Never say the activity definitively does or doesn't count — only flag for review

## HOW TO RESPOND

When the user describes an activity:
1. Confirm what they did in plain language
2. Tell them which folder/category you're filing it under and why (just organizational logic, not tax advice)
3. If investor_warning applies, mention it plainly: "I'm filing this under Financial Management, but I've added a flag to this record — your CPA should review whether this counts as day-to-day management or passive investor activity."
4. Ask for time if they didn't give it
5. End with a LOG block

Standard LOG (no flags):
<LOG>{"ready":true,"qualifies":true,"category":"management","categoryLabel":"Property Management","activity":"Called tenant re lease renewal","minutes":30,"date":"today","filing":"Filed under Property Management","investor_warning":false,"flag_code":null,"flag_note":null}</LOG>

LOG with investor_activity flag:
<LOG>{"ready":true,"qualifies":true,"category":"financial_mgmt","categoryLabel":"Financial Management","activity":"Reviewed portfolio reports","minutes":60,"date":"today","filing":"Filed under Financial Management — CPA flag attached","investor_warning":true,"flag_code":"investor_activity","flag_note":"The IRS may classify this as Investor Activity that does not count toward Material Participation. Discuss with your CPA."}</LOG>

LOG with third_party_mgmt_risk flag:
<LOG>{"ready":true,"qualifies":true,"category":"management","categoryLabel":"Property Management","activity":"Called PM company about Oak St","minutes":20,"date":"today","filing":"Filed under Property Management — CPA flag attached","investor_warning":false,"flag_code":"third_party_mgmt_risk","flag_note":"When a third-party property manager handles day-to-day operations, the IRS scrutinizes material participation. Discuss with your CPA."}</LOG>

For non-RE activities:
<LOG>{"ready":true,"qualifies":false,"category":"non_re","categoryLabel":"Non-RE Work","activity":"Physician W-2 shift","minutes":480,"date":"today","filing":"Filed under Non-RE Work — recorded separately","investor_warning":false,"flag_code":null,"flag_note":null}</LOG>

If you need more info: <LOG>{"ready":false}</LOG>

When drafting an email:
<EMAIL>{"to":"","subject":"[subject]","body":"[full professional email]","type":"supplier"}</EMAIL>

When creating organized notes from a session:
<PLAN>{"title":"[title]","date":"today","items":["item 1","item 2"],"notes":"[brief summary]"}</PLAN>

## TONE
Calm, organized, professional. Like a well-organized office manager. Short sentences. No jargon. Always confirm what was filed and where. Never use the word "qualify" in a tax-advice context.`;

// ─── Search highlight helper ───────────────────────────────────────────────
function hlText(text, query) {
  if (!query || !query.trim()) return text;
  try {
    const esc = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    return text.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
  } catch(e) { return text; }
}

// ─── Parse helpers ─────────────────────────────────────────────────────────
const parseTag = (text, tag) => {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
};
const stripTags = (text) =>
  text.replace(/<(LOG|EMAIL|PLAN)>[\s\S]*?<\/(LOG|EMAIL|PLAN)>/g,"").trim();

// ═══ MAIN ════════════════════════════════════════════════════════════════════
export default function REPPlatform() {
  const [view, setView]           = useState("assistant");
  const [activeSpouse, setActiveSpouse] = useState("maria"); // "maria" | "carlos"
  const [localEntries, setLocalEntries] = useState(SAMPLE_ENTRIES);
  const [localEmails, setLocalEmails]   = useState(SAMPLE_EMAILS);
  const [localPlans, setLocalPlans]     = useState(SAMPLE_PLANS);
  const [messages, setMessages]   = useState([
    { role:"assistant", id:"w0", content:"Hi Maria! I'm your RepTrack assistant.\n\nI help you keep your real estate records organized — I file your activities, draft communications, and keep everything documented in one place. I'm not here to give advice; I'm here to make sure your records are clean, complete, and easy to find.\n\nTell me what you worked on and I'll file it. Or say \"draft email to\" someone and I'll write it for you." }
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState(null); // null | "recording" | "transcribing" | "error"
  const [whisperKey, setWhisperKey]   = useState(""); // user pastes their OpenAI key — never stored server-side
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [pendingLog, setPendingLog]     = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [pendingPlan, setPendingPlan]   = useState(null);
  const [flash, setFlash]         = useState(null);
  const [fileAnim, setFileAnim]   = useState(null);

  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const searchRef      = useRef(null);
  const mediaRecorder  = useRef(null);
  const audioChunks    = useRef([]);

  // ── Spouse-filtered entries ──
  const spouseEntries = useMemo(()=>
    activeSpouse === "maria"
      ? localEntries.filter(e => e.spouse !== "carlos")
      : localEntries.filter(e => e.spouse === "carlos"),
  [localEntries, activeSpouse]);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  // Always compute stats from Maria's entries (REP qualifier)
  const mariaEntries  = useMemo(()=>localEntries.filter(e=>e.spouse!=="carlos"),[localEntries]);
  const reEntries     = useMemo(()=>mariaEntries.filter(e=>e.qualifies),[mariaEntries]);
  const totalREMins   = useMemo(()=>reEntries.reduce((s,e)=>s+e.minutes,0),[reEntries]);
  const nonREMins     = useMemo(()=>mariaEntries.filter(e=>!e.qualifies).reduce((s,e)=>s+e.minutes,0),[mariaEntries]);
  const totalMins     = totalREMins + nonREMins;
  const rePct         = totalMins>0?(totalREMins/totalMins)*100:0;
  const reHrs         = Math.floor(totalREMins/60);
  const c1 = reHrs>=750, c2 = rePct>=50;
  // Carlos log stats (for display only)
  const carlosEntries  = useMemo(()=>localEntries.filter(e=>e.spouse==="carlos"),[localEntries]);
  const carlosMins     = useMemo(()=>carlosEntries.reduce((s,e)=>s+e.minutes,0),[carlosEntries]);

  const showFlash = (msg, type="success") => {
    setFlash({msg,type});
    setTimeout(()=>setFlash(null), 3500);
  };

  const triggerFileAnim = (dest) => {
    setFileAnim(dest);
    setTimeout(()=>setFileAnim(null), 2000);
  };

  // ── Whisper recording pipeline ────────────────────────────────────────────
  const startRecording = async () => {
    if (!whisperKey.trim()) { setShowKeyInput(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: mr.mimeType });
        stopRecording(blob);
      };
      mr.start(200); // collect chunks every 200ms
      mediaRecorder.current = mr;
      setIsRecording(true);
      setWhisperStatus("recording");
    } catch (err) {
      showFlash("Microphone access denied — check browser permissions", "error");
    }
  };

  const stopRecording = async (blob) => {
    setIsRecording(false);
    setWhisperStatus("transcribing");
    try {
      // Build multipart/form-data for Whisper API
      const formData = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      formData.append("file", new File([blob], `recording.${ext}`, { type: blob.type }));
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      // Provide a real-estate aware prompt so Whisper spells domain terms correctly
      formData.append("prompt", "Real estate professional, IRC 469, property management, tenants, leases, rental income, CPA, depreciation, cost segregation, material participation.");

      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${whisperKey.trim()}` },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}));
        throw new Error(err?.error?.message || `Whisper API error ${resp.status}`);
      }

      const data = await resp.json();
      const transcript = data.text?.trim();
      if (!transcript) throw new Error("Empty transcript returned");

      setWhisperStatus(null);
      setInput(transcript);
      showFlash("🎙 Transcribed — review and send");
      inputRef.current?.focus();
    } catch (err) {
      setWhisperStatus("error");
      showFlash(`Whisper error: ${err.message}`, "error");
      setTimeout(() => setWhisperStatus(null), 3000);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      mediaRecorder.current?.stop();    // triggers onstop → stopRecording(blob)
    } else {
      startRecording();
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = {role:"user", content:text, id:uid()};
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:900,
          system: SYSTEM_PROMPT(reHrs, rePct, localEntries),
          messages: newMsgs.filter(m=>m.id!=="w0").map(m=>({role:m.role,content:m.content}))
        })
      });
      const data = await resp.json();
      const raw     = data.content?.map(b=>b.text||"").join("")||"I had trouble with that — could you try again?";
      const logData   = parseTag(raw,"LOG");
      const emailData = parseTag(raw,"EMAIL");
      const planData  = parseTag(raw,"PLAN");
      const display   = stripTags(raw);

      setMessages(p=>[...p,{role:"assistant",content:display,id:uid()}]);
      if (logData?.ready) {
        const d = {...logData, date: logData.date==="today"?todayStr():logData.date};
        setPendingLog(d);
      }
      if (emailData) setPendingEmail(emailData);
      if (planData)  {
        if(planData.date==="today") planData.date=todayStr();
        setPendingPlan(planData);
      }
    } catch {
      setMessages(p=>[...p,{role:"assistant",content:"Connection issue — please try again.",id:uid()}]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const confirmLog = () => {
    if (!pendingLog) return;
    setLocalEntries(p=>[...p,{...pendingLog,id:uid()}]);
    triggerFileAnim(pendingLog.qualifies?"RE Records":"Non-RE Records");
    const flagMsg = pendingLog.flag_code ? ` · ⚑ ${pendingLog.flag_code.replace(/_/g," ")} flagged` : "";
    setPendingLog(null);
    showFlash(`✓ Filed under ${pendingLog.categoryLabel}${flagMsg}`);
  };

  const confirmEmail = () => {
    if (!pendingEmail) return;
    setLocalEmails(p=>[...p,{...pendingEmail,id:uid(),date:todayStr(),status:"draft"}]);
    triggerFileAnim("Communications");
    setPendingEmail(null);
    showFlash("✓ Saved to Communications");
  };

  const confirmPlan = () => {
    if (!pendingPlan) return;
    setLocalPlans(p=>[...p,{...pendingPlan,id:uid()}]);
    triggerFileAnim("Records");
    setPendingPlan(null);
    showFlash("✓ Saved to Records");
  };

  const handleKey = (e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} };

  // ── Global Search Engine ──────────────────────────────────────────────────
  const openSearch = () => { setSearchOpen(true); setSearchQuery(""); setSearchResults([]); setTimeout(()=>searchRef.current?.focus(),50); };
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); };

  // Build a flat, searchable index from all platform data
  const buildSearchIndex = () => {
    const idx = [];
    // Time log entries
    localEntries.forEach(e => idx.push({
      id: e.id, type:"entry", icon:"⏱",
      title: e.activity,
      meta: `${e.date} · ${e.categoryLabel} · ${e.qualifies?"RE":"Non-RE"} · ${fmtH(e.minutes)}`,
      tags: [e.category, e.categoryLabel, e.date, e.qualifies?"qualifying":"non-qualifying", e.flag_code||""].filter(Boolean),
      raw: `${e.activity} ${e.categoryLabel} ${e.date} ${e.notes||""} ${e.flag_note||""}`,
      action: ()=>{ setView("records"); closeSearch(); },
      badge: e.investor_warning||e.flag_code ? "⚑ flagged" : null,
      badgeColor: C.gold,
    }));
    // Emails
    localEmails.forEach(e => idx.push({
      id: e.id, type:"email", icon:"✉",
      title: e.subject,
      meta: `To: ${e.to} · ${e.date} · ${e.status}`,
      tags: [e.type, e.status, e.to],
      raw: `${e.subject} ${e.to} ${e.body||""} ${e.date}`,
      action: ()=>{ setView("comms"); closeSearch(); },
      badge: e.status==="draft" ? "draft" : null,
      badgeColor: C.blue,
    }));
    // Plans/notes
    localPlans.forEach(p => idx.push({
      id: p.id, type:"plan", icon:"📋",
      title: p.title,
      meta: `${p.date} · ${p.items?.length||0} items`,
      tags: ["notes","plans",p.date],
      raw: `${p.title} ${p.notes||""} ${(p.items||[]).join(" ")}`,
      action: ()=>{ setView("records"); closeSearch(); },
      badge: null,
    }));
    // Properties
    SAMPLE_PROPERTIES.forEach(p => idx.push({
      id: p.id, type:"property", icon:"⌂",
      title: p.name,
      meta: `${p.address} · ${p.type.replace("_"," ")} · ${p.units} unit${p.units>1?"s":""}`,
      tags: [p.type, p.address, "property"],
      raw: `${p.name} ${p.address} ${p.type}`,
      action: ()=>{ setView("properties"); closeSearch(); },
      badge: null,
    }));
    // Tenants
    SAMPLE_TENANTS.forEach(t => idx.push({
      id: t.id, type:"tenant", icon:"👤",
      title: t.name,
      meta: `${t.email} · ${t.phone} · Rent $${t.rent}/mo`,
      tags: ["tenant", t.email, t.phone],
      raw: `${t.name} ${t.email} ${t.phone}`,
      action: ()=>{ setView("properties"); closeSearch(); },
      badge: null,
    }));
    // Suppliers
    SAMPLE_SUPPLIERS.forEach(s => idx.push({
      id: s.id, type:"supplier", icon:"🔧",
      title: s.name,
      meta: `${s.type} · ${s.phone} · ${s.notes}`,
      tags: ["supplier", s.type, s.phone],
      raw: `${s.name} ${s.type} ${s.phone} ${s.notes}`,
      action: ()=>{ setView("properties"); closeSearch(); },
      badge: null,
    }));
    // IRS Rules
    IRS_RULES.forEach(r => idx.push({
      id: r.id, type:"rule", icon:"⚑",
      title: r.title,
      meta: `${r.code} · ${r.category} · Audit: ${r.auditRisk.split(" — ")[0]}`,
      tags: ["rule","irs",r.category,r.tier,r.code],
      raw: `${r.title} ${r.summary} ${r.code} ${r.category} ${r.traps.join(" ")}`,
      action: ()=>{ setView("rules"); closeSearch(); },
      badge: r.tier==="DISQUALIFIER"?"disqualifier":r.tier==="HIGH_EARNER"?"high earner":null,
      badgeColor: r.tier==="DISQUALIFIER"?C.red:C.gold,
    }));
    return idx;
  };

  const highlight = (text, query) => hlText(text, query);

  const runSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const idx = buildSearchIndex();
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = idx.map(item => {
      const haystack = item.raw.toLowerCase();
      const titleHit = item.title.toLowerCase().includes(q.toLowerCase());
      const allTerms = terms.every(t => haystack.includes(t));
      const someTerms = terms.some(t => haystack.includes(t));
      const tagHit = item.tags.some(tag => terms.some(t => tag.toLowerCase().includes(t)));
      const score = (titleHit ? 10 : 0) + (allTerms ? 5 : someTerms ? 2 : 0) + (tagHit ? 3 : 0);
      return { ...item, score };
    }).filter(r => r.score > 0).sort((a,b) => b.score - a.score).slice(0, 18);
    setSearchResults(scored);
  };

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e) => { if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();openSearch();} if(e.key==="Escape")closeSearch(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{fontFamily:"Georgia,serif",background:C.bg,minHeight:"100vh",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        textarea,input,select{font-family:'IBM Plex Mono',monospace;color:#0F2742;}
        textarea{resize:none;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#c8a860;border-radius:3px;}
        .nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 18px;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s;color:#6a5830;}
        .nav-item:hover{color:#e8c870;}
        .nav-item.active{color:#e8c870;border-bottom-color:#C6A24A;}
        .nav-icon{font-size:15px;}
        .nav-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;}
        .card{background:#fff;border:1px solid ${C.border};border-radius:3px;padding:20px;}
        .btn-gold{background:#C6A24A;border:none;color:#0F2742;font-weight:600;padding:10px 22px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:background .2s;}
        .btn-gold:hover{background:#d4b060;}
        .btn-green{background:${C.greenB};border:none;color:#fff;padding:10px 22px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;border-radius:2px;transition:background .2s;}
        .btn-green:hover{background:${C.green};}
        .btn-outline{background:#fff;border:1px solid ${C.border};color:${C.mid};padding:9px 18px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;border-radius:2px;transition:all .2s;}
        .btn-outline:hover{border-color:${C.gold};color:${C.gold};}
        .inp{background:#faf8f4;border:1px solid ${C.border};color:${C.text};padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;width:100%;border-radius:2px;transition:border-color .2s;}
        .inp:focus{border-color:#C6A24A;background:#fff;}
        .label{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4D6785;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:block;}
        .tag{display:inline-block;padding:2px 8px;background:#f0ece4;border:1px solid ${C.border};font-family:'IBM Plex Mono',monospace;font-size:10px;color:${C.mid};border-radius:2px;}
        .dot{animation:pulse 1.2s infinite;display:inline-block;width:7px;height:7px;background:#C6A24A;border-radius:50%;margin:0 2px;}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes slideUp{from{transform:translateY(7px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes flashIn{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fileIn{0%{transform:translateX(0) scale(1);opacity:1}60%{transform:translateX(30px) scale(.9);opacity:.7}100%{transform:translateX(0) scale(1);opacity:1}}
        .msg-in{animation:slideUp .22s ease;}
        .flash-toast{animation:flashIn .3s ease;}
        .chip{background:#fff;border:1px solid ${C.border};color:${C.mid};padding:6px 13px;border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap;transition:all .15s;}
        .chip:hover{border-color:#C6A24A;color:#9a7830;background:#faf3dc;}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
        .bar-bg{height:8px;background:#dde8f0;border-radius:4px;overflow:hidden;margin:8px 0 4px;}
        .tbl-head{display:grid;padding:9px 16px;background:#f5f0e8;border-bottom:1px solid ${C.border};}
        .tbl-row{display:grid;padding:11px 16px;border-bottom:1px solid ${C.borderL};transition:background .1s;}
        .tbl-row:hover{background:#faf8f4;}
        .tbl-cell{font-family:'IBM Plex Mono',monospace;font-size:11px;color:${C.text};}
        .tbl-hd{font-family:'IBM Plex Mono',monospace;font-size:9px;color:${C.light};letter-spacing:2px;text-transform:uppercase;}
        .send-btn{background:#C6A24A;border:none;color:#fff;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;box-shadow:0 2px 8px rgba(198,162,74,.4);}
        .send-btn:hover:not(:disabled){background:${C.goldL};}
        .send-btn:disabled{background:#8a9aaa;cursor:not-allowed;box-shadow:none;}
        .tab-btn{background:none;border:none;border-bottom:2px solid transparent;color:${C.light};padding:9px 20px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;transition:all .15s;}
        .tab-btn.active{color:#C6A24A;border-bottom-color:#C6A24A;}
        .tab-btn:hover{color:#C6A24A;}
        .file-anim{animation:fileIn .5s ease;}
        .pending-box{border-radius:4px;padding:16px 20px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;}
        @keyframes micPulse{0%,100%{box-shadow:0 0 8px rgba(198,162,74,.5)}50%{box-shadow:0 0 18px rgba(198,162,74,.9)}}
        .spouse-btn{padding:6px 16px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;border:1px solid #3a2a10;border-radius:2px;transition:all .15s;font-weight:500;letter-spacing:.5px;}
        .spouse-maria{background:#0d1e30;color:#C6A24A;}
        .spouse-carlos{background:#0a1525;color:#7a96b0;}
        .spouse-carlos.active{background:#1a1a3a;color:#9ab0e0;border-color:#3a3a7a;}
        .spouse-maria.active{background:#0F2742;color:#e8c870;border-color:#C6A24A;}
        .search-trigger{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(198,162,74,.3);border-radius:20px;padding:7px 16px;cursor:pointer;transition:all .2s;color:#7a96b0;font-family:'IBM Plex Mono',monospace;font-size:11px;}
        .search-trigger:hover{background:rgba(198,162,74,.12);border-color:#C6A24A;color:#e8c870;}
        .search-result-row{display:flex;gap:12px;align-items:flex-start;padding:12px 18px;cursor:pointer;border-bottom:1px solid #f0ece4;transition:background .1s;}
        .search-result-row:hover{background:#faf8f4;}
        .search-result-row.active-result{background:#faf3dc;}
        mark{background:#fdf0b0;color:#7a5c0a;font-weight:600;border-radius:2px;padding:0 2px;}
        @keyframes searchIn{from{opacity:0;transform:translateY(-12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        .search-palette{animation:searchIn .18s ease;}
      `}</style>

      {/* Toast */}
      {flash && (
        <div className="flash-toast" style={{position:"fixed",top:18,right:18,zIndex:1000,background:flash.type==="success"?C.greenPale:C.redPale,border:`1px solid ${flash.type==="success"?C.greenB:C.redB}`,color:flash.type==="success"?C.green:C.red,padding:"11px 20px",borderRadius:3,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,.12)"}}>
          {flash.msg}
        </div>
      )}

      {/* ══ SEARCH PALETTE OVERLAY ══ */}
      {searchOpen && (
        <div
          onClick={closeSearch}
          style={{position:"fixed",inset:0,background:"rgba(9,30,51,.72)",zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80,backdropFilter:"blur(3px)"}}>
          <div
            className="search-palette"
            onClick={e=>e.stopPropagation()}
            style={{width:"100%",maxWidth:680,background:"#fff",borderRadius:6,boxShadow:"0 24px 80px rgba(0,0,0,.35)",overflow:"hidden",border:"1px solid #e0dcd4"}}>

            {/* Search input row */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:"2px solid #C6A24A",background:"#faf8f4"}}>
              <svg width={18} height={18} viewBox="0 0 18 18" fill="none" style={{flexShrink:0}}>
                <circle cx={7} cy={7} r={5} stroke="#C6A24A" strokeWidth={2}/>
                <line x1={11} y1={11} x2={16} y2={16} stroke="#C6A24A" strokeWidth={2} strokeLinecap="round"/>
              </svg>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e=>runSearch(e.target.value)}
                placeholder="Search entries, emails, properties, tenants, rules..."
                style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'IBM Plex Mono',monospace",fontSize:14,color:"#0F2742",letterSpacing:.2}}
              />
              {searchQuery && (
                <button onClick={()=>{setSearchQuery("");setSearchResults([]);searchRef.current?.focus();}}
                  style={{background:"none",border:"none",cursor:"pointer",color:"#7a96b0",fontSize:16,lineHeight:1,padding:"0 4px"}}>✕</button>
              )}
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#9ab0c0",background:"#eef2f6",padding:"3px 8px",borderRadius:3,border:"1px solid #d4dde6",cursor:"pointer",flexShrink:0}} onClick={closeSearch}>esc</span>
            </div>

            {/* Results */}
            <div style={{maxHeight:420,overflowY:"auto"}}>
              {!searchQuery && (
                <div style={{padding:"20px 20px 14px"}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#9ab0c0",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Quick jump</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {[
                      {l:"Time Log",    icon:"⏱", action:()=>{setView("records");closeSearch();}},
                      {l:"Properties",  icon:"⌂", action:()=>{setView("properties");closeSearch();}},
                      {l:"Emails",      icon:"✉", action:()=>{setView("comms");closeSearch();}},
                      {l:"Dashboard",   icon:"◉", action:()=>{setView("dashboard");closeSearch();}},
                      {l:"Rules Engine",icon:"⚑", action:()=>{setView("rules");closeSearch();}},
                      {l:"CPA Portal",  icon:"⚖", action:()=>{setView("cpa");closeSearch();}},
                    ].map(q=>(
                      <button key={q.l} onClick={q.action}
                        style={{background:"#f5f2eb",border:"1px solid #e0dcd4",borderRadius:4,padding:"8px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4D6785",cursor:"pointer",display:"flex",gap:6,alignItems:"center",transition:"all .12s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#faf3dc";e.currentTarget.style.borderColor="#C6A24A";e.currentTarget.style.color="#9a7830";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="#f5f2eb";e.currentTarget.style.borderColor="#e0dcd4";e.currentTarget.style.color="#4D6785";}}>
                        <span>{q.icon}</span>{q.l}
                      </button>
                    ))}
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#b0bcc8",marginTop:20,textAlign:"center"}}>
                    Searching across {localEntries.length} entries · {localEmails.length} emails · {localPlans.length} notes · IRS rules · Properties
                  </div>
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div style={{padding:36,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:10}}>🔍</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:"#9ab0c0"}}>No results for <strong style={{color:"#4D6785"}}>"{searchQuery}"</strong></div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#b8c8d4",marginTop:6}}>Try different keywords, dates, or property names</div>
                </div>
              )}

              {searchQuery && searchResults.length > 0 && (
                <div>
                  {/* Group results by type */}
                  {["entry","email","plan","property","tenant","supplier","rule"].map(type=>{
                    const group = searchResults.filter(r=>r.type===type);
                    if (!group.length) return null;
                    const typeLabels = {entry:"Time Log",email:"Communications",plan:"Session Notes",property:"Properties",tenant:"Tenants",supplier:"Suppliers",rule:"IRS Rules"};
                    const typeBg     = {entry:C.greenPale,email:C.bluePale,plan:"#faf3dc",property:"#eef4ec",tenant:"#eef4ec",supplier:"#eef4ec",rule:"#f0ecf8"};
                    const typeColor  = {entry:C.green,email:C.blue,plan:C.gold,property:"#256b45",tenant:"#256b45",supplier:"#256b45",rule:"#3a2060"};
                    return (
                      <div key={type}>
                        <div style={{padding:"8px 18px 5px",background:"#f8f6f0",borderBottom:"1px solid #ede8e0"}}>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#9ab0c0"}}>{typeLabels[type]} · {group.length}</span>
                        </div>
                        {group.map(r=>(
                          <div key={r.id} className="search-result-row" onClick={r.action}>
                            <div style={{width:28,height:28,borderRadius:4,background:typeBg[r.type]||"#f5f2eb",border:`1px solid ${typeColor[r.type]||C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                              {r.icon}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,color:"#0F2742"}}
                                  dangerouslySetInnerHTML={{__html: hlText(r.title, searchQuery)}}>
                                </span>
                                {r.badge && (
                                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,padding:"1px 6px",borderRadius:2,background:r.badgeColor==="red"?C.redPale:C.goldPale,color:r.badgeColor==="red"?C.red:C.gold,border:`1px solid ${r.badgeColor==="red"?C.redB:C.goldL}`}}>
                                    {r.badge}
                                  </span>
                                )}
                              </div>
                              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#7a96b0",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}
                                dangerouslySetInnerHTML={{__html: hlText(r.meta, searchQuery)}}>
                              </div>
                            </div>
                            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{flexShrink:0,opacity:.3}}>
                              <polyline points="5,3 9,7 5,11" stroke="#0F2742" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <div style={{padding:"10px 18px",background:"#f8f6f0",borderTop:"1px solid #ede8e0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#b0bcc8"}}>{searchResults.length} result{searchResults.length!==1?"s":""} for "{searchQuery}"</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#b0bcc8"}}>↵ to navigate</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#091e33",borderBottom:"3px solid #C6A24A"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0 0"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {/* RepTrack Ledger Roof Mark — SVG icon */}
                <div style={{width:40,height:40,background:C.dark,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid #C6A24A"}}>
                  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
                    {/* Roof line */}
                    <polyline points="3,14 14,4 25,14" stroke="#C6A24A" strokeWidth={2.2} strokeLinejoin="round" fill="none"/>
                    {/* Ledger lines */}
                    <line x1={6} y1={17} x2={22} y2={17} stroke="#7a96b0" strokeWidth={1.6} strokeLinecap="round"/>
                    <line x1={7} y1={20} x2={21} y2={20} stroke="#7a96b0" strokeWidth={1.2} strokeLinecap="round"/>
                    {/* Trend arrow */}
                    <polyline points="7,19 12,14 17,16 22,10" stroke="#C6A24A" strokeWidth={1.8} strokeLinejoin="round" fill="none"/>
                    <polyline points="20,9 22,10 21,12" stroke="#C6A24A" strokeWidth={1.8} strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <div>
                  <div style={{fontFamily:"'Inter','Helvetica Neue',sans-serif",fontSize:22,fontWeight:700,color:"#ffffff",letterSpacing:-.3}}>RepTrack</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#C6A24A",letterSpacing:2,marginTop:1}}>WHERE WORK BECOMES PROOF</div>
                </div>
              </div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#3d5a78",letterSpacing:1.5,marginTop:4}}>IRC §469(c)(7) · CAPTURE THE WORK · PROVE THE TIME · DEFEND THE CLAIM</div>
            </div>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              {/* File-to indicator */}
              {fileAnim && (
                <div className="file-anim" style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.goldL,padding:"5px 12px",background:"#091e33",border:`1px solid ${C.goldL}`,borderRadius:2}}>
                  → Filing to {fileAnim}...
                </div>
              )}
              {/* Spouse Sync Toggle */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5570",letterSpacing:1.5,textTransform:"uppercase"}}>Spouse Sync</div>
                <div style={{display:"flex",border:"1px solid #3a2a10",borderRadius:3,overflow:"hidden"}}>
                  <button className={`spouse-btn spouse-maria ${activeSpouse==="maria"?"active":""}`} onClick={()=>setActiveSpouse("maria")}>
                    Maria
                  </button>
                  <button className={`spouse-btn spouse-carlos ${activeSpouse==="carlos"?"active":""}`} onClick={()=>{setActiveSpouse("carlos");showFlash("Viewing Dr. Carlos Rodriguez — non-qualifying log");}}>
                    Dr. Carlos
                  </button>
                </div>
                {activeSpouse==="carlos" && (
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#6a5060",letterSpacing:.5,textAlign:"center"}}>Non-qualifying view</div>
                )}
              </div>
              <div style={{width:1,height:40,background:"#0a1a2e"}}/>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5570",letterSpacing:1}}>QUALIFIER</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:activeSpouse==="maria"?C.goldBright:"#a0bcd0",fontWeight:500}}>
                  {activeSpouse==="maria"?"Maria Rodriguez":"Dr. Carlos Rodriguez"}
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#2a4560"}}>
                  {activeSpouse==="maria"?"MFJ Qualifier":"W-2 Physician — non-qualifying"}
                </div>
              </div>
              <div style={{width:1,height:36,background:"#0a1a2e"}}/>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5570"}}>RE HRS FILED</div>
                <div style={{display:"flex",alignItems:"baseline",gap:3,justifyContent:"flex-end"}}>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:24,color:c1?"#3aaf75":C.goldBright,fontWeight:700,lineHeight:1}}>{reHrs}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4a6a8a"}}>/750</span>
                </div>
              </div>
              <div style={{width:1,height:36,background:"#0a1a2e"}}/>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5570"}}>RE SPLIT</div>
                <div style={{display:"flex",alignItems:"baseline",gap:2,justifyContent:"flex-end"}}>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:24,color:c2?"#3aaf75":C.goldBright,fontWeight:700,lineHeight:1}}>{rePct.toFixed(0)}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4a6a8a"}}>%</span>
                </div>
              </div>
              <div style={{width:1,height:36,background:"#0a1a2e"}}/>
              <div style={{padding:"6px 14px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,background:c1&&c2?C.greenPale:c1||c2?"#faf3dc":C.redPale,border:`1px solid ${c1&&c2?C.greenB:c1||c2?C.goldL:C.redB}`,color:c1&&c2?C.green:c1||c2?C.gold:C.red}}>
                {c1&&c2?"✦ CRITERIA MET":c1||c2?"◐ PARTIAL":"✕ INCOMPLETE"}
              </div>
              <div style={{width:1,height:36,background:"#0a1a2e"}}/>
              {/* Search trigger */}
              <button className="search-trigger" onClick={openSearch} title="Search everything (⌘K)">
                <svg width={13} height={13} viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
                  <circle cx={5.5} cy={5.5} r={4} stroke="#C6A24A" strokeWidth={1.6}/>
                  <line x1={9} y1={9} x2={13} y2={13} stroke="#C6A24A" strokeWidth={1.6} strokeLinecap="round"/>
                </svg>
                <span>Search</span>
                <span style={{background:"rgba(198,162,74,.15)",border:"1px solid rgba(198,162,74,.25)",borderRadius:3,padding:"1px 5px",fontSize:9,letterSpacing:.5,color:"#C6A24A"}}>⌘K</span>
              </button>
            </div>
          </div>
          <nav style={{display:"flex",gap:0,marginTop:8}}>
            {VIEWS.map(v=>(
              <button key={v.id} className={`nav-item ${view===v.id?"active":""}`} onClick={()=>setView(v.id)}>
                <span className="nav-icon">{v.icon}</span>
                <span className="nav-label">{v.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1160,margin:"0 auto",padding:"20px"}}>

        {/* ══ ASSISTANT ══ */}
        {view==="assistant" && (
          <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>

            {/* Left — chat */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:12}}>

              {/* Role disclaimer + spouse context */}
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1,background:"#faf5e4",border:`1px solid ${C.goldL}`,borderRadius:3,padding:"10px 16px",display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:16}}>🗂</span>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>
                    <strong style={{color:C.goldL}}>RepTrack Assistant</strong> — I capture your work, organize it, and keep it ready to defend. For tax questions, contact your CPA.
                  </div>
                </div>
                {activeSpouse==="carlos" && (
                  <div style={{background:"#0f0f2a",border:"1px solid #3a3a8a",borderRadius:3,padding:"10px 16px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    <span style={{fontSize:14}}>⚕</span>
                    <div>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:"#a0bcd0",letterSpacing:1}}>DR. CARLOS LOG</div>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#5a5a8a"}}>Non-qualifying · W-2</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pending confirmations */}
              {pendingLog && (
                <div style={{borderRadius:4,overflow:"hidden",border:`1px solid ${pendingLog.investor_warning?"#C6A24A":pendingLog.qualifies?C.greenB:C.redB}`,marginBottom:2}}>
                  <div style={{background:pendingLog.investor_warning?C.goldPale:pendingLog.qualifies?C.greenPale:C.redPale,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:pendingLog.investor_warning?C.gold:pendingLog.qualifies?C.green:C.red,letterSpacing:1,marginBottom:7}}>
                        {pendingLog.investor_warning?"→ FILING UNDER RE RECORDS  ·  ⚠ FLAG ATTACHED":pendingLog.qualifies?"→ FILING UNDER RE RECORDS":"→ FILING UNDER NON-RE RECORDS"}
                      </div>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.text,fontWeight:500,marginBottom:5}}>{pendingLog.activity}</div>
                      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:5}}>
                        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid}}>⏱ {fmtH(pendingLog.minutes)}</span>
                        <span className="tag">{pendingLog.categoryLabel}</span>
                        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>{pendingLog.date}</span>
                      </div>
                      {pendingLog.filing && <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,fontStyle:"italic"}}>{pendingLog.filing}</div>}
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button className="btn-green" onClick={confirmLog}>✓ Confirm & File</button>
                      <button className="btn-outline" onClick={()=>setPendingLog(null)}>Discard</button>
                    </div>
                  </div>
                  {pendingLog.investor_warning && (
                    <div style={{background:"#0a1828",borderTop:"1px solid #C6A24A",padding:"13px 20px",display:"flex",gap:12,alignItems:"flex-start"}}>
                      <span style={{fontSize:18,flexShrink:0,lineHeight:1.3}}>⚠</span>
                      <div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:"#C6A24A",letterSpacing:1.5,marginBottom:6,textTransform:"uppercase"}}>Investor Activity Flag — Discuss with Your CPA</div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#C6A24A",lineHeight:1.75}}>
                          {pendingLog.warning_note || "The IRS may classify this as an Investor Activity, which does not count toward Material Participation unless you are involved in day-to-day management. This record will be filed and flagged. Please review with your CPA or tax attorney."}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pendingEmail && (
                <div className="pending-box" style={{background:C.bluePale,border:`1px solid ${C.blueB}`}}>
                  <div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:C.blue,letterSpacing:1,marginBottom:6}}>→ SAVING TO COMMUNICATIONS</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.text,fontWeight:500}}>{pendingEmail.subject}</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid,marginTop:3}}>To: {pendingEmail.to||"(fill in recipient)"} · {pendingEmail.type}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn-gold" onClick={confirmEmail}>Save to Drafts</button>
                    <button className="btn-outline" onClick={()=>setPendingEmail(null)}>Discard</button>
                  </div>
                </div>
              )}

              {pendingPlan && (
                <div className="pending-box" style={{background:C.goldPale,border:`1px solid ${C.goldL}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:C.gold,letterSpacing:1,marginBottom:6}}>→ SAVING TO RECORDS</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.text,fontWeight:500,marginBottom:6}}>{pendingPlan.title}</div>
                    {pendingPlan.items?.slice(0,3).map((item,i)=>(
                      <div key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid,marginBottom:3}}>▸ {item}</div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn-gold" onClick={confirmPlan}>Save to Records</button>
                    <button className="btn-outline" onClick={()=>setPendingPlan(null)}>Discard</button>
                  </div>
                </div>
              )}

              {/* Chat */}
              <div style={{background:"#faf7f2",border:`1px solid ${C.border}`,borderRadius:4,padding:20,height:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
                {messages.map(msg=>(
                  <div key={msg.id} className="msg-in" style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"82%",background:msg.role==="user"?C.dark:C.white,border:`1px solid ${msg.role==="user"?"transparent":C.border}`,borderRadius:msg.role==="user"?"16px 16px 4px 16px":"4px 16px 16px 16px",padding:"12px 16px",boxShadow:msg.role==="user"?"none":"0 1px 6px rgba(0,0,0,.05)"}}>
                      {msg.role==="assistant" && (
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.goldL,letterSpacing:2,textTransform:"uppercase"}}>ASSISTANT</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#3a3030",letterSpacing:1}}>· organizational only</span>
                        </div>
                      )}
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,lineHeight:1.78,color:msg.role==="user"?C.goldBright:C.text,whiteSpace:"pre-wrap"}}>{msg.content}</div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{display:"flex"}}>
                    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:"4px 16px 16px 16px",padding:"13px 20px"}}>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.goldL,letterSpacing:2,marginBottom:8}}>FILING...</div>
                      <span className="dot"/><span className="dot"/><span className="dot"/>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>

              {/* Quick actions */}
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[
                  "I reviewed leases for 2 hours",
                  "45-min contractor call about Oak St",
                  "Log Dr. Rodriguez's physician shift",
                  "Draft email to Kowalski Plumbing about invoice",
                  "Summarize today into organized notes",
                  "I had a 1-hour investor meeting reviewing portfolio performance",
                ].map(q=>(
                  <button key={q} className="chip" onClick={()=>{setInput(q);inputRef.current?.focus();}}>{q}</button>
                ))}
              </div>

              {/* OpenAI key prompt — shown inline when key missing */}
              {showKeyInput && (
                <div style={{background:"#091e33",border:"1px solid #C6A24A",borderRadius:4,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#C6A24A",fontWeight:600,letterSpacing:1}}>🎙 WHISPER API KEY REQUIRED</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#a08040",lineHeight:1.7}}>
                    Enter your OpenAI API key to enable Whisper transcription. Your key is used only in-browser — never sent to our servers.
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input
                      type="password"
                      className="inp"
                      placeholder="sk-..."
                      value={whisperKey}
                      onChange={e=>setWhisperKey(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&whisperKey.trim()){setShowKeyInput(false);startRecording();}}}
                      style={{flex:1,fontSize:12}}
                    />
                    <button className="btn-gold" style={{whiteSpace:"nowrap",padding:"8px 16px"}}
                      onClick={()=>{if(whisperKey.trim()){setShowKeyInput(false);startRecording();}}}>
                      Save & Record
                    </button>
                    <button className="btn-outline" style={{padding:"8px 12px"}} onClick={()=>setShowKeyInput(false)}>✕</button>
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#5a4020"}}>
                    Key is held in component state only. Refresh page to clear it. Get a key at platform.openai.com
                  </div>
                </div>
              )}

              {/* Input */}
              <div style={{position:"relative"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-end",
                  background: isRecording ? "#1a1000" : whisperStatus==="transcribing" ? "#f5f8ff" : C.white,
                  border:`1px solid ${isRecording?"#C6A24A":whisperStatus==="transcribing"?C.blueB:whisperStatus==="error"?C.redB:C.border}`,
                  borderRadius:4,padding:"10px 14px 10px 52px",
                  boxShadow: isRecording?"0 0 0 3px rgba(201,134,10,.25)":whisperStatus==="transcribing"?"0 0 0 2px rgba(45,94,154,.2)":"0 2px 10px rgba(0,0,0,.04)",
                  transition:"all .2s"}}>
                  <textarea ref={inputRef} rows={2} className="inp"
                    style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,lineHeight:1.65,
                      color: isRecording?"#C6A24A":C.text}}
                    placeholder={
                      isRecording         ? "🔴 Recording... tap mic to stop and transcribe" :
                      whisperStatus==="transcribing" ? "⏳ Transcribing with Whisper..." :
                      "Tell me what you worked on and I'll file it. Or say 'draft email to...' and I'll write it."
                    }
                    value={input}
                    onChange={e=>setInput(e.target.value)}
                    onKeyDown={handleKey}
                    readOnly={isRecording || whisperStatus==="transcribing"}
                  />
                  <button className="send-btn" onClick={sendMessage}
                    disabled={loading||!input.trim()||isRecording||whisperStatus==="transcribing"}>
                    {loading?"⋯":"↑"}
                  </button>
                </div>

                {/* Floating gold Whisper mic button */}
                <button
                  onClick={handleMicClick}
                  disabled={whisperStatus==="transcribing"}
                  title={isRecording?"Stop & transcribe with Whisper":whisperKey?"Record (Whisper)":"Add OpenAI key to enable Whisper"}
                  style={{
                    position:"absolute",left:8,bottom:10,
                    width:34,height:34,borderRadius:"50%",
                    border:`2px solid ${isRecording?"#ff4040":whisperStatus==="transcribing"?C.blueB:C.goldL}`,
                    background: isRecording?"#c0180a" : whisperStatus==="transcribing"?C.bluePale : whisperKey?C.gold:C.goldPale,
                    cursor: whisperStatus==="transcribing"?"not-allowed":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:15,transition:"all .25s",
                    boxShadow: isRecording
                      ? "0 0 0 4px rgba(192,24,10,.3), 0 0 16px rgba(255,60,10,.5)"
                      : whisperKey ? "0 2px 8px rgba(139,94,10,.4)" : "0 1px 4px rgba(0,0,0,.1)",
                    animation: isRecording ? "micPulse 0.8s infinite" : "none",
                    opacity: whisperStatus==="transcribing" ? 0.5 : 1,
                  }}>
                  {isRecording ? "⏹" : whisperStatus==="transcribing" ? "⋯" : "🎙"}
                </button>

                {/* Status label below mic */}
                {(isRecording || whisperStatus) && (
                  <div style={{position:"absolute",left:46,bottom:-20,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:.8,
                    color: isRecording?"#ff6040":whisperStatus==="transcribing"?C.blueB:whisperStatus==="error"?C.red:"#888"}}>
                    {isRecording
                      ? "● REC — tap ⏹ to transcribe"
                      : whisperStatus==="transcribing"
                        ? "⋯ Whisper transcribing..."
                        : whisperStatus==="error"
                          ? "✕ Transcription failed"
                          : ""}
                  </div>
                )}
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:isRecording||whisperStatus?12:2}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.lighter}}>
                  Enter to send · Shift+Enter new line · 🎙 Whisper · RepTrack
                </div>
                {/* Key status chip */}
                <button
                  onClick={()=>setShowKeyInput(true)}
                  style={{background:"none",border:`1px solid ${whisperKey?C.greenB:C.border}`,borderRadius:10,
                    padding:"2px 9px",fontFamily:"'IBM Plex Mono',monospace",fontSize:9,cursor:"pointer",
                    color:whisperKey?C.green:C.lighter,transition:"all .15s"}}>
                  {whisperKey ? "🎙 Whisper ready" : "🔑 Add Whisper key"}
                </button>
              </div>
            </div>

            {/* Right sidebar — file structure */}
            <div style={{width:240,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.light,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>File Structure</div>

              {/* RE Records folder */}
              <div className="card" style={{borderLeft:`3px solid ${C.greenB}`,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.green,fontWeight:600}}>📁 RE Records</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.green,background:C.greenPale,padding:"2px 7px",borderRadius:2,border:`1px solid ${C.greenB}`}}>{reEntries.length}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:21,color:C.green,fontWeight:700,marginBottom:2}}>{fmtH(totalREMins)}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>qualifying RE activities</div>
              </div>

              {/* Non-RE folder */}
              <div className="card" style={{borderLeft:`3px solid ${C.redB}`,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.red,fontWeight:600}}>📁 Non-RE Records</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.red,background:C.redPale,padding:"2px 7px",borderRadius:2,border:`1px solid ${C.redB}`}}>{localEntries.filter(e=>!e.qualifies).length}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:21,color:C.red,fontWeight:700,marginBottom:2}}>{fmtH(nonREMins)}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>other work recorded</div>
              </div>

              {/* Communications folder */}
              <div className="card" style={{borderLeft:`3px solid ${C.blueB}`,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.blue,fontWeight:600}}>📁 Communications</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.blue,background:C.bluePale,padding:"2px 7px",borderRadius:2,border:`1px solid ${C.blueB}`}}>{localEmails.length}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,marginBottom:4}}>{localEmails.filter(e=>e.status==="sent").length} sent · {localEmails.filter(e=>e.status==="draft").length} draft</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>emails to suppliers & tenants</div>
              </div>

              {/* Notes & Plans folder */}
              <div className="card" style={{borderLeft:`3px solid ${C.goldL}`,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.gold,fontWeight:600}}>📁 Notes & Plans</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.gold,background:C.goldPale,padding:"2px 7px",borderRadius:2,border:`1px solid ${C.goldL}`}}>{localPlans.length}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>session summaries & task notes</div>
              </div>

              {/* Split ratio */}
              <div className="card" style={{padding:"14px 16px",background:C.darker,border:"none"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#4D6785",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>Time Split</div>
                <div style={{height:8,background:"#0a1a2e",borderRadius:4,overflow:"hidden",marginBottom:8}}>
                  <div style={{height:"100%",width:`${Math.min(rePct,100)}%`,background:"linear-gradient(90deg,#2d7a4a,#4caf80)",borderRadius:4,transition:"width .6s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#3aaf75"}}>{rePct.toFixed(0)}% RE</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.redB}}>{(100-rePct).toFixed(0)}% Non-RE</span>
                </div>
              </div>

              {/* Carlos log summary card */}
              <div className="card" style={{padding:"14px 16px",background:"#091525",border:"1px solid #1a3a5a"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#7a96b0",fontWeight:600}}>📁 Dr. Carlos Log</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#3a6080",background:"#0d1e30",padding:"2px 7px",borderRadius:2,border:"1px solid #2a2a7a"}}>{carlosEntries.length}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:19,color:"#a0bcd0",fontWeight:700,marginBottom:2}}>{fmtH(carlosMins)}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4D6785",marginBottom:8}}>W-2 physician work · non-qualifying</div>
                <button onClick={()=>setActiveSpouse("carlos")} style={{background:"none",border:"1px solid #2a2a7a",color:"#7a96b0",padding:"5px 10px",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,cursor:"pointer",borderRadius:2,width:"100%"}}>
                  Switch to Dr. Carlos →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {view==="dashboard" && <DashboardView localEntries={localEntries} reEntries={reEntries} totalREMins={totalREMins} nonREMins={nonREMins} totalMins={totalMins} rePct={rePct} reHrs={reHrs} c1={c1} c2={c2} setView={setView} localEmails={localEmails} localPlans={localPlans}/>}

        {/* ══ RECORDS ══ */}
        {view==="records" && <RecordsView localEntries={localEntries} setLocalEntries={setLocalEntries} localPlans={localPlans} showFlash={showFlash}/>}

        {/* ══ PROPERTIES ══ */}
        {view==="properties" && <PropertiesView setView={setView} setInput={setInput} showFlash={showFlash}/>}

        {/* ══ COMMS ══ */}
        {view==="comms" && <CommsView emails={localEmails} setEmails={setLocalEmails} showFlash={showFlash} setView={setView} setInput={setInput}/>}

        {/* ══ RULES ENGINE ══ */}
        {view==="rules" && <RulesEngine localEntries={localEntries} reHrs={reHrs} rePct={rePct} c1={c1} c2={c2} setView={setView}/>}

        {/* ══ CPA PORTAL ══ */}
        {view==="cpa" && <CPAPortal localEntries={localEntries} localEmails={localEmails} localPlans={localPlans} reHrs={reHrs} rePct={rePct} c1={c1} c2={c2} showFlash={showFlash}/>}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function AuditGauge({score}) {
  // SVG half-circle gauge
  const r = 54, cx = 70, cy = 68;
  const circumference = Math.PI * r; // half circle
  const pct = Math.min(Math.max(score,0),100) / 100;
  const dashOffset = circumference * (1 - pct);
  const color = score >= 80 ? "#2d7a4a" : score >= 55 ? "#C6A24A" : "#b03030";
  const label = score >= 80 ? "STRONG" : score >= 55 ? "MODERATE" : "NEEDS WORK";
  const labelColor = score >= 80 ? "#3aaf75" : score >= 55 ? "#C6A24A" : "#e05050";
  // needle angle: -180deg (left) to 0deg (right), mapped from 0-100
  const needleAngle = -180 + (pct * 180);
  const rad = (needleAngle * Math.PI) / 180;
  const nx = cx + (r - 8) * Math.cos(rad);
  const ny = cy + (r - 8) * Math.sin(rad);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
      <svg width={140} height={80} viewBox="0 0 140 80">
        {/* Track */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke="#dde8f0" strokeWidth={10} strokeLinecap="round"/>
        {/* Colored arc */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{transition:"stroke-dashoffset .8s ease, stroke .4s"}}/>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="#0F2742" strokeWidth={2.5} strokeLinecap="round"
          style={{transition:"x2 .8s ease, y2 .8s ease"}}/>
        <circle cx={cx} cy={cy} r={4} fill="#0F2742"/>
        {/* Score text */}
        <text x={cx} y={cy-10} textAnchor="middle" fontFamily="'Inter',sans-serif"
          fontSize={22} fontWeight={700} fill={color}>{score}</text>
      </svg>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:labelColor,letterSpacing:2,marginTop:-4}}>{label}</div>
    </div>
  );
}

function computeAuditScore(entries, emails, plans) {
  let score = 0;
  const re = entries.filter(e=>e.qualifies);
  const reHrs = Math.floor(re.reduce((s,e)=>s+e.minutes,0)/60);
  const total = entries.reduce((s,e)=>s+e.minutes,0);
  const rePct = total > 0 ? (re.reduce((s,e)=>s+e.minutes,0)/total)*100 : 0;

  // 1. Volume of entries (max 20pts)
  score += Math.min(entries.length * 1.2, 20);
  // 2. 750-hour threshold progress (max 20pts)
  score += Math.min((reHrs / 750) * 20, 20);
  // 3. RE% above 50% (max 15pts)
  if (rePct >= 50) score += 15; else score += (rePct / 50) * 10;
  // 4. Specificity: entries with long descriptions (max 10pts)
  const specific = re.filter(e => e.activity && e.activity.length > 35).length;
  score += Math.min((specific / Math.max(re.length,1)) * 10, 10);
  // 5. Category diversity (max 10pts)
  const cats = new Set(re.map(e=>e.category)).size;
  score += Math.min(cats * 1.5, 10);
  // 6. Notes attached (max 5pts)
  const withNotes = entries.filter(e=>e.notes && e.notes.length > 5).length;
  score += Math.min((withNotes / Math.max(entries.length,1)) * 5, 5);
  // 7. Communications filed (max 10pts)
  score += Math.min(emails.length * 2.5, 10);
  // 8. Action plans / session notes (max 10pts)
  score += Math.min(plans.length * 3.5, 10);
  // Penalty: investor warnings present
  const flagged = entries.filter(e=>e.investor_warning).length;
  score -= flagged * 2;

  return Math.round(Math.min(Math.max(score, 0), 100));
}

function DashboardView({localEntries,reEntries,totalREMins,nonREMins,totalMins,rePct,reHrs,c1,c2,setView,localEmails,localPlans}) {
  const byCategory = useMemo(()=>{
    const m={};reEntries.forEach(e=>{m[e.category]=(m[e.category]||0)+e.minutes;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[reEntries]);
  const catLabel = {management:"Property Management",financial_mgmt:"Financial Management",acquisition:"Acquisition",maintenance:"Maintenance & Repairs",leasing:"Leasing",rental_ops:"Rental Operations",legal_admin:"Legal & Administrative",vendor_mgmt:"Vendor Coordination",construction:"Construction"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Criteria */}
      <div className="g2">
        {[
          {title:"750-Hour Record",sub:"RE hours filed for tax year 2024",value:reHrs,suffix:"/ 750 hrs",pct:(reHrs/750)*100,met:c1,detail:c1?`${reHrs-750} hrs above threshold`:`${750-reHrs} hrs remaining`},
          {title:"Time Split Record",sub:"RE as % of Maria's total logged work time",value:`${rePct.toFixed(1)}%`,suffix:"of total",pct:rePct,met:c2,detail:`${fmtH(totalREMins)} RE · ${fmtH(nonREMins)} non-RE · ${fmtH(totalMins)} total`}
        ].map(card=>(
          <div key={card.title} className="card" style={{borderLeft:`4px solid ${card.met?C.greenB:C.redB}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div className="label" style={{marginBottom:3}}>{card.title}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>{card.sub}</div>
              </div>
              <span style={{padding:"4px 11px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,background:card.met?C.greenPale:C.redPale,border:`1px solid ${card.met?C.greenB:C.redB}`,color:card.met?C.green:C.red,whiteSpace:"nowrap",alignSelf:"flex-start"}}>{card.met?"ON FILE ✓":"INCOMPLETE"}</span>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:48,fontWeight:700,fontFamily:"'Inter',sans-serif",color:card.met?C.green:C.red,lineHeight:1.05}}>{card.value}</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.light}}>{card.suffix}</span>
            </div>
            <div className="bar-bg"><div style={{height:"100%",width:`${Math.min(card.pct,100)}%`,background:card.met?"linear-gradient(90deg,#2d7a4a,#4caf80)":"linear-gradient(90deg,#b03030,#e05050)",borderRadius:4,transition:"width .7s"}}/></div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>{card.detail}</div>
          </div>
        ))}
      </div>

      {/* MFJ note */}
      <div style={{background:C.goldPale,border:`1px solid ${C.goldL}`,borderRadius:3,padding:"12px 18px",display:"flex",gap:12,alignItems:"flex-start"}}>
        <span style={{fontSize:16,flexShrink:0,marginTop:1}}>⚖</span>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid,lineHeight:1.7}}>
          <strong style={{color:C.gold}}>Married Filing Jointly — File Organization:</strong> Maria Rodriguez's hours are filed under RE Records. Dr. Carlos Rodriguez's physician hours are filed separately under Non-RE Records to maintain an accurate time split. Consult your CPA for tax interpretation.
        </div>
      </div>

      {/* Audit Readiness Score */}
      {(()=>{
        const score = computeAuditScore(localEntries, localEmails, localPlans);
        const factors = [
          {label:"Entries logged", met: localEntries.length >= 10,  note: `${localEntries.length} entries`},
          {label:"RE hours on file", met: reHrs >= 500,              note: `${reHrs} hrs`},
          {label:"RE % above 50%",  met: rePct >= 50,               note: `${rePct.toFixed(0)}%`},
          {label:"Specific descriptions", met: localEntries.filter(e=>e.activity?.length>35).length >= 5, note: `${localEntries.filter(e=>e.activity?.length>35).length} detailed`},
          {label:"Communications filed",  met: localEmails.length >= 2, note: `${localEmails.length} emails`},
          {label:"Session notes saved",   met: localPlans.length >= 1,  note: `${localPlans.length} plans`},
          {label:"No investor flags",     met: !localEntries.some(e=>e.investor_warning), note: localEntries.filter(e=>e.investor_warning).length > 0 ? `${localEntries.filter(e=>e.investor_warning).length} flagged` : "Clean"},
        ];
        return (
          <div className="card" style={{borderLeft:`4px solid ${score>=80?"#2d7a4a":score>=55?"#C6A24A":"#b03030"}`}}>
            <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,minWidth:160}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4D6785",letterSpacing:2,textTransform:"uppercase"}}>Audit Readiness Score</div>
                <AuditGauge score={score}/>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#9a8a68",textAlign:"center",lineHeight:1.5}}>Based on documentation<br/>completeness only</div>
              </div>
              <div style={{flex:1,minWidth:260}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4D6785",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Documentation Factors</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 16px"}}>
                  {factors.map(f=>(
                    <div key={f.label} style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:13,flexShrink:0,color:f.met?"#2d7a4a":"#c8b0a0"}}>{f.met?"✓":"○"}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:f.met?"#0F2742":"#9a8a68"}}>{f.label}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:f.met?"#C6A24A":"#bbb",marginLeft:"auto",whiteSpace:"nowrap"}}>{f.note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"#f8f6f2",border:"1px solid #e8e0d0",borderRadius:3,padding:"12px 14px",minWidth:200,maxWidth:230}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#9a8a68",letterSpacing:1.5,marginBottom:8,textTransform:"uppercase"}}>What this means</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#2d4a6a",lineHeight:1.75}}>
                  {score>=80?"Your documentation looks thorough. Share this record with your CPA for review.":score>=55?"Good progress. Add more detailed activity descriptions and session notes to strengthen your file.":"Your documentation needs more entries and detail. Log activities regularly for a stronger record."}
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#bbb",marginTop:8,lineHeight:1.5}}>This score reflects documentation completeness only — not actual IRS audit risk. Consult your CPA.</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats row */}
      <div className="g4">
        {[
          {label:"RE Entries Filed",val:reEntries.length,sub:"activities on record"},
          {label:"Non-RE Entries",val:localEntries.filter(e=>!e.qualifies).length,sub:"other work recorded"},
          {label:"Properties",val:SAMPLE_PROPERTIES.length,sub:"in portfolio"},
          {label:"RE Hours Filed",val:fmtH(totalREMins),sub:"this year"},
        ].map(s=>(
          <div key={s.label} className="card" style={{textAlign:"center"}}>
            <div className="label" style={{marginBottom:8}}>{s.label}</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:26,color:C.gold,fontWeight:700,marginBottom:3}}>{s.val}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.lighter}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Category + Recent */}
      <div className="g2">
        <div className="card">
          <div className="label" style={{marginBottom:16}}>RE Hours by Filing Category</div>
          {byCategory.map(([catId,mins])=>{
            const pct=totalREMins>0?(mins/totalREMins)*100:0;
            return(
              <div key={catId} style={{marginBottom:13}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.text}}>{catLabel[catId]||catId}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.gold,fontWeight:500}}>{fmtH(mins)}</span>
                </div>
                <div className="bar-bg" style={{margin:"2px 0"}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#C6A24A,#C6A24A)",borderRadius:4}}/></div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="label" style={{marginBottom:16}}>Recently Filed</div>
          {[...localEntries].reverse().slice(0,8).map(e=>(
            <div key={e.id} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.borderL}`}}>
              <span style={{padding:"2px 6px",borderRadius:2,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,background:e.qualifies?C.greenPale:C.redPale,color:e.qualifies?C.green:C.red,border:`1px solid ${e.qualifies?C.greenB:C.redB}`,flexShrink:0,marginTop:1}}>{e.qualifies?"RE":"—"}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.text,marginBottom:2,lineHeight:1.4}}>{e.activity}</div>
                <div style={{display:"flex",gap:10}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{e.date}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.gold}}>{fmtH(e.minutes)}</span>
                </div>
              </div>
            </div>
          ))}
          <button className="btn-outline" style={{width:"100%",marginTop:4}} onClick={()=>setView("records")}>View All Records →</button>
        </div>
      </div>
    </div>
  );
}

// ── RECORDS ───────────────────────────────────────────────────────────────────
function RecordsView({localEntries,setLocalEntries,localPlans,showFlash}) {
  const [tab,setTab]=useState("timelog");
  const [filterMonth,setFilterMonth]=useState("");
  const filtered=filterMonth?localEntries.filter(e=>e.date.startsWith(filterMonth)):localEntries;

  const downloadCSV=()=>{
    const rows=[["Date","Filed As","Category","Activity","Minutes","Notes","CPA Flag"]];
    localEntries.forEach(e=>rows.push([e.date,e.qualifies?"RE Record":"Non-RE Record",e.categoryLabel,`"${e.activity}"`,e.minutes,`"${e.notes||""}"`,e.investor_warning?"INVESTOR ACTIVITY FLAG — REVIEW WITH CPA":""]));
    const csv=rows.map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="RepTrack-Records-2024.csv";a.click();
    showFlash("✓ CSV downloaded");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:19,fontWeight:600,color:C.dark}}>Records</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginTop:3}}>All captured work · Organized · Ready to defend</div>
        </div>
        <button className="btn-outline" onClick={downloadCSV}>↓ Export CSV</button>
      </div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`}}>
        {[{id:"timelog",l:"Time Log"},{id:"plans",l:"Notes & Plans"},{id:"audit",l:"Audit Summary"}].map(t=>(
          <button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {tab==="timelog"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-end"}}>
            <div><label className="label">Filter by Month</label><input type="month" className="inp" style={{width:"auto"}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}/></div>
            {filterMonth&&<button className="btn-outline" style={{marginBottom:1}} onClick={()=>setFilterMonth("")}>Clear</button>}
            <div style={{marginLeft:"auto",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,alignSelf:"flex-end"}}>{filtered.length} entries · {fmtH(filtered.reduce((s,e)=>s+e.minutes,0))}</div>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div className="tbl-head" style={{gridTemplateColumns:"100px 70px 1fr 165px 80px 44px"}}>
              {["Date","Filed","Activity","Category","Time",""].map((h,i)=><div key={i} className="tbl-hd">{h}</div>)}
            </div>
            {filtered.some(e=>e.investor_warning)&&(
              <div style={{background:"#0a1828",border:"1px solid #C6A24A",borderRadius:3,padding:"10px 16px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:15}}>⚠</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,color:"#C6A24A"}}>
                  {filtered.filter(e=>e.investor_warning).length} record{filtered.filter(e=>e.investor_warning).length!==1?"s":""} flagged as potential Investor Activity
                </span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#6a8aaa",marginLeft:4}}>
                  — marked ⚠ below. Review with your CPA before using in filings.
                </span>
              </div>
            )}
            {[...filtered].reverse().map(e=>(
              <div key={e.id}>
                <div className="tbl-row" style={{gridTemplateColumns:"100px 70px 1fr 165px 80px 44px",alignItems:"center",background:e.investor_warning?"#070f1a":""}}>
                  <div className="tbl-cell" style={{color:C.mid}}>{e.date}</div>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <span style={{padding:"2px 7px",borderRadius:2,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,background:e.qualifies?C.greenPale:C.redPale,color:e.qualifies?C.green:C.red,border:`1px solid ${e.qualifies?C.greenB:C.redB}`}}>{e.qualifies?"RE":"Non-RE"}</span>
                    {e.investor_warning&&<span title="Potential investor activity — review with CPA" style={{fontSize:13,cursor:"help",color:"#C6A24A"}}>⚠</span>}
                  </div>
                  <div>
                    <div className="tbl-cell" style={{color:e.investor_warning?"#C6A24A":C.text,marginBottom:2}}>{e.activity}</div>
                    {e.notes&&<div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.lighter}}>{e.notes}</div>}
                  </div>
                  <div><span className="tag">{e.categoryLabel}</span></div>
                  <div className="tbl-cell" style={{color:C.gold,fontWeight:500}}>{fmtH(e.minutes)}</div>
                  <div style={{textAlign:"right"}}><button onClick={()=>setLocalEntries(p=>p.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#c8b0a0",fontSize:13,cursor:"pointer"}}>✕</button></div>
                </div>
                {e.investor_warning&&(
                  <div style={{background:"#060d18",borderBottom:"1px solid #2a1500",padding:"8px 16px 10px 104px"}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#C6A24A",fontWeight:600}}>⚠ CPA Review: </span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#9a7c40",lineHeight:1.65}}>
                      {e.warning_note||"The IRS may classify this as an Investor Activity. Investor activities do not count toward Material Participation unless you are involved in day-to-day management. Discuss with your CPA."}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="plans"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {localPlans.length===0?(
            <div className="card" style={{textAlign:"center",padding:50}}>
              <div style={{fontSize:18,color:C.lighter,marginBottom:8}}>No notes yet</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#bbb"}}>Ask the assistant: "Summarize today into organized notes"</div>
            </div>
          ):localPlans.map(p=>(
            <div key={p.id} className="card" style={{borderLeft:`3px solid ${C.goldL}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:17,fontWeight:600,color:C.dark}}>{p.title}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{p.date}</div>
              </div>
              {p.notes&&<div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid,marginBottom:12,lineHeight:1.7}}>{p.notes}</div>}
              {p.items?.map((item,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                  <span style={{color:C.goldL,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,flexShrink:0}}>▸</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.text,lineHeight:1.5}}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab==="audit"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card" style={{background:"#f8f8f6",borderLeft:"4px solid #ccc",padding:"14px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#888",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>Important Notice</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#555",lineHeight:1.8}}>
              RepTrack organizes and stores your documentation. It does not determine whether you qualify as a Real Estate Professional. The records below are for organizational reference only. Please consult your CPA or tax attorney regarding REP qualification, audit defense strategy, and tax filing.
            </div>
          </div>
          <div className="card">
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:18,fontWeight:600,color:C.dark,marginBottom:16}}>Documentation Summary — 2024</div>
            <div className="g2">
              <div>
                {[["Qualifier on File","Maria Rodriguez"],["Spouse on File","Dr. Carlos Rodriguez (Non-RE)"],["Filing Status","Married Filing Jointly"],["Tax Year","2024"],["RE Entries Logged",`${localEntries.filter(e=>e.qualifies).length} entries`],["Non-RE Entries Logged",`${localEntries.filter(e=>!e.qualifies).length} entries`],["Total Hours Documented",fmtH(localEntries.reduce((s,e)=>s+e.minutes,0))],["RE Hours Documented",fmtH(localEntries.filter(e=>e.qualifies).reduce((s,e)=>s+e.minutes,0))]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.borderL}`,fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>
                    <span style={{color:C.mid}}>{k}</span><span style={{color:C.text,fontWeight:500}}>{v||"—"}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="label" style={{marginBottom:12}}>Documentation Checklist</div>
                {[{l:"Time log entries filed",met:localEntries.length>0},{l:"RE and Non-RE entries separated",met:true},{l:"IRS categories assigned",met:localEntries.length>0},{l:"Activity descriptions recorded",met:true},{l:"MFJ qualifier identified",met:true},{l:"Session notes saved",met:localPlans.length>0},{l:"Communications documented",met:true},{l:"CSV export available",met:true}].map(item=>(
                  <div key={item.l} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                    <span style={{color:item.met?C.green:"#c8b0a0",fontSize:14,flexShrink:0,fontWeight:700}}>{item.met?"✓":"○"}</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:item.met?C.green:C.light}}>{item.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PROPERTIES ────────────────────────────────────────────────────────────────
function PropertiesView({setView,setInput,showFlash}) {
  const [tab,setTab]=useState("portfolio");
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:19,fontWeight:600,color:C.dark}}>Properties</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginTop:3}}>Portfolio · Tenants · Suppliers & Vendors</div>
        </div>
        <button className="btn-gold">+ Add Property</button>
      </div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`}}>
        {[{id:"portfolio",l:"Portfolio"},{id:"tenants",l:"Tenants"},{id:"suppliers",l:"Suppliers & Vendors"}].map(t=>(
          <button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {tab==="portfolio"&&(
        <div>
          <div className="g2">
            {SAMPLE_PROPERTIES.map(p=>(
              <div key={p.id} className="card" style={{borderLeft:`3px solid ${C.greenB}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:17,fontWeight:600,color:C.dark}}>{p.name}</div>
                  <span className="tag">{p.type.replace("_"," ")}</span>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid,marginBottom:10}}>{p.address}</div>
                <div style={{display:"flex",gap:20,marginBottom:14}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light}}>{p.units} unit{p.units!==1?"s":""}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.green,fontWeight:600}}>${p.rent.toLocaleString()}<span style={{fontSize:10,fontWeight:400,color:C.light}}>/mo</span></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn-outline" style={{fontSize:10,padding:"6px 12px"}} onClick={()=>{setView("assistant");setInput(`Log management activity for ${p.name} at ${p.address}`);}}>Log Activity</button>
                  <button className="btn-outline" style={{fontSize:10,padding:"6px 12px"}} onClick={()=>setView("comms")}>✉ Email Tenant</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{marginTop:4,background:C.goldPale,borderLeft:`3px solid ${C.goldL}`,padding:"14px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.gold,fontWeight:600,marginBottom:10}}>Portfolio Summary</div>
            <div style={{display:"flex",gap:36,flexWrap:"wrap"}}>
              {[["Properties","4"],["Total Units","8"],["Monthly Revenue","$16,050"],["Annual Revenue","$192,600"]].map(([k,v])=>(
                <div key={k}><div className="label">{k}</div><div style={{fontFamily:"'Inter',sans-serif",fontSize:20,color:C.gold,fontWeight:700}}>{v}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="tenants"&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-head" style={{gridTemplateColumns:"1fr 1fr 1fr 100px 140px"}}>
            {["Tenant","Property / Unit","Contact","Rent/mo","Lease"].map((h,i)=><div key={i} className="tbl-hd">{h}</div>)}
          </div>
          {SAMPLE_TENANTS.map(t=>{
            const prop=SAMPLE_PROPERTIES.find(p=>p.id===t.property);
            return(
              <div key={t.id} className="tbl-row" style={{gridTemplateColumns:"1fr 1fr 1fr 100px 140px",alignItems:"center"}}>
                <div className="tbl-cell" style={{fontWeight:500}}>{t.name}</div>
                <div><div className="tbl-cell">{prop?.name}</div><div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>Unit {t.unit}</div></div>
                <div>
                  <a href={`mailto:${t.email}`} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.blue,textDecoration:"none",display:"block"}}>{t.email}</a>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{t.phone}</div>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.green,fontWeight:600}}>${t.rent.toLocaleString()}</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.mid}}>Until {t.leaseEnd}</span>
                  <a href={`mailto:${t.email}`}><button style={{background:"none",border:`1px solid ${C.border}`,color:C.blue,padding:"3px 8px",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,cursor:"pointer",borderRadius:2}}>✉</button></a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="suppliers"&&(
        <div className="g2">
          {SAMPLE_SUPPLIERS.map(s=>(
            <div key={s.id} className="card" style={{borderLeft:`3px solid ${C.purpleB}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:600,color:C.dark}}>{s.name}</div>
                <span className="tag">{s.type}</span>
              </div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid,marginBottom:3}}>{s.phone}</div>
              <a href={`mailto:${s.email}`} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.blue,textDecoration:"none",display:"block",marginBottom:8}}>{s.email}</a>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginBottom:12}}>{s.notes}</div>
              <div style={{display:"flex",gap:8}}>
                <a href={`mailto:${s.email}`} style={{textDecoration:"none"}}><button className="btn-outline" style={{fontSize:10,padding:"6px 12px"}}>✉ Email</button></a>
                <button className="btn-outline" style={{fontSize:10,padding:"6px 12px"}} onClick={()=>{setView("assistant");setInput(`Draft a professional email to ${s.name} about a work request`);}}>Draft with Assistant</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMMUNICATIONS ────────────────────────────────────────────────────────────
function CommsView({emails,setEmails,showFlash,setView,setInput}) {
  const [selected,setSelected]=useState(null);
  const contacts=[...SAMPLE_SUPPLIERS.map(s=>({name:s.name,email:s.email,type:s.type})),...SAMPLE_TENANTS.map(t=>({name:t.name,email:t.email,type:"tenant"}))];

  const sendViaMailto=(draft)=>{
    window.open(`mailto:${encodeURIComponent(draft.to||"")}?subject=${encodeURIComponent(draft.subject||"")}&body=${encodeURIComponent(draft.body||"")}`);
    setEmails(p=>p.map(e=>e.id===draft.id?{...e,status:"sent"}:e));
    showFlash("✓ Opened in your mail app");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:19,fontWeight:600,color:C.dark}}>Communications</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginTop:3}}>Drafted emails · Saved to file · Send directly to tenants and suppliers</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-outline" onClick={()=>{setView("assistant");setInput("Draft a professional email to my contractor about a work request");}}>◈ Draft with Assistant</button>
          <button className="btn-gold" onClick={()=>setSelected({id:"new",to:"",subject:"",body:"",type:"supplier",date:todayStr(),status:"draft"})}>+ Compose</button>
        </div>
      </div>

      {/* Quick contacts */}
      <div className="card" style={{padding:"14px 18px"}}>
        <div className="label" style={{marginBottom:10}}>Quick Contacts</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {contacts.filter(c=>c.email).map((c,i)=>(
            <button key={i} className="chip" onClick={()=>setSelected({id:"new",to:c.email,subject:"",body:"",type:c.type==="tenant"?"tenant":"supplier",date:todayStr(),status:"draft"})}>
              {c.name} <span style={{opacity:.5}}>({c.type})</span>
            </button>
          ))}
        </div>
      </div>

      {selected&&(
        <div className="card" style={{borderLeft:`3px solid ${C.blueB}`}}>
          <div className="label" style={{marginBottom:14}}>{selected.id==="new"?"COMPOSE EMAIL":"EDIT DRAFT"}</div>
          <div className="g2" style={{marginBottom:12}}>
            <div><label className="label">To</label><input className="inp" list="clist" placeholder="email@example.com" value={selected.to} onChange={e=>setSelected(p=>({...p,to:e.target.value}))}/><datalist id="clist">{contacts.map((c,i)=><option key={i} value={c.email}>{c.name}</option>)}</datalist></div>
            <div><label className="label">Type</label><select className="inp" value={selected.type} onChange={e=>setSelected(p=>({...p,type:e.target.value}))}><option value="supplier">Supplier / Vendor</option><option value="tenant">Tenant</option><option value="cpa">CPA / Attorney</option><option value="other">Other</option></select></div>
          </div>
          <div style={{marginBottom:12}}><label className="label">Subject</label><input className="inp" placeholder="Subject..." value={selected.subject} onChange={e=>setSelected(p=>({...p,subject:e.target.value}))}/></div>
          <div style={{marginBottom:16}}><label className="label">Body</label><textarea className="inp" rows={7} style={{lineHeight:1.7}} value={selected.body} onChange={e=>setSelected(p=>({...p,body:e.target.value}))}/></div>
          <div style={{display:"flex",gap:10}}>
            <button className="btn-gold" onClick={()=>sendViaMailto(selected)}>↗ Open in Mail App</button>
            <button className="btn-green" onClick={()=>{if(selected.id==="new"){setEmails(p=>[...p,{...selected,id:uid()}]);}else{setEmails(p=>p.map(e=>e.id===selected.id?selected:e));}setSelected(null);showFlash("✓ Saved to Communications");}}>Save Draft</button>
            <button className="btn-outline" onClick={()=>setSelected(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!selected&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {emails.map(draft=>(
            <div key={draft.id} className="card" style={{borderLeft:`3px solid ${draft.status==="sent"?C.greenB:C.blueB}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:7,flexWrap:"wrap"}}>
                    <div style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:600,color:C.dark}}>{draft.subject}</div>
                    <span className="tag">{draft.type}</span>
                    <span style={{padding:"2px 8px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:600,background:draft.status==="sent"?C.greenPale:C.bluePale,color:draft.status==="sent"?C.green:C.blue,border:`1px solid ${draft.status==="sent"?C.greenB:C.blueB}`}}>{draft.status}</span>
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid,marginBottom:7}}>To: {draft.to} · Filed {draft.date}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,whiteSpace:"pre-line",maxHeight:50,overflow:"hidden",lineHeight:1.6}}>{draft.body?.slice(0,200)}{draft.body?.length>200?"...":""}</div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button className="btn-gold" onClick={()=>sendViaMailto(draft)}>↗ Send</button>
                  <button className="btn-outline" onClick={()=>setSelected({...draft})}>Edit</button>
                  <button style={{background:"none",border:`1px solid ${C.redB}`,color:C.red,padding:"8px 12px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,cursor:"pointer",borderRadius:2}} onClick={()=>setEmails(p=>p.filter(e=>e.id!==draft.id))}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CPA PARTNER PORTAL
// ─────────────────────────────────────────────────────────────────────────────

// Mock multi-client data — in production this would be fetched per client
const CPA_CLIENTS = [
  {
    id:"c1",
    name:"Maria & Dr. Carlos Rodriguez",
    qualifier:"Maria Rodriguez",
    spouseRole:"Physician (W-2)",
    filingStatus:"MFJ",
    taxYear:2024,
    reHours:583,
    w2Hours:1920,
    totalHours:2640,
    auditScore:82,
    entries:22,
    flaggedEntries:0,
    emailsOnFile:4,
    notesOnFile:2,
    properties:4,
    rePct:56.2,
    crit1:false,
    crit2:true,
    conflicts:[],
    lastActivity:"2024-11-27",
    tag:"active",
  },
  {
    id:"c2",
    name:"Sandra & Mark Okonkwo",
    qualifier:"Sandra Okonkwo",
    spouseRole:"Attorney (W-2)",
    filingStatus:"MFJ",
    taxYear:2024,
    reHours:812,
    w2Hours:1800,
    totalHours:2800,
    auditScore:91,
    entries:38,
    flaggedEntries:0,
    emailsOnFile:9,
    notesOnFile:5,
    properties:7,
    rePct:59.4,
    crit1:true,
    crit2:true,
    conflicts:[],
    lastActivity:"2024-11-29",
    tag:"complete",
  },
  {
    id:"c3",
    name:"James Whitfield (Single)",
    qualifier:"James Whitfield",
    spouseRole:"N/A",
    filingStatus:"Single",
    taxYear:2024,
    reHours:310,
    w2Hours:0,
    totalHours:620,
    auditScore:44,
    entries:11,
    flaggedEntries:2,
    emailsOnFile:1,
    notesOnFile:0,
    properties:2,
    rePct:50.0,
    crit1:false,
    crit2:true,
    conflicts:["Only 310 RE hours — 440 short of 750 threshold","2 investor activity flags need review","No session notes on file"],
    lastActivity:"2024-11-10",
    tag:"attention",
  },
  {
    id:"c4",
    name:"Priya & Dev Sharma",
    qualifier:"Priya Sharma",
    spouseRole:"Engineer (W-2)",
    filingStatus:"MFJ",
    taxYear:2024,
    reHours:698,
    w2Hours:2080,
    totalHours:2860,
    auditScore:67,
    entries:19,
    flaggedEntries:1,
    emailsOnFile:3,
    notesOnFile:1,
    properties:3,
    rePct:51.3,
    crit1:false,
    crit2:true,
    conflicts:["52 hours short of 750 threshold","1 investor activity flag"],
    lastActivity:"2024-11-22",
    tag:"review",
  },
];

function ScoreRing({score, size=72}) {
  const r = (size/2) - 7;
  const cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const fill = (score/100) * circ;
  const color = score>=80?"#2d7a4a":score>=60?"#C6A24A":"#b03030";
  const trackColor = score>=80?"#e6f5ee":score>=60?"#faf3dc":"#faeaea";
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={6}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray .8s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0}}>
        <span style={{fontFamily:"'Inter',sans-serif",fontSize:size>60?18:14,fontWeight:700,color,lineHeight:1}}>{score}</span>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color,letterSpacing:.5}}>READY</span>
      </div>
    </div>
  );
}

function CPAPortal({localEntries,localEmails,localPlans,reHrs,rePct,c1,c2,showFlash}) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [inspectTab, setInspectTab] = useState("overview");
  const [filterTag, setFilterTag] = useState("all");

  // Inject live data into first client slot
  const liveScore = computeAuditScore(localEntries, localEmails, localPlans);
  const clients = CPA_CLIENTS.map(c => c.id==="c1" ? {
    ...c, reHours:reHrs, rePct:rePct.toFixed(1),
    auditScore:liveScore, entries:localEntries.length,
    emailsOnFile:localEmails.length, notesOnFile:localPlans.length,
    crit1:c1, crit2:c2,
    flaggedEntries:localEntries.filter(e=>e.investor_warning).length,
    conflicts: [
      ...(!c1?[`${750-reHrs} more RE hours needed to reach 750 threshold`]:[]),
      ...(localEntries.filter(e=>e.investor_warning).length>0?[`${localEntries.filter(e=>e.investor_warning).length} investor activity flag(s) — review for material participation`]:[]),
    ],
  } : c);

  const filtered = filterTag==="all" ? clients : clients.filter(c=>c.tag===filterTag);

  const tagColor = {active:C.blue, complete:C.green, attention:C.red, review:C.gold};
  const tagBg = {active:C.bluePale, complete:C.greenPale, attention:C.redPale, review:C.goldPale};
  const tagBorder = {active:C.blueB, complete:C.greenB, attention:C.redB, review:C.goldL};

  const downloadIRSPackage = (client) => {
    const lines = [
      `REPTRACK — IRS DOCUMENTATION PACKAGE`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `=`.repeat(60),
      ``,
      `CLIENT: ${client.name}`,
      `QUALIFIER: ${client.qualifier}`,
      `FILING STATUS: ${client.filingStatus}`,
      `TAX YEAR: ${client.taxYear}`,
      ``,
      `QUALIFICATION STATUS`,
      `-`.repeat(40),
      `Criterion 1 (750+ RE Hours): ${client.crit1?"MET":"NOT MET"} — ${client.reHours} hrs on file`,
      `Criterion 2 (50%+ of Work):  ${client.crit2?"MET":"NOT MET"} — ${client.rePct}% of total`,
      `W-2 Hours (Non-qualifying):  ${client.w2Hours} hrs`,
      ``,
      `DOCUMENTATION SUMMARY`,
      `-`.repeat(40),
      `Activity Entries: ${client.entries}`,
      `Communications Filed: ${client.emailsOnFile}`,
      `Session Notes: ${client.notesOnFile}`,
      `Properties in Portfolio: ${client.properties}`,
      `Audit Readiness Score: ${client.auditScore}/100`,
      `Investor Activity Flags: ${client.flaggedEntries}`,
      ``,
      ...(client.conflicts.length>0?[`ITEMS REQUIRING CPA REVIEW`,`-`.repeat(40),...client.conflicts.map(c=>`• ${c}`),``]:[]),
      `ENTRIES ON FILE (from platform)`,
      `-`.repeat(40),
      ...(client.id==="c1" ? localEntries.map(e=>`${e.date} | ${e.qualifies?"RE":"Non-RE"} | ${e.categoryLabel} | ${e.activity} | ${Math.round(e.minutes/60*10)/10}h${e.investor_warning?" ⚠ INVESTOR FLAG":""}`) : [`[Live data not available for this demo client]`]),
      ``,
      `DISCLAIMER`,
      `-`.repeat(40),
      `This package is an organizational documentation export only.`,
      `It does not constitute tax advice or legal representation.`,
      `Review all entries with your client before filing.`,
    ];
    const blob = new Blob([lines.join('\n')], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`IRS-REP-Package-${client.name.replace(/\s+/g,'-')}-${client.taxYear}.txt`; a.click();
    showFlash(`✓ IRS Package downloaded for ${client.name}`);
  };

  if (selectedClient) {
    const cl = clients.find(c=>c.id===selectedClient);
    const liveLog = cl.id==="c1" ? localEntries : [];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Back + header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <button className="btn-outline" style={{padding:"7px 14px",fontSize:11}} onClick={()=>setSelectedClient(null)}>← All Clients</button>
            <div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:19,fontWeight:600,color:C.dark}}>{cl.name}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light}}>Qualifier: {cl.qualifier} · {cl.filingStatus} · Tax Year {cl.taxYear}</div>
            </div>
          </div>
          <button className="btn-gold" onClick={()=>downloadIRSPackage(cl)}>↓ Download IRS Package</button>
        </div>

        {/* Score + criteria row */}
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:14,alignItems:"stretch"}}>
          {/* Big score */}
          <div className="card" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"20px 28px",borderLeft:`4px solid ${cl.auditScore>=80?C.greenB:cl.auditScore>=60?C.goldL:C.redB}`}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.light,letterSpacing:2,textTransform:"uppercase"}}>Audit Readiness</div>
            <ScoreRing score={cl.auditScore} size={90}/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:cl.auditScore>=80?C.green:cl.auditScore>=60?C.gold:C.red,fontWeight:600,letterSpacing:1}}>
              {cl.auditScore>=80?"STRONG":cl.auditScore>=60?"MODERATE":"NEEDS WORK"}
            </div>
          </div>
          {/* Crit 1 */}
          <div className="card" style={{borderLeft:`4px solid ${cl.crit1?C.greenB:C.redB}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div className="label">750-Hour Threshold</div>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:2,background:cl.crit1?C.greenPale:C.redPale,color:cl.crit1?C.green:C.red,border:`1px solid ${cl.crit1?C.greenB:C.redB}`}}>{cl.crit1?"ON FILE ✓":"INCOMPLETE"}</span>
            </div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:38,fontWeight:700,color:cl.crit1?C.green:C.red,lineHeight:1}}>{cl.reHours}<span style={{fontSize:14,color:C.light,fontFamily:"mono"}}> / 750 hrs</span></div>
            <div style={{height:7,background:"#ede8e0",borderRadius:4,overflow:"hidden",margin:"10px 0 6px"}}>
              <div style={{height:"100%",width:`${Math.min((cl.reHours/750)*100,100)}%`,background:cl.crit1?"linear-gradient(90deg,#2d7a4a,#4caf80)":"linear-gradient(90deg,#b03030,#e05050)",borderRadius:4}}/>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>{cl.crit1?`${cl.reHours-750} hrs above threshold`:`${750-cl.reHours} hrs still needed`}</div>
          </div>
          {/* Crit 2 */}
          <div className="card" style={{borderLeft:`4px solid ${cl.crit2?C.greenB:C.redB}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div className="label">50% of Work Time</div>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:2,background:cl.crit2?C.greenPale:C.redPale,color:cl.crit2?C.green:C.red,border:`1px solid ${cl.crit2?C.greenB:C.redB}`}}>{cl.crit2?"ON FILE ✓":"INCOMPLETE"}</span>
            </div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:38,fontWeight:700,color:cl.crit2?C.green:C.red,lineHeight:1}}>{cl.rePct}<span style={{fontSize:14,color:C.light,fontFamily:"mono"}}>%</span></div>
            <div style={{height:7,background:"#ede8e0",borderRadius:4,overflow:"hidden",margin:"10px 0 6px"}}>
              <div style={{height:"100%",width:`${Math.min(cl.rePct,100)}%`,background:cl.crit2?"linear-gradient(90deg,#2d7a4a,#4caf80)":"linear-gradient(90deg,#b03030,#e05050)",borderRadius:4}}/>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>RE hrs vs W-2: {cl.reHours} / {cl.w2Hours} · Total: {cl.totalHours}</div>
          </div>
        </div>

        {/* Conflicts */}
        {cl.conflicts.length>0 && (
          <div style={{background:"#0a1828",border:"1px solid #C6A24A",borderRadius:3,padding:"14px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:"#C6A24A",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>⚠ CPA Review Items ({cl.conflicts.length})</div>
            {cl.conflicts.map((conf,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                <span style={{color:"#C6A24A",fontSize:14,flexShrink:0,lineHeight:1.3}}>▸</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#C6A24A",lineHeight:1.6}}>{conf}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`}}>
          {[{id:"overview",l:"Overview"},{id:"log",l:"Inspect Log"},{id:"comms",l:"Communications"},{id:"notes",l:"Session Notes"}].map(t=>(
            <button key={t.id} className={`tab-btn ${inspectTab===t.id?"active":""}`} onClick={()=>setInspectTab(t.id)}>{t.l}</button>
          ))}
        </div>

        {inspectTab==="overview" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {[
              {label:"Total Entries",val:cl.entries,sub:"activities documented"},
              {label:"Communications",val:cl.emailsOnFile,sub:"emails on file"},
              {label:"Session Notes",val:cl.notesOnFile,sub:"organized summaries"},
              {label:"Properties",val:cl.properties,sub:"in portfolio"},
              {label:"Investor Flags",val:cl.flaggedEntries,sub:"items needing review",warn:cl.flaggedEntries>0},
              {label:"Last Activity",val:cl.lastActivity,sub:"most recent log entry"},
            ].map(s=>(
              <div key={s.label} className="card" style={{borderLeft:`3px solid ${s.warn?C.goldL:C.border}`,background:s.warn?C.goldPale:"#fff"}}>
                <div className="label">{s.label}</div>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:26,fontWeight:700,color:s.warn?C.gold:C.gold,marginBottom:3}}>{s.val}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.lighter}}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {inspectTab==="log" && (
          <div>
            {liveLog.length===0 ? (
              <div className="card" style={{textAlign:"center",padding:40}}>
                <div style={{fontSize:16,color:C.lighter,marginBottom:8}}>Demo client — live log not available</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#bbb"}}>Live log only available for the active platform user (Maria Rodriguez)</div>
              </div>
            ) : (
              <div className="card" style={{padding:0,overflow:"hidden"}}>
                <div className="tbl-head" style={{gridTemplateColumns:"100px 70px 1fr 155px 70px"}}>
                  {["Date","Type","Activity","Category","Time"].map((h,i)=><div key={i} className="tbl-hd">{h}</div>)}
                </div>
                {[...liveLog].reverse().map(e=>(
                  <div key={e.id}>
                    <div className="tbl-row" style={{gridTemplateColumns:"100px 70px 1fr 155px 70px",alignItems:"center",background:e.investor_warning?"#1a1000":""}}>
                      <div className="tbl-cell" style={{color:C.mid}}>{e.date}</div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        <span style={{padding:"2px 6px",borderRadius:2,fontSize:9,fontFamily:"mono",fontWeight:600,background:e.qualifies?C.greenPale:C.redPale,color:e.qualifies?C.green:C.red,border:`1px solid ${e.qualifies?C.greenB:C.redB}`}}>{e.qualifies?"RE":"Non-RE"}</span>
                        {e.investor_warning&&<span style={{fontSize:11,color:"#C6A24A"}}>⚠</span>}
                      </div>
                      <div className="tbl-cell" style={{color:e.investor_warning?"#C6A24A":C.text}}>{e.activity}</div>
                      <div><span className="tag">{e.categoryLabel}</span></div>
                      <div className="tbl-cell" style={{color:C.gold,fontWeight:500}}>{fmtH(e.minutes)}</div>
                    </div>
                    {e.investor_warning&&(
                      <div style={{background:"#060d18",borderBottom:"1px solid #2a1500",padding:"7px 16px 8px 104px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#9a7c40"}}>
                        ⚠ {e.warning_note||"Potential investor activity — review for material participation with client"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {inspectTab==="comms" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {(cl.id==="c1"?localEmails:[]).length===0?(
              <div className="card" style={{textAlign:"center",padding:40}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.lighter}}>No communications on file for this client</div>
              </div>
            ):(cl.id==="c1"?localEmails:[]).map(em=>(
              <div key={em.id} className="card" style={{borderLeft:`3px solid ${em.status==="sent"?C.greenB:C.blueB}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{display:"flex",gap:8,marginBottom:5,alignItems:"center"}}>
                      <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,color:C.dark}}>{em.subject}</div>
                      <span className="tag">{em.type}</span>
                      <span style={{padding:"2px 7px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:600,background:em.status==="sent"?C.greenPale:C.bluePale,color:em.status==="sent"?C.green:C.blue,border:`1px solid ${em.status==="sent"?C.greenB:C.blueB}`}}>{em.status}</span>
                    </div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>To: {em.to} · {em.date}</div>
                  </div>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,whiteSpace:"pre-line",maxHeight:48,overflow:"hidden",lineHeight:1.6,marginTop:8}}>{em.body?.slice(0,180)}...</div>
              </div>
            ))}
          </div>
        )}

        {inspectTab==="notes" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {(cl.id==="c1"?localPlans:[]).length===0?(
              <div className="card" style={{textAlign:"center",padding:40}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.lighter}}>No session notes on file for this client</div>
              </div>
            ):(cl.id==="c1"?localPlans:[]).map(p=>(
              <div key={p.id} className="card" style={{borderLeft:`3px solid ${C.goldL}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:600,color:C.dark}}>{p.title}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{p.date}</div>
                </div>
                {p.notes&&<div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.mid,marginBottom:10,lineHeight:1.7}}>{p.notes}</div>}
                {p.items?.map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                    <span style={{color:C.goldL,fontFamily:"mono",fontSize:12,flexShrink:0}}>▸</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.text,lineHeight:1.5}}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CLIENT GRID VIEW ──
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:22,fontWeight:700,color:C.dark}}>RepTrack — CPA Partner Portal</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginTop:3}}>
            Client documentation review · Audit readiness · IRS package export · Powered by RepTrack
          </div>
        </div>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.lighter,textAlign:"right"}}>
          {clients.length} clients · {clients.filter(c=>c.crit1&&c.crit2).length} fully documented · {clients.filter(c=>c.conflicts.length>0).length} need attention
        </div>
      </div>

      {/* Filter row */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,letterSpacing:1}}>FILTER:</span>
        {[{id:"all",l:"All Clients"},{id:"complete",l:"Complete"},{id:"review",l:"Review"},{id:"attention",l:"Needs Attention"},{id:"active",l:"Active"}].map(f=>(
          <button key={f.id} onClick={()=>setFilterTag(f.id)} style={{background:filterTag===f.id?C.gold:"#fff",border:`1px solid ${filterTag===f.id?C.gold:C.border}`,color:filterTag===f.id?"#fff":C.mid,padding:"5px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,cursor:"pointer",borderRadius:14,transition:"all .15s"}}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Aggregate summary bar */}
      <div style={{background:C.darker,border:"none",borderRadius:3,padding:"14px 20px",display:"flex",gap:28,flexWrap:"wrap"}}>
        {[
          {l:"Total Clients", v:clients.length,              color:C.goldBright},
          {l:"Both Criteria Met", v:clients.filter(c=>c.crit1&&c.crit2).length, color:"#3aaf75"},
          {l:"750-Hr Met",    v:clients.filter(c=>c.crit1).length,              color:"#3aaf75"},
          {l:"50% Test Met",  v:clients.filter(c=>c.crit2).length,              color:"#3aaf75"},
          {l:"Need Attention",v:clients.filter(c=>c.conflicts.length>0).length, color:"#C6A24A"},
          {l:"Investor Flags",v:clients.reduce((s,c)=>s+c.flaggedEntries,0),    color:"#C6A24A"},
          {l:"Avg Score",     v:Math.round(clients.reduce((s,c)=>s+c.auditScore,0)/clients.length)+"%", color:C.goldBright},
        ].map(s=>(
          <div key={s.l}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5570",letterSpacing:1.5,marginBottom:4,textTransform:"uppercase"}}>{s.l}</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:22,fontWeight:700,color:s.color,lineHeight:1}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Client grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
        {filtered.map(client=>(
          <div key={client.id} className="card" style={{borderLeft:`4px solid ${tagBorder[client.tag]||C.border}`,position:"relative",overflow:"hidden"}}>
            {/* Status tag */}
            <div style={{position:"absolute",top:14,right:14,padding:"3px 10px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:600,letterSpacing:1,textTransform:"uppercase",background:tagBg[client.tag],color:tagColor[client.tag],border:`1px solid ${tagBorder[client.tag]}`}}>
              {client.tag}
            </div>

            {/* Client info */}
            <div style={{marginBottom:14,paddingRight:80}}>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:17,fontWeight:600,color:C.dark,marginBottom:3}}>{client.name}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.mid}}>Qualifier: {client.qualifier}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{client.filingStatus} · {client.spouseRole} · {client.taxYear}</div>
            </div>

            {/* Score + stats row */}
            <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:14}}>
              <ScoreRing score={client.auditScore} size={72}/>
              <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 14px"}}>
                {[
                  {l:"RE Hours",    v:`${client.reHours} / 750`, met:client.crit1},
                  {l:"W-2 Hours",   v:`${client.w2Hours} hrs`,   met:true, neutral:true},
                  {l:"RE Split",    v:`${client.rePct}%`,         met:client.crit2},
                  {l:"Properties",  v:client.properties,         met:true, neutral:true},
                  {l:"Entries",     v:client.entries,            met:client.entries>=15},
                  {l:"⚠ Flags",    v:client.flaggedEntries,     met:client.flaggedEntries===0, warn:client.flaggedEntries>0},
                ].map(stat=>(
                  <div key={stat.l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{stat.l}</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,color:stat.warn?C.gold:stat.neutral?"#888":stat.met?C.green:C.red}}>{stat.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conflicts */}
            {client.conflicts.length>0 && (
              <div style={{background:"#0a1828",border:"1px solid #3a2000",borderRadius:2,padding:"9px 12px",marginBottom:12}}>
                {client.conflicts.map((c,i)=>(
                  <div key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#C6A24A",lineHeight:1.6}}>⚠ {c}</div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{display:"flex",gap:8}}>
              <button className="btn-gold" style={{flex:1,padding:"9px 0"}} onClick={()=>setSelectedClient(client.id)}>
                Inspect Log
              </button>
              <button className="btn-outline" style={{flex:1,padding:"9px 0"}} onClick={()=>downloadIRSPackage(client)}>
                ↓ IRS Package
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer disclaimer */}
      <div style={{background:"#f8f8f6",border:"1px solid #e0e0d8",borderLeft:"4px solid #ccc",borderRadius:3,padding:"12px 16px"}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase"}}>CPA Note: </span>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#666"}}>All data shown is client-provided documentation from the RepTrack platform. Review all entries independently before using in any tax filing. This portal does not constitute tax preparation software.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES ENGINE — IRS REP Rules for High-Income Earners
// ─────────────────────────────────────────────────────────────────────────────

const IRS_RULES = [
  {
    id:"rule_750",
    code:"IRC §469(c)(7)(B)(ii)",
    tier:"QUALIFYING",
    title:"750-Hour Threshold",
    shortTitle:"750 Hours",
    icon:"⏱",
    color:"green",
    category:"Core Qualification",
    summary:"You must perform more than 750 hours of personal service in real property trades or businesses in which you materially participate during the tax year.",
    detail:"This is a hard minimum — there is no pro-rating. 749 hours means no REP status. The 750 hours must be in activities where you materially participate; passive participation doesn't count. Hours can be aggregated across multiple real estate activities (development, management, leasing, construction, etc.).",
    highEarnerImpact:"For physicians, attorneys, or executives with W-2 income, this is achievable only if you actively manage your properties — not just own them passively.",
    traps:["Counting hours in activities where you don't materially participate","Counting employee W-2 hours at an RE employer (unless you own >5% of that employer)","Counting investor activities (reviewing statements, attending meetings passively)"],
    planningNote:"Aggregate hours across all 11 qualifying RE trades or businesses. A real estate agent who also owns rental properties can combine both sets of hours.",
    irsForm:"Schedule E · Form 8582",
    auditRisk:"HIGH — IRS Compliance Initiative Project specifically targets RE professional hours claims",
    qualifies:(reHrs,rePct)=> reHrs >= 750 ? "met" : reHrs >= 600 ? "close" : "not_met",
    getValue:(reHrs)=> `${reHrs} / 750 hrs`,
  },
  {
    id:"rule_50pct",
    code:"IRC §469(c)(7)(B)(i)",
    tier:"QUALIFYING",
    title:"50% of All Work Time",
    shortTitle:"50% Test",
    icon:"⚖",
    color:"green",
    category:"Core Qualification",
    summary:"More than half of all personal services you perform during the year must be in real property trades or businesses in which you materially participate.",
    detail:"This is calculated against ALL personal services — your W-2 job, self-employment, consulting, anything. If a physician works 2,000 W-2 hours, they must perform MORE than 2,000 hours in qualifying RE activities to pass this test. This is why high-income W-2 earners rarely qualify individually.",
    highEarnerImpact:"A full-time W-2 professional earning $500K+ who works 2,000 hours/year would need 2,001+ RE hours just to pass the 50% test — on top of the 750-hour minimum. This is the most common disqualifier for high earners.",
    traps:["Having a spouse qualify instead (valid strategy for MFJ, but hours cannot be combined for this test)","Cutting W-2 hours to reduce the denominator","Misunderstanding that 750 hours is the floor, not the target"],
    planningNote:"For MFJ couples: if one spouse has minimal W-2 hours or works part-time, they may be the better candidate to qualify. The other spouse's hours don't count toward this test.",
    irsForm:"Schedule E",
    auditRisk:"HIGH — IRS will analyze your W-2 and total work history",
    qualifies:(reHrs,rePct)=> rePct >= 50 ? "met" : rePct >= 40 ? "close" : "not_met",
    getValue:(reHrs,rePct)=> `${rePct.toFixed(1)}% of work time`,
  },
  {
    id:"rule_material",
    code:"Temp. Reg. §1.469-5T",
    tier:"QUALIFYING",
    title:"Material Participation (7 Tests)",
    shortTitle:"Material Participation",
    icon:"◎",
    color:"blue",
    category:"Core Qualification",
    summary:"Even after qualifying as an REP, you must materially participate in EACH rental activity. The IRS provides 7 tests — pass any one per property (or per grouped activity).",
    detail:`The 7 Material Participation Tests:
1. 500+ hours in the activity during the year
2. Substantially all participation in the activity is by you (no employees/agents doing your work)
3. 100+ hours AND more than any other individual (including employees)
4. Activity is a "significant participation activity" (100-500 hrs) and all SPAs together exceed 500 hrs total
5. You materially participated in the activity for any 5 of the prior 10 years
6. The activity is a personal service activity and you materially participated in any 3 prior years
7. Based on all facts and circumstances — regular, continuous, substantial involvement`,
    highEarnerImpact:"High earners who use third-party property managers often fail Tests 1-3 because the management company performs most of the hours. Only Test 7 (facts & circumstances) or Test 5 (5 of prior 10 years) may be available — both are harder to prove.",
    traps:["Using a property management company (kills Tests 1-3 for that property)","Not making the grouping election and failing per-property tests","Counting spouse hours for the 50% test but not understanding they do count for material participation (MFJ spouse hours count for material participation only)"],
    planningNote:"Make the §469(c)(7)(A) grouping election to treat all rental properties as one activity. This is a one-time, binding election filed with your return.",
    irsForm:"Statement attached to Form 1040 · Schedule E",
    auditRisk:"VERY HIGH — most litigated area under IRC §469",
    qualifies:()=>"review",
    getValue:()=> "Review per property",
  },
  {
    id:"rule_investor",
    code:"Audit Technique Guide §469",
    tier:"DISQUALIFIER",
    title:"Investor Activity Exclusion",
    shortTitle:"No Investor Hours",
    icon:"⚠",
    color:"red",
    category:"Hours That Don't Count",
    summary:"Time spent as an investor — reviewing financial statements, monitoring performance, attending passive investor meetings — does NOT count toward REP hours unless you are involved in day-to-day management.",
    detail:"The IRS Audit Technique Guide specifically identifies 'investor activities' as non-qualifying. These include: reviewing or compiling financial statements, monitoring finances in a non-managerial capacity, and attending investor update meetings where you are not a decision-maker. The IRS distinguishes between investors who monitor their investment and operators who manage it.",
    highEarnerImpact:"High-income investors often log time reviewing quarterly reports, talking with fund managers, or attending LP meetings. All of these are investor activities — none count toward the 750-hour test or material participation.",
    traps:["Logging 'reviewed financials' as RE hours","Counting time spent at annual HOA or investor meetings","Logging time spent reading RE books/podcasts/education as work hours"],
    planningNote:"Replace passive review with active management decisions. If you personally review financials AND make operational decisions based on them (approve repairs, set rent, select tenants), document the decision-making aspect explicitly.",
    irsForm:"No specific form — documented in time log",
    auditRisk:"HIGH — IRS specifically looks for inflated hours from investor activities",
    qualifies:()=>"warning",
    getValue:(reHrs,rePct,entries)=> `${(entries||[]).filter(e=>e.flag_code==="investor_activity").length} flagged entries`,
  },
  {
    id:"rule_employee",
    code:"IRC §469(c)(7)(D)",
    tier:"DISQUALIFIER",
    title:"W-2 Employee Hours Excluded",
    shortTitle:"W-2 RE Employee Rule",
    icon:"⊘",
    color:"red",
    category:"Hours That Don't Count",
    summary:"Hours you work as a W-2 employee in real estate do NOT count toward REP tests — unless you own more than 5% of that employer.",
    detail:"IRC §469(c)(7)(D) explicitly states that services performed as an employee are not treated as performed in a real property trade or business for REP purposes. This is a hard rule. A real estate agent employed by a brokerage who owns no equity stake cannot count those W-2 hours toward the 750-hour or 50% tests.",
    highEarnerImpact:"A commercial real estate broker employed by a large firm (with no ownership stake) cannot count their professional work hours toward REP qualification. Only hours in their own investment properties count.",
    traps:["Real estate agents who are W-2 employees (not independent contractors) assuming all RE hours count","Property managers employed by a management company assuming their job hours qualify","Not checking ownership percentage before logging W-2 RE employer hours"],
    planningNote:"Convert W-2 employment to a 1099 independent contractor arrangement, or acquire >5% equity ownership in your RE employer. Both pathways allow those hours to count.",
    irsForm:"Schedule E · K-1 if >5% ownership",
    auditRisk:"MEDIUM-HIGH — IRS cross-references W-2s and K-1s to verify employment vs. ownership",
    qualifies:()=>"warning",
    getValue:(reHrs,rePct,entries)=> `${(entries||[]).filter(e=>e.flag_code==="employee_hours_risk").length} flagged entries`,
  },
  {
    id:"rule_thirdparty",
    code:"Audit Technique Guide §469",
    tier:"DISQUALIFIER",
    title:"Third-Party Property Manager Risk",
    shortTitle:"PM Company Risk",
    icon:"🏢",
    color:"red",
    category:"Material Participation Killers",
    summary:"When a third-party property management company handles day-to-day operations, it is extremely difficult to prove material participation. The IRS scrutinizes these situations heavily.",
    detail:"The IRS Audit Technique Guide notes that rental activities by nature don't require significant day-to-day involvement. When a PM company is used, the only material participation test realistically available is Test 1 (500+ hours) — but with a PM company doing most of the work, logging 500 hours becomes difficult to substantiate. Courts have repeatedly denied REP status where taxpayers used PM companies but didn't document their own hands-on involvement.",
    highEarnerImpact:"High earners who outsource property management to be 'hands-off' simultaneously eliminate most material participation tests. You can't pay someone else to manage your property and then claim you materially participated.",
    traps:["Assuming the PM company's hours count as yours","Not documenting your own supervisory and oversight activities","Using a PM for every property and not making the grouping election"],
    planningNote:"If you use a PM company, document every interaction meticulously: every call, every directive, every decision YOU made. You must show you are supervising and directing — not just receiving reports.",
    irsForm:"Time log with property-level detail",
    auditRisk:"VERY HIGH — most scrutinized fact pattern in REPS audits",
    qualifies:()=>"warning",
    getValue:(reHrs,rePct,entries)=> `${(entries||[]).filter(e=>e.flag_code==="third_party_mgmt_risk").length} flagged entries`,
  },
  {
    id:"rule_niit",
    code:"IRC §1411 · Form 8960",
    tier:"HIGH_EARNER",
    title:"3.8% Net Investment Income Tax (NIIT)",
    shortTitle:"NIIT 3.8%",
    icon:"$",
    color:"gold",
    category:"High-Earner Stakes",
    summary:"If your MAGI exceeds $250K (MFJ) or $200K (Single), a 3.8% surtax applies to net investment income — including rental income. Qualifying as an REP eliminates this on your rental income.",
    detail:"The NIIT under IRC §1411 applies to the lesser of: (a) your net investment income, or (b) the amount your MAGI exceeds the threshold. For MFJ: $250K. For Single: $200K. For MFS: $125K. These thresholds are NOT indexed for inflation. Rental income is net investment income UNLESS you qualify as an REP with material participation, in which case the rental activity is treated as non-passive and NIIT does not apply.",
    highEarnerImpact:"A physician couple with $600K W-2 income and $80K in rental income owes an extra $3,040/year in NIIT alone (3.8% × $80K). If they also have $200K in capital gains from a property sale, NIIT adds another $7,600. REP status eliminates both if they materially participate.",
    traps:["Assuming NIIT doesn't apply if you 'break even' on rentals — it applies to gross rental income","Not understanding that REPS eliminates NIIT on rentals but you must also materially participate","Forgetting that NIIT applies to gains on property sale if you don't qualify"],
    planningNote:"Qualifying as an REP with material participation converts rental income from 'investment income' to 'ordinary business income' — NIIT does not apply to non-passive business income.",
    irsForm:"Form 8960 · Form 1040 Line 17",
    auditRisk:"MEDIUM — automated by IRS when MAGI exceeds threshold",
    qualifies:()=>"review",
    getValue:()=> "MAGI >$250K (MFJ) triggers",
  },
  {
    id:"rule_25k",
    code:"IRC §469(i)",
    tier:"HIGH_EARNER",
    title:"$25K Passive Loss Offset — Phase-Out",
    shortTitle:"$25K Offset",
    icon:"↓",
    color:"gold",
    category:"High-Earner Stakes",
    summary:"Non-REP individuals can deduct up to $25K in rental losses if they 'actively participate.' This phases out completely at $150K MAGI. Above $150K, rental losses are suspended unless you qualify as an REP.",
    detail:"IRC §469(i) provides a special $25K allowance for rental losses for taxpayers who 'actively participate' (a lower bar than material participation). This phases out at 50¢ per dollar over $100K MAGI, eliminating entirely at $150K. For high earners, this provision is functionally worthless — it's gone before they reach their income level. Full REP status bypasses the passive loss limitation entirely.",
    highEarnerImpact:"A couple with $400K MAGI gets ZERO benefit from the $25K offset. Their rental losses are completely suspended and carried forward until they either generate passive income, sell the property, or qualify as REPs. Cost segregation losses are trapped.",
    traps:["Assuming 'active participation' (making management decisions) is the same as 'material participation' for REP status — it is not","Expecting to deduct cost segregation losses without REP status above $150K MAGI","Forgetting suspended losses don't disappear — they carry forward and release on property sale"],
    planningNote:"Suspended passive losses are released when the property is sold in a fully taxable transaction. They can also offset other passive income (other rentals, limited partnerships). The best solution above $150K is to qualify as an REP or invest in short-term rentals.",
    irsForm:"Form 8582",
    auditRisk:"LOW — phase-out is calculated automatically",
    qualifies:()=>"review",
    getValue:()=> "Eliminated above $150K MAGI",
  },
  {
    id:"rule_grouping",
    code:"Reg. §1.469-9(g)",
    tier:"PLANNING",
    title:"Grouping Election",
    shortTitle:"§469 Grouping",
    icon:"⊞",
    color:"blue",
    category:"Planning Tools",
    summary:"You can elect to treat ALL rental real estate interests as a single activity, making it much easier to prove material participation across a portfolio instead of property-by-property.",
    detail:"Without a grouping election, material participation is tested separately for each rental property. Own 5 properties? You must individually pass one of the 7 tests for each one. The grouping election aggregates all properties into one activity, so your 600 total hours across all properties count as a single pool. The election is made by attaching a statement to a timely-filed return and is generally binding for all future years (Rev. Proc. 2011-34 provides late election relief with reasonable cause).",
    highEarnerImpact:"Essential for any taxpayer owning multiple properties. Without it, passing material participation on each individual property becomes nearly impossible as the portfolio grows.",
    traps:["Not making the election in the first year you qualify — it is binding going forward","Revoking the election triggers a 10-year waiting period before it can be re-elected","Making the election on an amended return (generally not permitted without reasonable cause)"],
    planningNote:"Make this election as early as possible. File a statement with your Schedule E: 'Pursuant to Reg. §1.469-9(g), taxpayer elects to treat all rental real estate activities as a single rental real estate activity.'",
    irsForm:"Statement attached to Schedule E",
    auditRisk:"LOW once properly elected — simplifies the audit analysis",
    qualifies:()=>"review",
    getValue:()=> "One-time election required",
  },
  {
    id:"rule_str",
    code:"IRC §469 · Treas. Reg. §1.469-1T(e)(3)",
    tier:"PLANNING",
    title:"Short-Term Rental Bypass",
    shortTitle:"STR Bypass (<7 Days)",
    icon:"🏠",
    color:"blue",
    category:"Planning Tools",
    summary:"Short-term rentals with an average customer stay of 7 days or less are NOT 'rental activities' under IRC §469 — they bypass REP rules entirely. High earners can deduct STR losses against W-2 income without qualifying as an REP, as long as they materially participate.",
    detail:"Treas. Reg. §1.469-1T(e)(3)(ii)(A) excludes from 'rental activity' any activity where the average period of customer use is 7 days or less. Airbnb, VRBO, and short-term vacation rentals typically qualify. Because they are not rental activities, the passive activity rules don't apply in the same way — a high earner can deploy cost segregation on an STR, generate paper losses, and use them against W-2 income without ever qualifying as an REP. Material participation is still required.",
    highEarnerImpact:"A W-2 earner with $500K+ income who cannot qualify as an REP can still deploy the STR strategy: buy an Airbnb property, cost segregate it, materially participate, and deduct the depreciation losses against ordinary income. This is legal tax planning.",
    traps:["Assuming any rental with short-term characteristics qualifies — must calculate the average period of customer use","Not materially participating in the STR (still required, even without REP)","Using the STR strategy in a location with local short-term rental restrictions that force longer stays above 7 days"],
    planningNote:"Track average rental days carefully. If the average tips above 7 days, the property becomes a rental activity and REP rules apply. Mixed-use properties (some short, some long stays) require careful calculation.",
    irsForm:"Schedule E · Schedule C (if average stay ≤7 days with services)",
    auditRisk:"MEDIUM — IRS scrutinizes average period of customer use calculations",
    qualifies:()=>"review",
    getValue:()=> "Alternative strategy for high W-2 earners",
  },
  {
    id:"rule_mfj",
    code:"IRC §469(c)(7) · IRC §469(h)(5)",
    tier:"PLANNING",
    title:"MFJ Spouse Rules",
    shortTitle:"Spouse Rules (MFJ)",
    icon:"⇄",
    color:"blue",
    category:"Planning Tools",
    summary:"Married Filing Jointly: spouses CANNOT combine hours for the 750-hour test or the 50% test — each must qualify independently. However, BOTH spouses' hours DO count for material participation in each rental activity.",
    detail:"This is a critical distinction that trips up many couples. For REP qualification (750-hour test + 50% test): each spouse is evaluated independently. For material participation in each rental: both spouses' hours are combined (IRC §469(h)(5)). This means a couple where one spouse qualifies as an REP can have the non-qualifying spouse's hours help meet material participation — unlocking the losses for the qualifying spouse.",
    highEarnerImpact:"A physician couple (both W-2) where the doctor works 2,500 hours/year cannot use the other doctor's RE hours to help reach the 50% threshold. But if one spouse reduces W-2 work (part-time physician = 1,000 hrs W-2), they may be able to qualify with 1,200+ RE hours. The stay-at-home spouse strategy is also valid if genuine — do not fabricate or stretch participation.",
    traps:["Believing a spouse's hours count toward YOUR 50% test — they do not","Failing to use the non-qualifying spouse's hours for material participation purposes — a missed benefit","Fabricating a spouse's participation to qualify — the IRS audits this specifically"],
    planningNote:"Document both spouses' participation independently. Even if only one qualifies for REP status, the other's participation hours strengthen material participation on each property.",
    irsForm:"Schedule E — both spouses' participation documented separately",
    auditRisk:"HIGH — IRS specifically scrutinizes stay-at-home spouse REP claims",
    qualifies:()=>"review",
    getValue:()=> "Maria qualifies · Carlos: separate",
  },
  {
    id:"rule_contemp",
    code:"IRS Audit Technique Guide §469",
    tier:"DOCUMENTATION",
    title:"Contemporaneous Log Requirement",
    shortTitle:"Contemporaneous Logs",
    icon:"📋",
    color:"purple",
    category:"Documentation",
    summary:"The IRS requires time logs to be contemporaneous — recorded at or near the time of the activity. Reconstructed logs created from memory weeks or months later are frequently rejected in court.",
    detail:"While the IRS does not prescribe a specific format, courts have consistently held that logs reconstructed from memory after the fact carry less weight than contemporaneous records. The burden of proof is on the taxpayer. Acceptable contemporaneous evidence includes: daily calendars, emails, texts, receipts, contractor invoices, and app-generated time logs. Courts have upheld and rejected REP status based almost entirely on the quality of the time log.",
    highEarnerImpact:"High earners under audit face elevated scrutiny precisely because the tax benefits are large. A $50K depreciation deduction from cost segregation attracts more attention than a $2K deduction. Your time log will be examined line-by-line.",
    traps:["Logging a week of activity in one session on Sunday night — technically contemporaneous, but auditors flag this","Creating a single annual spreadsheet at tax time — almost always rejected","Logging round numbers (2 hrs, 4 hrs, 8 hrs) without detail — suspicious pattern"],
    planningNote:"Log every activity within 24-48 hours. Include: date, property address or activity type, specific task performed, and exact time (start/end, not just total). Use the RepTrack assistant daily — each conversation creates a dated, timestamped record.",
    irsForm:"No specific form — attached to return or produced under audit",
    auditRisk:"VERY HIGH — quality of contemporaneous log is the #1 audit battleground",
    qualifies:()=>"review",
    getValue:()=> "Log daily in RepTrack",
  },
];

function RuleStatusBadge({status,small}) {
  const styles = {
    met:    {bg:C.greenPale,  color:C.green,  border:C.greenB, label:"MET ✓"},
    close:  {bg:C.goldPale,   color:C.gold,   border:C.goldL,  label:"CLOSE"},
    not_met:{bg:C.redPale,    color:C.red,    border:C.redB,   label:"NOT MET"},
    warning:{bg:"#faf3dc",    color:C.gold,   border:C.goldL,  label:"⚠ FLAG"},
    review: {bg:C.bluePale,   color:C.blue,   border:C.blueB,  label:"REVIEW"},
    green:  {bg:C.greenPale,  color:C.green,  border:C.greenB, label:"QUALIFYING"},
    red:    {bg:C.redPale,    color:C.red,    border:C.redB,   label:"DISQUALIFIER"},
    gold:   {bg:C.goldPale,   color:C.gold,   border:C.goldL,  label:"HIGH EARNER"},
    blue:   {bg:C.bluePale,   color:C.blue,   border:C.blueB,  label:"PLANNING TOOL"},
    purple: {bg:"#f0ecf8",    color:"#3a2060",border:"#5a3a90",label:"DOCUMENTATION"},
  };
  const s = styles[status] || styles.review;
  return (
    <span style={{padding:small?"2px 8px":"3px 10px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:small?9:10,fontWeight:600,letterSpacing:.5,background:s.bg,color:s.color,border:`1px solid ${s.border}`,whiteSpace:"nowrap"}}>
      {s.label}
    </span>
  );
}

function RulesEngine({localEntries,reHrs,rePct,c1,c2,setView}) {
  const [selected, setSelected] = useState(null);
  const [filterCat, setFilterCat] = useState("all");

  const categories = ["all","Core Qualification","Hours That Don't Count","Material Participation Killers","High-Earner Stakes","Planning Tools","Documentation"];
  const catShort   = {"all":"All Rules","Core Qualification":"Core","Hours That Don't Count":"Exclusions","Material Participation Killers":"MP Risks","High-Earner Stakes":"High-Earner","Planning Tools":"Planning","Documentation":"Docs"};

  const filtered = filterCat==="all" ? IRS_RULES : IRS_RULES.filter(r=>r.category===filterCat);

  const tierColor = {QUALIFYING:C.green, DISQUALIFIER:C.red, HIGH_EARNER:C.gold, PLANNING:C.blue, DOCUMENTATION:"#3a2060"};
  const tierBg    = {QUALIFYING:C.greenPale, DISQUALIFIER:C.redPale, HIGH_EARNER:C.goldPale, PLANNING:C.bluePale, DOCUMENTATION:"#f0ecf8"};
  const tierBorder= {QUALIFYING:C.greenB, DISQUALIFIER:C.redB, HIGH_EARNER:C.goldL, PLANNING:C.blueB, DOCUMENTATION:"#5a3a90"};

  const flaggedCount = localEntries.filter(e=>e.flag_code).length;
  const flagTypes    = [...new Set(localEntries.filter(e=>e.flag_code).map(e=>e.flag_code))];

  if (selected) {
    const rule = IRS_RULES.find(r=>r.id===selected);
    const status = rule.qualifies(reHrs,rePct,localEntries);
    const tColor = tierColor[rule.tier];
    const tBg    = tierBg[rule.tier];
    const tBorder= tierBorder[rule.tier];
    const flaggedForRule = localEntries.filter(e=>e.flag_code && rule.id.includes(e.flag_code.split("_")[0]));

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <button className="btn-outline" style={{padding:"7px 14px",fontSize:11}} onClick={()=>setSelected(null)}>← All Rules</button>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{rule.icon}</span>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:19,fontWeight:700,color:C.dark}}>{rule.title}</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light}}>{rule.code}</span>
              <RuleStatusBadge status={rule.tier.toLowerCase()==="disqualifier"?"red":rule.color} />
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div className="card" style={{borderLeft:`4px solid ${tColor}`,background:tBg}}>
            <div className="label">Category</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,color:tColor,marginTop:4}}>{rule.category}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,marginTop:2}}>{rule.tier.replace(/_/g," ")}</div>
          </div>
          <div className="card" style={{borderLeft:`4px solid ${tColor}`}}>
            <div className="label">Current Status</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,color:C.dark,marginTop:4}}>{rule.getValue(reHrs,rePct,localEntries)}</div>
            <div style={{marginTop:6}}><RuleStatusBadge status={rule.qualifies(reHrs,rePct,localEntries)}/></div>
          </div>
          <div className="card" style={{borderLeft:`4px solid ${rule.auditRisk.startsWith("VERY")?"#993030":rule.auditRisk.startsWith("HIGH")?C.red:rule.auditRisk.startsWith("MEDIUM")?C.gold:C.green}`}}>
            <div className="label">Audit Risk</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:600,color:rule.auditRisk.startsWith("VERY")?"#993030":rule.auditRisk.startsWith("HIGH")?C.red:rule.auditRisk.startsWith("MEDIUM")?C.gold:C.green,marginTop:4}}>{rule.auditRisk.split(" — ")[0]}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,marginTop:2,lineHeight:1.5}}>{rule.irsForm}</div>
          </div>
        </div>

        <div className="card">
          <div className="label" style={{marginBottom:10}}>The Rule</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.dark,lineHeight:1.8,fontWeight:500,marginBottom:12}}>{rule.summary}</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.light,lineHeight:1.85,whiteSpace:"pre-line"}}>{rule.detail}</div>
        </div>

        <div className="card" style={{background:"#0d1e30",border:`1px solid ${C.goldL}`}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:C.goldL,letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>⚡ High-Earner Impact</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#a0c0d8",lineHeight:1.85}}>{rule.highEarnerImpact}</div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="card" style={{borderLeft:`3px solid ${C.redB}`}}>
            <div className="label" style={{color:C.red,marginBottom:10}}>⚠ Common Traps</div>
            {rule.traps.map((trap,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                <span style={{color:C.red,flexShrink:0,fontSize:13,lineHeight:1.3}}>✕</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.text,lineHeight:1.65}}>{trap}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{borderLeft:`3px solid ${C.greenB}`}}>
            <div className="label" style={{color:C.green,marginBottom:10}}>✦ Planning Note</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:C.text,lineHeight:1.85}}>{rule.planningNote}</div>
          </div>
        </div>

        {flaggedForRule.length>0 && (
          <div style={{background:"#1a1200",border:`1px solid ${C.goldL}`,borderRadius:3,padding:"14px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:C.goldL,letterSpacing:1.5,marginBottom:10}}>⚑ {flaggedForRule.length} FLAGGED ENTRIES IN YOUR LOG</div>
            {flaggedForRule.map(e=>(
              <div key={e.id} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                <span style={{color:C.goldL,fontSize:11,flexShrink:0,marginTop:1}}>▸</span>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#C6A24A"}}>{e.date} · {e.activity}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#6a8aaa",marginTop:2}}>{e.flag_note||e.warning_note}</div>
                </div>
              </div>
            ))}
            <button className="btn-outline" style={{marginTop:8,fontSize:11}} onClick={()=>setView("records")}>View in Records →</button>
          </div>
        )}

        <div style={{background:"#f0ecf8",border:"1px solid #c0a8e8",borderLeft:"4px solid #5a3a90",borderRadius:3,padding:"12px 16px"}}>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#3a2060",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>RepTrack Note: </span>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4a3070"}}>This information is for documentation and organizational purposes only. RepTrack does not determine whether you qualify as a Real Estate Professional. Consult your CPA or tax attorney for advice on these rules.</span>
        </div>
      </div>
    );
  }

  // ── RULES GRID ──
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:22,fontWeight:700,color:C.dark}}>Rules Engine</div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,marginTop:3}}>
            12 IRS rules that determine REP status for high-income earners · Capture the work · Prove the time · Defend the claim
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          {flaggedCount>0 && (
            <div style={{background:"#1a1200",border:`1px solid ${C.goldL}`,borderRadius:3,padding:"8px 14px",display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:C.goldL,fontSize:14}}>⚑</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#C6A24A",fontWeight:600}}>{flaggedCount} flagged entries in your log</span>
            </div>
          )}
        </div>
      </div>

      {/* Qualification status bar */}
      <div style={{background:"#091e33",borderRadius:3,padding:"14px 20px",display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5a78",letterSpacing:2,textTransform:"uppercase"}}>YOUR STATUS · 2024</div>
        {[
          {l:"750-Hr Test",  v:`${reHrs}/750`,  met:c1, subtext:c1?"✓ MET":`${750-reHrs} hrs short`},
          {l:"50% Test",     v:`${rePct.toFixed(0)}%`,  met:c2, subtext:c2?"✓ MET":"Needs review"},
          {l:"Investor Flags", v:localEntries.filter(e=>e.flag_code==="investor_activity").length, met:localEntries.filter(e=>e.flag_code==="investor_activity").length===0, subtext:"entries flagged"},
          {l:"PM Risk Flags",  v:localEntries.filter(e=>e.flag_code==="third_party_mgmt_risk").length, met:localEntries.filter(e=>e.flag_code==="third_party_mgmt_risk").length===0, subtext:"entries flagged"},
          {l:"Other Flags",    v:localEntries.filter(e=>e.flag_code&&e.flag_code!=="investor_activity"&&e.flag_code!=="third_party_mgmt_risk").length, met:localEntries.filter(e=>e.flag_code&&e.flag_code!=="investor_activity"&&e.flag_code!=="third_party_mgmt_risk").length===0, subtext:"entries flagged"},
        ].map(s=>(
          <div key={s.l}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a5a78",letterSpacing:1,marginBottom:3}}>{s.l}</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:20,fontWeight:700,color:s.met?"#3aaf75":"#C6A24A",lineHeight:1}}>{s.v}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:s.met?"#256b45":"#8a7030",marginTop:2}}>{s.subtext}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,letterSpacing:1,flexShrink:0}}>FILTER:</span>
        {categories.map(cat=>(
          <button key={cat} onClick={()=>setFilterCat(cat)}
            style={{background:filterCat===cat?C.dark:"#fff",border:`1px solid ${filterCat===cat?C.dark:C.border}`,
              color:filterCat===cat?C.goldL:C.mid,padding:"5px 12px",fontFamily:"'IBM Plex Mono',monospace",
              fontSize:10,cursor:"pointer",borderRadius:12,transition:"all .15s",whiteSpace:"nowrap"}}>
            {catShort[cat]||cat}
          </button>
        ))}
      </div>

      {/* Rules grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {filtered.map(rule=>{
          const status = rule.qualifies(reHrs,rePct,localEntries);
          const tColor  = tierColor[rule.tier];
          const tBorder = tierBorder[rule.tier];
          const tBg     = tierBg[rule.tier];
          const myFlags = localEntries.filter(e=>e.flag_code && rule.id.toLowerCase().includes(e.flag_code.replace("_risk","").replace("_activity",""))).length;
          return (
            <div key={rule.id} className="card" style={{borderLeft:`4px solid ${tBorder}`,cursor:"pointer",transition:"box-shadow .15s"}}
              onClick={()=>setSelected(rule.id)}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.12)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:18,lineHeight:1}}>{rule.icon}</span>
                  <div>
                    <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:C.dark,lineHeight:1.2}}>{rule.title}</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.light,marginTop:2}}>{rule.code}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{padding:"2px 8px",borderRadius:2,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:600,letterSpacing:.5,background:tBg,color:tColor,border:`1px solid ${tBorder}`}}>
                    {rule.tier.replace(/_/g," ")}
                  </span>
                  {myFlags>0 && <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.gold,background:C.goldPale,padding:"2px 6px",border:`1px solid ${C.goldL}`,borderRadius:2}}>⚑ {myFlags} flagged</span>}
                </div>
              </div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.light,lineHeight:1.7,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                {rule.summary}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:500,color:C.dark}}>{rule.getValue(reHrs,rePct,localEntries)}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.lighter}}>Audit: </span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:600,color:rule.auditRisk.startsWith("VERY")?"#993030":rule.auditRisk.startsWith("HIGH")?C.red:rule.auditRisk.startsWith("MEDIUM")?C.gold:C.green}}>{rule.auditRisk.split(" — ")[0]}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.light,marginLeft:4}}>→</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{background:"#f0ecf8",border:"1px solid #c0a8e8",borderLeft:"4px solid #5a3a90",borderRadius:3,padding:"12px 16px"}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#3a2060",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>RepTrack Note: </span>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4a3070"}}>All rules shown are for informational and documentation purposes only. RepTrack does not provide tax or legal advice. This Rules Engine helps you understand what to document — not whether you qualify. Consult your CPA or tax attorney for REP qualification analysis.</span>
      </div>
    </div>
  );
}
