import React from 'react';

export default function AnimationPanel({
  animations,
  selectedAnim,
  onSelectAnim,
  builtInAnims,
  playingBuiltIn,
  onPlayBuiltIn,
}) {
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Animations (Mixamo)</label>
      {animations.map((a, i) => (
        <button
          key={a.url}
          onClick={() => { onSelectAnim(i); onPlayBuiltIn(null); }}
          style={selectedAnim === i ? btnActiveStyle : btnStyle}
        >
          ▶ {a.name}
        </button>
      ))}

      {builtInAnims.length > 0 && (
        <>
          <label style={{ ...labelStyle, marginTop: 12 }}>Built-in Animations</label>
          {builtInAnims.map((name) => (
            <button
              key={name}
              onClick={() => { onPlayBuiltIn(name); onSelectAnim(-1); }}
              style={playingBuiltIn === name ? btnActiveStyle : btnStyle}
            >
              ▶ {name}
            </button>
          ))}
        </>
      )}

      {selectedAnim >= 0 || playingBuiltIn !== null ? (
        <button
          onClick={() => { onSelectAnim(-1); onPlayBuiltIn(null); }}
          style={{ ...btnStyle, marginTop: 4, color: '#f87171' }}
        >
          ⏹ Stop
        </button>
      ) : null}
    </div>
  );
}

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
