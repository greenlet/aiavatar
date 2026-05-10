/**
 * Stream a chat completion from the FastAPI backend (SSE).
 * Yields text deltas; throws on error event.
 *
 * Usage:
 *   for await (const delta of streamChat(messages)) { ... }
 */
export async function* streamChat(messages, { deployment, signal } = {}) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, deployment }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`chat request failed: ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines.
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let evt;
        try { evt = JSON.parse(payload); } catch { continue; }
        if (evt.error) throw new Error(evt.error);
        if (evt.done) return;
        if (evt.delta) yield evt.delta;
      }
    }
  }
}
