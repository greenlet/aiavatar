# Copilot instructions — AI Avatar

Browser-based 3D talking avatar. React + Three.js frontend, FastAPI backend
mediating Azure OpenAI (chat) and Azure Speech (TTS visemes + STT).

## Tech stack

- **Frontend**: Vite + React 19 + `@react-three/fiber` / `@react-three/drei`
  + `three` 0.183. Speech via `microsoft-cognitiveservices-speech-sdk`
  (browser → Azure Speech endpoint directly using a short-lived token
  minted by the backend).
- **Backend**: Python 3.12 + FastAPI + uvicorn. Only mints Speech auth
  tokens and proxies chat completions; never streams audio itself.
- **3D assets**: GLB models in `models/v0{3,4,5,6}/`, GLB animations in
  `models/animations/`. FBX sources kept for reference.

## Run / dev

| What        | Command                                                     |
|-------------|-------------------------------------------------------------|
| Backend     | `conda activate aiav_py312 && uvicorn backend.main:app --reload --port 8000` |
| Frontend    | `npm run dev` (Vite on `:3000`, proxies `/api` → `:8000`)  |
| Build       | `npm run build`                                             |

There are **no linters, no formatters, no test suite**. Do not introduce
them unless the user explicitly asks. Verify changes by running the dev
server and exercising the affected feature.

## Repo layout cheat sheet

```
backend/
  main.py        — FastAPI app, /api/chat, /api/speech-token
  prompts.py     — system prompt + gesture vocabulary the LLM may emit
  config.py      — env loader (Azure OpenAI / Speech credentials)
src/
  App.jsx, ModelViewer.jsx, ChatPanel.jsx, AnimationPanel.jsx, BlendShapePanel.jsx
  animations.js  — frontend gesture registry (must mirror backend GESTURES)
  boneMapping.js — Mixamo → model retargeting (CC_Base, mixamorig, mixamorig9, bare)
  avatar/
    gestureParser.js          — strip [gesture:NAME] tags from LLM text
    ttsScheduler.js           — align gesture triggers to TTS word boundaries
    useGestureController.js   — drives clip playback on the avatar
    useExpressionController.js / expressions.js — facial expressions
    visemeMap.js              — Oculus viseme → blendshape map for v06
  useTtsLipSync.js, useLipSync.js, useSpeechRecognition.js
models/
  v03/ Jake (CC_Base) — Sketchfab, no blendshapes
  v04/ Frank (CC_Base) — Sketchfab, 15 shapes
  v05/ Pete (Mixamo, mixamorig9 prefix) — no blendshapes
  v06/ Brunette (RPM, bare Mixamo names) — 72 blendshapes incl. 15 Oculus visemes ★ default
  animations/         — GLBs (and original FBXs) for gestures
docs/
  models-transform.md — skeleton flavours, rest poses, retargeting math
  lipsync.md          — viseme pipeline
skills/
  mixamo/             — Mixamo download + workflow doc (see SKILL.md)
convert_fbx_to_glb.py — Blender FBX→GLB for v03/v04/animations (skips existing outputs)
convert_fbx_to_glb.mjs — Three.js FBX→GLB for v05 (strips textures)
download_mixamo.mjs   — see skills/mixamo/
```

## Key conventions

### Gesture pipeline

The LLM annotates replies with `[gesture:NAME]` tags pulled from the
closed list in `backend/prompts.py` (`GESTURES`). The frontend parser
in `src/avatar/gestureParser.js` strips them; `ttsScheduler.js` aligns
triggers to TTS word boundaries; `useGestureController.js` plays the
matching clip from `src/animations.js`.

**When adding a gesture you must update both registries**:
- `backend/prompts.py` → `GESTURES` tuple + `GESTURE_HINTS` dict
- `src/animations.js` → `ANIMATIONS` array + `ANIMATION_LABELS` dict

The GLB itself goes in `models/animations/`. See `skills/mixamo/SKILL.md`
for the full Mixamo download → convert → register workflow.

### Animation retargeting (`src/boneMapping.js`)

Different models have different skeletons. The retargeter handles four
flavours:

1. **CC_Base** (v03 Jake, v04 Frank) — `CC_Base_Hip_02`, `_0XX` numeric
   suffixes, Z-up FBX with -90°/+90° X parent chain. Mapped via
   `MIXAMO_TO_CC_BASE`. Known to produce artifacts; CC_Base models
   really need to be re-rigged through Mixamo.
2. **Mixamo** (canonical) — `mixamorigHips` etc. The convention all
   downloaded animations should use.
3. **Mixamo with prefix variant** (v05 Pete) — `mixamorig9Hips`. Mapped
   to canonical names via `MIXAMO_SUFFIXES`.
4. **Bare Mixamo names** (v06 Brunette / RPM) — `Hips`, `LeftArm` (no
   prefix). Detected and mapped in `buildBoneMap`.

`retargetClip` implements world-space delta retargeting (formula in
`docs/models-transform.md`) so different rest poses are accommodated.

**Important**: Mixamo animations must be downloaded against the **default
Y-bot character** (no uploaded character selected), otherwise they
inherit a non-canonical bone prefix AND a rotated rest pose, which
distorts every model. See `skills/mixamo/SKILL.md` → "Skeleton
compatibility".

### Lipsync

v06 is the only model with full visemes. The pipeline uses Azure Speech
TTS's `visemeReceived` event (Oculus visemes) and applies them via
`src/avatar/visemeMap.js` + `useTtsLipSync.js`. There's a fallback
mic→viseme path (`useLipSync.js` + `@met4citizen/headaudio`) for demos
without Azure. See `docs/lipsync.md`.

### FBX → GLB conversion

`convert_fbx_to_glb.py` (Blender) is the canonical converter for animations
and the v03/v04 character GLBs. It **skips outputs that already exist** —
re-running on an already-converted GLB produces subtly distorted output.
To force re-conversion, delete the GLB first.

## When making changes

- Run the dev server (`npm run dev` + `uvicorn`) and verify the avatar
  still loads, plays animations, and lip-syncs.
- Don't touch `models/v05/model.glb` or `convert_fbx_to_glb.py`'s skip
  guard without understanding the rest-pose retargeting issue documented
  in `docs/models-transform.md`.
- If you add a Mixamo animation, follow `skills/mixamo/SKILL.md` end to
  end; partial changes (FBX without GLB, or GLB without registry entries)
  silently break the gesture.
- The frontend `ANIMATIONS` list must be kept in sync with backend
  `GESTURES` — any drift means the LLM emits gestures the UI can't play
  (or the UI shows gestures the LLM never emits).
- The repo intentionally has no test/lint tooling. Don't add it
  speculatively; ask first.

## Skills

Reusable, scoped workflows live under `skills/<name>/SKILL.md`. Read the
relevant SKILL.md before doing work in that area.

- `skills/mixamo/` — download Mixamo animations, convert, and register
  them as avatar gestures.
