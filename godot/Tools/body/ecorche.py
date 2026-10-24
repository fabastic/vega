"""The écorché: bones and individual muscles as meshes, each muscle running from its origin to its insertion.

Every muscle is lofted along a path from origin to insertion with an elliptical cross-section: thin tendon at
each end, full belly in the middle. Fan-shaped muscles (pectoralis, deltoid, trapezius, latissimus, gluteus,
obliques) are built from several fibre bundles laid side by side, which also gives them their striation.
The skin is then wrapped over the union of muscle and bone (see skin_over in build_bodies.py).
"""
import math
import bpy
import bmesh
from mathutils import Vector as V

MUSCLE = (.62, .16, .14)
TENDON = (.86, .78, .72)
BONE = (.88, .84, .74)


def lerp(a, b, t): return a + (b - a) * t


def catmull(pts, u):
    """A smooth path through the control points."""
    if len(pts) == 2: return lerp(pts[0], pts[1], u)
    n = len(pts) - 1; seg = min(int(u * n), n - 1); t = u * n - seg
    p0 = pts[max(seg - 1, 0)]; p1 = pts[seg]; p2 = pts[seg + 1]; p3 = pts[min(seg + 2, n)]
    t2, t3 = t * t, t * t * t
    return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


class Builder:
    def __init__(self):
        self.objects = []
        self.mat = {}

    def material(self, name, color):
        if name in self.mat: return self.mat[name]
        m = bpy.data.materials.new(name); m.use_nodes = True
        nt = m.node_tree; p = nt.nodes['Principled BSDF']
        attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        nt.links.new(attr.outputs['Color'], p.inputs['Base Color'])
        p.inputs['Roughness'].default_value = .45
        m.diffuse_color = (*color, 1)
        self.mat[name] = m; return m

    def loft(self, name, pts, width, thick, out, belly=1.0, sides=12, steps=22, tendon=(.1, .1), color=MUSCLE, flat=1.0):
        """width and thick: (end, belly) half-sizes. out: the direction the muscle's outer face points."""
        bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
        rings = []
        for i in range(steps + 1):
            u = i / steps
            p = catmull(pts, u)
            tng = (catmull(pts, min(1, u + .01)) - catmull(pts, max(0, u - .01))).normalized()
            n = (out - tng * out.dot(tng)).normalized()
            b = tng.cross(n).normalized()
            prof = math.sin(math.pi * u) ** .75
            # tendons: the ends taper to a narrow cord
            te = min(1, u / tendon[0]) if u < tendon[0] else min(1, (1 - u) / tendon[1]) if u > 1 - tendon[1] else 1
            w = lerp(width[0], width[1], prof) * (.45 + .55 * te)
            t = lerp(thick[0], thick[1], prof * belly) * (.5 + .5 * te)
            ring = []
            for j in range(sides):
                a = 2 * math.pi * j / sides
                ca, sa = math.cos(a), math.sin(a)
                # the inner face is flatter than the outer, as a muscle lies on what is beneath it
                tt = t if sa > 0 else t * .45 * flat
                ring.append((bm.verts.new(p + b * ca * w + n * (sa * tt + t * .2)), te))
            rings.append(ring)
        for i in range(steps):
            for j in range(sides):
                a, b_, c, d = rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]
                f = bm.faces.new((a[0], b_[0], c[0], d[0]))
                for loop, (_, te) in zip(f.loops, (a, b_, c, d)):
                    cc = color if color != MUSCLE else tuple(lerp(TENDON[k], MUSCLE[k], te ** 2) for k in range(3))
                    loop[col] = (*cc, 1)
        for ring in (rings[0], rings[-1]):
            f = bm.faces.new([v for v, _ in ring])
            for loop in f.loops: loop[col] = (*(TENDON if color == MUSCLE else color), 1)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.normal_update()
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        me.color_attributes.active_color = me.color_attributes['Col']; me.color_attributes.render_color_index = 0
        for poly in me.polygons: poly.use_smooth = True
        ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
        me.materials.append(self.material('Bone' if color == BONE else 'Muscle', color))
        ob['layer'] = 'bone' if color == BONE else 'muscle'
        self.objects.append(ob)
        return ob

    def fan(self, name, origin, insertion, n, width, thick, out, bulge=V(), **kw):
        """A fan-shaped muscle: n bundles from points along the origin line to points along the insertion line."""
        for i in range(n):
            u = i / max(1, n - 1)
            o = catmull(origin, u); ins = catmull(insertion, u)
            mid = lerp(o, ins, .5) + bulge * math.sin(math.pi * (.3 + .4 * u))
            self.loft(f'{name}_{i}', [o, mid, ins], (width[0] * 1.5, width[1] * 1.7), thick, out, **kw)

    def ellipsoid(self, name, at, half, color=BONE, rot=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, location=at)
        ob = bpy.context.active_object; ob.name = name; ob.scale = half
        if rot: ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        me = ob.data; cl = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        for d in cl.data: d.color = (*color, 1)
        me.color_attributes.active_color = cl
        me.materials.append(self.material('Bone' if color == BONE else 'Muscle', color))
        bpy.ops.object.shade_smooth()
        ob['layer'] = 'bone' if color == BONE else 'muscle'
        self.objects.append(ob); return ob


