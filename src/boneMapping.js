import { Quaternion } from 'three';

/**
 * Maps Mixamo bone names to Character Creator (CC_Base) bone names.
 * Three.js strips colons, so mixamorig:Hips -> mixamorigHips.
 * Sketchfab GLBs append numeric suffixes: CC_Base_Hip_02, CC_Base_L_Forearm_051.
 * We resolve dynamically against the actual scene bones.
 */

const MIXAMO_TO_CC_BASE = {
  'mixamorigHips': 'CC_Base_Hip',
  'mixamorigSpine': 'CC_Base_Waist',
  'mixamorigSpine1': 'CC_Base_Spine01',
  'mixamorigSpine2': 'CC_Base_Spine02',
  'mixamorigNeck': 'CC_Base_NeckTwist01',
  'mixamorigHead': 'CC_Base_Head',

  'mixamorigLeftShoulder': 'CC_Base_L_Clavicle',
  'mixamorigLeftArm': 'CC_Base_L_Upperarm',
  'mixamorigLeftForeArm': 'CC_Base_L_Forearm',
  'mixamorigLeftHand': 'CC_Base_L_Hand',

  'mixamorigRightShoulder': 'CC_Base_R_Clavicle',
  'mixamorigRightArm': 'CC_Base_R_Upperarm',
  'mixamorigRightForeArm': 'CC_Base_R_Forearm',
  'mixamorigRightHand': 'CC_Base_R_Hand',

  'mixamorigLeftUpLeg': 'CC_Base_L_Thigh',
  'mixamorigLeftLeg': 'CC_Base_L_Calf',
  'mixamorigLeftFoot': 'CC_Base_L_Foot',
  'mixamorigLeftToeBase': 'CC_Base_L_ToeBase',

  'mixamorigRightUpLeg': 'CC_Base_R_Thigh',
  'mixamorigRightLeg': 'CC_Base_R_Calf',
  'mixamorigRightFoot': 'CC_Base_R_Foot',
  'mixamorigRightToeBase': 'CC_Base_R_ToeBase',

  'mixamorigLeftHandThumb1': 'CC_Base_L_Thumb1',
  'mixamorigLeftHandThumb2': 'CC_Base_L_Thumb2',
  'mixamorigLeftHandThumb3': 'CC_Base_L_Thumb3',
  'mixamorigLeftHandIndex1': 'CC_Base_L_Index1',
  'mixamorigLeftHandIndex2': 'CC_Base_L_Index2',
  'mixamorigLeftHandIndex3': 'CC_Base_L_Index3',
  'mixamorigLeftHandMiddle1': 'CC_Base_L_Mid1',
  'mixamorigLeftHandMiddle2': 'CC_Base_L_Mid2',
  'mixamorigLeftHandMiddle3': 'CC_Base_L_Mid3',
  'mixamorigLeftHandRing1': 'CC_Base_L_Ring1',
  'mixamorigLeftHandRing2': 'CC_Base_L_Ring2',
  'mixamorigLeftHandRing3': 'CC_Base_L_Ring3',
  'mixamorigLeftHandPinky1': 'CC_Base_L_Pinky1',
  'mixamorigLeftHandPinky2': 'CC_Base_L_Pinky2',
  'mixamorigLeftHandPinky3': 'CC_Base_L_Pinky3',

  'mixamorigRightHandThumb1': 'CC_Base_R_Thumb1',
  'mixamorigRightHandThumb2': 'CC_Base_R_Thumb2',
  'mixamorigRightHandThumb3': 'CC_Base_R_Thumb3',
  'mixamorigRightHandIndex1': 'CC_Base_R_Index1',
  'mixamorigRightHandIndex2': 'CC_Base_R_Index2',
  'mixamorigRightHandIndex3': 'CC_Base_R_Index3',
  'mixamorigRightHandMiddle1': 'CC_Base_R_Mid1',
  'mixamorigRightHandMiddle2': 'CC_Base_R_Mid2',
  'mixamorigRightHandMiddle3': 'CC_Base_R_Mid3',
  'mixamorigRightHandRing1': 'CC_Base_R_Ring1',
  'mixamorigRightHandRing2': 'CC_Base_R_Ring2',
  'mixamorigRightHandRing3': 'CC_Base_R_Ring3',
  'mixamorigRightHandPinky1': 'CC_Base_R_Pinky1',
  'mixamorigRightHandPinky2': 'CC_Base_R_Pinky2',
  'mixamorigRightHandPinky3': 'CC_Base_R_Pinky3',
};

