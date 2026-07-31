import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@powersync/react';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  ArrowUpRight, 
  Printer, 
  ChevronRight, 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff,
  ClipboardList
} from 'lucide-react';
import PeriodicReportPrint from './pdfTemplates/PeriodicReportPrint';

export function ReportsDashboard() {
  const [hideFinancials, setHideFinancials] = useState(() => localStorage.getItem('hideFinancials') === 'true');

  // Date range state (default to this month)
  const getInitialDates = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      preset: 'this_month'
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDates);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [printReport, setPrintReport] = useState(null);

  // Fetch all checkouts sorted by date
  const { data: checkouts = [] } = useQuery(`
    SELECT * FROM daily_checkouts ORDER BY checkout_date ASC
  `);

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

  // Quick select presets
  const handlePresetSelect = (preset) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(today.setDate(diff));
      end = new Date();
    } else if (preset === 'last_week') {
      const day = today.getDay();
      const diff = today.getDate() - day - 6;
      start = new Date(today.setDate(diff));
      end = new Date(today.setDate(diff + 6));
    } else if (preset === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    } else if (preset === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      preset
    });
  };

  // Filter checkouts in current date range
  const filteredCheckouts = useMemo(() => {
    return checkouts.filter(c => 
      c.checkout_date >= dateRange.startDate && 
      c.checkout_date <= dateRange.endDate
    );
  }, [checkouts, dateRange.startDate, dateRange.endDate]);

  // Aggregate metrics
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalOutflows = 0;
    let totalBusinessVolume = 0;
    let creditIssued = 0;
    let debtRecovered = 0;
    let supplierPayables = 0;
    let totalCashOnHand = 0;
    let totalMpesaOnHand = 0;

    filteredCheckouts.forEach(c => {
      totalRevenue += parseFloat(c.total_cash_realized || 0);
      totalOutflows += parseFloat(c.supplier_cash_paid || 0) + parseFloat(c.supplier_mpesa_paid || 0);
      totalBusinessVolume += parseFloat(c.total_business_volume || 0);
      creditIssued += parseFloat(c.customer_credit_issued || 0);
      debtRecovered += parseFloat(c.customer_debt_recovered || 0);
      supplierPayables += parseFloat(c.supplier_debt_created || 0);
      totalCashOnHand += parseFloat(c.total_cash_collected || 0);
      totalMpesaOnHand += parseFloat(c.total_mpesa_collected || 0);
    });

    const netCashFlow = totalRevenue - totalOutflows;
    const creditRatio = totalBusinessVolume > 0 ? (creditIssued / totalBusinessVolume) * 100 : 0;

    return {
      totalRevenue,
      totalOutflows,
      totalBusinessVolume,
      creditIssued,
      debtRecovered,
      supplierPayables,
      netCashFlow,
      creditRatio,
      totalCashOnHand,
      totalMpesaOnHand
    };
  }, [filteredCheckouts]);

  // Print triggered report PDF
  const handlePrintReport = () => {
    setPrintReport({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      checkouts: filteredCheckouts,
      summary
    });
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `Business_Report_${dateRange.startDate}_to_${dateRange.endDate}`;
      document.body.classList.add('printing-checkout');
      window.print();
      const cleanup = () => {
        document.title = originalTitle;
        document.body.classList.remove('printing-checkout');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
    }, 150);
  };

  return (
    <div className="space-y-6 mt-6 pb-12 animate-fade-in">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Business Reports</h2>
            <button 
              onClick={toggleFinancials} 
              className="p-1.5 hover:bg-slate-100 active:bg-slate-200 text-slate-500 rounded-xl border border-slate-200/60 bg-white transition shadow-xs flex items-center gap-1.5 text-xs font-bold"
            >
              {hideFinancials ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{hideFinancials ? "Show" : "Hide"} Balances</span>
            </button>
          </div>
          <p className="text-sm text-slate-500 font-medium">Analyze shop performance and financial trends</p>
        </div>

        <button
          onClick={handlePrintReport}
          disabled={filteredCheckouts.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition shadow-md shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Printer className="h-4 w-4 text-secondary" />
          <span>Print Periodic Report</span>
        </button>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Preset Selector Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'this_week', label: 'This Week' },
            { id: 'last_week', label: 'Last Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetSelect(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                dateRange.preset === p.id
                  ? 'bg-primary border-primary text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value, preset: 'custom' }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value, preset: 'custom' }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {filteredCheckouts.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-12 text-center shadow-xs">
          <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Checkout Data Available</h3>
          <p className="text-xs text-slate-400 mt-1">Please select another date range or record a checkout first.</p>
        </div>
      ) : (
        <>
          {/* KPI GRID */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Revenue</span>
                <strong className="text-xl font-black text-slate-800 mt-1 block leading-none">
                  {renderValue(`${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES`)}
                </strong>
                <span className="text-[10px] text-slate-400 font-semibold block mt-2">Cash & M-Pesa Sales Collected</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>Immediate Revenue</span>
              </div>
            </div>

            {/* Outflows */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflows</span>
                <strong className="text-xl font-black text-amber-700 mt-1 block leading-none">
                  {renderValue(`${summary.totalOutflows.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES`)}
                </strong>
                <span className="text-[10px] text-slate-400 font-semibold block mt-2">Total Paid to Suppliers</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-[10px] font-extrabold text-amber-600">
                <TrendingDown className="h-3 w-3" />
                <span>Supplier Payments</span>
              </div>
            </div>

            {/* Business Volume */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Business Volume</span>
                <strong className="text-xl font-black text-primary mt-1 block leading-none">
                  {renderValue(`${summary.totalBusinessVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES`)}
                </strong>
                <span className="text-[10px] text-slate-400 font-semibold block mt-2">Total Shop Volume (Sales + Credit)</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-600">
                <ArrowUpRight className="h-3 w-3" />
                <span>Gross Volume</span>
              </div>
            </div>

            {/* Credit Ratio */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Credit Sales Ratio</span>
                <strong className="text-xl font-black text-rose-600 mt-1 block leading-none">
                  {renderValue(`${summary.creditRatio.toFixed(1)}%`)}
                </strong>
                <span className="text-[10px] text-slate-400 font-semibold block mt-2">Of total sales are credit book</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2 text-[9px] font-extrabold text-slate-500">
                <div>
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">New Issued</span>
                  <span className="text-rose-600">{renderValue(`${summary.creditIssued.toFixed(0)} KES`)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Recovered</span>
                  <span className="text-emerald-600">{renderValue(`${summary.debtRecovered.toFixed(0)} KES`)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* VISUAL TREND CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Daily Volume SVG Trend Line Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs lg:col-span-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Revenue vs Business Volume Trend</h3>
              
              <div className="relative h-60 w-full">
                {/* SVG Visual Chart */}
                {(() => {
                  const padding = 30;
                  const chartHeight = 200;
                  const chartWidth = 500;
                  
                  const maxVal = Math.max(
                    ...filteredCheckouts.map(c => Math.max(parseFloat(c.total_cash_realized || 0), parseFloat(c.total_business_volume || 0))),
                    1000
                  ) * 1.1;

                  const pointsRealized = filteredCheckouts.map((c, i) => {
                    const x = padding + (i / Math.max(filteredCheckouts.length - 1, 1)) * (chartWidth - padding * 2);
                    const y = chartHeight - padding - (parseFloat(c.total_cash_realized || 0) / maxVal) * (chartHeight - padding * 2);
                    return `${x},${y}`;
                  }).join(' ');

                  const pointsVolume = filteredCheckouts.map((c, i) => {
                    const x = padding + (i / Math.max(filteredCheckouts.length - 1, 1)) * (chartWidth - padding * 2);
                    const y = chartHeight - padding - (parseFloat(c.total_business_volume || 0) / maxVal) * (chartHeight - padding * 2);
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                        const yVal = chartHeight - padding - ratio * (chartHeight - padding * 2);
                        return (
                          <g key={index}>
                            <line x1={padding} y1={yVal} x2={chartWidth - padding} y2={yVal} stroke="#e2e8f0" strokeDasharray="3,3" />
                            <text x={padding - 5} y={yVal + 3} textAnchor="end" fontSize="8" fill="#94a3b8" fontWeight="bold">
                              {((maxVal * ratio) / 1000).toFixed(0)}k
                            </text>
                          </g>
                        );
                      })}

                      {/* X axis labels (Max 7 items displayed) */}
                      {filteredCheckouts.filter((_, idx) => {
                        const step = Math.max(Math.ceil(filteredCheckouts.length / 6), 1);
                        return idx % step === 0 || idx === filteredCheckouts.length - 1;
                      }).map((c, idx, arr) => {
                        const origIdx = filteredCheckouts.indexOf(c);
                        const x = padding + (origIdx / Math.max(filteredCheckouts.length - 1, 1)) * (chartWidth - padding * 2);
                        const labelDate = c.checkout_date.substring(5); // MM-DD
                        return (
                          <text key={idx} x={x} y={chartHeight - 5} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="bold">
                            {labelDate}
                          </text>
                        );
                      })}

                      {/* Line paths */}
                      {filteredCheckouts.length > 1 && (
                        <>
                          {/* Business Volume (Blue line) */}
                          <polyline fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pointsVolume} />
                          {/* Revenue (Emerald line) */}
                          <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pointsRealized} />
                        </>
                      )}

                      {/* Dots on points */}
                      {filteredCheckouts.map((c, i) => {
                        const x = padding + (i / Math.max(filteredCheckouts.length - 1, 1)) * (chartWidth - padding * 2);
                        const yRealized = chartHeight - padding - (parseFloat(c.total_cash_realized || 0) / maxVal) * (chartHeight - padding * 2);
                        const yVolume = chartHeight - padding - (parseFloat(c.total_business_volume || 0) / maxVal) * (chartHeight - padding * 2);
                        return (
                          <g key={i}>
                            <circle cx={x} cy={yVolume} r="3" fill="#4f46e5" stroke="#ffffff" strokeWidth="1" />
                            <circle cx={x} cy={yRealized} r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>

              {/* Legend */}
              <div className="flex gap-4 justify-center mt-3 text-[10px] font-extrabold">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  <span>Revenue Earned</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
                  <span>Business Volume</span>
                </div>
              </div>
            </div>

            {/* 2. Inflow / Outflow Channels (M-Pesa vs Cash) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Cash vs M-Pesa Breakdown</h3>

              <div className="space-y-6">
                {/* Money in hand (Section 1 totals) */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Aggregate Till & Drawer Balances</span>
                  {(() => {
                    const cash = summary.totalCashOnHand;
                    const mpesa = summary.totalMpesaOnHand;
                    const total = cash + mpesa;
                    const cashPct = total > 0 ? (cash / total) * 100 : 0;
                    const mpesaPct = total > 0 ? (mpesa / total) * 100 : 0;

                    return (
                      <div className="space-y-2">
                        {/* Custom visual horizontal stacked bar */}
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="bg-primary" style={{ width: `${cashPct}%` }} title={`Cash: ${cashPct.toFixed(1)}%`}></div>
                          <div className="bg-secondary" style={{ width: `${mpesaPct}%` }} title={`M-Pesa: ${mpesaPct.toFixed(1)}%`}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <div className="flex items-center gap-1.5 text-primary">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            <span>Cash: {renderValue(`${cash.toFixed(0)} KES`)} ({cashPct.toFixed(0)}%)</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-secondary-dark">
                            <span className="w-2 h-2 bg-secondary rounded-full"></span>
                            <span>M-Pesa: {renderValue(`${mpesa.toFixed(0)} KES`)} ({mpesaPct.toFixed(0)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Supplier outflows (Section 2 totals) */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Aggregate Supplier Outflows</span>
                  {(() => {
                    // Outflow values extracted
                    let outflowsCash = 0;
                    let outflowsMpesa = 0;
                    filteredCheckouts.forEach(c => {
                      outflowsCash += parseFloat(c.supplier_cash_paid || 0);
                      outflowsMpesa += parseFloat(c.supplier_mpesa_paid || 0);
                    });
                    const total = outflowsCash + outflowsMpesa;
                    const cashPct = total > 0 ? (outflowsCash / total) * 100 : 0;
                    const mpesaPct = total > 0 ? (outflowsMpesa / total) * 100 : 0;

                    return (
                      <div className="space-y-2">
                        {/* Custom stacked bar */}
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="bg-slate-700" style={{ width: `${cashPct}%` }} title={`Cash: ${cashPct.toFixed(1)}%`}></div>
                          <div className="bg-amber-500" style={{ width: `${mpesaPct}%` }} title={`M-Pesa: ${mpesaPct.toFixed(1)}%`}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <span className="w-2 h-2 bg-slate-700 rounded-full"></span>
                            <span>Cash: {renderValue(`${outflowsCash.toFixed(0)} KES`)} ({cashPct.toFixed(0)}%)</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-600">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            <span>M-Pesa: {renderValue(`${outflowsMpesa.toFixed(0)} KES`)} ({mpesaPct.toFixed(0)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED LOG */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daily Records in Period</h3>
              <span className="px-2.5 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 rounded-md border border-slate-100">
                {filteredCheckouts.length} Closes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-4">Till Count</th>
                    <th className="py-3 px-4">Supplier Outflows</th>
                    <th className="py-3 px-4">New Debts Issued</th>
                    <th className="py-3 px-4">Revenue Earned</th>
                    <th className="py-3 px-4">Net Position</th>
                    <th className="py-3 px-4">Business Volume</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                  {filteredCheckouts.slice().reverse().map((c) => {
                    const tillCount = (parseFloat(c.total_cash_collected) || 0) + (parseFloat(c.total_mpesa_collected) || 0);
                    const totalOutflows = (parseFloat(c.supplier_cash_paid) || 0) + (parseFloat(c.supplier_mpesa_paid) || 0);
                    const revenue = parseFloat(c.total_cash_realized) || (tillCount + totalOutflows);
                    const businessVolume = parseFloat(c.total_business_volume) || (revenue + parseFloat(c.customer_credit_issued || 0));
                    const net = parseFloat(c.net_cash_position) || tillCount;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-6 font-bold text-slate-800">{c.checkout_date}</td>
                        <td className="py-3.5 px-4">{renderValue(tillCount.toFixed(2))}</td>
                        <td className="py-3.5 px-4 text-amber-700">{renderValue(totalOutflows.toFixed(2))}</td>
                        <td className="py-3.5 px-4 text-rose-600">{renderValue(parseFloat(c.customer_credit_issued || 0).toFixed(2))}</td>
                        <td className="py-3.5 px-4 text-emerald-700">{renderValue(revenue.toFixed(2))}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            net >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {renderValue(net.toFixed(2))} KES
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-primary">{renderValue(businessVolume.toFixed(2))}</td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => setSelectedCheckout(c)}
                            className="p-1 hover:bg-slate-100 hover:text-primary text-slate-400 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                            title="View Daily Details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── DAILY DETAILS MODAL (DUPLICATED FROM DAILYCHECKOUT REGULATORY MODAL) ── */}
      {selectedCheckout && (() => {
        const cash = parseFloat(selectedCheckout.total_cash_collected) || 0;
        const mpesa = parseFloat(selectedCheckout.total_mpesa_collected) || 0;
        const subTotal = cash + mpesa;
        const net = parseFloat(selectedCheckout.net_cash_position) || subTotal;
        const creditIssued = parseFloat(selectedCheckout.customer_credit_issued || 0);
        const supplierPayables = parseFloat(selectedCheckout.supplier_debt_created || 0);
        const supplierCash = parseFloat(selectedCheckout.supplier_cash_paid || 0);
        const supplierMpesa = parseFloat(selectedCheckout.supplier_mpesa_paid || 0);
        const totalOutflows = supplierCash + supplierMpesa;
        const debtRecovered = parseFloat(selectedCheckout.customer_debt_recovered || 0);
        
        const cashRealized = subTotal + totalOutflows;
        const businessVolume = cashRealized + creditIssued;
        const isNetPositive = net >= 0;

        return (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-primary/40 backdrop-blur-xs animate-fade-in"
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
                  <p className="text-sm font-black text-primary">{renderValue(cash.toFixed(2))}</p>
                </div>

                {/* M-Pesa */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">M-Pesa</span>
                  <p className="text-sm font-black text-secondary-dark">{renderValue(mpesa.toFixed(2))}</p>
                </div>

                {/* Business Volume */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Business Vol</span>
                  <p className="text-sm font-black text-primary">{renderValue(businessVolume.toFixed(2))}</p>
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
                    <strong className="text-amber-900 font-extrabold">{renderValue(totalOutflows.toFixed(2))} KES</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Cash Paid: {renderValue(supplierCash.toFixed(2))} KES</span>
                    <span>M-Pesa Paid: {renderValue(supplierMpesa.toFixed(2))} KES</span>
                  </div>
                </div>

                {/* Section 3: Credit Movements */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-800">Credit Movements</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span className="text-rose-600">New Credit: {renderValue(creditIssued.toFixed(2))} KES</span>
                    <span className="text-emerald-700">Recovered: {renderValue(debtRecovered.toFixed(2))} KES</span>
                  </div>
                </div>

                {/* Realized Revenue */}
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-2xl flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-700">Total Revenue Earned Today:</span>
                  <strong className="text-primary font-black">{renderValue(cashRealized.toFixed(2))} KES</strong>
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
            </div>
          </div>
        );
      })()}

      {/* ── PRINT VIEW LAYOUT ── */}
      {printReport && (
        <PeriodicReportPrint
          startDate={printReport.startDate}
          endDate={printReport.endDate}
          checkouts={printReport.checkouts}
          summary={printReport.summary}
          hideFinancials={hideFinancials}
        />
      )}
    </div>
  );
}
