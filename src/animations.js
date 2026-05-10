/**
 * Single source of truth for gesture animations.
 * Names MUST match the GESTURES tuple in backend/prompts.py.
 */

export const ANIMATIONS = [
  { name: 'greeting',       url: '/animations/greeting.glb' },
  { name: 'standing_idle',  url: '/animations/standing_idle.glb' },
  { name: 'talking_funny',  url: '/animations/talking_funny.glb' },
  { name: 'talking_seated', url: '/animations/talking_seated.glb' },
  { name: 'thinking',       url: '/animations/thinking.glb' },
  { name: 'waving',         url: '/animations/waving.glb' },
];

export const ANIMATION_BY_NAME = Object.fromEntries(
  ANIMATIONS.map((a) => [a.name, a])
);

export const IDLE_GESTURE = 'standing_idle';

// Pretty labels for UI buttons (preserves prior display names).
export const ANIMATION_LABELS = {
  greeting:       'Greeting',
  standing_idle:  'Standing Idle',
  talking_funny:  'Talking Funny',
  talking_seated: 'Talking Seated',
  thinking:       'Thinking',
  waving:         'Waving',
};
