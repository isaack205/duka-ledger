import { useStatus } from '@powersync/react';

export function SyncIndicator() {
  const status = useStatus();

  return (
    <div className="sync-status-bar" style={{ padding: '8px', fontSize: '14px' }}>
      <span style={{ marginRight: '15px' }}>
        Status: {status.connected ? '🟢 Online' : '🔴 Offline Mode'}
      </span>
      <span>
        {status.downloading ? '🔄 Syncing cloud changes...' : '✅ Database updated'}
      </span>
    </div>
  );
}