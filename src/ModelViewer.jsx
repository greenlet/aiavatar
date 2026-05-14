import React, { useRef, useEffect, useMemo, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetClip, buildBoneMap, buildSourceRestPoses } from './boneMapping';

function AnimationLoader({ url, boneMap, targetRestPoses, isMixamoModel, onLoaded }) {
  const { scene, animations } = useGLTF(url);
  const sourceRestPoses = useMemo(() => buildSourceRestPoses(scene), [scene]);
  useEffect(() => {
    if (animations?.length && boneMap) {
      const clips = animations.map((clip) => {
        const retargeted = retargetClip(clip, boneMap, targetRestPoses, sourceRestPoses, isMixamoModel);
        // Mixamo exports all clips as "mixamo.com" — give each a unique
        // name so useAnimations doesn't serve a stale cached action.
        retargeted.name = url;
        return retargeted;
      });
      onLoaded(clips);
    }
    return () => onLoaded([]);
  }, [animations, url, boneMap, targetRestPoses, sourceRestPoses, isMixamoModel]);
  return null;
}

function ModelScene({
  modelUrl,
  modelScale,
  animationUrl,
  animationLoopOnce = false,
  onAnimationFinished,
  blendShapes,
  onShapesDetected,
  onAnimationsDetected,
  playingBuiltIn,
  showSkeleton,
  gazeAtCamera = false,
}) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelUrl);
  const [externalClips, setExternalClips] = useState([]);
  const headBoneRef = useRef(null);
  const headRestQuatRef = useRef(null);

  // Clone scene so each model gets its own instance
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  // Per-model scale to normalize to metres
  const scaleToReference = modelScale || 1;

  // Build bone map from cloned scene for animation retargeting
  const { boneMap, targetRestPoses, targetWorldPoses, targetParentWorldPoses, isMixamoModel, isBareNameMixamo } = useMemo(() => buildBoneMap(clonedScene), [clonedScene]);

  // Clear external clips when no animation selected
  useEffect(() => {
    if (!animationUrl) setExternalClips([]);
  }, [animationUrl]);

  const allClips = useMemo(() => {
    return [...(animations || []), ...externalClips];
  }, [animations, externalClips]);

  const { actions, mixer } = useAnimations(allClips, group);

  // Forward AnimationMixer "finished" events to caller so it can swap to idle.
  useEffect(() => {
    if (!mixer || !onAnimationFinished) return;
    const cb = (e) => onAnimationFinished(e.action?.getClip()?.name);
    mixer.addEventListener('finished', cb);
    return () => mixer.removeEventListener('finished', cb);
  }, [mixer, onAnimationFinished]);

  // Report built-in animation names
  useEffect(() => {
    if (animations?.length) {
      onAnimationsDetected(animations.map((a) => a.name));
    } else {
      onAnimationsDetected([]);
    }
  }, [animations]);

  // Detect blendshape morph targets
  useEffect(() => {
    const shapes = new Set();
    clonedScene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary) {
        Object.keys(child.morphTargetDictionary).forEach((name) => shapes.add(name));
      }
    });
    onShapesDetected([...shapes].sort());
  }, [clonedScene]);

  // Locate the head bone for gaze tracking. Matches Mixamo, RPM (bare), and
  // CC_Base naming. Stash the rest-pose local quaternion so we can blend
  // gaze against neutral instead of stomping animation completely.
  useEffect(() => {
    let head = null;
    clonedScene.traverse((child) => {
      if (head || !child.isBone) return;
      const n = child.name;
      if (n === 'Head' || /(^|[^a-zA-Z])Head($|_|[0-9])/.test(n)) {
        head = child;
      }
    });
    headBoneRef.current = head;
    headRestQuatRef.current = head ? head.quaternion.clone() : null;
  }, [clonedScene]);

  // Play/stop animations
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.stop());

    const configure = (action) => {
      if (!action) return null;
      if (animationLoopOnce) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      return action;
    };

    if (playingBuiltIn) {
      const action = configure(actions[playingBuiltIn]);
      if (action) action.reset().fadeIn(0.3).play();
    } else if (externalClips.length > 0) {
      const clipName = externalClips[0].name;
      const action = configure(actions[clipName]);
      if (action) action.reset().fadeIn(0.3).play();
    }
  }, [playingBuiltIn, actions, externalClips, animationLoopOnce]);

  // Apply blendshape values + (optional) gaze tracking. We run this after
  // the AnimationMixer's useFrame so our head-rotation override wins for
  // the current frame.
  const _gazeTmp = useMemo(() => ({
    headPosW:    new THREE.Vector3(),
    desiredDirW: new THREE.Vector3(),
    forwardW:    new THREE.Vector3(0, 0, 1),
    deltaW:      new THREE.Quaternion(),
    parentQ:     new THREE.Quaternion(),
    parentQInv:  new THREE.Quaternion(),
    deltaLocal:  new THREE.Quaternion(),
    targetLocal: new THREE.Quaternion(),
    euler:       new THREE.Euler(0, 0, 0, 'YXZ'),
    clampedQ:    new THREE.Quaternion(),
    restEuler:   new THREE.Euler(0, 0, 0, 'YXZ'),
  }), []);

  useFrame(({ camera }) => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        for (const [name, value] of Object.entries(blendShapes)) {
          const idx = child.morphTargetDictionary[name];
          if (idx !== undefined) {
            child.morphTargetInfluences[idx] = value;
          }
        }
      }
    });

    const head = headBoneRef.current;
    const rest = headRestQuatRef.current;
    if (gazeAtCamera && head && head.parent && rest) {
      const t = _gazeTmp;
      head.parent.updateMatrixWorld();
      head.updateMatrixWorld();

      // World-space: where is the head, where do we want it to look?
      t.headPosW.setFromMatrixPosition(head.matrixWorld);
      t.desiredDirW.copy(camera.position).sub(t.headPosW);
      if (t.desiredDirW.lengthSq() < 1e-6) return;
      t.desiredDirW.normalize();

      // Rotation in world space that takes the model's natural forward
      // (+Z, both Mixamo & RPM face +Z in this scene) onto desiredDir.
      t.deltaW.setFromUnitVectors(t.forwardW, t.desiredDirW);

      // Bring that delta into the head bone's parent (Neck) local frame:
      //   delta_local = parent^-1 * delta_world * parent
      t.parentQ.setFromRotationMatrix(head.parent.matrixWorld);
      t.parentQInv.copy(t.parentQ).invert();
      t.deltaLocal.copy(t.parentQInv).multiply(t.deltaW).multiply(t.parentQ);

      // Apply on top of the rest pose, then clamp to natural neck range.
      t.targetLocal.copy(rest).multiply(t.deltaLocal);
      t.restEuler.setFromQuaternion(rest, 'YXZ');
      t.euler.setFromQuaternion(t.targetLocal, 'YXZ');
      t.euler.y = THREE.MathUtils.clamp(t.euler.y - t.restEuler.y, -0.6,  0.6)  + t.restEuler.y;
      t.euler.x = THREE.MathUtils.clamp(t.euler.x - t.restEuler.x, -0.35, 0.35) + t.restEuler.x;
      t.euler.z = t.restEuler.z;
      t.clampedQ.setFromEuler(t.euler);

      // Smooth: blend from current (animation-driven) head pose toward target.
      head.quaternion.slerp(t.clampedQ, 0.18);
    }
  });

  // Skeleton helper for rig visualization
  const skeletonHelper = useMemo(() => {
    const helper = new THREE.SkeletonHelper(clonedScene);
    helper.visible = false;
    return helper;
  }, [clonedScene]);

  useEffect(() => {
    skeletonHelper.visible = showSkeleton;
  }, [showSkeleton, skeletonHelper]);

  return (
    <>
      <group scale={scaleToReference}>
        <primitive ref={group} object={clonedScene} />
        <primitive object={skeletonHelper} />
      </group>
      {animationUrl && (
        <Suspense fallback={null}>
          <AnimationLoader url={animationUrl} boneMap={boneMap} targetRestPoses={targetRestPoses} isMixamoModel={isMixamoModel} onLoaded={setExternalClips} />
        </Suspense>
      )}
    </>
  );
}

export default function ModelViewer(props) {
  // Key forces full unmount/remount when model changes
  return <ModelScene key={props.modelUrl} {...props} />;
}
