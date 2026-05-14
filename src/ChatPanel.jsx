import React, { useCallback, useRef, useState } from 'react';
import { streamChat } from './api/chat';
import { createCueStreamParser } from './avatar/gestureParser';
import { createTtsScheduler } from './avatar/ttsScheduler';
import { useSpeechRecognition } from './useSpeechRecognition';
import { ANIMATIONS } from './animations';
import { EXPRESSION_NAMES } from './avatar/expressions';

const ALLOWED = {
  gesture: new Set(ANIMATIONS.map((a) => a.name)),
  expression: new Set(EXPRESSION_NAMES),
};

/**
 * Chatbot panel: text input + push-to-talk mic. Streams the LLM reply through
 * the cue parser and forwards speakable chunks to the parent-provided
 * `speak(text, { cues, onCue })` from useTtsLipSync.
 */
export default function ChatPanel({
  onGesture,
  onExpression,
  speak,
  stopTts,
  speaking,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const { listening, interim, start: startStt, stop: stopStt } = useSpeechRecognition({
    onFinal: (text) => {
      setInput('');
      void send(text);
    },
  });

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);

    const newMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setBusy(true);

    const parser = createCueStreamParser(ALLOWED);
    const scheduler = createTtsScheduler({
      speak,
      onCue: (kind, name) => {
        if (kind === 'gesture') onGesture?.(name);
        else if (kind === 'expression') onExpression?.(name);
      },
    });

    abortRef.current = new AbortController();
    let assistantText = '';
    try {
      for await (const delta of streamChat(newMessages, { signal: abortRef.current.signal })) {
        const { cleanText, cues } = parser.feed(delta);
        if (cleanText || cues.length) {
          scheduler.feed(cleanText, cues);
          assistantText += cleanText;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: assistantText };
            return next;
          });
        }
      }
      const tail = parser.flush();
      if (tail.cleanText || tail.cues.length) {
        scheduler.feed(tail.cleanText, tail.cues);
        assistantText += tail.cleanText;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: assistantText };
          return next;
        });
      }
      scheduler.flush();
    } catch (err) {
      console.error('chat error:', err);
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, messages, speak, onGesture, onExpression]);

  const onSubmit = (e) => {
    e.preventDefault();
    void send(input);
    setInput('');
  };

  const onCancel = () => {
    abortRef.current?.abort();
    stopTts();
    setBusy(false);
  };

  const onMic = () => {
    if (listening) stopStt();
    else startStt();
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8 }}>
        Chat {speaking && <span style={{ color: '#3b82f6' }}>· speaking</span>}
        {listening && <span style={{ color: '#22c55e' }}> · listening</span>}
      </div>

      <div style={historyStyle}>
        {messages.length === 0 && (
          <div style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>
            Say hi to the avatar.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ ...msgStyle, ...(m.role === 'user' ? msgUser : msgBot) }}>
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>{m.role}</div>
            <div>{m.content || (m.role === 'assistant' && busy ? '…' : '')}</div>
          </div>
        ))}
        {interim && (
          <div style={{ ...msgStyle, ...msgUser, opacity: 0.5 }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>you (live)</div>
            <div>{interim}</div>
          </div>
        )}
        {error && <div style={{ color: '#ef4444', fontSize: 12 }}>Error: {error}</div>}
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button
          type="button"
          onClick={onMic}
          style={listening ? btnActive : btnIcon}
          title={listening ? 'Stop listening' : 'Push to talk'}
        >
          🎙️
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or push to talk…"
          disabled={busy}
          style={inputStyle}
        />
        {busy ? (
          <button type="button" onClick={onCancel} style={btnIcon} title="Cancel">✕</button>
        ) : (
          <button type="submit" style={btnIcon} disabled={!input.trim()} title="Send">➤</button>
        )}
      </form>
    </div>
  );
}

const panelStyle = {
  marginTop: 16,
  padding: 12,
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 240,
};

const historyStyle = {
  flex: 1,
  maxHeight: 320,
  overflowY: 'auto',
  background: '#08080d',
  border: '1px solid #1a1a26',
  borderRadius: 4,
  padding: 8,
  fontSize: 13,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const msgStyle = {
  padding: '6px 8px',
  borderRadius: 4,
  lineHeight: 1.35,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const msgUser = { background: '#1e293b', color: '#dbeafe', alignSelf: 'flex-end', maxWidth: '85%' };
const msgBot = { background: '#1f1f2e', color: '#eee', alignSelf: 'flex-start', maxWidth: '85%' };

const inputStyle = {
  flex: 1,
  padding: '6px 8px',
  background: '#16161f',
  color: '#eee',
  border: '1px solid #333',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
};

const btnIcon = {
  padding: '6px 10px',
  background: '#222',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};

const btnActive = { ...btnIcon, background: '#22c55e', color: '#fff', borderColor: '#16a34a' };
