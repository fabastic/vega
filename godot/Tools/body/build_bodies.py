"""Builds the people of Vega in Blender, from the skeleton up.

  blender --background --python build_bodies.py -- <out_dir> [variant ...] [--render]

Layers, in the order a body is made:
  1. skeleton  an armature (hips, spine, chest, neck, head, clavicles, arms, hands, legs, feet)
  2. bone      the parts of the skeleton that shape the surface: skull, ribcage, pelvis, scapulae, kneecaps, elbows
  3. muscle    about forty muscles placed on the skeleton, scaled by sex, age and fitness
  4. fat       the fat that sits over the muscle, distributed by sex and age
  5. skin      one surface wrapped over all of it (an implicit surface of the layers, remeshed and smoothed),
               weighted to the skeleton
  6. dress     clothes as shells over the skin, hair, beard and eyes
Each variant is exported as a .glb with an armature that Godot poses bone by bone.

Blender's frame: Z up, the body faces -Y, its left side is +X. glTF export turns that into Y up, facing +Z.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
RENDER = '--render' in argv
WANT = [a for a in argv[1:] if not a.startswith('--')]

VARIANTS = {
    #               sex  age      height muscle fat   head
    'man':         (0,  'adult',  1.76,  .55,  .25,  1.0),
    'woman':       (1,  'adult',  1.65,  .35,  .45,  1.0),
    'old_man':     (0,  'elder',  1.72,  .3,   .45,  1.0),
    'old_woman':   (1,  'elder',  1.60,  .2,   .55,  1.0),
    'boy':         (0,  'child',  1.30,  .2,   .3,   1.18),
    'girl':        (1,  'child',  1.26,  .15,  .32,  1.18),
}

V = Vector


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------- 1. the skeleton ----------
def landmarks(sex, age, H, head_k):
    """Joint positions for a body of height H. Proportions follow standard figure-drawing canons (an adult is
    about 7.5 heads tall; a child's head is larger and the legs shorter)."""
    k = H / 1.75
    f = sex == 1
    child = age == 'child'
    leg = .92 if not child else .86   # the hip joint as a fraction of the adult canon
    L = {}
    hz = .92 * leg / .92 * k if not child else .48 / 1.3 * H / k * k
    hip_z = (.92 if not child else .50 / 1.30 * H / k) * k
    L['hip_w'] = (.085 if f else .09) * k * (1.08 if f else 1)
    L['shoulder_w'] = (.165 if f else .2) * k * (.92 if child else 1)
    L['ankle'] = .075 * k
    L['knee'] = hip_z * .54
    L['hip'] = hip_z
    top = H
    head_h = (top / 7.5) * head_k
    L['crown'] = top
    L['chin'] = top - head_h
    L['neck_base'] = L['chin'] - .085 * k * (.8 if child else 1)
    L['shoulder'] = L['neck_base'] - .05 * k
    L['chest'] = L['shoulder'] - .14 * k
    L['waist'] = hip_z + .17 * k * (1 if not child else .9)
    L['head_h'] = head_h
    L['k'] = k
    upper = (.30 if not child else .26) * k
    fore = (.26 if not child else .22) * k
    L['upper'], L['fore'], L['hand'] = upper, fore, .18 * k
    return L


ABDUCT = math.radians(35)   # arms rest in an A-pose, away from the body, so the skin of arm and torso don't fuse


def arm_points(L, side):
    s = side
    sh = V((s * L['shoulder_w'], 0, L['shoulder']))
    d = V((s * math.sin(ABDUCT), 0, -math.cos(ABDUCT)))
    el = sh + d * L['upper']
    wr = el + d * L['fore'] + V((0, -.01, 0))
    hd = wr + d * L['hand']
    return sh, el, wr, hd


def leg_points(L, side):
    s = side
    hp = V((s * L['hip_w'], 0, L['hip']))
    kn = V((s * (L['hip_w'] + .01), -.01, L['knee']))
    an = V((s * (L['hip_w'] + .02), .0, L['ankle']))
    toe = V((s * (L['hip_w'] + .03), -.17 * L['k'], .025))
    return hp, kn, an, toe


def build_armature(L):
    arm = bpy.data.armatures.new('Body')
    ob = bpy.data.objects.new('Skeleton', arm)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name); b.head = head; b.tail = tail
        if parent: b.parent = eb[parent]; b.use_connect = connect
        return b

    k = L['k']
    bone('Hips', V((0, 0, L['hip'] - .02 * k)), V((0, .01, L['waist'])))
    bone('Spine', V((0, .01, L['waist'])), V((0, .02, L['chest'])), 'Hips', True)
    bone('Chest', V((0, .02, L['chest'])), V((0, .02, L['neck_base'])), 'Spine', True)
    bone('Neck', V((0, .02, L['neck_base'])), V((0, .0, L['chin'] + .02 * k)), 'Chest', True)
    bone('Head', V((0, .0, L['chin'] + .02 * k)), V((0, .0, L['crown'])), 'Neck', True)
    for side, sfx in ((1, '.L'), (-1, '.R')):
        sh, el, wr, hd = arm_points(L, side)
        bone('Shoulder' + sfx, V((side * .02 * k, -.01, L['neck_base'] - .02 * k)), sh, 'Chest')
        bone('UpperArm' + sfx, sh, el, 'Shoulder' + sfx, True)
        bone('LowerArm' + sfx, el, wr, 'UpperArm' + sfx, True)
        bone('Hand' + sfx, wr, hd, 'LowerArm' + sfx, True)
        hp, kn, an, toe = leg_points(L, side)
        bone('UpperLeg' + sfx, hp, kn, 'Hips')
        bone('LowerLeg' + sfx, kn, an, 'UpperLeg' + sfx, True)
        bone('Foot' + sfx, an, toe, 'LowerLeg' + sfx, True)
    # bones' local X axis is the body's sideways axis, so a bend is a rotation about X in Godot
    for b in eb:
        b.align_roll(V((0, -1, 0)) if abs(b.vector.normalized().z) > .5 else V((0, 0, 1)))
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------- 2-4. bone, muscle and fat, as an implicit surface ----------
# A metaball's surface sits at about 0.575 of its radius (stiffness 2, threshold 0.6: (1 - d^2/R^2)^3 = 0.3), so
# every size below is given as the size it should appear and scaled up here.
GROW = 1 / .575


