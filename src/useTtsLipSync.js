import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechToken } from './api/speechToken';
import { msVisemeToOculus, OCULUS_VISEMES } from './avatar/visemeMap';

/**
 * Azure TTS lip-sync hook.
 *
 * Returns:
 *   speak(text, { gestures, onGesture })  — queue text to synthesize.
 *     `gestures` is [{ name, atIndex }] anchored to character offsets in `text`.
 *     `onGesture(name)` is invoked when a wordBoundary crosses a gesture anchor.
 *   stop()        — cancel current + queued utterances and silence the avatar.
 *   speaking      — boolean, true while audio is playing
 *   visemeValues  — { viseme_*, jawOpen, mouthOpen, mouthPucker, mouthFunnel }
 *
 * Audio playback is handled by the SDK's default SpeakerAudioDestination.
 */
export function useTtsLipSync({ voice = 'en-US-JennyNeural' } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [visemeValues, setVisemeValues] = useState({});

  const sdkRef = useRef(null);          // dynamically imported SDK module
  const queueRef = useRef([]);          // [{ text, gestures, onGesture, resolve }]
  const activeRef = useRef(null);       // currently-running utterance state
  const rafRef = useRef(null);
  const targetsRef = useRef({});        // viseme name → target weight 0..1
  const currentRef = useRef({});        // smoothed current weights
  const visemeScheduleRef = useRef([]); // [{ atMs, visemeName }]
  const playbackStartRef = useRef(0);   // performance.now() at audio start
  const stoppedRef = useRef(false);

  // ---- lazy SDK load ------------------------------------------------------
  const loadSdk = useCallback(async () => {
    if (sdkRef.current) return sdkRef.current;
    sdkRef.current = await import('microsoft-cognitiveservices-speech-sdk');
    return sdkRef.current;
  }, []);

  // ---- per-frame smoothing loop -------------------------------------------
  const startTickLoop = useCallback(() => {
    if (rafRef.current) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      // Apply scheduled visemes whose time has come.
      const elapsedMs = now - playbackStartRef.current;
      const sched = visemeScheduleRef.current;
      while (sched.length > 0 && sched[0].atMs <= elapsedMs) {
        const { visemeName } = sched.shift();
        // Reset all to 0 then peak the active one.
        for (const v of OCULUS_VISEMES) targetsRef.current[v] = 0;
        targetsRef.current[visemeName] = 1.0;
      }

      // Smooth current → target with ~80 ms time constant.
      const tau = 0.08;
      const alpha = 1 - Math.exp(-dt / tau);
      const next = { ...currentRef.current };
      for (const v of OCULUS_VISEMES) {
        const tgt = targetsRef.current[v] ?? 0;
        const cur = next[v] ?? 0;
        next[v] = cur + (tgt - cur) * alpha;
      }
      currentRef.current = next;

      // Derive helper shapes (matches useLipSync.js behavior).
      const openVis = ['viseme_aa', 'viseme_O', 'viseme_E', 'viseme_DD'];
      const narrowVis = ['viseme_I', 'viseme_U', 'viseme_PP', 'viseme_FF', 'viseme_SS', 'viseme_CH'];
      const openVal = Math.max(...openVis.map((k) => next[k] || 0), 0);
      const narrowVal = Math.max(...narrowVis.map((k) => next[k] || 0), 0);
      const out = { ...next };
      out.jawOpen = openVal * 0.4 + narrowVal * 0.1;
      out.mouthOpen = openVal * 0.25;
      out.mouthPucker = (next.viseme_U || 0) * 0.5 + (next.viseme_PP || 0) * 0.3 + (next.viseme_FF || 0) * 0.3;
      out.mouthFunnel = (next.viseme_O || 0) * 0.4;

      setVisemeValues(out);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTickLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ---- one utterance ------------------------------------------------------
  const runOne = useCallback(async (job) => {
    const sdk = await loadSdk();
    const { token, region } = await getSpeechToken();

    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    // Explicit speaker destination so we can wait for *playback* to finish,
    // not just synthesis. With the default (parameterless) constructor,
    // speakTextAsync's success callback fires at end-of-synthesis while
    // audio is still playing — causing the next utterance to overlap.
    const player = new sdk.SpeakerAudioDestination();
    const audioConfig = sdk.AudioConfig.fromSpeakerOutput(player);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
    activeRef.current = { synthesizer, player, job };

    // Reset per-utterance viseme schedule so leftovers from a previous
    // sentence don't get re-anchored to this utterance's clock.
    visemeScheduleRef.current = [];
    for (const v of OCULUS_VISEMES) targetsRef.current[v] = 0;
    playbackStartRef.current = performance.now();
    let firstViseme = true;
    let lastVisemeOffsetMs = 0;

    synthesizer.visemeReceived = (_s, e) => {
      // e.audioOffset is in 100-ns ticks → ms
      const atMs = e.audioOffset / 10000;
      if (atMs > lastVisemeOffsetMs) lastVisemeOffsetMs = atMs;
      if (firstViseme) {
        // anchor playback start to the first viseme's wallclock arrival
        // minus its own offset, so subsequent events align correctly.
        playbackStartRef.current = performance.now() - atMs;
        firstViseme = false;
      }
      visemeScheduleRef.current.push({
        atMs,
        visemeName: msVisemeToOculus(e.visemeId),
      });
    };

    // Word boundaries → fire any cue whose anchor falls within this word.
    // `cues` is the new shape ({kind,name,atIndex}); `gestures` is legacy
    // (gesture-only). Either may be present; merge and sort by atIndex.
    const pendingCues = [
      ...(job.cues || []),
      ...((job.gestures || []).map((g) => ({ kind: 'gesture', name: g.name, atIndex: g.atIndex }))),
    ].sort((a, b) => a.atIndex - b.atIndex);

    const fireCue = (c) => {
      try {
        if (job.onCue) job.onCue(c.kind, c.name);
        else if (c.kind === 'gesture') job.onGesture?.(c.name);
      } catch (err) { console.error(err); }
    };

    synthesizer.wordBoundary = (_s, e) => {
      // e.textOffset is the char offset in the text we passed in.
      const wordEnd = e.textOffset + (e.wordLength || 0);
      while (pendingCues.length && pendingCues[0].atIndex <= wordEnd) {
        fireCue(pendingCues.shift());
      }
    };

    startTickLoop();

    // Resolve when audio playback (not just synthesis) completes, so the
    // queue advances one sentence at a time without overlap.
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        // console.log('Utterance finished. done =', done);
        if (done) return;
        done = true;
        // Drain any cues whose anchor was past the last word boundary.
        while (pendingCues.length) fireCue(pendingCues.shift());
        try { synthesizer.close(); } catch { /* noop */ }
        resolve();
      };
      // Fast path: if the SDK fires onAudioEnd, finish immediately.
      player.onAudioEnd = finish;

      synthesizer.speakTextAsync(
        job.text,
        () => {
          // Synthesis complete. Schedule finish based on the last viseme's
          // audio offset (+ small tail) since `onAudioEnd` is sometimes
          // unreliable with SpeakerAudioDestination. The `done` guard
          // ensures we still resolve only once.
          const elapsedMs = performance.now() - playbackStartRef.current;
          const tailMs = 250;
          const remaining = Math.max(0, lastVisemeOffsetMs + tailMs - elapsedMs);
          // Hard cap as a last-resort safety net.
          const wait = Math.min(remaining, 8000);
          setTimeout(() => { if (!done) finish(); }, wait);
        },
        (err) => {
          console.error('TTS error:', err);
          finish();
        }
      );
    });

    activeRef.current = null;
  }, [loadSdk, startTickLoop, voice]);

  // ---- queue runner -------------------------------------------------------
  const drainRef = useRef(false);
  const drain = useCallback(async () => {
    if (drainRef.current) return;
    drainRef.current = true;
    setSpeaking(true);
    try {
      while (queueRef.current.length > 0 && !stoppedRef.current) {
        const job = queueRef.current.shift();
        await runOne(job);
        job.resolve?.();
      }
    } finally {
      drainRef.current = false;
      setSpeaking(false);
      // Decay visemes back to silence.
      for (const v of OCULUS_VISEMES) targetsRef.current[v] = 0;
      // Let smoothing loop run a bit longer then stop.
      setTimeout(() => {
        if (!drainRef.current) {
          stopTickLoop();
          setVisemeValues({});
        }
      }, 250);
      stoppedRef.current = false;
    }
  }, [runOne, stopTickLoop]);

  // ---- public API ---------------------------------------------------------
  const speak = useCallback((text, opts = {}) => {
    if (!text || !text.trim()) return Promise.resolve();
    const { gestures = [], onGesture, cues = [], onCue } = opts;
    return new Promise((resolve) => {
      queueRef.current.push({ text, gestures, onGesture, cues, onCue, resolve });
      drain();
    });
  }, [drain]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current.length = 0;
    const active = activeRef.current;
    if (active?.player) {
      try { active.player.pause(); } catch { /* noop */ }
      try { active.player.close(); } catch { /* noop */ }
    }
    if (active?.synthesizer) {
      try { active.synthesizer.close(); } catch { /* noop */ }
    }
    activeRef.current = null;
    visemeScheduleRef.current.length = 0;
    for (const v of OCULUS_VISEMES) targetsRef.current[v] = 0;
  }, []);

  useEffect(() => () => { stop(); stopTickLoop(); }, [stop, stopTickLoop]);

  return { speak, stop, speaking, visemeValues };
}
