"""Builds the people of Vega from the MakeHuman CC0 assets, rigged for Godot.

  blender --background --python build_people.py -- <makehuman_system_assets> <out_dir> [name ...] [--render]

For each person: the generic body (male or female), a skin texture for their age and ancestry, eyes, eyebrows,
eyelashes, hair and clothes. A skeleton is fitted to the body by measuring it (the centre lines of the torso
and limbs), the skin is weighted to it, and every fitted part takes its weights from the skin. Children are the
adult bodies scaled down with larger heads. Exported as .glb with JPEG textures at 1024 px.

The MakeHuman system assets are CC0 (released by Data Collection AB in 2020).
"""
import math, os, sys
import bpy
import numpy as np
from mathutils import Vector as V

argv = sys.argv[sys.argv.index('--') + 1:]
A, OUT = os.path.abspath(argv[0]), os.path.abspath(argv[1])
RENDER = '--render' in argv
WANT = [a for a in argv[2:] if not a.startswith('--')]

# name: body, skin, hair, eyebrows, eyes, clothes, shoes, age in years, muscle 0-1, weight 0-1
PEOPLE = {
    'vega':          ('male', 'young_caucasian_male', 'short02', 'eyebrow001', 'brown', 'male_casualsuit01', 'shoes01', 32, .62, .45),
    'man_a':         ('male', 'young_african_male', 'short01', 'eyebrow002', 'brown', 'male_casualsuit03', 'shoes02', 27, .75, .4),
    'man_b':         ('male', 'middleage_asian_male', 'short03', 'eyebrow003', 'brownlight', 'male_worksuit01', 'shoes03', 46, .55, .6),
    'man_c':         ('male', 'middleage_caucasian_male', 'short04', 'eyebrow006', 'blue', 'male_casualsuit05', 'shoes01', 40, .45, .7),
    'old_man':       ('male', 'old_caucasian_male', 'short01', 'eyebrow007', 'bluegreen', 'male_casualsuit06', 'shoes02', 72, .35, .55),
    'old_man_b':     ('male', 'old_african_male', 'short03', 'eyebrow002', 'brown', 'male_casualsuit04', 'shoes03', 66, .45, .45),
    'woman_a':       ('female', 'young_caucasian_female', 'long01', 'eyebrow004', 'blue', 'female_casualsuit01', 'shoes04', 26, .5, .45),
    'woman_b':       ('female', 'young_african_female', 'afro01', 'eyebrow005', 'brown', 'female_casualsuit02', 'shoes05', 30, .55, .5),
    'woman_c':       ('female', 'middleage_asian_female', 'bob01', 'eyebrow008', 'brown', 'female_sportsuit01', 'shoes06', 44, .5, .5),
    'woman_d':       ('female', 'middleage_caucasian_female', 'ponytail01', 'eyebrow009', 'bluegreen', 'female_elegantsuit01', 'shoes04', 38, .45, .65),
    'old_woman':     ('female', 'old_caucasian_female', 'bob02', 'eyebrow004', 'blue', 'female_casualsuit02', 'shoes05', 74, .3, .6),
    'old_woman_b':   ('female', 'old_asian_female', 'braid01', 'eyebrow008', 'brown', 'female_casualsuit01', 'shoes06', 68, .35, .45),
    'boy':           ('male', 'young_caucasian_male2', 'short02', 'eyebrow001', 'brown', 'male_casualsuit02', 'shoes01', 10, .45, .45),
    'girl':          ('female', 'young_african_female', 'braid01', 'eyebrow005', 'brown', 'female_casualsuit01', 'shoes04', 9, .45, .45),
}
T = os.path.join(os.path.dirname(A), 'targets')   # MakeHuman macro targets (CC0), next to the system assets


def clear(): bpy.ops.wm.read_factory_settings(use_empty=True)


def obj(path):
    bpy.ops.wm.obj_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y', global_scale=.1)   # MakeHuman: decimetres, Y up
    o = bpy.context.selected_objects[0]
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for p in o.data.polygons: p.use_smooth = True
    return o


def first(d, ext='.png', avoid=('thumb', 'normal', '_ao', 'bump', 'specular')):
    for f in sorted(os.listdir(d)):
        if f.endswith(ext) and not any(a in f.lower() for a in avoid): return os.path.join(d, f)


