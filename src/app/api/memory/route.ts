// ─── Memory API Route ─────────────────────────────────────────────────────────
// GET  /api/memory?repo=acme-corp/payments-api
// POST /api/memory   { repo, entries }
// DELETE /api/memory?repo=acme-corp/payments-api

import { NextRequest, NextResponse } from 'next/server';
import { getMemory, saveMemory, clearMemory } from '@/lib/memory';

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo') || '';
  const entries = getMemory(repo);
  return NextResponse.json({ repo, entries });
}

export async function POST(req: NextRequest) {
  const { repo, entries } = await req.json();
  if (!repo || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'repo and entries[] required' }, { status: 400 });
  }
  saveMemory(repo, entries);
  return NextResponse.json({ ok: true, count: entries.length });
}

export async function DELETE(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo') || '';
  clearMemory(repo);
  return NextResponse.json({ ok: true });
}