class Field:
    """The layers are elements of one metaball field. Its iso-surface is the skin."""

    def __init__(self, name, res):
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = res; self.mb.render_resolution = res; self.mb.threshold = .6
        self.ob = bpy.data.objects.new(name, self.mb)
        bpy.context.collection.objects.link(self.ob)
        self.count = {'bone': 0, 'muscle': 0, 'fat': 0}

    SLIM = {'bone': .9, 'muscle': .82, 'fat': .85}

    def ball(self, at, r, layer='muscle', stiff=2.0, neg=False):
        if r <= .002: return
        r *= self.SLIM[layer]
        e = self.mb.elements.new(); e.type = 'BALL'; e.co = at; e.radius = r * GROW; e.stiffness = stiff; e.use_negative = neg
        self.count[layer] += 1

    def ellipsoid(self, at, half, layer='muscle', rot=None, stiff=2.0):
        if min(half) <= .002: return
        half = tuple(h * self.SLIM[layer] for h in half)
        r = max(half)
        e = self.mb.elements.new(); e.type = 'ELLIPSOID'; e.co = at; e.radius = r * GROW; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = half[0] / r, half[1] / r, half[2] / r
        if rot: e.rotation = rot
        self.count[layer] += 1

    def capsule(self, a, b, r, layer='muscle', stiff=2.0):
        if r <= .002: return
        r *= self.SLIM[layer]
        d = b - a
        e = self.mb.elements.new(); e.type = 'CAPSULE'; e.co = (a + b) / 2; e.radius = r * GROW; e.stiffness = stiff
        e.size_x = d.length / 2
        e.rotation = V((1, 0, 0)).rotation_difference(d.normalized())
        self.count[layer] += 1


def lerp(a, b, t): return a + (b - a) * t


