"""Renders the écorché of one variant (bones and muscles, no skin), front, three-quarter and back, to check anatomy.
  blender --background --python render_ecorche.py -- <out_dir> <variant>
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, NAME = os.path.abspath(argv[0]), argv[1]
sys.argv = [sys.argv[0], '--', OUT]   # build_bodies reads its own arguments; build nothing on import
import build_bodies as bb
import ecorche

sex, age, H, muscle, fat, head_k = bb.VARIANTS[NAME]
bb.clear()
L = bb.landmarks(sex, age, H, head_k)
objs = ecorche.build(L, sex, age, muscle, bb.arm_points, bb.leg_points)
print(f'{NAME}: {sum(1 for o in objs if o["layer"] == "muscle")} muscle meshes, {sum(1 for o in objs if o["layer"] == "bone")} bone meshes', flush=True)
scn = bpy.context.scene
scn.render.engine = 'BLENDER_WORKBENCH'; scn.display.shading.light = 'STUDIO'; scn.display.shading.color_type = 'VERTEX'
scn.display.shading.show_cavity = True; scn.display.shading.cavity_type = 'BOTH'
scn.render.resolution_x, scn.render.resolution_y = 1000, 1000
scn.world = bpy.data.worlds.new('w')
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = H * 1.1
os.makedirs(os.path.join(OUT, 'renders'), exist_ok=True)
for tag, ang in (('front', 0), ('three', -math.pi / 5), ('back', math.pi)):
    cam.location = (4 * math.sin(ang), -4 * math.cos(ang), H / 2); cam.rotation_euler = (math.pi / 2, 0, ang)
    scn.render.filepath = os.path.join(OUT, 'renders', f'{NAME}_ecorche_{tag}.png'); bpy.ops.render.render(write_still=True)
