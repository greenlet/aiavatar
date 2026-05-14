/**
 * Streaming-safe parser for inline cue tags emitted by the LLM.
 *
 * Supports two cue kinds:
 *   [gesture:NAME]     — full-body Mixamo animation
 *   [expression:NAME]  — facial blendshape preset
 *
 * Returns { cleanText, cues, gestures, residual } where:
 *   - cleanText: input with all complete tags removed
 *   - cues:      [{ kind, name, atIndex }] anchored to char offsets in cleanText
 *   - gestures:  back-compat alias = cues filtered to kind === 'gesture'
 *   - residual:  trailing partial tag deferred to next chunk
 *
 * Names are validated against `allowed`, which can be:
 *   - a Set/array of gesture names                  (legacy)
 *   - { gesture: Set|Array, expression: Set|Array } (preferred)
 * Unknown/malformed tags are silently dropped (text removed if `]` is found).
 */
const TAG_RE = /\[(gesture|expression):([a-z_]+)\]/g;
const PREFIXES = ['[gesture:', '[expression:'];

function normalizeAllowed(allowed) {
  if (allowed instanceof Set || Array.isArray(allowed)) {
    return { gesture: new Set(allowed), expression: new Set() };
  }
  const a = allowed || {};
  return {
    gesture: a.gesture instanceof Set ? a.gesture : new Set(a.gesture || []),
    expression: a.expression instanceof Set ? a.expression : new Set(a.expression || []),
  };
}

export function parseChunk(chunk, allowed) {
  const allow = normalizeAllowed(allowed);

  // Detect a possible partial tag at the end and split it off as residual.
  let residual = '';
  const lastOpen = chunk.lastIndexOf('[');
  if (lastOpen !== -1 && chunk.indexOf(']', lastOpen) === -1) {
    const tail = chunk.slice(lastOpen);
    if (PREFIXES.some((p) => p.startsWith(tail) || tail.startsWith(p))) {
      residual = tail;
      chunk = chunk.slice(0, lastOpen);
    }
  }

  const cues = [];
  let cleanText = '';
  let lastIndex = 0;
  let match;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(chunk)) !== null) {
    cleanText += chunk.slice(lastIndex, match.index);
    const kind = match[1];
    const name = match[2];
    if (allow[kind]?.has(name)) {
      cues.push({ kind, name, atIndex: cleanText.length });
    }
    lastIndex = match.index + match[0].length;
  }
  cleanText += chunk.slice(lastIndex);

  const gestures = cues
    .filter((c) => c.kind === 'gesture')
    .map((c) => ({ name: c.name, atIndex: c.atIndex }));

  return { cleanText, cues, gestures, residual };
}

/**
 * Stateful wrapper that handles split-chunk tags across an SSE stream.
 *
 *   const p = createCueStreamParser({ gesture, expression });
 *   for await (const delta of stream) {
 *     const { cleanText, cues } = p.feed(delta);
 *     ...
 *   }
 *   const { cleanText } = p.flush();
 */
export function createCueStreamParser(allowed) {
  let buffer = '';
  return {
    feed(delta) {
      buffer += delta;
      const { cleanText, cues, gestures, residual } = parseChunk(buffer, allowed);
      buffer = residual;
      return { cleanText, cues, gestures };
    },
    flush() {
      const { cleanText, cues, gestures } = parseChunk(buffer, allowed);
      buffer = '';
      return { cleanText, cues, gestures };
    },
  };
}

// Back-compat alias — older callers expect `gestures` only.
export const createGestureStreamParser = createCueStreamParser;
