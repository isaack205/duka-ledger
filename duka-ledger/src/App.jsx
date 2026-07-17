// Imports
import { useState, useEffect } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { db, connector } from './powersync/SetupPowerSync';
import { AuthProvider } from './context/AuthContext';

import Layout from './components/common/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { CustomerLedger } from './features/ledger/CustomerLedger';
import { SupplierLedger } from './features/ledger/SupplierLedger';
import { DailyCheckout } from './features/ledger/DailyCheckout';
import { CatalogAdmin } from './features/catalog/CatalogAdmin';
import { CatalogSearch } from './features/catalog/CatalogSearch';

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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-sm font-semibold tracking-wide">Loading offline store...</p>
      </div>
    );
  }

  return (
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
  );
}