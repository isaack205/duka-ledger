import React from 'react';

export default function PeriodicReportPrint({ startDate, endDate, checkouts = [], summary, hideFinancials }) {
  const colors = {
    ink: '#102033',
    muted: '#64748b',
    line: '#dbe3ee',
    panel: '#f8fafc',
    green: '#047857',
    greenSoft: '#ecfdf5',
    red: '#be123c',
    redSoft: '#fff1f2',
    amber: '#b45309',
    amberSoft: '#fffbeb',
    blue: '#1d4ed8',
    blueSoft: '#eff6ff'
  };

  const page = {
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    color: colors.ink,
    background: '#ffffff',
    padding: '30px 28px'
  };

  const section = {
    borderTop: `1px solid ${colors.line}`,
    padding: '18px 0'
  };

  const SectionTitle = ({ eyebrow, title }) => (
    <div style={{ marginBottom: '10px' }}>
      <p style={{
        margin: '0 0 3px',
        fontSize: '9px',
        fontWeight: 800,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.12em'
      }}>
        {eyebrow}
      </p>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: colors.ink }}>
        {title}
      </h3>
    </div>
  );

  const MetricCard = ({ label, value, tone = 'neutral', suffix = 'KES' }) => {
    const toneMap = {
      positive: [colors.greenSoft, colors.green],
      negative: [colors.redSoft, colors.red],
      amber: [colors.amberSoft, colors.amber],
      blue: [colors.blueSoft, colors.blue],
      neutral: [colors.panel, colors.ink]
    };
    const [bg, fg] = toneMap[tone] || toneMap.neutral;

    return (
      <div style={{
        background: bg,
        border: `1px solid ${colors.line}`,
        borderRadius: '12px',
        padding: '12px 14px'
      }}>
        <p style={{
          margin: '0 0 6px',
          fontSize: '9px',
          fontWeight: 800,
          color: colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: '18px', lineHeight: 1, fontWeight: 900, color: fg }}>
          {value}
          {suffix && <span style={{ fontSize: '9px', fontWeight: 800, color: colors.muted, marginLeft: '5px' }}>{suffix}</span>}
        </p>
      </div>
    );
  };

  const SummaryTable = ({ rows }) => (
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label}>
            <td style={{
              padding: '9px 12px',
              background: index % 2 === 0 ? '#ffffff' : colors.panel,
              borderTop: `1px solid ${colors.line}`,
              borderLeft: `1px solid ${colors.line}`,
              borderBottom: index === rows.length - 1 ? `1px solid ${colors.line}` : 'none',
              borderTopLeftRadius: index === 0 ? '10px' : 0,
              borderBottomLeftRadius: index === rows.length - 1 ? '10px' : 0,
              color: colors.muted,
              fontWeight: 700
            }}>
              {row.label}
            </td>
            <td style={{
              padding: '9px 12px',
              background: index % 2 === 0 ? '#ffffff' : colors.panel,
              borderTop: `1px solid ${colors.line}`,
              borderRight: `1px solid ${colors.line}`,
              borderBottom: index === rows.length - 1 ? `1px solid ${colors.line}` : 'none',
              borderTopRightRadius: index === 0 ? '10px' : 0,
              borderBottomRightRadius: index === rows.length - 1 ? '10px' : 0,
              textAlign: 'right',
              color: row.tone === 'negative' ? colors.red : row.tone === 'positive' ? colors.green : colors.ink,
              fontWeight: row.strong ? 900 : 800
            }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const now = new Date();
  const generatedTime = now.toLocaleString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const fmt = (n) => {
    const val = n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return hideFinancials ? '•••' : val;
  };

  const isNetPositive = summary.netCashFlow >= 0;

  return (
    <div id="checkout-print-root" style={page}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: colors.ink, letterSpacing: '-0.02em' }}>
            Neema Gen Shop
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '10px', color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Periodic Business Report
          </p>
          <p style={{ margin: '12px 0 0', fontSize: '11px', color: colors.muted, fontWeight: 700 }}>
            Period Range: <strong style={{ color: colors.ink }}>{startDate} to {endDate}</strong>
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 4px', fontSize: '9px', fontWeight: 800, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Generated At
          </p>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: colors.ink }}>
            {generatedTime}
          </p>
        </div>
      </div>

      {/* ── METRIC TILES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '15px 0' }}>
        <MetricCard label="Total Revenue" value={fmt(summary.totalRevenue)} tone="positive" />
        <MetricCard label="Total Outflows" value={fmt(summary.totalOutflows)} tone="amber" />
        <MetricCard label="Net Cash Flow" value={fmt(summary.netCashFlow)} tone={isNetPositive ? 'positive' : 'negative'} />
        <MetricCard label="Business Vol" value={fmt(summary.totalBusinessVolume)} tone="neutral" />
      </div>

      {/* ── SUMMARIES BREAKDOWN ── */}
      <div style={section}>
        <SectionTitle eyebrow="Financial Breakdown" title="Cash Flow & Debt Summaries" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <SummaryTable rows={[
            { label: 'Aggregate Cash Collected', value: fmt(summary.totalCashOnHand) },
            { label: 'Aggregate M-Pesa Collected', value: fmt(summary.totalMpesaOnHand) },
            { label: 'Supplier Cash Payments', value: fmt(summary.totalOutflows - summary.totalOutflows) }, // Note: We only have total cash/mpesa split on daily checkouts, so let's list those
            { label: 'Total Supplier Cash Paid', value: fmt(checkouts.reduce((sum, c) => sum + parseFloat(c.supplier_cash_paid || 0), 0)) },
            { label: 'Total Supplier M-Pesa Paid', value: fmt(checkouts.reduce((sum, c) => sum + parseFloat(c.supplier_mpesa_paid || 0), 0)) },
            { label: 'Total Outflows (Supplier Paid)', value: fmt(summary.totalOutflows), strong: true }
          ]} />
          <SummaryTable rows={[
            { label: 'New Customer Credit Issued', value: fmt(summary.creditIssued), tone: 'negative' },
            { label: 'Customer Debts Recovered', value: fmt(summary.debtRecovered), tone: 'positive' },
            { label: 'Credit-to-Volume Ratio', value: hideFinancials ? '•••' : `${summary.creditRatio.toFixed(1)}%`, strong: true },
            { label: 'Supplier Invoices Created', value: fmt(summary.supplierPayables) },
            { label: 'Total Revenue Earned', value: fmt(summary.totalRevenue), tone: 'positive', strong: true },
            { label: 'Total Business Volume', value: fmt(summary.totalBusinessVolume), strong: true }
          ]} />
        </div>
      </div>

      {/* ── DAILY LOGS BREAKDOWN ── */}
      <div style={section}>
        <SectionTitle eyebrow="Operational Log" title="Daily Checkout Summaries" />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '8px' }}>
          <thead>
            <tr style={{ background: colors.panel, borderBottom: `1px solid ${colors.line}` }}>
              {['Date', 'Cash Count', 'M-Pesa Bal', 'Outflows', 'New Credit', 'Net Position', 'Revenue', 'Business Vol'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checkouts.filter(c => c.checkout_date >= startDate && c.checkout_date <= endDate).map((c, i) => {
              const tillCount = (parseFloat(c.total_cash_collected) || 0) + (parseFloat(c.total_mpesa_collected) || 0);
              const outflows = (parseFloat(c.supplier_cash_paid) || 0) + (parseFloat(c.supplier_mpesa_paid) || 0);
              const revenue = parseFloat(c.total_cash_realized) || (tillCount + outflows);
              const businessVol = parseFloat(c.total_business_volume) || (revenue + parseFloat(c.customer_credit_issued || 0));
              const net = parseFloat(c.net_cash_position) || tillCount;

              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${colors.line}`, background: i % 2 === 0 ? '#ffffff' : '#fafcfd' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 800 }}>{c.checkout_date}</td>
                  <td style={{ padding: '8px 10px' }}>{fmt(parseFloat(c.total_cash_collected || 0))}</td>
                  <td style={{ padding: '8px 10px' }}>{fmt(parseFloat(c.total_mpesa_collected || 0))}</td>
                  <td style={{ padding: '8px 10px', color: colors.amber, fontWeight: 700 }}>{fmt(outflows)}</td>
                  <td style={{ padding: '8px 10px', color: colors.red, fontWeight: 700 }}>{fmt(parseFloat(c.customer_credit_issued || 0))}</td>
                  <td style={{ padding: '8px 10px', color: net >= 0 ? colors.green : colors.red, fontWeight: 800 }}>{fmt(net)}</td>
                  <td style={{ padding: '8px 10px', color: colors.green, fontWeight: 800 }}>{fmt(revenue)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 900, color: colors.blue }}>{fmt(businessVol)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER SIGNATURE ── */}
      <div style={{ marginTop: '40px', borderTop: `1px solid ${colors.line}`, paddingTop: '15px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: colors.muted, fontWeight: 700 }}>
        <span>v1.2.0 • Periodic Financial Statement</span>
        <span>Signature: _______________________</span>
      </div>
    </div>
  );
}