def body_field(L, sex, age, muscle, fat, res=.006):
    F = Field('Flesh', res)
    k = L['k']; f = sex == 1; child = age == 'child'; old = age == 'elder'
    m = .55 + .9 * muscle          # muscle bulk
    fa = fat                       # fat
    sw, hw = L['shoulder_w'], L['hip_w']

    # 2. bone that shapes the surface
    crown, chin = L['crown'], L['chin']; hh = L['head_h']
    skull_c = V((0, .012 * k, chin + hh * .58))
    F.ellipsoid(skull_c, (hh * .38, hh * .47, hh * .47), 'bone')
    F.ellipsoid(V((0, -.025 * k, chin + hh * .2)), (hh * .3, hh * .3, hh * .2), 'bone')    # jaw
    F.ball(V((0, -hh * .36, chin + hh * .08)), hh * .1, 'bone')                              # chin
    for s in (1, -1):
        F.ball(V((s * hh * .22, -hh * .3, chin + hh * .45)), hh * .1, 'bone')                # cheekbones
        F.capsule(V((s * hh * .06, -hh * .42, chin + hh * .62)), V((s * hh * .25, -hh * .36, chin + hh * .61)), hh * .06, 'bone')   # brow
        F.ball(V((s * hh * .16, -hh * .44, chin + hh * .5)), hh * .085, 'bone', neg=True)    # eye sockets
        F.ellipsoid(V((s * hh * .38, .0, chin + hh * .5)), (hh * .05, hh * .11, hh * .15), 'bone')   # ears
    F.capsule(V((0, -hh * .44, chin + hh * .56)), V((0, -hh * .52, chin + hh * .38)), hh * .055, 'bone')   # nose bridge
    F.ball(V((0, -hh * .54, chin + hh * .36)), hh * .075, 'bone')                             # nose tip
    F.ellipsoid(V((0, -hh * .44, chin + hh * .22)), (hh * .11, hh * .04, hh * .035), 'bone')  # lips
    rib_c = V((0, -.005, lerp(L['waist'], L['shoulder'], .55)))
    F.ellipsoid(rib_c, ((.12 if f else .135) * k, (.08 if f else .088) * k, .16 * k), 'bone')
    F.ellipsoid(V((0, .0, L['hip'] + .05 * k)), ((.165 if f else .145) * k, .095 * k, .085 * k), 'bone')   # pelvis
    for s in (1, -1):
        F.capsule(V((s * .02 * k, -.05 * k, L['neck_base'] - .02 * k)), V((s * sw * .95, -.01, L['shoulder'] + .02 * k)), .022 * k, 'bone')   # clavicle
        F.ellipsoid(V((s * .09 * k, .08 * k, L['chest'] + .04 * k)), (.06 * k, .02 * k, .07 * k), 'bone')   # scapula
        sh, el, wr, hd = arm_points(L, s); hp, kn, an, toe = leg_points(L, s)
        F.ball(el, .03 * k, 'bone'); F.ball(wr, .028 * k, 'bone')
        F.ball(kn + V((0, -.025 * k, 0)), .032 * k, 'bone'); F.ball(an, .034 * k, 'bone')

    # neck
    F.capsule(V((0, .01, L['neck_base'] - .02 * k)), V((0, .0, chin + hh * .25)), (.05 if f else .058) * k * (1 + muscle * .2), 'muscle')
    for s in (1, -1):   # sternocleidomastoid
        F.capsule(V((s * .045 * k, .0, chin + hh * .3)), V((s * .015 * k, -.05 * k, L['neck_base'] - .01 * k)), .018 * k * m, 'muscle')

    # 3. muscle
    torso_m = m * (.85 if f else 1) * (.75 if child else 1)
    for s in (1, -1):
        sh, el, wr, hd = arm_points(L, s)
        ax = (el - sh).normalized()
        F.ellipsoid(V((s * .075 * k, -.07 * k, L['chest'] + .045 * k)), (.072 * k, .022 * k * torso_m, .05 * k), 'muscle', rot=Quaternion((0, 1, 0), s * .25))   # pectoralis
        F.ellipsoid(V((s * .085 * k, .045 * k, L['neck_base'] - .01 * k)), (.08 * k, .035 * k * torso_m, .03 * k * torso_m), 'muscle')    # trapezius
        F.ellipsoid(V((s * .115 * k, .04 * k, L['chest'] - .05 * k)), (.04 * k * torso_m, .055 * k, .13 * k), 'muscle', rot=Quaternion((0, 1, 0), -s * .2))                    # latissimus
        F.ellipsoid(V((s * .1 * k, -.02 * k, L['waist'] - .02 * k)), (.035 * k, .055 * k, .075 * k), 'muscle')                               # obliques
        F.capsule(V((s * .04 * k, .075 * k, L['hip'] + .1 * k)), V((s * .04 * k, .07 * k, L['chest'])), .033 * k * torso_m, 'muscle')    # spinal erectors
        F.ellipsoid(sh + V((s * .01, 0, -.01 * k)), (.055 * k * m, .058 * k * m, .07 * k), 'muscle')                                        # deltoid
        F.capsule(sh + ax * .07 * k + V((0, -.02 * k, 0)), el - ax * .05 * k + V((0, -.018 * k, 0)), .037 * k * m * (.85 if f else 1), 'muscle')   # biceps
        F.capsule(sh + ax * .05 * k + V((0, .02 * k, 0)), el - ax * .03 * k + V((0, .02 * k, 0)), .04 * k * m * (.85 if f else 1), 'muscle')      # triceps
        fa_ax = (wr - el).normalized()
        F.capsule(el + fa_ax * .03 * k, el + fa_ax * .13 * k, .04 * k * m * (.85 if f else 1), 'muscle')                                   # forearm flexors
        F.capsule(el + fa_ax * .1 * k, wr - fa_ax * .02 * k, .027 * k, 'muscle')                                                              # forearm, to the wrist
        # the hand: a palm, four fingers held together, and a thumb
        hax = (hd - wr).normalized(); fwd = V((0, -1, 0))
        F.ellipsoid(wr + hax * .045 * k, (.018 * k, .042 * k, .048 * k), 'muscle', rot=V((0, 0, 1)).rotation_difference(hax))
        for i in range(4):
            off = V((0, (i - 1.5) * .019 * k, 0))
            F.capsule(wr + hax * .085 * k + off, wr + hax * (.165 - abs(i - 1.5) * .014) * k + off, .0115 * k, 'muscle')
        F.capsule(wr + hax * .03 * k + fwd * .03 * k, wr + hax * .09 * k + fwd * .055 * k, .013 * k, 'muscle')
        hp, kn, an, toe = leg_points(L, s)
        lax = (kn - hp).normalized(); sax = (an - kn).normalized()
        leg_m = m * (.95 if f else 1)
        F.ellipsoid(V((s * .075 * k, .065 * k, L['hip'] + .0 * k)), (.07 * k * leg_m, .055 * k * leg_m, .08 * k), 'muscle')                # gluteus
        F.capsule(hp + lax * .08 * k + V((0, -.035 * k, 0)), kn - lax * .1 * k + V((0, -.03 * k, 0)), .055 * k * leg_m, 'muscle')          # quadriceps
        F.ball(kn - lax * .07 * k + V((-s * .022 * k, -.02 * k, 0)), .032 * k * leg_m, 'muscle')                                            # vastus medialis
        F.capsule(hp + lax * .1 * k + V((0, .035 * k, 0)), kn - lax * .12 * k + V((0, .03 * k, 0)), .046 * k * leg_m, 'muscle')              # hamstrings
        F.capsule(hp + lax * .06 * k + V((-s * .04 * k, 0, 0)), lerp(hp, kn, .5) + V((-s * .025 * k, 0, 0)), .036 * k * leg_m, 'muscle')   # adductors
        F.ellipsoid(kn + sax * .13 * k + V((0, .035 * k, 0)), (.038 * k * leg_m, .042 * k * leg_m, .09 * k), 'muscle')                       # calf
        F.capsule(kn + sax * .04 * k, an - sax * .04 * k, .034 * k, 'muscle')                                                                 # shin
        # the foot: heel, arch and toes
        F.ellipsoid(lerp(an, toe, .45) + V((0, 0, -.025 * k)), (.042 * k, .11 * k, .03 * k), 'muscle', rot=V((0, -1, 0)).rotation_difference((toe - an).normalized()) if False else None)
        F.ball(an + V((0, .035 * k, -.04 * k)), .035 * k, 'muscle')
    F.ellipsoid(V((0, -.055 * k, L['waist'] + .01 * k)), (.075 * k, .022 * k * torso_m, .13 * k), 'muscle')   # rectus abdominis

    # 4. fat
    belly = fa * (1.6 if old else 1) * (.6 if f else 1)
    F.ellipsoid(V((0, -.075 * k, L['waist'] - .03 * k)), (.12 * k * belly, .07 * k * belly, .1 * k * belly), 'fat')
    for s in (1, -1):
        sh, el, wr, hd = arm_points(L, s); hp, kn, an, toe = leg_points(L, s)
        hipfat = fa * (1.5 if f else .6) * (.5 if child else 1)
        F.ellipsoid(V((s * .12 * k, .0, L['hip'] - .03 * k)), (.07 * k * hipfat, .075 * k * hipfat, .12 * k * hipfat), 'fat')    # hips and outer thighs
        F.ellipsoid(V((s * .085 * k, .08 * k, L['hip'] - .02 * k)), (.07 * k * hipfat, .06 * k * hipfat, .08 * k * hipfat), 'fat')  # buttocks
        F.capsule(lerp(hp, kn, .15), lerp(hp, kn, .7), .05 * k * fa * (1.2 if f else .8), 'fat')                                    # thighs
        F.capsule(lerp(sh, el, .25), lerp(sh, el, .85), .03 * k * fa * (1.3 if f else .8), 'fat')                                  # upper arms
        if f and not child:   # breasts
            r = .058 * k * (.7 + fa * .8) * (.85 if old else 1)
            F.ball(V((s * .085 * k, -.105 * k, L['chest'] - (.015 if not old else .045) * k)), r, 'fat', stiff=2.2)
        if old:
            F.ellipsoid(V((s * .13 * k, .02 * k, L['waist'])), (.04 * k, .06 * k, .06 * k), 'fat')   # flanks
    if fa > .35: F.ellipsoid(V((0, -.01, chin + hh * .3)), (hh * .26 * fa, hh * .22 * fa, hh * .14 * fa), 'fat')   # cheeks and jowls
    return F


