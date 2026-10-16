import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseZil, indexSources, buildIndex } from '../scripts/original-research/lib/zil.mjs';

const commit = 'a'.repeat(40);
const index = source => indexSources([{ path: 'fixture.zil', source }], { sourceCommit: commit });

test('ZIL reader handles nested forms, lists, vectors, escaped atoms and strings with exact source ranges', () => {
  const source = String.raw`<ROUTINE DEMO ((ARG <>))
    <TELL "样例😀 \"x\" < > ; |" <NEST [A (B <C>)]>>
    <STRING !\" A\(B CORPSE\'S>>`;
  const ast = parseZil(source, { file: 'fixture.zil' });
  assert.equal(ast.forms.length, 1);
  assert.equal(ast.forms[0].type, 'form');
  assert.equal(ast.forms[0].start, 0);
  assert.equal(ast.forms[0].end, source.length);
  assert.equal(ast.forms[0].endLine, 3);
  const body = ast.forms[0].children;
  const string = body[3].children[1];
  assert.equal(string.value, '样例😀 "x" < > ; |');
  assert.equal(source.slice(string.start, string.end), string.raw);
  assert.deepEqual(body[4].children.slice(1).map(node => node.value), ['!"', 'A(B', "CORPSE'S"]);
  const result = index(source);
  assert.equal(result.files[0].characters, source.length);
  assert.ok(result.files[0].bytes > source.length);
  assert.equal(result.offsetUnit, 'utf16-code-unit');
  assert.equal(result.strings[0].span.line, 2);
  assert.equal(source.slice(result.strings[0].span.start, result.strings[0].span.end), string.raw);
});

test('semicolon disables one complete expression rather than the rest of a line', () => {
  const source = `; <ROUTINE OMITTED ()\n <TELL "ignored">> <ROUTINE LIVE () ; <SKIP> <KEEP>>\n; "note" <GLOBAL COUNT:NUMBER 0>`;
  const ast = parseZil(source);
  assert.equal(ast.comments.length, 3);
  const result = index(source);
  assert.deepEqual(result.definitions.map(definition => definition.name), ['LIVE', 'COUNT']);
  assert.equal(result.strings.length, 0);
  assert.ok(result.references.some(reference => reference.symbol === 'KEEP'));
  assert.ok(!result.references.some(reference => ['SKIP', 'OMITTED'].includes(reference.symbol)));
  assert.equal(result.definitions[1].typeAnnotation, 'NUMBER');
});

test('reader prefixes preserve compile-time forms and segment splices as single expressions', () => {
  const source = '<CONSTANT CODE %<ASCII !\\:>><DEFMAC SAMPLE () <FORM TEST !<REST .ITEMS>>> ; %<ROUTINE OMIT ()>';
  const ast = parseZil(source);
  assert.equal(ast.forms[0].children.length, 3);
  assert.equal(ast.forms[0].children[2].type, 'eval');
  assert.equal(ast.forms[1].children[3].children[2].type, 'segment');
  assert.equal(ast.comments[0].children[0].type, 'eval');
  assert.deepEqual(index(source).definitions.map(definition => definition.name), ['CODE']);
});

test('unterminated or mismatched source rejects instead of producing incomplete evidence', () => {
  for (const source of ['<ROUTINE X ()', '<A )>', '"unfinished', '<A "x\\', '<A B\\', ';']) {
    assert.throws(() => parseZil(source, { file: 'bad.zil' }), /bad\.zil:\d+:\d+:/);
  }
});

