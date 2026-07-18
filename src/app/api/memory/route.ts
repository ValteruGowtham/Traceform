import { NextRequest } from 'next/server';
import { getMemory, saveMemory, clearMemory } from '@/lib/memory';
import { jsonData, jsonError, parseJsonBody } from '@/lib/api/http';
import { MAX_BODY_BYTES, isValidRepoSlug, validateMemorySaveRequest } from '@/lib/api/validation';

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo') || '';
  if (!isValidRepoSlug(repo)) {
    return jsonError('VALIDATION_ERROR', 'repo query param must be a valid <owner>/<name> slug', 400);
  }

  const entries = getMemory(repo);
  return jsonData({ repo, entries });
}

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    const status = parsedBody.code === 'BODY_TOO_LARGE' ? 413 : 400;
    return jsonError(parsedBody.code, parsedBody.message, status);
  }

  const validation = validateMemorySaveRequest(parsedBody.value);
  if (!validation.ok) {
    return jsonError('VALIDATION_ERROR', validation.message, 400);
  }

  const { repo, entries } = validation.value;
  saveMemory(repo, entries);
  return jsonData({ ok: true, count: entries.length });
}

export async function DELETE(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo') || '';
  if (!isValidRepoSlug(repo)) {
    return jsonError('VALIDATION_ERROR', 'repo query param must be a valid <owner>/<name> slug', 400);
  }

  clearMemory(repo);
  return jsonData({ ok: true });
}
