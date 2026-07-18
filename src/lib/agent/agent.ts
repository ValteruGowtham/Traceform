// ─── Agent Engine ─────────────────────────────────────────────────────────────
// Simulates the Claude tool-use loop for PR review.
// In production: replace simulateToolCall with real Claude API calls + sandbox exec.

// Uses built-in crypto.randomUUID() — no external uuid package needed
import {
  AgentStep,
  MemoryEntry,
  PrTemplate,
  ReviewResult,
} from '../templates';

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export type ToolName =
  | 'checkout_branch'
  | 'get_git_diff'
  | 'read_file'
  | 'run_tests'
  | 'write_temp_test'
  | 'get_repo_memory'
  | 'save_repo_memory'
  | 'post_review_comment';

export interface ToolCall {
  tool: ToolName;
  input: Record<string, unknown>;
}

export interface ToolResult {
  output: string;
  success: boolean;
  durationMs: number;
}

// ─── Simulate realistic tool outputs per scenario ────────────────────────────

function simulateToolCall(
  tool: ToolName,
  input: Record<string, unknown>,
  template: PrTemplate,
  memory: MemoryEntry[]
): ToolResult {
  const delay = () => 300 + Math.random() * 600;

  switch (tool) {
    case 'checkout_branch':
      return {
        output: `Checked out branch '${template.pr.branch}' at commit a3f7c21\nWorking directory: /tmp/sandbox/${template.repo.replace('/', '_')}\nFiles changed: ${(template.diff.match(/^diff --git/gm) || []).length}`,
        success: true,
        durationMs: delay(),
      };

    case 'get_git_diff':
      return {
        output: template.diff,
        success: true,
        durationMs: delay(),
      };

    case 'read_file':
      return {
        output: generateReadFileOutput(template),
        success: true,
        durationMs: delay(),
      };

    case 'run_tests':
      return generateRunTestsOutput(template);

    case 'write_temp_test':
      return {
        output: generateWriteTempTestOutput(template),
        success: true,
        durationMs: delay(),
      };

    case 'get_repo_memory':
      if (memory.length === 0) {
        return { output: '(no memory entries for this repo)', success: true, durationMs: 50 };
      }
      return {
        output: memory.map((m) => `[${m.key}] ${m.value}`).join('\n'),
        success: true,
        durationMs: 50,
      };

    case 'save_repo_memory':
      return {
        output: `Saved ${(input.entries as MemoryEntry[])?.length ?? 1} memory entries for ${input.repo}`,
        success: true,
        durationMs: 60,
      };

    case 'post_review_comment':
      return {
        output: `✓ Posted inline comment on ${input.file}:${input.line ?? '—'} via GitHub API`,
        success: true,
        durationMs: delay() * 0.5,
      };

    default:
      return { output: 'Unknown tool', success: false, durationMs: 100 };
  }
}

// ─── Scenario-specific outputs ───────────────────────────────────────────────

function generateReadFileOutput(t: PrTemplate): string {
  if (t.id === 'hallucinated-bug') {
    return `// src/pricing/discount.ts
export function applyDiscount(price: number, qty: number): number {
  let discount = 0.05;
  if (qty > 50)  discount = 0.10;
  if (qty > 100) discount = 0.15;
  if (qty > 500) discount = 0.20;
  const finalPrice = price * (1 - discount);
  return Math.round(finalPrice * 100) / 100;
}`;
  }
  if (t.id === 'real-bug') {
    return `// src/utils/paginate.ts
export function getTotalPages(total: number, pageSize: number): number {
  return Math.floor(total / pageSize);  // BUG: should be Math.ceil
}

export function getPageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}`;
  }
  if (t.id === 'perf-issue') {
    return `// src/orders/service.ts
export async function getOrders(orgId: string) {
  const orders = await db.orders.findMany({ where: { orgId } });
  // N+1 QUERY: one db.users.findOne per order!
  const enriched = await Promise.all(
    orders.map(async (order) => {
      const user = await db.users.findOne({ where: { id: order.userId } });
      return { ...order, user };
    })
  );
  return enriched;
}`;
  }
  return `// ${t.repo} — file read OK`;
}

