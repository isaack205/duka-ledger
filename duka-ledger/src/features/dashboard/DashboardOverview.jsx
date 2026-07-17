import { useQuery } from '@powersync/react';

export function DashboardOverview() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch all transactions for metrics and analytics calculations
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

  // --- CREDIT VELOCITY CALCULATIONS (PAYER SPEED) ---
  const getCreditVelocity = () => {
    const txs = customerTx || [];
    const uniqueCustomers = [...new Set(txs.map(t => t.customer_name))];

    return uniqueCustomers.map(name => {
      const records = txs.filter(t => t.customer_name === name);
      const debts = records.filter(r => r.transaction_type === 'debt');
      const repayments = records.filter(r => r.transaction_type === 'repayment');

      const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.net_debt_amount), 0);
      const totalRepayed = repayments.reduce((sum, r) => sum + Math.abs(parseFloat(r.net_debt_amount)), 0);
      const remainingDebt = Math.max(0, totalDebt - totalRepayed);

      // Simple Velocity Math: Average days from debt creation to repayment
      let totalDays = 0;
      let matchCount = 0;

      debts.forEach(debt => {
        const debtDate = new Date(debt.created_at);
        // Find closest repayment logged after this debt
        const nextRepayment = repayments.find(r => new Date(r.created_at) >= debtDate);
        if (nextRepayment) {
          const repaymentDate = new Date(nextRepayment.created_at);
          const diffTime = Math.abs(repaymentDate - debtDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDays += diffDays;
          matchCount++;
        }
      });

      const avgDays = matchCount > 0 ? Math.round(totalDays / matchCount) : null;

      let status = 'No Debt History';
      let colorClass = 'bg-gray-100 text-gray-600 border-gray-200';

      if (avgDays !== null) {
        if (avgDays <= 3) {
          status = `Fast (${avgDays}d)`;
          colorClass = 'bg-green-50 text-green-700 border-green-200';
        } else if (avgDays <= 7) {
          status = `Steady (${avgDays}d)`;
          colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
        } else {
          status = `Slow (${avgDays}d)`;
          colorClass = 'bg-orange-50 text-orange-700 border-orange-200';
        }
      } else if (remainingDebt > 0) {
        // Has active unpaid debt but no history of repayment yet
        const oldestDebt = debts[0];
        if (oldestDebt) {
          const daysOutstanding = Math.ceil((new Date() - new Date(oldestDebt.created_at)) / (1000 * 60 * 60 * 24));
          if (daysOutstanding > 7) {
            status = 'Slow (No Repay)';
            colorClass = 'bg-red-50 text-red-700 border-red-200';
          } else {
            status = 'New Debtor';
            colorClass = 'bg-slate-50 text-slate-700 border-slate-200';
          }
        }
      }

      return { name, remainingDebt, status, colorClass };
    }).filter(c => c.remainingDebt > 0 || c.status !== 'No Debt History') // Only show active/historical debtor records
      .sort((a, b) => b.remainingDebt - a.remainingDebt)
      .slice(0, 5); // Display top 5
  };

  // --- WEEKLY CASH-VS-CREDIT DATA GENERATION ---
  const getWeeklyRatioData = () => {
    const list = [];
    const txs = customerTx || [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayTxs = txs.filter(t => t.created_at.startsWith(dateStr));

      // Cash today = upfront payments + direct debt repayments
      const cashCollected = dayTxs.reduce((sum, t) => {
        const upfront = parseFloat(t.amount_paid_upfront || 0);
        const repayment = t.transaction_type === 'repayment' ? Math.abs(parseFloat(t.net_debt_amount)) : 0;
        return sum + upfront + repayment;
      }, 0);

      // Credit today = actual unpaid balance issued
      const creditIssued = dayTxs
        .filter(t => t.transaction_type === 'debt')
        .reduce((sum, t) => sum + (parseFloat(t.net_debt_amount) || 0), 0);

      const totalVolume = cashCollected + creditIssued;
      const cashPercentage = totalVolume > 0 ? (cashCollected / totalVolume) * 100 : 100;
      const creditPercentage = totalVolume > 0 ? (creditIssued / totalVolume) * 100 : 0;

      list.push({
        dayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dateStr,
        cashCollected,
        creditIssued,
        cashPercentage,
        creditPercentage,
        totalVolume
      });
    }
    return list;
  };

  const { allTimeOutstanding: customerAllTime, todaysUnpaid: customerToday } = getCustomerMetrics();
  const { allTimeOutstanding: supplierAllTime, todaysUnpaid: supplierToday } = getSupplierMetrics();

  const latestCheckout = checkouts?.[0];
  const thisMonthCheckouts = checkouts?.filter(co => {
    const coDate = new Date(co.checkout_date);
    const now = new Date();
    return coDate.getMonth() === now.getMonth() && coDate.getFullYear() === now.getFullYear();
  }) || [];

  const monthlyCashCollected = thisMonthCheckouts.reduce((sum, co) => sum + (parseFloat(co.total_cash_collected) || 0), 0);

  const topDebtors = getCreditVelocity();
  const weeklyRatio = getWeeklyRatioData();

  return (
    <div className="space-y-8 mt-6 pb-12">
      
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

      {/* ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* WEEKLY CASH-VS-CREDIT VISUALIZER */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Weekly Cash vs Credit Ratio</h3>
            <p className="text-xs text-gray-400 mb-6">Percentage comparisons of liquid cash entries vs credit issued</p>
          </div>

          <div className="space-y-4">
            {weeklyRatio.map((day) => (
              <div key={day.dateStr} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span>{day.dayLabel} ({day.totalVolume > 0 ? `${day.totalVolume.toFixed(0)} KES` : 'No Activity'})</span>
                  {day.totalVolume > 0 && (
                    <span className="text-gray-400 font-medium">
                      <span className="text-green-600">{day.cashPercentage.toFixed(0)}% Cash</span> / <span className="text-red-500">{day.creditPercentage.toFixed(0)}% Credit</span>
                    </span>
                  )}
                </div>
                
                {/* Visual Ratio Bar */}
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  {day.totalVolume === 0 ? (
                    <div className="h-full w-full bg-gray-200"></div>
                  ) : (
                    <>
                      <div 
                        style={{ width: `${day.cashPercentage}%` }} 
                        className="h-full bg-green-500 transition-all duration-300"
                      />
                      <div 
                        style={{ width: `${day.creditPercentage}%` }} 
                        className="h-full bg-red-400 transition-all duration-300"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-start gap-4 mt-6 pt-4 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 block"></span>
              <span className="text-gray-500 font-semibold">Cash Collected / Paid Repayment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 block"></span>
              <span className="text-gray-500 font-semibold">Outstanding Credit Issued</span>
            </div>
          </div>
        </div>

        {/* CREDIT VELOCITY PANEL */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Credit Velocity & Active Debtors</h3>
            <p className="text-xs text-gray-400 mb-4">Historical repayment timelines calculated dynamically</p>
          </div>

          <div className="divide-y divide-gray-100 flex-1 flex flex-col justify-center">
            {topDebtors.map((debtor) => (
              <div key={debtor.name} className="py-3.5 flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-gray-800 block">{debtor.name}</span>
                  <span className="text-xs text-gray-400 font-semibold">{debtor.remainingDebt.toFixed(2)} KES Outstanding</span>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 text-[11px] font-bold border rounded-full ${debtor.colorClass}`}>
                    {debtor.status}
                  </span>
                </div>
              </div>
            ))}
            {topDebtors.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-xs font-semibold">
                No debtor accounts require analysis at this time.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 font-medium">
            💡 <span className="font-bold text-gray-500">Classification rules</span>: Fast (≤3 days), Steady (4–7 days), Slow (&gt;7 days).
          </div>
        </div>

      </div>

    </div>
  );
}