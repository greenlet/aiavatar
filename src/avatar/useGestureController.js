import { useCallback, useRef, useState } from 'react';
import { ANIMATION_BY_NAME, IDLE_GESTURE } from '../animations';

/**
 * Drives the avatar's gesture state machine.
 *
 * Returns:
 *   gestureUrl       — current animation file URL to load (idle or one-shot)
 *   gestureLoopOnce  — true when a one-shot gesture is playing
 *   triggerGesture(name) — request a one-shot gesture (returns to idle on finish)
 *   handleFinished()       — pass to ModelViewer.onAnimationFinished
 *   currentGesture   — name of the gesture currently playing (idle or one-shot)
 */
export function useGestureController({ enabled = true } = {}) {
  const idle = ANIMATION_BY_NAME[IDLE_GESTURE];
  const [state, setState] = useState({
    name: enabled ? IDLE_GESTURE : null,
    url: enabled ? idle?.url ?? null : null,
    loopOnce: false,
    nonce: 0,
  });
  const nonceRef = useRef(0);

  const triggerGesture = useCallback((name) => {
    if (!enabled) return;
    const anim = ANIMATION_BY_NAME[name];
    if (!anim) {
      console.warn('Unknown gesture:', name);
      return;
    }
    if (name === IDLE_GESTURE) {
      // Just (re)play idle as a loop.
      nonceRef.current += 1;
      setState({ name, url: anim.url, loopOnce: false, nonce: nonceRef.current });
      return;
    }
    nonceRef.current += 1;
    setState({ name, url: anim.url, loopOnce: true, nonce: nonceRef.current });
  }, [enabled]);

  const handleFinished = useCallback(() => {
    // One-shot finished → return to idle loop.
    if (!enabled) return;
    nonceRef.current += 1;
    setState({
      name: IDLE_GESTURE,
      url: idle?.url ?? null,
      loopOnce: false,
      nonce: nonceRef.current,
    });
  }, [enabled, idle]);

  return {
    gestureUrl: state.url,
    gestureLoopOnce: state.loopOnce,
    currentGesture: state.name,
    triggerGesture,
    handleFinished,
  };
}
