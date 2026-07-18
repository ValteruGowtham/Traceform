export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function formatMs(ms?: number) {
  return ms ? (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`) : '';
}

export function tagClass(tag: string) {
  return { bug: 'pill-danger', style: 'pill-warning', perf: 'pill-primary', memory: 'pill-memory', good: 'pill-success' }[tag] || 'pill-primary';
}

export function tagLabel(tag: string) {
  return { bug: 'Bug', style: 'Style', perf: 'Perf', memory: 'Memory', good: 'Clean' }[tag] || tag;
}
