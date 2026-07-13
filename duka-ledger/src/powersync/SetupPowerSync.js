import { PowerSyncDatabase, WASQLiteOpenFactory } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { supabase } from '../supabase/supabaseClient';

class SupabaseConnector {
  constructor() {
    this.supabase = supabase;
  }

  async fetchCredentials() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return null;
    return {
      endpoint: import.meta.env.VITE_POWERSYNC_URL,
      token: session.access_token,
      userId: session.user.id
    };
  }

  async uploadData(database) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (let op of transaction.crud) {
        const table = op.table;
        const row = { ...op.opData, id: op.id };

        if (op.op === 'PUT') {
          const { error } = await this.supabase.from(table).upsert(row);
          if (error) throw error;
        } else if (op.op === 'PATCH') {
          const { error } = await this.supabase.from(table).update(row).eq('id', op.id);
          if (error) throw error;
        } else if (op.op === 'DELETE') {
          const { error } = await this.supabase.from(table).delete().eq('id', op.id);
          if (error) throw error;
        }
      }
      await database.completeCrudTransaction(transaction.writeCheckpoint);
    } catch (error) {
      console.error('Offline upload transaction failed, retrying later:', error);
      throw error;
    }
  }
}

// Keep a single private database reference
let dbInstance = null;

export function getDatabaseInstance() {
  if (dbInstance) return dbInstance;

  // Initialize dynamically on demand
  dbInstance = new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
      dbFilename: 'duka_ledger.db'
    })
  });

  const connector = new SupabaseConnector();
  dbInstance.connect(connector);

  return dbInstance;
}