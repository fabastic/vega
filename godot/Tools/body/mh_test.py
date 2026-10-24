"""Checks that a MakeHuman CC0 skin texture maps onto a MakeHuman generic body, with hair and clothes.
  blender --background --python mh_test.py -- <assets_dir> <out_png>
"""
import math, os, sys
import bpy
argv = sys.argv[sys.argv.index('--') + 1:]
A, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)


def obj(path):
    bpy.ops.wm.obj_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y', global_scale=.1)   # MakeHuman works in decimetres, Y up
    o = bpy.context.selected_objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def tex_mat(name, img, normal=None, rough=.5, alpha=False, sss=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(img)
    nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if alpha: nt.links.new(t.outputs['Alpha'], p.inputs['Alpha']); m.blend_method = 'HASHED'
    if normal and os.path.exists(normal):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = rough
    if sss: p.inputs['Subsurface Weight'].default_value = sss
    return m


body = obj(os.path.join(A, 'proxymeshes/male_generic/male_generic.obj'))
body.data.materials.clear(); body.data.materials.append(tex_mat('Skin', os.path.join(A, 'skins/young_caucasian_male/young_lightskinned_male_diffuse.png'), rough=.45, sss=.15))
for part, img, nrm, a in (('hair/short02/short02.obj', 'hair/short02/short02_diffuse.png', 'hair/short02/short02_normal.png', True),
                          ('eyebrows/eyebrow001/eyebrow001.obj', 'eyebrows/eyebrow001/eyebrow001.png', None, True),
                          ('eyes/high-poly/high-poly.obj', 'eyes/materials/brown_eye.png', None, False),
                          ('clothes/male_casualsuit01/male_casualsuit01.obj', 'clothes/male_casualsuit01/male_casualsuit01_diffuse.png', 'clothes/male_casualsuit01/male_casualsuit01_normal.png', False)):
    p = os.path.join(A, part)
    if not os.path.exists(p): print('missing', part); continue
    o = obj(p); o.data.materials.clear()
    ip = os.path.join(A, img)
    if not os.path.exists(ip):
        d = os.path.dirname(ip); cand = [f for f in os.listdir(d) if f.endswith('.png') and 'thumb' not in f]
        ip = os.path.join(d, cand[0]) if cand else None
    if ip: o.data.materials.append(tex_mat(part, ip, os.path.join(A, nrm) if nrm else None, alpha=a))
    for poly in o.data.polygons: poly.use_smooth = True
for poly in body.data.polygons: poly.use_smooth = True

scn = bpy.context.scene
scn.render.engine = 'BLENDER_EEVEE_NEXT'; scn.render.resolution_x, scn.render.resolution_y = 900, 1100
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.12, .12, .13, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6
for loc, en in (((2, -3, 3), 600), ((-3, -2, 2), 250), ((0, 3, 3), 300)):
    l = bpy.data.objects.new('l', bpy.data.lights.new('l', 'AREA')); l.data.energy = en; l.data.size = 2; l.location = loc
    scn.collection.objects.link(l); l.rotation_euler = (V := __import__('mathutils').Vector(loc)).to_track_quat('Z', 'Y').to_euler()
zs = [v.co.z for v in body.data.vertices]; H = max(zs) - min(zs); print('height', H, 'min z', min(zs))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.lens = 70
cam.location = (.0, -2.0, max(zs) - .25); cam.rotation_euler = (math.radians(90), 0, 0)
scn.render.filepath = OUT; bpy.ops.render.render(write_still=True)
cam.location = (.0, -5.5, H / 2 + min(zs)); scn.render.filepath = OUT.replace('.png', '_full.png'); bpy.ops.render.render(write_still=True)
