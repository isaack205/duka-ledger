import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { 
  Users, 
  Package, 
  Wallet, 
  Activity, 
  TrendingUp, 
  Info,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';

export function DashboardOverview() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Toggle hiding/blurring financial metrics
  const [hideFinancials, setHideFinancials] = useState(() => localStorage.getItem('hideFinancials') === 'true');

  const toggleFinancials = () => {
    setHideFinancials(prev => {
      const val = !prev;
      localStorage.setItem('hideFinancials', String(val));
      return val;
    });
  };

  const renderValue = (valStr) => {
    return (
      <span className={`transition-all duration-300 inline-block ${hideFinancials ? 'blur-[5px] select-none pointer-events-none' : ''}`}>
        {valStr}
      </span>
    );
  };

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
      let colorClass = 'border-slate-200 bg-slate-50 text-slate-600';

      if (avgDays !== null) {
        if (avgDays <= 3) {
          status = `Fast (${avgDays}d)`;
          colorClass = 'border-secondary/20 bg-secondary/5 text-secondary-dark';
        } else if (avgDays <= 7) {
          status = `Steady (${avgDays}d)`;
          colorClass = 'border-blue-200 bg-blue-50/50 text-blue-700';
        } else {
          status = `Slow (${avgDays}d)`;
          colorClass = 'border-accent/20 bg-accent/5 text-accent-dark animate-pulse';
        }
      } else if (remainingDebt > 0) {
        // Has active unpaid debt but no history of repayment yet
        const oldestDebt = debts[0];
        if (oldestDebt) {
          const daysOutstanding = Math.ceil((new Date() - new Date(oldestDebt.created_at)) / (1000 * 60 * 60 * 24));
          if (daysOutstanding > 7) {
            status = 'Slow (No Repay)';
            colorClass = 'border-accent/20 bg-accent/5 text-accent-dark animate-pulse';
          } else {
            status = 'New Debtor';
            colorClass = 'border-slate-200 bg-slate-50 text-slate-700';
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

  const formattedDate = new Date().toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-8 mt-6 pb-12 animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Duka Dashboard</h2>
            <button 
              onClick={toggleFinancials} 
              className="p-1.5 hover:bg-slate-100 active:bg-slate-200 text-slate-500 rounded-xl border border-slate-200/60 bg-white transition shadow-xs flex items-center gap-1.5 text-xs font-bold"
              title={hideFinancials ? "Show financial values" : "Blur financial values"}
            >
              {hideFinancials ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{hideFinancials ? "Show" : "Hide"} Balances</span>
            </button>
          </div>
          <p className="text-sm text-slate-500 font-medium">Live operational overview of your retail shop balance sheets</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 shadow-xs self-start sm:self-auto">
          <Activity className="h-4 w-4 text-secondary animate-pulse" />
          <span>Real-Time Sync Active</span>
        </div>
      </div>

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CUSTOMER DEBT CARD */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer Debt</span>
              <strong className="text-2xl font-extrabold text-primary block mt-1 tracking-tight">
                {renderValue(`${customerAllTime.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} KES`)}
              </strong>
              <span className="text-xs text-slate-400 font-semibold block mt-1">Outstanding credit issued</span>
            </div>
            <div className="p-2.5 bg-accent/5 rounded-xl text-accent border border-accent/10">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs font-semibold">
            <div>
              <span className="text-slate-400 block font-bold text-[10px] uppercase">Today's Unpaid</span>
              <strong className="text-accent text-sm font-bold block mt-0.5">{renderValue(`${customerToday.toFixed(2)} KES`)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[10px] uppercase">All-Time Older</span>
              <strong className="text-slate-700 text-sm font-bold block mt-0.5">{renderValue(`${(customerAllTime - customerToday).toFixed(2)} KES`)}</strong>
            </div>
          </div>
        </div>

        {/* SUPPLIER DEBT CARD */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Supplier Payables</span>
              <strong className="text-2xl font-extrabold text-primary block mt-1 tracking-tight">
                {renderValue(`${supplierAllTime.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} KES`)}
              </strong>
              <span className="text-xs text-slate-400 font-semibold block mt-1">Outstanding invoice balances</span>
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 border border-slate-200/40">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs font-semibold">
            <div>
              <span className="text-slate-400 block font-bold text-[10px] uppercase">Today's Balance</span>
              <strong className="text-amber-600 text-sm font-bold block mt-0.5">{renderValue(`${supplierToday.toFixed(2)} KES`)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[10px] uppercase">All-Time Older</span>
              <strong className="text-slate-700 text-sm font-bold block mt-0.5">{renderValue(`${(supplierAllTime - supplierToday).toFixed(2)} KES`)}</strong>
            </div>
          </div>
        </div>

        {/* MONTHLY CASH RECONCILED */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">This Month's Cash</span>
              <strong className="text-2xl font-extrabold text-secondary block mt-1 tracking-tight">
                {renderValue(`${monthlyCashCollected.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} KES`)}
              </strong>
              <span className="text-xs text-slate-400 font-semibold block mt-1">Physical register closes</span>
            </div>
            <div className="p-2.5 bg-secondary/5 rounded-xl text-secondary border border-secondary/10">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs font-semibold">
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Last Closeout ({latestCheckout?.checkout_date || 'None'})</span>
            <strong className="text-slate-700 text-sm font-bold block mt-0.5">
              {latestCheckout ? renderValue(`${parseFloat(latestCheckout.total_cash_collected).toLocaleString(undefined, {minimumFractionDigits: 2})} KES`) : 'No logs stored'}
            </strong>
          </div>
        </div>

      </div>

      {/* ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* WEEKLY CASH-VS-CREDIT VISUALIZER */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Weekly Cash vs Credit Ratio</h3>
              <p className="text-xs text-slate-400 font-semibold">Percentage comparisons of liquid cash vs credit issued</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400">
              <TrendingUp className="h-4 w-4 text-secondary" />
            </div>
          </div>

          <div className="space-y-4">
            {weeklyRatio.map((day) => (
              <div key={day.dateStr} className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{day.dayLabel} ({day.totalVolume > 0 ? renderValue(`${day.totalVolume.toFixed(0)} KES`) : 'No Activity'})</span>
                  {day.totalVolume > 0 && (
                    <span className="text-[11px] font-bold">
                      <span className="text-secondary">{day.cashPercentage.toFixed(0)}% Cash</span> / <span className="text-accent">{day.creditPercentage.toFixed(0)}% Credit</span>
                    </span>
                  )}
                </div>
                
                {/* Visual Ratio Bar */}
                <div className="h-2.5 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden flex">
                  {day.totalVolume === 0 ? (
                    <div className="h-full w-full bg-slate-100"></div>
                  ) : (
                    <>
                      <div 
                        style={{ width: `${day.cashPercentage}%` }} 
                        className="h-full bg-secondary transition-all duration-300"
                        title={`${day.cashPercentage.toFixed(0)}% Cash Collected`}
                      />
                      <div 
                        style={{ width: `${day.creditPercentage}%` }} 
                        className="h-full bg-accent transition-all duration-300"
                        title={`${day.creditPercentage.toFixed(0)}% Credit Outstanding`}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary block"></span>
              <span>Cash Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent block"></span>
              <span>Outstanding Credit</span>
            </div>
          </div>
        </div>

        {/* CREDIT VELOCITY PANEL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Credit Velocity & Active Debtors</h3>
              <p className="text-xs text-slate-400 font-semibold">Repayment timelines calculated dynamically</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-center">
            {topDebtors.map((debtor) => {
              // Custom colors based on tags
              let badgeStyles = 'border-slate-200 bg-slate-50 text-slate-600';
              if (debtor.status.startsWith('Fast')) {
                badgeStyles = 'border-secondary/20 bg-secondary/5 text-secondary-dark';
              } else if (debtor.status.startsWith('Steady')) {
                badgeStyles = 'border-blue-200 bg-blue-50/50 text-blue-700';
              } else if (debtor.status.startsWith('Slow')) {
                badgeStyles = 'border-accent/20 bg-accent/5 text-accent-dark';
              }

              return (
                <div key={debtor.name} className="py-3.5 flex justify-between items-center text-sm group hover:bg-slate-50/30 px-2 rounded-xl transition duration-150">
                  <div>
                    <span className="font-extrabold text-primary block leading-tight">{debtor.name}</span>
                    <span className="text-xs text-slate-400 font-bold mt-0.5 block">{renderValue(`${debtor.remainingDebt.toFixed(2)} KES`)} Outstanding</span>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 text-[10px] font-bold border rounded-full ${badgeStyles}`}>
                      {debtor.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {topDebtors.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
                <Info className="h-8 w-8 text-slate-300 animate-bounce" />
                <span>No debtor accounts require analysis.</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>Rules: Fast (≤3d), Steady (4–7d), Slow (&gt;7d).</span>
          </div>
        </div>

      </div>

    </div>
  );
}