import { MemoryEntry } from '@/lib/templates';
import { MemorySaveRequest, SimulatorRunRequest } from './types';

export const MAX_BODY_BYTES = 50_000;
export const MAX_MEMORY_ENTRIES = 200;
export const MAX_TEXT_LENGTH = 500;
const MEMORY_CATEGORIES = new Set(['convention', 'decision', 'style', 'dismissed']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidRepoSlug(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}

export function validateMemoryEntry(entry: unknown): entry is MemoryEntry {
  if (!isObject(entry)) return false;
  const key = entry.key;
  const value = entry.value;
  const category = entry.category;
  const createdAt = entry.createdAt;

  if (typeof key !== 'string' || key.length === 0 || key.length > 80) return false;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TEXT_LENGTH) return false;
  if (typeof category !== 'string' || !MEMORY_CATEGORIES.has(category)) return false;
  if (typeof createdAt !== 'string' || Number.isNaN(new Date(createdAt).getTime())) return false;
  return true;
}

export function validateMemorySaveRequest(input: unknown): { ok: true; value: MemorySaveRequest } | { ok: false; message: string } {
  if (!isObject(input)) return { ok: false, message: 'Body must be an object' };
  const { repo, entries } = input;
  if (typeof repo !== 'string' || !isValidRepoSlug(repo)) {
    return { ok: false, message: 'repo must be a valid <owner>/<name> slug' };
  }
  if (!Array.isArray(entries)) {
    return { ok: false, message: 'entries must be an array' };
  }
  if (entries.length > MAX_MEMORY_ENTRIES) {
    return { ok: false, message: `entries must be <= ${MAX_MEMORY_ENTRIES}` };
  }
  if (!entries.every(validateMemoryEntry)) {
    return { ok: false, message: 'entries contains invalid MemoryEntry values' };
  }
  return { ok: true, value: { repo, entries } };
}

export function validateSimulatorRunRequest(input: unknown): { ok: true; value: SimulatorRunRequest } | { ok: false; message: string } {
  if (!isObject(input)) return { ok: false, message: 'Body must be an object' };
  const { templateId, memory } = input;
  if (typeof templateId !== 'string' || templateId.length === 0 || templateId.length > 80) {
    return { ok: false, message: 'templateId must be a non-empty string' };
  }
  if (memory !== undefined) {
    if (!Array.isArray(memory)) return { ok: false, message: 'memory must be an array when provided' };
    if (memory.length > MAX_MEMORY_ENTRIES) {
      return { ok: false, message: `memory must be <= ${MAX_MEMORY_ENTRIES}` };
    }
    if (!memory.every(validateMemoryEntry)) {
      return { ok: false, message: 'memory contains invalid MemoryEntry values' };
    }
  }
  return { ok: true, value: { templateId, memory } };
}
