/**
 * Buffers streaming text into sentence-sized utterances and forwards them
 * to a TTS `speak(text, { gestures, onGesture })` function. Re-anchors
 * gesture char-offsets so each utterance gets only its own gestures with
 * indices relative to that utterance's text.
 *
 *   const sched = createTtsScheduler({ speak, onGesture });
 *   sched.feed(cleanText, gestures);   // many times
 *   sched.flush();                      // once at end of stream
 */

const SENTENCE_END = /([.!?]+)(\s+|$)/g;
const MAX_PENDING = 240; // chars — flush even mid-sentence past this length

export function createTtsScheduler({ speak, onGesture }) {
  let buffer = '';
  let pendingGestures = []; // {name, atIndex} indices into `buffer`

  const emit = (text, gestures) => {
    if (!text.trim()) return;
    speak(text, { gestures, onGesture });
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
      for (const g of pendingGestures) {
        if (g.atIndex <= cut) here.push({ name: g.name, atIndex: g.atIndex });
        else rest.push({ name: g.name, atIndex: g.atIndex - cut });
      }
      emit(text, here);
      const tail = buffer.slice(cut);
      const trimmed = tail.replace(/^\s+/, '');
      const stripped = tail.length - trimmed.length;
      buffer = trimmed;
      pendingGestures = rest.map((g) => ({
        name: g.name,
        atIndex: Math.max(0, g.atIndex - stripped),
      }));
    }
  };

  return {
    feed(deltaText, gestures = []) {
      const base = buffer.length;
      buffer += deltaText;
      for (const g of gestures) {
        pendingGestures.push({ name: g.name, atIndex: base + g.atIndex });
      }
      drain(false);
    },
    flush() {
      drain(true);
    },
  };
}