function generateRunTestsOutput(t: PrTemplate): ToolResult {
  const delay = 400 + Math.random() * 800;

  if (t.id === 'hallucinated-bug') {
    return {
      output: `> npm test -- --testPathPattern=pricing

PASS  src/pricing/discount.test.ts
  applyDiscount
    ✓ applies 5% for qty<=50 (2ms)
    ✓ applies 10% for qty 51-100 (1ms)
    ✓ applies 15% for qty 101-500 (1ms)
    ✓ applies 20% for qty 501+ (1ms)   [NEW]
    ✓ rounds to 2 decimal places (1ms) [NEW]

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        0.847s`,
      success: true,
      durationMs: delay,
    };
  }

  if (t.id === 'real-bug') {
    return {
      output: `> npm test -- --testPathPattern=paginate

FAIL  src/utils/paginate.test.ts
  getTotalPages
    ✓ page 1 items (2ms)
    ✓ page 2 items (1ms)
    ✗ AGENT TEST: getTotalPages(10, 3) should be 4 [FAIL]
      Expected: 4
      Received: 3   ← Math.floor(10/3) = 3 but Math.ceil(10/3) = 4

Test Suites: 1 failed, 1 total
Tests:       2 passed, 1 failed
Time:        0.612s`,
      success: false,
      durationMs: delay,
    };
  }

  if (t.id === 'perf-issue') {
    return {
      output: `> npm test -- --testPathPattern=orders

PASS  src/orders/service.test.ts
  getOrders
    ✓ returns orders for org (3ms)
    ✓ AGENT TEST: db.users.findOne called N times for N orders [FAIL revealed]
      → db.users.findOne called 50 times for 50 orders (N+1 confirmed)
      → Expected: db.users.findMany called once with IN clause

Test Suites: 1 passed, 1 total (with agent-added assertions)
Tests:       1 passed, 1 flagged
Time:        0.921s`,
      success: true,
      durationMs: delay,
    };
  }

  return {
    output: `> npm test\n\nPASS  (all tests)\nTests: 3 passed, 3 total\nTime: 0.501s`,
    success: true,
    durationMs: delay,
  };
}

function generateWriteTempTestOutput(t: PrTemplate): string {
  if (t.id === 'hallucinated-bug') {
    return `// .tmp-agent-tests/discount.verify.test.ts  (auto-generated)
import { applyDiscount } from '../../src/pricing/discount';

describe('[Agent Verification] applyDiscount', () => {
  it('new 20% tier at qty=501', () => {
    expect(applyDiscount(100, 501)).toBe(80);
  });
  it('rounding: 100 * 0.95 = 95.00', () => {
    expect(applyDiscount(100, 10)).toBe(95);
  });
  it('rounding: 99.99 * 0.90 = 89.99', () => {
    expect(applyDiscount(99.99, 75)).toBe(89.99);
  });
});
→ Written to /tmp/sandbox/agent-tests/discount.verify.test.ts`;
  }
  if (t.id === 'real-bug') {
    return `// .tmp-agent-tests/paginate.verify.test.ts  (auto-generated)
import { getTotalPages } from '../../src/utils/paginate';

describe('[Agent Verification] getTotalPages edge cases', () => {
  it('10 items, page size 3 → 4 pages (not 3)', () => {
    expect(getTotalPages(10, 3)).toBe(4); // FAILS with Math.floor
  });
  it('9 items, page size 3 → 3 pages (exact)', () => {
    expect(getTotalPages(9, 3)).toBe(3);
  });
  it('1 item, page size 10 → 1 page', () => {
    expect(getTotalPages(1, 10)).toBe(1);
  });
});
→ Written to /tmp/sandbox/agent-tests/paginate.verify.test.ts`;
  }
  if (t.id === 'perf-issue') {
    return `// .tmp-agent-tests/orders.perf.test.ts  (auto-generated)
import { getOrders } from '../../src/orders/service';
import { db } from '../../src/db';

jest.mock('../../src/db');

describe('[Agent Verification] N+1 detection', () => {
  it('should NOT call db.users.findOne in a loop', async () => {
    const orders = Array.from({ length: 50 }, (_, i) => ({
      id: String(i), orgId: 'org1', userId: \`u\${i}\`, amount: 100
    }));
    (db.orders.findMany as jest.Mock).mockResolvedValue(orders);
    (db.users.findOne as jest.Mock).mockResolvedValue({ name: 'Test' });
    await getOrders('org1');
    // This assertion will FAIL — findOne is called 50 times
    expect(db.users.findOne).toHaveBeenCalledTimes(1); // FAIL: was 50
  });
});
→ Written to /tmp/sandbox/agent-tests/orders.perf.test.ts`;
  }
  return `// Auto-generated verification test\n→ Written to /tmp/sandbox/agent-tests/verify.test.ts`;
}

