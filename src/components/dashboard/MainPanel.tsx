import { MutableRefObject } from 'react';
import { AgentStep, PrTemplate, ReviewResult } from '@/lib/templates';
import { DiffViewer } from './DiffViewer';
import { TraceNode } from './TraceNode';

export type TabId = 'trace' | 'diff' | 'review';

interface MainPanelProps {
  selectedTemplate: PrTemplate;
  steps: AgentStep[];
  runState: 'idle' | 'running' | 'done' | 'error';
  reviewResult: ReviewResult | null;
  streamError: string | null;
  activeTab: TabId;
  expandedSteps: Set<string>;
  traceEndRef: MutableRefObject<HTMLDivElement | null>;
  onSetActiveTab: (tab: TabId) => void;
  onToggleStep: (id: string) => void;
}

export function MainPanel({
  selectedTemplate,
  steps,
  runState,
  reviewResult,
  streamError,
  activeTab,
  expandedSteps,
  traceEndRef,
  onSetActiveTab,
  onToggleStep,
}: MainPanelProps) {
  return (
    <main className="island island-main">
      <div className="brand-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '24px' }}>
        <div className="flex-row" style={{ width: '100%', justifyContent: 'space-between' }}>
          <div className="flex-row">
            <span className="pill pill-primary">PR #{selectedTemplate.pr.number}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedTemplate.pr.author}</span>
          </div>
          <span className="pill" style={{ borderColor: 'var(--border-glass)' }}>
            {selectedTemplate.pr.branch}
          </span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 500 }}>{selectedTemplate.pr.title}</h2>
      </div>

      <div className="tab-bar" role="tablist" aria-label="Dashboard tabs">
        <button className={`tab ${activeTab === 'trace' ? 'active' : ''}`} onClick={() => onSetActiveTab('trace')} role="tab" aria-selected={activeTab === 'trace'}>
          ⚡ Execution Trace
        </button>
        <button className={`tab ${activeTab === 'diff' ? 'active' : ''}`} onClick={() => onSetActiveTab('diff')} role="tab" aria-selected={activeTab === 'diff'}>
          📋 Diff
        </button>
        <button className={`tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => onSetActiveTab('review')} role="tab" aria-selected={activeTab === 'review'}>
          📝 Review Result
        </button>
      </div>

      <div className="scroll-area" style={{ padding: '24px' }}>
        {streamError && <div className="review-card" role="alert">⚠ {streamError}</div>}

        {activeTab === 'trace' && (
          <div className="trace-view">
            {steps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                Ready to run execution-backed review on PR #{selectedTemplate.pr.number}.
              </div>
            ) : (
              steps.map((step) => (
                <TraceNode
                  key={step.id}
                  step={step}
                  active={step.status === 'running'}
                  done={step.status === 'done'}
                  error={step.status === 'error'}
                  expanded={expandedSteps.has(step.id)}
                  onToggle={() => onToggleStep(step.id)}
                />
              ))
            )}
            {runState === 'running' && steps.every((step) => step.status !== 'running') && (
              <div className="trace-node">
                <div className="trace-icon-wrapper active">
                  <span className="spinner" />
                </div>
                <div className="trace-content">
                  <div className="trace-header">
                    <div className="trace-title">Synthesizing...</div>
                  </div>
                </div>
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
                  <div className="brand-icon" style={{ width: 32, height: 32, fontSize: 16 }}>
                    ⬡
                  </div>
                  <span style={{ fontWeight: 600 }}>Traceform</span>
                </div>
                <span className={`pill ${reviewResult.verdict === 'APPROVE' ? 'pill-success' : 'pill-danger'}`}>{reviewResult.verdict}</span>
              </div>
              <div className="review-text">{reviewResult.summary}</div>

              <div className="flex-row" style={{ gap: 20, marginTop: 24 }}>
                {[
                  { l: 'Tests', v: reviewResult.testsRun },
                  { l: 'Passed', v: reviewResult.testsPassed, c: 'var(--status-green)' },
                  { l: 'Failed', v: reviewResult.testsFailed, c: reviewResult.testsFailed > 0 ? 'var(--status-red)' : '' },
                  { l: 'Agent Tests', v: reviewResult.newTestsWritten, c: 'var(--accent-secondary)' },
                ].map((stat) => (
                  <div key={stat.l} className="flex-col">
                    <span style={{ fontSize: 24, fontWeight: 600, color: stat.c || 'white' }}>{stat.v}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {reviewResult.comments.map((comment, i) => (
              <div key={i} className="review-card" style={{ opacity: comment.isMemorySkipped ? 0.6 : 1 }}>
                <div className="flex-row" style={{ marginBottom: 12 }}>
                  <span className="pill" style={{ borderColor: 'var(--border-glass)' }}>
                    {comment.file}:{comment.line}
                  </span>
                  <span
                    className={`pill ${comment.severity === 'good' ? 'pill-success' : comment.severity === 'critical' ? 'pill-danger' : comment.severity === 'warning' ? 'pill-warning' : 'pill-primary'}`}
                  >
                    {comment.severity}
                  </span>
                  {comment.isMemorySkipped && <span className="pill pill-memory">Skipped (Memory)</span>}
                </div>
                <div className="review-text">{comment.text}</div>
                <div className="review-evidence">{comment.evidence}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
