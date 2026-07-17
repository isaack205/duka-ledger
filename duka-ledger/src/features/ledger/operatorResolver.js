import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/supabaseClient';

// In-memory cache of user profile names: { [uuid]: displayName }
const operatorCache = {};

export function useOperators(recordedByIds = []) {
  const [operators, setOperators] = useState({ ...operatorCache });
  const [currentUserId, setCurrentUserId] = useState(null);

  // Stable string key derived from sorted IDs — avoids re-running effect on every render
  // Use a ref so we can compare with previous value without adding it to deps
  const prevIdsKey = useRef('');
  const idsKey = [...recordedByIds].sort().join(',');

  // 1. Identify current logged-in user
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operator';
          // Cache current user
          operatorCache[user.id] = name;
          setOperators(prev => ({ ...prev, [user.id]: name }));
        }
      } catch (err) {
        console.error('Error fetching current auth user:', err);
      }
    }
    fetchCurrentUser();
  }, []);

  // 2. Fetch and resolve other operator profiles
  // Depend on idsKey (string) + currentUserId — both are stable primitives, no infinite loop
  useEffect(() => {
    if (!idsKey) return;

    const ids = idsKey ? idsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0) return;

    // Filter out IDs that are already cached or match currentUserId
    const pendingIds = ids.filter(
      id => id && !operatorCache[id] && id !== currentUserId
    );

    if (pendingIds.length === 0) {
      // All resolved or cached, update state to match cache
      setOperators({ ...operatorCache });
      return;
    }

    async function fetchProfiles() {
      const resolved = {};
      
      try {
        // Attempt query on profiles table in Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', pendingIds);

        if (!error && data) {
          data.forEach(p => {
            const name = p.full_name || p.email?.split('@')[0] || `Operator-${p.id.slice(0, 4)}`;
            operatorCache[p.id] = name;
            resolved[p.id] = name;
          });
        }
      } catch (err) {
        // Table profiles might not exist or be accessible. Silent fallback.
        console.debug('Profiles query skipped or failed, falling back to default labels:', err);
      }

      // Fill in fallback names for any IDs that failed to resolve
      pendingIds.forEach(id => {
        if (!operatorCache[id]) {
          const fallback = `Operator-${id.slice(0, 4).toUpperCase()}`;
          operatorCache[id] = fallback;
          resolved[id] = fallback;
        }
      });

      setOperators(prev => ({ ...prev, ...resolved }));
    }

    fetchProfiles();
  }, [idsKey, currentUserId]); // ← stable primitive deps, no infinite loop

  return operators;
}
