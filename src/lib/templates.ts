// ─── PR Scenario Templates ────────────────────────────────────────────────────

export interface PrTemplate {
  id: string;
  title: string;
  description: string;
  tag: 'bug' | 'style' | 'perf' | 'memory' | 'good';
  repo: string;
  pr: {
    number: number;
    title: string;
    author: string;
    branch: string;
    baseBranch: string;
  };
  diff: string;
  existingTests: string;
  repoMemory: MemoryEntry[];
}

export interface MemoryEntry {
  key: string;
  value: string;
  category: 'convention' | 'decision' | 'style' | 'dismissed';
  createdAt: string;
}

export interface AgentStep {
  id: string;
  tool: string;
  label: string;
  icon: string;
  iconClass: string;
  status: 'pending' | 'running' | 'done' | 'error';
  input?: string;
  output?: string;
  durationMs?: number;
}

export interface ReviewComment {
  file: string;
  line?: number;
  severity: 'critical' | 'warning' | 'info' | 'good';
  text: string;
  evidence: string;
  isMemorySkipped?: boolean;
}

export interface ReviewResult {
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  summary: string;
  comments: ReviewComment[];
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  newTestsWritten: number;
  executionMs: number;
  newMemoryEntries: MemoryEntry[];
}

// ─── Templates ───────────────────────────────────────────────────────────────