# ---------- 5. skin ----------
def to_mesh(ob, name, voxel=.006, target_tris=9000, smooth=4):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    me_ob = bpy.context.view_layer.objects.active; me_ob.name = name
    rm = me_ob.modifiers.new('remesh', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = voxel; rm.adaptivity = 0
    sm = me_ob.modifiers.new('smooth', 'CORRECTIVE_SMOOTH'); sm.iterations = smooth; sm.smooth_type = 'LENGTH_WEIGHTED'; sm.use_only_smooth = True
    bpy.ops.object.modifier_apply(modifier='remesh'); bpy.ops.object.modifier_apply(modifier='smooth')
    tris = sum(len(p.vertices) - 2 for p in me_ob.data.polygons)
    if tris > target_tris:
        dc = me_ob.modifiers.new('decimate', 'DECIMATE'); dc.ratio = target_tris / tris
        bpy.ops.object.modifier_apply(modifier='decimate')
    bpy.ops.object.shade_smooth()
    return me_ob


def material(name, color, rough=.5, sss=0.0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    p = mat.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    mat.diffuse_color = (*color, 1)
    if sss: p.inputs['Subsurface Weight'].default_value = sss
    return mat


# ---------- 6. clothes, hair, eyes ----------
def shell(skin, name, keep, thickness, mat):
    """A garment: the part of the skin it covers, lifted off the body."""
    ob = skin.copy(); ob.data = skin.data.copy(); ob.name = name
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(sum((v.co for v in f.verts), V()) / len(f.verts))], context='FACES')
    bm.to_mesh(ob.data); bm.free()
    ob.data.materials.clear(); ob.data.materials.append(mat)
    for vg in list(ob.vertex_groups): pass
    so = ob.modifiers.new('solidify', 'SOLIDIFY'); so.thickness = thickness; so.offset = 1
    bpy.context.view_layer.objects.active = ob
    disp = ob.modifiers.new('lift', 'DISPLACE'); disp.strength = thickness * .6; disp.direction = 'NORMAL'
    ob.modifiers.move(1, 0)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    for mname in ('lift', 'solidify'): bpy.ops.object.modifier_apply(modifier=mname)
    return ob


