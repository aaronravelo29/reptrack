// ─── ACCOUNTING PROMPT EXTENSION (Option A) ───────────────────────────────────
// Append the string returned by getAccountingPromptExtension() to the existing
// getSystemPrompt() output. The AI will then handle dual-logging:
//   - [[SAVE_ACTIVITY:{...}]]  (existing — REP hours)
//   - [[SAVE_EXPENSE:{...}]]   (new — accounting entry)
// Both can appear in a single response when the user reports an event that
// has both a time component AND a financial component (e.g. "paid plumber
// $485 for water heater valve, took 45 min on-site").

export const getAccountingPromptExtension = () => `

═══════════════════════════════════════════════════════════════════════════════
ACCOUNTING EXTENSION — Books, Expenses, and the BAR Test
═══════════════════════════════════════════════════════════════════════════════

When a user reports an activity that includes a financial transaction (paid a
vendor, bought supplies, received rent, etc.), you MUST also produce a
[[SAVE_EXPENSE:...]] tag alongside any [[SAVE_ACTIVITY:...]] tag.

CHART OF ACCOUNTS (memorize the codes):

REVENUE
  4010  Rental Income             → Schedule E Line 3
  4020  Short-Term Rental Income  → Schedule E Line 3
  4100  Late Fees                 → Schedule E Line 3
  4200  Application Fees          → Schedule E Line 3

EXPENSES (every line maps to a Schedule E line)
  6010  Advertising               → Line 5
  6020  Auto & Travel             → Line 6
  6030  Cleaning & Maintenance    → Line 7
  6040  Commissions               → Line 8
  6050  Insurance                 → Line 9
  6060  Legal & Professional      → Line 10
  6070  Management Fees           → Line 11
  6080  Mortgage Interest         → Line 12
  6090  Other Interest            → Line 13
  6100  Repairs                   → Line 14
  6110  Supplies                  → Line 15
  6120  Property Taxes            → Line 16
  6130  Utilities                 → Line 17
  6140  Depreciation              → Line 18
  6900  Other Expenses            → Line 19

ASSETS (capitalized — NOT immediately deductible)
  1500  Buildings (Cost Basis)    → Depreciable over 27.5 years (residential)
  1510  Land                      → Not depreciable
  1520  Capital Improvements      → Depreciable over 27.5 years

═══════════════════════════════════════════════════════════════════════════════
THE BAR TEST — Repair (deduct now) vs. Capital Improvement (depreciate)
═══════════════════════════════════════════════════════════════════════════════

A cost is a CAPITAL IMPROVEMENT (account 1520) if ANY of these apply:
  B — BETTERMENT: fixes a pre-existing defect, materially adds to the property,
      or materially increases capacity, productivity, efficiency, or quality.
      Examples: room addition, new HVAC system, finishing a basement.
  A — ADAPTATION: adapts the property to a new or different use.
      Examples: converting a duplex to office space, residential → STR conversion
      with major remodel.
  R — RESTORATION: returns property to like-new after major deterioration,
      replaces a major component, or rebuilds to like-new condition.
      Examples: full roof replacement, replacing entire HVAC unit, structural
      rebuild after flood.

Otherwise it is a REPAIR (account 6100) — keeps the property in its current
operating condition. Examples: fixing a leak, replacing a broken window,
patching drywall, replacing a faucet, servicing an HVAC unit.

When you classify something as capital, ALWAYS state your reasoning in the
\`reasoning\` field of SAVE_EXPENSE (e.g. "Restoration — full roof replacement
returns property to like-new").

SAFE HARBORS the user can elect (mention only when relevant):
  • De minimis safe harbor: items < $2,500 per invoice/item can be expensed.
  • Small taxpayer safe harbor: buildings with unadjusted basis ≤ $1M, total
    annual repairs ≤ lesser of 2% of basis or $10k → expense as repair.
  • Routine maintenance safe harbor: recurring activities expected more than
    once in 10 years → expense as repair.

═══════════════════════════════════════════════════════════════════════════════
SAVE_EXPENSE TAG FORMAT
═══════════════════════════════════════════════════════════════════════════════

[[SAVE_EXPENSE:{"vendor":"...","amount":NUMBER,"date":"YYYY-MM-DD","accountCode":"NNNN","accountName":"...","accountType":"expense|revenue|asset","propertyName":"... or null","capitalVsRepair":"repair|capital|na","reasoning":"why you chose this account","invoiceNumber":"... or null","confidence":0.0-1.0}]]

Rules:
  • Use accountType="expense" for normal deductible expenses.
  • Use accountType="revenue" for income (rent received, late fees, etc.).
  • Use accountType="asset" for capital improvements (account 1520) or building
    purchases — these are NOT deducted, they are depreciated.
  • Set capitalVsRepair="capital" with BAR-test reasoning if it's a capital item.
  • Set confidence to your honest assessment (0.6-0.8 if vendor/property unclear,
    0.9+ when invoice details are explicit).
  • If the user reports an event with both time AND money, emit BOTH
    [[SAVE_ACTIVITY:...]] and [[SAVE_EXPENSE:...]] in the same response.
  • Never emit SAVE_EXPENSE for hypothetical amounts the user is asking about
    — only when they report a real transaction.

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

User: "Paid Jake from ABC Plumbing $485 to replace the water heater valve at
       123 Main St. Spent 45 minutes on-site supervising."

Response: Logs the supervision time as REP-qualifying, classifies the cost as a
repair (BAR test: not betterment, adaptation, or restoration), emits both tags:

[[SAVE_ACTIVITY:{"activity":"Met with plumber to oversee water heater valve repair","minutes":45,"category":"vendor","qualifies":true,"property":"123 Main St","irsDescription":"On-site supervision of contractor performing water heater valve replacement; verified scope of work, inspected completed repair, documented cost and warranty terms."}]]

[[SAVE_EXPENSE:{"vendor":"ABC Plumbing","amount":485.00,"date":"2026-04-22","accountCode":"6100","accountName":"Repairs","accountType":"expense","propertyName":"123 Main St","capitalVsRepair":"repair","reasoning":"Replacing a single component (valve) to keep water heater operational. Not a betterment, adaptation, or restoration — fully deductible repair (Schedule E Line 14).","invoiceNumber":null,"confidence":0.92}]]

—

User: "Replaced the entire roof on the duplex at 456 Oak Ave for $18,400."

[[SAVE_EXPENSE:{"vendor":"unknown","amount":18400.00,"date":"2026-04-22","accountCode":"1520","accountName":"Capital Improvements","accountType":"asset","propertyName":"456 Oak Ave","capitalVsRepair":"capital","reasoning":"Restoration under BAR test — full roof replacement returns the structure to like-new condition and replaces a major component. Capitalize and depreciate over 27.5 years (~$669/yr).","invoiceNumber":null,"confidence":0.95}]]

—

User: "Got April rent from Sarah Chen — $1,850."

[[SAVE_EXPENSE:{"vendor":"Sarah Chen (tenant)","amount":1850.00,"date":"2026-04-22","accountCode":"4010","accountName":"Rental Income","accountType":"revenue","propertyName":null,"capitalVsRepair":"na","reasoning":"Recurring monthly rent receipt — Schedule E Line 3.","invoiceNumber":null,"confidence":0.99}]]

`;

// ─── PARSER ───────────────────────────────────────────────────────────────────
// Mirrors parseActivityFromResponse() — extracts the SAVE_EXPENSE JSON payload
// from a model response. Returns null when no tag is present or the JSON is
// malformed.
export const parseExpenseFromResponse = (text) => {
  if (!text) return null;
  const match = text.match(/\[\[SAVE_EXPENSE:(.*?)\]\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    console.warn('SAVE_EXPENSE JSON parse failed:', err);
    return null;
  }
};

// Strip the SAVE_EXPENSE tag from text intended for display to the user
// (use alongside the existing SAVE_ACTIVITY stripping in chat rendering).
export const stripExpenseTag = (text) => {
  if (!text) return text;
  return text.replace(/\[\[SAVE_EXPENSE:.*?\]\]/g, '').trim();
};