// Canonical Mixamo bone suffixes (after the "mixamorig" prefix).
// Used to build direct mappings when a model has a variant prefix
// like "mixamorig9" instead of "mixamorig".
const MIXAMO_SUFFIXES = Object.keys(MIXAMO_TO_CC_BASE).map(k => k.replace('mixamorig', ''));

/**
 * Build a lookup from bone base-name to actual scene bone name.
 * Handles three skeleton flavours:
 *  1. CC_Base bones with Sketchfab _0XX suffixes (v03, v04)
 *  2. Standard Mixamo bones (mixamorigHips)
 *  3. Variant Mixamo bones (mixamorig9Hips, etc.)
 * For case 3, adds canonical-name→actual-name mappings so that
 * animation tracks authored with "mixamorig" still resolve.
 *
 * Also flags whether the model is Mixamo-native so retargetClip
 * can skip the hip position drop.
 */
export function buildBoneMap(scene) {
  const baseToActual = {};
  const targetRestPoses = {};
  const targetWorldPoses = {};
  const targetParentWorldPoses = {};

  scene.updateWorldMatrix(true, true);

  // Detect Mixamo prefix variant (e.g. "mixamorig9" vs "mixamorig")
  let mixamoPrefix = null;
  scene.traverse((child) => {
    if (!child.isBone || mixamoPrefix) return;
    const m = child.name.match(/^(mixamorig\d*)Hips$/);
    if (m) mixamoPrefix = m[1];
  });

  scene.traverse((child) => {
    if (!child.isBone) return;
    child.updateWorldMatrix(true, false);
    const name = child.name;

    const wq = new Quaternion();
    child.getWorldQuaternion(wq);
    const pwq = new Quaternion();
    if (child.parent) child.parent.getWorldQuaternion(pwq);

    // Strip trailing _0XX suffix added by Sketchfab
    const match = name.match(/^(.+?)_0(\d*)$/);
    if (match) {
      const base = match[1];
      if (!baseToActual[base]) {
        baseToActual[base] = name;
        targetRestPoses[base] = child.quaternion.clone();
        targetWorldPoses[base] = wq.clone();
        targetParentWorldPoses[base] = pwq.clone();
      }
    }
    // Exact match (for bone names without suffix)
    if (!baseToActual[name]) {
      baseToActual[name] = name;
      if (!targetRestPoses[name]) {
        targetRestPoses[name] = child.quaternion.clone();
        targetWorldPoses[name] = wq.clone();
        targetParentWorldPoses[name] = pwq.clone();
      }
    }
  });

  // If the model uses a non-standard Mixamo prefix (e.g. "mixamorig9"),
  // add canonical "mixamorig*" → actual bone mappings so animation
  // tracks resolve without additional rename tables.
  const isMixamoModel = !!mixamoPrefix;
  if (mixamoPrefix && mixamoPrefix !== 'mixamorig') {
    for (const suffix of MIXAMO_SUFFIXES) {
      const canonical = 'mixamorig' + suffix;   // e.g. mixamorigHips
      const variant = mixamoPrefix + suffix;     // e.g. mixamorig9Hips
      if (baseToActual[variant] && !baseToActual[canonical]) {
        baseToActual[canonical] = baseToActual[variant];
        targetRestPoses[canonical] = targetRestPoses[variant];
        targetWorldPoses[canonical] = targetWorldPoses[variant];
        targetParentWorldPoses[canonical] = targetParentWorldPoses[variant];
      }
    }
  }

  // If the model uses bare Mixamo bone names without any prefix
  // (e.g. "Hips" instead of "mixamorigHips"), add canonical mappings.
  // These models (e.g. Ready Player Me) are designed to play Mixamo
  // animations directly with name remapping only — no quaternion
  // retargeting needed.
  const isBareNameMixamo = !mixamoPrefix && !!baseToActual['Hips'] && !baseToActual['mixamorigHips'];
  if (isBareNameMixamo) {
    for (const suffix of MIXAMO_SUFFIXES) {
      const canonical = 'mixamorig' + suffix;   // e.g. mixamorigHips
      const bare = suffix;                       // e.g. Hips
      if (baseToActual[bare] && !baseToActual[canonical]) {
        baseToActual[canonical] = baseToActual[bare];
        targetRestPoses[canonical] = targetRestPoses[bare];
        targetWorldPoses[canonical] = targetWorldPoses[bare];
        targetParentWorldPoses[canonical] = targetParentWorldPoses[bare];
      }
    }
  }

  return { boneMap: baseToActual, targetRestPoses, targetWorldPoses, targetParentWorldPoses, isMixamoModel, isBareNameMixamo };
}

/**
 * Extract rest-pose local and world quaternions for every bone in a Mixamo animation scene.
 */