test('definitions carry lexical provenance, and nested or quoted forms are not claimed active', () => {
  const source = `<ROOM A (NORTH TO B)>
    <COND (<ENABLED?> <OBJECT CONDITIONAL (LOC A)>)>
    '<ROUTINE QUOTED () <TELL "data">>
    <ROUTINE ROUTE (X (Y ,COUNTER)) <SET X .Y> <TARGET ,COUNTER>>
    <GLOBAL COUNTER:NUMBER 0><CONSTANT LIMIT 1><SYNTAX TEST = V-TEST><SYNTAX TEST OBJECT = V-TEST-OBJ>`;
  const result = index(source);
  assert.equal(result.sourceCommit, commit);
  assert.deepEqual(result.definitions.map(definition => definition.kind),
    ['ROOM', 'OBJECT', 'ROUTINE', 'GLOBAL', 'CONSTANT', 'SYNTAX', 'SYNTAX']);
  const nested = result.definitions.find(definition => definition.name === 'CONDITIONAL');
  assert.equal(nested.nested, true);
  assert.deepEqual(nested.enclosingForms, ['COND']);
  assert.equal(result.definitions[0].nested, false);
  assert.equal(result.strings[0].context, 'quoted-data');
  assert.ok(!result.references.some(reference => reference.symbol === 'QUOTED'));
  assert.ok(!result.references.some(reference => reference.span.start === source.indexOf('(X') + 1));
  assert.equal(result.references.find(reference => reference.raw === '.Y').role, 'local-symbol');
  const globalReference = result.references.find(reference => reference.raw === ',COUNTER');
  assert.equal(globalReference.role, 'global-symbol');
  assert.deepEqual(globalReference.definitionIds, [result.definitions.find(definition => definition.name === 'COUNTER').id]);
  assert.ok(result.references.some(reference => reference.symbol === 'TARGET' && reference.role === 'call-head'));
});

test('exit extraction preserves conditional, routine, blocked and unknown evidence without evaluating it', () => {
  const result = index(`<OBJECT A
    (NORTH TO B) (NE TO C IF DOOR IS OPEN) (EAST PER ROUTE)
    (SOUTH SORRY "fixture") (OUT PER EXIT IF READY) (WEST FOO BAR)
    (UP TO B MAYBE) (DOWN TO B <IF? ,FLAG>) (NW TO .TARGET) (SW PER ,HANDLER)
    (ACTION A-F)>`);
  assert.deepEqual(result.exits.map(exit => exit.classification),
    ['direct', 'conditional', 'routine', 'blocked-message', 'conditional-routine', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
  assert.equal(result.exits[0].destination, 'B');
  assert.equal(result.exits[2].routine, 'ROUTE');
  assert.equal(result.exits[2].conditionEvaluated, false);
  assert.equal(result.exits[3].messageSpan.file, 'fixture.zil');
  assert.ok(!('destination' in result.exits[2]));
});

test('index resolves cross-file references while retaining ambiguous definitions', () => {
  const result = buildIndex([
    { path: 'b.zil', source: '<ROUTINE DEST ()><GLOBAL SHARED 1>' },
    { path: 'a.zil', source: '<ROUTINE SOURCE () <DEST> <USE ,SHARED>><GLOBAL SHARED 0>' },
  ], { sourceCommit: commit });
  assert.deepEqual(result.files.map(file => file.path), ['a.zil', 'b.zil']);
  assert.equal(result.references.find(reference => reference.symbol === 'DEST').definitionIds.length, 1);
  assert.equal(result.references.find(reference => reference.raw === ',SHARED').definitionIds.length, 2);
  assert.equal(result.files[0].sha256.length, 64);
});

test('index CLI reads only ZIL files recursively, pins commit, and writes requested local output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zil-fixture-'));
  try {
    await mkdir(path.join(root, 'source', 'nested'), { recursive: true });
    await writeFile(path.join(root, 'source', 'nested', 'custom.ZIL'), '<ROOM START (OUT TO END)>');
    await writeFile(path.join(root, 'source', 'skip.txt'), '<ROOM IGNORE>');
    const cli = path.resolve('scripts/original-research/index.mjs');
    const out = path.join(root, 'private', 'index.json');
    const run = spawnSync(process.execPath, [cli, '--source', path.join(root, 'source'), '--out', out, '--commit', commit], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(result.sourceCommit, commit);
    assert.deepEqual(result.files.map(file => file.path), ['nested/custom.ZIL']);
    assert.equal(result.definitions.length, 1);
    const missingCommit = spawnSync(process.execPath, [cli, '--source', root, '--out', out], { encoding: 'utf8' });
    assert.notEqual(missingCommit.status, 0);
    assert.match(missingCommit.stderr, /--commit/);
    const trackedFile = path.resolve('README.md');
    const before = await readFile(trackedFile);
    const refused = spawnSync(process.execPath, [cli, '--source', path.join(root, 'source'), '--out', trackedFile, '--commit', commit], { encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /outside the repository|\.local-research/);
    assert.deepEqual(await readFile(trackedFile), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