def image(path, size=1024):
    img = bpy.data.images.load(path, check_existing=True)
    if img.size[0] > size: img.scale(size, size * img.size[1] // img.size[0])
    return img


def material(name, diffuse, normal=None, rough=.6, alpha=False, sss=0.0, tint=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(diffuse)
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
        nt.links.new(t.outputs['Color'], mix.inputs['A']); mix.inputs['B'].default_value = (*tint, 1)
        nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
    else:
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if alpha:
        nt.links.new(t.outputs['Alpha'], p.inputs['Alpha']); m.blend_method = 'HASHED'
    if normal and os.path.exists(normal):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(normal); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = rough
    if sss: p.inputs['Subsurface Weight'].default_value = sss
    return m


_RAW = None
_BASE = None
def base():
    """The base mesh (hm08) as shaped for the current person, in MakeHuman units: decimetres, Y up."""
    return _BASE


def shape(male, years, muscle, weight):
    """Shapes the base mesh the way MakeHuman does: a blend of sculpted targets for sex, age, musculature and body
    fat. Each target is a set of vertex offsets; its weight is the product of how much of each quality applies."""
    global _RAW, _BASE
    if _RAW is None:
        _RAW = np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(A, 'base.obj')) if l.startswith('v ')])
    # age in years to MakeHuman's age axis: baby 1, child 11, young 25, old 90
    a = (years - 1) / 10 * .1875 if years < 11 else .1875 + (years - 11) / 14 * .3125 if years < 25 else .5 + (years - 25) / 65 * .5
    a = min(max(a, 0), 1)
    ages = {'baby': max(0, 1 - a / .1875) if a < .1875 else 0,
            'child': (a / .1875 if a < .1875 else max(0, (.5 - a) / .3125)) if a < .5 else 0,
            'young': ((a - .1875) / .3125 if a < .5 else (1 - a) / .5) if a > .1875 else 0,
            'old': max(0, (a - .5) / .5)}
    def tri(x, lo, mid, hi): return {lo: max(0, (.5 - x) * 2), mid: 1 - abs(x - .5) * 2, hi: max(0, (x - .5) * 2)}
    mus = tri(muscle, 'minmuscle', 'averagemuscle', 'maxmuscle'); wei = tri(weight, 'minweight', 'averageweight', 'maxweight')
    out = _RAW.copy()
    for g, gw in (('male', male), ('female', 1 - male)):
        for ag, aw in ages.items():
            for mu, mw in mus.items():
                for we, ww in wei.items():
                    w = gw * aw * mw * ww
                    if w < 1e-4: continue
                    for line in open(os.path.join(T, f'universal-{g}-{ag}-{mu}-{we}.target')):
                        t = line.split()
                        if len(t) == 4 and not t[0].startswith('#'): out[int(t[0])] += w * np.array([float(t[1]), float(t[2]), float(t[3])])
    _BASE = out


def fit_mhclo(o, path):
    """Places an asset on the body the way MakeHuman does: each vertex is a weighted point on a triangle of the
    base mesh plus an offset, scaled by the base mesh's own proportions. Returns, for each vertex, the base-mesh
    vertex it mostly follows, and the base-mesh vertices the asset hides (the body under a garment)."""
    B = base(); sc = {}; rows = []; refs = []; hide = set(); mode = None
    for line in open(path, encoding='utf-8', errors='ignore'):
        t = line.split()
        if not t or t[0].startswith('#'): continue
        if t[0] in ('x_scale', 'y_scale', 'z_scale'):
            a_, b_, den = int(t[1]), int(t[2]), float(t[3]); ax = 'xyz'.index(t[0][0]); sc[ax] = abs(B[a_][ax] - B[b_][ax]) / den; continue
        if t[0] == 'verts': mode = 'verts'; continue
        if t[0] == 'delete_verts': mode = 'delete'; continue
        if mode == 'delete':
            i = 0
            while i < len(t):
                if i + 2 < len(t) and t[i + 1] == '-': hide.update(range(int(t[i]), int(t[i + 2]) + 1)); i += 3
                elif t[i].isdigit(): hide.add(int(t[i])); i += 1
                else: i += 1
            continue
        if mode != 'verts' or not t[0].lstrip('-').isdigit(): continue
        if len(t) == 1: rows.append(B[int(t[0])]); refs.append(int(t[0]))
        else:
            i, j, k = int(t[0]), int(t[1]), int(t[2]); w = [float(x) for x in t[3:6]]; d = np.array([float(x) for x in t[6:9]])
            rows.append(w[0] * B[i] + w[1] * B[j] + w[2] * B[k] + d * np.array([sc.get(0, 1), sc.get(1, 1), sc.get(2, 1)]))
            refs.append((i, j, k)[int(np.argmax(w))])
    if len(rows) != len(o.data.vertices): print('mhclo vertex count mismatch', path, len(rows), len(o.data.vertices)); return [], hide
    for v, r in zip(o.data.vertices, rows): v.co = V((r[0] * .1, -r[2] * .1, r[1] * .1))
    return refs, hide


