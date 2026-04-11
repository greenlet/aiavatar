const fs = require('fs');

function parseGLB(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  return JSON.parse(jsonStr);
}

function inspect(path) {
  const gltf = parseGLB(path);
  const nodes = gltf.nodes || [];
  const skins = gltf.skins || [];
  const anims = gltf.animations || [];

  console.log('\n=== ' + path + ' ===');
  console.log('Nodes:', nodes.length, 'Skins:', skins.length, 'Animations:', anims.length);

  // Find joint nodes
  const jointSet = new Set();
  for (const skin of skins) {
    for (const j of (skin.joints || [])) jointSet.add(j);
  }

  // Print all nodes (bones primarily)
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const r = n.rotation || [0, 0, 0, 1];
    const s = n.scale || [1, 1, 1];
    const t = n.translation || [0, 0, 0];
    const isJoint = jointSet.has(i);
    const prefix = isJoint ? '[J] ' : '    ';
    const extra = [];
    if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) > 0.01) {
      extra.push('rot:' + JSON.stringify(r.map(v => +v.toFixed(4))));
    }
    if (Math.abs(s[0] - 1) + Math.abs(s[1] - 1) + Math.abs(s[2] - 1) > 0.01) {
      extra.push('scale:' + JSON.stringify(s.map(v => +v.toFixed(4))));
    }
    if (Math.abs(t[0]) + Math.abs(t[1]) + Math.abs(t[2]) > 0.1) {
      extra.push('pos:' + JSON.stringify(t.map(v => +v.toFixed(2))));
    }
    if (isJoint || extra.length > 0 || i < 5) {
      console.log(prefix + 'Node ' + i + ' "' + (n.name || '') + '" ' + extra.join(' '));
    }
  }

  // Print animation track names
  if (anims.length > 0) {
    const a = anims[0];
    console.log('\nAnimation "' + (a.name || '') + '" channels: ' + (a.channels || []).length);
    const channelsByNode = {};
    for (const ch of (a.channels || [])) {
      const name = (nodes[ch.target.node] || {}).name || ('node' + ch.target.node);
      if (!channelsByNode[name]) channelsByNode[name] = [];
      channelsByNode[name].push(ch.target.path);
    }
    for (const [name, paths] of Object.entries(channelsByNode)) {
      console.log('  ' + name + ': ' + paths.join(', '));
    }
  }
}

// Inspect model
inspect('models/v03/model.glb');

// Inspect animation
inspect('models/animations/greeting.glb');
inspect('models/animations/waving.glb');
