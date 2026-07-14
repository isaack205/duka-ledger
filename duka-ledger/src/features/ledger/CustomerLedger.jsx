import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';

export function CustomerLedger() {
  const { data: items } = useQuery('SELECT * FROM items ORDER BY item_name ASC');
  const { data: transactions } = useQuery(`
    SELECT customer_ledgers.*, items.item_name 
    FROM customer_ledgers 
    LEFT JOIN items ON customer_ledgers.item_id = items.id
    ORDER BY customer_ledgers.created_at ASC
  `);

  // Active user action states
  const [activeModal, setActiveModal] = useState(null); // 'sheet', 'debt', or 'repayment'
  const [modalCustomer, setModalCustomer] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);

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

  // Cart operations
  const handleAddToCart = () => {
    if (!selectedItemId) return;
    const item = items.find(i => i.id === selectedItemId);
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

  const totalCartValue = cart.reduce((sum, item) => sum + (parseFloat(item.retail_price) * item.quantity), 0);
  const upfront = parseFloat(upfrontPayment) || 0;
  const netDebt = totalCartValue - upfront;

  // Process data for a customer using the FIFO waterfall logic
  const getCustomerSummaryData = (name) => {
    const customerTx = (transactions || []).filter(t => t.customer_name === name);
    
    const debts = customerTx.filter(t => t.transaction_type === 'debt').map(d => ({ ...d, remaining: parseFloat(d.net_debt_amount) }));
    const repayments = customerTx.filter(t => t.transaction_type === 'repayment');

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
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Newest first for popups

    return { totalDebt, totalRepayed, remainingDebt, timeline: historyTimeline, phone: customerTx[0]?.customer_phone || '' };
  };

  // Unique list of customers
  const uniqueCustomers = [...new Set((transactions || []).map(t => t.customer_name))];

  // Split customers into Active (unpaid debt) and Closed (fully cleared)
  const activeDebtors = uniqueCustomers.filter(name => getCustomerSummaryData(name).remainingDebt > 0);
  const closedDebtors = uniqueCustomers.filter(name => getCustomerSummaryData(name).remainingDebt === 0);

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

      setNewCustomerName('');
      setNewCustomerPhone('');
      setCart([]);
      setUpfrontPayment('');
      setNotes('');
    } catch (err) {
      console.error('Failed to create new customer debt:', err);
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
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    const payment = parseFloat(repaymentAmount);
    const summary = getCustomerSummaryData(modalCustomer);

    // Hard limit verification
    if (payment > summary.remainingDebt) {
      alert(`Payment exceeds outstanding debt of ${summary.remainingDebt.toFixed(2)} KES!`);
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
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalCustomer('');
    setCart([]);
    setUpfrontPayment('');
    setRepaymentAmount('');
    setNotes('');
  };

  const openActionModal = (type, name) => {
    const data = getCustomerSummaryData(name);
    setModalCustomer(name);
    setCustomerPhone(data.phone);
    setActiveModal(type);
    setActiveDropdown(null);
  };

  return (
    <div className="space-y-8 mt-6 pb-12">
      
      {/* SECTION 1: REGISTER NEW CUSTOMER WITH DEBT */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Register New Customer Debt</h3>
        <form onSubmit={handleRegisterNewCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Customer Full Name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Phone Number (Optional)"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border border-gray-200 p-3 rounded-md space-y-2">
            <span className="text-xs font-semibold text-gray-500 block">Assemble Cart Items</span>
            <div className="flex gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-xs bg-white"
              >
                <option value="">Select Item</option>
                {items?.map((item) => (
                  <option key={item.id} value={item.id}>{item.item_name} ({item.retail_price} KES)</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-12 px-2 py-1 border border-gray-300 rounded-md text-xs"
              />
              <button type="button" onClick={handleAddToCart} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-xs font-medium">Add</button>
            </div>

            {cart.length > 0 && (
              <div className="mt-2 space-y-1 divide-y divide-gray-100 max-h-24 overflow-y-auto">
                {cart.map((cartItem, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-1 text-gray-600">
                    <span>{cartItem.item_name} <span className="text-gray-400">x{cartItem.quantity}</span></span>
                    <span>{(parseFloat(cartItem.retail_price) * cartItem.quantity).toFixed(2)} KES</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <input
              type="number"
              step="0.01"
              placeholder="Amount Paid Upfront"
              value={upfrontPayment}
              onChange={(e) => setUpfrontPayment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            />
            {cart.length > 0 && (
              <div className="p-2 bg-blue-50 rounded text-xs text-blue-800 flex justify-between font-bold">
                <span>Total: {totalCartValue.toFixed(2)}</span>
                <span>Net Debt: {netDebt.toFixed(2)} KES</span>
              </div>
            )}
            <button 
              type="submit" 
              disabled={cart.length === 0}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              Open Ledger Record
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: ACTIVE DEBTS TABLE */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Active Outstanding Debts</h3>
          <p className="text-xs text-gray-500">Unresolved profiles with unpaid debt balances</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4 text-right">Total Debt</th>
                <th className="py-3.5 px-4 text-right">Repayed So Far</th>
                <th className="py-3.5 px-4 text-right">Remaining Balance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeDebtors.map((name) => {
                const summary = getCustomerSummaryData(name);
                return (
                  <tr key={name} className="hover:bg-gray-50/80 transition cursor-pointer" onClick={() => openActionModal('sheet', name)}>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      <div>{name}</div>
                      <div className="text-xs text-gray-400 font-normal">{summary.phone || 'No phone verified'}</div>
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
                            + Add New Debt
                          </button>
                          <button onClick={() => openActionModal('repayment', name)} className="w-full px-4 py-2 text-xs text-green-700 hover:bg-green-50 block font-medium border-t border-gray-100">
                            ✓ Record Payment
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeDebtors.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No active outstanding debts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: CLOSED DEBTS TABLE */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-500">Closed Ledger Records</h3>
          <p className="text-xs text-gray-400">Fully cleared debt logs locked for audit history</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400 min-w-[600px]">
            <thead className="bg-gray-50 text-gray-400 font-medium border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4 text-right">Total Owed Historically</th>
                <th className="py-3.5 px-4 text-right">Fully Repayed</th>
                <th className="py-3.5 px-4 text-right">Balance Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closedDebtors.map((name) => {
                const summary = getCustomerSummaryData(name);
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
                        Cleared
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openActionModal('debt', name)}
                        className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs font-medium transition"
                      >
                        Reopen Debt
                      </button>
                    </td>
                  </tr>
                );
              })}
              {closedDebtors.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No closed records in the archive.</td>
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
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{modalCustomer}'s Sheet</h3>
                <p className="text-xs text-gray-500">Record History Ledger</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* VIEW TIMELINE SHEET */}
              {activeModal === 'sheet' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">Accumulated Purchases</span>
                      <strong className="text-gray-800 text-base">{getCustomerSummaryData(modalCustomer).totalDebt.toFixed(2)} KES</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block font-medium">Active Owed Balance</span>
                      <strong className="text-red-600 text-base">{getCustomerSummaryData(modalCustomer).remainingDebt.toFixed(2)} KES</strong>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    {getCustomerSummaryData(modalCustomer).timeline.map((line) => {
                      const isDebt = line.displayType === 'debt';
                      return (
                        <div key={line.id} className={`p-4 rounded-lg border text-xs ${!isDebt ? 'bg-green-50/40 border-green-100' : line.isCleared ? 'bg-gray-50/60 border-gray-100 opacity-60' : 'bg-red-50/40 border-red-100'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${!isDebt ? 'bg-green-100 text-green-800' : line.isCleared ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-800'}`}>
                                  {isDebt ? (line.isCleared ? 'Cleared' : 'Active Debt') : 'Repayment Log'}
                                </span>
                                <span className="text-[10px] text-gray-400">{new Date(line.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-800 mt-2">{line.notes}</p>
                            </div>
                            <div className="text-right">
                              {isDebt ? (
                                <>
                                  <div className="text-gray-400 text-[10px]">Debt: +{parseFloat(line.net_debt_amount).toFixed(2)}</div>
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

              {/* ADD DEBT FORM */}
              {activeModal === 'debt' && (
                <form onSubmit={handleRecordDebt} className="space-y-4">
                  <div className="border border-gray-200 p-3 rounded-md space-y-2">
                    <span className="text-xs font-semibold text-gray-500 block">Assemble Cart Items</span>
                    <div className="flex gap-2">
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
                      >
                        <option value="">Select Item</option>
                        {items?.map((item) => (
                          <option key={item.id} value={item.id}>{item.item_name} ({item.retail_price} KES)</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                      />
                      <button type="button" onClick={handleAddToCart} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-xs font-medium">Add</button>
                    </div>

                    {cart.length > 0 && (
                      <div className="mt-2 space-y-1 divide-y divide-gray-100 max-h-28 overflow-y-auto">
                        {cart.map((cartItem, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs py-1 text-gray-600">
                            <span>{cartItem.item_name} <span className="text-gray-400">x{cartItem.quantity}</span></span>
                            <span>{(parseFloat(cartItem.retail_price) * cartItem.quantity).toFixed(2)} KES</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount Paid Upfront"
                    value={upfrontPayment}
                    onChange={(e) => setUpfrontPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  />

                  {cart.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800 flex justify-between font-bold">
                      <span>Total Value: {totalCartValue.toFixed(2)} KES</span>
                      <span>Net Debt Balance: {netDebt.toFixed(2)} KES</span>
                    </div>
                  )}

                  <textarea
                    placeholder="Custom Transaction Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 h-16 resize-none"
                  />
                  <button type="submit" disabled={cart.length === 0} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50">
                    Confirm Credit Assignment
                  </button>
                </form>
              )}

              {/* RECORD REPAYMENT FORM */}
              {activeModal === 'repayment' && (
                <form onSubmit={handleRecordRepayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">
                      Max Allowed Repayment: {getCustomerSummaryData(modalCustomer).remainingDebt.toFixed(2)} KES
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getCustomerSummaryData(modalCustomer).remainingDebt}
                      placeholder="Repayment Cash Amount Received"
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
                    Apply Payment Record
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