// ─── Build Agent Steps per template ──────────────────────────────────────────

function buildSteps(): Array<{ tool: ToolName; label: string; icon: string; iconClass: string }> {
  const base = [
    { tool: 'checkout_branch' as ToolName, label: 'Checkout branch', icon: '🌿', iconClass: 'step-checkout' },
    { tool: 'get_git_diff' as ToolName, label: 'Read PR diff', icon: '📋', iconClass: 'step-diff' },
    { tool: 'read_file' as ToolName, label: 'Read changed files', icon: '📄', iconClass: 'step-readfile' },
    { tool: 'get_repo_memory' as ToolName, label: 'Load repo memory', icon: '🧠', iconClass: 'step-memory' },
    { tool: 'write_temp_test' as ToolName, label: 'Write verification tests', icon: '✏️', iconClass: 'step-writetest' },
    { tool: 'run_tests' as ToolName, label: 'Execute test suite', icon: '⚡', iconClass: 'step-runtests' },
    { tool: 'save_repo_memory' as ToolName, label: 'Update repo memory', icon: '💾', iconClass: 'step-memory' },
    { tool: 'post_review_comment' as ToolName, label: 'Post review to GitHub', icon: '📬', iconClass: 'step-review' },
  ];
  return base;
}

// ─── Build Review Result per template ────────────────────────────────────────

