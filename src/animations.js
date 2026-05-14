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
  { name: 'shrug',          url: '/animations/shrug.glb' },
  { name: 'pointing',       url: '/animations/pointing.glb' },
  { name: 'clapping',       url: '/animations/clapping.glb' },
  { name: 'agreeing',       url: '/animations/agreeing.glb' },
  { name: 'disappointed',   url: '/animations/disappointed.glb' },
  { name: 'excited',        url: '/animations/excited.glb' },
  { name: 'thankful',       url: '/animations/thankful.glb' },
  { name: 'salute',         url: '/animations/salute.glb' },
  { name: 'weight_shift',   url: '/animations/weight_shift.glb' },
  { name: 'talking',        url: '/animations/talking.glb' },
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
  shrug:          'Shrug',
  pointing:       'Pointing',
  clapping:       'Clapping',
  agreeing:       'Agreeing',
  disappointed:   'Disappointed',
  excited:        'Excited',
  thankful:       'Thankful',
  salute:         'Salute',
  weight_shift:   'Weight Shift',
  talking:        'Talking',
};
