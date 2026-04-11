import React, { useState } from 'react';

const CATEGORIES = {
  Brow: (n) => n.startsWith('Brow_'),
  Eye: (n) => n.startsWith('Eye_'),
  Cheek: (n) => n.startsWith('Cheek_'),
  Nose: (n) => n.startsWith('Nose_'),
  Mouth: (n) => n.startsWith('Mouth_'),
  Tongue: (n) => n.startsWith('Tongue_'),
  Viseme: (n) => ['Affricate', 'Dental_Lip', 'Explosive', 'Lip_Open', 'Open', 'Tight', 'Tight_O', 'Wide'].includes(n),
  Other: () => true,
};

export default function BlendShapePanel({ shapes, values, onChange }) {
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  if (!shapes.length) return null;

  // Categorize
  const categorized = {};
  const assigned = new Set();
  for (const [cat, test] of Object.entries(CATEGORIES)) {
    if (cat === 'Other') continue;
    categorized[cat] = shapes.filter((s) => test(s));
    categorized[cat].forEach((s) => assigned.add(s));
  }
  const other = shapes.filter((s) => !assigned.has(s));
  if (other.length) categorized['Other'] = other;

  const filtered = search
    ? shapes.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
    : null;

  const handleChange = (name, value) => {
    onChange({ ...values, [name]: value });
  };

  const resetAll = () => {
    const reset = {};
    shapes.forEach((s) => (reset[s] = 0));
    onChange(reset);
  };

  const renderSlider = (name) => (
    <div key={name} style={sliderRow}>
      <span style={sliderLabel}>{name}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={values[name] || 0}
        onChange={(e) => handleChange(name, parseFloat(e.target.value))}
        style={sliderInput}
      />
      <span style={sliderValue}>{(values[name] || 0).toFixed(2)}</span>
    </div>
  );

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={labelStyle}>Blendshapes ({shapes.length})</label>
        <button onClick={resetAll} style={resetBtn}>Reset</button>
      </div>

      <input
        type="text"
        placeholder="Search shapes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchInput}
      />

      {filtered ? (
        <div>{filtered.map(renderSlider)}</div>
      ) : (
        Object.entries(categorized).map(([cat, items]) => (
          <div key={cat}>
            <button
              onClick={() => setExpanded({ ...expanded, [cat]: !expanded[cat] })}
              style={categoryBtn}
            >
              {expanded[cat] ? '▾' : '▸'} {cat} ({items.length})
            </button>
            {expanded[cat] && items.map(renderSlider)}
          </div>
        ))
      )}
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

const searchInput = {
  width: '100%',
  padding: '5px 8px',
  marginBottom: 8,
  background: '#1a1a2e',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: 4,
  fontSize: 12,
  outline: 'none',
};

const categoryBtn = {
  display: 'block',
  width: '100%',
  padding: '5px 6px',
  marginBottom: 2,
  background: 'transparent',
  color: '#aaa',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
};

const sliderRow = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 2,
  paddingLeft: 8,
};

const sliderLabel = {
  flex: '0 0 130px',
  fontSize: 11,
  color: '#999',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const sliderInput = {
  flex: 1,
  height: 4,
  accentColor: '#3b82f6',
};

const sliderValue = {
  flex: '0 0 36px',
  fontSize: 10,
  color: '#666',
  textAlign: 'right',
};

const resetBtn = {
  background: 'transparent',
  color: '#f87171',
  border: '1px solid #f87171',
  borderRadius: 3,
  padding: '2px 8px',
  fontSize: 10,
  cursor: 'pointer',
};
