import { useQuery } from '@powersync/react';

export function DashboardOverview() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch all transactions for metrics calculations
  const { data: customerTx } = useQuery(`SELECT * FROM customer_ledgers`);
  const { data: supplierTx } = useQuery(`SELECT * FROM supplier_ledgers`);
  const { data: checkouts } = useQuery(`SELECT * FROM daily_checkouts ORDER BY checkout_date DESC`);

  // --- CUSTOMER DEBT CALCULATIONS ---
  const getCustomerMetrics = () => {
    const txs = customerTx || [];
    const uniqueCustomers = [...new Set(txs.map(t => t.customer_name))];
    
    let allTimeOutstanding = 0;
    let todaysUnpaid = 0;

    uniqueCustomers.forEach(name => {
      const records = txs.filter(t => t.customer_name === name);
      const debts = records.filter(r => r.transaction_type === 'debt');
      const repayments = records.filter(r => r.transaction_type === 'repayment');

      const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.net_debt_amount), 0);
      const totalRepayed = repayments.reduce((sum, r) => sum + Math.abs(parseFloat(r.net_debt_amount)), 0);
      const remainingDebt = Math.max(0, totalDebt - totalRepayed);

      allTimeOutstanding += remainingDebt;

      // Calculate today's share of unpaid debt using FIFO
      let pool = totalRepayed;
      debts.forEach(debt => {
        let remaining = parseFloat(debt.net_debt_amount);
        if (pool > 0) {
          if (pool >= remaining) {
            pool -= remaining;
            remaining = 0;
          } else {
            remaining -= pool;
            pool = 0;
          }
        }
        
        const isToday = debt.created_at.startsWith(todayStr);
        if (isToday) {
          todaysUnpaid += remaining;
        }
      });
    });

    return { allTimeOutstanding, todaysUnpaid };
  };

  // --- SUPPLIER DEBT CALCULATIONS ---
  const getSupplierMetrics = () => {
    const txs = supplierTx || [];
    const uniqueSuppliers = [...new Set(txs.map(t => t.supplier_name))];

    let allTimeOutstanding = 0;
    let todaysUnpaid = 0;

    uniqueSuppliers.forEach(name => {
      const records = txs.filter(t => t.supplier_name === name);
      const debts = records.filter(r => r.transaction_type === 'debt');
      const repayments = records.filter(r => r.transaction_type === 'repayment');

      const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.net_debt_amount), 0);
      const totalRepayed = repayments.reduce((sum, r) => sum + Math.abs(parseFloat(r.net_debt_amount)), 0);
      const remainingDebt = Math.max(0, totalDebt - totalRepayed);

      allTimeOutstanding += remainingDebt;

      // Calculate today's share of unpaid supplier debt
      let pool = totalRepayed;
      debts.forEach(debt => {
        let remaining = parseFloat(debt.net_debt_amount);
        if (pool > 0) {
          if (pool >= remaining) {
            pool -= remaining;
            remaining = 0;
          } else {
            remaining -= pool;
            pool = 0;
          }
        }

        const isToday = debt.created_at.startsWith(todayStr);
        if (isToday) {
          todaysUnpaid += remaining;
        }
      });
    });

    return { allTimeOutstanding, todaysUnpaid };
  };

  const { allTimeOutstanding: customerAllTime, todaysUnpaid: customerToday } = getCustomerMetrics();
  const { allTimeOutstanding: supplierAllTime, todaysUnpaid: supplierToday } = getSupplierMetrics();

  // Cash in Drawer metrics from daily checkout history
  const latestCheckout = checkouts?.[0];
  const thisMonthCheckouts = checkouts?.filter(co => {
    const coDate = new Date(co.checkout_date);
    const now = new Date();
    return coDate.getMonth() === now.getMonth() && coDate.getFullYear() === now.getFullYear();
  }) || [];

  const monthlyCashCollected = thisMonthCheckouts.reduce((sum, co) => sum + (parseFloat(co.total_cash_collected) || 0), 0);

  return (
    <div className="space-y-8 mt-6">
      
      {/* HEADER SECTION */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Duka Dashboard</h2>
        <p className="text-sm text-gray-500">Live operational overview of your retail shop balance sheets</p>
      </div>

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CUSTOMER DEBT CARD */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Customer Debt</span>
            <strong className="text-2xl font-extrabold text-gray-900 block mt-1">
              {customerAllTime.toFixed(2)} KES
            </strong>
            <span className="text-xs text-gray-400 font-medium block mt-1">Total Outstanding Cash Balance</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400 block font-medium">Today's Unpaid</span>
              <strong className="text-red-600 font-bold">{customerToday.toFixed(2)} KES</strong>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">All-Time Older</span>
              <strong className="text-gray-700 font-bold">{(customerAllTime - customerToday).toFixed(2)} KES</strong>
            </div>
          </div>
        </div>

        {/* SUPPLIER DEBT CARD */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Supplier Payables</span>
            <strong className="text-2xl font-extrabold text-gray-900 block mt-1">
              {supplierAllTime.toFixed(2)} KES
            </strong>
            <span className="text-xs text-gray-400 font-medium block mt-1">Total Outstanding Payables Balance</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400 block font-medium">Today's Unpaid</span>
              <strong className="text-amber-600 font-bold">{supplierToday.toFixed(2)} KES</strong>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">All-Time Older</span>
              <strong className="text-gray-700 font-bold">{(supplierAllTime - supplierToday).toFixed(2)} KES</strong>
            </div>
          </div>
        </div>

        {/* MONTHLY CASH RECONCILED */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">This Month's Cash</span>
            <strong className="text-2xl font-extrabold text-green-600 block mt-1">
              {monthlyCashCollected.toFixed(2)} KES
            </strong>
            <span className="text-xs text-gray-400 font-medium block mt-1">Accumulated physical register closes</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs">
            <span className="text-gray-400 block font-medium">Last Checkout Run ({latestCheckout?.checkout_date || 'None'})</span>
            <strong className="text-gray-800 font-bold">
              {latestCheckout ? `${parseFloat(latestCheckout.total_cash_collected).toFixed(2)} KES` : 'No logs stored'}
            </strong>
          </div>
        </div>

      </div>

    </div>
  );
}