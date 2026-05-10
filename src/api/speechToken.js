/**
 * Cached short-lived Azure Speech auth token.
 * The mint endpoint returns a JWT valid ~10 minutes; we refresh at 8.
 */
let cached = null; // { token, region, expiresAt }

async function mint() {
  const resp = await fetch('/api/speech-token', { method: 'POST' });
  if (!resp.ok) throw new Error(`speech-token failed: ${resp.status}`);
  const { token, region } = await resp.json();
  return { token, region, expiresAt: Date.now() + 8 * 60 * 1000 };
}

export async function getSpeechToken() {
  if (!cached || Date.now() >= cached.expiresAt) {
    cached = await mint();
  }
  return cached;
}

export function clearSpeechTokenCache() {
  cached = null;
}
