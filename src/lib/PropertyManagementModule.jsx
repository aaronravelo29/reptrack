import React, { useState, useMemo } from 'react';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtDate = (d) => { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const daysUntil = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };

const labelStyle = (C) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.light, marginBottom: 6 });

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const SAMPLE_PAYMENTS = [
  { id: 'p1', tenantId: null, tenantName: 'Sarah Chen', amount: 1850, date: '2026-04-01', method: 'ACH', status: 'paid', property: '123 Main St', unit: '2B' },
  { id: 'p2', tenantId: null, tenantName: 'Marcus Webb', amount: 2200, date: '2026-04-03', method: 'Check', status: 'paid', property: '456 Oak Ave', unit: '1A' },
  { id: 'p3', tenantId: null, tenantName: 'Julia Torres', amount: 1650, date: '2026-04-01', method: 'Venmo', status: 'paid', property: '123 Main St', unit: '1A' },
  { id: 'p4', tenantId: null, tenantName: 'Kevin Park', amount: 1950, date: null, method: null, status: 'overdue', property: '789 Pine Rd', unit: '3C', daysLate: 8 },
];

const SAMPLE_WORK_ORDERS = [
  { id: 'wo1', title: 'Water heater valve dripping', property: '123 Main St', unit: '2B', priority: 'medium', status: 'open', category: 'plumbing', vendor: null, cost: null, reportedDate: '2026-04-20', tenantName: 'Sarah Chen' },
  { id: 'wo2', title: 'HVAC not cooling Unit 1A', property: '123 Main St', unit: '1A', priority: 'high', status: 'in_progress', category: 'hvac', vendor: 'Cool Air HVAC', cost: 320, reportedDate: '2026-04-18', tenantName: 'Julia Torres' },
  { id: 'wo3', title: 'Broken window latch bedroom', property: '456 Oak Ave', unit: '1A', priority: 'low', status: 'open', category: 'general', vendor: null, cost: null, reportedDate: '2026-04-22', tenantName: 'Marcus Webb' },
  { id: 'wo4', title: 'Roof leak above living room', property: '789 Pine Rd', unit: null, priority: 'high', status: 'in_progress', category: 'roofing', vendor: 'TopShield Roofing', cost: 2800, reportedDate: '2026-04-15', tenantName: null },
  { id: 'wo5', title: 'Repaint hallway walls', property: '456 Oak Ave', unit: null, priority: 'low', status: 'scheduled', category: 'painting', vendor: 'ProPaint LLC', cost: 650, reportedDate: '2026-04-10', tenantName: null },
  { id: 'wo6', title: 'Replace kitchen faucet', property: '123 Main St', unit: '2B', priority: 'medium', status: 'completed', category: 'plumbing', vendor: 'ABC Plumbing', cost: 185, reportedDate: '2026-04-05', tenantName: 'Sarah Chen' },
];

