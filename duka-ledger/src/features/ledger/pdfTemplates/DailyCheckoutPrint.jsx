/**
 * DailyCheckoutPrint.jsx
 *
 * Standalone print-only daily register reconciliation report.
 * Styled as a formal bordered receipt — Courier monospace with CSS box borders
 * that evoke the ╔═╦═╗ / ╠═╬═╣ / ╚═╩═╝ receipt aesthetic.
 * Only visible during window.print(). Hidden from screen via CSS.
 */

export default function DailyCheckoutPrint({ checkout, operatorName }) {
  const cash             = parseFloat(checkout.total_cash_collected)    || 0;
  const net              = parseFloat(checkout.net_cash_position)       || 0;
  const creditIssued     = parseFloat(checkout.customer_credit_issued   || 0);
  const supplierPayables = parseFloat(checkout.supplier_debt_created    || 0);
  const mpesa            = parseFloat(checkout.total_mpesa_collected    || 0);
  const totalLiabilities = creditIssued + supplierPayables;
  const subTotal         = cash + mpesa;
  const isNetPositive    = net >= 0;

  const now           = new Date();
  const generatedTime = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
  const shortOperator = (operatorName || 'Unknown').split(' ')[0];

  /* ─── number formatter ──────────────────────────────────────────── */
  const fmt = (n) =>
    n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ─── design tokens ─────────────────────────────────────────────── */
  const mono   = '"Courier New", Courier, "Lucida Console", monospace';
  const border = '2px solid #1e293b';
  const sep    = '1px solid #334155';
  const ink    = '#0f172a';
  const faded  = '#475569';
  const muted  = '#94a3b8';
  const greenDark = '#065f46';
  const redDark   = '#991b1b';
  const greenBg   = '#ecfdf5';
  const redBg     = '#fff1f2';

  /* ─── inner section padding ─────────────────────────────────────── */
  const px = { paddingLeft: '24px', paddingRight: '24px' };

  /* ─── section heading ───────────────────────────────────────────── */
  const SectionHead = ({ children }) => (
    <p style={{
      margin: '0 0 6px',
      fontSize: '10px',
      fontWeight: 800,
      color: faded,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontFamily: mono,
    }}>
      {children}
    </p>
  );

  /* ─── inner grid table ──────────────────────────────────────────── */
  const Table = ({ rows }) => (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      border: sep,
      fontFamily: mono,
      fontSize: '12px',
    }}>
      <tbody>
        {rows.map(([label, value, opts], i) => {
          opts = opts || {};
          const isHL    = !!opts.highlight;
          const isNeg   = !!opts.negative;
          const isTotal = !!opts.total;
          const bg = isHL
            ? (isNetPositive ? greenBg : redBg)
            : isTotal ? '#f8fafc' : 'white';
          const notLast = i < rows.length - 1;
          return (
            <tr key={i} style={{ background: bg }}>
              <td style={{
                padding: '8px 14px',
                borderRight: sep,
                borderBottom: notLast ? sep : 'none',
                color:      isHL ? ink : isTotal ? ink : faded,
                fontWeight: isHL || isTotal ? 800 : 600,
                width: '60%',
                fontFamily: mono,
              }}>
                {label}
              </td>
              <td style={{
                padding: '8px 14px',
                textAlign: 'right',
                borderBottom: notLast ? sep : 'none',
                fontWeight: isHL ? 900 : isTotal ? 800 : 700,
                fontSize: isHL ? '13px' : '12px',
                color: isHL
                  ? (isNetPositive ? greenDark : redDark)
                  : isNeg ? redDark : ink,
                letterSpacing: isHL ? '-0.3px' : 'normal',
                fontFamily: mono,
              }}>
                {value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div
      id="checkout-print-root"
      style={{ display: 'none', fontFamily: mono, background: 'white', padding: '32px 28px' }}
    >
      {/* ╔══════════════════════════════════════════╗ */}
      {/* OUTER DOCUMENT BOX                          */}
      {/* ╚══════════════════════════════════════════╝ */}
      <div style={{
        fontFamily: mono,
        color: ink,
        background: 'white',
        border: border,
        borderRadius: '3px',
        maxWidth: '680px',
        margin: '0 auto',
        padding: 0,
        boxSizing: 'border-box',
      }}>

        {/* ╔══ HEADER ══╗ */}
        <div style={{
          ...px,
          paddingTop: '18px',
          paddingBottom: '16px',
          textAlign: 'center',
          borderBottom: border,
        }}>
          {/* monogram badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            background: ink,
            color: 'white',
            borderRadius: '5px',
            fontSize: '18px',
            fontWeight: 900,
            marginBottom: '8px',
            fontFamily: mono,
          }}>
            N
          </div>
          <div style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '-0.3px', color: ink, margin: '0 0 2px', fontFamily: mono }}>
            Neema Gen Shop
          </div>
          <div style={{ fontSize: '10px', color: faded, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px', fontFamily: mono }}>
            Daily Cash Register Reconciliation Report
          </div>
          {/* status badge */}
          <div style={{
            display: 'inline-block',
            padding: '3px 16px',
            border: `1.5px solid ${isNetPositive ? '#6ee7b7' : '#fca5a5'}`,
            borderRadius: '2px',
            background: isNetPositive ? greenBg : redBg,
            color: isNetPositive ? greenDark : redDark,
            fontSize: '10px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: mono,
          }}>
            {isNetPositive ? '✓  Register Balanced' : '⚠  Cash Deficit Detected'}
          </div>
        </div>

        {/* ╠══ META: date / reported by ══╣ */}
        <div style={{
          ...px,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: border,
          paddingTop: '10px',
          paddingBottom: '10px',
          fontSize: '11px',
          fontWeight: 700,
          color: ink,
          fontFamily: mono,
        }}>
          <span>Closeout Date:&nbsp; <strong>{checkout.checkout_date}</strong></span>
          <span>Reported By:&nbsp; <strong>{shortOperator}</strong></span>
        </div>

        {/* ╠══ § 1 — Cash Register Summary ══╣ */}
        <div style={{ ...px, borderBottom: border, paddingTop: '12px', paddingBottom: '14px' }}>
          <SectionHead>§ 1 — Cash Register Summary</SectionHead>
          <Table rows={[
            ['Physical Cash Counted',  fmt(cash),           {}],
            ['M-Pesa / Mobile',        fmt(mpesa),          {}],
            ['Sub-Total Received',     fmt(subTotal),       { total: true }],
          ]} />
        </div>

        {/* ╠══ § 2 — Liabilities & Obligations ══╣ */}
        <div style={{ ...px, borderBottom: border, paddingTop: '12px', paddingBottom: '14px' }}>
          <SectionHead>§ 2 — Liabilities &amp; Obligations</SectionHead>
          <Table rows={[
            ['− Customer Credit',          fmt(creditIssued),     { negative: true }],
            ['− Supplier Payables',         fmt(supplierPayables), { negative: true }],
            ['  Total Liabilities',         `−  ${fmt(totalLiabilities)}`, { total: true, negative: true }],
          ]} />
        </div>

        {/* ╠══ § 3 — Net Position ══╣ */}
        <div style={{ ...px, borderBottom: border, paddingTop: '12px', paddingBottom: '14px' }}>
          <SectionHead>§ 3 — Net Position</SectionHead>
          <Table rows={[
            [
              'Net Cash Position',
              `${net >= 0 ? '+' : '−'}  ${fmt(Math.abs(net))} KES`,
              { highlight: true }
            ],
          ]} />
        </div>

        {/* ╠══ § 4 — Audit Notes ══╣ */}
        <div style={{ ...px, borderBottom: border, paddingTop: '12px', paddingBottom: '14px' }}>
          <SectionHead>§ 4 — Audit Notes</SectionHead>
          {checkout.notes ? (
            <div style={{
              border: sep,
              padding: '8px 14px',
              background: '#f8fafc',
              fontSize: '12px',
              color: faded,
              fontWeight: 600,
              lineHeight: '1.6',
              fontFamily: mono,
            }}>
              {checkout.notes}
            </div>
          ) : (
            <div style={{
              border: `1px dashed #cbd5e1`,
              padding: '8px 14px',
              fontSize: '11px',
              color: muted,
              fontStyle: 'italic',
              fontFamily: mono,
            }}>
              No audit notes recorded for this session.
            </div>
          )}
        </div>

        {/* ╠══ FOOTER: closed by + generated time ══╣ */}
        <div style={{ ...px, borderBottom: border, paddingTop: '12px', paddingBottom: '14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 700,
            color: ink,
            marginBottom: '18px',
            fontFamily: mono,
          }}>
            <span>Closed By:&nbsp; <strong>{operatorName || '—'}</strong></span>
            <span>Generated:&nbsp; <strong>{generatedTime}</strong></span>
          </div>

          {/* Signature lines */}
          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { label: 'Manager Signature',  sub: 'Verify figures & authorize' },
              { label: 'Cashier Signature',  sub: 'Confirm drawer count' },
            ].map(({ label, sub }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: '32px', borderBottom: '1.5px solid #334155', marginBottom: '5px' }} />
                <div style={{ fontSize: '10px', fontWeight: 800, color: faded, fontFamily: mono }}>{label}</div>
                <div style={{ fontSize: '9px', color: muted, fontFamily: mono }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ╚══ BOTTOM CONFIDENTIAL STRIP ══╝ */}
        <div style={{
          ...px,
          paddingTop: '8px',
          paddingBottom: '8px',
          textAlign: 'center',
          fontSize: '9px',
          color: muted,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: mono,
        }}>
          Neema Gen Shop &middot; Daily Register Reconciliation &middot; {checkout.checkout_date} &middot; CONFIDENTIAL
        </div>

      </div>
    </div>
  );
}
