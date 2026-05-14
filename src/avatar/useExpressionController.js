import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPRESSIONS, ALL_EXPRESSION_SHAPES } from './expressions';

/**
 * Drives the avatar's facial-expression state machine.
 *
 * Returns:
 *   expressionShapes      — { shapeName: weight } to merge into blendshapes
 *   currentExpression     — name of the active expression (or 'neutral')
 *   triggerExpression(name, { holdMs?, fadeMs? })
 *                         — start fading toward `name`; auto-return to neutral
 *                           after `holdMs` (default 2500). 'neutral' clears.
 *   clearExpression()     — immediately fade back to neutral
 *
 * Implementation: per-frame interpolation between `current` and `target`
 * preset weight maps. Auto-returns to neutral after the hold period elapses.
 */
const DEFAULT_HOLD_MS = 2500;
const DEFAULT_FADE_MS = 250;

export function useExpressionController({ enabled = true } = {}) {
  const [expressionShapes, setExpressionShapes] = useState({});
  const [currentExpression, setCurrentExpression] = useState('neutral');

  const targetRef = useRef({});      // target weights
  const currentRef = useRef({});     // smoothed current weights
  const fadeMsRef = useRef(DEFAULT_FADE_MS);
  const holdTimerRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    lastTickRef.current = performance.now();
    const tick = (now) => {
      const dt = Math.max(0.001, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      const tau = Math.max(0.05, fadeMsRef.current / 1000);
      const alpha = 1 - Math.exp(-dt / tau);

      const cur = currentRef.current;
      const tgt = targetRef.current;
      const next = {};
      let totalDelta = 0;
      for (const k of ALL_EXPRESSION_SHAPES) {
        const c = cur[k] || 0;
        const t = tgt[k] || 0;
        const v = c + (t - c) * alpha;
        next[k] = v;
        totalDelta += Math.abs(t - v);
      }
      currentRef.current = next;
      setExpressionShapes(next);

      // Stop the loop once we've effectively settled.
      if (totalDelta < 0.001) {
        // Snap to target to avoid floating-point drift.
        currentRef.current = { ...tgt };
        setExpressionShapes({ ...tgt });
        stopLoop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const setTarget = useCallback((name) => {
    const preset = EXPRESSIONS[name] || {};
    targetRef.current = { ...preset };
    setCurrentExpression(name);
    startLoop();
  }, [startLoop]);

  const clearExpression = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setTarget('neutral');
  }, [setTarget]);

  const triggerExpression = useCallback((name, opts = {}) => {
    if (!enabled) return;
    if (!(name in EXPRESSIONS)) {
      console.warn('Unknown expression:', name);
      return;
    }
    const { holdMs = DEFAULT_HOLD_MS, fadeMs = DEFAULT_FADE_MS } = opts;
    fadeMsRef.current = fadeMs;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setTarget(name);
    if (name !== 'neutral' && holdMs > 0) {
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        setTarget('neutral');
      }, holdMs);
    }
  }, [enabled, setTarget]);

  // When disabled, immediately drop everything.
  useEffect(() => {
    if (!enabled) clearExpression();
  }, [enabled, clearExpression]);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    stopLoop();
  }, [stopLoop]);

  return {
    expressionShapes,
    currentExpression,
    triggerExpression,
    clearExpression,
  };
}
