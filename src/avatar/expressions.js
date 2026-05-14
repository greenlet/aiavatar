/**
 * Facial expression presets — ARKit-style blendshape combos for the v06
 * (Ready Player Me) model. Names MUST match the EXPRESSIONS tuple in
 * backend/prompts.py.
 *
 * Each preset is a flat { shapeName: weight } map. Weights are 0..1.
 * The expression controller fades these in/out over ~250 ms and holds
 * them for a configurable duration (default 2.5 s).
 *
 * Models without ARKit shapes (v03/v04/v05) silently ignore unknown
 * names — the morph-target loop in ModelViewer skips missing keys.
 */

export const EXPRESSIONS = {
  neutral: {},

  smile: {
    mouthSmileLeft: 0.7,
    mouthSmileRight: 0.7,
    cheekSquintLeft: 0.35,
    cheekSquintRight: 0.35,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.2,
  },

  big_smile: {
    mouthSmileLeft: 1.0,
    mouthSmileRight: 1.0,
    cheekSquintLeft: 0.6,
    cheekSquintRight: 0.6,
    eyeSquintLeft: 0.45,
    eyeSquintRight: 0.45,
    jawOpen: 0.15,
    mouthOpen: 0.1,
  },

  frown: {
    mouthFrownLeft: 0.7,
    mouthFrownRight: 0.7,
    browDownLeft: 0.4,
    browDownRight: 0.4,
  },

  sad: {
    mouthFrownLeft: 0.45,
    mouthFrownRight: 0.45,
    browInnerUp: 0.7,
    eyeSquintLeft: 0.25,
    eyeSquintRight: 0.25,
    mouthLowerDownLeft: 0.2,
    mouthLowerDownRight: 0.2,
  },

  surprise: {
    eyeWideLeft: 0.85,
    eyeWideRight: 0.85,
    browInnerUp: 0.7,
    browOuterUpLeft: 0.6,
    browOuterUpRight: 0.6,
    jawOpen: 0.35,
    mouthFunnel: 0.3,
  },

  angry: {
    browDownLeft: 0.85,
    browDownRight: 0.85,
    mouthFrownLeft: 0.4,
    mouthFrownRight: 0.4,
    noseSneerLeft: 0.3,
    noseSneerRight: 0.3,
    eyeSquintLeft: 0.25,
    eyeSquintRight: 0.25,
  },

  wink: {
    eyeBlinkRight: 1.0,
    mouthSmileLeft: 0.45,
    mouthSmileRight: 0.45,
    cheekSquintRight: 0.4,
  },

  curious: {
    browOuterUpLeft: 0.55,
    browInnerUp: 0.25,
    eyeWideLeft: 0.25,
    eyeWideRight: 0.15,
    mouthPressLeft: 0.15,
  },

  confused: {
    browDownLeft: 0.5,
    browOuterUpRight: 0.55,
    mouthPressLeft: 0.3,
    mouthLeft: 0.2,
  },

  thoughtful: {
    mouthPressLeft: 0.45,
    mouthPressRight: 0.25,
    browDownLeft: 0.3,
    eyeLookUpLeft: 0.4,
    eyeLookUpRight: 0.4,
  },

  laugh: {
    mouthSmileLeft: 0.9,
    mouthSmileRight: 0.9,
    jawOpen: 0.4,
    cheekSquintLeft: 0.7,
    cheekSquintRight: 0.7,
    eyeSquintLeft: 0.7,
    eyeSquintRight: 0.7,
  },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

export const EXPRESSION_LABELS = {
  neutral: 'Neutral',
  smile: 'Smile',
  big_smile: 'Big Smile',
  frown: 'Frown',
  sad: 'Sad',
  surprise: 'Surprise',
  angry: 'Angry',
  wink: 'Wink',
  curious: 'Curious',
  confused: 'Confused',
  thoughtful: 'Thoughtful',
  laugh: 'Laugh',
};

/** Union of every shape name referenced by any preset. */
export const ALL_EXPRESSION_SHAPES = (() => {
  const s = new Set();
  for (const preset of Object.values(EXPRESSIONS)) {
    for (const k of Object.keys(preset)) s.add(k);
  }
  return [...s];
})();
