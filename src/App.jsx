import React, { useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ModelViewer from './ModelViewer';
import AnimationPanel from './AnimationPanel';
import BlendShapePanel from './BlendShapePanel';
import ChatPanel from './ChatPanel';
import { useLipSync } from './useLipSync';
import { useTtsLipSync } from './useTtsLipSync';
import { useGestureController } from './avatar/useGestureController';
import { ANIMATIONS, ANIMATION_LABELS } from './animations';

const MODELS = [
  { name: 'Jake (v03)', url: '/v03/model.glb', scale: 1 },
  { name: 'Frank (v04)', url: '/v04/model.glb', scale: 15 },
  { name: 'Pete (v05)', url: '/v05/model.glb', scale: 0.01 },
  { name: 'Brunette (v06)', url: '/v06/model.glb', scale: 1 },
];

// Manual animation-picker entries (uses pretty labels from animations.js).
const ANIMATION_PICKER = ANIMATIONS.map((a) => ({
  name: ANIMATION_LABELS[a.name] || a.name,
  url: a.url,
}));

export default function App() {
  const [selectedModel, setSelectedModel] = useState(3); // Brunette (v06) — has Oculus visemes
  const [selectedAnim, setSelectedAnim] = useState(-1);
  const [blendShapes, setBlendShapes] = useState({});
  const [availableShapes, setAvailableShapes] = useState([]);
  const [animationNames, setAnimationNames] = useState([]);
  const [playingBuiltIn, setPlayingBuiltIn] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [chatGesturesEnabled, setChatGesturesEnabled] = useState(true);

  const { micActive, toggleMic, visemeValues: micVisemes } = useLipSync();
  const tts = useTtsLipSync({ voice: 'en-US-JennyNeural' });
  const gesture = useGestureController({ enabled: chatGesturesEnabled });

  // While TTS is speaking, its visemes take precedence over mic-driven ones.
  const mergedBlendShapes = useMemo(() => {
    const baseVisemes = tts.speaking ? tts.visemeValues : micVisemes;
    return { ...blendShapes, ...baseVisemes };
  }, [blendShapes, micVisemes, tts.speaking, tts.visemeValues]);

  // Manual animation picker overrides chat-driven gestures while selected.
  const manualAnim = selectedAnim >= 0 ? ANIMATION_PICKER[selectedAnim] : null;
  const activeAnimationUrl = manualAnim ? manualAnim.url : gesture.gestureUrl;
  const activeLoopOnce = manualAnim ? false : gesture.gestureLoopOnce;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={sidebarStyle}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>AI Avatar</h2>

        <div style={sectionStyle}>
          <label style={labelStyle}>Character</label>
          {MODELS.map((m, i) => (
            <button
              key={m.url}
              onClick={() => { setSelectedModel(i); setSelectedAnim(-1); setPlayingBuiltIn(null); }}
              style={selectedModel === i ? btnActiveStyle : btnStyle}
            >
              {m.name}
            </button>
          ))}
        </div>

        <ChatPanel
          speak={tts.speak}
          stopTts={tts.stop}
          speaking={tts.speaking}
          onGesture={gesture.triggerGesture}
        />

        <div style={sectionStyle}>
          <label style={labelStyle}>User Mic Lip-Sync (HeadAudio)</label>
          <button onClick={toggleMic} style={micActive ? btnActiveStyle : btnStyle}>
            {micActive ? '🎤 Mic On' : '🎤 Enable Mic'}
          </button>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Gestures (current: {gesture.currentGesture || 'none'})</label>
          <button
            onClick={() => setChatGesturesEnabled((v) => !v)}
            style={chatGesturesEnabled ? btnActiveStyle : btnStyle}
          >
            {chatGesturesEnabled ? 'Auto gestures: ON' : 'Auto gestures: OFF'}
          </button>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Rig</label>
          <button onClick={() => setShowSkeleton((v) => !v)} style={showSkeleton ? btnActiveStyle : btnStyle}>
            {showSkeleton ? '🦴 Hide Skeleton' : '🦴 Show Skeleton'}
          </button>
        </div>

        <AnimationPanel
          animations={ANIMATION_PICKER}
          selectedAnim={selectedAnim}
          onSelectAnim={setSelectedAnim}
          builtInAnims={animationNames}
          playingBuiltIn={playingBuiltIn}
          onPlayBuiltIn={setPlayingBuiltIn}
        />

        <BlendShapePanel
          shapes={availableShapes}
          values={blendShapes}
          onChange={setBlendShapes}
        />
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: [0, 1, 3], fov: 45 }}
          shadows
          style={{ background: '#1a1a2e' }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <directionalLight position={[-3, 3, -3]} intensity={0.3} />
          <Suspense fallback={null}>
            <ModelViewer
              modelUrl={MODELS[selectedModel].url}
              modelScale={MODELS[selectedModel].scale}
              animationUrl={activeAnimationUrl}
              animationLoopOnce={activeLoopOnce}
              onAnimationFinished={gesture.handleFinished}
              blendShapes={mergedBlendShapes}
              onShapesDetected={setAvailableShapes}
              onAnimationsDetected={setAnimationNames}
              playingBuiltIn={playingBuiltIn}
              showSkeleton={showSkeleton}
            />
          </Suspense>
          <OrbitControls target={[0, 1, 0]} />
          <gridHelper args={[10, 10, '#444', '#333']} />
        </Canvas>
      </div>
    </div>
  );
}

const sidebarStyle = {
  width: 320,
  background: '#12121a',
  color: '#eee',
  padding: 16,
  overflowY: 'auto',
  borderRight: '1px solid #333',
};

const sectionStyle = { marginBottom: 16 };

const labelStyle = {
  display: 'block',
  fontSize: 11,
  textTransform: 'uppercase',
  color: '#888',
  marginBottom: 6,
  letterSpacing: 1,
};

const btnStyle = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  marginBottom: 4,
  background: '#222',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
};

const btnActiveStyle = {
  ...btnStyle,
  background: '#2563eb',
  color: '#fff',
  borderColor: '#3b82f6',
};