export function buildSourceRestPoses(scene) {
  const poses = {};
  const worldPoses = {};
  scene.updateWorldMatrix(true, true);
  scene.traverse((child) => {
    if (child.isBone) {
      child.updateWorldMatrix(true, false);
      poses[child.name] = child.quaternion.clone();
      const wq = new Quaternion();
      child.getWorldQuaternion(wq);
      worldPoses[child.name] = wq;
    }
  });
  return { poses, worldPoses };
}

/**
 * Retarget a Three.js AnimationClip from Mixamo bones to actual scene bones.
 *
 * Uses world-space delta retargeting: extracts rotation delta in world space,
 * then re-expresses it in the target skeleton's local space.
 * This handles different rest poses and parent orientations
 * (e.g. A-pose RPM vs T-pose Mixamo).
 *
 * CC_Base models (v03/v04) are not directly compatible with Mixamo animations.
 * They need to be re-rigged through Mixamo first.
 */
export function retargetClip(clip, boneMap, targetRestPoses, sourceRestPoses,
  isMixamoModel, isBareNameMixamo, targetWorldPoses, targetParentWorldPoses,
  sourceWorldPoses) {
  const retargeted = clip.clone();
  const tracksToKeep = [];

  for (const track of retargeted.tracks) {
    const dotIdx = track.name.indexOf('.');
    if (dotIdx === -1) {
      tracksToKeep.push(track);
      continue;
    }
    const mixamoBone = track.name.substring(0, dotIdx);
    const property = track.name.substring(dotIdx);

    // --- Resolve target bone name ---
    let actualBone = null;
    let restKey = null;
    let isHip = false;
    let dropPosition = false;

    // Path A: direct Mixamo lookup
    if (boneMap[mixamoBone]) {
      actualBone = boneMap[mixamoBone];
      restKey = mixamoBone;
      isHip = /Hips$/.test(mixamoBone);
      dropPosition = isHip;
    }

    // Path B: Mixamo → CC_Base mapping
    if (!actualBone) {
      const ccBase = MIXAMO_TO_CC_BASE[mixamoBone];
      if (ccBase) {
        actualBone = boneMap[ccBase];
        restKey = ccBase;
        isHip = ccBase === 'CC_Base_Hip';
        dropPosition = isHip;
      }
    }

    if (!actualBone) {
      tracksToKeep.push(track);
      continue;
    }

    track.name = actualBone + property;

    // Drop hip position track
    if (dropPosition && property === '.position') {
      continue;
    }

    // Apply quaternion retargeting using world-space delta approach.
    // For each keyframe:
    //   1. Compute world rotation from animation: Q_src_world = Q_src_parent_world * Q_anim
    //   2. Compute world delta from rest: Q_delta = Q_src_world_rest^-1 * Q_src_world
    //   3. Apply delta in target world: Q_tgt_world = Q_tgt_world_rest * Q_delta
    //   4. Convert back to local: Q_result = Q_tgt_parent_world^-1 * Q_tgt_world
    if (property === '.quaternion' && sourceWorldPoses && targetWorldPoses && targetParentWorldPoses) {
      const srcWorldRest = sourceWorldPoses[mixamoBone];
      const tgtWorldRest = targetWorldPoses[restKey];
      const tgtParentWorld = targetParentWorldPoses[restKey];

      if (srcWorldRest && tgtWorldRest && tgtParentWorld) {
        const srcWorldRestInv = srcWorldRest.clone().invert();
        const tgtParentWorldInv = tgtParentWorld.clone().invert();

        // Source parent world = srcWorldRest * srcLocalRest^-1
        const srcLocalRest = sourceRestPoses[mixamoBone];
        const srcLocalRestInv = srcLocalRest ? srcLocalRest.clone().invert() : new Quaternion();
        const srcParentWorld = srcWorldRest.clone().multiply(srcLocalRestInv);

        const values = track.values;
        const q = new Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
          // Q_src_world = Q_src_parent_world * Q_anim_local
          const srcWorld = srcParentWorld.clone().multiply(q);
          // Q_world_delta = Q_src_world_rest^-1 * Q_src_world
          const worldDelta = srcWorldRestInv.clone().multiply(srcWorld);
          // Q_tgt_world = Q_tgt_world_rest * Q_world_delta
          const tgtWorld = tgtWorldRest.clone().multiply(worldDelta);
          // Q_result_local = Q_tgt_parent_world^-1 * Q_tgt_world
          q.copy(tgtParentWorldInv).multiply(tgtWorld);

          values[i] = q.x;
          values[i + 1] = q.y;
          values[i + 2] = q.z;
          values[i + 3] = q.w;
        }
      }
    }

    tracksToKeep.push(track);
  }

  retargeted.tracks = tracksToKeep;
  return retargeted;
}
