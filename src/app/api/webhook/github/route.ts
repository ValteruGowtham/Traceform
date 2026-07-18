import { NextRequest } from 'next/server';
import { getMemory } from '@/lib/memory';
import { PR_TEMPLATES } from '@/lib/templates';
import { jsonData, jsonError } from '@/lib/api/http';
import { isValidRepoSlug } from '@/lib/api/validation';
import { verifyGithubWebhookSignature } from '@/lib/security/githubWebhook';

const ALLOWED_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

function parsePayload(body: unknown):
  | { ok: true; value: { action: string; repo: string; prNumber: number; branch: string } }
  | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Body must be an object' };
  }

  const raw = body as Record<string, unknown>;
  const action = raw.action;
  const repository = raw.repository as Record<string, unknown> | undefined;
  const pullRequest = raw.pull_request as Record<string, unknown> | undefined;
  const head = pullRequest?.head as Record<string, unknown> | undefined;

  const repo = repository?.full_name;
  const prNumber = pullRequest?.number;
  const branch = head?.ref;

  if (typeof action !== 'string') return { ok: false, message: 'action must be a string' };
  if (typeof repo !== 'string' || !isValidRepoSlug(repo)) return { ok: false, message: 'repository.full_name must be a valid repo slug' };
  if (typeof prNumber !== 'number') return { ok: false, message: 'pull_request.number must be a number' };
  if (typeof branch !== 'string' || branch.length === 0) return { ok: false, message: 'pull_request.head.ref must be a non-empty string' };

  return { ok: true, value: { action, repo, prNumber, branch } };
}

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event');
  if (event !== 'pull_request') {
    return jsonData({ skipped: true, reason: 'Not a PR event' });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return jsonError('MISCONFIGURED', 'GITHUB_WEBHOOK_SECRET is not configured', 503);
  }

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return jsonError('INVALID_JSON', 'Unable to read request body', 400);
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!verifyGithubWebhookSignature(rawBody, signature, secret)) {
    return jsonError('UNAUTHORIZED', 'Invalid webhook signature', 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const payload = parsePayload(parsed);
  if (!payload.ok) {
    return jsonError('VALIDATION_ERROR', payload.message, 400);
  }

  const { action, repo, prNumber, branch } = payload.value;
  if (!ALLOWED_ACTIONS.has(action)) {
    return jsonData({ skipped: true, action });
  }

  const memory = getMemory(repo);

  return jsonData({
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
  return jsonData({
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
