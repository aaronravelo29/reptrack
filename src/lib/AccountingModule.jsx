import React, { useState, useMemo } from 'react';

// ─── CHART OF ACCOUNTS ────────────────────────────────────────────────────────
// 5-type structure (Asset / Liability / Equity / Revenue / Expense).
// Every expense line is mapped to its Schedule E reporting line so P&L → tax
// generation is a join, not a reconstruction.
export const CHART_OF_ACCOUNTS = {
  asset: [
    { code: '1010', name: 'Operating Bank Account', subtype: 'Bank' },
    { code: '1020', name: 'Trust / Security Deposit Account', subtype: 'Bank' },
    { code: '1030', name: 'Clearing Account', subtype: 'Bank' },
    { code: '1200', name: 'Tenant Rent Receivable', subtype: 'A/R' },
    { code: '1500', name: 'Buildings (Cost Basis)', subtype: 'Fixed Asset' },
    { code: '1510', name: 'Land', subtype: 'Fixed Asset' },
    { code: '1520', name: 'Capital Improvements', subtype: 'Fixed Asset' },
    { code: '1590', name: 'Accumulated Depreciation', subtype: 'Contra Asset' },
  ],
  liability: [
    { code: '2010', name: 'Accounts Payable', subtype: 'A/P' },
    { code: '2100', name: 'Security Deposits Held', subtype: 'Current Liability' },
    { code: '2500', name: 'Mortgage Payable', subtype: 'Long-Term Debt' },
  ],
  equity: [
    { code: '3010', name: "Owner's Capital", subtype: 'Equity' },
    { code: '3020', name: "Owner's Draws", subtype: 'Equity' },
    { code: '3900', name: 'Retained Earnings', subtype: 'Equity' },
  ],
  revenue: [
    { code: '4010', name: 'Rental Income', schedE: 'Line 3', subtype: 'Rent' },
    { code: '4020', name: 'Short-Term Rental Income', schedE: 'Line 3', subtype: 'STR' },
    { code: '4100', name: 'Late Fees', schedE: 'Line 3', subtype: 'Other Income' },
    { code: '4200', name: 'Application Fees', schedE: 'Line 3', subtype: 'Other Income' },
  ],
  expense: [
    { code: '6010', name: 'Advertising', schedE: 'Line 5', deductible: true },
    { code: '6020', name: 'Auto & Travel', schedE: 'Line 6', deductible: true },
    { code: '6030', name: 'Cleaning & Maintenance', schedE: 'Line 7', deductible: true },
    { code: '6040', name: 'Commissions', schedE: 'Line 8', deductible: true },
    { code: '6050', name: 'Insurance', schedE: 'Line 9', deductible: true },
    { code: '6060', name: 'Legal & Professional Fees', schedE: 'Line 10', deductible: true },
    { code: '6070', name: 'Management Fees', schedE: 'Line 11', deductible: true },
    { code: '6080', name: 'Mortgage Interest', schedE: 'Line 12', deductible: true },
    { code: '6090', name: 'Other Interest', schedE: 'Line 13', deductible: true },
    { code: '6100', name: 'Repairs', schedE: 'Line 14', deductible: true },
    { code: '6110', name: 'Supplies', schedE: 'Line 15', deductible: true },
    { code: '6120', name: 'Property Taxes', schedE: 'Line 16', deductible: true },
    { code: '6130', name: 'Utilities', schedE: 'Line 17', deductible: true },
    { code: '6140', name: 'Depreciation', schedE: 'Line 18', deductible: true },
    { code: '6900', name: 'Other Expenses', schedE: 'Line 19', deductible: true },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
};

const allExpenseAccounts = () => CHART_OF_ACCOUNTS.expense;
const allRevenueAccounts = () => CHART_OF_ACCOUNTS.revenue;

const findAccount = (code) => {
  for (const type of Object.keys(CHART_OF_ACCOUNTS)) {
    const acct = CHART_OF_ACCOUNTS[type].find(a => a.code === code);
    if (acct) return { ...acct, type };
  }
  return null;
};

// ─── SAMPLE DATA (placeholders until Plaid + Supabase wired) ─────────────────
const SAMPLE_BANK_ACCOUNTS = [
  { id: 'b1', name: 'Chase Operating ••4521', balance: 24816.42, lastSync: '2 min ago', status: 'connected', txCount: 47 },
  { id: 'b2', name: 'BofA Trust ••8830', balance: 11200.00, lastSync: '2 min ago', status: 'connected', txCount: 4 },
  { id: 'b3', name: 'Chase Clearing ••1102', balance: 0.00, lastSync: '12 min ago', status: 'connected', txCount: 2 },
];

const SAMPLE_TRANSACTIONS = [
  { id: 't1', date: '2026-04-22', desc: 'HOME DEPOT #4112', amount: -147.83, account: '6100', accountName: 'Repairs', confidence: 0.96, property: '123 Main St', flagged: false },
  { id: 't2', date: '2026-04-21', desc: 'STATE FARM PREMIUM', amount: -312.50, account: '6050', accountName: 'Insurance', confidence: 0.99, property: '123 Main St', flagged: false },
  { id: 't3', date: '2026-04-20', desc: 'ACH RENT - S CHEN', amount: 1850.00, account: '4010', accountName: 'Rental Income', confidence: 0.99, property: '123 Main St — Unit 2B', flagged: false },
  { id: 't4', date: '2026-04-19', desc: 'AMAZON.COM*RT5K9', amount: -42.18, account: '6110', accountName: 'Supplies', confidence: 0.71, property: null, flagged: true },
  { id: 't5', date: '2026-04-18', desc: 'ABC PLUMBING INV-204', amount: -485.00, account: '6030', accountName: 'Cleaning & Maintenance', confidence: 0.94, property: '456 Oak Ave', flagged: false },
  { id: 't6', date: '2026-04-17', desc: 'CHASE MTG XXXX', amount: -1842.16, account: '6080', accountName: 'Mortgage Interest', confidence: 0.99, property: '123 Main St', flagged: false },
  { id: 't7', date: '2026-04-15', desc: 'SHELL OIL 4421', amount: -68.40, account: '6020', accountName: 'Auto & Travel', confidence: 0.62, property: null, flagged: true },
];

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const tabBtn = (active, C) => ({
  padding: '10px 16px',
  background: active ? C.goldPale : 'transparent',
  border: `1px solid ${active ? C.goldL : C.borderL}`,
  borderRadius: 6,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: active ? C.gold : C.mid,
  cursor: 'pointer',
});

const sectionLabel = (C) => ({
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: C.light,
  marginBottom: 8,
});

// ─── ACCOUNTING VIEW ──────────────────────────────────────────────────────────
export function AccountingView({ C, fs, entries = [], expenses = [], properties = [], onOpenQuickBill }) {
  const [tab, setTab] = useState('chart');
  const [basis, setBasis] = useState('cash');

  // Compute P&L from expenses + entries
  const summary = useMemo(() => {
    const revenue = expenses
      .filter(e => e.accountType === 'revenue')
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenseTotal = expenses
      .filter(e => e.accountType === 'expense')
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const net = revenue - expenseTotal;
    return { revenue, expenseTotal, net, count: expenses.length };
  }, [expenses]);

  return (
    <div style={{ padding: 16, paddingBottom: 80, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel(C)}>Accounting · {basis === 'cash' ? 'Cash Basis' : 'Accrual Basis'}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.dark }}>Books</div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="card" style={{ borderTop: `3px solid ${C.goldL}`, padding: 14 }}>
          <div style={sectionLabel(C)}>Revenue YTD</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.gold }}>
            {fmtUSD(summary.revenue)}
          </div>
        </div>
        <div className="card" style={{ borderTop: `3px solid ${C.border}`, padding: 14 }}>
          <div style={sectionLabel(C)}>Expenses YTD</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.mid }}>
            {fmtUSD(summary.expenseTotal)}
          </div>
        </div>
        <div className="card" style={{ borderTop: `3px solid ${C.goldL}`, padding: 14 }}>
          <div style={sectionLabel(C)}>Net Income</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: summary.net >= 0 ? C.gold : C.mid }}>
            {fmtUSD(summary.net)}
          </div>
        </div>
        <div className="card" style={{ borderTop: `3px solid ${C.border}`, padding: 14 }}>
          <div style={sectionLabel(C)}>Transactions</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.dark }}>
            {summary.count}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setBasis(basis === 'cash' ? 'accrual' : 'cash')} style={tabBtn(false, C)}>
          {basis === 'cash' ? 'Cash → Accrual' : 'Accrual → Cash'}
        </button>
        <button onClick={onOpenQuickBill} style={{ ...tabBtn(true, C), background: C.gold, color: C.white, borderColor: C.gold }}>
          + QuickBill
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `1px solid ${C.borderL}`, paddingBottom: 10, flexWrap: 'wrap' }}>
        {[
          { id: 'chart', label: 'Chart of Accounts' },
          { id: 'pl', label: 'Profit & Loss' },
          { id: 'balance', label: 'Balance Sheet' },
          { id: 'cashflow', label: 'Cash Flow' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id, C)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chart' && <ChartOfAccountsTab C={C} />}
      {tab === 'pl' && <ProfitLossTab C={C} expenses={expenses} properties={properties} basis={basis} />}
      {tab === 'balance' && <BalanceSheetTab C={C} />}
      {tab === 'cashflow' && <CashFlowTab C={C} expenses={expenses} />}
    </div>
  );
}

