// import { useState, useEffect } from 'react';
// import { PowerSyncContext } from '@powersync/react';
// import { db, connector } from './powersync/SetupPowerSync';
// import { supabase } from './supabase/supabaseClient';
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { SyncIndicator } from './components/SyncIndicator';
// import { CatalogManager } from './features/CatalogManager';
// import { CustomerLedger } from './features/ledger/CustomLedger';
// import { SupplierLedger } from './features/ledger/SupplierLedger';
// import { DailyCheckout } from './features/ledger/DailyCheckout';
// import './App.css';

// function MainAppContent() {
//   const { user } = useAuth();
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [authError, setAuthError] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleSignIn = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setAuthError('');
    
//     try {
//       const { error } = await supabase.auth.signInWithPassword({
//         email,
//         password,
//       });
//       if (error) throw error;
//     } catch (err) {
//       setAuthError(err.message || 'Failed to sign in');
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) {
//     return (
//       <div className="auth-container max-w-sm mx-auto mt-24 p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
//         <h2 className="text-xl font-bold text-gray-800 mb-2">DukaLedger Login</h2>
//         <p className="text-sm text-gray-500 mb-6">Please sign in to access the shop registry.</p>
        
//         <form onSubmit={handleSignIn} className="flex flex-col gap-4">
//           <div className="flex flex-col gap-1">
//             <label className="text-xs font-semibold text-gray-600" htmlFor="email">Email Address</label>
//             <input
//               id="email"
//               type="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder="Enter your email"
//               required
//               className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//           </div>

//           <div className="flex flex-col gap-1">
//             <label className="text-xs font-semibold text-gray-600" htmlFor="password">Password</label>
//             <input
//               id="password"
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               placeholder="Enter your password"
//               required
//               className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//           </div>

//           {authError && <p className="text-red-500 text-xs">{authError}</p>}

//           <button 
//             type="submit" 
//             disabled={loading}
//             className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
//           >
//             {loading ? 'Signing in...' : 'Sign In'}
//           </button>
//         </form>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <header className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200">
//         <h1 className="text-xl font-bold text-gray-800">DukaLedger</h1>
//         <div className="flex items-center gap-4">
//           <SyncIndicator />
//           <button 
//             onClick={() => supabase.auth.signOut()}
//             className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition"
//           >
//             Sign Out
//           </button>
//         </div>
//       </header>
      
//       <main className="max-w-6xl mx-auto p-6">
//         <p className="text-gray-600 mb-4">Welcome back, <span className="font-semibold">{user.email}</span>!</p>
//         <CatalogManager />
//         <CustomerLedger />
//         <SupplierLedger />
//         <DailyCheckout />
//       </main>
//     </div>
//   );
// }

// export default function App() {
//   const [initialized, setInitialized] = useState(false);

//   useEffect(() => {
//     async function initDb() {
//       try {
//         await db.init();
//         await db.connect(connector);
//         setInitialized(true);
//       } catch (error) {
//         console.error('Failed to initialize PowerSync client:', error);
//       }
//     }
//     initDb();
//   }, []);

//   if (!initialized) {
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-gray-50">
//         <p className="text-gray-500 text-sm">Loading offline store...</p>
//       </div>
//     );
//   }

//   return (
//     <AuthProvider>
//       <PowerSyncContext.Provider value={db}>
//         <MainAppContent />
//       </PowerSyncContext.Provider>
//     </AuthProvider>
//   );
// }

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
            </Route>
          </Route>
        </Routes>
      </PowerSyncContext.Provider>
    </AuthProvider>
  );
}