import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Mail, KeyRound, Lock, Store, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

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
      toast.success('Welcome back!', 'Access to Neema Gen Shop has been granted.');
      navigate('/home');
    } catch (err) {
      const errMsg = err.message || 'Failed to sign in';
      setAuthError(errMsg);
      toast.error('Authentication Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center p-4 font-sans selection:bg-primary/10 selection:text-primary">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/60 shadow-xl overflow-hidden p-8 space-y-8 animate-zoom-in">
        
        {/* LOGO AND BRANDING */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/15 border border-white/10">
            <Store className="h-6 w-6 text-secondary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-primary tracking-tight">Neema Gen Shop</h2>
            <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Digital Register Ledger</p>
          </div>
        </div>

        {/* WELCOME BANNER */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-primary">Secure Operator Portal</h4>
            <p className="text-[11px] text-slate-500 font-medium">Verify credentials to connect to local SQLite store.</p>
          </div>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleSignIn} className="space-y-5">
          {/* EMAIL FIELD */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 block" htmlFor="email">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@neemagen.com"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-primary bg-slate-50/30 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition duration-150"
              />
            </div>
          </div>

          {/* PASSWORD FIELD */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500" htmlFor="password">Security Password</label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-primary bg-slate-50/30 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="bg-accent/5 border border-accent/10 text-accent rounded-xl p-3 text-xs font-semibold animate-fade-in">
              ⚠️ {authError}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold shadow-md shadow-primary/10 transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>Authenticating Device...</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-secondary" />
                <span>Secure Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* FOOTER */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">NEEMA LEDGER • v1.2.0 • SECURE NODE</p>
        </div>

      </div>
    </div>
  );
}