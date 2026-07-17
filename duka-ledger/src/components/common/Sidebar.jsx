import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, FileSpreadsheet, Search, Settings, Store } from 'lucide-react';

export function Sidebar({ isMobile, onClose }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/home', icon: LayoutDashboard },
    { name: 'Customer Ledger', path: '/customers', icon: Users },
    { name: 'Supplier Ledger', path: '/suppliers', icon: Package },
    { name: 'Daily Closeout', path: '/checkout', icon: FileSpreadsheet },
    { name: 'Price Lookup', path: '/lookup', icon: Search },
    { name: 'Manage Catalog', path: '/catalog', icon: Settings },
  ];

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-full h-full bg-primary text-white flex flex-col border-r border-slate-800/10 no-print select-none">
      
      {/* Brand logo details */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="h-9 w-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 shadow-inner">
          <Store className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-base font-black tracking-tight text-white leading-tight">Neema Gen</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            Digital Register
          </p>
        </div>
      </div>

      {/* Nav items container */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 border ${
                isActive
                  ? 'bg-white/10 text-white border-white/10 font-bold'
                  : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-secondary' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer information bar */}
      <div className="p-4 border-t border-white/5 text-[10px] text-slate-500 text-center font-bold tracking-wide">
        v1.2.0 • OFFLINE SYNC
      </div>
    </aside>
  );
}