// ─── FINANCIAL DASHBOARD WIDGETS ─────────────────────────────────────────────
export function FinancialDashboardWidgets({ C, properties = [], tenants = [], localExpenses = [] }) {
  const today = new Date();

  // Rent collection this month
  const totalRentOwed = useMemo(() => tenants.reduce((s, t) => s + Number(t.rent || 0), 0), [tenants]);
  const totalRentOwedFallback = totalRentOwed || 7650;
  const paidThisMonth = SAMPLE_PAYMENTS.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const overduePayments = SAMPLE_PAYMENTS.filter(p => p.status === 'overdue');
  const collectionRate = Math.round((paidThisMonth / totalRentOwedFallback) * 100);

  // Cash flow from properties
  const totalCashFlow = useMemo(() => properties.reduce((s, p) => {
    const rent = Number(p.rent || 0);
    const expenses = Number(p.taxes || 0) + Number(p.insurance || 0) + Number(p.hoa || 0) + Number(p.utilities || 0) + Number(p.maintenance || 0) + Number(p.propertyMgmt || 0);
    const mortgage = Number(p.mortgagePayment || 0);
    return s + (rent - expenses - mortgage);
  }, 0), [properties]);

  // Lease expirations in next 90 days
  const expiringLeases = useMemo(() => tenants.filter(t => {
    const days = daysUntil(t.leaseEnd);
    return days !== null && days >= 0 && days <= 90;
  }), [tenants]);

  // Maintenance summary
  const openWOs = SAMPLE_WORK_ORDERS.filter(w => w.status === 'open').length;
  const inProgressWOs = SAMPLE_WORK_ORDERS.filter(w => w.status === 'in_progress').length;

  const cardStyle = { borderRadius: 8, padding: 16, border: `1px solid ${C.borderL}` };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={labelStyle(C)}>Portfolio Snapshot · April 2026</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 4 }}>

        {/* Rent Collection */}
        <div className="card" style={{ ...cardStyle, borderLeft: `4px solid ${collectionRate >= 90 ? C.greenB : C.orangeB}` }}>
          <div style={labelStyle(C)}>Rent Collection · April</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.dark }}>{fmtUSD(paidThisMonth)}</div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>of {fmtUSD(totalRentOwedFallback)} owed · <span style={{ color: collectionRate >= 90 ? C.green : C.orange, fontWeight: 600 }}>{collectionRate}% collected</span></div>
          {overduePayments.length > 0 && (
            <div style={{ marginTop: 8, padding: '4px 8px', background: C.redPale, borderRadius: 4, fontSize: 11, color: C.red, fontWeight: 600 }}>
              ⚠ {overduePayments.length} overdue · {fmtUSD(overduePayments.reduce((s, p) => s + p.amount, 0))}
            </div>
          )}
        </div>

        {/* Cash Flow */}
        <div className="card" style={{ ...cardStyle, borderLeft: `4px solid ${(totalCashFlow || 3840) >= 0 ? C.greenB : C.redB}` }}>
          <div style={labelStyle(C)}>Monthly Cash Flow</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: (totalCashFlow || 3840) >= 0 ? C.green : C.red }}>
            {fmtUSD(totalCashFlow || 3840)}
          </div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>
            {properties.length || 3} properties · {fmtUSD((totalCashFlow || 3840) * 12)}/yr projected
          </div>
        </div>

        {/* Lease Expirations */}
        <div className="card" style={{ ...cardStyle, borderLeft: `4px solid ${expiringLeases.length > 0 ? C.orangeB : C.greenB}` }}>
          <div style={labelStyle(C)}>Lease Expirations (90d)</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: expiringLeases.length > 0 ? C.orange : C.green }}>
            {expiringLeases.length || 2}
          </div>
          {expiringLeases.length === 0 ? (
            <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>2 leases expiring · action needed</div>
          ) : (
            expiringLeases.slice(0, 2).map(t => (
              <div key={t.id} style={{ fontSize: 11, color: C.orange, marginTop: 4 }}>
                {t.firstName} {t.lastName} — {daysUntil(t.leaseEnd)}d
              </div>
            ))
          )}
        </div>

        {/* Maintenance */}
        <div className="card" style={{ ...cardStyle, borderLeft: `4px solid ${openWOs > 2 ? C.orangeB : C.blueB}` }}>
          <div style={labelStyle(C)}>Maintenance</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.dark }}>{openWOs + inProgressWOs}</div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>
            <span style={{ color: C.red }}>{openWOs} open</span> · <span style={{ color: C.orange }}>{inProgressWOs} in progress</span>
          </div>
        </div>
      </div>

      {/* Overdue rent alerts */}
      {overduePayments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {overduePayments.map(p => (
            <div key={p.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${C.redB}`, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, color: C.dark, fontSize: 13 }}>{p.tenantName}</span>
                <span style={{ fontSize: 12, color: C.light, marginLeft: 8 }}>{p.property} · Unit {p.unit}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.red }}>{fmtUSD(p.amount)}</div>
                <div style={{ fontSize: 10, color: C.red }}>{p.daysLate}d overdue</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAINTENANCE VIEW (KANBAN) ────────────────────────────────────────────────
export function MaintenanceView({ C, fs, properties = [], vendors = [] }) {
  const [workOrders, setWorkOrders] = useState(SAMPLE_WORK_ORDERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [newWO, setNewWO] = useState({ title: '', property: '', unit: '', priority: 'medium', category: 'general', notes: '' });

  const columns = [
    { id: 'open', label: 'Open', color: C.redB },
    { id: 'in_progress', label: 'In Progress', color: C.orangeB },
    { id: 'scheduled', label: 'Scheduled', color: C.blueB },
    { id: 'completed', label: 'Completed', color: C.greenB },
  ];

  const priorityColors = { high: C.red, medium: C.orange, low: C.blue };
  const priorityBg = { high: C.redPale, medium: C.orangePale, low: C.bluePale };

  const filtered = filterPriority === 'all' ? workOrders : workOrders.filter(w => w.priority === filterPriority);

  const advance = (id) => {
    const order = ['open', 'in_progress', 'scheduled', 'completed'];
    setWorkOrders(prev => prev.map(w => {
      if (w.id !== id) return w;
      const next = order[order.indexOf(w.status) + 1];
      return next ? { ...w, status: next } : w;
    }));
  };

  const addWO = () => {
    if (!newWO.title.trim()) return;
    setWorkOrders(prev => [{ ...newWO, id: `wo${Date.now()}`, status: 'open', reportedDate: new Date().toISOString().split('T')[0], vendor: null, cost: null, tenantName: null }, ...prev]);
    setNewWO({ title: '', property: '', unit: '', priority: 'medium', category: 'general', notes: '' });
    setShowAddModal(false);
  };

  return (
    <div style={{ padding: 16, paddingBottom: 80, fontFamily: "'Inter', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={labelStyle(C)}>Maintenance · Work Orders</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.dark }}>Maintenance Tracker</div>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ padding: '10px 18px', background: C.gold, border: 'none', borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.dark, cursor: 'pointer' }}>
          + New Work Order
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {columns.map(col => {
          const count = workOrders.filter(w => w.status === col.id).length;
          const cost = workOrders.filter(w => w.status === col.id && w.cost).reduce((s, w) => s + w.cost, 0);
          return (
            <div key={col.id} className="card" style={{ padding: 12, borderTop: `3px solid ${col.color}`, textAlign: 'center' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: col.color }}>{count}</div>
              <div style={{ fontSize: 11, color: C.light, textTransform: 'uppercase', letterSpacing: 1 }}>{col.label}</div>
              {cost > 0 && <div style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{fmtUSD(cost)}</div>}
            </div>
          );
        })}
      </div>

      {/* Priority filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['all', 'high', 'medium', 'low'].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)} style={{
            padding: '6px 14px', border: `1px solid ${filterPriority === p ? C.gold : C.borderL}`,
            background: filterPriority === p ? C.goldPale : 'transparent', borderRadius: 20,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
            letterSpacing: 1, textTransform: 'uppercase', color: filterPriority === p ? C.gold : C.light, cursor: 'pointer',
          }}>{p}</button>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'start' }}>
        {columns.map(col => {
          const cards = filtered.filter(w => w.status === col.id);
          return (
            <div key={col.id} style={{ background: C.bg, borderRadius: 8, padding: 12, border: `1px solid ${C.borderL}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: col.color }}>{col.label}</div>
                <div style={{ fontSize: 11, color: C.light, background: C.white, borderRadius: 10, padding: '2px 8px', border: `1px solid ${C.borderL}` }}>{cards.length}</div>
              </div>
              {cards.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.lighter }}>No items</div>
              )}
              {cards.map(w => (
                <div key={w.id} className="card" style={{ marginBottom: 10, padding: 12, background: C.white }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, flex: 1, lineHeight: 1.3 }}>{w.title}</div>
                    <span style={{ marginLeft: 6, padding: '2px 6px', background: priorityBg[w.priority], color: priorityColors[w.priority], borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>{w.priority}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.light, marginBottom: 4 }}>
                    📍 {w.property}{w.unit ? ` · Unit ${w.unit}` : ''}
                  </div>
                  {w.tenantName && <div style={{ fontSize: 11, color: C.mid, marginBottom: 4 }}>👤 {w.tenantName}</div>}
                  {w.vendor && <div style={{ fontSize: 11, color: C.blue, marginBottom: 4 }}>🔧 {w.vendor}</div>}
                  {w.cost && <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.text, marginBottom: 4 }}>{fmtUSD(w.cost)} est.</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: C.lighter }}>{w.reportedDate}</div>
                    {col.id !== 'completed' && (
                      <button onClick={() => advance(w.id)} style={{ padding: '4px 8px', background: col.color, color: C.white, border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {col.id === 'open' ? 'Assign →' : col.id === 'in_progress' ? 'Schedule →' : 'Complete →'}
                      </button>
                    )}
                    {col.id === 'completed' && <span style={{ fontSize: 10, color: C.green }}>✓ Done</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Add Work Order Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,26,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, width: '100%', maxWidth: 480, boxShadow: '0 30px 80px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${C.dark} 0%, ${C.darker} 100%)`, borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, color: C.goldL, textTransform: 'uppercase' }}>New Work Order</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: `1px solid ${C.goldL}`, color: C.goldL, width: 28, height: 28, borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Issue Title *', key: 'title', placeholder: 'e.g. Water heater leaking' },
                { label: 'Property', key: 'property', placeholder: '123 Main St' },
                { label: 'Unit', key: 'unit', placeholder: '2B' },
              ].map(f => (
                <div key={f.key}>
                  <div style={labelStyle(C)}>{f.label}</div>
                  <input value={newWO[f.key]} onChange={e => setNewWO(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, background: C.bg, color: C.text, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={labelStyle(C)}>Priority</div>
                  <select value={newWO.priority} onChange={e => setNewWO(p => ({ ...p, priority: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, background: C.bg, color: C.text }}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <div style={labelStyle(C)}>Category</div>
                  <select value={newWO.category} onChange={e => setNewWO(p => ({ ...p, category: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, background: C.bg, color: C.text }}>
                    {['plumbing','hvac','electrical','roofing','painting','general','landscaping'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={addWO} style={{ padding: '12px', background: C.gold, border: 'none', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.dark, cursor: 'pointer' }}>
                Create Work Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TENANT PAYMENT LEDGER ────────────────────────────────────────────────────
export function TenantLedgerPanel({ C, tenants = [] }) {
  const [payments, setPayments] = useState(SAMPLE_PAYMENTS);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ tenantName: '', amount: '', method: 'ACH', property: '', unit: '' });

  const today = new Date();

  const addPayment = () => {
    if (!newPayment.tenantName || !newPayment.amount) return;
    setPayments(prev => [{ ...newPayment, id: `p${Date.now()}`, date: today.toISOString().split('T')[0], status: 'paid', amount: Number(newPayment.amount) }, ...prev]);
    setNewPayment({ tenantName: '', amount: '', method: 'ACH', property: '', unit: '' });
    setShowAddPayment(false);
  };

  const totalCollected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={labelStyle(C)}>Rent Payment Ledger · April 2026</div>
        <button onClick={() => setShowAddPayment(!showAddPayment)} style={{ padding: '6px 12px', background: C.gold, border: 'none', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.dark, cursor: 'pointer' }}>
          + Record Payment
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12, borderLeft: `3px solid ${C.greenB}` }}>
          <div style={labelStyle(C)}>Collected</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.green }}>{fmtUSD(totalCollected)}</div>
        </div>
        <div className="card" style={{ padding: 12, borderLeft: `3px solid ${C.redB}` }}>
          <div style={labelStyle(C)}>Overdue</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.red }}>{fmtUSD(totalOverdue)}</div>
        </div>
      </div>

      {showAddPayment && (
        <div className="card" style={{ padding: 14, marginBottom: 12, border: `1px solid ${C.goldL}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[
              { label: 'Tenant Name', key: 'tenantName', placeholder: 'Sarah Chen' },
              { label: 'Amount ($)', key: 'amount', placeholder: '1850' },
              { label: 'Property', key: 'property', placeholder: '123 Main St' },
              { label: 'Unit', key: 'unit', placeholder: '2B' },
            ].map(f => (
              <div key={f.key}>
                <div style={labelStyle(C)}>{f.label}</div>
                <input value={newPayment[f.key]} onChange={e => setNewPayment(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: C.bg, color: C.text, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={labelStyle(C)}>Method</div>
            <select value={newPayment.method} onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: C.bg, color: C.text }}>
              {['ACH', 'Check', 'Zelle', 'Venmo', 'Cash', 'Other'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={addPayment} style={{ width: '100%', padding: '10px', background: C.green, border: 'none', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.white, cursor: 'pointer' }}>
            Save Payment
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 80px', gap: 8, padding: '10px 14px', background: C.goldPale, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.gold, fontWeight: 600 }}>
          <span>Tenant / Property</span><span style={{ textAlign: 'right' }}>Amount</span><span>Method</span><span>Date</span><span>Status</span>
        </div>
        {payments.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 80px', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.borderL}`, alignItems: 'center', background: p.status === 'overdue' ? C.redPale : C.white }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{p.tenantName}</div>
              <div style={{ fontSize: 10, color: C.light }}>{p.property} · Unit {p.unit}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: p.status === 'overdue' ? C.red : C.text }}>{fmtUSD(p.amount)}</div>
            <div style={{ fontSize: 11, color: C.mid }}>{p.method || '—'}</div>
            <div style={{ fontSize: 11, color: C.light, fontFamily: "'IBM Plex Mono', monospace" }}>{p.date ? p.date.slice(5) : '—'}</div>
            <div>
              <span style={{
                padding: '3px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                background: p.status === 'paid' ? C.greenPale : C.redPale,
                color: p.status === 'paid' ? C.green : C.red,
              }}>{p.status === 'paid' ? '✓ Paid' : `${p.daysLate}d Late`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VENDOR 1099 HUB ──────────────────────────────────────────────────────────
export function Vendor1099Hub({ C, vendors = [] }) {
  const sampleVendorData = [
    { id: 'v1', company: 'ABC Plumbing', contact: 'Jake Moreno', category: 'plumber', ytdPaid: 8400, w9OnFile: true, insuranceExpiry: '2026-06-30', jobCount: 12, avgResponse: '4hr' },
    { id: 'v2', company: 'Cool Air HVAC', contact: 'Tony Berg', category: 'hvac', ytdPaid: 3200, w9OnFile: true, insuranceExpiry: '2026-12-01', jobCount: 5, avgResponse: '6hr' },
    { id: 'v3', company: 'TopShield Roofing', contact: 'Dave Kim', category: 'roofer', ytdPaid: 2800, w9OnFile: false, insuranceExpiry: null, jobCount: 1, avgResponse: '1 day' },
    { id: 'v4', company: 'ProPaint LLC', contact: 'Rosa Alvarez', category: 'painter', ytdPaid: 650, w9OnFile: true, insuranceExpiry: '2027-01-15', jobCount: 2, avgResponse: '2 days' },
    { id: 'v5', company: 'FastFix Handyman', contact: 'Bill Carter', category: 'general', ytdPaid: 480, w9OnFile: false, insuranceExpiry: null, jobCount: 4, avgResponse: 'same day' },
  ];

  const needs1099 = sampleVendorData.filter(v => v.ytdPaid >= 600 && !v.w9OnFile);
  const expiringInsurance = sampleVendorData.filter(v => { const d = daysUntil(v.insuranceExpiry); return d !== null && d <= 60; });

  return (
    <div style={{ marginTop: 16 }}>
      <div style={labelStyle(C)}>Vendor Hub · 1099 & Compliance</div>

      {/* Alerts */}
      {(needs1099.length > 0 || expiringInsurance.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {needs1099.map(v => (
            <div key={v.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${C.redB}`, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: C.dark }}>⚠️ <strong>{v.company}</strong> — {fmtUSD(v.ytdPaid)} YTD, no W-9 on file. 1099-NEC required.</div>
            </div>
          ))}
          {expiringInsurance.map(v => (
            <div key={v.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${C.orangeB}`, marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: C.dark }}>🔔 <strong>{v.company}</strong> — insurance expires in {daysUntil(v.insuranceExpiry)} days ({fmtDate(v.insuranceExpiry)})</div>
            </div>
          ))}
        </div>
      )}

      {/* Vendor table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 60px 60px', gap: 8, padding: '10px 14px', background: C.goldPale, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.gold, fontWeight: 600 }}>
          <span>Vendor</span><span style={{ textAlign: 'right' }}>YTD Paid</span><span>Insurance</span><span>W-9</span><span>Jobs</span><span>Resp.</span>
        </div>
        {sampleVendorData.map(v => {
          const insExpiry = daysUntil(v.insuranceExpiry);
          const insColor = !v.insuranceExpiry ? C.lighter : insExpiry <= 30 ? C.red : insExpiry <= 60 ? C.orange : C.green;
          return (
            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 60px 60px', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.borderL}`, alignItems: 'center', background: (!v.w9OnFile && v.ytdPaid >= 600) ? C.redPale : C.white }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{v.company}</div>
                <div style={{ fontSize: 10, color: C.light }}>{v.contact} · {v.category}</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: v.ytdPaid >= 600 ? C.text : C.mid }}>
                {fmtUSD(v.ytdPaid)}
                {v.ytdPaid >= 600 && <div style={{ fontSize: 9, color: C.orange }}>1099 req</div>}
              </div>
              <div>
                {v.insuranceExpiry ? (
                  <span style={{ fontSize: 11, color: insColor, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {insExpiry <= 60 ? `${insExpiry}d` : '✓ Valid'}
                  </span>
                ) : <span style={{ fontSize: 11, color: C.lighter }}>—</span>}
              </div>
              <div>
                <span style={{ padding: '3px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: v.w9OnFile ? C.greenPale : C.redPale, color: v.w9OnFile ? C.green : C.red, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {v.w9OnFile ? '✓ Filed' : '✗ Missing'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.mid, textAlign: 'center' }}>{v.jobCount}</div>
              <div style={{ fontSize: 11, color: C.light }}>{v.avgResponse}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