HIDDEN = set()


def part(kind, name, tint=None, alpha=None, rough=.6):
    d = os.path.join(A, kind, name)
    o = obj(os.path.join(d, name + '.obj')); o.name = f'{kind}_{name}'
    clo = os.path.join(d, name + '.mhclo')
    if os.path.exists(clo): HIDDEN.update(fit_mhclo(o, clo)[1])
    diff = first(d); nrm = next((os.path.join(d, f) for f in os.listdir(d) if 'normal' in f and f.endswith('.png')), None)
    o.data.materials.clear()
    if diff: o.data.materials.append(material(o.name, diff, nrm, rough=rough, alpha=alpha if alpha is not None else kind in ('hair', 'eyebrows', 'eyelashes'), tint=tint))
    return o


# ---------- fitting a skeleton to the body ----------
def fit(body):
    """Joint positions measured from the mesh: centroids of thin slabs across the torso and along each limb."""
    vs = np.array([v.co[:] for v in body.data.vertices]); H = vs[:, 2].max()
    def slab(mask): return V(vs[mask].mean(0)) if mask.any() else None
    torso = np.abs(vs[:, 0]) < .14 * H / 1.75
    def at_z(z, m=torso, w=.012): return slab(m & (np.abs(vs[:, 2] - z) < w))
    J = {}
    J['hips'] = at_z(.53 * H); J['waist'] = at_z(.61 * H); J['chest'] = at_z(.72 * H); J['neck'] = at_z(.83 * H)
    J['chin'] = at_z(.875 * H, np.abs(vs[:, 0]) < .08); J['crown'] = V((0, J['chin'].y, H))
    for s, sfx in ((1, 'L'), (-1, 'R')):
        side = vs[:, 0] * s
        tip = V(vs[np.argmax(side)])                                   # fingertip
        arm = side > .21 * H / 1.75
        pts = vs[arm]; c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c); ax = V(vt[0]) * (1 if vt[0][0] * s > 0 else -1)
        sh = V(c) + ax * ((.17 * H / 1.75 * s - c[0]) / ax.x)          # where the arm's axis crosses the shoulder
        sh.z = max(sh.z, .80 * H)
        L = (tip - sh).length
        J['shoulder' + sfx] = sh; J['elbow' + sfx] = sh + (tip - sh) * .44; J['wrist' + sfx] = sh + (tip - sh) * .80; J['hand' + sfx] = tip
        leg = (side > .015) & (vs[:, 2] < .5 * H)
        J['hip' + sfx] = at_z(.5 * H, leg, .015); J['knee' + sfx] = at_z(.28 * H, leg, .012)
        foot = leg & (vs[:, 2] < .06 * H)
        J['ankle' + sfx] = at_z(.045 * H, leg & (vs[:, 1] > np.median(vs[foot][:, 1])), .01)
        J['toe' + sfx] = V(vs[foot][np.argmin(vs[foot][:, 1])])
    return J, H


