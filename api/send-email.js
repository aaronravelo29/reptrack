// Resend-powered email sender for RepTrack Email Robot
// Requires RESEND_API_KEY in Vercel environment variables.
// Sign up free at resend.com — 100 emails/day on free tier.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM || "RepTrack Robot <robot@reptrack.ai>";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function sendOne({ to, subject, text }) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.message || `Resend error ${r.status}`);
  }
  return await r.json();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { emails } = req.body || {};
  // emails = [{ to, subject, text, label }, ...]

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "No emails provided" });
  }

  if (!RESEND_API_KEY) {
    // Return a helpful error so the frontend can fall back to mailto:
    return res.status(200).json({
      resend_configured: false,
      message: "Add RESEND_API_KEY to Vercel env vars to enable auto-send.",
    });
  }

  const results = [];
  for (const email of emails) {
    try {
      const result = await sendOne(email);
      results.push({ label: email.label, status: "sent", id: result.id });
    } catch (err) {
      results.push({ label: email.label, status: "error", error: err.message });
    }
  }

  return res.status(200).json({ resend_configured: true, results });
}
