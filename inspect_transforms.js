const fs = require('fs');

function parseGLB(path) {
  const buf = fs.readFileSync(path);
  // GLB header: magic(4) version(4) length(4)
  // Chunk 0: chunkLength(4) chunkType(4) chunkData(chunkLength)
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  return JSON.parse(jsonStr);
}

function inspectModel(path) {
  const gltf = parseGLB(path);
  console.log('=== ' + path + ' ===');
  const nodes = gltf.nodes || [];
  const scenes = gltf.scenes || [];
  const skins = gltf.skins || [];

  // Find skin joint nodes
  const jointSet = new Set();
  for (const skin of skins) {
    for (const j of (skin.joints || [])) jointSet.add(j);
  }

  // Print scene root nodes
  for (const sc of scenes) {
    console.log('Scene "' + (sc.name || '') + '" roots:', sc.nodes);
  }

  // Print all nodes with non-default transforms
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const t = n.translation || [0, 0, 0];
    const r = n.rotation || [0, 0, 0, 1];
    const s = n.scale || [1, 1, 1];
    const hasMatrix = !!n.matrix;
    const isDefault = !hasMatrix &&
      Math.abs(t[0]) < 0.001 && Math.abs(t[1]) < 0.001 && Math.abs(t[2]) < 0.001 &&
      Math.abs(s[0] - 1) < 0.001 && Math.abs(s[1] - 1) < 0.001 && Math.abs(s[2] - 1) < 0.001;

    const isJoint = jointSet.has(i);
    const depth = getDepth(nodes, scenes, i);
    if (depth <= 2 || !isDefault || hasMatrix) {
      const prefix = isJoint ? '[joint] ' : '';
      let line = '  ' + prefix + 'Node ' + i + ' "' + (n.name || '') + '"';
      if (hasMatrix) line += ' matrix:' + JSON.stringify(n.matrix.map(v => +v.toFixed(4)));
      else {
        if (!(Math.abs(t[0]) < 0.001 && Math.abs(t[1]) < 0.001 && Math.abs(t[2]) < 0.001))
          line += ' translation:' + JSON.stringify(t.map(v => +v.toFixed(4)));
        if (!(Math.abs(s[0] - 1) < 0.001 && Math.abs(s[1] - 1) < 0.001 && Math.abs(s[2] - 1) < 0.001))
          line += ' scale:' + JSON.stringify(s.map(v => +v.toFixed(6)));
        if (!(Math.abs(r[0]) < 0.001 && Math.abs(r[1]) < 0.001 && Math.abs(r[2]) < 0.001 && Math.abs(r[3] - 1) < 0.001))
          line += ' rotation:' + JSON.stringify(r.map(v => +v.toFixed(4)));
      }
      console.log(line);
    }
  }
}

function getDepth(nodes, scenes, idx) {
  // Build parent map
  const parent = {};
  for (let i = 0; i < nodes.length; i++) {
    for (const c of (nodes[i].children || [])) parent[c] = i;
  }
  let d = 0, cur = idx;
  while (parent[cur] !== undefined) { d++; cur = parent[cur]; }
  return d;
}

inspectModel('models/v03/model.glb');
inspectModel('models/v04/model.glb');
