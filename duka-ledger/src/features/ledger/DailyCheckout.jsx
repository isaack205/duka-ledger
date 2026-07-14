import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';

export function DailyCheckout() {
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
      alert('Please enter a valid cash amount.');
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
        alert('Today\'s closeout successfully updated!');
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
        alert('Register successfully closed for today!');
      }

      setCashCollected('');
      setNotes('');
    } catch (err) {
      console.error(err);
      alert('Error saving daily checkout record.');
    }
  };

  const handleTriggerEdit = (e, checkout) => {
    e.stopPropagation();
    setCashCollected(parseFloat(checkout.total_cash_collected).toString());
    setNotes(checkout.notes || '');
    setIsEditingToday(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
      
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6 lg:col-span-1 h-fit">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            {isEditingToday ? 'Modify Today\'s Closeout' : 'Daily Register Closeout'}
          </h3>
          <p className="text-xs text-gray-500 mb-4">Reconcile physical cash drawer balances at end-of-day</p>
        </div>

        {isRegisterClosedToday ? (
          <div className="p-5 bg-green-50 border border-green-200 rounded-lg space-y-4 text-center">
            <div className="text-green-600 font-bold text-lg">✓ Register Closed Today</div>
            <p className="text-xs text-green-700">You have already submitted the daily checkout run for today ({todayStr}).</p>
            <div className="pt-3 border-t border-green-150 text-left space-y-2 text-xs text-green-800">
              <div className="flex justify-between">
                <span>Cash Counted:</span>
                <strong>{parseFloat(todaysCheckout.total_cash_collected).toFixed(2)} KES</strong>
              </div>
            </div>
            <button 
              onClick={(e) => handleTriggerEdit(e, todaysCheckout)}
              className="w-full mt-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition"
            >
              Modify Today's Figures
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-3 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Total Debt Not Paid Today:</span>
                <strong className="text-red-600 font-semibold">{customerDebtNotPaidToday.toFixed(2)} KES</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Supplier Debt Not Paid Today:</span>
                <strong className="text-amber-600 font-semibold">{supplierDebtNotPaidToday.toFixed(2)} KES</strong>
              </div>
            </div>

            <form onSubmit={handleCloseRegister} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Total Physical Cash Counted</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 30000.00"
                  value={cashCollected}
                  onChange={(e) => setCashCollected(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1 flex justify-between">
                  <span>M-Pesa Collected</span>
                  <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Disabled</span>
                </label>
                <input
                  type="text"
                  value="M-Pesa payments inactive on frontend"
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-400 rounded-md text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Audit Notes</label>
                <textarea
                  placeholder="Type any reasons for shortages, excess, or system issues..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                />
              </div>

              <div className="flex gap-2">
                {isEditingToday && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingToday(false);
                      setCashCollected('');
                      setNotes('');
                    }}
                    className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-semibold transition shadow-sm"
                >
                  {isEditingToday ? 'Confirm Update' : 'Submit Daily Closeout'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm lg:col-span-2 overflow-hidden">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Checkout History Logs</h3>
          <p className="text-xs text-gray-500 mb-4">Click any entry row below to open the complete summary overview sheet</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[500px]">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-right">Cash Counted</th>
                <th className="py-3 px-3 text-right">Total Debt Not Paid</th>
                <th className="py-3 px-3 text-right">Net Cash Position</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pastCheckouts?.map((co) => {
                const isToday = co.checkout_date === todayStr;
                return (
                  <tr 
                    key={co.id} 
                    onClick={() => setSelectedCheckout(co)}
                    className="hover:bg-gray-50/80 transition cursor-pointer font-medium"
                  >
                    <td className="py-4 px-3 text-gray-900 font-semibold">
                      {new Date(co.checkout_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-3 text-right text-gray-900">{parseFloat(co.total_cash_collected).toFixed(2)} KES</td>
                    <td className="py-4 px-3 text-right text-red-600">+{parseFloat(co.customer_credit_issued || 0).toFixed(2)} KES</td>
                    <td className="py-4 px-3 text-right">
                      <span className={`font-bold px-2 py-0.5 rounded text-xs ${parseFloat(co.net_cash_position || 0) >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                        {parseFloat(co.net_cash_position || 0).toFixed(2)} KES
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {isToday ? (
                        <button 
                          onClick={(e) => handleTriggerEdit(e, co)}
                          className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold transition"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!pastCheckouts || pastCheckouts.length === 0) && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No checkout runs submitted yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCheckout && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-base font-bold text-gray-900">Daily Balance Sheet Summary</h3>
                <p className="text-xs text-gray-400">
                  {new Date(selectedCheckout.checkout_date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                </p>
              </div>
              <button onClick={() => setSelectedCheckout(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="p-3 flex justify-between">
                  <span className="text-gray-500 font-medium">Physical Cash Counted</span>
                  <span className="font-bold text-gray-900">{parseFloat(selectedCheckout.total_cash_collected).toFixed(2)} KES</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-gray-500 font-medium">M-Pesa Pool Total</span>
                  <span className="text-gray-400">0.00 KES (Inactive)</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-gray-500 font-medium">Total Customer Debt Not Paid</span>
                  <span className="font-semibold text-red-600">+{parseFloat(selectedCheckout.customer_credit_issued || 0).toFixed(2)} KES</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-gray-500 font-medium">Supplier Debt Not Paid</span>
                  <span className="font-semibold text-amber-600">-{parseFloat(selectedCheckout.supplier_debt_created || 0).toFixed(2)} KES</span>
                </div>
                <div className="p-3 flex justify-between bg-slate-50">
                  <span className="text-slate-700 font-bold">Net Cash Position</span>
                  <span className={`font-black ${parseFloat(selectedCheckout.net_cash_position || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(selectedCheckout.net_cash_position || 0).toFixed(2)} KES
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wide mb-1">Audit Log Commentary</span>
                <p className="text-xs text-gray-700 leading-relaxed font-medium">{selectedCheckout.notes}</p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right flex justify-end gap-2">
              {selectedCheckout.checkout_date === todayStr && (
                <button 
                  onClick={(e) => {
                    setSelectedCheckout(null);
                    handleTriggerEdit(e, selectedCheckout);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition"
                >
                  Edit Values
                </button>
              )}
              <button 
                onClick={() => setSelectedCheckout(null)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition"
              >
                Close Summary Sheet
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}