export const PR_TEMPLATES: PrTemplate[] = [
  {
    id: 'hallucinated-bug',
    title: 'Hallucinated Bug',
    description: 'Typical AI reviewers flag a non-issue. We run the code and prove it works.',
    tag: 'good',
    repo: 'acme-corp/payments-api',
    pr: { number: 247, title: 'Optimise discount calculation for bulk orders', author: 'sarah-k', branch: 'feat/bulk-discount', baseBranch: 'main' },
    diff: `diff --git a/src/pricing/discount.ts b/src/pricing/discount.ts
index 3a4d1f2..7b8c9a1 100644
--- a/src/pricing/discount.ts
+++ b/src/pricing/discount.ts
@@ -12,8 +12,14 @@ export function applyDiscount(price: number, qty: number): number {
-  const discount = qty > 100 ? 0.15 : qty > 50 ? 0.10 : 0.05;
-  return price * (1 - discount);
+  let discount = 0.05;
+  if (qty > 50) discount = 0.10;
+  if (qty > 100) discount = 0.15;
+  if (qty > 500) discount = 0.20;
+  const finalPrice = price * (1 - discount);
+  return Math.round(finalPrice * 100) / 100;`,
    existingTests: `describe('applyDiscount', () => {
  it('applies 5% for qty<=50', () => expect(applyDiscount(100, 10)).toBe(95));
  it('applies 10% for qty 51-100', () => expect(applyDiscount(100, 75)).toBe(90));
  it('applies 15% for qty 101-500', () => expect(applyDiscount(100, 200)).toBe(85));
});`,
    repoMemory: [
      { key: 'rounding', value: 'Always round monetary values to 2 decimal places using Math.round(x*100)/100', category: 'convention', createdAt: '2026-06-10T09:00:00Z' },
      { key: 'no-ternary-chains', value: 'Avoid chained ternaries for readability — use if/else blocks instead', category: 'decision', createdAt: '2026-06-05T14:30:00Z' },
    ],
  },
  {
    id: 'real-bug',
    title: 'Real Bug in Math Helper',
    description: 'Off-by-one in pagination. Tests expose the failure. Review is backed by execution trace.',
    tag: 'bug',
    repo: 'acme-corp/dashboard-ui',
    pr: { number: 183, title: 'Add pagination to results table', author: 'dev-mike', branch: 'feat/pagination', baseBranch: 'main' },
    diff: `diff --git a/src/utils/paginate.ts b/src/utils/paginate.ts
index 1f2a3b4..9c8d5e6 100644
--- a/src/utils/paginate.ts
+++ b/src/utils/paginate.ts
@@ -1,6 +1,10 @@
+export function getTotalPages(total: number, pageSize: number): number {
+  return Math.floor(total / pageSize);
+}
+
 export function getPageItems<T>(items: T[], page: number, pageSize: number): T[] {
-  return items.slice(0, pageSize);
+  const start = (page - 1) * pageSize;
+  return items.slice(start, start + pageSize);
 }`,
    existingTests: `describe('paginate', () => {
  it('page 1', () => {
    const items = [1,2,3,4,5,6,7,8,9,10];
    expect(getPageItems(items, 1, 3)).toEqual([1,2,3]);
  });
  it('page 2', () => {
    const items = [1,2,3,4,5,6,7,8,9,10];
    expect(getPageItems(items, 2, 3)).toEqual([4,5,6]);
  });
});`,
    repoMemory: [
      { key: 'math-ceiling', value: 'Use Math.ceil for page counts, not Math.floor — discovered in PR #147', category: 'decision', createdAt: '2026-05-20T11:00:00Z' },
    ],
  },
  {
    id: 'style-dismissed',
    title: 'Style Nit Already Dismissed',
    description: 'Team previously decided not to enforce this. Agent reads memory and skips the comment.',
    tag: 'memory',
    repo: 'acme-corp/backend-core',
    pr: { number: 301, title: 'Refactor auth middleware', author: 'priya-v', branch: 'refactor/auth', baseBranch: 'main' },
    diff: `diff --git a/src/middleware/auth.ts b/src/middleware/auth.ts
index 2b3c4d5..8e9f0a1 100644
--- a/src/middleware/auth.ts
+++ b/src/middleware/auth.ts
@@ -5,7 +5,9 @@ import { verifyToken } from '../utils/jwt';
-export const authMiddleware = async (req, res, next) => {
+export const authMiddleware = async (
+  req: Request,
+  res: Response,
+  next: NextFunction
+) => {
   const token = req.headers['authorization']?.split(' ')[1];
   if (!token) return res.status(401).json({ error: 'Unauthorized' });
   const user = await verifyToken(token);`,
    existingTests: `describe('authMiddleware', () => {
  it('rejects missing token', async () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await authMiddleware(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});`,
    repoMemory: [
      { key: 'console-log', value: 'Do NOT flag console.log in dev-only scripts. Team voted to keep them in 2026-04 retro.', category: 'dismissed', createdAt: '2026-04-15T08:00:00Z' },
      { key: 'param-formatting', value: 'Multi-line parameter formatting is acceptable and preferred for long signatures. Stop commenting on this.', category: 'dismissed', createdAt: '2026-06-01T10:00:00Z' },
      { key: 'ts-types', value: 'Adding explicit TypeScript types to middleware params is ENCOURAGED — matches our TS strict config', category: 'convention', createdAt: '2026-06-01T10:05:00Z' },
    ],
  },
  {
    id: 'perf-issue',
    title: 'Performance Issue Detected',
    description: 'N+1 query pattern introduced. Agent writes a targeted test, measures, and flags with evidence.',
    tag: 'perf',
    repo: 'acme-corp/api-gateway',
    pr: { number: 419, title: 'Add user enrichment to order listing', author: 'james-r', branch: 'feat/order-enrichment', baseBranch: 'main' },
    diff: `diff --git a/src/orders/service.ts b/src/orders/service.ts
index 4f5a6b7..1c2d3e4 100644
--- a/src/orders/service.ts
+++ b/src/orders/service.ts
@@ -8,6 +8,13 @@ export async function getOrders(orgId: string) {
   const orders = await db.orders.findMany({ where: { orgId } });
-  return orders;
+  const enriched = await Promise.all(
+    orders.map(async (order) => {
+      const user = await db.users.findOne({ where: { id: order.userId } });
+      return { ...order, user };
+    })
+  );
+  return enriched;
 }`,
    existingTests: `describe('getOrders', () => {
  it('returns orders for org', async () => {
    mockDb.orders.findMany.mockResolvedValue([
      { id: '1', orgId: 'org1', userId: 'u1', amount: 100 },
    ]);
    const result = await getOrders('org1');
    expect(result).toHaveLength(1);
  });
});`,
    repoMemory: [
      { key: 'db-batching', value: 'Always use db.users.findMany with IN clause for batch fetches. findOne in a loop is forbidden.', category: 'convention', createdAt: '2026-05-01T09:00:00Z' },
    ],
  },
];
