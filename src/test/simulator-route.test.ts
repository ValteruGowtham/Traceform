import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as simulatorPost } from '@/app/api/simulator/run/route';

async function responseJson(response: Response) {
  return response.json() as Promise<{ error?: { code?: string; message?: string } }>;
}

test('simulator route rejects malformed JSON', async () => {
  const request = new NextRequest('http://localhost/api/simulator/run', {
    method: 'POST',
    body: '{',
    headers: { 'content-type': 'application/json' },
  });

  const response = await simulatorPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 400);
  assert.equal(json.error?.code, 'INVALID_JSON');
});

test('simulator route rejects unknown template', async () => {
  const request = new NextRequest('http://localhost/api/simulator/run', {
    method: 'POST',
    body: JSON.stringify({ templateId: 'does-not-exist', memory: [] }),
    headers: { 'content-type': 'application/json' },
  });

  const response = await simulatorPost(request);
  const json = await responseJson(response);

  assert.equal(response.status, 400);
  assert.equal(json.error?.code, 'UNKNOWN_TEMPLATE');
});
