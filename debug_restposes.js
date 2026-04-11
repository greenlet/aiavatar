const fs = require('fs');
function parseGLB(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}
const model = parseGLB('models/v03/model.glb');
const anim = parseGLB('models/animations/greeting.glb');

const pairs = [
  ['mixamorig:Hips', 'CC_Base_Hip'],
  ['mixamorig:Spine', 'CC_Base_Waist'],
  ['mixamorig:Spine1', 'CC_Base_Spine01'],
  ['mixamorig:Spine2', 'CC_Base_Spine02'],
  ['mixamorig:Neck', 'CC_Base_NeckTwist01'],
  ['mixamorig:Head', 'CC_Base_Head'],
  ['mixamorig:LeftShoulder', 'CC_Base_L_Clavicle'],
  ['mixamorig:LeftArm', 'CC_Base_L_Upperarm'],
  ['mixamorig:LeftForeArm', 'CC_Base_L_Forearm'],
  ['mixamorig:RightShoulder', 'CC_Base_R_Clavicle'],
  ['mixamorig:RightArm', 'CC_Base_R_Upperarm'],
  ['mixamorig:LeftUpLeg', 'CC_Base_L_Thigh'],
  ['mixamorig:LeftLeg', 'CC_Base_L_Calf'],
  ['mixamorig:LeftFoot', 'CC_Base_L_Foot'],
];

const animByName = {};
for (const n of anim.nodes) { if (n.name) animByName[n.name] = n; }

function findCC(prefix) {
  return model.nodes.find(n => n.name && n.name.startsWith(prefix + '_0'));
}

console.log('Bone rest-pose comparison:');
console.log('SRC_BONE'.padEnd(32), 'SRC_REST'.padEnd(30), 'TGT_REST');
for (const [src, tgt] of pairs) {
  const s = animByName[src];
  const t = findCC(tgt);
  const sr = (s && s.rotation) || [0, 0, 0, 1];
  const tr = (t && t.rotation) || [0, 0, 0, 1];
  console.log(
    src.padEnd(32),
    JSON.stringify(sr.map(v => +v.toFixed(4))).padEnd(30),
    JSON.stringify(tr.map(v => +v.toFixed(4)))
  );
}

// BoneRoot
const br = model.nodes.find(n => n.name && n.name.startsWith('CC_Base_BoneRoot'));
console.log('\nBoneRoot rest:', JSON.stringify((br.rotation || [0, 0, 0, 1]).map(v => +v.toFixed(4))));

// Check: Hip parent in Mixamo
const hipNode = anim.nodes.findIndex(n => n.name === 'mixamorig:Hips');
console.log('Mixamo Hips parent (node index): node', hipNode, '- parent:');
// Find which node has hipNode as child
for (let i = 0; i < anim.nodes.length; i++) {
  if ((anim.nodes[i].children || []).includes(hipNode)) {
    console.log('  Node', i, JSON.stringify(anim.nodes[i].name), 'rot:', anim.nodes[i].rotation || 'identity');
    break;
  }
}
