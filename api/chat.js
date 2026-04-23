const SUPABASE_URL = "https://lzxutumsrzjovjmebqns.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eHV0dW1zcnpqb3ZqbWVicW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODAzNzAsImV4cCI6MjA4ODI1NjM3MH0.WuZsLON6sZ2Oe7uEKOZysZzcQXOGwFDaK5doxhulEAA";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RATE_LIMIT = new Map();

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { "Authorization": "Bearer " + token, "apikey": SUPABASE_ANON_KEY }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

function checkRateLimit(userId) {
  const now = Date.now();
  const e = RATE_LIMIT.get(userId) || { count: 0, resetAt: now + 60000 };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + 60000; }
  e.count++;
  RATE_LIMIT.set(userId, e);
  return e.count <= 30;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(200).json({
      content: [{ type: "text", text: "Your session has expired. Please sign out and sign back in." }]
    });
  }

  if (!checkRateLimit(user.id)) {
    return res.status(200).json({
      content: [{ type: "text", text: "Too many messages. Please wait a moment." }]
    });
  }

  const { system, messages } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: "No messages" });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "No API key" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: system || "You are RepTrack AI.",
        messages: messages.slice(-20)
      })
    });
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      return res.status(500).json({ error: e.error?.message || "AI error" });
    }
    return res.status(200).json(await response.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
