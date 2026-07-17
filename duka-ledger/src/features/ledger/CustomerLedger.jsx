import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';
import { getCustomerSummaryData, normalizeQueryRows } from './customerLedgerUtils';
import CustomerInvoicePrint from './pdfTemplates/CustomerInvoicePrint';
import { useOperators } from './operatorResolver';
import { useToast } from '../../context/ToastContext';
import { 
  Users, 
  UserPlus, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  ChevronDown, 
  Info,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  Wallet,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  RotateCcw,
  Receipt
} from 'lucide-react';

// Reusable CSV generator helper function
const exportToCSV = (filename, headers, dataRows) => {
  const csvContent = [
    headers.join(','),
    ...dataRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function CustomerLedger() {
  const toast = useToast();
  const { data: items } = useQuery('SELECT * FROM items ORDER BY item_name ASC');
  const { data: transactions } = useQuery(`
    SELECT customer_ledgers.*, items.item_name 
    FROM customer_ledgers 
    LEFT JOIN items ON customer_ledgers.item_id = items.id
    ORDER BY customer_ledgers.created_at ASC
  `);

  const itemRows = normalizeQueryRows(items);
  const transactionRows = normalizeQueryRows(transactions);

  // Active user action states
  const [activeModal, setActiveModal] = useState(null); // 'sheet', 'debt', or 'repayment'
  const [modalCustomer, setModalCustomer] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [txFilter, setTxFilter] = useState('all'); // 'all', 'debt', 'repayment'

  // Memoize to prevent new array ref every render (which causes infinite loop in useOperators)
  const allRecordedByIds = useMemo(
    () => [...new Set((transactionRows || [])
      .filter(t => t.customer_name === modalCustomer)
      .map(t => t.recorded_by)
      .filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(transactionRows || []).filter(t => t.customer_name === modalCustomer).map(t => t.recorded_by).join(','), modalCustomer]
  );
  const resolvedOperators = useOperators(allRecordedByIds);

  // New Customer Form States
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Form states
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [upfrontPayment, setUpfrontPayment] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // Cart operations
  const handleAddToCart = () => {
    if (!selectedItemId) return;
    const item = itemRows.find(i => i.id === selectedItemId);
    if (!item) return;

    const existingIndex = cart.findIndex(c => c.id === item.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += parseInt(quantity, 10);
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...item, quantity: parseInt(quantity, 10) }]);
    }
    setSelectedItemId('');
    setQuantity(1);
  };

  const handleRemoveFromCart = (index) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    setCart(updatedCart);
  };

  const totalCartValue = cart.reduce((sum, item) => sum + (parseFloat(item.retail_price) * item.quantity), 0);
  const upfront = parseFloat(upfrontPayment) || 0;
  const netDebt = totalCartValue - upfront;

  // Unique list of customers
  const uniqueCustomers = [...new Set(transactionRows.map(t => t.customer_name))];

  // Split customers into Active (unpaid debt) and Closed (fully cleared)
  const activeDebtors = uniqueCustomers.filter(name => getCustomerSummaryData(transactionRows, name).remainingDebt > 0);
  const closedDebtors = uniqueCustomers.filter(name => getCustomerSummaryData(transactionRows, name).remainingDebt === 0);

  // Add completely new customer debt record
  const handleRegisterNewCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim() || cart.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cartDetails = cart.map(item => `${item.item_name} (x${item.quantity})`).join(', ');

      await db.execute(
        `INSERT INTO customer_ledgers (
          id, customer_name, customer_phone, item_id, total_item_value, 
          amount_paid_upfront, net_debt_amount, transaction_type, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newCustomerName.trim(),
          newCustomerPhone.trim() || null,
          cart.length === 1 ? cart[0].id : null,
          totalCartValue.toFixed(2),
          upfront.toFixed(2),
          netDebt.toFixed(2),
          'debt',
          notes.trim() || `First Debt Assignment: ${cartDetails}.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );

      toast.success('Customer Registered', `Credit ledger opened for ${newCustomerName.trim()}.`);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCart([]);
      setUpfrontPayment('');
      setNotes('');
    } catch (err) {
      console.error('Failed to create new customer debt:', err);
      toast.error('Operation Failed', 'Could not open credit record in local database.');
    }
  };

  // Database Inserts for existing profiles
  const handleRecordDebt = async (e) => {
    e.preventDefault();
    if (!modalCustomer || cart.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cartDetails = cart.map(item => `${item.item_name} (x${item.quantity})`).join(', ');
      
      await db.execute(
        `INSERT INTO customer_ledgers (
          id, customer_name, customer_phone, item_id, total_item_value, 
          amount_paid_upfront, net_debt_amount, transaction_type, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalCustomer,
          customerPhone || null,
          cart.length === 1 ? cart[0].id : null,
          totalCartValue.toFixed(2),
          upfront.toFixed(2),
          netDebt.toFixed(2),
          'debt',
          notes.trim() || `Purchased: ${cartDetails}.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      toast.success('Debt Recorded', `Recorded KES ${netDebt.toFixed(2)} debt for ${modalCustomer}.`);
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record invoice.');
    }
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    const payment = parseFloat(repaymentAmount);
    const summary = getCustomerSummaryData(transactionRows, modalCustomer);

    // Hard limit verification
    if (payment > summary.remainingDebt) {
      toast.error('Validation Error', `Payment exceeds outstanding debt of ${summary.remainingDebt.toFixed(2)} KES!`);
      return;
    }

    if (!modalCustomer || isNaN(payment) || payment <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await db.execute(
        `INSERT INTO customer_ledgers (
          id, customer_name, customer_phone, item_id, total_item_value, 
          amount_paid_upfront, net_debt_amount, transaction_type, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalCustomer,
          customerPhone || null,
          null,
          '0.00',
          payment.toFixed(2),
          (-payment).toFixed(2),
          'repayment',
          notes.trim() || `Debt repayment.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      toast.success('Payment Received', `Recorded KES ${payment.toFixed(2)} repayment from ${modalCustomer}.`);
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record payment.');
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalCustomer('');
    setCart([]);
    setUpfrontPayment('');
    setRepaymentAmount('');
    setNotes('');
    setTxFilter('all');
  };

  const openActionModal = (type, name) => {
    const data = getCustomerSummaryData(transactionRows, name);
    setModalCustomer(name);
    setCustomerPhone(data.phone);
    setActiveModal(type);
    setActiveDropdown(null);
  };

  const handleExportCSV = (customerName, transactions) => {
    const headers = ['Date', 'Type', 'Amount (KES)', 'Upfront (KES)', 'Notes'];
    
    const rows = (transactions || []).map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.transaction_type.toUpperCase(),
      t.net_debt_amount,
      t.amount_paid_upfront || '0.00',
      t.notes || ''
    ]);
    
    exportToCSV(`${customerName.replace(/\s+/g, '_')}_Statement`, headers, rows);
    toast.success('Export Successful', `Ledger CSV downloaded for ${customerName}.`);
  };

  const handlePrintPDF = () => {
    if (!modalCustomer) return;

    const summary = getCustomerSummaryData(transactionRows, modalCustomer);
    const invoiceLines = summary.timeline;

    setPrintInvoiceData({
      customerName: modalCustomer,
      customerPhone,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceLines.length).padStart(3, '0')}`,
      invoiceDate: new Date().toLocaleDateString(),
      businessName: 'DukaLedger',
      businessTagline: 'Customer credit invoice statement',
      customerLabel: 'Generated from the active ledger modal',
      referenceNote: notes?.trim() || 'Printed from the customer ledger modal.',
      summary,
      timeline: invoiceLines,
      operators: resolvedOperators,
      footerNote: 'Thank you for your business. Please keep this invoice for your records.'
    });
  };

  useEffect(() => {
    if (!printInvoiceData) return;

    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintInvoiceData(null), 250);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [printInvoiceData]);

  return (
    <div className="ledger-page space-y-8 mt-6 pb-12 animate-fade-in font-sans">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .ledger-print-area,
          .ledger-print-area *,
          .ledger-invoice-print-root,
          .ledger-invoice-print-root * {
            visibility: visible;
          }

          .ledger-print-area {
            position: absolute;
            inset: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .ledger-invoice-print-root {
            position: fixed;
            inset: 0;
            background: #fff;
            padding: 18px;
          }

          .ledger-invoice-print-shell {
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
          }

          .ledger-print-card {
            position: relative;
            inset: 0;
            max-width: none !important;
            max-height: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .ledger-screen-only {
            display: none !important;
          }

          .ledger-invoice-print-shell,
          .ledger-invoice-print-shell * {
            color: #0f172a !important;
          }
        }
      `}</style>
      
      {/* SECTION 1: REGISTER NEW CUSTOMER WITH DEBT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-secondary" />
          <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Register New Customer Debt</h3>
        </div>

        <form onSubmit={handleRegisterNewCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* Customer info */}
          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Customer Full Name</label>
              <input
                type="text"
                placeholder="e.g., John Doe"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Phone Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g., 0712345678"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Cart assembler */}
          <div className="border border-slate-200/60 p-4 rounded-xl space-y-3 bg-slate-50/20">
            <span className="text-xs font-bold text-slate-500 block uppercase tracking-wide flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
              <span>Assemble Cart Items</span>
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full sm:flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
              >
                <option value="">Select Item</option>
                {items?.map((item) => (
                  <option key={item.id} value={item.id}>{item.item_name} ({item.retail_price} KES)</option>
                ))}
              </select>
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-center font-bold"
                />
                <button 
                  type="button" 
                  onClick={handleAddToCart} 
                  className="flex-1 sm:flex-none px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3 text-secondary" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="mt-2.5 space-y-1.5 divide-y divide-slate-100 max-h-24 overflow-y-auto custom-scrollbar pr-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-inner">
                {cart.map((cartItem, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-1.5 text-slate-600 font-semibold">
                    <span className="truncate pr-2">{cartItem.item_name} <span className="text-slate-400 text-[10px] font-bold">x{cartItem.quantity}</span></span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span>{(parseFloat(cartItem.retail_price) * cartItem.quantity).toFixed(2)} KES</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-slate-400 hover:text-accent p-0.5 rounded-md hover:bg-slate-50 transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing sum & submit */}
          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Amount Paid Upfront</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={upfrontPayment}
                onChange={(e) => setUpfrontPayment(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
            {cart.length > 0 && (
              <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl text-xs text-secondary-dark flex justify-between font-bold shadow-inner">
                <span>Total: {totalCartValue.toFixed(2)} KES</span>
                <span>Net Debt: {netDebt.toFixed(2)} KES</span>
              </div>
            )}
            <button 
              type="submit" 
              disabled={cart.length === 0}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs sm:text-sm font-bold transition duration-150 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span>Open Ledger Record</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: ACTIVE DEBTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Active Outstanding Debts</h3>
            <p className="text-xs text-slate-500 font-medium">Unresolved profiles with unpaid debt balances</p>
          </div>
          <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[700px] w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200/60">
              <tr>
                <th className="py-3.5 px-6">Customer Name</th>
                <th className="py-3.5 px-6 text-right">Total Debt</th>
                <th className="py-3.5 px-6 text-right">Repayed So Far</th>
                <th className="py-3.5 px-6 text-right">Remaining Balance</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {activeDebtors.map((name) => {
                const summary = getCustomerSummaryData(transactionRows, name);
                return (
                  <tr 
                    key={name} 
                    className="hover:bg-slate-50/50 transition cursor-pointer" 
                    onClick={() => openActionModal('sheet', name)}
                  >
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-primary text-sm sm:text-base leading-tight">{name}</div>
                      <div className="text-xs text-slate-400 font-bold mt-0.5">{summary.phone || 'No phone verified'}</div>
                    </td>
                    <td className="py-4 px-6 text-right text-slate-800 font-semibold">{summary.totalDebt.toFixed(2)} KES</td>
                    <td className="py-4 px-6 text-right text-secondary font-bold">{summary.totalRepayed.toFixed(2)} KES</td>
                    <td className="py-4 px-6 text-right">
                      <span className="font-extrabold px-2.5 py-1 rounded-lg text-xs text-accent bg-accent/5 border border-accent/10">
                        {summary.remainingDebt.toFixed(2)} KES
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === name ? null : name)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer mx-auto"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      
                      {activeDropdown === name && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setActiveDropdown(null)}></div>
                          <div className="absolute right-6 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30 text-left animate-in fade-in slide-in-from-top-2 duration-100">
                            <button 
                              onClick={() => openActionModal('debt', name)} 
                              className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-bold cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 text-primary" />
                              <span>Add New Debt</span>
                            </button>
                            <button 
                              onClick={() => openActionModal('repayment', name)} 
                              className="w-full px-4 py-2.5 text-xs text-secondary-dark hover:bg-secondary/5 flex items-center gap-2 font-bold border-t border-slate-50 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                              <span>Record Payment</span>
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeDebtors.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No active outstanding debts found in registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: CLOSED DEBTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-500 tracking-tight">Closed Ledger Records</h3>
            <p className="text-xs text-slate-400 font-medium">Fully cleared debt logs locked for audit history</p>
          </div>
          <div className="p-2 bg-slate-100 text-slate-400 rounded-xl">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[700px] w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200/60">
              <tr>
                <th className="py-3.5 px-6">Customer Name</th>
                <th className="py-3.5 px-6 text-right">Total Owed Historically</th>
                <th className="py-3.5 px-6 text-right">Fully Repayed</th>
                <th className="py-3.5 px-6 text-right">Balance Status</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {closedDebtors.map((name) => {
                const summary = getCustomerSummaryData(transactionRows, name);
                return (
                  <tr 
                    key={name} 
                    className="hover:bg-slate-50/30 transition cursor-pointer" 
                    onClick={() => openActionModal('sheet', name)}
                  >
                    <td className="py-4 px-6 text-slate-500">
                      <div className="font-extrabold text-slate-600 text-sm sm:text-base leading-tight">{name}</div>
                      <div className="text-xs text-slate-400 font-bold mt-0.5">{summary.phone || '—'}</div>
                    </td>
                    <td className="py-4 px-6 text-right">{summary.totalDebt.toFixed(2)} KES</td>
                    <td className="py-4 px-6 text-right text-secondary/80 font-bold">{summary.totalRepayed.toFixed(2)} KES</td>
                    <td className="py-4 px-6 text-right">
                      <span className="font-bold px-2.5 py-1 rounded-lg text-xs text-secondary bg-secondary/5 border border-secondary/10">
                        Cleared
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openActionModal('debt', name)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition border border-slate-200/60 cursor-pointer"
                      >
                        Reopen Debt
                      </button>
                    </td>
                  </tr>
                );
              })}
              {closedDebtors.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No closed records in the archive.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL OVERLAYS */}
      {activeModal && (
        <div 
          onClick={closeModal}
          className="ledger-print-area fixed inset-0 bg-primary/45 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="ledger-print-card bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-zoom-in"
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-primary tracking-tight">{modalCustomer}'s Sheet</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] bg-primary/5 text-primary/80 font-bold px-2 py-0.5 rounded-full border border-primary/10">
                    Record History Ledger
                  </span>
                  {customerPhone && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                      {customerPhone}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="ledger-screen-only text-slate-400 hover:text-slate-650 text-xl font-bold p-1 hover:bg-slate-100 rounded-full h-8 w-8 flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 custom-scrollbar">
              
              {/* VIEW TIMELINE SHEET */}
              {activeModal === 'sheet' && (() => {
                const summary = getCustomerSummaryData(transactionRows, modalCustomer);
                
                // Filter the timeline based on state txFilter
                const filteredTimeline = summary.timeline.filter(item => {
                  if (txFilter === 'debt') return item.displayType === 'debt';
                  if (txFilter === 'repayment') return item.displayType === 'repayment';
                  return true;
                });

                return (
                  <div className="space-y-5 sm:space-y-6">
                    {/* Customer Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* Total Debt Assigned */}
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition duration-155 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300 text-primary">
                          <TrendingUp className="h-10 w-10" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Total Credit Assigned</span>
                        <div className="mt-2">
                          <span className="text-lg sm:text-xl font-black text-primary block leading-none">
                            KES {summary.totalDebt.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Total Repayments */}
                      <div className="bg-gradient-to-br from-emerald-50/40 to-emerald-50 border border-emerald-100/80 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition duration-155 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300 text-secondary">
                          <Wallet className="h-10 w-10" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Repayments</span>
                        <div className="mt-2">
                          <span className="text-lg sm:text-xl font-black text-secondary block leading-none">
                            KES {summary.totalRepayed.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Remaining Balance */}
                      <div className="bg-gradient-to-br from-rose-50/50 to-rose-50 border border-rose-100/80 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition duration-155 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:scale-110 transition duration-300 text-accent">
                          <AlertTriangle className="h-10 w-10" />
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Remaining Balance</span>
                        <div className="mt-2">
                          <span className="text-lg sm:text-xl font-black text-accent block leading-none">
                            KES {summary.remainingDebt.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statement Ledger</span>
                      </div>
                      
                      {/* Filter tabs */}
                      <div className="flex bg-slate-105/80 p-0.5 rounded-lg border border-slate-200/60 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setTxFilter('all')}
                          className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition cursor-pointer ${
                            txFilter === 'all'
                              ? 'bg-white text-primary shadow-xs border border-slate-200/30'
                              : 'text-slate-500 hover:text-primary'
                          }`}
                        >
                          All ({summary.timeline.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxFilter('debt')}
                          className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition cursor-pointer ${
                            txFilter === 'debt'
                              ? 'bg-white text-rose-600 shadow-xs border border-slate-200/30'
                              : 'text-slate-500 hover:text-rose-600'
                          }`}
                        >
                          Debts ({summary.timeline.filter(t => t.displayType === 'debt').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxFilter('repayment')}
                          className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition cursor-pointer ${
                            txFilter === 'repayment'
                              ? 'bg-white text-emerald-600 shadow-xs border border-slate-200/30'
                              : 'text-slate-500 hover:text-emerald-600'
                          }`}
                        >
                          Payments ({summary.timeline.filter(t => t.displayType === 'repayment').length})
                        </button>
                      </div>
                    </div>

                    {/* Breakdown section */}
                    {filteredTimeline.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <Info className="h-6 w-6 text-slate-350 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-400 font-bold">No matching transaction history records.</p>
                        {txFilter !== 'all' && (
                          <button
                            onClick={() => setTxFilter('all')}
                            className="mt-2 text-xs text-primary font-extrabold hover:underline flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden sm:block overflow-hidden border border-slate-150 rounded-xl bg-white shadow-xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/70 border-b border-slate-200/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Description</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-4">Operator</th>
                                <th className="py-3 px-4 text-right">Amount</th>
                                <th className="py-3 px-4 text-right">Bal. Owed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                              {filteredTimeline.map((line) => {
                                const isDebt = line.displayType === 'debt';
                                return (
                                  <tr key={line.id} className="hover:bg-slate-50/40 transition">
                                    <td className="py-3 px-4 text-slate-450 font-semibold">
                                      {new Date(line.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </td>
                                    <td className="py-3 px-4 max-w-[200px] truncate">
                                      <div className="font-bold text-slate-800">{line.notes || (isDebt ? 'Debt Assigned' : 'Repayment')}</div>
                                      {isDebt && line.item_name && (
                                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">Purchased: {line.item_name}</div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                        isDebt 
                                          ? 'bg-rose-50 border-rose-100 text-rose-700' 
                                          : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      }`}>
                                        {isDebt ? (
                                          <>
                                            <ArrowUpRight className="h-2.5 w-2.5" />
                                            <span>Debt</span>
                                          </>
                                        ) : (
                                          <>
                                            <ArrowDownRight className="h-2.5 w-2.5" />
                                            <span>Payment</span>
                                          </>
                                        )}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-slate-450 font-semibold">
                                      {resolvedOperators[line.recorded_by] || '—'}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-bold text-sm ${isDebt ? 'text-slate-800' : 'text-emerald-600'}`}>
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

                        {/* MOBILE TIMELINE VIEW */}
                        <div className="block sm:hidden relative pl-4 border-l border-slate-200/80 space-y-4 ml-2 mr-1">
                          {filteredTimeline.map((line) => {
                            const isDebt = line.displayType === 'debt';
                            return (
                              <div key={line.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[24px] top-1.5 h-4.5 w-4.5 rounded-full flex items-center justify-center border shadow-xs ${
                                  isDebt 
                                    ? 'bg-rose-50 border-rose-200 text-rose-600' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                }`}>
                                  {isDebt ? (
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                  ) : (
                                    <ArrowDownRight className="h-2.5 w-2.5" />
                                  )}
                                </div>

                                {/* Timeline Content Card */}
                                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/40 hover:bg-slate-50/90 transition duration-150">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-bold block">
                                        {new Date(line.created_at).toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                                        {line.notes || (isDebt ? 'Debt Assigned' : 'Repayment entry')}
                                      </span>
                                      {isDebt && line.item_name && (
                                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                          Item: {line.item_name}
                                        </span>
                                      )}
                                      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                        <span className="bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/20">
                                          By: {resolvedOperators[line.recorded_by] || 'System'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-sm font-black block ${
                                        isDebt ? 'text-slate-800' : 'text-secondary-dark'
                                      }`}>
                                        {isDebt ? `KES ${parseFloat(line.net_debt_amount).toFixed(2)}` : `- KES ${Math.abs(parseFloat(line.net_debt_amount)).toFixed(2)}`}
                                      </span>
                                      {isDebt && (
                                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                                          Bal: KES {line.remainingBalance.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ADD DEBT FORM */}
              {activeModal === 'debt' && (
                <form onSubmit={handleRecordDebt} className="space-y-4">
                  <div className="border border-slate-200/60 p-4 rounded-xl space-y-3 bg-slate-50/20">
                    <span className="text-xs font-bold text-slate-500 block uppercase tracking-wide flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4 text-slate-400" />
                      <span>Assemble Cart Items</span>
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full sm:flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      >
                        <option value="">Select Item</option>
                        {items?.map((item) => (
                          <option key={item.id} value={item.id}>{item.item_name} ({item.retail_price} KES)</option>
                        ))}
                      </select>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <input
                           type="number"
                           min="1"
                           value={quantity}
                           onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                           className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-center font-bold"
                        />
                        <button 
                          type="button" 
                          onClick={handleAddToCart} 
                          className="flex-1 sm:flex-none px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-secondary" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>

                    {cart.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 divide-y divide-slate-100 max-h-28 overflow-y-auto pr-1 bg-white p-2.5 rounded-lg border border-slate-200">
                        {cart.map((cartItem, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs py-1.5 text-slate-600 font-semibold">
                            <span className="truncate pr-2">{cartItem.item_name} <span className="text-slate-400 text-[10px] font-bold">x{cartItem.quantity}</span></span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span>{(parseFloat(cartItem.retail_price) * cartItem.quantity).toFixed(2)} KES</span>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveFromCart(idx)}
                                className="text-slate-400 hover:text-accent p-0.5 rounded-md hover:bg-slate-50 transition cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount Paid Upfront</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={upfrontPayment}
                      onChange={(e) => setUpfrontPayment(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    />
                  </div>

                  {cart.length > 0 && (
                    <div className="p-3 bg-secondary/5 border border-secondary/15 rounded-xl text-xs text-secondary-dark flex justify-between font-bold shadow-inner">
                      <span>Total Value: {totalCartValue.toFixed(2)} KES</span>
                      <span>Net Debt Balance: {netDebt.toFixed(2)} KES</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Custom Transaction Notes (Optional)</label>
                    <textarea
                      placeholder="Type any specific notes for this credit invoice..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition h-20 resize-none"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={cart.length === 0} 
                    className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition duration-150 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Credit Assignment</span>
                  </button>
                </form>
              )}

              {/* RECORD REPAYMENT FORM */}
              {activeModal === 'repayment' && (
                <form onSubmit={handleRecordRepayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1 flex items-center gap-1">
                      <Info className="h-4 w-4 text-secondary" />
                      <span>Max Allowed Repayment:</span>
                      <strong className="text-primary">{getCustomerSummaryData(transactionRows, modalCustomer).remainingDebt.toFixed(2)} KES</strong>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getCustomerSummaryData(transactionRows, modalCustomer).remainingDebt}
                      placeholder="Enter repayment cash amount received"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Log Notes (Optional)</label>
                    <textarea
                      placeholder="Type details of this receipt payment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-20 resize-none"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="w-full py-2.5 bg-secondary hover:bg-secondary-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Apply Payment Record</span>
                  </button>
                </form>
              )}
              
              {/* Action Button Strip */}
              {activeModal === 'sheet' && (
                <div className="ledger-screen-only flex flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleExportCSV(modalCustomer, getCustomerSummaryData(transactionRows, modalCustomer).timeline)}
                    className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-secondary" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-primary border border-slate-200/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-secondary" />
                    <span>Print PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {printInvoiceData && (
        <div className="ledger-invoice-print-root fixed inset-0 z-60 bg-white p-0">
          <div className="ledger-invoice-print-shell">
            <CustomerInvoicePrint invoiceData={printInvoiceData} />
          </div>
        </div>
      )}
      
    </div>
  );
}