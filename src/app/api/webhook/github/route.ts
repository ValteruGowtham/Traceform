// ─── GitHub Webhook Route ──────────────────────────────────────────────────────
// POST /api/webhook/github
// Receives GitHub PR events and triggers agent review.

import { NextRequest, NextResponse } from 'next/server';
import { getMemory, addMemoryEntry } from '@/lib/memory';
import { PR_TEMPLATES } from '@/lib/templates';

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event');
  if (event !== 'pull_request') {
    return NextResponse.json({ skipped: true, reason: 'Not a PR event' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as string;
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return NextResponse.json({ skipped: true, action });
  }

  const pr = body.pull_request as Record<string, unknown>;
  const repo = (body.repository as Record<string, unknown>)?.full_name as string;
  const prNumber = pr?.number as number;
  const branch = (pr?.head as Record<string, unknown>)?.ref as string;

  // Load repo memory for context
  const memory = getMemory(repo);

  // In production: kick off async agent run here (queue, worker, etc.)
  // For demo: return metadata immediately.
  console.log(`[webhook] PR #${prNumber} on ${repo} (${branch}) — would trigger agent review`);
  console.log(`[webhook] Loaded ${memory.length} memory entries for ${repo}`);

  return NextResponse.json({
    received: true,
    repo,
    pr: prNumber,
    branch,
    action,
    memoryEntries: memory.length,
    note: 'Agent review queued. Use the Simulator UI for interactive demo.',
  });
}

export async function GET() {
  return NextResponse.json({
    service: 'Traceform — Execution-Backed Code Review',
    instructions: [
      '1. In your GitHub repo → Settings → Webhooks → Add webhook',
      '2. Payload URL: https://your-domain.com/api/webhook/github',
      '3. Content type: application/json',
      '4. Events: Pull requests',
      'Or use the Simulator UI at / for interactive testing.',
    ],
    templates: PR_TEMPLATES.map((t) => ({ id: t.id, title: t.title, repo: t.repo })),
  });
}
