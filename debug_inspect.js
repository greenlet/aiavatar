// Check v04's inverse bind matrices and bone world matrices more carefully
const fs = require('fs');

function parseGLB(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString());
}

// Print full IBM for key bones
for (const model of ['v03', 'v04']) {
  const json = parseGLB('models/' + model + '/model.glb');
  const nodes = json.nodes;
  const skin = json.skins[0];
  const buf = fs.readFileSync('models/' + model + '/model.glb');
  const jsonLen2 = buf.readUInt32LE(12);
  const binOffset = 20 + jsonLen2 + 8;
  const ibmAcc = json.accessors[skin.inverseBindMatrices];
  const bv = json.bufferViews[ibmAcc.bufferView];
  const dataOffset = binOffset + (bv.byteOffset || 0) + (ibmAcc.byteOffset || 0);
  
  console.log('\n=== ' + model + ' full inverse bind matrices ===');
  const joints = skin.joints;
  
  // Show the first 3 joints
  for (let j = 0; j < Math.min(3, joints.length); j++) {
    const node = nodes[joints[j]];
    const mat = [];
    for (let i = 0; i < 16; i++) {
      mat.push(buf.readFloatLE(dataOffset + j * 64 + i * 4));
    }
    // Print as 4x4 column-major → row display
    console.log(`  ${node.name} IBM:`);
    for (let row = 0; row < 4; row++) {
      console.log(`    [${mat[row].toFixed(4)}, ${mat[row+4].toFixed(4)}, ${mat[row+8].toFixed(4)}, ${mat[row+12].toFixed(4)}]`);
    }
  }
  
  // Also check: how is the mesh bound? Check if mesh node has skin property
  nodes.forEach((n, i) => {
    if (n.mesh !== undefined && n.skin !== undefined && model === 'v04') {
      console.log(`  Mesh node ${i} (${n.name}): mesh=${n.mesh}, skin=${n.skin}`);
      // Check if there are any per-node transforms that affect binding
      if (n.translation || n.rotation || n.scale || n.matrix) {
        console.log('    HAS TRANSFORM:', { t: n.translation, r: n.rotation, s: n.scale, m: n.matrix });
      }
    }
  });
}
