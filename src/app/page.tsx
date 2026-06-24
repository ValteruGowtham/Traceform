'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PR_TEMPLATES, PrTemplate, AgentStep, ReviewResult, MemoryEntry } from '@/lib/templates';

// ─── Helpers ──────────────────────────────────────────────────────────────────
type TabId = 'trace' | 'diff' | 'review';
type RunState = 'idle' | 'running' | 'done' | 'error';

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatMs(ms?: number) { return ms ? (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`) : ''; }
function tagClass(tag: string) { return { bug: 'pill-danger', style: 'pill-warning', perf: 'pill-primary', memory: 'pill-memory', good: 'pill-success' }[tag] || 'pill-primary'; }
function tagLabel(tag: string) { return { bug: 'Bug', style: 'Style', perf: 'Perf', memory: 'Memory', good: 'Clean' }[tag] || tag; }

// ─── Sub-components ───────────────────────────────────────────────────────────
function DiffViewer({ diff }: { diff: string }) {
  return (
    <div className="code-block scroll-area">
      {diff.split('\n').map((line, i) => {
        let cls = '';
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'line-add';
        if (line.startsWith('-') && !line.startsWith('---')) cls = 'line-del';
        return (
          <div key={i} className={`code-line ${cls}`}>
            <span className="code-line-num">{i + 1}</span>
            <span>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

function TraceNode({ step, active, done, error, onClick, expanded }: { step: AgentStep; active: boolean; done: boolean; error: boolean; onClick: () => void; expanded: boolean }) {
  let stateClass = '';
  if (active) stateClass = 'active';
  else if (done) stateClass = 'done';
  else if (error) stateClass = 'error';

  return (
    <div className={`trace-node ${stateClass}`}>
      <div className="trace-icon-wrapper">
        {active ? <span className="spinner" /> : step.icon}
      </div>
      <div className="trace-content" onClick={onClick}>
        <div className="trace-header">
          <div className="trace-title">{step.label}</div>
          <div className="trace-meta">{formatMs(step.durationMs)}</div>
        </div>
        {expanded && step.output && (
          <div className="trace-output">
            {step.output.split('\n').map((l, i) => {
              let cls = '';
              if (/(✓|PASS|passed)/.test(l)) cls = 'out-pass';
              else if (/(✗|FAIL|failed|BUG)/.test(l)) cls = 'out-fail';
              else if (/(→|AGENT|NEW)/.test(l)) cls = 'out-info';
              else if (/(warn|Warning)/i.test(l)) cls = 'out-warn';
              return <div key={i} className={cls}>{l || ' '}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedTemplate, setSelectedTemplate] = useState<PrTemplate>(PR_TEMPLATES[0]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [memory, setMemory] = useState<MemoryEntry[]>(PR_TEMPLATES[0].repoMemory);
  const [newMemoryKeys, setNewMemoryKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>('trace');
  const [activeRepo, setActiveRepo] = useState(PR_TEMPLATES[0].repo);

  const traceEndRef = useRef<HTMLDivElement>(null);
  const repos = Array.from(new Set(PR_TEMPLATES.map(t => t.repo)));

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (steps.length > 0) {
      setExpandedSteps(prev => {
        const next = new Set(prev);
        steps.forEach(s => { if (s.status !== 'pending') next.add(s.id); });
        return next;
      });
    }
  }, [steps]);

  useEffect(() => { if (reviewResult) setTimeout(() => setActiveTab('review'), 500); }, [reviewResult]);

  const handleSelectTemplate = (t: PrTemplate) => {
    setSelectedTemplate(t); setActiveRepo(t.repo); setMemory(t.repoMemory); setNewMemoryKeys(new Set());
    setSteps([]); setReviewResult(null); setRunState('idle'); setActiveTab('trace');
  };

  const runReview = useCallback(() => {
    if (runState === 'running') return;
    setRunState('running'); setSteps([]); setReviewResult(null); setNewMemoryKeys(new Set()); setActiveTab('trace');
    const ctrl = new AbortController();

    fetch('/api/simulator/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: selectedTemplate.id, memory }), signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const { event, data } = JSON.parse(line.slice(6));
            if (event === 'step') {
              const step = data as AgentStep;
              setSteps(prev => {
                const idx = prev.findIndex(s => s.id === step.id);
                if (idx === -1) return [...prev, step];
                const next = [...prev]; next[idx] = step; return next;
              });
            } else if (event === 'complete') {
              setReviewResult(data as ReviewResult);
            } else if (event === 'memory') {
              const entries = data as MemoryEntry[];
              setMemory(prev => {
                const m = new Map(prev.map(e => [e.key, e]));
                entries.forEach(e => m.set(e.key, e));
                return Array.from(m.values());
              });
              setNewMemoryKeys(prev => { const n = new Set(prev); entries.forEach(e => n.add(e.key)); return n; });
            }
          } catch {}
        }
      }
      setRunState('done');
    }).catch(e => { if (e.name !== 'AbortError') setRunState('error'); });
    return () => ctrl.abort();
  }, [selectedTemplate, memory, runState]);

  return (
    <>
      <div className="mesh-bg" />
      <div className="app-container">
        
        {/* LEFT: Sidebar Island */}
        <aside className="island island-sidebar">
          <div className="brand-header">
            <div className="brand-icon" style={{ fontSize: 22 }}>⬡</div>
            <div className="brand-text">
              <h1>Traceform</h1>
              <span>Execution-Backed Review</span>
            </div>
          </div>
          
          <div className="section-title">Repositories</div>
          <div className="scroll-area" style={{ flex: 'none', paddingBottom: 0 }}>
            {repos.map(r => (
              <div key={r} className={`list-item ${activeRepo === r ? 'active' : ''}`} onClick={() => setActiveRepo(r)}>
                <div className="item-icon">📁</div>
                <div className="item-details">
                  <div className="item-title">{r.split('/')[1]}</div>
                  <div className="item-subtitle">{r.split('/')[0]}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title">Test Scenarios</div>
          <div className="scroll-area">
            {PR_TEMPLATES.filter(t => t.repo === activeRepo).map(t => (
              <div key={t.id} className={`list-item ${selectedTemplate.id === t.id ? 'active' : ''}`} onClick={() => handleSelectTemplate(t)}>
                <div className="item-details">
                  <div className="item-title">{t.title}</div>
                  <div className="item-subtitle" style={{marginBottom: 8}}>{t.description}</div>
                  <span className={`pill ${tagClass(t.tag)}`}>{tagLabel(t.tag)}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-action" onClick={runReview} disabled={runState === 'running'}>
            {runState === 'running' ? <><span className="spinner"/> Analyzing PR...</> :             <>▶ Analyze PR</>}
          </button>
        </aside>

        {/* MIDDLE: Main Display Island */}
        <main className="island island-main">
          <div className="brand-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '24px' }}>
            <div className="flex-row" style={{ width: '100%', justifyContent: 'space-between' }}>
              <div className="flex-row">
                <span className="pill pill-primary">PR #{selectedTemplate.pr.number}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedTemplate.pr.author}</span>
              </div>
              <span className="pill" style={{ borderColor: 'var(--border-glass)' }}>{selectedTemplate.pr.branch}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 500 }}>{selectedTemplate.pr.title}</h2>
          </div>

          <div className="tab-bar">
            <button className={`tab ${activeTab === 'trace' ? 'active' : ''}`} onClick={() => setActiveTab('trace')}>
              ⚡ Execution Trace
            </button>
            <button className={`tab ${activeTab === 'diff' ? 'active' : ''}`} onClick={() => setActiveTab('diff')}>
              📋 Diff
            </button>
            <button className={`tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
              📝 Review Result
            </button>
          </div>

          <div className="scroll-area" style={{ padding: '24px' }}>
            {activeTab === 'trace' && (
              <div className="trace-view">
                {steps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    Ready to run execution-backed review on PR #{selectedTemplate.pr.number}.
                  </div>
                ) : steps.map(step => (
                  <TraceNode 
                    key={step.id} step={step} 
                    active={step.status === 'running'} 
                    done={step.status === 'done'}
                    error={step.status === 'error'}
                    expanded={expandedSteps.has(step.id)}
                    onClick={() => setExpandedSteps(prev => {
                      const next = new Set(prev);
                      next.has(step.id) ? next.delete(step.id) : next.add(step.id);
                      return next;
                    })}
                  />
                ))}
                {runState === 'running' && steps.every(s => s.status !== 'running') && (
                  <div className="trace-node">
                    <div className="trace-icon-wrapper active"><span className="spinner"/></div>
                    <div className="trace-content"><div className="trace-header"><div className="trace-title">Synthesizing...</div></div></div>
                  </div>
                )}
                <div ref={traceEndRef} />
              </div>
            )}

            {activeTab === 'diff' && <DiffViewer diff={selectedTemplate.diff} />}

            {activeTab === 'review' && reviewResult && (
              <div className="review-view">
                <div className="review-card" style={{ borderColor: reviewResult.verdict === 'APPROVE' ? 'var(--status-green)' : 'var(--status-red)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <div className="flex-row">
                      <div className="brand-icon" style={{ width: 32, height: 32, fontSize: 16 }}>⬡</div>
                    <span style={{ fontWeight: 600 }}>Traceform</span>
                    </div>
                    <span className={`pill ${reviewResult.verdict === 'APPROVE' ? 'pill-success' : 'pill-danger'}`}>
                      {reviewResult.verdict}
                    </span>
                  </div>
                  <div className="review-text">{reviewResult.summary}</div>
                  
                  <div className="flex-row" style={{ gap: 20, marginTop: 24 }}>
                    {[
                      { l: 'Tests', v: reviewResult.testsRun },
                      { l: 'Passed', v: reviewResult.testsPassed, c: 'var(--status-green)' },
                      { l: 'Failed', v: reviewResult.testsFailed, c: reviewResult.testsFailed > 0 ? 'var(--status-red)' : '' },
                      { l: 'Agent Tests', v: reviewResult.newTestsWritten, c: 'var(--accent-secondary)' },
                    ].map(s => (
                      <div key={s.l} className="flex-col">
                        <span style={{ fontSize: 24, fontWeight: 600, color: s.c || 'white' }}>{s.v}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {reviewResult.comments.map((c, i) => (
                  <div key={i} className="review-card" style={{ opacity: c.isMemorySkipped ? 0.6 : 1 }}>
                    <div className="flex-row" style={{ marginBottom: 12 }}>
                      <span className="pill" style={{ borderColor: 'var(--border-glass)' }}>{c.file}:{c.line}</span>
                      <span className={`pill ${c.severity === 'good' ? 'pill-success' : c.severity === 'critical' ? 'pill-danger' : c.severity === 'warning' ? 'pill-warning' : 'pill-primary'}`}>
                        {c.severity}
                      </span>
                      {c.isMemorySkipped && <span className="pill pill-memory">Skipped (Memory)</span>}
                    </div>
                    <div className="review-text">{c.text}</div>
                    <div className="review-evidence">{c.evidence}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT: Inspector Island */}
        <aside className="island island-inspector">
          <div className="brand-header">
            <h2 style={{ fontSize: 16, fontWeight: 500 }}>Repository Memory</h2>
            <span className="pill" style={{ marginLeft: 'auto', borderColor: 'var(--border-glass)' }}>{memory.length}</span>
          </div>

          <div className="scroll-area" style={{ paddingTop: 24 }}>
            {memory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No learned conventions yet.</div>
            ) : memory.map(m => (
              <div key={m.key} className="memory-card" style={{ borderColor: newMemoryKeys.has(m.key) ? 'var(--accent-secondary)' : '' }}>
                <div className="memory-key">{m.key}</div>
                <div className="memory-val">{m.value}</div>
                <div className="flex-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                  <span className={`pill ${tagClass(m.category === 'dismissed' ? 'memory' : 'good')}`}>{m.category}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

      </div>
    </>
  );
}
