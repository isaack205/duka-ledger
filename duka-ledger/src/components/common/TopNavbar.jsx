import { useState, useEffect } from 'react';
import { useStatus } from '@powersync/react';

export function TopNavbar() {
  const status = useStatus();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Monitor the browser's hardware network connection state
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

  // Determine if PowerSync is actively pushing/pulling local SQLite transactions
  const isSyncing = status?.dataFlowStatus?.downloading || status?.dataFlowStatus?.uploading;

  return (
    <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between sticky top-0 z-40 no-print">
      
      {/* LEFT: BRANDING OR APP NAME */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🏬</span>
        <span className="font-black text-slate-950 tracking-tight text-base hidden sm:inline">
          DukaLedger <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md ml-1">v1.0</span>
        </span>
      </div>

      {/* RIGHT: SYSTEM STATUSES & USER PROFILE */}
      <div className="flex items-center gap-4">
        
        {/* 1. POWERSYNC DATABASE SYNC INDICATOR */}
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

        {/* 2. INTERNET CONNECTIVITY BADGE */}
        <div className="flex items-center">
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

        {/* Divider separator line */}
        <span className="h-5 w-px bg-gray-200 block"></span>

        {/* 3. SETTINGS & PROFILE ACTION BUTTON DROPDOWN */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="h-9 w-9 bg-slate-950 hover:bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-xs transition duration-150 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
          >
            IK
          </button>

          {/* DROPDOWN CARD */}
          {showProfileMenu && (
            <>
              {/* Invisible full screen click overlay closer */}
              <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)}></div>
              
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Workspace</p>
                  <p className="text-sm font-bold text-gray-800 truncate">Isaac Kahura</p>
                </div>

                <button 
                  onClick={() => { alert('Settings Modal Placeholder'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-slate-50 flex items-center gap-2 transition"
                >
                  ⚙️ System Configurations
                </button>
                <button 
                  onClick={() => { alert('Backup Trigger Placeholder'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-slate-50 flex items-center gap-2 transition"
                >
                  💾 Force Local DB Compaction
                </button>
                
                <div className="border-t border-gray-100 mt-1.5 pt-1.5">
                  <button 
                    onClick={() => { alert('Closing session... (Clean local DB logs if needed)'); }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                  >
                    🔒 Close Register Run
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  );
}