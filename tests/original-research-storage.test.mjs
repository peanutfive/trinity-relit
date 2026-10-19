import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertNewEvidencePath, writeEvidence, TARGET } from '../scripts/original-research/lib/common.mjs';
import { identifyStory, runBaseline } from '../scripts/original-research/baseline.mjs';
import { fetchSource } from '../scripts/original-research/fetch-source.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'trinity-storage-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function syntheticStory() {
  const bytes = Buffer.alloc(128);
  bytes[0] = 4; bytes.writeUInt16BE(12, 2); bytes.write('860926', 18);
  bytes.writeUInt16BE(32, 26); bytes.writeUInt16BE(0x16ab, 28);
  bytes.fill(255, 64, 86); bytes[86] = 193;
  return bytes;
}

test('matching header and checksum do not establish the target story digest', () => {
  const bytes = syntheticStory();
  const before = identifyStory(bytes);
  assert.equal(before.headerMatchesTarget, true);
  assert.equal(before.checksumValid, true);
  assert.equal(before.matchesTarget, false);
  assert.notEqual(before.sha256, TARGET.sha256);
  const altered = Buffer.from(bytes); altered[64]--; altered[87]++;
  const after = identifyStory(altered);
  assert.equal(after.headerMatchesTarget, true);
  assert.equal(after.checksumValid, true);
  assert.notEqual(after.sha256, before.sha256);
  assert.equal(after.matchesTarget, false);
});

test('baseline cannot overwrite its input bytes', async t => {
  const root = await fixture(t), story = path.join(root, 'story.dat');
  const bytes = syntheticStory(); await writeFile(story, bytes);
  await assert.rejects(runBaseline(['--dat', story, '--out', story]), /already exists/);
  assert.deepEqual(await readFile(story), bytes);
});

test('existing Evidence, hard links and symlink aliases remain unchanged', async t => {
  const root = await fixture(t), original = path.join(root, 'evidence.json');
  const bytes = Buffer.from('existing evidence'); await writeFile(original, bytes);
  const alias = path.join(root, 'alias.json'); await symlink(original, alias);
  const hard = path.join(root, 'hard.json'); await link(original, hard);
  for (const file of [original, alias, hard]) {
    await assert.rejects(assertNewEvidencePath(file), /already exists/);
    await assert.rejects(writeEvidence(file, { replacement: true }), /already exists/);
    assert.deepEqual(await readFile(file), bytes);
  }
  const dangling = path.join(root, 'dangling.json');
  const target = path.join(root, 'absent.json'); await symlink(target, dangling);
  await assert.rejects(writeEvidence(dangling, {}), /already exists/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
});

test('new evidence is exclusive and cannot be rewritten', async t => {
  const root = await fixture(t), file = path.join(root, 'nested', 'new.json');
  await assertNewEvidencePath(file);
  await writeEvidence(file, { immutable: true });
  await assert.rejects(writeEvidence(file, { immutable: false }), /already exists/);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { immutable: true });
});

test('source fetch rejects nonempty directories before invoking the network', async t => {
  const root = await fixture(t), source = path.join(root, 'source'); await mkdir(source);
  const sentinel = path.join(source, 'people.zil'); await writeFile(sentinel, 'local source');
  await assert.rejects(fetchSource(source), /empty directory/);
  assert.equal(await readFile(sentinel, 'utf8'), 'local source');
});
