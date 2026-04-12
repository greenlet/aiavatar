import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ModelViewer from './ModelViewer';
import AnimationPanel from './AnimationPanel';
import BlendShapePanel from './BlendShapePanel';

const MODELS = [
  { name: 'Jake (v03)', url: '/v03/model.glb', scale: 1 },
  { name: 'Frank (v04)', url: '/v04/model.glb', scale: 15 },
  { name: 'Pete (v05)', url: '/v05/model.glb', scale: 0.01 },
  { name: 'Brunette (v06)', url: '/v06/model.glb', scale: 1 },
];

const ANIMATIONS = [
  { name: 'Greeting', url: '/animations/greeting.glb' },
  { name: 'Standing Idle', url: '/animations/standing_idle.glb' },
  { name: 'Talking Funny', url: '/animations/talking_funny.glb' },
  { name: 'Talking Seated', url: '/animations/talking_seated.glb' },
  { name: 'Thinking', url: '/animations/thinking.glb' },
  { name: 'Waving', url: '/animations/waving.glb' },
];

export default function App() {
  const [selectedModel, setSelectedModel] = useState(0);
  const [selectedAnim, setSelectedAnim] = useState(-1);
  const [blendShapes, setBlendShapes] = useState({});
  const [availableShapes, setAvailableShapes] = useState([]);
  const [animationNames, setAnimationNames] = useState([]);
  const [playingBuiltIn, setPlayingBuiltIn] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* Left sidebar */}
      <div style={sidebarStyle}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Model Viewer</h2>

        {/* Model selector */}
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

        {/* Rig visualization */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Rig</label>
          <button
            onClick={() => setShowSkeleton((v) => !v)}
            style={showSkeleton ? btnActiveStyle : btnStyle}
          >
            {showSkeleton ? '🦴 Hide Skeleton' : '🦴 Show Skeleton'}
          </button>
        </div>

        {/* Animation panel */}
        <AnimationPanel
          animations={ANIMATIONS}
          selectedAnim={selectedAnim}
          onSelectAnim={setSelectedAnim}
          builtInAnims={animationNames}
          playingBuiltIn={playingBuiltIn}
          onPlayBuiltIn={setPlayingBuiltIn}
        />

        {/* Blendshape panel */}
        <BlendShapePanel
          shapes={availableShapes}
          values={blendShapes}
          onChange={setBlendShapes}
        />
      </div>

      {/* 3D viewport */}
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
              animationUrl={selectedAnim >= 0 ? ANIMATIONS[selectedAnim].url : null}
              blendShapes={blendShapes}
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
  width: 280,
  background: '#12121a',
  color: '#eee',
  padding: 16,
  overflowY: 'auto',
  borderRight: '1px solid #333',
};

const sectionStyle = {
  marginBottom: 16,
};

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
