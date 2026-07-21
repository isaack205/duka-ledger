import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/supabaseClient';
import { usePowerSync } from '@powersync/react';

// In-memory cache of user profile names: { [uuid]: displayName }
const operatorCache = {};

export function useOperators(recordedByIds = []) {
  const db = usePowerSync(); // ← Local SQLite database instance
  const [operators, setOperators] = useState({ ...operatorCache });
  const [currentUserId, setCurrentUserId] = useState(null);

  const prevIdsKey = useRef('');
  const idsKey = [...recordedByIds].sort().join(',');

  // 1. Identify current logged-in user (READS FROM LOCAL CACHE)
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        // FIXED: Reads local session token without sending network requests offline
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user) {
          setCurrentUserId(user.id);
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operator';
          operatorCache[user.id] = name;
          setOperators(prev => ({ ...prev, [user.id]: name }));
        }
      } catch (err) {
        console.error('Error fetching current auth user:', err);
      }
    }
    fetchCurrentUser();
  }, []);

  // 2. Fetch and resolve other operator profiles (QUERIES LOCAL POWERSYNC)
  useEffect(() => {
    if (!idsKey) return;

    const ids = idsKey ? idsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0) return;

    const pendingIds = ids.filter(
      id => id && !operatorCache[id] && id !== currentUserId
    );

    if (pendingIds.length === 0) {
      setOperators({ ...operatorCache });
      return;
    }

    async function fetchProfiles() {
      const resolved = {};
      
      try {
        // Queries local PowerSync database table instantly offline
        const placeholders = pendingIds.map(() => '?').join(',');
        const profiles = await db.getAll(
          `SELECT id, full_name, email FROM profiles WHERE id IN (${placeholders})`,
          pendingIds
        );

        if (profiles && profiles.length > 0) {
          profiles.forEach(p => {
            const name = p.full_name || p.email?.split('@')[0] || `Operator-${p.id.slice(0, 4)}`;
            operatorCache[p.id] = name;
            resolved[p.id] = name;
          });
        }
      } catch (err) {
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
  }, [idsKey, currentUserId, db]);

  return operators;
}