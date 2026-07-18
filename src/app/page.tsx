'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PR_TEMPLATES, MemoryEntry, PrTemplate } from '@/lib/templates';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { MainPanel, TabId } from '@/components/dashboard/MainPanel';
import { MemoryPanel } from '@/components/dashboard/MemoryPanel';
import { useSimulatorRun } from '@/hooks/useSimulatorRun';

function mergeMemoryEntries(current: MemoryEntry[], nextEntries: MemoryEntry[]) {
  const map = new Map(current.map((entry) => [entry.key, entry]));
  nextEntries.forEach((entry) => map.set(entry.key, entry));
  return Array.from(map.values());
}

interface MemoryApiResponse {
  data?: { repo?: string; entries?: MemoryEntry[] };
  error?: { message?: string };
}

export default function Dashboard() {
  const [selectedTemplate, setSelectedTemplate] = useState<PrTemplate>(PR_TEMPLATES[0]);
  const [activeRepo, setActiveRepo] = useState(PR_TEMPLATES[0].repo);
  const [memory, setMemory] = useState<MemoryEntry[]>(PR_TEMPLATES[0].repoMemory);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [newMemoryKeys, setNewMemoryKeys] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>('trace');
  const traceEndRef = useRef<HTMLDivElement | null>(null);

  const repos = useMemo(() => Array.from(new Set(PR_TEMPLATES.map((template) => template.repo))), []);

  const persistMemory = useCallback(async (repo: string, entries: MemoryEntry[]) => {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, entries }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as MemoryApiResponse;
      throw new Error(body.error?.message || 'Unable to save repository memory');
    }
  }, []);

  const loadMemory = useCallback(async (repo: string, fallback: MemoryEntry[]) => {
    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const res = await fetch(`/api/memory?repo=${encodeURIComponent(repo)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as MemoryApiResponse;
        throw new Error(body.error?.message || 'Unable to load repository memory');
      }

      const body = (await res.json()) as MemoryApiResponse;
      const entries = body.data?.entries;
      if (Array.isArray(entries)) {
        setMemory(entries.length > 0 ? entries : fallback);
      } else {
        setMemory(fallback);
      }
    } catch (error) {
      setMemory(fallback);
      setMemoryError((error as Error).message || 'Unable to load repository memory');
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  const { runState, steps, reviewResult, streamError, runReview } = useSimulatorRun({
    onStepUpdate(step) {
      if (step.status !== 'pending') {
        setExpandedSteps((prev) => {
          const next = new Set(prev);
          next.add(step.id);
          return next;
        });
      }
    },
    onComplete() {
      setTimeout(() => setActiveTab('review'), 200);
    },
    onMemoryEntries(entries) {
      setMemory((prev) => {
        const updated = mergeMemoryEntries(prev, entries);
        persistMemory(activeRepo, updated).catch((error) => {
          setMemoryError((error as Error).message || 'Unable to save repository memory');
        });
        return updated;
      });
      setNewMemoryKeys((prev) => {
        const next = new Set(prev);
        entries.forEach((entry) => next.add(entry.key));
        return next;
      });
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMemory(activeRepo, selectedTemplate.repoMemory);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeRepo, loadMemory, selectedTemplate.repoMemory]);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  const resetViewState = useCallback(() => {
    setActiveTab('trace');
    setExpandedSteps(new Set());
    setNewMemoryKeys(new Set());
    setMemoryError(null);
  }, []);

  const handleSelectRepo = useCallback(
    (repo: string) => {
      setActiveRepo(repo);
      const firstTemplate = PR_TEMPLATES.find((template) => template.repo === repo);
      if (firstTemplate) {
        setSelectedTemplate(firstTemplate);
      }
      resetViewState();
    },
    [resetViewState]
  );

  const handleSelectTemplate = useCallback(
    (template: PrTemplate) => {
      setSelectedTemplate(template);
      setActiveRepo(template.repo);
      resetViewState();
      loadMemory(template.repo, template.repoMemory);
    },
    [loadMemory, resetViewState]
  );

  const handleRunReview = useCallback(() => {
    setActiveTab('trace');
    setNewMemoryKeys(new Set());
    setMemoryError(null);
    void runReview(selectedTemplate.id, memory);
  }, [memory, runReview, selectedTemplate.id]);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  return (
    <>
      <div className="mesh-bg" />
      <div className="app-container">
        <Sidebar
          repos={repos}
          activeRepo={activeRepo}
          selectedTemplate={selectedTemplate}
          templates={PR_TEMPLATES}
          runState={runState}
          onSelectRepo={handleSelectRepo}
          onSelectTemplate={handleSelectTemplate}
          onRunReview={handleRunReview}
        />

        <MainPanel
          selectedTemplate={selectedTemplate}
          steps={steps}
          runState={runState}
          reviewResult={reviewResult}
          streamError={streamError}
          activeTab={activeTab}
          expandedSteps={expandedSteps}
          traceEndRef={traceEndRef}
          onSetActiveTab={setActiveTab}
          onToggleStep={toggleStep}
        />

        <MemoryPanel memory={memory} newMemoryKeys={newMemoryKeys} loading={memoryLoading} error={memoryError} />
      </div>
    </>
  );
}