// ─── Chart of Accounts Tab ───────────────────────────────────────────────────
function ChartOfAccountsTab({ C }) {
  const types = [
    { key: 'asset',     label: 'Assets',      color: C.goldL },
    { key: 'liability', label: 'Liabilities', color: C.lighter },
    { key: 'equity',    label: 'Equity',      color: C.lighter },
    { key: 'revenue',   label: 'Revenue',     color: C.goldL },
    { key: 'expense',   label: 'Expenses',    color: C.light },
  ];
  return (
    <div>
      {types.map(t => (
        <div key={t.key} className="card" style={{ marginBottom: 12, padding: 14, borderLeft: `3px solid ${t.color}` }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: t.color, fontWeight: 600, marginBottom: 8 }}>
            {t.label} · {CHART_OF_ACCOUNTS[t.key].length} accounts
          </div>
          {CHART_OF_ACCOUNTS[t.key].map(a => (
            <div key={a.code} style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr auto',
              gap: 10,
              padding: '8px 0',
              borderBottom: `1px solid ${C.borderL}`,
              alignItems: 'center',
              fontSize: 13,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.light, fontSize: 11 }}>{a.code}</span>
              <span style={{ color: C.text }}>{a.name}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1 }}>
                {a.schedE || a.subtype}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Profit & Loss Tab ───────────────────────────────────────────────────────
function ProfitLossTab({ C, expenses, properties, basis }) {
  const groups = useMemo(() => {
    const byCode = {};
    expenses.forEach(e => {
      const code = e.accountCode || '6900';
      if (!byCode[code]) byCode[code] = { code, name: e.accountName || 'Other', total: 0, count: 0 };
      byCode[code].total += Number(e.amount || 0);
      byCode[code].count += 1;
    });
    return Object.values(byCode).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const totalRev = expenses.filter(e => e.accountType === 'revenue').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalExp = expenses.filter(e => e.accountType === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 14 }}>
        Profit & Loss · YTD ({basis === 'cash' ? 'Cash' : 'Accrual'})
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: C.light, fontSize: 13 }}>
          No transactions categorized yet. Use QuickBill or sync a bank account to populate the P&L.
        </div>
      ) : (
        <>
          {groups.map(g => (
            <div key={g.code} style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr auto auto',
              gap: 10,
              padding: '10px 0',
              borderBottom: `1px solid ${C.borderL}`,
              fontSize: 13,
              alignItems: 'center',
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.light, fontSize: 11 }}>{g.code}</span>
              <span style={{ color: C.text }}>{g.name}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.light }}>{g.count} txn</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: C.text }}>
                {fmtUSD(g.total)}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: 12, background: C.goldPale, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: C.text }}>Total Revenue</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.green, fontWeight: 600 }}>{fmtUSD(totalRev)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: C.text }}>Total Expenses</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.red, fontWeight: 600 }}>{fmtUSD(totalExp)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, paddingTop: 8, borderTop: `1px solid ${C.gold}` }}>
              <span style={{ color: C.dark }}>Net Income</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: (totalRev - totalExp) >= 0 ? C.green : C.red }}>
                {fmtUSD(totalRev - totalExp)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Balance Sheet Tab ───────────────────────────────────────────────────────
function BalanceSheetTab({ C }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 14 }}>Balance Sheet</div>
      <div style={{ padding: 16, background: C.goldPale, borderRadius: 6, fontSize: 13, color: C.mid, lineHeight: 1.6 }}>
        Balance sheet generation requires connected banks and posted journal entries.
        Connect a bank account in Banking, then return here for live totals.
      </div>
      <div style={{ marginTop: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.light }}>
        ASSETS = LIABILITIES + EQUITY
      </div>
    </div>
  );
}

