import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechToken } from './api/speechToken';

/**
 * Push-to-talk Azure STT hook.
 *
 *   const { listening, interim, start, stop, available } = useSpeechRecognition({
 *     language: 'en-US',
 *     onFinal: (text) => sendChat(text),
 *   });
 *
 * Mic stops automatically on final recognition. Call start() to begin a turn.
 */
export function useSpeechRecognition({ language = 'en-US', onFinal } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognizerRef = useRef(null);
  const sdkRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const cleanup = useCallback(() => {
    const r = recognizerRef.current;
    if (r) {
      try { r.stopContinuousRecognitionAsync(() => r.close(), () => r.close()); }
      catch { /* noop */ }
    }
    recognizerRef.current = null;
    setInterim('');
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (recognizerRef.current) return;
    const sdk = sdkRef.current ?? (sdkRef.current = await import('microsoft-cognitiveservices-speech-sdk'));
    const { token, region } = await getSpeechToken();

    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = language;
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    recognizer.recognizing = (_s, e) => setInterim(e.result.text || '');
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const text = (e.result.text || '').trim();
        setInterim('');
        if (text) onFinalRef.current?.(text);
        // PTT pattern: stop after one final result.
        cleanup();
      }
    };
    recognizer.canceled = (_s, e) => {
      console.warn('STT canceled:', e.errorDetails || e.reason);
      cleanup();
    };
    recognizer.sessionStopped = () => cleanup();

    setListening(true);
    recognizer.startContinuousRecognitionAsync(
      () => { /* started */ },
      (err) => { console.error('STT start failed:', err); cleanup(); }
    );
  }, [cleanup, language]);

  const stop = useCallback(() => cleanup(), [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { listening, interim, start, stop, available: true };
}
