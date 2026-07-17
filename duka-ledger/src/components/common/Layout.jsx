import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useStatus } from '@powersync/react';
import { supabase } from '../../supabase/supabaseClient';
import { Sidebar } from './Sidebar';
import { Menu, X, Database, Wifi, WifiOff, LogOut, Store, ChevronDown, Calendar } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const status = useStatus();
  
  // App state hooks
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: 'Loading...', initial: '..' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSyncTooltip, setShowSyncTooltip] = useState(false);

  // Monitor active user auth session dynamically from Supabase
  useEffect(() => {
    async function fetchUserSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const initial = displayName.substring(0, 2).toUpperCase();
        setUserProfile({ name: displayName, initial });
      }
    }
    fetchUserSession();
  }, []);

  const syncBtnRef = useRef(null);

  // Dismiss PowerSync status tooltip when clicking outside on mobile
  useEffect(() => {
    function handleClickOutside(event) {
      if (syncBtnRef.current && !syncBtnRef.current.contains(event.target)) {
        setShowSyncTooltip(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Monitor browser connectivity states
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

  // Evaluate live data sync operations on local SQLite instance
  const isSyncing = status?.dataFlowStatus?.downloading || status?.dataFlowStatus?.uploading;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formattedDate = new Date().toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <div className="flex h-screen bg-neutral-bg overflow-hidden w-screen font-sans">
      
      {/* DESKTOP SIDEBAR NAVIGATION */}
      <div className="hidden md:flex md:w-64 md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* MOBILE SIDEBAR DRAWERS */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-primary/40 backdrop-blur-xs animate-fade-in" 
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Drawer content wrapper */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-primary animate-slide-over shadow-2xl">
            <div className="absolute top-4 right-4 z-55">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {/* Custom sidebar rendering for mobile layout */}
            <Sidebar isMobile onClose={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* MAIN PLATFORM CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* TOP NAVBAR HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 no-print shadow-xs">
          
          {/* Left navbar section */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu toggler */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-primary hover:bg-slate-50 transition focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo and store branding name */}
            <Link to="/home" className="flex items-center gap-2.5 hover:opacity-90 transition">
              <div className="h-9 w-9 bg-primary text-white rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
                <Store className="h-5 w-5 text-secondary" />
              </div>
              <span className="font-extrabold text-primary text-base tracking-tight">
                Neema Gen Shop
              </span>
            </Link>
          </div>

          {/* Right navbar section (Status indicators, profiles) */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* POWERSYNC STATUS INDICATOR CARD */}
            <div className="relative" ref={syncBtnRef}>
              <button 
                onMouseEnter={() => setShowSyncTooltip(true)}
                onMouseLeave={() => setShowSyncTooltip(false)}
                onClick={() => setShowSyncTooltip(!showSyncTooltip)}
                className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-semibold transition duration-200 outline-none cursor-pointer ${
                  isSyncing 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-emerald-50/50 border-secondary/10 text-secondary-dark'
                }`}
              >
                <Database className={`h-4 w-4 ${isSyncing ? 'animate-bounce text-blue-500' : 'text-secondary'}`} />
                <span className="hidden sm:inline">
                  {isSyncing ? 'Syncing...' : 'Synced'}
                </span>
              </button>

              {/* Custom Tooltip */}
              {showSyncTooltip && (
                <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-slate-800 text-white text-[11px] font-bold p-2.5 rounded-xl shadow-lg border border-slate-700/60 leading-normal animate-fade-in text-left">
                  <p className="font-extrabold uppercase text-[9px] text-slate-400 tracking-wider mb-1">PowerSync Status</p>
                  <p className="text-slate-200">
                    {isSyncing ? 'Syncing changes with cloud database' : 'All offline changes uploaded.'}
                  </p>
                  <p className="mt-1.5 border-t border-slate-700/50 pt-1.5 text-secondary">
                    Last Synced: {status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}
                  </p>
                </div>
              )}
            </div>

            {/* CONNECTIVITY INDICATOR BADGE */}
            <div 
              title={isOnline ? "Broadband network connected (Online)" : "Network disconnected (Offline Local Mode)"}
              className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-semibold transition duration-200 ${
                isOnline 
                  ? 'bg-emerald-50/50 border-secondary/10 text-secondary-dark' 
                  : 'bg-accent/5 border-accent/10 text-accent animate-pulse'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-secondary" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-accent" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>

            {/* Date display (Desktop only) */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-400 border border-slate-100 bg-slate-50/50 px-3 py-1.5 rounded-lg">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formattedDate}</span>
            </div>

            <span className="h-6 w-px bg-slate-200 block"></span>

            {/* PROFILE MENU DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1 p-1 hover:bg-slate-50 rounded-lg transition duration-150 focus:outline-none animate-fade-in"
              >
                <div className="h-9 w-9 bg-primary hover:bg-primary-dark text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition duration-150">
                  {userProfile.initial}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
              </button>

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100">
                    <div className="px-4 py-2.5 border-b border-slate-50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Workspace</p>
                      <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{userProfile.name}</p>
                    </div>
                    <button 
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-accent hover:bg-accent/5 flex items-center gap-2 transition cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out Account</span>
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* COMPONENT INTERFACES CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </div>

    </div>
  );
}