// import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
// import { supabase } from '../../supabase/supabaseClient';
// import { SyncIndicator } from '../SyncIndicator';

// export default function Layout() {
//   const location = useLocation();
//   const navigate = useNavigate();

//   const navItems = [
//     { name: 'Dashboard', path: '/home', icon: '📊' },
//     { name: 'Customer Ledger', path: '/customers', icon: '👥' },
//     { name: 'Supplier Ledger', path: '/suppliers', icon: '📦' },
//     { name: 'Daily Closeout', path: '/checkout', icon: '📝' },
//     { name: 'Price Lookup', path: '/lookup', icon: '🔍' },
//     { name: 'Manage Catalog', path: '/catalog', icon: '⚙️' },
//   ];

//   const handleSignOut = async () => {
//     await supabase.auth.signOut();
//     navigate('/login');
//   };

//   return (
//     <div className="flex min-h-screen bg-gray-50">
      
//       {/* SIDEBAR NAVIGATION */}
//       <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
//         <div className="p-6 border-b border-slate-800">
//           <h1 className="text-xl font-black tracking-wider text-blue-400">DukaLedger</h1>
//           <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1">
//             Offline Retail Engine
//           </p>
//         </div>

//         <nav className="flex-1 p-4 space-y-1.5">
//           {navItems.map((item) => {
//             const isActive = location.pathname === item.path;
//             return (
//               <Link
//                 key={item.path}
//                 to={item.path}
//                 className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
//                   isActive
//                     ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
//                     : 'text-slate-300 hover:bg-slate-800 hover:text-white'
//                 }`}
//               >
//                 <span className="text-base">{item.icon}</span>
//                 <span>{item.name}</span>
//               </Link>
//             );
//           })}
//         </nav>

//         <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center font-medium">
//           v1.2.0 • Local-First Mode
//         </div>
//       </aside>

//       {/* CORE FRAMEWORK WORKSPACE */}
//       <main className="flex-1 flex flex-col overflow-hidden">
        
//         {/* HEADER TOOLBAR */}
//         <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
//           <div className="text-xs font-bold text-gray-400">
//             {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
//           </div>
//           <div className="flex items-center gap-4">
//             <SyncIndicator />
//             <button 
//               onClick={handleSignOut}
//               className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition"
//             >
//               Sign Out
//             </button>
//           </div>
//         </header>

//         {/* COMPONENT INTERFACES */}
//         <div className="flex-1 overflow-y-auto p-8">
//           <Outlet />
//         </div>
//       </main>

//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useStatus } from '@powersync/react';
import { supabase } from '../../supabase/supabaseClient';
import { Sidebar } from './Sidebar';

export default function Layout() {
  const navigate = useNavigate();
  const status = useStatus();
  
  // App state hooks
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: 'Loading...', initial: '..' });

  // 1. Monitor active user auth session dynamically from Supabase
  useEffect(() => {
    async function fetchUserSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Use full name from metadata if it exists, otherwise fall back to email username
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const initial = displayName.substring(0, 2).toUpperCase();
        setUserProfile({ name: displayName, initial });
      }
    }
    fetchUserSession();
  }, []);

  // 2. Monitor browser hardware connectivity states
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // 3. Evaluate live data sync operations on local SQLite instance
  const isSyncing = status?.dataFlowStatus?.downloading || status?.dataFlowStatus?.uploading;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden w-screen">
      
      {/* SIDEBAR COMPONENT (Hidden during page printing) */}
      <Sidebar />

      {/* CORE FRAMEWORK WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* HEADER TOOLBAR NAVBAR (Hidden during page printing) */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-40 no-print">
          <div className="text-xs font-bold text-gray-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="flex items-center gap-4">
            
            {/* POWERSYNC SYNC INDICATOR */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-gray-100 text-xs font-semibold">
              {isSyncing ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-blue-700 animate-pulse">Syncing Engine...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-emerald-700">Database Synced</span>
                </>
              )}
            </div>

            {/* INTERNET CONNECTIVITY BADGE */}
            <div>
              {isOnline ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                  ● Online
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 animate-pulse">
                  ⚠️ Offline Mode
                </span>
              )}
            </div>

            <span className="h-5 w-px bg-gray-200 block"></span>

            {/* PROFILE DROPDOWN MENU */}
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="h-9 w-9 bg-slate-950 hover:bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition duration-150"
              >
                {userProfile.initial}
              </button>

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Workspace</p>
                      <p className="text-sm font-bold text-gray-800 truncate">{userProfile.name}</p>
                    </div>
                    <button 
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                    >
                      🔒 Sign Out Account
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* COMPONENT INTERFACES CONTAINER */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>

    </div>
  );
}