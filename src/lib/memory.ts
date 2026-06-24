// ─── Repo Memory Store ────────────────────────────────────────────────────────
// Persists team conventions and past decisions per repo.
// In production this would be a KV store or database; here we use a local JSON file.

import fs from 'fs';
import path from 'path';
import { MemoryEntry } from './templates';

const MEMORY_DIR = path.join(process.cwd(), '.pr-reviewer-memory');

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function memoryPath(repoSlug: string) {
  const safe = repoSlug.replace(/[^a-z0-9_-]/gi, '_');
  return path.join(MEMORY_DIR, `${safe}.json`);
}

export function getMemory(repoSlug: string): MemoryEntry[] {
  ensureDir();
  const p = memoryPath(repoSlug);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as MemoryEntry[];
  } catch {
    return [];
  }
}

export function saveMemory(repoSlug: string, entries: MemoryEntry[]): void {
  ensureDir();
  fs.writeFileSync(memoryPath(repoSlug), JSON.stringify(entries, null, 2));
}

export function addMemoryEntry(repoSlug: string, entry: MemoryEntry): MemoryEntry[] {
  const existing = getMemory(repoSlug);
  // Replace if key already exists
  const filtered = existing.filter((e) => e.key !== entry.key);
  const updated = [...filtered, entry];
  saveMemory(repoSlug, updated);
  return updated;
}

export function clearMemory(repoSlug: string): void {
  ensureDir();
  const p = memoryPath(repoSlug);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
