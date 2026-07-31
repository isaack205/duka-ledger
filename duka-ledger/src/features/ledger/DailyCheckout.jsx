import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
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
    SELECT * FROM customer_ledgers ORDER BY created_at ASC
  `);

  const { data: supplierTransactions } = useQuery(`
    SELECT * FROM supplier_ledgers ORDER BY created_at ASC
  `);

  const { data: pastCheckouts } = useQuery(`
    SELECT * FROM daily_checkouts 
    ORDER BY checkout_date DESC
  `);

  const { isAdmin } = useAuth();

  const [cashCollected, setCashCollected] = useState('');
  const [mpesaCollected, setMpesaCollected] = useState('');
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
      const originalTitle = document.title;
      document.title = `Daily_Closeout_${checkout.checkout_date}`;
      document.body.classList.add('printing-checkout');
      window.print();

      // 3. Clean up body class after print dialog closes
      const cleanup = () => {
        document.title = originalTitle;
        document.body.classList.remove('printing-checkout');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
    }, 150);
  };

  const todaysCheckout = pastCheckouts?.find(co => co.checkout_date === todayStr);
  const isRegisterClosedToday = !!todaysCheckout && !isEditingToday;

  const getTransactionsByDate = (transactions, date) =>
    (transactions || []).filter(t => t.created_at?.slice(0, 10) === date);

  const getDailyDebtDetails = (transactions, date, nameKey, originalAmountKey) => {
    const endOfDay = new Date(`${date}T23:59:59.999`);
    const transactionsToDate = (transactions || [])
      .filter(t => new Date(t.created_at) <= endOfDay)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const debtsByName = transactionsToDate.reduce((groups, tx) => {
      const name = tx[nameKey];
      if (!name) return groups;
      return {
        ...groups,
        [name]: [...(groups[name] || []), tx]
      };
    }, {});

    return Object.values(debtsByName).flatMap((nameTransactions) => {
      const debts = nameTransactions
        .filter(t => t.transaction_type === 'debt')
        .map(t => ({
          ...t,
          originalAmount: parseFloat(t[originalAmountKey] || t.net_debt_amount) || 0,
          remainingBalance: parseFloat(t.net_debt_amount) || 0
        }));
      const repayments = nameTransactions.filter(t => t.transaction_type === 'repayment');
      let repaymentPool = repayments.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.net_debt_amount) || 0), 0);

      const processedDebts = debts.map((debt) => {
        const appliedPayment = Math.min(repaymentPool, debt.remainingBalance);
        repaymentPool -= appliedPayment;
        const remainingBalance = Math.max(0, debt.remainingBalance - appliedPayment);
        const status = remainingBalance === 0 ? 'Paid' : appliedPayment > 0 ? 'Partial' : 'Unpaid';

        return {
          name: debt[nameKey],
          originalAmount: debt.originalAmount,
          upfrontPaid: parseFloat(debt.amount_paid_upfront || 0) || 0,
          remainingBalance,
          status,
          notes: debt.notes || '',
          createdAt: debt.created_at
        };
      });

      return processedDebts.filter(debt => debt.createdAt?.slice(0, 10) === date);
    });
  };

  const getTodayCheckoutMetrics = () => {
    const todayCustomerTxs = getTransactionsByDate(customerTransactions, todayStr);
    const todaySupplierTxs = getTransactionsByDate(supplierTransactions, todayStr);

    // Section 2: Supplier Outflows Today
    let supplierCashPaid = 0;
    let supplierMpesaPaid = 0;
    let supplierDebtCreated = 0;

    todaySupplierTxs.forEach((tx) => {
      const upfront = parseFloat(tx.amount_paid_upfront || 0);
      const isRepayment = tx.transaction_type === 'repayment';
      const repaymentVal = isRepayment ? Math.abs(parseFloat(tx.net_debt_amount || 0)) : 0;
      const method = tx.payment_method || 'cash'; // fallback to cash if not set

      if (tx.transaction_type === 'debt') {
        supplierDebtCreated += parseFloat(tx.net_debt_amount || 0);
      }

      if (isRepayment) {
        if (method === 'mpesa') supplierMpesaPaid += repaymentVal;
        else supplierCashPaid += repaymentVal;
      } else if (upfront > 0) {
        if (method === 'mpesa') supplierMpesaPaid += upfront;
        else supplierCashPaid += upfront;
      }
    });

    // Section 3: Customer Credit Movements Today
    let customerCreditIssued = 0;
    let customerDebtRecovered = 0;

    todayCustomerTxs.forEach((tx) => {
      if (tx.transaction_type === 'debt') {
        customerCreditIssued += parseFloat(tx.net_debt_amount || 0);
      } else if (tx.transaction_type === 'repayment') {
        customerDebtRecovered += Math.abs(parseFloat(tx.net_debt_amount || 0));
      }
    });

    const totalSupplierOutflows = supplierCashPaid + supplierMpesaPaid;

    return {
      supplierCashPaid,
      supplierMpesaPaid,
      totalSupplierOutflows,
      supplierDebtCreated,
      customerCreditIssued,
      customerDebtRecovered
    };
  };

  const todayMetrics = getTodayCheckoutMetrics();

  const getCheckoutPrintDetails = (checkout) => ({
    customerDebts: getDailyDebtDetails(customerTransactions, checkout.checkout_date, 'customer_name', 'total_item_value'),
    supplierDebts: getDailyDebtDetails(supplierTransactions, checkout.checkout_date, 'supplier_name', 'total_invoice_value')
  });

  const handleCloseRegister = async (e) => {
    e.preventDefault();

    const cash = parseFloat(cashCollected);
    if (isNaN(cash) || cash < 0) {
      toast.error('Validation Error', 'Please enter a valid physical cash amount.');
      return;
    }

    const mpesa = parseFloat(mpesaCollected || '0');
    if (isNaN(mpesa) || mpesa < 0) {
      toast.error('Validation Error', 'Please enter a valid M-Pesa amount.');
      return;
    }

    const subtotalA = cash + mpesa; // Money on hand
    const subtotalB = todayMetrics.totalSupplierOutflows; // Outflows
    const netCashPosition = subtotalA; // Net Position = A
    const totalCashRealized = subtotalA + subtotalB; // A + B
    const totalBusinessVolume = (subtotalA + subtotalB) + todayMetrics.customerCreditIssued; // (A + B) + C

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (isEditingToday && todaysCheckout) {
        await db.execute(
          `UPDATE daily_checkouts 
           SET total_cash_collected = ?, 
               total_mpesa_collected = ?,
               supplier_cash_paid = ?,
               supplier_mpesa_paid = ?,
               customer_credit_issued = ?, 
               customer_debt_recovered = ?,
               supplier_debt_created = ?, 
               net_cash_position = ?, 
               total_cash_realized = ?,
               total_business_volume = ?,
               notes = ?, 
               recorded_by = ?, 
               created_at = ?
           WHERE id = ?`,
          [
            cash.toFixed(2),
            mpesa.toFixed(2),
            todayMetrics.supplierCashPaid.toFixed(2),
            todayMetrics.supplierMpesaPaid.toFixed(2),
            todayMetrics.customerCreditIssued.toFixed(2),
            todayMetrics.customerDebtRecovered.toFixed(2),
            todayMetrics.supplierDebtCreated.toFixed(2),
            netCashPosition.toFixed(2),
            totalCashRealized.toFixed(2),
            totalBusinessVolume.toFixed(2),
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
            id, total_cash_collected, total_mpesa_collected, 
            supplier_cash_paid, supplier_mpesa_paid,
            customer_credit_issued, customer_debt_recovered, supplier_debt_created, 
            net_cash_position, total_cash_realized, total_business_volume,
            checkout_date, notes, recorded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            cash.toFixed(2),
            mpesa.toFixed(2),
            todayMetrics.supplierCashPaid.toFixed(2),
            todayMetrics.supplierMpesaPaid.toFixed(2),
            todayMetrics.customerCreditIssued.toFixed(2),
            todayMetrics.customerDebtRecovered.toFixed(2),
            todayMetrics.supplierDebtCreated.toFixed(2),
            netCashPosition.toFixed(2),
            totalCashRealized.toFixed(2),
            totalBusinessVolume.toFixed(2),
            todayStr,
            notes.trim() || `Daily reconciliation completed.`,
            session?.user?.id || null,
            new Date().toISOString()
          ]
        );
        toast.success('Register Closed', 'Daily drawer checkout saved successfully.');
      }

      setCashCollected('');
      setMpesaCollected('');
      setNotes('');
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record daily register closeout.');
    }
  };

  const handleTriggerEdit = (e, checkout) => {
    e.stopPropagation();
    setCashCollected(parseFloat(checkout.total_cash_collected).toString());
    setMpesaCollected(parseFloat(checkout.total_mpesa_collected || 0).toString());
    setNotes(checkout.notes || '');
    setIsEditingToday(true);
  };

  return (
    <>
    <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : ''} gap-8 mt-6 pb-12 animate-fade-in font-sans`}>
      
      {/* LEFT COLUMN: DAILY CLOSEOUT PANEL */}
      <div className={`bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6 ${isAdmin ? 'lg:col-span-1' : 'max-w-2xl mx-auto w-full'} h-fit`}>
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
          <div className="p-5 bg-secondary/5 border border-secondary/15 rounded-2xl space-y-4">
            <div className="text-secondary font-extrabold text-base flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" />
              <span>Register Closed Today</span>
            </div>
            <p className="text-xs text-slate-500 font-semibold text-center leading-relaxed">
              You have logged the drawer closeout for today ({todayStr}).
            </p>

            <div className="pt-3 border-t border-slate-200/60 space-y-2.5 text-xs font-semibold">
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Register & Till Count</span>
                <div className="flex justify-between text-slate-700">
                  <span>Cash Counted:</span>
                  <strong className="text-primary">{parseFloat(todaysCheckout.total_cash_collected).toFixed(2)} KES</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>M-Pesa Balance:</span>
                  <strong className="text-secondary-dark">{parseFloat(todaysCheckout.total_mpesa_collected || 0).toFixed(2)} KES</strong>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier Outflows</span>
                <div className="flex justify-between text-slate-700">
                  <span>Supplier Cash:</span>
                  <strong className="text-slate-800">{parseFloat(todaysCheckout.supplier_cash_paid || 0).toFixed(2)} KES</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Supplier M-Pesa:</span>
                  <strong className="text-slate-800">{parseFloat(todaysCheckout.supplier_mpesa_paid || 0).toFixed(2)} KES</strong>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Credit Movements</span>
                <div className="flex justify-between text-slate-700">
                  <span>New Customer Debts:</span>
                  <strong className="text-rose-600">{parseFloat(todaysCheckout.customer_credit_issued || 0).toFixed(2)} KES</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Debts Recovered:</span>
                  <strong className="text-emerald-600">{parseFloat(todaysCheckout.customer_debt_recovered || 0).toFixed(2)} KES</strong>
                </div>
              </div>

              <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 space-y-1 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Total Revenue Earned Today:</span>
                  <strong className="text-primary">{parseFloat(todaysCheckout.total_cash_realized || 0).toFixed(2)} KES</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Business Volume:</span>
                  <strong className="text-primary font-black">{parseFloat(todaysCheckout.total_business_volume || 0).toFixed(2)} KES</strong>
                </div>
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
          <form onSubmit={handleCloseRegister} className="space-y-5">
            
            {/* SECTION 1: REGISTER & TILL COUNT */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Section 1: Register & Till Count
                </span>
                <span className="text-[10px] font-bold text-slate-400">Subtotal: {((parseFloat(cashCollected) || 0) + (parseFloat(mpesaCollected) || 0)).toFixed(2)} KES</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Physical Cash Count (KES)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 30000.00"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">M-Pesa Balance (KES)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 12000.00"
                    value={mpesaCollected}
                    onChange={(e) => setMpesaCollected(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: OUTFLOWS TODAY */}
            <div className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Section 2: Outflows Today (Suppliers)
                </span>
                <span className="text-[10px] font-bold text-amber-700">Subtotal: {todayMetrics.totalSupplierOutflows.toFixed(2)} KES</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 pt-1">
                <div className="bg-white p-2 rounded-lg border border-amber-100">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Supplier Cash Paid</span>
                  <strong className="text-slate-800 text-xs">{todayMetrics.supplierCashPaid.toFixed(2)} KES</strong>
                </div>
                <div className="bg-white p-2 rounded-lg border border-amber-100">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Supplier M-Pesa Paid</span>
                  <strong className="text-slate-800 text-xs">{todayMetrics.supplierMpesaPaid.toFixed(2)} KES</strong>
                </div>
              </div>
            </div>

            {/* SECTION 3: CREDIT / DEBTS MOVEMENTS */}
            <div className="p-4 bg-emerald-50/30 border border-emerald-200/60 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Section 3: Credit & Debts Movements
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 pt-1">
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">New Customer Debts</span>
                  <strong className="text-rose-600 text-xs">{todayMetrics.customerCreditIssued.toFixed(2)} KES</strong>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Debts Recovered</span>
                  <strong className="text-emerald-600 text-xs">{todayMetrics.customerDebtRecovered.toFixed(2)} KES</strong>
                </div>
              </div>
            </div>

            {/* COMPUTED RESULTS SUMMARY */}
            {(() => {
              const a = (parseFloat(cashCollected) || 0) + (parseFloat(mpesaCollected) || 0);
              const b = todayMetrics.totalSupplierOutflows;
              const c = todayMetrics.customerCreditIssued;
              const cashRealized = a + b;
              const netPos = a;
              const businessVol = (a + b) + c;

              return (
                <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl space-y-2 text-xs">
                  <span className="text-[10px] font-black text-primary uppercase tracking-wider block">Calculated Closeout Metrics</span>
                  <div className="space-y-1.5 font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span>Total Revenue Earned Today:</span>
                      <strong className="text-primary">{cashRealized.toFixed(2)} KES</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Net Cash Position:</span>
                      <strong className="text-secondary-dark">{netPos.toFixed(2)} KES</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1.5 text-slate-900">
                      <span>Total Business Volume:</span>
                      <strong className="text-primary text-sm font-black">{businessVol.toFixed(2)} KES</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

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
        )}
      </div>

      {/* RIGHT COLUMN: PAST CLOSEOUT RECORDS */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-secondary" />
            <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Past Register Reconciliations</h3>
          </div>

          <div className="overflow-x-auto custom-scrollbar -mx-6 px-6">
            <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200/60">
                <tr>
                  <th className="py-3.5 px-4 rounded-l-xl">Checkout Date</th>
                  <th className="py-3.5 px-4 text-right">Cash Counted</th>
                  <th className="py-3.5 px-4 text-right">M-Pesa</th>
                  <th className="py-3.5 px-4 text-right">Supplier Outflows</th>
                  <th className="py-3.5 px-4 text-right">Credit Issued</th>
                  <th className="py-3.5 px-4 text-right">Debt Recovered</th>
                  <th className="py-3.5 px-4 text-right">Business Volume</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {pastCheckouts?.map((co) => {
                  const isAutoCheckout = co.notes?.toLowerCase().includes('auto checkout');
                  const outflows = (parseFloat(co.supplier_cash_paid || 0) + parseFloat(co.supplier_mpesa_paid || 0));
                  const volume = parseFloat(co.total_business_volume || 0);

                  return (
                    <tr 
                      key={co.id} 
                      className="hover:bg-slate-50/50 transition cursor-pointer" 
                      onClick={() => setSelectedCheckout(co)}
                    >
                      <td className="py-3.5 px-4 text-primary font-bold">
                        <div className="flex flex-col gap-0.5">
                          <span>{co.checkout_date}</span>
                          {isAutoCheckout && (
                            <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-full w-fit uppercase tracking-wider">
                              Auto Closed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-800">{parseFloat(co.total_cash_collected).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-secondary-dark">{parseFloat(co.total_mpesa_collected || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-amber-600">{outflows.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-rose-600">{parseFloat(co.customer_credit_issued || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-emerald-600">{parseFloat(co.customer_debt_recovered || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-primary">{volume.toFixed(2)}</td>
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
                    <td colSpan="8" className="py-12 text-center text-slate-500 text-xs font-semibold">
                      No register closeouts logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL OVERLAY */}
      {selectedCheckout && (() => {
        const cash = parseFloat(selectedCheckout.total_cash_collected) || 0;
        const mpesa = parseFloat(selectedCheckout.total_mpesa_collected || 0);
        const net = parseFloat(selectedCheckout.net_cash_position) || (cash + mpesa);
        const supplierCash = parseFloat(selectedCheckout.supplier_cash_paid || 0);
        const supplierMpesa = parseFloat(selectedCheckout.supplier_mpesa_paid || 0);
        const totalOutflows = supplierCash + supplierMpesa;
        const creditIssued = parseFloat(selectedCheckout.customer_credit_issued || 0);
        const debtRecovered = parseFloat(selectedCheckout.customer_debt_recovered || 0);
        const cashRealized = parseFloat(selectedCheckout.total_cash_realized || (cash + mpesa + totalOutflows));
        const businessVolume = parseFloat(selectedCheckout.total_business_volume || (cashRealized + creditIssued));
        const isNetPositive = net >= 0;
        
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
                  </div>
                </div>

                {/* Date pill */}
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 w-fit">
                  <Calendar className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-bold text-white">{selectedCheckout.checkout_date}</span>
                </div>
              </div>

              {/* ── COMPUTED STATS TILES ── */}
              <div className="grid grid-cols-3 gap-3 p-5 pb-0 text-center">
                {/* Cash Counted */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Physical Cash</span>
                  <p className="text-sm font-black text-primary">{cash.toFixed(2)}</p>
                </div>

                {/* M-Pesa */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">M-Pesa</span>
                  <p className="text-sm font-black text-secondary-dark">{mpesa.toFixed(2)}</p>
                </div>

                {/* Business Volume */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Business Vol</span>
                  <p className="text-sm font-black text-primary">{businessVolume.toFixed(2)}</p>
                </div>
              </div>

              {/* ── 3-SECTION DETAILED BREAKDOWN ── */}
              <div className="p-5 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  3-Section Reconciliation Detail
                </p>

                {/* Section 2: Supplier Outflows */}
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-800">Supplier Outflows</span>
                    <strong className="text-amber-900 font-extrabold">{totalOutflows.toFixed(2)} KES</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Cash Paid: {supplierCash.toFixed(2)} KES</span>
                    <span>M-Pesa Paid: {supplierMpesa.toFixed(2)} KES</span>
                  </div>
                </div>

                {/* Section 3: Credit Movements */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-800">Credit Movements</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span className="text-rose-600">New Credit: {creditIssued.toFixed(2)} KES</span>
                    <span className="text-emerald-700">Recovered: {debtRecovered.toFixed(2)} KES</span>
                  </div>
                </div>

                {/* Realized Revenue */}
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-2xl flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-700">Total Revenue Earned Today:</span>
                  <strong className="text-primary font-black">{cashRealized.toFixed(2)} KES</strong>
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
        details={getCheckoutPrintDetails(printCheckout)}
      />
    )}
    </>
  );
}