def blob_mesh(name, parts, res=.006, voxel=.005, tris=2500, mat=None):
    F = Field(name + '_f', res)
    for kind, args in parts: getattr(F, kind)(*args)
    ob = to_mesh(F.ob, name, voxel=voxel, target_tris=tris, smooth=3)
    if mat: ob.data.materials.append(mat)
    return ob


def hair_and_eyes(L, sex, age):
    hh = L['head_h']; chin = L['chin']; k = L['k']
    c = V((0, .015 * k, chin + hh * .6))
    hair = material('Hair', (.08, .06, .05), .6)
    out = []
    cap = ('ellipsoid', (c + V((0, .01 * k, .025 * k)), (hh * .43, hh * .52, hh * .48), 'muscle'))
    face_cut = ('ball', (c + V((0, -hh * .55, -hh * .25)), hh * .5, 'muscle', 2.0, True))
    out.append(blob_mesh('Hair_Short', [cap, face_cut], mat=hair))
    out.append(blob_mesh('Hair_Long', [cap, face_cut, ('ellipsoid', (c + V((0, hh * .3, -hh * .55)), (hh * .42, hh * .2, hh * .7), 'muscle'))], mat=hair))
    out.append(blob_mesh('Hair_Bun', [cap, face_cut, ('ball', (c + V((0, hh * .5, hh * .1)), hh * .2, 'muscle'))], mat=hair))
    out.append(blob_mesh('Hair_Ponytail', [cap, face_cut, ('capsule', (c + V((0, hh * .5, 0)), c + V((0, hh * .65, -hh * .7)), hh * .1, 'muscle'))], mat=hair))
    if sex == 0 and age != 'child':
        out.append(blob_mesh('Beard', [('ellipsoid', (V((0, -hh * .33, chin + hh * .2)), (hh * .3, hh * .22, hh * .22), 'muscle')),
                                       ('ball', (V((0, -hh * .62, chin + hh * .28)), hh * .17, 'muscle', 2.0, True))], mat=hair))
    white = material('EyeWhite', (.92, .9, .87), .2); iris = material('Iris', (.12, .08, .05), .1)
    for s in (1, -1):
        at = V((s * hh * .16, -hh * .38, chin + hh * .5))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=hh * .052, location=at + V((0, hh * .02, 0)), segments=16, ring_count=10)
        e = bpy.context.active_object; e.name = 'Eye' + ('.L' if s > 0 else '.R'); e.data.materials.append(white)
        bpy.ops.mesh.primitive_cylinder_add(radius=hh * .024, depth=.002, location=at + V((0, -hh * .03, 0)), rotation=(math.pi / 2, 0, 0), vertices=12)
        i = bpy.context.active_object; i.data.materials.append(iris)
        bpy.ops.object.select_all(action='DESELECT'); e.select_set(True); i.select_set(True); bpy.context.view_layer.objects.active = e
        bpy.ops.object.join(); bpy.ops.object.shade_smooth(); out.append(e)
    return out


