import { Link, useLocation } from 'react-router-dom';

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/home', icon: '📊' },
    { name: 'Customer Ledger', path: '/customers', icon: '👥' },
    { name: 'Supplier Ledger', path: '/suppliers', icon: '📦' },
    { name: 'Daily Closeout', path: '/checkout', icon: '📝' },
    { name: 'Price Lookup', path: '/lookup', icon: '🔍' },
    { name: 'Manage Catalog', path: '/catalog', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 no-print">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-black tracking-wider text-blue-400">DukaLedger</h1>
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1">
          Offline Retail Engine
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center font-medium">
        v1.2.0 • Local-First Mode
      </div>
    </aside>
  );
}