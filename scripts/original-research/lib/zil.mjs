import { createHash } from 'node:crypto';

// This is a source reader, not a ZIL interpreter. Offsets are UTF-16 code units,
// matching JavaScript String.slice; end offsets are exclusive. Lines are 1-based.
export function parseZil(source, { file = '<source>' } = {}) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  let position = 0;
  const comments = [];
  function location(offset) {
    let low = 0, high = starts.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (starts[mid] <= offset) low = mid; else high = mid;
    }
    return { line: low + 1, column: offset - starts[low] + 1 };
  }
  function span(start, end) {
    const a = location(start), b = location(end);
    return { start, end, line: a.line, column: a.column, endLine: b.line, endColumn: b.column };
  }
  function fail(message, offset = position) {
    const where = location(offset);
    throw new SyntaxError(`${file}:${where.line}:${where.column}: ${message}`);
  }
  function whitespace() { while (/\s/.test(source[position] ?? '') && position < source.length) position++; }
  function node(type, start, extra) { return { type, ...span(start, position), ...extra }; }
  function read() {
    whitespace();
    const start = position;
    const char = source[position++];
    if (char === undefined) fail('Expected an expression', start);
    // In ZIL/MDL, semicolon comments out ONE expression, possibly multiline.
    // It is not a line-comment delimiter.
    if (char === ';') {
      const target = read();
      const result = node('comment', start, { children: [target] });
      comments.push(result);
      return result;
    }
    if (char === "'") return node('quote', start, { children: [read()] });
    if ((char === '%' || char === '!') && '<(['.includes(source[position] ?? '\0')) {
      return node(char === '%' ? 'eval' : 'segment', start, { children: [read()] });
    }
    if ('<(['.includes(char)) {
      const close = { '<': '>', '(': ')', '[': ']' }[char];
      const children = [];
      for (;;) {
        whitespace();
        if (position >= source.length) fail(`Unclosed ${char}`, start);
        if (source[position] === close) { position++; break; }
        if ('>)]'.includes(source[position])) fail(`Unexpected ${source[position]}; expected ${close}`);
        children.push(read());
      }
      return node({ '<': 'form', '(': 'list', '[': 'vector' }[char], start, { children });
    }
    if ('>)]'.includes(char)) fail(`Unexpected ${char}`, start);
    if (char === '"') {
      let value = '', closed = false;
      while (position < source.length) {
        const next = source[position++];
        if (next === '"') { closed = true; break; }
        if (next === '\\') {
          if (position >= source.length) fail('Unfinished string escape', position - 1);
          value += source[position++];
        } else value += next;
      }
      if (!closed) fail('Unclosed string', start);
      return node('string', start, { raw: source.slice(start, position), value });
    }
    // Escaping also applies to atoms, including !\" character literals.
    position = start;
    let value = '';
    while (position < source.length) {
      const next = source[position];
      if (/\s/.test(next) || '<>()[];"'.includes(next)) break;
      position++;
      if (next === '\\') {
        if (position >= source.length) fail('Unfinished atom escape', position - 1);
        value += source[position++];
      } else value += next;
    }
    if (position === start) fail('Expected atom', start);
    return node('atom', start, { raw: source.slice(start, position), value });
  }
  const forms = [];
  for (;;) {
    whitespace();
    if (position >= source.length) break;
    forms.push(read());
  }
  return { file, forms, comments };
}

