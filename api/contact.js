// Handles "Contact Sales" form submissions from the landing page Team tier.
// Sends notification email via Resend (same setup as send-email.js).
// Required Vercel env var: RESEND_API_KEY
// Optional env vars: RESEND_FROM (sender address), CONTACT_TO (recipient, defaults to hello@reptrack.ai)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM || "RepTrack Contact <contact@reptrack.ai>";
const CONTACT_TO = process.env.CONTACT_TO || "hello@reptrack.ai";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, company, properties, message } = req.body || {};

  // Basic validation
  if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email" });
  if (String(message || "").length > 2000) return res.status(400).json({ error: "Message too long" });

  // No Resend key → return mailto fallback so frontend can open the user's email client
  if (!RESEND_API_KEY) {
    const subject = `RepTrack Team plan inquiry — ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\nCompany: ${company || ""}\nProperties: ${properties || ""}\n\nMessage:\n${message || ""}`;
    const mailto = `mailto:${CONTACT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return res.status(200).json({ resend_configured: false, mailto });
  }

  try {
    const html = `
      <h2>New RepTrack Team plan inquiry</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">
        <tr><td><strong>Name:</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>Email:</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Company:</strong></td><td>${escapeHtml(company || "—")}</td></tr>
        <tr><td><strong>Properties:</strong></td><td>${escapeHtml(properties || "—")}</td></tr>
      </table>
      <p style="margin-top:18px"><strong>Message:</strong></p>
      <p style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(message || "(no message)")}</p>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [CONTACT_TO],
        reply_to: email,
        subject: `RepTrack Team inquiry — ${name}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: err.message || `Resend error ${r.status}` });
    }

    return res.status(200).json({ resend_configured: true, sent: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
