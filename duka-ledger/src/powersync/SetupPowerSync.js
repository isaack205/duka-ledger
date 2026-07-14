import { PowerSyncDatabase, WASQLiteOpenFactory } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { supabase } from '../supabase/supabaseClient';

class SupabaseConnector {
  constructor() {
    this.supabase = supabase;
  }

  async fetchCredentials() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error || !session) {
      console.warn("PowerSync connector: No active Supabase session found.");
      return null;
    }
    
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
      await transaction.complete();
    } catch (error) {
      console.error('Offline upload transaction failed, retrying later:', error);
      throw error;
    }
  }
}

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new WASQLiteOpenFactory({
    dbFilename: 'duka_ledger.db'
  })
});

export const connector = new SupabaseConnector();