// ─── Cash Flow Tab ───────────────────────────────────────────────────────────
function CashFlowTab({ C, expenses }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 14 }}>Cash Flow Statement</div>
      <div style={{ padding: 16, background: C.bluePale, borderRadius: 6, fontSize: 13, color: C.mid, lineHeight: 1.6 }}>
        Cash flow report becomes available once at least one full month of bank-synced
        transactions has posted. Operating, investing, and financing activities are
        derived from the categorized ledger.
      </div>
    </div>
  );
}

// ─── BANKING VIEW ─────────────────────────────────────────────────────────────
export function BankingView({ C, fs }) {
  const [accounts] = useState(SAMPLE_BANK_ACCOUNTS);
  const [transactions, setTransactions] = useState(SAMPLE_TRANSACTIONS);
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'flagged') return transactions.filter(t => t.flagged);
    if (filter === 'income') return transactions.filter(t => t.amount > 0);
    if (filter === 'expense') return transactions.filter(t => t.amount < 0);
    return transactions;
  }, [transactions, filter]);

  const approve = (id) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, flagged: false, confidence: 1.0 } : t));
  };

  return (
    <div style={{ padding: 16, paddingBottom: 80, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel(C)}>Banking · Plaid Sync</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.dark }}>Connected Accounts</div>
      </div>

      {/* Account cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {accounts.map(a => (
          <div key={a.id} className="card" style={{ padding: 16, borderLeft: `4px solid ${C.greenB}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{a.name}</span>
              <span style={{
                padding: '2px 8px',
                background: C.greenPale,
                color: C.green,
                borderRadius: 10,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>● Synced</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {fmtUSD(a.balance)}
            </div>
            <div style={{ fontSize: 11, color: C.light }}>
              {a.txCount} transactions · synced {a.lastSync}
            </div>
          </div>
        ))}
        <button style={{
          padding: 16,
          border: `2px dashed ${C.borderL}`,
          background: 'transparent',
          borderRadius: 6,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: C.light,
          cursor: 'pointer',
        }}>+ Connect Bank via Plaid</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'flagged', label: `Needs Review (${transactions.filter(t => t.flagged).length})` },
          { id: 'income', label: 'Income' },
          { id: 'expense', label: 'Expenses' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={tabBtn(filter === f.id, C)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 110px 130px 90px 60px',
          gap: 10,
          padding: '12px 14px',
          background: C.goldPale,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: C.gold,
          fontWeight: 600,
        }}>
          <span>Date</span>
          <span>Description</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span>Category</span>
          <span>Confidence</span>
          <span></span>
        </div>
        {visible.map(t => (
          <div key={t.id} style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 110px 130px 90px 60px',
            gap: 10,
            padding: '12px 14px',
            borderBottom: `1px solid ${C.borderL}`,
            alignItems: 'center',
            fontSize: 12,
            background: t.flagged ? C.orangePale : C.white,
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.light, fontSize: 11 }}>{t.date.slice(5)}</span>
            <div>
              <div style={{ color: C.text, fontSize: 13 }}>{t.desc}</div>
              {t.property && <div style={{ fontSize: 10, color: C.light, marginTop: 2 }}>{t.property}</div>}
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 600,
              color: t.amount >= 0 ? C.green : C.text,
              textAlign: 'right',
            }}>
              {fmtUSD(t.amount)}
            </span>
            <span style={{ fontSize: 11, color: C.mid }}>{t.accountName}</span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              color: t.confidence >= 0.9 ? C.green : t.confidence >= 0.75 ? C.gold : C.orange,
            }}>
              {(t.confidence * 100).toFixed(0)}%
            </span>
            {t.flagged ? (
              <button onClick={() => approve(t.id)} style={{
                padding: '4px 8px',
                background: C.gold,
                color: C.white,
                border: 'none',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>OK</button>
            ) : (
              <span style={{ fontSize: 12, color: C.green, textAlign: 'center' }}>✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QUICKBILL MODAL ──────────────────────────────────────────────────────────
export function QuickBillModal({ C, fs, isOpen, onClose, onSave, properties = [] }) {
  const [stage, setStage] = useState('upload'); // upload | extracting | review
  const [extracted, setExtracted] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const extractWithAI = async (file) => {
    setStage('extracting');
    try {
      const toBase64 = (f) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });

      const isImage = file && file.type.startsWith('image/');
      const today = new Date().toISOString().split('T')[0];
      const propList = properties.map(p => p.address || p.name).filter(Boolean).join(', ') || 'none on file';

      let messages;
      if (isImage) {
        const b64 = await toBase64(file);
        messages = [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } },
          { type: 'text', text: `Extract this receipt/invoice and return ONLY valid JSON (no markdown):
{"vendor":"...","invoiceNumber":"... or null","date":"YYYY-MM-DD","amount":0.00,"accountCode":"6XXX or 4XXX","accountName":"...","propertyName":"... or null","capitalVsRepair":"repair|capital|na","reasoning":"BAR test reasoning","confidence":0.0,"lineItems":[{"desc":"...","qty":1,"unit":0.00,"total":0.00}]}

Account codes: 6010 Advertising, 6020 Auto & Travel, 6030 Cleaning & Maintenance, 6040 Commissions, 6050 Insurance, 6060 Legal & Professional, 6070 Management Fees, 6080 Mortgage Interest, 6100 Repairs, 6110 Supplies, 6120 Property Taxes, 6130 Utilities, 4010 Rental Income.
Properties on file: ${propList}. Today: ${today}.` }
        ]}];
      } else {
        messages = [{ role: 'user', content: `No image provided. Return demo JSON for a $485 plumbing repair at ${propList.split(',')[0] || '123 Main St'} with BAR test reasoning. Return ONLY valid JSON, no markdown.` }];
      }

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: 'You are a receipt/invoice extraction AI for a real estate accounting system. Return only valid JSON, no markdown fences.', messages }),
      });
      const data = await resp.json();
      let text = data?.content?.[0]?.text || '{}';
      text = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setExtracted({ ...parsed, filename: file?.name || 'receipt', accountName: parsed.accountName || 'Repairs' });
      setStage('review');
    } catch (err) {
      // Fallback demo extraction if AI call fails
      setExtracted({
        filename: file?.name || 'receipt',
        vendor: 'Vendor (AI unavailable)',
        invoiceNumber: null,
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        accountCode: '6100',
        accountName: 'Repairs',
        propertyName: properties[0]?.address || null,
        capitalVsRepair: 'repair',
        reasoning: 'Could not reach AI — please fill in manually.',
        confidence: 0.5,
        lineItems: [],
      });
      setStage('review');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) extractWithAI(f);
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) extractWithAI(f);
  };

  const handleSave = () => {
    if (extracted && onSave) onSave(extracted);
    setStage('upload');
    setExtracted(null);
    onClose();
  };

  const reset = () => {
    setStage('upload');
    setExtracted(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13, 13, 26, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: C.white, borderRadius: 8, width: '100%', maxWidth: 580,
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          background: `linear-gradient(135deg, ${C.dark} 0%, ${C.darker} 100%)`,
          color: C.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 2, color: C.goldL, textTransform: 'uppercase' }}>
              QuickBill · AI Invoice Capture
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {stage === 'upload' && 'Drop invoice to extract'}
              {stage === 'extracting' && 'Reading invoice…'}
              {stage === 'review' && 'Review extraction'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.goldL}`,
            color: C.goldL, width: 32, height: 32, borderRadius: 4, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 22 }}>
          {stage === 'upload' && (
            <>
              <input id="qb-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFileInput} />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('qb-file-input').click()}
                style={{
                  padding: '50px 30px',
                  border: `2px dashed ${dragOver ? C.gold : C.borderL}`,
                  background: dragOver ? C.goldPale : C.bg,
                  borderRadius: 8,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 12 }}>📸</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  Drop a receipt photo or click to upload
                </div>
                <div style={{ fontSize: 12, color: C.light, marginBottom: 14 }}>
                  AI reads the image and instantly categorizes the expense by IRS code
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.light, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Powered by Claude Vision
                </div>
              </div>
            </>
          )}

          {stage === 'extracting' && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{
                width: 50, height: 50, border: `4px solid ${C.borderL}`,
                borderTopColor: C.gold, borderRadius: '50%',
                margin: '0 auto 18px',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 14, color: C.mid, marginBottom: 6 }}>Reading invoice with AI vision…</div>
              <div style={{ fontSize: 11, color: C.light, fontFamily: "'IBM Plex Mono', monospace" }}>
                Extracting · Classifying · BAR-test analysis
              </div>
            </div>
          )}

          {stage === 'review' && extracted && (
            <div>
              {/* Confidence banner */}
              <div style={{
                padding: '10px 14px',
                background: extracted.confidence >= 0.9 ? C.greenPale : C.orangePale,
                border: `1px solid ${extracted.confidence >= 0.9 ? C.greenB : C.orangeB}`,
                borderRadius: 6,
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
              }}>
                <span style={{ color: C.dark, fontWeight: 600 }}>
                  {extracted.confidence >= 0.9 ? '✓ High confidence extraction' : '⚠ Please verify before saving'}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                  {(extracted.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  ['Vendor', extracted.vendor],
                  ['Invoice #', extracted.invoiceNumber],
                  ['Date', extracted.date],
                  ['Amount', fmtUSD(extracted.amount)],
                  ['Account', `${extracted.accountCode} — ${extracted.accountName}`],
                  ['Property', extracted.propertyName],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 10, background: C.bg, borderRadius: 4 }}>
                    <div style={sectionLabel(C)}>{label}</div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Line items */}
              <div style={sectionLabel(C)}>Line Items</div>
              <div style={{ marginBottom: 14, border: `1px solid ${C.borderL}`, borderRadius: 4 }}>
                {extracted.lineItems.map((li, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 50px 90px 90px',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: i < extracted.lineItems.length - 1 ? `1px solid ${C.borderL}` : 'none',
                    fontSize: 12,
                  }}>
                    <span>{li.desc}</span>
                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{li.qty}</span>
                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(li.unit)}</span>
                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtUSD(li.total)}</span>
                  </div>
                ))}
              </div>

              {/* AI reasoning */}
              <div style={{
                padding: 12,
                background: C.bluePale,
                borderLeft: `3px solid ${C.blueB}`,
                borderRadius: 4,
                marginBottom: 18,
              }}>
                <div style={sectionLabel(C)}>AI Reasoning</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55 }}>
                  {extracted.reasoning}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} style={{
                  padding: '12px 18px',
                  background: 'transparent',
                  border: `1px solid ${C.borderL}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: C.mid,
                }}>← Re-upload</button>
                <button onClick={handleSave} style={{
                  flex: 1,
                  padding: '12px 18px',
                  background: C.gold,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: C.white,
                }}>Save to Books</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
