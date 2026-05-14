/**
 * Buffers streaming text into sentence-sized utterances and forwards them
 * to a TTS `speak(text, { cues, onCue })` function. Re-anchors cue
 * char-offsets so each utterance gets only its own cues with indices
 * relative to that utterance's text.
 *
 * Each cue has shape { kind: 'gesture' | 'expression', name, atIndex }.
 *
 *   const sched = createTtsScheduler({ speak, onCue });
 *   sched.feed(cleanText, cues);   // many times
 *   sched.flush();                  // once at end of stream
 */

const SENTENCE_END = /([.!?]+)(\s+|$)/g;
const MAX_PENDING = 240; // chars — flush even mid-sentence past this length

export function createTtsScheduler({ speak, onCue, onGesture }) {
  let buffer = '';
  let pendingCues = []; // {kind, name, atIndex} indices into `buffer`

  // Back-compat: route to onGesture for gesture-kind cues if onCue not given.
  const dispatch = onCue
    ? (kind, name) => onCue(kind, name)
    : (kind, name) => { if (kind === 'gesture') onGesture?.(name); };

  const emit = (text, cues) => {
    if (!text.trim()) return;
    speak(text, {
      cues,
      onCue: dispatch,
      // Back-compat keys for older speak() implementations.
      gestures: cues.filter((c) => c.kind === 'gesture'),
      onGesture: (name) => dispatch('gesture', name),
    });
  };

  const drain = (force) => {
    while (buffer.length > 0) {
      SENTENCE_END.lastIndex = 0;
      const m = SENTENCE_END.exec(buffer);
      let cut;
      if (m) {
        cut = m.index + m[1].length; // include punctuation
      } else if (force || buffer.length >= MAX_PENDING) {
        cut = buffer.length;
      } else {
        return; // wait for more text
      }

      const text = buffer.slice(0, cut);
      const here = [];
      const rest = [];
      for (const c of pendingCues) {
        if (c.atIndex <= cut) here.push({ kind: c.kind, name: c.name, atIndex: c.atIndex });
        else rest.push({ kind: c.kind, name: c.name, atIndex: c.atIndex - cut });
      }
      emit(text, here);
      const tail = buffer.slice(cut);
      const trimmed = tail.replace(/^\s+/, '');
      const stripped = tail.length - trimmed.length;
      buffer = trimmed;
      pendingCues = rest.map((c) => ({
        kind: c.kind,
        name: c.name,
        atIndex: Math.max(0, c.atIndex - stripped),
      }));
    }
  };

  return {
    feed(deltaText, cues = []) {
      const base = buffer.length;
      buffer += deltaText;
      for (const c of cues) {
        // Accept either {kind,name,atIndex} or legacy {name,atIndex} (gesture).
        const kind = c.kind || 'gesture';
        pendingCues.push({ kind, name: c.name, atIndex: base + c.atIndex });
      }
      drain(false);
    },
    flush() {
      drain(true);
    },
  };
}