def build(L, sex, age, muscle, arm_points, leg_points):
    """Bones and muscles for one body. Returns the objects."""
    B = Builder()
    k = L['k']; f = sex == 1; child = age == 'child'
    m = (.75 + .6 * muscle) * (.85 if f else 1) * (.8 if child else 1)   # muscle bulk
    sw = L['shoulder_w']; hh = L['head_h']; chin = L['chin']
    X = lambda x, y, z: V((x * k, y * k, z))
    nb, sh_z, ch, wa, hp_z = L['neck_base'], L['shoulder'], L['chest'], L['waist'], L['hip']

    # ---------- bones that shape the surface ----------
    B.ellipsoid('Skull', V((0, .012 * k, chin + hh * .6)), (hh * .37, hh * .46, hh * .45))
    B.ellipsoid('Jaw', V((0, -.03 * k, chin + hh * .22)), (hh * .28, hh * .3, hh * .2))
    B.ellipsoid('Ribcage', V((0, .0, lerp(wa, sh_z, .55))), ((.115 if f else .128) * k, (.082 if f else .09) * k, .155 * k))
    B.ellipsoid('Pelvis', V((0, .0, hp_z + .05 * k)), ((.15 if f else .132) * k, .085 * k, .075 * k))
    B.loft('Spine', [X(0, .05, 0) + V((0, 0, hp_z)), X(0, .085, 0) + V((0, 0, wa)), X(0, .075, 0) + V((0, 0, ch)), X(0, .04, 0) + V((0, 0, nb + .05 * k))], (.02 * k, .025 * k), (.02 * k, .025 * k), V((0, 1, 0)), color=BONE)
    for s in (1, -1):
        sh, el, wr, hd = arm_points(L, s); hp, kn, an, toe = leg_points(L, s)
        B.loft(f'Clavicle_{s}', [X(s * .02, -.06, 0) + V((0, 0, nb - .02 * k)), X(s * .1, -.05, 0) + V((0, 0, nb)), V((s * sw * .95, -.015 * k, sh_z + .025 * k))], (.009 * k, .011 * k), (.009 * k, .011 * k), V((0, -1, .3)), color=BONE)
        B.ellipsoid(f'Scapula_{s}', X(s * .085, .085, 0) + V((0, 0, ch + .02 * k)), (.055 * k, .015 * k, .075 * k))
        B.loft(f'Humerus_{s}', [sh, el], (.017 * k, .02 * k), (.017 * k, .02 * k), V((0, -1, 0)), color=BONE)
        B.loft(f'Ulna_{s}', [el, wr], (.014 * k, .016 * k), (.012 * k, .014 * k), V((0, -1, 0)), color=BONE)
        B.loft(f'Femur_{s}', [hp, kn], (.022 * k, .026 * k), (.022 * k, .026 * k), V((0, -1, 0)), color=BONE)
        B.loft(f'Tibia_{s}', [kn, an], (.02 * k, .022 * k), (.02 * k, .022 * k), V((0, -1, 0)), color=BONE)
        B.ellipsoid(f'Patella_{s}', kn + X(0, -.035, 0), (.022 * k, .012 * k, .028 * k))
        B.ellipsoid(f'Knee_{s}', kn + X(0, -.005, 0), (.045 * k, .045 * k, .04 * k))
        B.ellipsoid(f'Elbow_{s}', el, (.028 * k, .028 * k, .028 * k))
        B.ellipsoid(f'Ankle_{s}', an, (.03 * k, .034 * k, .03 * k))

    # ---------- muscles ----------
    J = X(0, -.065, 0) + V((0, 0, nb - .015 * k))        # top of the sternum
    XP = X(0, -.095, 0) + V((0, 0, ch - .1 * k))         # bottom of the sternum
    C7 = X(0, .075, 0) + V((0, 0, nb + .01 * k))
    T12 = X(0, .1, 0) + V((0, 0, wa + .06 * k))
    SAC = X(0, .095, 0) + V((0, 0, hp_z + .03 * k))
    OCC = V((0, .07 * k, chin + hh * .45))
    PUB = X(0, -.085, 0) + V((0, 0, hp_z + .02 * k))
    # neck
    for s in (1, -1):
        mast = V((s * .045 * k, .015 * k, chin + hh * .38))
        B.loft(f'Sternocleidomastoid_{s}', [mast, lerp(mast, J + X(s * .015, 0, 0), .5) + X(0, -.02, 0), J + X(s * .015, 0, 0)], (.008 * k, .016 * k * m), (.006 * k, .012 * k * m), V((s, -1, 0)))
        B.loft(f'Splenius_{s}', [OCC + X(s * .025, 0, 0), C7 + X(s * .03, -.02, 0)], (.015 * k, .025 * k), (.01 * k, .016 * k), V((0, 1, 0)))
    B.loft('NeckCore', [V((0, .0, nb - .03 * k)), V((0, .0, chin + hh * .3))], (.042 * k, .045 * k), (.038 * k, .042 * k), V((0, -1, 0)), color=MUSCLE, tendon=(.01, .01))
    for s in (1, -1):
        sh, el, wr, hd = arm_points(L, s); hp, kn, an, toe = leg_points(L, s)
        ax = (el - sh).normalized(); out_s = V((s, 0, 0))
        AC = V((s * sw * .95, -.01 * k, sh_z + .03 * k))                       # acromion
        DT = sh + ax * .14 * k                                                     # deltoid tuberosity
        # trapezius: from the skull and the spine to the clavicle, acromion and scapular spine
        B.fan(f'Trapezius_{s}', [OCC + X(s * .01, 0, 0), C7, T12 + X(0, -.005, 0)], [AC + X(-s * .07, .0, -.005), AC + X(-s * .02, .03, 0), X(s * .06, .1, 0) + V((0, 0, ch + .045 * k))], 7,
              (.012 * k, .022 * k), (.004 * k, .009 * k * m), V((0, 1, .5)), bulge=X(s * .01, .015, 0), tendon=(.15, .1))
        # deltoid: three heads around the shoulder to the tuberosity
        B.fan(f'Deltoid_{s}', [AC + X(-s * .05, -.035, -.005), AC + X(0, -.01, .015), AC + X(-s * .015, .04, 0)], [DT + X(0, -.012, 0), DT, DT + X(0, .012, 0)], 6,
              (.012 * k, .02 * k * m), (.008 * k, .02 * k * m), out_s + V((0, 0, .6)), bulge=out_s * .035 * k + V((0, 0, .015 * k)), tendon=(.06, .25))
        # pectoralis major: clavicle, sternum and ribs to the humerus
        ins = sh + ax * .07 * k + X(0, -.025, 0)
        B.fan(f'Pectoralis_{s}', [X(s * .09, -.055, 0) + V((0, 0, nb - .015 * k)), J + X(s * .012, -.01, 0), XP + X(s * .012, 0, 0), X(s * .06, -.09, 0) + V((0, 0, ch - .12 * k))], [ins + X(0, -.004, .012), ins, ins + X(0, .005, -.012)], 8,
              (.014 * k, .02 * k), (.006 * k, .017 * k * m), V((0, -1, 0)), bulge=X(s * .01, -.03 * m, -.01), tendon=(.04, .22))
        # serratus anterior: fingers on the ribs below the armpit
        for i in range(4):
            z = ch - (.03 + i * .035) * k
            B.loft(f'Serratus_{s}_{i}', [X(s * .1, -.07, 0) + V((0, 0, z - .02 * k)), X(s * .13, .0, 0) + V((0, 0, z + .01 * k)), X(s * .1, .07, 0) + V((0, 0, z + .03 * k))], (.006 * k, .012 * k), (.003 * k, .007 * k * m), V((s, -.3, 0)), tendon=(.2, .3))
        # latissimus dorsi: from the lower back and pelvis up to the humerus, wrapping the side of the ribs
        B.fan(f'Latissimus_{s}', [X(s * .01, .095, 0) + V((0, 0, ch - .04 * k)), T12 + X(s * .01, 0, 0), SAC + X(s * .05, 0, .02), X(s * .13, .02, 0) + V((0, 0, hp_z + .1 * k))], [sh + ax * .06 * k + X(0, .018, 0), sh + ax * .07 * k + X(0, .01, 0)], 7,
              (.016 * k, .025 * k), (.004 * k, .012 * k * m), V((s * .6, 1, 0)), bulge=X(s * .06, .03, .0), tendon=(.25, .12))
        # external oblique: lower ribs to the pelvis and the midline
        B.fan(f'Oblique_{s}', [X(s * .115, -.05, 0) + V((0, 0, ch - .12 * k)), X(s * .135, .02, 0) + V((0, 0, wa + .02 * k))], [X(s * .06, -.085, 0) + V((0, 0, wa - .04 * k)), X(s * .125, -.035, 0) + V((0, 0, hp_z + .09 * k))], 5,
              (.012 * k, .018 * k), (.005 * k, .012 * k * m), V((s, -.6, 0)), tendon=(.12, .25))
        # erector spinae
        B.loft(f'Erector_{s}', [SAC + X(s * .03, 0, 0), T12 + X(s * .035, .0, 0), C7 + X(s * .025, -.005, -.04)], (.012 * k, .022 * k * m), (.01 * k, .02 * k * m), V((0, 1, 0)), tendon=(.1, .3))
        # rectus abdominis: four segments each side, divided by tendinous bands
        top = X(s * .045, -.095, 0) + V((0, 0, ch - .1 * k)); bot = PUB + X(s * .02, 0, 0)
        for i in range(4):
            a = lerp(top, bot, i / 4 + .015); b = lerp(top, bot, (i + 1) / 4 - .015)
            B.loft(f'Rectus_{s}_{i}', [a, b], (.025 * k, .03 * k * (1 if i < 3 else .8)), (.006 * k, .012 * k * m), V((0, -1, 0)), tendon=(.08, .08))
        # upper arm
        B.loft(f'Biceps_{s}', [sh + ax * .03 * k + X(0, -.02, 0), sh + ax * .16 * k + X(0, -.032 * m, 0), el + X(0, -.022, 0)], (.012 * k, .026 * k * m), (.01 * k, .024 * k * m), V((0, -1, 0)), tendon=(.25, .15))
        B.loft(f'Brachialis_{s}', [sh + ax * .14 * k, el + X(0, -.01, 0)], (.014 * k, .02 * k), (.008 * k, .014 * k), out_s, tendon=(.1, .15))
        for i, (o, w) in enumerate(((X(0, .022, 0), .02), (X(s * .015, .018, 0), .018), (X(-s * .012, .015, 0), .016))):
            B.loft(f'Triceps_{s}_{i}', [sh + ax * (.04 + i * .02) * k + o, sh + ax * .15 * k + o + X(0, .012 * m, 0), el + X(0, .02, 0)], (.01 * k, w * k * m), (.008 * k, .02 * k * m), V((0, 1, 0)) + out_s * .3, tendon=(.15, .3))
        # forearm
        fax = (wr - el).normalized()
        B.loft(f'Brachioradialis_{s}', [sh + ax * .2 * k + out_s * .015, el + out_s * .03 * k + fax * .05 * k, wr + out_s * .012 * k], (.008 * k, .02 * k * m), (.008 * k, .016 * k * m), out_s + V((0, -.5, 0)), tendon=(.1, .45))
        for i, yo in enumerate((-.02, -.008)):
            B.loft(f'Flexor_{s}_{i}', [el + X(-s * .02, yo, 0), el + fax * .08 * k + X(-s * .015, yo - .006, 0), wr + X(-s * .006, yo * .5, 0)], (.008 * k, .015 * k * m), (.007 * k, .013 * k * m), V((-s, -.4, 0)), tendon=(.08, .5))
        for i, yo in enumerate((.012, .022)):
            B.loft(f'Extensor_{s}_{i}', [el + X(s * .012, yo, 0), el + fax * .08 * k + X(s * .01, yo + .004, 0), wr + X(s * .004, yo * .5, 0)], (.007 * k, .013 * k * m), (.006 * k, .011 * k * m), V((s * .4, 1, 0)), tendon=(.08, .5))
        # the hand
        hax = (hd - wr).normalized()
        B.loft(f'Palm_{s}', [wr + hax * .01 * k, wr + hax * .09 * k], (.03 * k, .04 * k), (.012 * k, .014 * k), out_s, color=(.72, .5, .42), tendon=(.01, .01))
        for i in range(4):
            off = X(0, (i - 1.5) * .019, 0); ln = .085 - abs(i - 1.5) * .012
            B.loft(f'Finger_{s}_{i}', [wr + hax * .09 * k + off, wr + hax * (.09 + ln) * k + off], (.0085 * k, .009 * k), (.0085 * k, .009 * k), out_s, color=(.72, .5, .42), tendon=(.01, .2))
        B.loft(f'Thumb_{s}', [wr + hax * .025 * k + X(0, -.025, 0), wr + hax * .085 * k + X(0, -.055, 0)], (.01 * k, .011 * k), (.009 * k, .01 * k), out_s, color=(.72, .5, .42), tendon=(.01, .2))
        # hip and thigh
        lax = (kn - hp).normalized(); GT = hp + out_s * .07 * k + lax * .06 * k   # greater trochanter
        B.fan(f'GluteusMax_{s}', [X(s * .1, .07, 0) + V((0, 0, hp_z + .12 * k)), SAC + X(s * .01, 0, 0), SAC + X(s * .01, -.01, -.07)], [GT + X(0, .02, -.02), hp + lax * .2 * k + out_s * .045 * k + X(0, .02, 0)], 6,
              (.018 * k, .026 * k), (.012 * k, .03 * k * m), V((0, 1, 0)), bulge=X(0, .045 * m, 0), tendon=(.08, .2))
        B.fan(f'GluteusMed_{s}', [X(s * .14, .0, 0) + V((0, 0, hp_z + .11 * k)), X(s * .12, .06, 0) + V((0, 0, hp_z + .12 * k))], [GT, GT + X(0, .01, 0)], 3,
              (.014 * k, .02 * k), (.008 * k, .016 * k * m), out_s, tendon=(.1, .25))
        ASIS = X(s * .12, -.06, 0) + V((0, 0, hp_z + .08 * k))
        B.loft(f'TensorFascia_{s}', [ASIS, GT + X(0, -.02, -.04)], (.012 * k, .02 * k), (.008 * k, .014 * k * m), out_s + V((0, -.5, 0)), tendon=(.1, .3))
        B.loft(f'IliotibialBand_{s}', [GT + X(0, -.01, -.04), kn + out_s * .045 * k], (.012 * k, .014 * k), (.003 * k, .004 * k), out_s, color=TENDON)
        B.loft(f'RectusFemoris_{s}', [ASIS + X(-s * .01, .0, -.02), lerp(hp, kn, .45) + X(0, -.06 * m, 0), kn + X(0, -.045, .04)], (.012 * k, .028 * k * m), (.012 * k, .026 * k * m), V((0, -1, 0)), tendon=(.12, .2))
        B.loft(f'VastusLateralis_{s}', [GT + X(0, -.01, -.02), lerp(hp, kn, .55) + out_s * .055 * k * m + X(0, -.025, 0), kn + out_s * .02 * k + X(0, -.035, .05)], (.016 * k, .03 * k * m), (.012 * k, .026 * k * m), out_s + V((0, -.7, 0)), tendon=(.08, .25))
        B.loft(f'VastusMedialis_{s}', [lerp(hp, kn, .4) - out_s * .035 * k + X(0, -.02, 0), kn - out_s * .035 * k + X(0, -.03, .07), kn - out_s * .012 * k + X(0, -.04, .03)], (.014 * k, .026 * k * m), (.012 * k, .024 * k * m), -out_s + V((0, -1, 0)), tendon=(.2, .25))
        B.loft(f'Sartorius_{s}', [ASIS, lerp(hp, kn, .5) - out_s * .03 * k + X(0, -.04, 0), kn - out_s * .045 * k + X(0, .0, -.02)], (.008 * k, .011 * k), (.004 * k, .007 * k), V((-s * .3, -1, 0)), tendon=(.08, .15))
        B.loft(f'Adductors_{s}', [PUB + X(s * .025, .02, 0), lerp(hp, kn, .55) - out_s * .04 * k + X(0, .01, 0)], (.018 * k, .034 * k * m), (.015 * k, .028 * k * m), -out_s, tendon=(.15, .25))
        B.loft(f'BicepsFemoris_{s}', [hp + X(-s * .01, .055, -.03), lerp(hp, kn, .55) + out_s * .02 * k + X(0, .05 * m, 0), kn + out_s * .035 * k + X(0, .03, -.03)], (.012 * k, .024 * k * m), (.012 * k, .024 * k * m), V((s * .4, 1, 0)), tendon=(.1, .3))
        B.loft(f'Semitendinosus_{s}', [hp + X(-s * .025, .055, -.03), lerp(hp, kn, .55) - out_s * .02 * k + X(0, .05 * m, 0), kn - out_s * .035 * k + X(0, .02, -.04)], (.012 * k, .022 * k * m), (.012 * k, .022 * k * m), V((-s * .4, 1, 0)), tendon=(.1, .35))
        # lower leg
        sax = (an - kn).normalized()
        for i, side in enumerate((1, -1)):
            B.loft(f'Gastrocnemius_{s}_{i}', [kn + out_s * side * s * .025 * k + X(0, .03, .02), kn + sax * .13 * k + out_s * side * s * .022 * k + X(0, .055 * m, 0), an + sax * -.12 * k + X(0, .035, 0)], (.01 * k, .022 * k * m), (.01 * k, .022 * k * m), V((side * s * .4, 1, 0)), tendon=(.06, .4))
        B.loft(f'Soleus_{s}', [kn + sax * .1 * k + X(0, .03, 0), an + X(0, .035, .04)], (.022 * k, .03 * k * m), (.01 * k, .018 * k * m), V((0, 1, 0)), tendon=(.1, .35))
        B.loft(f'TibialisAnterior_{s}', [kn + out_s * .02 * k + X(0, -.025, -.03), an + X(0, -.03, .03)], (.01 * k, .018 * k * m), (.008 * k, .015 * k * m), V((s * .3, -1, 0)), tendon=(.06, .4))
        B.loft(f'Peroneus_{s}', [kn + out_s * .04 * k + X(0, .0, -.04), an + out_s * .03 * k + X(0, .01, 0)], (.008 * k, .014 * k), (.006 * k, .01 * k), out_s, tendon=(.1, .4))
        # the foot
        B.loft(f'Foot_{s}', [an + X(0, .045, -.045), lerp(an, toe, .5) + X(0, 0, -.03), toe + X(0, .0, -.005)], (.025 * k, .04 * k), (.02 * k, .025 * k), V((0, 0, 1)), color=(.72, .5, .42), tendon=(.01, .01))
        # face: chewing and brow muscles, ears
        B.loft(f'Masseter_{s}', [V((s * hh * .26, -hh * .1, chin + hh * .45)), V((s * hh * .24, -hh * .12, chin + hh * .1))], (.008 * k, .014 * k), (.004 * k, .008 * k), V((s, -.3, 0)), tendon=(.1, .1))
        B.loft(f'Temporalis_{s}', [V((s * hh * .3, .0, chin + hh * .85)), V((s * hh * .33, -hh * .1, chin + hh * .55))], (.015 * k, .025 * k), (.003 * k, .006 * k), V((s, 0, 0)), tendon=(.05, .15))
        B.ellipsoid(f'Ear_{s}', V((s * hh * .38, .005 * k, chin + hh * .52)), (hh * .04, hh * .1, hh * .14), color=(.72, .5, .42))
        B.ellipsoid(f'Cheek_{s}', V((s * hh * .2, -hh * .3, chin + hh * .42)), (hh * .1, hh * .08, hh * .08), color=MUSCLE)
        B.ellipsoid(f'Brow_{s}', V((s * hh * .15, -hh * .4, chin + hh * .64)), (hh * .14, hh * .06, hh * .045), color=MUSCLE)
    B.ellipsoid('Nose', V((0, -hh * .47, chin + hh * .43)), (hh * .07, hh * .1, hh * .16), color=(.72, .5, .42))
    B.ellipsoid('Lips', V((0, -hh * .4, chin + hh * .23)), (hh * .14, hh * .07, hh * .055), color=MUSCLE)
    B.ellipsoid('Chin', V((0, -hh * .34, chin + hh * .07)), (hh * .12, hh * .08, hh * .08), color=MUSCLE)
    return B.objects