const DEFINITION_KINDS = new Set(['OBJECT', 'ROOM', 'ROUTINE', 'GLOBAL', 'CONSTANT', 'SYNTAX']);
const DIRECTIONS = new Map(Object.entries({
  NORTH: 'n', N: 'n', NE: 'ne', NORTHEAST: 'ne', EAST: 'e', E: 'e',
  SE: 'se', SOUTHEAST: 'se', SOUTH: 's', S: 's', SW: 'sw', SOUTHWEST: 'sw',
  WEST: 'w', W: 'w', NW: 'nw', NORTHWEST: 'nw', UP: 'u', U: 'u',
  DOWN: 'd', D: 'd', IN: 'in', OUT: 'out',
}));
const live = node => (node.children ?? []).filter(child => child.type !== 'comment');
const atom = node => node?.type === 'atom' ? node.value.toUpperCase() : null;
const cleanName = value => value.replace(/^[,.']+/, '').split(':')[0].toUpperCase();
const isSymbol = value => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && /[A-Za-z]/.test(value);
const isBareSymbol = node => node?.type === 'atom' && /^[A-Za-z][A-Za-z0-9?!_-]*$/.test(node.value);
const sourceSpan = (file, node) => ({ file, start: node.start, end: node.end, line: node.line,
  column: node.column, endLine: node.endLine, endColumn: node.endColumn });

/** Index lexical evidence only. No macro expansion, condition evaluation, or prose synthesis. */
export function indexSources(sources, { sourceCommit = null } = {}) {
  const output = {
    schemaVersion: 1, sourceCommit, offsetUnit: 'utf16-code-unit', endOffset: 'exclusive',
    semantics: 'lexical-only; definitions under wrappers are not assumed active; references are not an execution graph',
    files: [], definitions: [], references: [], strings: [], exits: [], diagnostics: [],
  };
  for (const input of [...sources].sort((a, b) => a.path.localeCompare(b.path))) {
    const file = input.path.replaceAll('\\', '/');
    const source = input.source;
    const parsed = parseZil(source, { file });
    output.files.push({ path: file, sha256: createHash('sha256').update(source).digest('hex'),
      characters: source.length, bytes: Buffer.byteLength(source), comments: parsed.comments.length });
    function visit(node, owner = null, wrappers = [], context = null, excluded = new Set()) {
      if (node.type === 'comment') return;
      if (node.type === 'quote') {
        // Quoted trees are data. Record their string provenance, but never calls or definitions.
        visitQuoted(node, owner);
        return;
      }
      if (node.type === 'string') {
        output.strings.push({ id: `${file}:${node.start}`, owner: owner?.id ?? null,
          context, raw: node.raw, value: node.value, span: sourceSpan(file, node) });
        return;
      }
      if (node.type === 'atom') {
        if (!excluded.has(node.start) && isSymbol(node.value)) output.references.push({
          owner: owner?.id ?? null, symbol: cleanName(node.value), raw: node.raw,
          role: node.value.startsWith('.') ? 'local-symbol' : node.value.startsWith(',') ? 'global-symbol' : 'symbol',
          span: sourceSpan(file, node),
        });
        return;
      }
      const children = live(node);
      const head = node.type === 'form' ? atom(children[0]) : null;
      const kind = DEFINITION_KINDS.has(head) ? head : null;
      let nextOwner = owner;
      let nextExcluded = excluded;
      if (kind) {
        const nameNode = children[1];
        if (nameNode?.type !== 'atom') {
          output.diagnostics.push({ code: 'definition-without-symbol', kind, span: sourceSpan(file, node) });
        } else {
          const rawName = nameNode.value;
          nextOwner = { id: `${file}:${node.start}`, kind, name: cleanName(rawName),
            rawName: nameNode.raw, typeAnnotation: rawName.includes(':') ? rawName.slice(rawName.indexOf(':') + 1) : null,
            span: sourceSpan(file, node), nested: wrappers.length > 0,
            enclosingForms: [...wrappers],
          };
          // SYNTAX is an individual rule; repeated verb names are expected.
          if (kind === 'SYNTAX') nextOwner.rule = source.slice(node.start, node.end);
          output.definitions.push(nextOwner);
          nextExcluded = new Set(excluded);
          nextExcluded.add(children[0].start);
          nextExcluded.add(nameNode.start);
          if (kind === 'ROUTINE' && children[2]?.type === 'list') {
            for (const parameter of live(children[2])) {
              const binding = parameter.type === 'list' ? live(parameter)[0] : parameter;
              if (binding?.type === 'atom') nextExcluded.add(binding.start);
            }
          }
          if (kind === 'ROOM' || kind === 'OBJECT') {
            for (const property of children.slice(2)) {
              if (property.type !== 'list') continue;
              const parts = live(property), directionName = atom(parts[0]);
              if (!DIRECTIONS.has(directionName)) continue;
              output.exits.push(classifyExit(file, source, nextOwner, property, parts, directionName));
            }
          }
        }
      }
      if (head && !kind && children[0]?.type === 'atom') {
        output.references.push({ owner: owner?.id ?? null, symbol: cleanName(head), raw: children[0].raw,
          role: 'call-head', span: sourceSpan(file, children[0]) });
        nextExcluded = new Set(nextExcluded);
        nextExcluded.add(children[0].start);
      }
      const nextWrappers = node.type === 'form' ? [...wrappers, head ?? '<dynamic-head>']
        : ['eval', 'segment'].includes(node.type) ? [...wrappers, `<reader-${node.type}>`] : wrappers;
      for (const child of children) visit(child, nextOwner, nextWrappers,
        node.type === 'form' ? head : context, nextExcluded);
    }
    function visitQuoted(node, owner) {
      if (node.type === 'comment') return;
      if (node.type === 'string') {
        output.strings.push({ id: `${file}:${node.start}`, owner: owner?.id ?? null, context: 'quoted-data',
          raw: node.raw, value: node.value, span: sourceSpan(file, node) });
      }
      for (const child of node.children ?? []) visitQuoted(child, owner);
    }
    for (const form of parsed.forms) visit(form);
  }
  const byName = new Map();
  for (const definition of output.definitions) {
    if (!byName.has(definition.name)) byName.set(definition.name, []);
    byName.get(definition.name).push(definition.id);
  }
  for (const reference of output.references) reference.definitionIds = reference.role === 'local-symbol'
    ? [] : (byName.get(reference.symbol) ?? []);
  return output;
}

function classifyExit(file, source, owner, node, parts, directionName) {
  const mode = atom(parts[1]);
  const hasCondition = parts.slice(2).some(part => ['IF', 'ELSE', 'IS'].includes(atom(part)));
  const result = { owner: owner.id, room: owner.name, direction: DIRECTIONS.get(directionName),
    directionName, mode, classification: 'unknown', raw: source.slice(node.start, node.end),
    span: sourceSpan(file, node), conditionEvaluated: false };
  if (mode === 'TO' && isBareSymbol(parts[2])) {
    result.destination = cleanName(parts[2].value);
    result.classification = hasCondition ? 'conditional' : parts.length === 3 ? 'direct' : 'unknown';
  } else if (mode === 'PER' && isBareSymbol(parts[2])) {
    result.routine = cleanName(parts[2].value);
    result.classification = hasCondition ? 'conditional-routine' : parts.length === 3 ? 'routine' : 'unknown';
  } else if (mode === 'SORRY' && parts[2]?.type === 'string') {
    result.messageSpan = sourceSpan(file, parts[2]);
    result.classification = parts.length === 3 ? 'blocked-message' : 'unknown';
  }
  return result;
}

export const buildIndex = indexSources;