function buildReviewResult(template: PrTemplate): ReviewResult {
  if (template.id === 'hallucinated-bug') {
    return {
      verdict: 'APPROVE',
      summary: 'All tests pass including 2 new agent-written verification tests. The refactored logic is functionally equivalent and adds a correct new discount tier. Rounding is handled correctly per repo convention.',
      comments: [
        {
          file: 'src/pricing/discount.ts',
          line: 3,
          severity: 'good',
          text: 'Refactored from a chained ternary to explicit if-blocks — aligns perfectly with the `no-ternary-chains` convention in repo memory.',
          evidence: '✓ All 5 tests pass (3 existing + 2 agent-written)\n✓ Math.round(finalPrice * 100) / 100 produces correct output\n✓ Checked: applyDiscount(99.99, 75) → 89.99 ✓',
        },
      ],
      testsRun: 5, testsPassed: 5, testsFailed: 0, newTestsWritten: 2,
      executionMs: 847,
      newMemoryEntries: [],
    };
  }

  if (template.id === 'real-bug') {
    return {
      verdict: 'REQUEST_CHANGES',
      summary: 'Found a real bug: `getTotalPages` uses `Math.floor` but should use `Math.ceil`. This causes the last page to be invisible when items don\'t divide evenly. Confirmed by running a targeted agent-written test. This was also noted in repo memory from PR #147.',
      comments: [
        {
          file: 'src/utils/paginate.ts',
          line: 2,
          severity: 'critical',
          text: '`Math.floor(total / pageSize)` is wrong for non-divisible totals. With 10 items and pageSize 3, this returns 3 pages — but there are actually 4 (the last page has 1 item). Use `Math.ceil` instead.',
          evidence: 'AGENT TEST FAILED:\n  getTotalPages(10, 3)\n  Expected: 4\n  Received: 3\n\nRepo memory [math-ceiling]: "Use Math.ceil for page counts, not Math.floor — discovered in PR #147"',
        },
        {
          file: 'src/utils/paginate.ts',
          line: 6,
          severity: 'good',
          text: 'The `getPageItems` pagination logic is correct — `(page - 1) * pageSize` offset is verified by the existing tests.',
          evidence: '✓ page 1: items[0..2] = [1,2,3] ✓\n✓ page 2: items[3..5] = [4,5,6] ✓',
        },
      ],
      testsRun: 3, testsPassed: 2, testsFailed: 1, newTestsWritten: 3,
      executionMs: 612,
      newMemoryEntries: [],
    };
  }

  if (template.id === 'style-dismissed') {
    return {
      verdict: 'APPROVE',
      summary: `Adding explicit TypeScript types to middleware parameters is correct and aligns with the repo's strict TS config. Multi-line parameter formatting is an accepted convention (memory: param-formatting). All tests pass.`,
      comments: [
        {
          file: 'src/middleware/auth.ts',
          line: 1,
          severity: 'good',
          text: 'Adding `Request`, `Response`, `NextFunction` type annotations is exactly right for a strict TypeScript project.',
          evidence: '✓ All 1 existing tests pass\n✓ Type annotations match @types/express interfaces\n✓ No runtime behavior change',
        },
        {
          file: 'src/middleware/auth.ts',
          line: 1,
          severity: 'info',
          isMemorySkipped: true,
          text: '~~Multi-line parameter formatting nit~~ — **skipped**: repo memory says this is an accepted style (decided 2026-06-01). Not repeating this comment.',
          evidence: 'Memory [param-formatting]: "Multi-line parameter formatting is acceptable and preferred for long signatures. Stop commenting on this."',
        },
      ],
      testsRun: 1, testsPassed: 1, testsFailed: 0, newTestsWritten: 1,
      executionMs: 501,
      newMemoryEntries: [],
    };
  }

  if (template.id === 'perf-issue') {
    return {
      verdict: 'REQUEST_CHANGES',
      summary: 'N+1 query pattern detected and confirmed by execution. For 50 orders, this makes 50 individual `db.users.findOne` calls instead of 1 batch query. This matches the `db-batching` convention in repo memory. Fix: use `db.users.findMany` with an `id: { in: [...] }` clause.',
      comments: [
        {
          file: 'src/orders/service.ts',
          line: 9,
          severity: 'critical',
          text: 'N+1 query: `db.users.findOne` is called once per order inside a `Promise.all` loop. For an org with 50 orders this fires 50 sequential DB queries. Repo memory explicitly forbids this pattern (`db-batching` convention).\n\n**Fix:**\n```ts\nconst userIds = orders.map(o => o.userId);\nconst users = await db.users.findMany({ where: { id: { in: userIds } } });\nconst userMap = Object.fromEntries(users.map(u => [u.id, u]));\nreturn orders.map(o => ({ ...o, user: userMap[o.userId] }));\n```',
          evidence: 'AGENT TEST:\n  50 orders → db.users.findOne called 50 times\n  Expected: called 1 time with IN clause\n\nMemory [db-batching]: "Always use db.users.findMany with IN clause for batch fetches."',
        },
      ],
      testsRun: 2, testsPassed: 1, testsFailed: 1, newTestsWritten: 1,
      executionMs: 921,
      newMemoryEntries: [
        { key: 'n-plus-one-pattern', value: 'N+1 queries caught in PR #419. Pattern: map(async o => findOne(o.id)) — always replace with findMany + IN clause.', category: 'decision', createdAt: new Date().toISOString() },
      ],
    };
  }

  return {
    verdict: 'COMMENT', summary: 'Review complete.', comments: [],
    testsRun: 0, testsPassed: 0, testsFailed: 0, newTestsWritten: 0,
    executionMs: 500, newMemoryEntries: [],
  };
}

// ─── Public: Run Agent ────────────────────────────────────────────────────────

export interface AgentRunOptions {
  template: PrTemplate;
  memory: MemoryEntry[];
  onStep: (step: AgentStep) => void;
  onComplete: (result: ReviewResult) => void;
  onNewMemory: (entries: MemoryEntry[]) => void;
}

export async function runAgent(opts: AgentRunOptions): Promise<void> {
  const { template, memory, onStep, onComplete, onNewMemory } = opts;
  const stepDefs = buildSteps();

  const steps: AgentStep[] = stepDefs.map((s) => ({
    id: crypto.randomUUID(),
    ...s,
    status: 'pending',
  }));

  // Emit all steps as pending first
  for (const s of steps) onStep({ ...s });

  // Execute each step with simulated delay
  for (const step of steps) {
    await sleep(200);

    // Mark running
    onStep({ ...step, status: 'running' });
    await sleep(50);

    const result = simulateToolCall(step.tool as ToolName, {}, template, memory);
    await sleep(result.durationMs);

    // Mark done
    onStep({
      ...step,
      status: result.success ? 'done' : 'error',
      output: result.output,
      durationMs: result.durationMs,
    });
  }

  await sleep(400);

  // Build and return review result
  const reviewResult = buildReviewResult(template);
  onComplete(reviewResult);

  if (reviewResult.newMemoryEntries.length > 0) {
    onNewMemory(reviewResult.newMemoryEntries);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
