import { AgentStep } from '@/lib/templates';
import { formatMs } from './utils';

interface TraceNodeProps {
  step: AgentStep;
  active: boolean;
  done: boolean;
  error: boolean;
  onToggle: () => void;
  expanded: boolean;
}

export function TraceNode({ step, active, done, error, onToggle, expanded }: TraceNodeProps) {
  let stateClass = '';
  if (active) stateClass = 'active';
  else if (done) stateClass = 'done';
  else if (error) stateClass = 'error';

  return (
    <div className={`trace-node ${stateClass}`}>
      <div className="trace-icon-wrapper">{active ? <span className="spinner" /> : step.icon}</div>
      <button type="button" className="trace-content" onClick={onToggle} aria-label={`Toggle ${step.label} output`}>
        <div className="trace-header">
          <div className="trace-title">{step.label}</div>
          <div className="trace-meta">{formatMs(step.durationMs)}</div>
        </div>
        {expanded && step.output && (
          <div className="trace-output">
            {step.output.split('\n').map((line, i) => {
              let cls = '';
              if (/(✓|PASS|passed)/.test(line)) cls = 'out-pass';
              else if (/(✗|FAIL|failed|BUG)/.test(line)) cls = 'out-fail';
              else if (/(→|AGENT|NEW)/.test(line)) cls = 'out-info';
              else if (/(warn|Warning)/i.test(line)) cls = 'out-warn';
              return (
                <div key={i} className={cls}>
                  {line || ' '}
                </div>
              );
            })}
          </div>
        )}
      </button>
    </div>
  );
}
