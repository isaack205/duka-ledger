import { getCustomerSummaryData, normalizeQueryRows } from './customerLedgerUtils';

export default function CustomerInvoicePrint({ invoiceData, customerName, transactions }) {
  const transactionRows = normalizeQueryRows(transactions);
  const summary = invoiceData?.summary || getCustomerSummaryData(transactionRows, customerName);
  const invoiceLines = invoiceData?.timeline || summary.timeline;
  const invoiceNumber = invoiceData?.invoiceNumber || `INV-${String(customerName || '000').replace(/\s+/g, '').slice(0, 6).toUpperCase()}-${String(invoiceLines.length).padStart(3, '0')}`;
  const invoiceDate = invoiceData?.invoiceDate || new Date().toLocaleDateString();
  const businessName = invoiceData?.businessName || 'DukaLedger';
  const businessTagline = invoiceData?.businessTagline || 'Customer credit invoice statement';

  return (
    <div className="ledger-invoice-grid space-y-5 text-gray-900 print:text-black">
      <div className="ledger-invoice-summary overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:shadow-none">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white print:bg-white print:text-black md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 print:text-slate-500">{businessName}</p>
            <h4 className="mt-2 text-3xl font-black tracking-tight">CUSTOM INVOICE</h4>
            <p className="mt-2 max-w-xl text-sm text-slate-300 print:text-slate-600">{businessTagline}</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm print:border-slate-200 print:bg-slate-50 print:text-slate-700 md:min-w-64">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 print:text-slate-500">Invoice No.</span>
              <span className="font-semibold">{invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 print:text-slate-500">Invoice Date</span>
              <span className="font-semibold">{invoiceDate}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Bill To</p>
            <h4 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{customerName}</h4>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="font-medium text-slate-800">{summary.phone || invoiceData?.customerPhone || 'No phone verified'}</div>
              <div>{invoiceData?.customerLabel || 'Customer credit statement'}</div>
              {invoiceData?.referenceNote ? <div className="text-xs text-slate-500">{invoiceData.referenceNote}</div> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total Debt</p>
              <p className="mt-2 text-xl font-black text-slate-950">KES {summary.totalDebt.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Total Repaid</p>
              <p className="mt-2 text-xl font-black text-emerald-700">KES {summary.totalRepayed.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700">Remaining Balance</p>
              <p className="mt-2 text-xl font-black text-rose-700">KES {summary.remainingDebt.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="ledger-invoice-panel overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:shadow-none">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Invoice Breakdown</h4>
            <p className="text-xs text-slate-500">{invoiceLines.length} line{invoiceLines.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="ledger-invoice-table w-full border-collapse text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-6 py-3 font-semibold">Date</th>
                <th className="border-b border-slate-200 px-6 py-3 font-semibold">Description</th>
                <th className="border-b border-slate-200 px-6 py-3 font-semibold">Type</th>
                <th className="border-b border-slate-200 px-6 py-3 text-right font-semibold">Amount</th>
                <th className="border-b border-slate-200 px-6 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoiceLines.map((line) => {
                const isDebt = line.displayType === 'debt';
                return (
                  <tr key={line.id} className="align-top odd:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-6 py-4 text-slate-600">
                      {new Date(line.created_at).toLocaleDateString()}
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4 text-slate-800">
                      <div className="font-medium">{line.notes || (isDebt ? 'Debt entry' : 'Repayment entry')}</div>
                      <div className="mt-1 text-xs text-slate-500">{isDebt ? line.item_name || 'Customer items' : 'Payment received'}</div>
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isDebt ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isDebt ? 'Debt' : 'Repayment'}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4 text-right font-semibold text-slate-700">
                      {isDebt ? `KES ${parseFloat(line.net_debt_amount).toFixed(2)}` : `KES ${Math.abs(parseFloat(line.net_debt_amount)).toFixed(2)}`}
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4 text-right font-semibold text-slate-700">
                      {isDebt ? `KES ${line.remainingBalance.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ledger-invoice-footer rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 print:bg-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</p>
        <p className="mt-2 leading-6">{invoiceData?.footerNote || 'This statement reflects the customer ledger balances recorded in DukaLedger at the time of printing.'}</p>
      </div>
    </div>
  );
}