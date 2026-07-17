import { normalizeQueryRows } from '../customerLedgerUtils';

export default function SupplierInvoicePrint({ invoiceData, supplierName, transactions }) {
  const summary = invoiceData?.summary;
  const invoiceLines = invoiceData?.timeline || [];
  const finalSupplierName = invoiceData?.supplierName || supplierName;
  const invoiceNumber = invoiceData?.invoiceNumber || `INV-SUP-${String(finalSupplierName || '000').replace(/\s+/g, '').slice(0, 6).toUpperCase()}-${String(invoiceLines.length).padStart(3, '0')}`;
  const invoiceDate = invoiceData?.invoiceDate || new Date().toLocaleDateString();
  const businessName = 'Neema Gen Shop';
  const businessTagline = invoiceData?.businessTagline || 'Supplier credit statement';
  const operators = invoiceData?.operators || {};

  return (
    <div className="ledger-invoice-grid space-y-6 text-slate-800 print:text-black font-sans p-6 bg-white border border-slate-200/80 rounded-2xl print:border-none print:p-0">
      
      {/* Invoice Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">{businessName}</p>
          <h4 className="text-2xl font-black text-primary mt-1">SUPPLIER STATEMENT</h4>
          <p className="text-xs text-slate-550 mt-1">{businessTagline}</p>
        </div>
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-1.5 min-w-[200px]">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-400">Statement No:</span>
            <span className="font-bold text-slate-800">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-400">Issued Date:</span>
            <span className="font-bold text-slate-800">{invoiceDate}</span>
          </div>
        </div>
      </div>

      {/* Supplier & Balance details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="bg-slate-50/50 border border-slate-200/60 p-5 rounded-xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier details</p>
          <h4 className="text-lg font-extrabold text-primary">{finalSupplierName}</h4>
          <div className="text-xs text-slate-600 space-y-1">
            {invoiceData?.customerPhone && (
              <div><span className="font-semibold text-slate-400">Phone:</span> {invoiceData.customerPhone}</div>
            )}
            <div><span className="font-semibold text-slate-400">Reference:</span> Supplier balance audit</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
            <span className="text-sm font-black text-slate-800 block mt-2">KES {summary?.totalDebt.toFixed(2)}</span>
          </div>
          <div className="bg-emerald-50/40 border border-emerald-100/80 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Paid Off</span>
            <span className="text-sm font-black text-secondary block mt-2">KES {summary?.totalRepayed.toFixed(2)}</span>
          </div>
          <div className="bg-rose-50/50 border border-rose-100/80 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider block">Outstanding</span>
            <span className="text-sm font-black text-accent block mt-2">KES {summary?.remainingDebt.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table breakdown */}
      <div className="border border-slate-200/80 rounded-xl overflow-hidden mt-4">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-150">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Operator</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Bal. Owed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {invoiceLines.map((line) => {
              const isDebt = line.displayType === 'debt';
              return (
                <tr key={line.id} className="align-top odd:bg-slate-50/20">
                  <td className="py-3 px-4 text-slate-450">
                    {new Date(line.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-slate-800">
                    <div>{line.notes || (isDebt ? 'Supply Invoiced' : 'Payment offset')}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                      isDebt ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      {isDebt ? 'Invoice' : 'Payment'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-semibold">
                    {operators[line.recorded_by] || '—'}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${isDebt ? 'text-slate-800' : 'text-emerald-600'}`}>
                    {isDebt ? `KES ${parseFloat(line.net_debt_amount).toFixed(2)}` : `- KES ${Math.abs(parseFloat(line.net_debt_amount)).toFixed(2)}`}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-450">
                    {isDebt ? `KES ${line.remainingBalance.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Notes */}
      <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-[11px] text-slate-500 leading-relaxed">
        <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400 mb-1">Notes</p>
        <p>{invoiceData?.footerNote || 'This statement reflects the supplier ledger balances recorded in DukaLedger at the time of printing.'}</p>
      </div>

    </div>
  );
}