def bind(skel, objs, auto=True, head_only=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    skel.select_set(True); bpy.context.view_layer.objects.active = skel
    if head_only:
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        for o in objs:
            g = o.vertex_groups.get('Head') or o.vertex_groups.new(name='Head')
            g.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    else:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO' if auto else 'ARMATURE_NAME')


def transfer_weights(src, dst):
    bpy.ops.object.select_all(action='DESELECT')
    dt = dst.modifiers.new('weights', 'DATA_TRANSFER'); dt.object = src
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = dst; dst.select_set(True)
    bpy.ops.object.datalayout_transfer(modifier='weights')
    bpy.ops.object.modifier_apply(modifier='weights')


def build(name):
    sex, age, H, muscle, fat, head_k = VARIANTS[name]
    clear()
    L = landmarks(sex, age, H, head_k)
    skel = build_armature(L)
    F = body_field(L, sex, age, muscle, fat)
    print(f'{name}: {F.count["bone"]} bone, {F.count["muscle"]} muscle and {F.count["fat"]} fat elements', flush=True)
    skin = to_mesh(F.ob, 'Skin', target_tris=12000)
    skin.data.materials.append(material('Skin', (.8, .62, .5), .5, .15))
    k = L['k']; sw = L['shoulder_w']
    def on_arm(p): return abs(p.x) > sw * .92 and p.z < L['shoulder'] + .02
    def arm_dist(p):
        sh = arm_points(L, 1 if p.x > 0 else -1)[0]
        return (p - sh).length
    def torso(p): return abs(p.x) <= sw * .98 and not on_arm(p)
    shirt = shell(skin, 'Shirt', lambda p: (torso(p) and L['hip'] + .08 * k < p.z < L['neck_base'] - .005) or (on_arm(p) and arm_dist(p) < L['upper'] * .75), .008, material('Shirt', (.8, .8, .78), .85))
    pants = shell(skin, 'Pants', lambda p: torso(p) and L['ankle'] + .05 * k < p.z < L['waist'] - .01, .007, material('Pants', (.3, .32, .36), .9))
    shoes = shell(skin, 'Shoes', lambda p: p.z < L['ankle'] + .03 * k, .006, material('Shoes', (.18, .13, .1), .7))
    garments = [shirt, pants, shoes]
    if sex == 1:
        # a skirt: a flared tube from the waist to below the knee
        bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=.27 * k, radius2=.15 * k, depth=(L['waist'] - L['knee'] + .08 * k), location=(0, .0, (L['waist'] + L['knee'] - .08 * k) / 2), end_fill_type='NOTHING')
        sk = bpy.context.active_object; sk.name = 'Skirt'; sk.data.materials.append(material('Skirt', (.6, .3, .3), .85))
        sm = sk.modifiers.new('sub', 'SUBSURF'); sm.levels = 1
        so = sk.modifiers.new('solid', 'SOLIDIFY'); so.thickness = .006
        for mname in ('sub', 'solid'): bpy.ops.object.modifier_apply(modifier=mname)
        bpy.ops.object.shade_smooth(); garments.append(sk)
    extras = hair_and_eyes(L, sex, age)
    bind(skel, [skin])
    for g in garments:
        bpy.ops.object.select_all(action='DESELECT'); g.select_set(True); skel.select_set(True); bpy.context.view_layer.objects.active = skel
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        transfer_weights(skin, g)
    bind(skel, extras, head_only=True)
    if RENDER: render(name)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_skins=True, export_animations=False, export_apply=True, export_materials='EXPORT')
    print('wrote', path, flush=True)


