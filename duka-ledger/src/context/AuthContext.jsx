import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';

const AuthContext = createContext({ user: null, role: 'member', isAdmin: false, loading: true });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || 'member');
  const [loading, setLoading] = useState(true);

  // Helper to fetch user role from Supabase profiles table
  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role from profiles:', error);
        return; // Preserve existing role in localStorage/state on network error
      }
      
      if (data && data.role) {
        localStorage.setItem('userRole', data.role);
        setRole(data.role);
      } else {
        localStorage.setItem('userRole', 'member');
        setRole('member');
      }
    } catch (err) {
      console.error('Failed to fetch user role from profiles:', err);
    }
  };

  useEffect(() => {
    // 1. Check current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchUserRole(activeUser.id).then(() => setLoading(false));
      } else {
        localStorage.removeItem('userRole');
        setRole('member');
        setLoading(false);
      }
    });

    // 2. Listen for login/logout auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchUserRole(activeUser.id);
      } else {
        localStorage.removeItem('userRole');
        setRole('member');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, isAdmin: role === 'admin', loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);