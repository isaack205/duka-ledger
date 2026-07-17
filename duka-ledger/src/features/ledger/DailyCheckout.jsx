import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { 
  FileSpreadsheet, 
  Edit, 
  X, 
  Info, 
  Wallet, 
  ClipboardList, 
  CheckCircle2, 
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Banknote,
  Users,
  Truck,
  ShieldCheck,
  ShieldAlert,
  Printer
} from 'lucide-react';
import { useOperators } from './operatorResolver';
import DailyCheckoutPrint from './pdfTemplates/DailyCheckoutPrint';

export function DailyCheckout() {
  const toast = useToast();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: customerTransactions } = useQuery(`
    SELECT * FROM customer_ledgers WHERE date(created_at) = date(?)
  `, [todayStr]);

  const { data: supplierTransactions } = useQuery(`
    SELECT * FROM supplier_ledgers WHERE date(created_at) = date(?)
  `, [todayStr]);

  const { data: pastCheckouts } = useQuery(`
    SELECT * FROM daily_checkouts 
    ORDER BY checkout_date DESC
  `);

  const [cashCollected, setCashCollected] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [isEditingToday, setIsEditingToday] = useState(false);
  const printFrameRef = useRef(null);
  const [printCheckout, setPrintCheckout] = useState(null);

  // Memoize the IDs array so its reference only changes when actual IDs change
  // (prevents infinite render loop in useOperators useEffect)
  const recordedByIds = useMemo(
    () => [...new Set((pastCheckouts || []).map(co => co.recorded_by).filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(pastCheckouts || []).map(co => co.recorded_by).join(',')]
  );
  const operators = useOperators(recordedByIds);

  const handlePrint = (checkout) => {
    // 1. Set the checkout data so DailyCheckoutPrint renders into DOM
    setPrintCheckout(checkout);

    // 2. After state update, add body class to isolate the print layout from the modal
    setTimeout(() => {
      document.body.classList.add('printing-checkout');
      window.print();

      // 3. Clean up body class after print dialog closes
      const cleanup = () => {
        document.body.classList.remove('printing-checkout');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
    }, 150);
  };

  const todaysCheckout = pastCheckouts?.find(co => co.checkout_date === todayStr);
  const isRegisterClosedToday = !!todaysCheckout && !isEditingToday;

  const getTodayUnpaidDebts = () => {
    const customerDebts = customerTransactions?.filter(t => t.transaction_type === 'debt') || [];
    const customerRepayments = customerTransactions?.filter(t => t.transaction_type === 'repayment') || [];
    
    const totalCustomerDebtCreated = customerDebts.reduce((sum, tx) => sum + (parseFloat(tx.net_debt_amount) || 0), 0);
    const totalCustomerRepaymentsToday = customerRepayments.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.net_debt_amount || 0)), 0);
    const customerDebtNotPaidToday = Math.max(0, totalCustomerDebtCreated - totalCustomerRepaymentsToday);

    const supplierDebts = supplierTransactions?.filter(t => t.transaction_type === 'debt') || [];
    const supplierRepayments = supplierTransactions?.filter(t => t.transaction_type === 'repayment') || [];

    const totalSupplierDebtCreated = supplierDebts.reduce((sum, tx) => sum + (parseFloat(tx.net_debt_amount) || 0), 0);
    const totalSupplierRepaymentsToday = supplierRepayments.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.net_debt_amount || 0)), 0);
    const supplierDebtNotPaidToday = Math.max(0, totalSupplierDebtCreated - totalSupplierRepaymentsToday);

    return { customerDebtNotPaidToday, supplierDebtNotPaidToday };
  };

  const { customerDebtNotPaidToday, supplierDebtNotPaidToday } = getTodayUnpaidDebts();

  const handleCloseRegister = async (e) => {
    e.preventDefault();

    const cash = parseFloat(cashCollected);
    if (isNaN(cash) || cash < 0) {
      toast.error('Validation Error', 'Please enter a valid physical cash amount.');
      return;
    }

    const calculatedNetPosition = cash - supplierDebtNotPaidToday;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (isEditingToday && todaysCheckout) {
        await db.execute(
          `UPDATE daily_checkouts 
           SET total_cash_collected = ?, 
               customer_credit_issued = ?, 
               supplier_debt_created = ?, 
               net_cash_position = ?, 
               notes = ?, 
               recorded_by = ?, 
               created_at = ?
           WHERE id = ?`,
          [
            cash.toFixed(2),
            customerDebtNotPaidToday.toFixed(2),
            supplierDebtNotPaidToday.toFixed(2),
            calculatedNetPosition.toFixed(2),
            notes.trim() || `Daily reconciliation updated.`,
            session?.user?.id || null,
            new Date().toISOString(),
            todaysCheckout.id
          ]
        );
        setIsEditingToday(false);
        toast.success('Closeout Updated', "Today's checkout register details have been adjusted.");
      } else {
        await db.execute(
          `INSERT INTO daily_checkouts (
            id, total_cash_collected, total_mpesa_collected, customer_credit_issued,
            supplier_debt_created, net_cash_position, checkout_date, notes, recorded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            cash.toFixed(2),
            '0.00',
            customerDebtNotPaidToday.toFixed(2),
            supplierDebtNotPaidToday.toFixed(2),
            calculatedNetPosition.toFixed(2),
            todayStr,
            notes.trim() || `Daily reconciliation completed.`,
            session?.user?.id || null,
            new Date().toISOString()
          ]
        );
        toast.success('Register Closed', 'Daily drawer checkout saved successfully.');
      }

      setCashCollected('');
      setNotes('');
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record daily register closeout.');
    }
  };

  const handleTriggerEdit = (e, checkout) => {
    e.stopPropagation();
    setCashCollected(parseFloat(checkout.total_cash_collected).toString());
    setNotes(checkout.notes || '');
    setIsEditingToday(true);
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6 pb-12 animate-fade-in font-sans">
      
      {/* LEFT COLUMN: DAILY CLOSEOUT PANEL */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 lg:col-span-1 h-fit">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet className="h-5 w-5 text-secondary" />
            <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">
              {isEditingToday ? "Modify Today's Closeout" : 'Daily Register Closeout'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">Reconcile physical cash drawer balances at end-of-day</p>
        </div>

        {isRegisterClosedToday ? (
          <div className="p-5 bg-secondary/5 border border-secondary/15 rounded-2xl space-y-4 text-center">
            <div className="text-secondary font-extrabold text-base flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" />
              <span>Register Closed Today</span>
            </div>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              You have already logged the drawer closeout for today ({todayStr}).
            </p>
            <div className="pt-4 border-t border-slate-100 text-left space-y-2 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>Cash Counted:</span>
                <strong className="text-primary">{parseFloat(todaysCheckout.total_cash_collected).toFixed(2)} KES</strong>
              </div>
            </div>
            <button 
              onClick={(e) => handleTriggerEdit(e, todaysCheckout)}
              className="w-full mt-2 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Modify Today's Figures
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  <span>Today's Outstanding Customer Debt:</span>
                </span>
                <strong className="text-accent">{customerDebtNotPaidToday.toFixed(2)} KES</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Today's Outstanding Supplier Payables:</span>
                </span>
                <strong className="text-amber-600">{supplierDebtNotPaidToday.toFixed(2)} KES</strong>
              </div>
            </div>

            <form onSubmit={handleCloseRegister} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Physical Cash Counted</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 30000.00"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex justify-between">
                  <span>M-Pesa Collected</span>
                  <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">Disabled</span>
                </label>
                <input
                  type="text"
                  value="M-Pesa payments inactive on frontend"
                  disabled
                  className="w-full px-3 py-2.5 border border-slate-100 bg-slate-50 text-slate-400 rounded-xl text-xs cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Drawer Audit Notes</label>
                <textarea
                  placeholder="Note down cash shortages, surplus, or register errors..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition h-20 resize-none"
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <span>Log Register Closeout</span>
              </button>
            </form>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: PAST CLOSEOUT RECORDS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs lg:col-span-2 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="h-5 w-5 text-secondary" />
          <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Past Register Reconciliations</h3>
        </div>

        <div className="overflow-x-auto custom-scrollbar -mx-6 px-6">
          <table className="w-full text-left text-sm text-slate-600 min-w-[650px]">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200/60">
              <tr>
                <th className="py-3.5 px-4 rounded-l-xl">Checkout Date</th>
                <th className="py-3.5 px-4 text-right">Physical Cash</th>
                <th className="py-3.5 px-4 text-right">Credit Issued</th>
                <th className="py-3.5 px-4 text-right">Supplier Debts</th>
                <th className="py-3.5 px-4 text-right">Net Position</th>
                <th className="py-3.5 px-4 text-center rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {pastCheckouts?.map((co) => {
                const isNetPos = parseFloat(co.net_cash_position) >= 0;
                return (
                  <tr 
                    key={co.id} 
                    className="hover:bg-slate-50/50 transition cursor-pointer" 
                    onClick={() => setSelectedCheckout(co)}
                  >
                    <td className="py-3.5 px-4 text-primary font-bold">{co.checkout_date}</td>
                    <td className="py-3.5 px-4 text-right text-slate-800">{parseFloat(co.total_cash_collected).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right text-accent">{parseFloat(co.customer_credit_issued || 0).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right text-amber-600">{parseFloat(co.supplier_debt_created || 0).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${isNetPos ? 'bg-secondary/5 text-secondary border border-secondary/10' : 'bg-accent/5 text-accent border border-accent/10'}`}>
                        {parseFloat(co.net_cash_position).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedCheckout(co)}
                        className="px-2.5 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(!pastCheckouts || pastCheckouts.length === 0) && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 text-xs font-semibold">
                    No register closeouts logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedCheckout && (() => {
        const cash = parseFloat(selectedCheckout.total_cash_collected) || 0;
        const net = parseFloat(selectedCheckout.net_cash_position) || 0;
        const creditIssued = parseFloat(selectedCheckout.customer_credit_issued || 0);
        const supplierPayables = parseFloat(selectedCheckout.supplier_debt_created || 0);
        const isNetPositive = net >= 0;
        const totalExposure = creditIssued + supplierPayables;
        const cashUtilization = cash > 0 ? Math.min(100, Math.round(((cash - totalExposure) / cash) * 100)) : 0;
        
        return (
          <div 
            className="fixed inset-0 bg-primary/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in"
            onClick={() => setSelectedCheckout(null)}
          >
            <div 
              className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl overflow-hidden animate-zoom-in"
              onClick={e => e.stopPropagation()}
            >
              {/* ── GRADIENT HEADER ── */}
              <div className={`relative p-6 pb-8 ${isNetPositive ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600' : 'bg-gradient-to-br from-rose-500 via-red-500 to-orange-500'}`}>
                {/* Close btn */}
                <button
                  onClick={() => setSelectedCheckout(null)}
                  className="absolute top-4 right-4 h-8 w-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Status badge */}
                <div className="flex items-center gap-2 mb-4">
                  {isNetPositive 
                    ? <ShieldCheck className="h-4 w-4 text-white/80" />
                    : <ShieldAlert className="h-4 w-4 text-white/80" />
                  }
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                    {isNetPositive ? 'Register Balanced' : 'Cash Deficit'}
                  </span>
                </div>

                {/* Net position hero */}
                <div className="space-y-0.5 mb-3">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Net Cash Position</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">
                      {net.toFixed(2)}
                    </span>
                    <span className="text-lg font-bold text-white/70 mb-1">KES</span>
                    {isNetPositive
                      ? <TrendingUp className="h-6 w-6 text-white/60 mb-1" />
                      : <TrendingDown className="h-6 w-6 text-white/60 mb-1" />
                    }
                  </div>
                </div>

                {/* Date pill */}
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 w-fit">
                  <Calendar className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-bold text-white">{selectedCheckout.checkout_date}</span>
                </div>
              </div>

              {/* ── STATS TILES ── */}
              <div className="grid grid-cols-2 gap-3 p-5 pb-0">
                {/* Physical Cash */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cash Counted</span>
                    <div className="h-7 w-7 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                      <Banknote className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-xl font-black text-primary">{cash.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-slate-400">KES · Physical drawer</p>
                </div>

                {/* Cash Utilization */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Utilization</span>
                    <div className="h-7 w-7 bg-violet-50 rounded-xl flex items-center justify-center border border-violet-100">
                      <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                  </div>
                  <p className="text-xl font-black text-primary">{cashUtilization}%</p>
                  <p className="text-[10px] font-bold text-slate-400">Net of total exposures</p>
                </div>
              </div>

              {/* ── CASH FLOW BREAKDOWN ── */}
              <div className="p-5 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Cash Flow Breakdown
                </p>

                {/* Credit Issued to Customers */}
                <div className="flex items-center gap-3 p-3.5 bg-rose-50/60 border border-rose-100 rounded-2xl">
                  <div className="h-9 w-9 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Customer Credit Issued</p>
                    <p className="text-xs font-bold text-slate-600 truncate">Unpaid balances extended today</p>
                  </div>
                  <span className="text-sm font-black text-rose-600 flex-shrink-0">{creditIssued.toFixed(2)} <span className="text-[10px] font-bold text-rose-400">KES</span></span>
                </div>

                {/* Supplier Payables */}
                <div className="flex items-center gap-3 p-3.5 bg-amber-50/60 border border-amber-100 rounded-2xl">
                  <div className="h-9 w-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Supplier Payables</p>
                    <p className="text-xs font-bold text-slate-600 truncate">Outstanding amounts owed to suppliers</p>
                  </div>
                  <span className="text-sm font-black text-amber-700 flex-shrink-0">{supplierPayables.toFixed(2)} <span className="text-[10px] font-bold text-amber-500">KES</span></span>
                </div>

                {/* Audit Notes */}
                {selectedCheckout.notes && (
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="h-3 w-3" />
                      Audit Notes
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold">{selectedCheckout.notes}</p>
                  </div>
                )}
              </div>

              {/* ── FOOTER ACTIONS ── */}
              <div className="px-5 pb-6 flex gap-3">
                <button
                  onClick={() => handlePrint(selectedCheckout)}
                  className="flex-1 py-3 rounded-2xl text-sm font-black text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  Print PDF
                </button>
                <button
                  onClick={() => setSelectedCheckout(null)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black text-white transition cursor-pointer shadow-sm ${isNetPositive ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600'}`}
                >
                  Close Report
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>

    {/* HIDDEN PRINT LAYOUT — only renders to paper/PDF via window.print() */}
    {printCheckout && (
      <DailyCheckoutPrint
        checkout={printCheckout}
        operatorName={operators[printCheckout.recorded_by] || 'Unknown Operator'}
      />
    )}
    </>
  );
}