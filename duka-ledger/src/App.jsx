import { useState, useMemo } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { getDatabaseInstance } from './powersync/SetupPowerSync'; // 🟢 Import the helper function
import { supabase } from './supabase/supabaseClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncIndicator } from './components/SyncIndicator';
import './App.css';

function MainAppContent() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="auth-container" style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>DukaLedger Login</h2>
        <p>Please sign in to access the shop registry.</p>
        
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{ padding: '8px', fontSize: '16px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ padding: '8px', fontSize: '16px' }}
            />
          </div>

          {authError && <p style={{ color: 'red', margin: '0', fontSize: '14px' }}>{authError}</p>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '10px', fontSize: '16px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#f5f5f5' }}>
        <h1>DukaLedger</h1>
        <SyncIndicator />
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '5px 10px', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </header>
      
      <main style={{ padding: '20px' }}>
        <p>Welcome back, {user.email}! Let's start serving customers.</p>
      </main>
    </div>
  );
}

export default function App() {
  const db = useMemo(() => getDatabaseInstance(), []);

  return (
    <AuthProvider>
      <PowerSyncContext.Provider value={db}>
        <MainAppContent />
      </PowerSyncContext.Provider>
    </AuthProvider>
  );
}