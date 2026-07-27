export default function DailyCheckoutPrint({ checkout, operatorName, details }) {
  const cash = parseFloat(checkout.total_cash_collected) || 0;
  const net = parseFloat(checkout.net_cash_position) || 0;
  const creditIssued = parseFloat(checkout.customer_credit_issued || 0);
  const supplierPayables = parseFloat(checkout.supplier_debt_created || 0);
  const mpesa = parseFloat(checkout.total_mpesa_collected || 0);
  const totalLiabilities = creditIssued + supplierPayables;
  const subTotal = cash + mpesa;
  const isNetPositive = net >= 0;
  const customerDebts = details?.customerDebts || [];
  const supplierDebts = details?.supplierDebts || [];

  const now = new Date();
  const generatedTime = now.toLocaleString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const fmt = (n) =>
    n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <p style={{ margin: 0, fontSize: '20px', lineHeight: 1, fontWeight: 900, color: fg }}>
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

  const StatusChip = ({ status }) => {
    const chip = status === 'Paid'
      ? [colors.greenSoft, colors.green]
      : status === 'Partial'
        ? [colors.amberSoft, colors.amber]
        : [colors.redSoft, colors.red];

    return (
      <span style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: '999px',
        background: chip[0],
        color: chip[1],
        fontSize: '8px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {status}
      </span>
    );
  };

  const DetailTable = ({ rows, emptyText }) => (
    rows.length > 0 ? (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr>
            {['Name', 'Original', 'Upfront', 'Balance', 'Status', 'Notes'].map((head) => (
              <th key={head} style={{
                padding: '8px 7px',
                background: colors.panel,
                borderTop: `1px solid ${colors.line}`,
                borderBottom: `1px solid ${colors.line}`,
                color: colors.muted,
                fontWeight: 900,
                textAlign: head === 'Name' || head === 'Notes' || head === 'Status' ? 'left' : 'right',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.name}-${row.createdAt}-${index}`}>
              <td style={{ padding: '8px 7px', borderBottom: `1px solid ${colors.line}`, color: colors.ink, fontWeight: 900 }}>
                {row.name}
              </td>
              <td style={{ padding: '8px 7px', borderBottom: `1px solid ${colors.line}`, textAlign: 'right', fontWeight: 800 }}>
                {fmt(row.originalAmount)}
              </td>
              <td style={{ padding: '8px 7px', borderBottom: `1px solid ${colors.line}`, textAlign: 'right', color: colors.muted, fontWeight: 700 }}>
                {fmt(row.upfrontPaid)}
              </td>
              <td style={{
                padding: '8px 7px',
                borderBottom: `1px solid ${colors.line}`,
                textAlign: 'right',
                color: row.remainingBalance > 0 ? colors.red : colors.green,
                fontWeight: 900
              }}>
                {fmt(row.remainingBalance)}
              </td>
              <td style={{ padding: '8px 7px', borderBottom: `1px solid ${colors.line}` }}>
                <StatusChip status={row.status} />
              </td>
              <td style={{ padding: '8px 7px', borderBottom: `1px solid ${colors.line}`, color: colors.muted, fontWeight: 600 }}>
                {row.notes || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div style={{
        border: `1px dashed ${colors.line}`,
        borderRadius: '10px',
        padding: '12px',
        background: colors.panel,
        color: colors.muted,
        fontSize: '11px',
        fontWeight: 700
      }}>
        {emptyText}
      </div>
    )
  );

  return (
    <div id="checkout-print-root" style={{ display: 'none', ...page }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: '#ffffff' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '24px',
          alignItems: 'flex-start',
          paddingBottom: '20px',
          borderBottom: `2px solid ${colors.ink}`
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: colors.ink,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 900
              }}>
                N
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 900, color: colors.ink }}>
                  Neema Gen Shop
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 800, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Daily Register Reconciliation
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: colors.muted, fontWeight: 700 }}>
              Closeout Date: <strong style={{ color: colors.ink }}>{checkout.checkout_date}</strong>
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.muted, fontWeight: 700 }}>
              Reported By: <strong style={{ color: colors.ink }}>{operatorName || 'Unknown Operator'}</strong>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-block',
              padding: '6px 12px',
              borderRadius: '999px',
              background: isNetPositive ? colors.greenSoft : colors.redSoft,
              color: isNetPositive ? colors.green : colors.red,
              fontSize: '9px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              {isNetPositive ? 'Register Balanced' : 'Cash Deficit'}
            </span>
            <p style={{ margin: '14px 0 3px', fontSize: '9px', fontWeight: 800, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Net Position
            </p>
            <p style={{ margin: 0, fontSize: '30px', lineHeight: 1, fontWeight: 900, color: isNetPositive ? colors.green : colors.red }}>
              {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
              <span style={{ fontSize: '11px', color: colors.muted, marginLeft: '6px' }}>KES</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '18px 0' }}>
          <MetricCard label="Cash" value={fmt(cash)} tone="blue" />
          <MetricCard label="M-Pesa" value={fmt(mpesa)} tone="positive" />
          <MetricCard label="Credit" value={fmt(creditIssued)} tone="negative" />
          <MetricCard label="Suppliers" value={fmt(supplierPayables)} tone="amber" />
        </div>

        <div style={section}>
          <SectionTitle eyebrow="01 Summary" title="Cash Register Summary" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <SummaryTable rows={[
              { label: 'Physical Cash Counted', value: fmt(cash) },
              { label: 'M-Pesa / Mobile', value: fmt(mpesa) },
              { label: 'Sub-Total Received', value: fmt(subTotal), strong: true }
            ]} />
            <SummaryTable rows={[
              { label: 'Customer Credit', value: `- ${fmt(creditIssued)}`, tone: 'negative' },
              { label: 'Supplier Payables', value: `- ${fmt(supplierPayables)}`, tone: 'negative' },
              { label: 'Total Liabilities', value: `- ${fmt(totalLiabilities)}`, tone: 'negative', strong: true }
            ]} />
          </div>
        </div>

        <div style={section}>
          <SectionTitle eyebrow="02 Position" title="Net Cash Position" />
          <MetricCard
            label="Final Position"
            value={`${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}`}
            tone={isNetPositive ? 'positive' : 'negative'}
          />
        </div>

        <div style={section}>
          <SectionTitle eyebrow="03 Customers" title="Customer Debts Issued Today" />
          <DetailTable
            rows={customerDebts}
            emptyText="No customer debts were issued on this checkout date."
          />
        </div>

        <div style={section}>
          <SectionTitle eyebrow="04 Suppliers" title="Supplier Payables Issued Today" />
          <DetailTable
            rows={supplierDebts}
            emptyText="No supplier payables were issued on this checkout date."
          />
        </div>

        <div style={section}>
          <SectionTitle eyebrow="05 Notes" title="Audit Notes" />
          <div style={{
            border: `1px solid ${colors.line}`,
            borderRadius: '12px',
            background: colors.panel,
            padding: '12px 14px',
            color: checkout.notes ? colors.ink : colors.muted,
            fontSize: '11px',
            lineHeight: 1.5,
            fontWeight: 700,
            fontStyle: checkout.notes ? 'normal' : 'italic'
          }}>
            {checkout.notes || 'No audit notes recorded for this session.'}
          </div>
        </div>

        <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
          {[
            { label: 'Manager Signature', sub: 'Verify figures and authorize' },
            { label: 'Cashier Signature', sub: 'Confirm drawer count' }
          ].map(({ label, sub }) => (
            <div key={label} style={{ textAlign: 'center', paddingTop: '18px' }}>
              <div style={{ borderBottom: `1.5px solid ${colors.ink}`, height: '30px', marginBottom: '7px' }} />
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: colors.ink }}>{label}</p>
              <p style={{ margin: '2px 0 0', fontSize: '9px', fontWeight: 700, color: colors.muted }}>{sub}</p>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: `1px solid ${colors.line}`,
          paddingTop: '10px',
          fontSize: '9px',
          color: colors.muted,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          <span>Generated: {generatedTime}</span>
          <span>Neema Gen Shop · Confidential</span>
        </div>
      </div>
    </div>
  );
}
