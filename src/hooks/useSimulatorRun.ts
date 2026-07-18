import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentStep, MemoryEntry, ReviewResult } from '@/lib/templates';
import { SimulatorSSEEvent } from '@/lib/api/types';

export type RunState = 'idle' | 'running' | 'done' | 'error';

function mergeStep(prev: AgentStep[], step: AgentStep): AgentStep[] {
  const idx = prev.findIndex((entry) => entry.id === step.id);
  if (idx === -1) return [...prev, step];
  const next = [...prev];
  next[idx] = step;
  return next;
}

function toErrorMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'Request failed';
  const error = (body as { error?: { message?: string } }).error;
  if (error?.message) return error.message;
  return 'Request failed';
}

export function useSimulatorRun(options: {
  onMemoryEntries: (entries: MemoryEntry[]) => void;
  onStepUpdate?: (step: AgentStep) => void;
  onComplete?: () => void;
}) {
  const { onMemoryEntries, onStepUpdate, onComplete } = options;
  const [runState, setRunState] = useState<RunState>('idle');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runReview = useCallback(
    async (templateId: string, memory: MemoryEntry[]) => {
      if (runState === 'running') return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setRunState('running');
      setStreamError(null);
      setSteps([]);
      setReviewResult(null);

      try {
        const res = await fetch('/api/simulator/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, memory }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let body: unknown;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          throw new Error(toErrorMessage(body));
        }

        if (!res.body) {
          throw new Error('Simulator response stream is unavailable');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let seenComplete = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            let parsed: SimulatorSSEEvent;
            try {
              parsed = JSON.parse(payload) as SimulatorSSEEvent;
            } catch {
              throw new Error('Malformed SSE payload from simulator');
            }

            if (parsed.event === 'step') {
              setSteps((prev) => mergeStep(prev, parsed.data));
              onStepUpdate?.(parsed.data);
              continue;
            }

            if (parsed.event === 'memory') {
              onMemoryEntries(parsed.data);
              continue;
            }

            if (parsed.event === 'complete') {
              seenComplete = true;
              setReviewResult(parsed.data);
              setRunState('done');
              onComplete?.();
              continue;
            }

            if (parsed.event === 'error') {
              throw new Error(parsed.data.message || 'Simulator reported an error');
            }
          }
        }

        const trailing = buffer.trim();
        if (trailing.length > 0) {
          throw new Error('Simulator stream ended with incomplete payload');
        }

        if (!seenComplete) {
          throw new Error('Simulator stream closed before completion');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setStreamError('Current analysis was cancelled.');
        } else {
          setStreamError((error as Error).message || 'Unexpected simulator failure');
        }
        setRunState('error');
      }
    },
    [onComplete, onMemoryEntries, onStepUpdate, runState]
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return {
    runState,
    steps,
    reviewResult,
    streamError,
    runReview,
  };
}
