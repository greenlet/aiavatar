import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook for real-time microphone → Oculus viseme lip-sync using HeadAudio.
 * Returns { micActive, toggleMic, visemeValues } to be merged with blendshapes.
 */
export function useLipSync() {
  const [micActive, setMicActive] = useState(false);
  const [visemeValues, setVisemeValues] = useState({});

  const audioCtxRef = useRef(null);
  const headaudioRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  // Smoothed values to reduce flickering
  const smoothedRef = useRef({});

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (headaudioRef.current) {
      headaudioRef.current.stop();
      headaudioRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
    headaudioRef.current = null;
    streamRef.current = null;
    sourceRef.current = null;
    smoothedRef.current = {};
    setVisemeValues({});
  }, []);

  const toggleMic = useCallback(async () => {
    if (micActive) {
      cleanup();
      setMicActive(false);
      return;
    }

    try {
      // 1. Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // 2. Create AudioContext
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      // 3. Register the HeadAudio worklet processor
      const workletUrl = new URL(
        '@met4citizen/headaudio/dist/headworklet.min.mjs',
        import.meta.url
      );
      await audioCtx.audioWorklet.addModule(workletUrl);

      // 4. Import HeadAudio class dynamically
      const { HeadAudio } = await import('@met4citizen/headaudio/dist/headaudio.min.mjs');

      // 5. Create HeadAudio node
      const headaudio = new HeadAudio(audioCtx, {
        processorOptions: {},
        parameterData: {
          vadGateActiveDb: -35,
          vadGateInactiveDb: -55,
          speakerMeanHz: 150,
        },
      });
      headaudioRef.current = headaudio;

      // Tune viseme max values: balanced vertical/horizontal/narrow
      headaudio.visemeMaxs = [
        0.8, 0.75, 0.85, 0.8, 0.9,    // aa, E, I, O, U (U=narrow pucker)
        0.9, 0.85, 0.75, 0.75, 0.9,   // PP, SS, TH, DD, FF (PP,FF=narrow)
        0.75, 0.75, 0.75, 0.85, 0.4   // kk, nn, RR, CH, sil
      ];

      // Use gentler sigmoid for smoother transitions
      headaudio.easing = headaudio.sigmoidFactory(3);

      // 6. Load the pre-trained English viseme model
      const modelUrl = new URL(
        '@met4citizen/headaudio/dist/model-en-mixed.bin',
        import.meta.url
      );
      await headaudio.loadModel(modelUrl.href);

      // 7. Connect mic → HeadAudio
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(headaudio);

      // 8. Collect raw viseme values via callback
      const rawValues = {};
      headaudio.onvalue = (name, value) => {
        rawValues[name] = value;
      };

      // 9. Animation loop: call headaudio.update, apply smoothing,
      //    then push to React state
      const SMOOTH_UP = 0.25;   // attack: how fast visemes rise (0-1, lower = smoother)
      const SMOOTH_DOWN = 0.12; // decay: how fast visemes fall (0-1, lower = smoother)
      const smoothed = smoothedRef.current;

      const tick = (time) => {
        const dt = time - lastTimeRef.current;
        lastTimeRef.current = time;

        if (headaudioRef.current) {
          headaudioRef.current.update(dt);
        }

        // Exponential smoothing on raw values
        const output = {};
        for (const [key, target] of Object.entries(rawValues)) {
          const prev = smoothed[key] || 0;
          const alpha = target > prev ? SMOOTH_UP : SMOOTH_DOWN;
          const val = prev + alpha * (target - prev);
          smoothed[key] = val;
          output[key] = val;
        }

        // Drive jawOpen proportional to open-mouth visemes only, with a lower cap
        const openVisemes = ['viseme_aa', 'viseme_O', 'viseme_E', 'viseme_DD'];
        const narrowVisemes = ['viseme_I', 'viseme_U', 'viseme_PP', 'viseme_FF', 'viseme_SS', 'viseme_CH'];
        const openVal = Math.max(...openVisemes.map(k => output[k] || 0), 0);
        const narrowVal = Math.max(...narrowVisemes.map(k => output[k] || 0), 0);
        output['jawOpen'] = openVal * 0.4 + narrowVal * 0.1;
        output['mouthOpen'] = openVal * 0.25;
        // Add mouthPucker for narrow sounds (U, PP, FF)
        output['mouthPucker'] = (output['viseme_U'] || 0) * 0.5 + (output['viseme_PP'] || 0) * 0.3 + (output['viseme_FF'] || 0) * 0.3;
        // Add mouthFunnel for O
        output['mouthFunnel'] = (output['viseme_O'] || 0) * 0.4;

        setVisemeValues({ ...output });
        rafRef.current = requestAnimationFrame(tick);
      };
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);

      headaudio.start();
      setMicActive(true);
    } catch (err) {
      console.error('Mic/HeadAudio setup failed:', err);
      cleanup();
    }
  }, [micActive, cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return { micActive, toggleMic, visemeValues };
}
