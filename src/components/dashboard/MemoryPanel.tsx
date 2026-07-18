import { MemoryEntry } from '@/lib/templates';
import { tagClass, timeAgo } from './utils';

interface MemoryPanelProps {
  memory: MemoryEntry[];
  newMemoryKeys: Set<string>;
  loading: boolean;
  error: string | null;
}

export function MemoryPanel({ memory, newMemoryKeys, loading, error }: MemoryPanelProps) {
  return (
    <aside className="island island-inspector">
      <div className="brand-header">
        <h2 style={{ fontSize: 16, fontWeight: 500 }}>Repository Memory</h2>
        <span className="pill" style={{ marginLeft: 'auto', borderColor: 'var(--border-glass)' }}>
          {memory.length}
        </span>
      </div>

      <div className="scroll-area" style={{ paddingTop: 24 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading memory…</div>}
        {error && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--status-red)' }} role="alert" aria-live="polite">
            {error}
          </div>
        )}
        {!loading && !error && memory.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No learned conventions yet.</div>
        )}
        {!loading &&
          !error &&
          memory.map((entry) => (
            <div key={entry.key} className="memory-card" style={{ borderColor: newMemoryKeys.has(entry.key) ? 'var(--accent-secondary)' : '' }}>
              <div className="memory-key">{entry.key}</div>
              <div className="memory-val">{entry.value}</div>
              <div className="flex-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                <span className={`pill ${tagClass(entry.category === 'dismissed' ? 'memory' : 'good')}`}>{entry.category}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(entry.createdAt)}</span>
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}