def armature(J):
    arm = bpy.data.armatures.new('Body'); ob = bpy.data.objects.new('Skeleton', arm)
    bpy.context.collection.objects.link(ob); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); eb = arm.edit_bones
    def bone(n, h, t, parent=None, connect=False):
        b = eb.new(n); b.head = h; b.tail = t
        if parent: b.parent = eb[parent]; b.use_connect = connect
    bone('Hips', J['hips'], J['waist']); bone('Spine', J['waist'], J['chest'], 'Hips', True)
    bone('Chest', J['chest'], J['neck'], 'Spine', True); bone('Neck', J['neck'], J['chin'], 'Chest', True)
    bone('Head', J['chin'], J['crown'], 'Neck', True)
    for sfx, s in (('L', 1), ('R', -1)):
        bone('Shoulder.' + sfx, J['neck'] + V((s * .02, 0, -.03)), J['shoulder' + sfx], 'Chest')
        bone('UpperArm.' + sfx, J['shoulder' + sfx], J['elbow' + sfx], 'Shoulder.' + sfx, True)
        bone('LowerArm.' + sfx, J['elbow' + sfx], J['wrist' + sfx], 'UpperArm.' + sfx, True)
        bone('Hand.' + sfx, J['wrist' + sfx], J['hand' + sfx], 'LowerArm.' + sfx, True)
        bone('UpperLeg.' + sfx, J['hip' + sfx], J['knee' + sfx], 'Hips')
        bone('LowerLeg.' + sfx, J['knee' + sfx], J['ankle' + sfx], 'UpperLeg.' + sfx, True)
        bone('Foot.' + sfx, J['ankle' + sfx], J['toe' + sfx], 'LowerLeg.' + sfx, True)
    for b in eb: b.align_roll(V((0, -1, 0)) if abs(b.vector.normalized().z) > .5 else V((0, 0, 1)))
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def weights_from(src, dst):
    bpy.ops.object.select_all(action='DESELECT')
    dt = dst.modifiers.new('w', 'DATA_TRANSFER'); dt.object = src
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = dst; dst.select_set(True)
    bpy.ops.object.datalayout_transfer(modifier='w'); bpy.ops.object.modifier_apply(modifier='w')


def build(name):
    sex, skin, hair, brows, eyes, clothes, shoes, years, muscle, weight = PEOPLE[name]
    clear()
    shape(1.0 if sex == 'male' else 0.0, years, muscle, weight)
    child = years < 16
    body = obj(os.path.join(A, 'proxymeshes', f'{sex}_generic', f'{sex}_generic.obj')); body.name = 'Skin'
    HIDDEN.clear()
    body_refs, _ = fit_mhclo(body, os.path.join(A, 'proxymeshes', f'{sex}_generic', f'{sex}_generic.proxy'))
    lift = -min(v.co.z for v in body.data.vertices)
    sd = os.path.join(A, 'skins', skin)
    body.data.materials.clear(); body.data.materials.append(material('Skin', first(sd), rough=.48, sss=.12))
    old = skin.startswith('old')
    parts = [part('eyes', 'high-poly'), part('eyebrows', brows), part('eyelashes', 'eyelashes01'),
             part('hair', hair, tint=(.75, .74, .72) if old else None), part('clothes', clothes), part('clothes', shoes)]
    eye = parts[0]; eye.data.materials.clear(); eye.data.materials.append(material('Eyes', os.path.join(A, 'eyes', 'materials', f'{eyes}_eye.png'), rough=.15, alpha=True))
    everything = [body] + parts
    for o in everything:
        o.location.z += lift
        bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.transform_apply(location=True)
    J, H = fit(body)
    skel = armature(J)
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); skel.select_set(True); bpy.context.view_layer.objects.active = skel
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in parts:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); skel.select_set(True); bpy.context.view_layer.objects.active = skel
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        weights_from(body, o)
    # the body under the clothes is never seen and would only show through them when he moves
    import bmesh
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
    gone = [bm.verts[i] for i, r in enumerate(body_refs) if r in HIDDEN]
    bmesh.ops.delete(bm, geom=gone, context='VERTS'); bm.to_mesh(body.data); bm.free()
    print(f'{name}: hid {len(gone)} body vertices under clothes', flush=True)
    if RENDER: render(name, H)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', export_yup=True, export_skins=True,
                              export_animations=False, export_image_format='JPEG', export_jpeg_quality=88, export_apply=False)
    print('wrote', name, flush=True)


def render(name, H):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE_NEXT'; scn.render.resolution_x, scn.render.resolution_y = 800, 1000
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.12, .12, .13, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6
    for loc, en in (((2, -3, 3), 600), ((-3, -2, 2), 250), ((0, 3, 3), 300)):
        l = bpy.data.objects.new('l', bpy.data.lights.new('l', 'AREA')); l.data.energy = en; l.data.size = 2; l.location = loc
        scn.collection.objects.link(l); l.rotation_euler = V(loc).to_track_quat('Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    os.makedirs(os.path.join(OUT, 'renders'), exist_ok=True)
    for tag, loc, lens in (('face', (0, -1.1, H - .12), 85), ('full', (0, -5.2, H / 2), 50)):
        cam.location = loc; cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = lens
        scn.render.filepath = os.path.join(OUT, 'renders', f'{name}_{tag}.png'); bpy.ops.render.render(write_still=True)


os.makedirs(OUT, exist_ok=True)
for n in (WANT or PEOPLE):
    build(n)
