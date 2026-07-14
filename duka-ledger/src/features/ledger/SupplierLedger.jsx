import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';

export function SupplierLedger() {
  const { data: transactions } = useQuery(`
    SELECT * FROM supplier_ledgers 
    ORDER BY created_at ASC
  `);

  // Active user action states
  const [activeModal, setActiveModal] = useState(null); // 'sheet', 'debt', or 'repayment'
  const [modalSupplier, setModalSupplier] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);

  // New Supplier Form States
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Form states
  const [supplierPhone, setSupplierPhone] = useState('');
  const [totalInvoiceValue, setTotalInvoiceValue] = useState('');
  const [upfrontPayment, setUpfrontPayment] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [notes, setNotes] = useState('');

  const netDebt = (parseFloat(totalInvoiceValue) || 0) - (parseFloat(upfrontPayment) || 0);

  // Process data for a supplier using the FIFO waterfall logic
  const getSupplierSummaryData = (name) => {
    const supplierTx = (transactions || []).filter(t => t.supplier_name === name);
    
    const debts = supplierTx.filter(t => t.transaction_type === 'debt').map(d => ({ ...d, remaining: parseFloat(d.net_debt_amount) }));
    const repayments = supplierTx.filter(t => t.transaction_type === 'repayment');

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
      ...repayments.map(r => ({ ...r, displayType: 'repayment' }))
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

    if (!newSupplierName.trim() || initialNetDebt <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // FIXED: Exactly 10 columns matching exactly 10 values
      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newSupplierName.trim(),
          newSupplierPhone.trim() || null,
          invoiceVal.toFixed(2),
          upfrontVal.toFixed(2),
          initialNetDebt.toFixed(2),
          'debt',
          notes.trim() || `First Supply Invoice.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );

      setNewSupplierName('');
      setNewSupplierPhone('');
      setTotalInvoiceValue('');
      setUpfrontPayment('');
      setNotes('');
    } catch (err) {
      console.error('Failed to create new supplier record:', err);
    }
  };

  // Database Inserts for existing suppliers
  const handleRecordDebt = async (e) => {
    e.preventDefault();
    const invoiceVal = parseFloat(totalInvoiceValue) || 0;
    const upfrontVal = parseFloat(upfrontPayment) || 0;
    const currentNetDebt = invoiceVal - upfrontVal;

    if (!modalSupplier || currentNetDebt <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // FIXED: Exactly 10 columns matching exactly 10 values
      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalSupplier,
          supplierPhone || null,
          invoiceVal.toFixed(2),
          upfrontVal.toFixed(2),
          currentNetDebt.toFixed(2),
          'debt',
          notes.trim() || `Stock purchase invoice.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    const payment = parseFloat(repaymentAmount);
    const summary = getSupplierSummaryData(modalSupplier);

    if (payment > summary.remainingDebt) {
      alert(`Payment exceeds outstanding supplier debt of ${summary.remainingDebt.toFixed(2)} KES!`);
      return;
    }

    if (!modalSupplier || isNaN(payment) || payment <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // FIXED: Exactly 10 columns matching exactly 10 values
      await db.execute(
        `INSERT INTO supplier_ledgers (
          id, 
          supplier_name, 
          supplier_phone, 
          total_invoice_value, 
          amount_paid_upfront, 
          net_debt_amount, 
          transaction_type, 
          notes, 
          recorded_by, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          modalSupplier,
          supplierPhone || null,
          '0.00',
          payment.toFixed(2),
          (-payment).toFixed(2),
          'repayment',
          notes.trim() || `Supplier repayment.`,
          session?.user?.id || null,
          new Date().toISOString()
        ]
      );
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalSupplier('');
    setTotalInvoiceValue('');
    setUpfrontPayment('');
    setRepaymentAmount('');
    setNotes('');
  };

  const openActionModal = (type, name) => {
    const data = getSupplierSummaryData(name);
    setModalSupplier(name);
    setSupplierPhone(data.phone);
    setActiveModal(type);
    setActiveDropdown(null);
  };

  return (
    <div className="space-y-8 mt-6 pb-12">
      
      {/* SECTION 1: REGISTER NEW SUPPLIER DEBT */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Record New Supplier Invoice</h3>
        <form onSubmit={handleRegisterNewSupplier} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Supplier / Wholesaler Name"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Phone Number (Optional)"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-3">
            <input
              type="number"
              step="0.01"
              placeholder="Total Invoice Value (KES)"
              value={totalInvoiceValue}
              onChange={(e) => setTotalInvoiceValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount Paid Upfront"
              value={upfrontPayment}
              onChange={(e) => setUpfrontPayment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-3">
            <textarea
              placeholder="Invoice Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 h-10 resize-none"
            />
            {netDebt > 0 && (
              <div className="p-2 bg-blue-50 rounded text-xs text-blue-800 flex justify-between font-bold">
                <span>Total Invoice: {parseFloat(totalInvoiceValue).toFixed(2)}</span>
                <span>Net Owed: {netDebt.toFixed(2)} KES</span>
              </div>
            )}
            <button 
              type="submit" 
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition"
            >
              Log Supplier Record
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: ACTIVE SUPPLIER DEBTS */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Active Supplier Balances</h3>
          <p className="text-xs text-gray-500">Unresolved supplier invoices awaiting clearing</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Supplier / Wholesaler</th>
                <th className="py-3.5 px-4 text-right">Total Owed Historically</th>
                <th className="py-3.5 px-4 text-right">Repayed So Far</th>
                <th className="py-3.5 px-4 text-right">Remaining Balance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeSuppliers.map((name) => {
                const summary = getSupplierSummaryData(name);
                return (
                  <tr key={name} className="hover:bg-gray-50/80 transition cursor-pointer" onClick={() => openActionModal('sheet', name)}>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      <div>{name}</div>
                      <div className="text-xs text-gray-400 font-normal">{summary.phone || 'No phone registered'}</div>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-700 font-medium">{summary.totalDebt.toFixed(2)} KES</td>
                    <td className="py-4 px-4 text-right text-green-600 font-medium">{summary.totalRepayed.toFixed(2)} KES</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold px-2 py-1 rounded text-xs text-red-600 bg-red-50 border border-red-100">
                        {summary.remainingDebt.toFixed(2)} KES
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === name ? null : name)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition"
                      >
                        Actions ▾
                      </button>
                      {activeDropdown === name && (
                        <div className="absolute right-4 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-30 text-left">
                          <button onClick={() => openActionModal('debt', name)} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 block font-medium">
                            + New Invoice
                          </button>
                          <button onClick={() => openActionModal('repayment', name)} className="w-full px-4 py-2 text-xs text-green-700 hover:bg-green-50 block font-medium border-t border-gray-100">
                            ✓ Pay Supplier
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No active supplier balances.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: CLOSED SUPPLIER RECORDS */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-500">Fully Cleared Suppliers</h3>
          <p className="text-xs text-gray-400">Wholesaler ledgers closed and fully audited</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400 min-w-[600px]">
            <thead className="bg-gray-50 text-gray-400 font-medium border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Supplier Name</th>
                <th className="py-3.5 px-4 text-right">Total Invoiced Historically</th>
                <th className="py-3.5 px-4 text-right">Fully Paid</th>
                <th className="py-3.5 px-4 text-right">Balance Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closedSuppliers.map((name) => {
                const summary = getSupplierSummaryData(name);
                return (
                  <tr key={name} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => openActionModal('sheet', name)}>
                    <td className="py-4 px-4 font-semibold text-gray-600">
                      <div>{name}</div>
                      <div className="text-xs text-gray-400 font-normal">{summary.phone || '—'}</div>
                    </td>
                    <td className="py-4 px-4 text-right">{summary.totalDebt.toFixed(2)} KES</td>
                    <td className="py-4 px-4 text-right text-green-600 font-medium">{summary.totalRepayed.toFixed(2)} KES</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold px-2 py-1 rounded text-xs text-green-700 bg-green-50 border border-green-100">
                        Paid Off
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openActionModal('debt', name)}
                        className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs font-medium transition"
                      >
                        New Purchase
                      </button>
                    </td>
                  </tr>
                );
              })}
              {closedSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No archived supplier profiles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL OVERLAYS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{modalSupplier}'s Ledger Sheet</h3>
                <p className="text-xs text-gray-500">Record History Log</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* TIMELINE VIEW */}
              {activeModal === 'sheet' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">Accumulated Invoices</span>
                      <strong className="text-gray-800 text-base">{getSupplierSummaryData(modalSupplier).totalDebt.toFixed(2)} KES</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block font-medium">Remaining Outstanding Balance</span>
                      <strong className="text-red-600 text-base">{getSupplierSummaryData(modalSupplier).remainingDebt.toFixed(2)} KES</strong>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    {getSupplierSummaryData(modalSupplier).timeline.map((line) => {
                      const isDebt = line.displayType === 'debt';
                      return (
                        <div key={line.id} className={`p-4 rounded-lg border text-xs ${!isDebt ? 'bg-green-50/40 border-green-100' : line.isCleared ? 'bg-gray-50/60 border-gray-100 opacity-60' : 'bg-red-50/40 border-red-100'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${!isDebt ? 'bg-green-100 text-green-800' : line.isCleared ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-800'}`}>
                                  {isDebt ? (line.isCleared ? 'Paid Off' : 'Pending') : 'Payment Log'}
                                </span>
                                <span className="text-[10px] text-gray-400">{new Date(line.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-800 mt-2">{line.notes}</p>
                            </div>
                            <div className="text-right">
                              {isDebt ? (
                                <>
                                  <div className="text-gray-400 text-[10px]">Invoice: +{parseFloat(line.net_debt_amount).toFixed(2)}</div>
                                  <div className={`font-bold ${line.isCleared ? 'text-gray-400 line-through' : 'text-red-600'}`}>Owed: {line.remainingBalance.toFixed(2)} KES</div>
                                </>
                              ) : (
                                <div className="font-bold text-green-600">Paid: {line.net_debt_amount} KES</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NEW INVOICE DEBT FORM */}
              {activeModal === 'debt' && (
                <form onSubmit={handleRecordDebt} className="space-y-4">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Total Invoice Value (KES)"
                    value={totalInvoiceValue}
                    onChange={(e) => setTotalInvoiceValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount Paid Upfront"
                    value={upfrontPayment}
                    onChange={(e) => setUpfrontPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  />

                  {netDebt > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800 flex justify-between font-bold">
                      <span>Total Invoice: {parseFloat(totalInvoiceValue).toFixed(2)} KES</span>
                      <span>Net Balance Owed: {netDebt.toFixed(2)} KES</span>
                    </div>
                  )}

                  <textarea
                    placeholder="Transaction Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 h-16 resize-none"
                  />
                  <button type="submit" disabled={netDebt <= 0} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50">
                    Confirm Invoice Credit
                  </button>
                </form>
              )}

              {/* RECORD REPAYMENT FORM */}
              {activeModal === 'repayment' && (
                <form onSubmit={handleRecordRepayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">
                      Max Allowed Payment: {getSupplierSummaryData(modalSupplier).remainingDebt.toFixed(2)} KES
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getSupplierSummaryData(modalSupplier).remainingDebt}
                      placeholder="Amount Repayed to Supplier"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Payment Log Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 h-16 resize-none"
                  />
                  <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition">
                    Submit Supplier Payment
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}