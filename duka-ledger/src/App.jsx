// Imports
import { useState, useEffect } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { db, connector } from './powersync/SetupPowerSync';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import Layout from './components/common/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { CustomerLedger } from './features/ledger/CustomerLedger';
import { SupplierLedger } from './features/ledger/SupplierLedger';
import { DailyCheckout } from './features/ledger/DailyCheckout';
import { CatalogAdmin } from './features/catalog/CatalogAdmin';
import { CatalogSearch } from './features/catalog/CatalogSearch';

import { Loader2 } from 'lucide-react';

export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initDb() {
      try {
        await db.init();
        await db.connect(connector);
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize PowerSync client:', error);
      }
    }
    initDb();
  }, []);

  if (!initialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans">
        <div className="flex flex-col items-center max-w-sm px-6 text-center space-y-6 animate-fade-in">
          {/* Animated Spinner Shell */}
          <div className="relative flex items-center justify-center h-16 w-16">
            {/* Spinning accent ring */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
            {/* Inner rotating icon */}
            <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
              <Loader2 className="h-4 w-4 text-indigo-600 animate-spin"/>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-black tracking-tight text-slate-800">Neema Gen Shop</h3>
            <p className="text-xs font-bold text-slate-500 tracking-wide">Please wait a moment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <PowerSyncContext.Provider value={db}>
          <Routes>
            {/* ROOT REDIRECTS */}
            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* AUTHENTICATION ROUTES */}
            <Route path="/login" element={<LoginPage />} />

            {/* MAIN PLATFORM ROUTES */}
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/home" element={<DashboardOverview />} />
                <Route path="/customers" element={<CustomerLedger />} />
                <Route path="/suppliers" element={<SupplierLedger />} />
                <Route path="/checkout" element={<DailyCheckout />} />
                <Route path="/lookup" element={<CatalogSearch />} />
                <Route path="/catalog" element={<CatalogAdmin />} />
              </Route>
            </Route>
          </Routes>
        </PowerSyncContext.Provider>
      </AuthProvider>
    </ToastProvider>
  );
}