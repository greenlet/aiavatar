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
  animationUrl,
  blendShapes,
  onShapesDetected,
  onAnimationsDetected,
  playingBuiltIn,
  showSkeleton,
}) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelUrl);
  const [externalClips, setExternalClips] = useState([]);

  // Clone scene so each model gets its own instance
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  // Build bone map from cloned scene for animation retargeting
  const { boneMap, targetRestPoses, isMixamoModel } = useMemo(() => buildBoneMap(clonedScene), [clonedScene]);

  // Clear external clips when no animation selected
  useEffect(() => {
    if (!animationUrl) setExternalClips([]);
  }, [animationUrl]);

  const allClips = useMemo(() => {
    return [...(animations || []), ...externalClips];
  }, [animations, externalClips]);

  const { actions } = useAnimations(allClips, group);

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

  // Play/stop animations
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.stop());

    if (playingBuiltIn) {
      const action = actions[playingBuiltIn];
      if (action) action.reset().fadeIn(0.3).play();
    } else if (externalClips.length > 0) {
      const clipName = externalClips[0].name;
      const action = actions[clipName];
      if (action) action.reset().fadeIn(0.3).play();
    }
  }, [playingBuiltIn, actions, externalClips]);

  // Apply blendshape values
  useFrame(() => {
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
      <primitive ref={group} object={clonedScene} />
      <primitive object={skeletonHelper} />
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
