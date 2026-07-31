import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';
import { useToast } from '../../context/ToastContext';
import SupplierInvoicePrint from './pdfTemplates/SupplierInvoicePrint';
import { useOperators } from './operatorResolver';
import { 
  Users, 
  FileText, 
  Plus, 
  CheckCircle2, 
  ChevronDown, 
  X, 
  Info, 
  ClipboardList,
  CreditCard,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Download,
  Printer,
  Package,
  Trash2
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

export function SupplierLedger() {
  const toast = useToast();
  const { data: transactions } = useQuery(`
    SELECT * FROM supplier_ledgers 
    ORDER BY created_at ASC
  `);

  // Active user action states
  const [activeModal, setActiveModal] = useState(null); // 'sheet', 'debt', or 'repayment'
  const [modalSupplier, setModalSupplier] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [txFilter, setTxFilter] = useState('all'); // 'all', 'debt', 'repayment'
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // New Supplier Form States
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Form states
  const [supplierPhone, setSupplierPhone] = useState('');
  const [totalInvoiceValue, setTotalInvoiceValue] = useState('');
  const [upfrontPayment, setUpfrontPayment] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'mpesa'

  // Line-item state (pure UI — no DB columns added)
  const [invoiceItems, setInvoiceItems] = useState([]);

  const netDebt = (parseFloat(totalInvoiceValue) || 0) - (parseFloat(upfrontPayment) || 0);

  // ── Line-item helpers ──────────────────────────────────────────────────────
  const newBlankItem = () => ({ id: crypto.randomUUID(), name: '', qty: '', unitPrice: '' });

  const addInvoiceItem = () => setInvoiceItems(prev => [...prev, newBlankItem()]);

  const removeInvoiceItem = (id) => setInvoiceItems(prev => prev.filter(i => i.id !== id));

  const updateInvoiceItem = (id, field, value) =>
    setInvoiceItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const calcItemsTotal = (items) =>
    items.reduce((sum, i) => {
      const q = parseFloat(i.qty) || 0;
      const p = parseFloat(i.unitPrice) || 0;
      return sum + q * p;
    }, 0);

  const buildAutoNotes = (items) => {
    const filled = items.filter(i => i.name.trim());
    if (!filled.length) return '';
    const lines = filled.map(i => {
      const q = parseFloat(i.qty) || 1;
      const p = parseFloat(i.unitPrice) || 0;
      return `• ${i.name.trim()} × ${q} @ KES ${p.toFixed(2)} = KES ${(q * p).toFixed(2)}`;
    });
    const total = calcItemsTotal(filled);
    return [...lines, '─────────────────────', `Items Total: KES ${total.toFixed(2)}`].join('\n');
  };

  // Auto-update total and notes whenever line items change
  useEffect(() => {
    if (!invoiceItems.length) return;
    const total = calcItemsTotal(invoiceItems);
    if (total > 0) setTotalInvoiceValue(total.toFixed(2));
    setNotes(prev => {
      const autoBlock = buildAutoNotes(invoiceItems);
      // Find where user's free-form text begins (after the auto block separator)
      const splitMarker = '─────────────────────';
      const splitIdx = prev.lastIndexOf(splitMarker);
      const userExtra = splitIdx !== -1
        ? prev.slice(splitIdx + splitMarker.length).replace(/^\nItems Total:[^\n]*\n?/, '')
        : (prev.startsWith('•') ? '' : prev);
      return autoBlock + (userExtra.trim() ? '\n' + userExtra.trim() : '');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceItems]);

  // Memoize to prevent new array ref every render (which causes infinite loop in useOperators)
  const allRecordedByIds = useMemo(
    () => [...new Set((transactions || [])
      .filter(t => t.supplier_name === modalSupplier)
      .map(t => t.recorded_by)
      .filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(transactions || []).filter(t => t.supplier_name === modalSupplier).map(t => t.recorded_by).join(','), modalSupplier]
  );
  const resolvedOperators = useOperators(allRecordedByIds);

  // Process data for a supplier using the FIFO waterfall logic
  const getSupplierSummaryData = (name) => {
    const supplierTx = (transactions || []).filter(t => t.supplier_name === name);
    
    const debts = supplierTx.filter(t => t.transaction_type === 'debt').map(d => ({ ...d, remaining: parseFloat(d.net_debt_amount) }));
    const repayments = supplierTx.filter(t => t.transaction_type === 'repayment');
    const paidOnDelivery = supplierTx.filter(t => t.transaction_type === 'paid_on_delivery');

    const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.net_debt_amount), 0);
    const totalRepayed = repayments.reduce((sum, r) => sum + Math.abs(parseFloat(r.net_debt_amount)), 0);
    const remainingDebt = Math.max(0, totalDebt - totalRepayed);

    let repaymentPool = totalRepayed;
    const processedDebts = debts.map(debt => {
      let remaining = debt.remaining;
      if (repaymentPool > 0) {
        if (repaymentPool >= remaining) {
          repaymentPool -= remaining;
          remaining = 0;
        } else {
          remaining -= repaymentPool;
          repaymentPool = 0;
        }
      }
      return { ...debt, remainingBalance: remaining, isCleared: remaining === 0 };
    });

    const historyTimeline = [
      ...processedDebts.map(d => ({ ...d, displayType: 'debt' })),
      ...repayments.map(r => ({ ...r, displayType: 'repayment' })),
      ...paidOnDelivery.map(p => ({ ...p, displayType: 'paid_on_delivery', remainingBalance: 0, isCleared: true }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { totalDebt, totalRepayed, remainingDebt, timeline: historyTimeline, phone: supplierTx[0]?.supplier_phone || '' };
  };

  // Unique list of suppliers
  const uniqueSuppliers = [...new Set((transactions || []).map(t => t.supplier_name))];

  const activeSuppliers = uniqueSuppliers.filter(name => getSupplierSummaryData(name).remainingDebt > 0);
  const closedSuppliers = uniqueSuppliers.filter(name => getSupplierSummaryData(name).remainingDebt === 0);

  // Add completely new supplier record
  const handleRegisterNewSupplier = async (e) => {
    e.preventDefault();
    const invoiceVal = parseFloat(totalInvoiceValue) || 0;
    const upfrontVal = parseFloat(upfrontPayment) || 0;
    const initialNetDebt = invoiceVal - upfrontVal;

    if (!newSupplierName.trim() || invoiceVal <= 0) {
      toast.error('Validation Error', 'Invoice amount must be greater than zero.');
      return;
    }

    if (initialNetDebt < 0) {
      toast.error('Validation Error', 'Upfront payment cannot exceed total invoice value.');
      return;
    }

    const txType = initialNetDebt === 0 ? 'paid_on_delivery' : 'debt';

    try {
      const { data: { session } } = await supabase.auth.getSession();

      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          payment_method, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newSupplierName.trim(),
          newSupplierPhone.trim() || null,
          invoiceVal.toFixed(2),
          upfrontVal.toFixed(2),
          initialNetDebt.toFixed(2),
          txType,
          upfrontVal > 0 ? paymentMethod : null,
          notes.trim() || (txType === 'paid_on_delivery' ? 'First Cash Delivery.' : 'First Supply Invoice.'),
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );

      toast.success('Supplier Recorded', `Invoice registered for ${newSupplierName.trim()}.`);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setTotalInvoiceValue('');
      setUpfrontPayment('');
      setNotes('');
      setPaymentMethod('cash');
      setInvoiceItems([]);
    } catch (err) {
      console.error('Failed to create new supplier record:', err);
      toast.error('Operation Failed', 'Could not save supplier invoice to local DB.');
    }
  };

  const handleRecordDebt = async (e) => {
    e.preventDefault();
    const invoiceVal = parseFloat(totalInvoiceValue) || 0;
    const upfrontVal = parseFloat(upfrontPayment) || 0;
    const currentNetDebt = invoiceVal - upfrontVal;

    if (!modalSupplier || invoiceVal <= 0) {
      toast.error('Validation Error', 'Invoice amount must be greater than zero.');
      return;
    }

    if (currentNetDebt < 0) {
      toast.error('Validation Error', 'Upfront payment cannot exceed total invoice value.');
      return;
    }

    const txType = currentNetDebt === 0 ? 'paid_on_delivery' : 'debt';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          payment_method, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalSupplier,
          supplierPhone || null,
          invoiceVal.toFixed(2),
          upfrontVal.toFixed(2),
          currentNetDebt.toFixed(2),
          txType,
          upfrontVal > 0 ? paymentMethod : null,
          notes.trim() || (txType === 'paid_on_delivery' ? 'Cash delivery purchase.' : 'Stock purchase invoice.'),
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      if (txType === 'paid_on_delivery') {
        toast.success('Cash Purchase Recorded', `Recorded KES ${invoiceVal.toFixed(2)} cash delivery for ${modalSupplier}.`);
      } else {
        toast.success('Invoice Added', `Recorded KES ${currentNetDebt.toFixed(2)} debt for ${modalSupplier}.`);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record invoice.');
    }
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    const payment = parseFloat(repaymentAmount);
    const summary = getSupplierSummaryData(modalSupplier);

    if (payment > summary.remainingDebt) {
      toast.error('Validation Error', `Payment exceeds outstanding supplier debt of ${summary.remainingDebt.toFixed(2)} KES!`);
      return;
    }

    if (!modalSupplier || isNaN(payment) || payment <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          payment_method, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalSupplier,
          supplierPhone || null,
          '0.00',
          payment.toFixed(2),
          (-payment).toFixed(2),
          'repayment',
          paymentMethod,
          notes.trim() || `Supplier repayment.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      toast.success('Supplier Paid', `Recorded KES ${payment.toFixed(2)} payment to ${modalSupplier}.`);
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record payment.');
    }
  };

  const handleExportCSV = (supplierName, timeline) => {
    const headers = ['Date', 'Type', 'Amount (KES)', 'Notes'];
    
    const rows = (timeline || []).map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.transaction_type.toUpperCase(),
      t.net_debt_amount,
      t.notes || ''
    ]);
    
    exportToCSV(`${supplierName.replace(/\s+/g, '_')}_Statement`, headers, rows);
    toast.success('Export Successful', `Ledger CSV downloaded for ${supplierName}.`);
  };

  const handlePrintPDF = () => {
    if (!modalSupplier) return;

    const summary = getSupplierSummaryData(modalSupplier);
    const invoiceLines = summary.timeline;

    setPrintInvoiceData({
      summary,
      timeline: invoiceLines,
      supplierName: modalSupplier,
      customerPhone: supplierPhone,
      invoiceNumber: `INV-SUP-${String(modalSupplier || '000').replace(/\s+/g, '').slice(0, 6).toUpperCase()}-${String(invoiceLines.length).padStart(3, '0')}`,
      invoiceDate: new Date().toLocaleDateString(),
      businessName: 'DukaLedger',
      businessTagline: 'Supplier credit statement',
      operators: resolvedOperators,
      footerNote: 'Please keep this invoice statement for your auditing records.'
    });
  };

  useEffect(() => {
    if (!printInvoiceData) return;

    const originalTitle = document.title;
    const cleanName = printInvoiceData.supplierName.replace(/\s+/g, '_');
    document.title = `Supplier_Statement_${cleanName}_${new Date().toISOString().split('T')[0]}`;

    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = originalTitle;
        setPrintInvoiceData(null);
      }, 250);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [printInvoiceData]);

  const closeModal = () => {
    setActiveModal(null);
    setModalSupplier('');
    setTotalInvoiceValue('');
    setUpfrontPayment('');
    setRepaymentAmount('');
    setNotes('');
    setPaymentMethod('cash');
    setInvoiceItems([]);
    setTxFilter('all');
  };

  const openActionModal = (type, name) => {
    const data = getSupplierSummaryData(name);
    setModalSupplier(name);
    setSupplierPhone(data.phone);
    setActiveModal(type);
    setActiveDropdown(null);
  };

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

          .ledger-invoice-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white;
            z-index: 99999;
            padding: 0px !important;
            margin: 0px !important;
          }

          .ledger-screen-only {
            display: none !important;
          }

          .ledger-invoice-print-shell {
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
      
      {/* SECTION 1: REGISTER NEW SUPPLIER DEBT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-secondary" />
          <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Record New Supplier Invoice</h3>
        </div>

        <form onSubmit={handleRegisterNewSupplier} className="space-y-5">

          {/* Row 1: Name + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Supplier / Wholesaler Name</label>
              <input
                type="text"
                placeholder="e.g., Kazi Distributors"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Phone Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g., 0722334455"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Row 2: Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Package className="h-3 w-3" />
                Invoice Items
              </label>
              <button
                type="button"
                onClick={addInvoiceItem}
                className="text-[10px] font-bold text-primary hover:text-primary-dark flex items-center gap-0.5 px-2 py-1 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/10 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add Item
              </button>
            </div>

            {invoiceItems.length > 0 && (
              <div className="space-y-2 mb-2">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_100px_80px_28px] gap-2 px-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Item Name</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Qty</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Unit Price</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase text-right">Total</span>
                  <span></span>
                </div>
                {invoiceItems.map((item) => {
                  const rowTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_100px_80px_28px] gap-2 items-center">
                      <input
                        type="text"
                        placeholder="e.g., Sugar 2kg"
                        value={item.name}
                        onChange={(e) => updateInvoiceItem(item.id, 'name', e.target.value)}
                        className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="1"
                        value={item.qty}
                        onChange={(e) => updateInvoiceItem(item.id, 'qty', e.target.value)}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                      />
                      <div className="relative">
                        <span className="absolute inset-y-0 left-2 flex items-center text-slate-400 text-[10px] font-bold pointer-events-none">KES</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitPrice}
                          onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', e.target.value)}
                          className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 text-right tabular-nums">
                        {rowTotal > 0 ? rowTotal.toFixed(0) : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeInvoiceItem(item.id)}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {invoiceItems.length === 0 && (
              <button
                type="button"
                onClick={addInvoiceItem}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Click to add invoice items — or enter a lump total below
              </button>
            )}
          </div>

          {/* Row 3: Total Invoice + Amount Paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">
                Total Invoice Value
                {invoiceItems.length > 0 && <span className="ml-1 text-primary/60 font-normal">(auto-calculated · read-only)</span>}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={totalInvoiceValue}
                  onChange={(e) => setTotalInvoiceValue(e.target.value)}
                  readOnly={invoiceItems.length > 0}
                  className={`w-full pl-11 pr-4 py-2.5 border rounded-xl text-sm font-semibold text-primary focus:outline-none transition ${
                    invoiceItems.length > 0
                      ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                      : 'border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent'
                  }`}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Amount Paid Upfront</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={upfrontPayment}
                  onChange={(e) => setUpfrontPayment(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
              {parseFloat(upfrontPayment) > 0 && (
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => setPaymentMethod('cash')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}>💵 Cash</button>
                  <button type="button" onClick={() => setPaymentMethod('mpesa')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                      paymentMethod === 'mpesa'
                        ? 'bg-secondary text-white border-secondary shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}>📱 M-Pesa</button>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Notes (auto-generated + free-form merged) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Invoice Notes</label>
            <textarea
              placeholder={invoiceItems.length > 0 ? 'Items listed above — add any extra notes here...' : 'Type specific details of supply purchase...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition resize-none leading-relaxed"
              rows={invoiceItems.length > 0 ? Math.max(4, invoiceItems.length + 3) : 2}
            />
          </div>

          {/* Summary strip + Submit */}
          {parseFloat(totalInvoiceValue) > 0 && (
            <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl text-xs text-secondary-dark flex justify-between font-bold shadow-inner">
              <span>Invoice: {parseFloat(totalInvoiceValue).toFixed(2)} KES</span>
              <span>{netDebt === 0 ? 'Paid in Full (Cash) ✓' : `Owed: ${netDebt.toFixed(2)} KES`}</span>
            </div>
          )}
          <button 
            type="submit" 
            className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4 text-secondary" />
            <span>Log Supplier Record</span>
          </button>
        </form>
      </div>

      {/* SECTION 2: ACTIVE SUPPLIER DEBTS */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Active Supplier Balances</h3>
            <p className="text-xs text-slate-500 font-medium">Unresolved supplier invoices awaiting clearing</p>
          </div>
          <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200/60">
              <tr>
                <th className="py-3.5 px-6">Supplier / Wholesaler</th>
                <th className="py-3.5 px-6 text-right">Total Owed Historically</th>
                <th className="py-3.5 px-6 text-right">Repayed So Far</th>
                <th className="py-3.5 px-6 text-right">Remaining Balance</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {activeSuppliers.map((name) => {
                const summary = getSupplierSummaryData(name);
                return (
                  <tr 
                    key={name} 
                    className="hover:bg-slate-50/50 transition cursor-pointer" 
                    onClick={() => openActionModal('sheet', name)}
                  >
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-primary text-sm sm:text-base leading-tight">{name}</div>
                      <div className="text-xs text-slate-400 font-bold mt-0.5">{summary.phone || 'No phone registered'}</div>
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
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer mx-auto"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      
                      {activeDropdown === name && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setActiveDropdown(null)}></div>
                          <div className="absolute right-6 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30 text-left animate-in fade-in slide-in-from-top-2 duration-100">
                            <button 
                              onClick={() => openActionModal('debt', name)} 
                              className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-bold cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 text-primary" />
                              <span>New Invoice</span>
                            </button>
                            <button 
                              onClick={() => openActionModal('repayment', name)} 
                              className="w-full px-4 py-2.5 text-xs text-secondary-dark hover:bg-secondary/5 flex items-center gap-2 font-bold border-t border-slate-50 cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5 text-secondary" />
                              <span>Pay Supplier</span>
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No active supplier balances.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: CLOSED SUPPLIER RECORDS */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-500 tracking-tight">Fully Cleared Suppliers</h3>
            <p className="text-xs text-slate-400 font-medium">Wholesaler ledgers closed and fully audited</p>
          </div>
          <div className="p-2 bg-slate-100 text-slate-400 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-secondary" />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 min-w-[700px]">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200/60">
              <tr>
                <th className="py-3.5 px-6">Supplier Name</th>
                <th className="py-3.5 px-6 text-right">Total Invoiced Historically</th>
                <th className="py-3.5 px-6 text-right">Fully Paid</th>
                <th className="py-3.5 px-6 text-right">Balance Status</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {closedSuppliers.map((name) => {
                const summary = getSupplierSummaryData(name);
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
                        Paid Off
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openActionModal('debt', name)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition border border-slate-200/60 cursor-pointer"
                      >
                        New Purchase
                      </button>
                    </td>
                  </tr>
                );
              })}
              {closedSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No archived supplier profiles.
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
          className="fixed inset-0 bg-primary/45 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-zoom-in"
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-primary tracking-tight">{modalSupplier}'s Sheet</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] bg-primary/5 text-primary/80 font-bold px-2 py-0.5 rounded-full border border-primary/10">
                    Record History Log
                  </span>
                  {supplierPhone && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                      {supplierPhone}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="text-slate-400 hover:text-slate-650 text-xl font-bold p-1 hover:bg-slate-100 rounded-full h-8 w-8 flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 custom-scrollbar">
              
              {/* TIMELINE VIEW */}
              {activeModal === 'sheet' && (() => {
                const summary = getSupplierSummaryData(modalSupplier);
                
                // Filter the timeline based on state txFilter
                const filteredTimeline = summary.timeline.filter(item => {
                  if (txFilter === 'debt') return item.displayType === 'debt';
                  if (txFilter === 'repayment') return item.displayType === 'repayment';
                  return true;
                });

                return (
                  <div className="space-y-5 sm:space-y-6">
                    {/* Supplier Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* Total Invoices Assigned */}
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition duration-155 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300 text-primary">
                          <TrendingUp className="h-10 w-10" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Accumulated Invoices</span>
                        <div className="mt-2">
                          <span className="text-lg sm:text-xl font-black text-primary block leading-none">
                            KES {summary.totalDebt.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Total Payouts */}
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

                      {/* Outstanding Balance */}
                      <div className="bg-gradient-to-br from-rose-50/50 to-rose-50 border border-rose-100/80 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition duration-155 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:scale-110 transition duration-300 text-accent">
                          <AlertTriangle className="h-10 w-10" />
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Outstanding Balance</span>
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
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Ledger Statement</span>
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
                          Invoices ({summary.timeline.filter(t => t.displayType === 'debt').length})
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
                                const isPOD = line.displayType === 'paid_on_delivery';
                                return (
                                  <tr key={line.id} className="hover:bg-slate-50/40 transition">
                                    <td className="py-3 px-4 text-slate-455 font-semibold">
                                      {new Date(line.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </td>
                                    <td className="py-3 px-4 max-w-[250px] truncate">
                                      <div className="font-bold text-slate-850">{line.notes || (isDebt ? 'Supply Credit' : isPOD ? 'Paid on Delivery' : 'Payment')}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                        isDebt 
                                          ? 'bg-rose-50 border-rose-100 text-rose-700' 
                                          : isPOD
                                            ? 'bg-blue-50 border-blue-100 text-blue-700'
                                            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      }`}>
                                        {isDebt ? (
                                          <>
                                            <ArrowUpRight className="h-2.5 w-2.5" />
                                            <span>Invoice</span>
                                          </>
                                        ) : isPOD ? (
                                          <>
                                            <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />
                                            <span>POD</span>
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
                                    <td className={`py-3 px-4 text-right font-bold text-sm ${isDebt ? 'text-slate-800' : isPOD ? 'text-blue-600' : 'text-emerald-600'}`}>
                                      {isPOD 
                                        ? `KES ${parseFloat(line.total_invoice_value).toFixed(2)}`
                                        : isDebt 
                                          ? `KES ${parseFloat(line.net_debt_amount).toFixed(2)}` 
                                          : `- KES ${Math.abs(parseFloat(line.net_debt_amount)).toFixed(2)}`}
                                    </td>
                                    <td className="py-3 px-4 text-right font-extrabold text-slate-455">
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
                            const isPOD = line.displayType === 'paid_on_delivery';
                            return (
                              <div key={line.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[24px] top-1.5 h-4.5 w-4.5 rounded-full flex items-center justify-center border shadow-xs ${
                                  isDebt 
                                    ? 'bg-rose-50 border-rose-200 text-rose-600' 
                                    : isPOD
                                      ? 'bg-blue-50 border-blue-200 text-blue-600'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                }`}>
                                  {isDebt ? (
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                  ) : isPOD ? (
                                    <CheckCircle2 className="h-2.5 w-2.5" />
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
                                      <span className="text-xs font-bold text-slate-805 mt-0.5 block">
                                        {line.notes || (isDebt ? 'Supply Credit' : isPOD ? 'Paid on Delivery' : 'Payment log')}
                                      </span>
                                      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                        <span className="bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/20">
                                          By: {resolvedOperators[line.recorded_by] || 'System'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-sm font-black block ${
                                        isDebt ? 'text-slate-800' : isPOD ? 'text-blue-600' : 'text-secondary-dark'
                                      }`}>
                                        {isPOD 
                                          ? `KES ${parseFloat(line.total_invoice_value).toFixed(2)}`
                                          : isDebt 
                                            ? `KES ${parseFloat(line.net_debt_amount).toFixed(2)}` 
                                            : `- KES ${Math.abs(parseFloat(line.net_debt_amount)).toFixed(2)}`}
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
                    {/* Action Button Strip */}
                    <div className="ledger-screen-only flex flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleExportCSV(modalSupplier, summary.timeline)}
                        className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="h-4 w-4 text-secondary" />
                        <span>Download CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintPDF}
                        className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-primary border border-slate-200/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-4 w-4 text-secondary" />
                        <span>Print PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* NEW INVOICE DEBT FORM */}
              {activeModal === 'debt' && (
                <form onSubmit={handleRecordDebt} className="space-y-4">

                  {/* Line Items section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Invoice Items
                      </label>
                      <button
                        type="button"
                        onClick={addInvoiceItem}
                        className="text-[10px] font-bold text-primary hover:text-primary-dark flex items-center gap-0.5 px-2 py-1 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/10 transition cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Item
                      </button>
                    </div>

                    {invoiceItems.length > 0 && (
                      <div className="space-y-2 mb-2">
                        <div className="hidden sm:grid grid-cols-[1fr_70px_95px_75px_28px] gap-2 px-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Item Name</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Qty</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Unit Price</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase text-right">Total</span>
                          <span></span>
                        </div>
                        {invoiceItems.map((item) => {
                          const rowTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                          return (
                            <div key={item.id} className="grid grid-cols-[1fr_70px_95px_75px_28px] gap-2 items-center">
                              <input
                                type="text"
                                placeholder="e.g., Sugar 2kg"
                                value={item.name}
                                onChange={(e) => updateInvoiceItem(item.id, 'name', e.target.value)}
                                className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                              />
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="1"
                                value={item.qty}
                                onChange={(e) => updateInvoiceItem(item.id, 'qty', e.target.value)}
                                className="px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                              />
                              <div className="relative">
                                <span className="absolute inset-y-0 left-2 flex items-center text-slate-400 text-[10px] font-bold pointer-events-none">KES</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.unitPrice}
                                  onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', e.target.value)}
                                  className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition"
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-600 text-right tabular-nums">
                                {rowTotal > 0 ? rowTotal.toFixed(0) : '—'}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeInvoiceItem(item.id)}
                                className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {invoiceItems.length === 0 && (
                      <button
                        type="button"
                        onClick={addInvoiceItem}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        Click to add invoice items — or enter a lump total below
                      </button>
                    )}
                  </div>

                  {/* Total Invoice + Upfront */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Total Invoice Value
                        {invoiceItems.length > 0 && <span className="ml-1 text-primary/50 font-normal normal-case">(auto · read-only)</span>}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={totalInvoiceValue}
                          onChange={(e) => setTotalInvoiceValue(e.target.value)}
                          readOnly={invoiceItems.length > 0}
                          className={`w-full pl-11 pr-3 py-2.5 border rounded-xl text-sm font-semibold focus:outline-none transition ${
                            invoiceItems.length > 0
                              ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                              : 'text-primary border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent'
                          }`}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount Paid Upfront</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={upfrontPayment}
                          onChange={(e) => setUpfrontPayment(e.target.value)}
                          className="w-full pl-11 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                        />
                      </div>
                      {parseFloat(upfrontPayment) > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          <button type="button" onClick={() => setPaymentMethod('cash')}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                              paymentMethod === 'cash'
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}>💵 Cash</button>
                          <button type="button" onClick={() => setPaymentMethod('mpesa')}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                              paymentMethod === 'mpesa'
                                ? 'bg-secondary text-white border-secondary shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}>📱 M-Pesa</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {parseFloat(totalInvoiceValue) > 0 && (
                    <div className="p-3 bg-secondary/5 border border-secondary/15 rounded-xl text-xs text-secondary-dark flex justify-between font-bold shadow-inner">
                      <span>Total Invoice: {parseFloat(totalInvoiceValue).toFixed(2)} KES</span>
                      <span>{netDebt === 0 ? 'Paid in Full (Cash) ✓' : `Net Balance Owed: ${netDebt.toFixed(2)} KES`}</span>
                    </div>
                  )}

                  {/* Merged notes box */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Invoice Notes</label>
                    <textarea
                      placeholder={invoiceItems.length > 0 ? 'Items listed above — add any extra notes here...' : 'Type details of supply purchase invoice...'}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition resize-none leading-relaxed"
                      rows={invoiceItems.length > 0 ? Math.max(4, invoiceItems.length + 3) : 3}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={!totalInvoiceValue || parseFloat(totalInvoiceValue) <= 0 || netDebt < 0} 
                    className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition duration-150 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Invoice Credit</span>
                  </button>
                </form>
              )}

              {/* RECORD REPAYMENT FORM */}
              {activeModal === 'repayment' && (
                <form onSubmit={handleRecordRepayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1 flex items-center gap-1">
                      <Info className="h-4 w-4 text-secondary" />
                      <span>Max Allowed Payment:</span>
                      <strong className="text-primary">{getSupplierSummaryData(modalSupplier).remainingDebt.toFixed(2)} KES</strong>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getSupplierSummaryData(modalSupplier).remainingDebt}
                      placeholder="Amount Repayed to Supplier"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                      required
                    />
                    <div className="flex gap-1.5 mt-2">
                      <button type="button" onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                          paymentMethod === 'cash'
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}>💵 Cash</button>
                      <button type="button" onClick={() => setPaymentMethod('mpesa')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                          paymentMethod === 'mpesa'
                            ? 'bg-secondary text-white border-secondary shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}>📱 M-Pesa</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Log Notes (Optional)</label>
                    <textarea
                      placeholder="Type details of supplier payment..."
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
                    <span>Submit Supplier Payment</span>
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {printInvoiceData && (
        <div className="ledger-invoice-print-root fixed inset-0 z-60 bg-white p-0">
          <div className="ledger-invoice-print-shell">
            <SupplierInvoicePrint invoiceData={printInvoiceData} />
          </div>
        </div>
      )}

    </div>
  );
}