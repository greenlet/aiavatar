# Mixamo skill

Download conversational gestures and idle/locomotion animations from
[mixamo.com](https://www.mixamo.com), convert them to GLB, and wire them
into the avatar's gesture registry.

## When to use

- Adding new gestures the avatar can play (`[gesture:NAME]` tags from the LLM)
- Replacing existing gestures with different takes
- Bulk-downloading animations against a specific Mixamo character

## Pipeline overview

```
Mixamo (FBX, "Without Skin", Y Bot character)
        │   skills/mixamo/download_mixamo.mjs (Playwright)
        ▼
models/animations/<name>.fbx
        │   convert_fbx_to_glb.py (Blender, bake_space_transform=True)
        ▼
models/animations/<name>.glb
        │   register in src/animations.js + backend/prompts.py
        ▼
Avatar plays it via [gesture:<name>] tags
```

## Step 1 — Prepare a Chrome profile

Mixamo requires login. The download script uses Playwright's
`launchPersistentContext` against a copy of the user's Chrome profile so
you don't have to re-authenticate each run.

```bash
# Make sure Chrome is fully quit first (otherwise the profile is locked).
cp -R "$HOME/Library/Application Support/Google/Chrome" /tmp/chrome-mixamo

# Between runs, remove the singleton lock so Chromium can re-open it:
rm -f /tmp/chrome-mixamo/SingletonLock /tmp/chrome-mixamo/SingletonCookie /tmp/chrome-mixamo/SingletonSocket
```

The script points at `/tmp/chrome-mixamo` and uses `channel: 'chrome'`
(the system Chrome binary) — this avoids the "automated browser"
detection that Mixamo applies to bundled Chromium.

## Step 2 — Edit the animation list

Open `skills/mixamo/download_mixamo.mjs` and update the `ANIMATIONS`
array. Each entry maps a Mixamo search term to a local filename:

```js
const ANIMATIONS = [
  { search: 'Shrug',    name: 'shrug' },
  { search: 'Pointing', name: 'pointing' },
  // ...
];
```

The script picks the **best matching** result among the search hits using
a small scoring algorithm (exact match > startsWith > contains, minus a
length penalty). It rejects unsuitable results via `REJECT_WORDS` —
poses on the floor, kneeling, sitting, crouching, etc. — since the avatar
is a standing conversational character. Adjust those words if you need
e.g. seated gestures.

## Step 3 — Run the downloader

```bash
node skills/mixamo/download_mixamo.mjs
```

The script will:

1. Launch Chrome against `/tmp/chrome-mixamo`
2. Open https://www.mixamo.com/
3. Dismiss the cookie banner
4. **Auto-switch to the default Y Bot character** (see "Skeleton
   compatibility" below for why this matters):
   - Click the "Characters" tab
   - Search for "Y Bot"
   - Click the Y Bot card
   - Confirm via the "USE THIS CHARACTER" modal (if shown)
   - Click "Animations" tab to return
   - Take `screenshots/mixamo-debug/after-switch.png` so you can
     visually verify the switch worked
5. For each animation: search → click best card → open the Download dialog
   → set "Without Skin" → click Download
6. Capture the signed S3 URL from the network response
7. Re-fetch via `page.request.get(url)` and write `models/animations/<name>.fbx`
8. Skip files that already exist
9. Leave the browser open at the end (you can choose to close)

To **skip the auto-switch** (e.g. if you want to download against a
different character or you've already switched manually):

```bash
node skills/mixamo/download_mixamo.mjs --manual
```

In manual mode the script just waits for you to press Enter, then runs
the download loop against whatever character is active.

### How the download actually works

Mixamo doesn't trigger a normal browser download — it kicks off an XHR
that returns a signed URL on `mixamo-storage-prod.s3-us-west-2.amazonaws.com`.
Playwright's `waitForEvent('download')` does **not** fire. The browser's
own download stream consumes the response body, so you can't read it via
`response.body()` either. The trick this script uses:

1. Subscribe to `page.on('response')` and capture the first URL matching
   `mixamo-storage` + `export`.
2. After the user clicks Download, poll until that URL is captured.
3. Re-fetch it with `page.request.get(url)` — this works because the
   signed URL is valid for several minutes.

If the format ever changes, watch the Network tab in DevTools for
something like `…/system/tmp/export_…` and update the URL filter.

### Troubleshooting

- **"No animation cards found"** — the Mixamo UI changed; the
  `selectBestResult` heuristic uses card geometry (left of x=640, below
  y=80, `<p>`/`<span>` text 3–60 chars). Adjust selectors as needed.
- **Wrong card picked** — strengthen the `search` term or extend
  `REJECT_WORDS`.
- **All downloads time out** — the S3 URL filter probably broke; print
  every response URL temporarily to find the new pattern.
- **Browser fails to start** — ensure Chrome is fully closed and that
  `/tmp/chrome-mixamo/SingletonLock`, `SingletonCookie`, and
  `SingletonSocket` are gone.
- **Y-bot switch fails** — Mixamo may have redesigned the Characters
  tab. Check `screenshots/mixamo-debug/` for `characters-search.png` or
  `switch-failed.png`. Re-run with `--manual` and switch yourself.
- **"Could not detect" character name** — the active-character header
  detector is heuristic. The script logs this as a warning but still
  takes `after-switch.png` so you can confirm visually.

## Step 4 — Convert FBX → GLB

The Blender pipeline lives at the repo root because it also handles the
v03/v04 character models. Add new entries to the `conversions` list:

```python
# convert_fbx_to_glb.py
conversions = [
    ...
    ("models/animations/shrug.fbx",    "models/animations/shrug.glb"),
    ...
]
```

Then run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --python convert_fbx_to_glb.py
```

The script **skips outputs that already exist** — re-running it on an
already-converted GLB has been observed to produce subtly distorted
output, so don't bypass that guard. To re-convert, delete the GLB first.

### Why `bake_space_transform=True` matters

The Blender import uses `bake_space_transform=True` and then runs
`object.transform_apply` on the Armature. Together these flatten the
Mixamo-supplied cm→m and Z-up→Y-up conversions into bone data, so the
exported GLB has:

- An identity scene-root transform (`RootNode`/`Armature` with R=identity, S=1)
- Bone rest poses in Y-up metres (hip ≈ `[0, 1.0, 0]`)

Without that, post-April-2026 Mixamo exports come out with a +90°X
rotation and 0.01 scale on the Armature, plus a -90°X rotation on the
Hips bone. The retargeter in `src/boneMapping.js` works on bone-local
quaternions and can't see the scene-root transform, so the model would
end up with arms behind its back.

## Step 5 — Register the gesture

Two registries need updating:

### Frontend — `src/animations.js`

```js
export const ANIMATIONS = [
  ...
  { name: 'shrug', url: '/animations/shrug.glb' },
];

export const ANIMATION_LABELS = {
  ...
  shrug: 'Shrug',
};
```

### Backend — `backend/prompts.py`

```python
GESTURES = (
    ...
    "shrug",
)

GESTURE_HINTS = {
    ...
    "shrug": "uncertainty, 'I don't know', non-committal",
}
```

The LLM uses `GESTURES` as the closed list of allowed `[gesture:NAME]`
tags and `GESTURE_HINTS` as semantic guidance for when to emit each.

## Important: Skeleton compatibility

Mixamo bakes the **currently-selected character's rig conventions** into
every animation it exports. To produce drop-in compatible animations
that the existing retargeter (`src/boneMapping.js`) can apply to all
models (v03 Jake CC_Base, v04 Frank CC_Base, v05 Pete `mixamorig9`,
v06 Brunette bare-name RPM), the FBX must have:

- **Bone names**: `mixamorig:Hips`, `mixamorig:Spine`, … (canonical
  prefix, no digit suffix)
- **Rest pose**: T-pose, identity local rotation on hip
- **Coordinates**: Y-up, metres

This is what you get when you download against Mixamo's **default Y Bot**
character (which the script auto-selects). Avoid:

- Downloading against an **uploaded character** like v05 Pete (you get
  `mixamorig9:` prefix + a stripped-down rig + the character's rest pose
  — animations will silently distort the model when retargeted)
- Downloading against the legacy **X Bot** or other stock characters
  with non-standard bone counts

Even with the right character selected, Mixamo's exporter as of
mid-2026 emits the cm→m and Z-up→Y-up conversions on the Armature node
rather than baking them into bone data. The Blender conversion step
(see Step 4) handles that.

See `docs/models-transform.md` → "Skeleton Flavours" and "Animation
Retargeting" for the deeper context.

## Files in this skill

- `download_mixamo.mjs` — Playwright downloader with auto Y-bot switch
- `SKILL.md` — this document

## Related files (outside the skill)

- `convert_fbx_to_glb.py` — Blender FBX→GLB pipeline (root). Uses
  `bake_space_transform=True` + `transform_apply` to normalize Mixamo's
  scene-root conventions.
- `src/animations.js` — frontend gesture registry
- `backend/prompts.py` — LLM gesture vocabulary
- `src/boneMapping.js` — animation retargeting onto each model's skeleton
- `docs/models-transform.md` — skeleton/rest-pose reference
- `screenshots/mixamo-debug/` — auto-saved screenshots from the downloader
  (after-switch verification, error states)

