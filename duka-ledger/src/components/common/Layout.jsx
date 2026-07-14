import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/supabaseClient';
import { SyncIndicator } from '../SyncIndicator';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/home', icon: '📊' },
    { name: 'Customer Ledger', path: '/customers', icon: '👥' },
    { name: 'Supplier Ledger', path: '/suppliers', icon: '📦' },
    { name: 'Daily Closeout', path: '/checkout', icon: '📝' },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
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

      {/* CORE FRAMEWORK WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER TOOLBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="text-xs font-bold text-gray-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <button 
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* COMPONENT INTERFACES */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>

    </div>
  );
}