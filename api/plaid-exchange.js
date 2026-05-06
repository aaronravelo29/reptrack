// Exchanges a Plaid public_token for an access_token and stores it in Supabase.
// Supabase table required (run in Supabase SQL editor):
//
//   create table plaid_items (
//     id uuid default gen_random_uuid() primary key,
//     user_id uuid not null references auth.users(id) on delete cascade,
//     item_id text not null,
//     access_token text not null,
//     institution_name text,
//     accounts jsonb default '[]',
//     created_at timestamptz default now()
//   );
//   alter table plaid_items enable row level security;
//   create policy "own items" on plaid_items for all using (auth.uid() = user_id);

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
    return res.status(500).json({ error: "Plaid not configured on server" });
  }

  const { public_token } = req.body || {};
  if (!public_token) return res.status(400).json({ error: "public_token required" });

  try {
    // Exchange public token for access token
    const exchRes = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });
    const exchData = await exchRes.json();
    if (!exchRes.ok) return res.status(500).json({ error: exchData.error_message || "Exchange failed" });

    const { access_token, item_id } = exchData;

    // Get account list
    const acctRes = await fetch(`${PLAID_BASE}/accounts/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, access_token }),
    });
    const acctData = await acctRes.json();
    const accounts = acctData.accounts || [];
    const institutionName = acctData.item?.institution_id || "Bank";

    // Upsert into Supabase plaid_items table
    await fetch(`${SUPABASE_URL}/rest/v1/plaid_items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + token,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ user_id: user.id, item_id, access_token, institution_name: institutionName, accounts }),
    });

    return res.status(200).json({ ok: true, item_id, institution_name: institutionName, accounts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
