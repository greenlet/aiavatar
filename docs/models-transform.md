# Model Loading, Transforms & Animation Reference

## Models Overview

| Model | Source | Skeleton | Bone Prefix | Rest Pose | Native Units | Scale | Blendshapes |
|-------|--------|----------|-------------|-----------|-------------|-------|-------------|
| v03 Jake | Sketchfab (CC_Base) | CC_Base bones | `CC_Base_` + Sketchfab `_0XX` suffix | Z-up FBX, -90°/+90° X parent chain | ~1.68m (metres after Sketchfab 0.01 scale) | 1 | 0 |
| v04 Frank | Sketchfab (CC_Base) | CC_Base bones | `CC_Base_` + Sketchfab `_0XX` suffix | Z-up FBX, -90°/+90° X parent chain | ~0.11 (very small) | 15 | 0 |
| v05 Pete | Mixamo (Ch31_nonPBR) | Mixamo variant | `mixamorig9:` (colon stripped → `mixamorig9`) | T-pose, Y-up, cm units (178cm tall) | cm | 0.01 | 0 (Faceit attempted, not working) |
| v06 Brunette | Ready Player Me (TalkingHead) | Bare Mixamo | No prefix (`Hips`, `LeftArm`) | A-pose (~45° arms), Y-up, metres | 1.77m | 1 | 72 (52 ARKit + 15 Oculus visemes + extras) |

## Skeleton Flavours

### 1. CC_Base (v03, v04)
- From Character Creator, exported via Sketchfab
- Bone hierarchy: `_rootJoint` → `CC_Base_BoneRoot` (-90°X) → `CC_Base_Hip` (+90°X) → body
- The -90°X/+90°X pair converts from FBX Z-up to Y-up internally
- Sketchfab adds `_0XX` numeric suffixes: `CC_Base_Hip_02`, `CC_Base_L_Forearm_051`
- Also has a `0.01` scale node in the Sketchfab wrapper
- **NOT directly compatible with Mixamo animations** — bone naming, hierarchy,
  and coordinate systems are too different for reliable browser-based retargeting
- Must be re-rigged through Mixamo (upload to mixamo.com for auto-rigging) to work with Mixamo animations
- Bone name mapping to Mixamo via `MIXAMO_TO_CC_BASE` table exists in `boneMapping.js` but produces artifacts

### 2. Mixamo with variant prefix (v05)
- Standard Mixamo rig but with `mixamorig9` prefix instead of `mixamorig`
- FBX import adds `0.01` scale and `90°X` rotation (handled by external scale group)
- Colons stripped by Three.js: `mixamorig9:Hips` → `mixamorig9Hips`
- Mapped to canonical `mixamorigHips` in `buildBoneMap()` via `MIXAMO_SUFFIXES`

### 3. Bare Mixamo names (v06 — Ready Player Me)
- Same bone hierarchy as Mixamo but without any prefix
- `Hips`, `Spine`, `LeftArm`, `RightArm`, etc.
- A-pose (arms at ~45°) vs Mixamo T-pose (arms at ~0°)
- Already in metres, Y-up, no extra transforms
- Mapped to canonical `mixamorigHips` etc. via bare-name detection in `buildBoneMap()`

## Animation Retargeting

### Source animations
- All animations are Mixamo FBX files converted to GLB via Blender (convert_fbx_to_glb.py)
- Bone names: `mixamorigHips`, `mixamorigLeftArm`, etc.
- All clips named `"mixamo.com"` — renamed to URL in AnimationLoader for uniqueness
- T-pose rest, Y-up, metres

### Retargeting approach: World-Space Delta
The retargeting in `boneMapping.js` → `retargetClip()` uses world-space delta:

```
For each quaternion keyframe:
1. Q_src_world = Q_src_parent_world * Q_anim_local
2. Q_delta = Q_src_world_rest⁻¹ * Q_src_world     (rotation delta in world space)
3. Q_tgt_world = Q_tgt_world_rest * Q_delta         (apply delta to target rest)
4. Q_result = Q_tgt_parent_world⁻¹ * Q_tgt_world   (convert to target local space)
```

This handles:
- Different rest poses (T-pose vs A-pose)
- Different parent bone orientations (-90°X BoneRoot in CC_Base)
- Different bone naming conventions (resolved before retargeting)

### Hip position track
- **Always dropped** during retargeting
- Animation hip positions are in the source skeleton's units/space
- The external scale group on the model already positions it correctly
- Prevents models from sinking to wrong Y position during animation

## Bone Name Resolution

`buildBoneMap()` builds a lookup from animation bone names to actual scene bone names:

1. **Sketchfab suffix stripping**: `CC_Base_Hip_02` → base key `CC_Base_Hip`
2. **Exact name match**: stored as-is
3. **Mixamo variant prefix**: `mixamorig9Hips` → also stored as `mixamorigHips`
4. **Bare Mixamo names**: `Hips` → also stored as `mixamorigHips`
5. **CC_Base mapping**: `mixamorigHips` → `CC_Base_Hip` via `MIXAMO_TO_CC_BASE` table

## Blendshapes

### Categories in UI (BlendShapePanel.jsx)
Supports both CC_Base format (`Brow_`, `Eye_`) and ARKit format (`browDownLeft`, `eyeBlinkLeft`):
- Brow, Eye, Cheek, Nose, Jaw, Mouth, Tongue, Viseme, Other

### v06 ARKit blendshapes (72 total)
- 52 ARKit: `eyeBlinkLeft`, `browDownRight`, `jawOpen`, `mouthSmileLeft`, etc.
- 15 Oculus visemes: `viseme_aa`, `viseme_CH`, `viseme_PP`, etc.
- 5 extras: `mouthSmile`, `mouthOpen`, `eyesClosed`, `eyesLookUp`, `eyesLookDown`

### v03/v04 CC_Base blendshapes
- Currently 0 — would need Faceit addon in Blender (interactive, not automatable)

## Scale Normalization

All models are scaled to approximately 1.78m height via per-model scale factors in `App.jsx`:
- v03: scale=1 (already ~1.68m)
- v04: scale=15 (0.11 × 15 = ~1.65m)
- v05: scale=0.01 (178cm × 0.01 = 1.78m)
- v06: scale=1 (already 1.77m)

Applied as a wrapping `<group scale={scaleToReference}>` in ModelViewer.jsx.

## File Structure

```
models/
  v03/model.glb          - Jake (CC_Base, Sketchfab)
  v04/model.glb          - Frank (CC_Base, Sketchfab)
  v05/model.glb          - Pete (Mixamo Ch31_nonPBR)
  v05/Ch31_nonPBR.fbx    - Pete source FBX
  v06/model.glb          - Brunette (Ready Player Me, TalkingHead)
  animations/
    greeting.glb          - Mixamo animation
    standing_idle.glb     - Mixamo animation
    talking_funny.glb     - Mixamo animation
    talking_seated.glb    - Mixamo animation
    thinking.glb          - Mixamo animation
    waving.glb            - Mixamo animation
```

## Conversion Tools

- `convert_fbx_to_glb.py` — Blender-based FBX→GLB for v03, v04, animations
- `convert_fbx_to_glb.mjs` — Node.js Three.js-based FBX→GLB for v05 (strips textures)
