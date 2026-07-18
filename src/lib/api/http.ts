import { NextResponse } from 'next/server';
import { ApiErrorBody, ApiErrorCode, ApiSuccessBody } from './types';

export function jsonError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return NextResponse.json(body, { status });
}

export function jsonData<T>(data: T, status = 200) {
  const body: ApiSuccessBody<T> = { data };
  return NextResponse.json(body, { status });
}

export async function parseJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; code: ApiErrorCode; message: string }> {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > maxBytes) {
      return { ok: false, code: 'BODY_TOO_LARGE', message: `Request body exceeds ${maxBytes} bytes` };
    }
  }

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Unable to read request body' };
  }

  if (!raw.trim()) {
    return { ok: false, code: 'INVALID_JSON', message: 'Request body is empty' };
  }

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return { ok: false, code: 'BODY_TOO_LARGE', message: `Request body exceeds ${maxBytes} bytes` };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Request body must be valid JSON' };
  }
}