def render(name):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'; scn.display.shading.light = 'STUDIO'; scn.display.shading.color_type = 'MATERIAL'
    scn.display.shading.show_cavity = True
    scn.render.resolution_x, scn.render.resolution_y = 900, 900
    world = bpy.data.worlds.new('w'); scn.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    cam.data.type = 'ORTHO'
    H = VARIANTS[name][2]; cam.data.ortho_scale = H * 1.12
    for o in bpy.data.objects:
        if o.name.startswith(('Hair_Long', 'Hair_Bun', 'Hair_Ponytail', 'Skirt')): o.hide_render = True
    for tag, loc, rot in (('front', (0, -4, H / 2), (math.pi / 2, 0, 0)), ('side', (4, 0, H / 2), (math.pi / 2, 0, math.pi / 2)), ('back', (0, 4, H / 2), (math.pi / 2, 0, math.pi))):
        cam.location = loc; cam.rotation_euler = rot
        scn.render.filepath = os.path.join(OUT, 'renders', f'{name}_{tag}.png')
        bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        if o.name.startswith(('Shirt', 'Pants', 'Shoes', 'Skirt', 'Hair', 'Beard')): o.hide_render = True
    cam.location = (0, -4, H / 2); cam.rotation_euler = (math.pi / 2, 0, 0)
    scn.render.filepath = os.path.join(OUT, 'renders', f'{name}_skin.png'); bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects: o.hide_render = False


if __name__ == "__main__": os.makedirs(os.path.join(OUT, "renders"), exist_ok=True)
if __name__ == "__main__":
  for n in (WANT or VARIANTS):
    build(n)
