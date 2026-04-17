// ═══════════════════════════════════════════════════════════════════════════
// RepTrack: Hardened /api/chat endpoint
// ═══════════════════════════════════════════════════════════════════════════
// Drop-in replacement for api/chat.js in your repo.
//
// WHAT THIS FIXES:
//   1. Validates Supabase JWT on every request (blocks anonymous scrapers)
//   2. Per-user rate limiting (50 msgs/hour) using Supabase as the store
//   3. Per-user daily cost cap (prevents runaway API bills)
//   4. Logs every call for abuse detection
//   5. CORS lockdown to reptrack.ai only
//
// ENVIRONMENT VARIABLES (set in Vercel → Settings → Environment Variables):
//   ANTHROPIC_API_KEY         — your Anthropic key (you already have this)
//   SUPABASE_URL              — https://lzxutumsrzjovjmebqns.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Supabase → Settings → API → service_role key
//                               (DIFFERENT from anon key — NEVER put in client)
//   ALLOWED_ORIGIN            — https://reptrack.ai  (optional; default below)
//
// DATABASE SETUP — run this SQL in Supabase once:
//
//   CREATE TABLE IF NOT EXISTS public.api_usage (
//     id          BIGSERIAL PRIMARY KEY,
//     user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     endpoint    TEXT NOT NULL,
//     tokens_in   INTEGER,
//     tokens_out  INTEGER,
//     cost_cents  INTEGER,
//     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
//   );
//   CREATE INDEX IF NOT EXISTS idx_api_usage_user_time
//     ON public.api_usage(user_id, created_at DESC);
//   ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "usage_select_own" ON public.api_usage
//     FOR SELECT USING (auth.uid() = user_id);
//   -- No INSERT policy for users — only the service role (this endpoint) writes.
//
// ═══════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

// Rate limits (tune as needed)
const RATE_LIMIT_PER_HOUR = 50;      // messages per user per hour
const DAILY_COST_CAP_CENTS = 200;    // $2.00/user/day — tune based on your plan pricing

// Rough cost estimates for claude-sonnet-4 ($3/MTok input, $15/MTok output)
const COST_PER_1K_INPUT_CENTS = 0.3;
const COST_PER_1K_OUTPUT_CENTS = 1.5;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://reptrack.ai";

// ─── Helpers ──────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}

// Validate the Supabase JWT by asking Supabase who it belongs to.
// This is the authoritative check — if Supabase says the token is valid,
// we trust the user_id it returns. NEVER decode the JWT client-side and trust it.
async function validateSupabaseJwt(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

// Check rate limits using the service role to query api_usage.
// Returns { allowed: bool, reason?: string }
async function checkRateLimit(userId) {
  const baseHeaders = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Hourly message count
  const hourlyRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/api_usage` +
      `?user_id=eq.${userId}&created_at=gte.${oneHourAgo}&select=id`,
    { headers: { ...baseHeaders, Prefer: "count=exact" } }
  );
  const hourlyCount = parseInt(
    hourlyRes.headers.get("content-range")?.split("/")[1] || "0",
    10
  );
  if (hourlyCount >= RATE_LIMIT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Rate limit: ${RATE_LIMIT_PER_HOUR} messages per hour. Try again shortly.`,
    };
  }

  // Daily cost cap
  const dailyRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/api_usage` +
      `?user_id=eq.${userId}&created_at=gte.${oneDayAgo}&select=cost_cents`,
    { headers: baseHeaders }
  );
  const dailyRows = await dailyRes.json();
  const dailyCost = Array.isArray(dailyRows)
    ? dailyRows.reduce((sum, r) => sum + (r.cost_cents || 0), 0)
    : 0;
  if (dailyCost >= DAILY_COST_CAP_CENTS) {
    return {
      allowed: false,
      reason: "Daily usage cap reached. Resets in 24 hours.",
    };
  }

  return { allowed: true };
}

// Fire-and-forget usage logging (don't block the response on this)
async function logUsage(userId, inputTokens, outputTokens) {
  const costCents = Math.ceil(
    (inputTokens / 1000) * COST_PER_1K_INPUT_CENTS +
      (outputTokens / 1000) * COST_PER_1K_OUTPUT_CENTS
  );
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/api_usage`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint: "chat",
        tokens_in: inputTokens,
        tokens_out: outputTokens,
        cost_cents: costCents,
      }),
    });
  } catch (err) {
    console.error("Failed to log usage:", err);
    // Don't throw — logging failure shouldn't break the user's request.
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed");
  }

  // 1. Auth: extract and validate Supabase JWT
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const user = await validateSupabaseJwt(token);
  if (!user) {
    return jsonError(res, 401, "Unauthorized: missing or invalid session");
  }

  // 2. Rate limit check
  const limit = await checkRateLimit(user.id);
  if (!limit.allowed) {
    return jsonError(res, 429, limit.reason);
  }

  // 3. Validate body
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(res, 400, "messages array is required");
  }
  // Sanity cap on message count — prevents someone crafting a huge payload
  if (messages.length > 60) {
    return jsonError(res, 400, "Conversation too long");
  }
  if (typeof system !== "string" || system.length > 50000) {
    return jsonError(res, 400, "Invalid system prompt");
  }

  // 4. Forward to Anthropic
  try {
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", data);
      return jsonError(
        res,
        502,
        data?.error?.message || "Upstream AI error"
      );
    }

    // 5. Log usage (fire-and-forget, don't await)
    const inTokens = data?.usage?.input_tokens || 0;
    const outTokens = data?.usage?.output_tokens || 0;
    logUsage(user.id, inTokens, outTokens);

    return res.status(200).json(data);
  } catch (err) {
    console.error("Handler error:", err);
    return jsonError(res, 500, "Internal server error");
  }
}
