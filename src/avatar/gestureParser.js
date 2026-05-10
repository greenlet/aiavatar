/**
 * Streaming-safe parser for inline [gesture:NAME] tags emitted by the LLM.
 *
 * Returns { cleanText, gestures, residual } where:
 *   - cleanText: the input with all complete tags removed
 *   - gestures:  [{ name, atIndex }] anchored to positions in cleanText
 *                (atIndex is the char offset where the next word begins)
 *   - residual:  any trailing partial tag ("[gesture", "[ges", etc.) that
 *                must be prepended to the next chunk.
 *
 * Names are validated against `allowed` (a Set or array). Unknown/malformed
 * tags are silently dropped, but their text is still removed if a `]` is
 * found, to keep them out of the spoken audio.
 */
const TAG_RE = /\[gesture:([a-z_]+)\]/g;

export function parseChunk(chunk, allowed) {
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);

  // Detect a possible partial tag at the end and split it off as residual.
  // Heuristic: if the last '[' has no matching ']' after it AND the tail
  // could be the start of "[gesture:..." then defer it.
  let residual = '';
  const lastOpen = chunk.lastIndexOf('[');
  if (lastOpen !== -1 && chunk.indexOf(']', lastOpen) === -1) {
    const tail = chunk.slice(lastOpen);
    // Only buffer if it looks like the start of our tag prefix.
    if ('[gesture:'.startsWith(tail) || tail.startsWith('[gesture:')) {
      residual = tail;
      chunk = chunk.slice(0, lastOpen);
    }
  }

  const gestures = [];
  let cleanText = '';
  let lastIndex = 0;
  let match;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(chunk)) !== null) {
    cleanText += chunk.slice(lastIndex, match.index);
    const name = match[1];
    if (allowedSet.has(name)) {
      // Anchor to the position in cleanText where text resumes (next word).
      gestures.push({ name, atIndex: cleanText.length });
    }
    lastIndex = match.index + match[0].length;
  }
  cleanText += chunk.slice(lastIndex);

  return { cleanText, gestures, residual };
}

/**
 * Stateful wrapper that handles split-chunk tags across an SSE stream.
 *
 *   const p = createGestureStreamParser(allowed);
 *   for await (const delta of stream) {
 *     const { cleanText, gestures } = p.feed(delta);
 *     ...
 *   }
 *   const { cleanText } = p.flush();
 */
export function createGestureStreamParser(allowed) {
  let buffer = '';
  return {
    feed(delta) {
      buffer += delta;
      const { cleanText, gestures, residual } = parseChunk(buffer, allowed);
      buffer = residual;
      return { cleanText, gestures };
    },
    flush() {
      const { cleanText, gestures } = parseChunk(buffer, allowed);
      buffer = '';
      // Any leftover residual that never closed is treated as plain text.
      return { cleanText, gestures };
    },
  };
}
