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
        <div className="card" style={{ ...cardStyle, borderTop: `3px solid ${C.goldL}` }}>
          <div style={labelStyle(C)}>Rent Collection · April</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.dark }}>{fmtUSD(paidThisMonth)}</div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>of {fmtUSD(totalRentOwedFallback)} owed · <span style={{ color: C.gold, fontWeight: 600 }}>{collectionRate}% collected</span></div>
          {overduePayments.length > 0 && (
            <div style={{ marginTop: 8, padding: '4px 8px', background: C.borderL, borderRadius: 4, fontSize: 11, color: C.mid, fontWeight: 600 }}>
              ⚠ {overduePayments.length} overdue · {fmtUSD(overduePayments.reduce((s, p) => s + p.amount, 0))}
            </div>
          )}
        </div>

        {/* Cash Flow */}
        <div className="card" style={{ ...cardStyle, borderTop: `3px solid ${C.goldL}` }}>
          <div style={labelStyle(C)}>Monthly Cash Flow</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.gold }}>
            {fmtUSD(totalCashFlow || 3840)}
          </div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>
            {properties.length || 3} properties · {fmtUSD((totalCashFlow || 3840) * 12)}/yr projected
          </div>
        </div>

        {/* Lease Expirations */}
        <div className="card" style={{ ...cardStyle, borderTop: `3px solid ${C.border}` }}>
          <div style={labelStyle(C)}>Lease Expirations (90d)</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.dark }}>
            {expiringLeases.length || 2}
          </div>
          {expiringLeases.length === 0 ? (
            <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>2 leases expiring · action needed</div>
          ) : (
            expiringLeases.slice(0, 2).map(t => (
              <div key={t.id} style={{ fontSize: 11, color: C.light, marginTop: 4 }}>
                {t.firstName} {t.lastName} — {daysUntil(t.leaseEnd)}d
              </div>
            ))
          )}
        </div>

        {/* Maintenance */}
        <div className="card" style={{ ...cardStyle, borderTop: `3px solid ${C.border}` }}>
          <div style={labelStyle(C)}>Maintenance</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.dark }}>{openWOs + inProgressWOs}</div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>
            <span>{openWOs} open</span> · <span>{inProgressWOs} in progress</span>
          </div>
        </div>
      </div>

      {/* Overdue rent alerts */}
      {overduePayments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {overduePayments.map(p => (
            <div key={p.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${C.goldL}`, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
export function MaintenanceView({ C, fs, properties = [], vendors = [], onEmailRobot }) {
  const [workOrders, setWorkOrders] = useState(SAMPLE_WORK_ORDERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [newWO, setNewWO] = useState({ title: '', property: '', unit: '', priority: 'medium', category: 'general', notes: '' });

  const columns = [
    { id: 'open',        label: 'Open',        color: C.lighter },
    { id: 'in_progress', label: 'In Progress',  color: C.goldL   },
    { id: 'scheduled',   label: 'Scheduled',    color: C.gold    },
    { id: 'completed',   label: 'Completed',    color: C.mid     },
  ];

  const priorityColors = { high: C.mid, medium: C.light, low: C.lighter };
  const priorityBg = { high: C.borderL, medium: C.bg, low: C.bg };

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                    <div style={{ fontSize: 10, color: C.lighter }}>{w.reportedDate}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {onEmailRobot && (
                        <button onClick={() => onEmailRobot({ type: 'work_order', ...w })} style={{ padding: '4px 7px', background: C.bluePale, color: C.blue, border: `1px solid ${C.blueB}`, borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>✉</button>
                      )}
                      {col.id !== 'completed' && (
                        <button onClick={() => advance(w.id)} style={{ padding: '4px 8px', background: col.color, color: C.white, border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {col.id === 'open' ? 'Assign →' : col.id === 'in_progress' ? 'Schedule →' : 'Complete →'}
                        </button>
                      )}
                    </div>
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
export function TenantLedgerPanel({ C, tenants = [], onEmailRobot }) {
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
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                padding: '3px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                background: p.status === 'paid' ? C.greenPale : C.redPale,
                color: p.status === 'paid' ? C.green : C.red,
              }}>{p.status === 'paid' ? '✓ Paid' : `${p.daysLate}d Late`}</span>
              {p.status === 'overdue' && onEmailRobot && (
                <button onClick={() => onEmailRobot({ type: 'overdue_rent', tenantName: p.tenantName, property: p.property, unit: p.unit, amount: p.amount, daysLate: p.daysLate })}
                  style={{ padding: '3px 6px', background: C.redPale, border: `1px solid ${C.redB}`, borderRadius: 4, fontSize: 9, cursor: 'pointer', color: C.red }}>✉</button>
              )}
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

// ─── EMAIL ROBOT ──────────────────────────────────────────────────────────────
// Auto-drafts tenant + technician emails using Claude.
// Triggered from: work order creation, overdue rent, lease expiry.
const TECH_CATEGORIES = ['plumbing','hvac','electrical','roofing','painting','general','appliance','landscaping'];

export function EmailRobot({ C, isOpen, onClose, trigger = {}, properties = [], vendors = [],
  robotEnabled = true, onToggleRobot, emailContacts = {}, onSaveContacts }) {

  const [drafts, setDrafts]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [sending, setSending]       = useState(false);
  const [sentResults, setSentResults] = useState(null);
  const [copied, setCopied]         = useState(null);
  const [tab, setTab]               = useState('draft'); // 'draft' | 'contacts'

  // Local editable contacts (save on blur)
  const [contacts, setContacts] = useState({ pmEmail: '', autoSend: false, technicians: {}, ...emailContacts });
  const saveContacts = (updated) => { setContacts(updated); onSaveContacts && onSaveContacts(updated); };

  const updateDraft = (key, val) => setDrafts(prev => ({ ...prev, [key]: val }));

  // Resolve recipient emails from contacts
  const tenantEmail = trigger.tenantEmail || '';
  const techEmail   = contacts.technicians?.[trigger.category] || '';
  const pmEmail     = contacts.pmEmail || '';

  const parseEmail = (text) => {
    const lines = text.split('\n');
    const subjectLine = lines.find(l => l.startsWith('Subject: '));
    return {
      subject: subjectLine ? subjectLine.replace('Subject: ', '').trim() : 'Property Management',
      body: lines.filter(l => !l.startsWith('Subject: ')).join('\n').trim(),
    };
  };

  const generate = async () => {
    setLoading(true); setDrafts(null); setSentResults(null);
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const system = `You are RepTrack's email assistant for a real estate property manager.
Draft professional, warm-but-firm emails. Always include a subject line as the first line prefixed with "Subject: ".
Return exactly two emails separated by "---EMAIL2---":
1. Email to the TENANT (if applicable)
2. Email to the TECHNICIAN/VENDOR or PROPERTY MANAGER
Keep emails concise (3-5 sentences each). Use ${today} as today's date.`;

    let prompt = '';
    if (trigger.type === 'work_order') {
      prompt = `Maintenance work order:
Title: ${trigger.title}
Property: ${trigger.property}${trigger.unit ? ` Unit ${trigger.unit}` : ''}
Tenant: ${trigger.tenantName || 'N/A'}
Vendor: ${trigger.vendor || 'Not yet assigned'}
Priority: ${trigger.priority} | Category: ${trigger.category}
Draft: 1) Tenant acknowledgment with ETA  2) Technician/vendor work order details`;
    } else if (trigger.type === 'overdue_rent') {
      prompt = `Overdue rent: ${trigger.tenantName} at ${trigger.property} Unit ${trigger.unit}
Amount: $${trigger.amount} — ${trigger.daysLate} days overdue
Draft: 1) Firm late-rent notice to tenant  2) PM delinquency alert`;
    } else if (trigger.type === 'lease_expiry') {
      prompt = `Lease expiring: ${trigger.tenantName} at ${trigger.property}
End: ${trigger.leaseEnd} (${trigger.daysLeft} days)
Draft: 1) Renewal notice to tenant  2) PM follow-up reminder`;
    } else {
      prompt = `Draft a general property management update email to a tenant and a PM follow-up.`;
    }

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await resp.json();
      const text = data?.content?.[0]?.text || '';
      const parts = text.split('---EMAIL2---');
      setDrafts({ email1: parts[0]?.trim() || '', email2: parts[1]?.trim() || '' });
    } catch {
      setDrafts({
        email1: `Subject: Maintenance Request Received — ${trigger.title || 'Update'}\n\nDear ${trigger.tenantName || 'Resident'},\n\nWe have received your maintenance request and will be in touch within 24 hours to schedule the repair. Thank you for your patience.\n\nBest regards,\nProperty Management`,
        email2: `Subject: New Work Order — ${trigger.title || 'Maintenance'}\n\nHello,\n\nA new work order has been submitted for ${trigger.property || 'the property'}${trigger.unit ? ` Unit ${trigger.unit}` : ''}. Please review and confirm your availability.\n\nThank you,\nProperty Management`,
      });
    }
    setLoading(false);
    // Auto-send immediately if enabled and contacts are set
    if (contacts.autoSend) setTimeout(() => sendAll(), 300);
  };

  const sendAll = async () => {
    if (!drafts) return;
    setSending(true);
    const emails = [];
    const e1 = parseEmail(drafts.email1);
    const e2 = parseEmail(drafts.email2);

    if (tenantEmail) emails.push({ to: tenantEmail, subject: e1.subject, text: e1.body, label: 'Tenant' });
    if (techEmail)   emails.push({ to: techEmail,   subject: e2.subject, text: e2.body, label: 'Technician' });
    if (pmEmail)     emails.push({ to: pmEmail,     subject: e2.subject, text: `[PM Alert] ${e2.body}`, label: 'Property Manager' });

    if (emails.length === 0) {
      // No emails configured — fall back to mailto
      openMailto(drafts.email1, tenantEmail);
      openMailto(drafts.email2, techEmail || pmEmail);
      setSending(false); return;
    }

    try {
      const resp = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await resp.json();
      if (!data.resend_configured) {
        // Resend not set up — fall back to mailto for each
        emails.forEach(e => openMailto(`Subject: ${e.subject}\n\n${e.text}`, e.to));
        setSentResults(emails.map(e => ({ label: e.label, status: 'mailto' })));
      } else {
        setSentResults(data.results || []);
      }
    } catch {
      emails.forEach(e => openMailto(`Subject: ${e.subject}\n\n${e.text}`, e.to));
      setSentResults(emails.map(e => ({ label: e.label, status: 'mailto' })));
    }
    setSending(false);
  };

  const openMailto = (text, to = '') => {
    const e = parseEmail(text);
    window.open(`mailto:${to}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`);
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); });
  };

  const hasContacts = tenantEmail || techEmail || pmEmail;

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,26,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', background: `linear-gradient(135deg, ${C.dark} 0%, ${C.darker} 100%)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderRadius: '16px 16px 0 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: 1.5, color: C.goldL, textTransform: 'uppercase', fontWeight: 700 }}>✉ Email Robot</span>
              {onToggleRobot && (
                <button onClick={onToggleRobot} style={{ display: 'flex', alignItems: 'center', gap: 5, background: robotEnabled ? 'rgba(0,201,167,0.18)' : 'rgba(255,255,255,0.08)', border: `1px solid ${robotEnabled ? C.goldL : 'rgba(255,255,255,0.2)'}`, borderRadius: 20, padding: '3px 10px 3px 7px', cursor: 'pointer' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: robotEnabled ? C.goldL : '#64748B' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: robotEnabled ? C.goldL : '#94A3B8', fontFamily: "'Inter', sans-serif" }}>{robotEnabled ? 'ON' : 'OFF'}</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>
              {trigger.type === 'work_order'   && `Work Order: ${trigger.title}`}
              {trigger.type === 'overdue_rent' && `Overdue Rent · ${trigger.tenantName}`}
              {trigger.type === 'lease_expiry' && `Lease Expiring · ${trigger.tenantName}`}
              {!trigger.type && 'Draft Email'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.white, width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
          {[{ id: 'draft', label: 'Draft & Send' }, { id: 'contacts', label: '⚙ Contacts & Auto-Send' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: tab === t.id ? `2px solid ${C.goldL}` : '2px solid transparent', color: tab === t.id ? C.gold : C.mid, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 22, flex: 1, overflow: 'auto' }}>

          {/* ── CONTACTS TAB ── */}
          {tab === 'contacts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 14 }}>Property Manager</div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: C.mid }}>PM Email</span>
                  <input type="email" value={contacts.pmEmail || ''} onChange={e => setContacts(p => ({ ...p, pmEmail: e.target.value }))} onBlur={() => saveContacts(contacts)} placeholder="manager@yourcompany.com" style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: 'none', width: '100%' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <button onClick={() => { const u = { ...contacts, autoSend: !contacts.autoSend }; saveContacts(u); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: contacts.autoSend ? C.goldPale : C.bg, border: `1px solid ${contacts.autoSend ? C.goldL : C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: contacts.autoSend ? C.gold : C.mid }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: contacts.autoSend ? C.goldL : C.lighter }} />
                    Auto-Send {contacts.autoSend ? 'ON' : 'OFF'}
                  </button>
                  <span style={{ fontSize: 11, color: C.lighter }}>When ON, emails send automatically after generating</span>
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 14 }}>Technician Emails by Category</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TECH_CATEGORIES.map(cat => (
                    <div key={cat} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.mid, textTransform: 'capitalize' }}>{cat}</span>
                      <input type="email" value={contacts.technicians?.[cat] || ''} onChange={e => setContacts(p => ({ ...p, technicians: { ...p.technicians, [cat]: e.target.value } }))} onBlur={() => saveContacts(contacts)} placeholder={`${cat}@contractor.com`} style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, outline: 'none', width: '100%' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DRAFT TAB ── */}
          {tab === 'draft' && (
            <>
              {!drafts && !loading && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✉</div>
                  {!robotEnabled ? (
                    <div>
                      <p style={{ fontSize: 14, color: C.mid, marginBottom: 16, lineHeight: 1.6 }}>Email Robot is <strong>OFF</strong>. Turn it on to generate emails.</p>
                      {onToggleRobot && <button onClick={onToggleRobot} className="btn-gold">Turn Robot On</button>}
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 14, color: C.mid, marginBottom: 8, lineHeight: 1.6 }}>
                        Claude drafts 3 emails automatically:
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                        {[
                          { icon: '◎', label: 'Tenant', addr: tenantEmail },
                          { icon: '⚙', label: 'Technician', addr: techEmail || `(set in Contacts)` },
                          { icon: '◉', label: 'Property Mgr', addr: pmEmail || `(set in Contacts)` },
                        ].map(r => (
                          <div key={r.label} style={{ padding: '8px 14px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}>
                            <span style={{ color: C.gold }}>{r.icon}</span>
                            <span style={{ color: C.dark, fontWeight: 600, marginLeft: 6 }}>{r.label}</span>
                            <div style={{ fontSize: 11, color: C.lighter, marginTop: 2 }}>{r.addr || 'not set'}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={generate} className="btn-gold">Generate Emails with AI</button>
                      {!hasContacts && <div style={{ marginTop: 12, fontSize: 12, color: C.lighter }}>Add emails in the Contacts tab to enable auto-send.</div>}
                    </div>
                  )}
                </div>
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ width: 44, height: 44, border: `4px solid ${C.borderL}`, borderTopColor: C.goldL, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <div style={{ fontSize: 14, color: C.mid }}>Drafting emails with Claude…</div>
                </div>
              )}

              {drafts && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Sent results banner */}
                  {sentResults && (
                    <div style={{ padding: '12px 16px', background: C.goldPale, borderRadius: 10, border: `1px solid ${C.goldL}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {sentResults.map((r, i) => (
                        <span key={i} style={{ fontSize: 12, fontWeight: 600, color: r.status === 'sent' ? C.gold : C.mid }}>
                          {r.status === 'sent' ? '✓' : r.status === 'mailto' ? '↗' : '!'} {r.label} {r.status === 'sent' ? 'sent' : r.status === 'mailto' ? 'opened' : `failed`}
                        </span>
                      ))}
                    </div>
                  )}

                  {[
                    { key: 'email1', label: '◎ Email to Tenant',               to: tenantEmail },
                    { key: 'email2', label: '⚙ Email to Technician & PM',      to: techEmail || pmEmail },
                  ].map(({ key, label, to }) => (
                    <div key={key} className="card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{label}</span>
                          {to && <span style={{ fontSize: 11, color: C.lighter, marginLeft: 8 }}>→ {to}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => copy(drafts[key], key)} style={{ padding: '5px 11px', background: copied === key ? C.goldPale : C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', color: copied === key ? C.gold : C.mid }}>
                            {copied === key ? '✓ Copied' : 'Copy'}
                          </button>
                          <button onClick={() => openMailto(drafts[key], to)} style={{ padding: '5px 11px', background: C.goldPale, border: `1px solid ${C.goldL}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', color: C.gold }}>
                            Open Mail
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.lighter, marginBottom: 5 }}>Edit before sending:</div>
                      <textarea value={drafts[key]} onChange={e => updateDraft(key, e.target.value)} rows={8} style={{ width: '100%', padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: C.bg, color: C.text, resize: 'vertical', lineHeight: 1.7, outline: 'none' }} />
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={sendAll} disabled={sending} className="btn-gold" style={{ flex: 1, opacity: sending ? 0.7 : 1 }}>
                      {sending ? 'Sending…' : hasContacts ? `Send All (${[tenantEmail, techEmail, pmEmail].filter(Boolean).length} recipients)` : 'Send via Mail App'}
                    </button>
                    <button onClick={generate} style={{ padding: '11px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.mid, cursor: 'pointer' }}>
                      ↺ Re-draft
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
