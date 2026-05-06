// Fetches transactions for all Plaid items linked to the authenticated user.
// Returns both the linked accounts list and recent transactions.

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

function isoDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Auto-categorize a Plaid transaction for real estate tax purposes
function categorize(tx) {
  const name = (tx.name || "").toLowerCase();
  const cats = (tx.personal_finance_category?.primary || tx.category?.[0] || "").toLowerCase();

  if (cats.includes("rent") || name.includes("rent") || name.includes("rental income")) return { account: "4010", accountName: "Rental Income", confidence: 0.97 };
  if (cats.includes("mortgage") || name.includes("mortgage") || name.includes("mtg")) return { account: "6080", accountName: "Mortgage Interest", confidence: 0.96 };
  if (name.includes("insurance") || name.includes("state farm") || name.includes("allstate") || name.includes("geico")) return { account: "6050", accountName: "Insurance", confidence: 0.96 };
  if (name.includes("home depot") || name.includes("lowe") || name.includes("ace hardware")) return { account: "6100", accountName: "Repairs & Maintenance", confidence: 0.94 };
  if (cats.includes("utilities") || name.includes("electric") || name.includes("gas") || name.includes("water") || name.includes("utility")) return { account: "6040", accountName: "Utilities", confidence: 0.93 };
  if (name.includes("plumb") || name.includes("hvac") || name.includes("electric") || name.includes("roofing")) return { account: "6030", accountName: "Contractor Services", confidence: 0.88 };
  if (cats.includes("tax") || name.includes("county tax") || name.includes("property tax")) return { account: "6070", accountName: "Property Taxes", confidence: 0.97 };
  if (cats.includes("travel") || name.includes("shell") || name.includes("exxon") || name.includes("bp oil") || cats.includes("gas station")) return { account: "6020", accountName: "Auto & Travel", confidence: 0.72 };
  if (cats.includes("subscription") || name.includes("amazon") || name.includes("costco") || name.includes("walmart")) return { account: "6110", accountName: "Supplies", confidence: 0.65 };
  return { account: "6999", accountName: "Uncategorized", confidence: 0.40 };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return res.status(200).json({ configured: false, items: [], transactions: [] });
  }

  // Load linked items from Supabase
  let items = [];
  try {
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/plaid_items?user_id=eq.${user.id}&select=*`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token } }
    );
    if (itemsRes.ok) items = await itemsRes.json();
  } catch { /* table may not exist yet */ }

  if (!Array.isArray(items)) items = [];

  // Fetch transactions for each item (last 90 days)
  const endDate = isoDate(0);
  const startDate = isoDate(90);
  const allTransactions = [];
  const allAccounts = [];

  for (const item of items) {
    try {
      const txRes = await fetch(`${PLAID_BASE}/transactions/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: item.access_token,
          start_date: startDate,
          end_date: endDate,
          options: { count: 250, include_personal_finance_category: true },
        }),
      });
      const txData = await txRes.json();
      if (txData.transactions) {
        for (const tx of txData.transactions) {
          const cat = categorize(tx);
          allTransactions.push({
            id: tx.transaction_id,
            date: tx.date,
            desc: tx.name,
            amount: tx.amount * -1,  // Plaid: positive = debit, we invert so expense = negative
            account: cat.account,
            accountName: cat.accountName,
            confidence: cat.confidence,
            flagged: cat.confidence < 0.70,
            plaidCategory: tx.personal_finance_category?.primary || null,
            itemId: item.item_id,
          });
        }
      }
      // Collect accounts with current balances
      if (Array.isArray(item.accounts)) {
        for (const acct of item.accounts) {
          allAccounts.push({
            id: acct.account_id,
            name: `${item.institution_name || "Bank"} ${acct.name} ••${acct.mask || ""}`,
            balance: acct.balances?.current ?? 0,
            lastSync: "just now",
            status: "connected",
            txCount: txData.transactions?.filter(t => t.account_id === acct.account_id).length ?? 0,
            itemId: item.item_id,
          });
        }
      }
    } catch { /* skip failed items */ }
  }

  // Sort transactions newest first
  allTransactions.sort((a, b) => b.date.localeCompare(a.date));

  return res.status(200).json({
    configured: true,
    items: items.map(i => ({ item_id: i.item_id, institution_name: i.institution_name, accounts: i.accounts })),
    accounts: allAccounts,
    transactions: allTransactions,
  });
}
