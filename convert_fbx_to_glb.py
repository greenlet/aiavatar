"""Convert FBX files to GLB using Blender's Python API.
Run via: blender --background --python convert_fbx_to_glb.py
"""
import bpy
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))

conversions = [
    # (input_fbx, output_glb)
    ("models/v03/source/source/Jake.fbx", "models/v03/model.glb"),
    ("models/v04/source/source/Frank.fbx", "models/v04/model.glb"),
    ("models/animations/greeting.fbx", "models/animations/greeting.glb"),
    ("models/animations/standing_idle.fbx", "models/animations/standing_idle.glb"),
    ("models/animations/talking_funny.fbx", "models/animations/talking_funny.glb"),
    ("models/animations/talking_seated.fbx", "models/animations/talking_seated.glb"),
    ("models/animations/thinking.fbx", "models/animations/thinking.glb"),
    ("models/animations/waving.fbx", "models/animations/waving.glb"),
    # New conversational gestures (May 2026)
    ("models/animations/shrug.fbx", "models/animations/shrug.glb"),
    ("models/animations/pointing.fbx", "models/animations/pointing.glb"),
    ("models/animations/clapping.fbx", "models/animations/clapping.glb"),
    ("models/animations/agreeing.fbx", "models/animations/agreeing.glb"),
    ("models/animations/disappointed.fbx", "models/animations/disappointed.glb"),
    ("models/animations/excited.fbx", "models/animations/excited.glb"),
    ("models/animations/thankful.fbx", "models/animations/thankful.glb"),
    ("models/animations/salute.fbx", "models/animations/salute.glb"),
    ("models/animations/weight_shift.fbx", "models/animations/weight_shift.glb"),
    ("models/animations/talking.fbx", "models/animations/talking.glb"),
]

for input_rel, output_rel in conversions:
    input_path = os.path.join(BASE, input_rel)
    output_path = os.path.join(BASE, output_rel)

    if not os.path.exists(input_path):
        print(f"SKIP (not found): {input_path}")
        continue

    if os.path.exists(output_path):
        print(f"SKIP (already converted): {output_rel}")
        continue

    print(f"\nConverting: {input_rel} -> {output_rel}")

    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import FBX
    bpy.ops.import_scene.fbx(
        filepath=input_path,
        use_anim=True,
        ignore_leaf_bones=False,
        automatic_bone_orientation=True,
    )

    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_morph_normal=True,
        export_morph_tangent=False,
        export_all_influences=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
    )

    print(f"  Done: {output_path} ({os.path.getsize(output_path):,} bytes)")

print("\nAll conversions complete.")
