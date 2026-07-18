import test from 'node:test';
import assert from 'node:assert/strict';
import { addMemoryEntry, clearMemory, getMemory, saveMemory } from '@/lib/memory';
import { MemoryEntry } from '@/lib/templates';

const repo = 'acme-corp/test-repo-memory';

function entry(key: string, value: string): MemoryEntry {
  return { key, value, category: 'convention', createdAt: new Date().toISOString() };
}

test('memory store supports save, get, replace, and clear', () => {
  clearMemory(repo);

  const first = [entry('a', 'alpha'), entry('b', 'beta')];
  saveMemory(repo, first);
  assert.deepEqual(getMemory(repo).map((item) => item.key), ['a', 'b']);

  const replaced = addMemoryEntry(repo, entry('a', 'updated-alpha'));
  assert.equal(replaced.length, 2);
  assert.equal(replaced.find((item) => item.key === 'a')?.value, 'updated-alpha');

  clearMemory(repo);
  assert.deepEqual(getMemory(repo), []);
});
