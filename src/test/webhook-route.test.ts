import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as webhookPost } from '@/app/api/webhook/github/route';

const secret = 'test-secret';

function sign(payload: string) {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function buildPayload(action = 'opened') {
  return JSON.stringify({
    action,
    repository: { full_name: 'acme-corp/payments-api' },
    pull_request: { number: 1, head: { ref: 'feature/test' } },
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<{ data?: { skipped?: boolean }; error?: { code?: string } }>;
}

test('webhook skips non pull_request events', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = secret;
  const payload = buildPayload();

  const request = new NextRequest('http://localhost/api/webhook/github', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'push',
      'x-hub-signature-256': sign(payload),
    },
  });

  const response = await webhookPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(json.data?.skipped, true);
});

test('webhook rejects invalid signatures', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = secret;
  const payload = buildPayload();

  const request = new NextRequest('http://localhost/api/webhook/github', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': 'sha256=invalid',
    },
  });

  const response = await webhookPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 401);
  assert.equal(json.error?.code, 'UNAUTHORIZED');
});

test('webhook validates required pull request fields', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = secret;
  const payload = JSON.stringify({ action: 'opened' });

  const request = new NextRequest('http://localhost/api/webhook/github', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': sign(payload),
    },
  });

  const response = await webhookPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 400);
  assert.equal(json.error?.code, 'VALIDATION_ERROR');
});

test('webhook skips unsupported actions', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = secret;
  const payload = buildPayload('closed');

  const request = new NextRequest('http://localhost/api/webhook/github', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': sign(payload),
    },
  });

  const response = await webhookPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(json.data?.skipped, true);
});
