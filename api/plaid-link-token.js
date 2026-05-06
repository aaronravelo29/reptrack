// Creates a Plaid Link token for the authenticated user.
// Required Vercel env vars: PLAID_CLIENT_ID, PLAID_SECRET
// Optional: PLAID_ENV (defaults to "sandbox")
// Sign up free at https://dashboard.plaid.com

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";
const PLAID_BASE = `https://${PLAID_ENV}.plaid.com`;

const SUPABASE_URL = "https://lzxutumsrzjovjmebqns.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eHV0dW1zcnpqb3ZqbWVicW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODAzNzAsImV4cCI6MjA4ODI1NjM3MH0.WuZsLON6sZ2Oe7uEKOZysZzcQXOGwFDaK5doxhulEAA";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function getUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { "Authorization": "Bearer " + token, "apikey": SUPABASE_ANON_KEY },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? u : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return res.status(200).json({
      configured: false,
      message: "Add PLAID_CLIENT_ID and PLAID_SECRET to Vercel environment variables. Sign up free at dashboard.plaid.com",
    });
  }

  try {
    const r = await fetch(`${PLAID_BASE}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        user: { client_user_id: user.id },
        client_name: "RepTrack",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error_message || "Plaid error creating link token" });
    return res.status(200).json({ configured: true, link_token: data.link_token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
