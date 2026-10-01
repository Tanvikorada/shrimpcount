# ShrimpCount landing journey, as one continuous 3D film rendered in Blender (EEVEE).
#
#   blender -b -y --factory-startup -P build.py -- [--test 1,200,400] [--save out.blend] [--out DIR] [--res 1600x900]
#
# One camera move: in from the sea over a seaside hatchery, down to an open shed door, along the raceway tanks
# (built after real hatchery photos: grey concrete rims, green shade net, tube lights, white walls with mildew),
# down through the water among glassy post-larvae that grow into prawns, into the green murk, up through the
# surface of a grow-out pond and away over the pond farm with its paddle-wheel aerators.
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, noise as mnoise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = arg("--tex", HERE)
R = random.Random(11)
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
COL = sc.collection
FPS = 24

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def rgba(h): return (*srgb(h), 1.0)

# ---------------------------------------------------------------- mesh helpers
class MB:
    """mesh builder: parts with material slots"""
    def __init__(s): s.v, s.f, s.mi, s.uv = [], [], [], []
    def add(s, verts, faces, mi=0, uvs=None):
        o = len(s.v); s.v += [tuple(v) for v in verts]
        for i, f in enumerate(faces):
            s.f.append(tuple(o + k for k in f)); s.mi.append(mi)
            s.uv.append(uvs[i] if uvs else None)
    def mesh(s, name, mats=(), smooth=True):
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f); me.update()
        for m in mats: me.materials.append(m)
        for p, mi in zip(me.polygons, s.mi): p.material_index = mi
        if any(s.uv):
            ul = me.uv_layers.new(name="UV"); k = 0
            for p, uv in zip(me.polygons, s.uv):
                for j, li in enumerate(p.loop_indices): ul.data[li].uv = uv[j] if uv else (0, 0)
        if smooth: me.shade_smooth()
        return me

def obj(name, me, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = rot; o.scale = scale
    COL.objects.link(o); return o

def inst(src, loc, rot=(0, 0, 0), scale=(1, 1, 1)):
    o = src.copy(); o.location = loc; o.rotation_euler = rot; o.scale = scale
    if o.animation_data: o.animation_data_clear()
    COL.objects.link(o); return o

def box_v(sx, sy, sz, c=(0, 0, 0)):
    a, b, h = sx / 2, sy / 2, sz / 2; x, y, z = c
    v = [(x - a, y - b, z - h), (x + a, y - b, z - h), (x + a, y + b, z - h), (x - a, y + b, z - h),
         (x - a, y - b, z + h), (x + a, y - b, z + h), (x + a, y + b, z + h), (x - a, y + b, z + h)]
    return v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]

def box(name, c, s, mat, rot=(0, 0, 0)):
    b = MB(); b.add(*box_v(*s)); return obj(name, b.mesh(name, [mat], smooth=False), c, rot)

def tube(path, radii, sides=12, cap=True):
    """rings around a 3D path; radii = [(r_side, r_up)]"""
    verts, faces = [], []
    n = len(path)
    for i in range(n):
        T = (path[min(n - 1, i + 1)] - path[max(0, i - 1)]).normalized()
        ref = Vector((0, 0, 1)) if abs(T.z) < 0.9 else Vector((0, 1, 0))
        B = T.cross(ref).normalized(); Nn = B.cross(T).normalized()
        ry, rz = radii[i]
        for k in range(sides):
            a = 2 * math.pi * k / sides
            verts.append(path[i] + B * math.cos(a) * ry + Nn * math.sin(a) * rz)
    for i in range(n - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if cap:
        verts.append(path[0]); verts.append(path[-1]); c0, c1 = len(verts) - 2, len(verts) - 1
        for k in range(sides):
            faces.append((c0, (k + 1) % sides, k))
            faces.append((c1, (n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides))
    return verts, faces

def sphere_v(r, c=(0, 0, 0), seg=10, ring=7, sx=1, sy=1, sz=1):
    verts, faces = [], []; c = Vector(c)
    for i in range(1, ring):
        th = math.pi * i / ring
        for k in range(seg):
            ph = 2 * math.pi * k / seg
            verts.append(c + Vector((math.sin(th) * math.cos(ph) * r * sx, math.sin(th) * math.sin(ph) * r * sy, math.cos(th) * r * sz)))
    verts.append(c + Vector((0, 0, r * sz))); verts.append(c + Vector((0, 0, -r * sz))); top, bot = len(verts) - 2, len(verts) - 1
    for i in range(ring - 2):
        for k in range(seg):
            a, b = i * seg + k, i * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    for k in range(seg):
        faces.append((top, (k + 1) % seg, k)); o = (ring - 2) * seg
        faces.append((bot, o + k, o + (k + 1) % seg))
    return verts, faces

# ---------------------------------------------------------------- material helpers
def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes["Principled BSDF"]
def N(m, t, **kw):
    n = m.node_tree.nodes.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def L(m, a, b): m.node_tree.links.new(a, b)
def setin(n, **kw):
    for k, v in kw.items(): n.inputs[k.replace("_", " ")].default_value = v
def world_pos(m):
    g = N(m, "ShaderNodeNewGeometry"); s = N(m, "ShaderNodeSeparateXYZ"); L(m, g.outputs["Position"], s.inputs[0]); return g, s
def noise(m, scale, detail=6, rough=0.55, vec=None, dims="3D"):
    t = N(m, "ShaderNodeTexNoise", noise_dimensions=dims); setin(t, Scale=scale, Detail=detail, Roughness=rough)
    if vec is not None: L(m, vec, t.inputs["Vector"])
    return t
def ramp(m, stops, fac=None):
    r = N(m, "ShaderNodeValToRGB"); e = r.color_ramp.elements
    e[0].position, e[0].color = stops[0][0], (*stops[0][1], 1); e[1].position, e[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: x = e.new(p); x.color = (*c, 1)
    if fac is not None: L(m, fac, r.inputs["Fac"])
    return r
def math_n(m, op, a=None, b=None, va=0.0, vb=0.0, clamp=False):
    n = N(m, "ShaderNodeMath", operation=op, use_clamp=clamp); n.inputs[0].default_value = va; n.inputs[1].default_value = vb
    if a is not None: L(m, a, n.inputs[0])
    if b is not None: L(m, b, n.inputs[1])
    return n
def mix_rgb(m, fac, a, b, blend="MIX"):
    n = N(m, "ShaderNodeMix", data_type="RGBA", blend_type=blend)
    L(m, fac, n.inputs["Factor"]) if not isinstance(fac, float) else setattr(n.inputs["Factor"], "default_value", fac)
    for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, tuple): sock.default_value = v if len(v) == 4 else (*v, 1)
        else: L(m, v, sock)
    return n
def bump(m, height, strength=0.3, dist=0.05, bsdf=None):
    b = N(m, "ShaderNodeBump"); setin(b, Strength=strength, Distance=dist); L(m, height, b.inputs["Height"])
    if bsdf: L(m, b.outputs["Normal"], bsdf.inputs["Normal"])
    return b
def mapping(m, scale=(1, 1, 1), vec=None):
    mp = N(m, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    if vec is not None: L(m, vec, mp.inputs["Vector"])
    return mp
def drive(sock, expr):
    d = sock.driver_add("default_value").driver; d.type = "SCRIPTED"; d.expression = expr
def blended(m, refract=False):
    for k, v in (("surface_render_method", "BLENDED"), ("use_transparency_overlap", True)):
        try: setattr(m, k, v)
        except Exception: pass
    if refract:
        try: m.use_raytrace_refraction = True
        except Exception: pass
def dithered(m):
    try: m.surface_render_method = "DITHERED"
    except Exception: pass

M = {}
def simple(name, hexc, rough=0.5, metal=0.0):
    m, b = new_mat(name); setin(b, Base_Color=rgba(hexc), Roughness=rough, Metallic=metal); M[name] = m; return m

# painted block walls, dirty toward the ground
m, b = new_mat("wall"); g, s = world_pos(m)
nz = noise(m, 2.5, 8); r0 = ramp(m, [(0.3, srgb("#e9e7df")), (0.7, srgb("#d4d2c8"))], nz.outputs["Fac"])
dirt = math_n(m, "SUBTRACT", None, s.outputs["Z"], va=1.4); dirt = math_n(m, "MULTIPLY", dirt.outputs[0], None, vb=0.8, clamp=True)
st = noise(m, 1, 8, vec=mapping(m, (6, 6, 0.5), g.outputs["Position"]).outputs[0])
dm = math_n(m, "MULTIPLY", dirt.outputs[0], st.outputs["Fac"], clamp=True); dm = math_n(m, "MULTIPLY", dm.outputs[0], None, vb=1.6, clamp=True)
c_ = mix_rgb(m, dm.outputs[0], r0.outputs["Color"], rgba("#8a7d62"))
pl_ = math_n(m, "LESS_THAN", s.outputs["Z"], None, vb=0.55)
L(m, mix_rgb(m, pl_.outputs[0], c_.outputs[2], rgba("#8d9194")).outputs[2], b.inputs["Base Color"]); setin(b, Roughness=0.85); M["wall"] = m

# corrugated roof sheet, a little weathered
m, b = new_mat("roof"); tc = N(m, "ShaderNodeTexCoord")
w = N(m, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="Y"); setin(w, Scale=4.2, Distortion=0); L(m, tc.outputs["Object"], w.inputs["Vector"])
bump(m, w.outputs["Fac"], 0.35, 0.03, b)
rn = noise(m, 0.6, 6, vec=tc.outputs["Object"]); rc = ramp(m, [(0.35, srgb("#c9cdd0")), (0.6, srgb("#aeb3b6")), (0.8, srgb("#9a9486"))], rn.outputs["Fac"])
L(m, rc.outputs["Color"], b.inputs["Base Color"]); setin(b, Metallic=0.0, Roughness=0.5); M["roof"] = m

simple("door", "#2a55a0", 0.5)
simple("blue", "#2f6fb8", 0.35)
simple("dark", "#23282c", 0.6)
simple("white", "#e8ecee", 0.4)
simple("black", "#070707", 0.15)
simple("steel", "#7d8386", 0.45, 0.6)
simple("glass", "#2a3236", 0.2, 0.3)

# yard concrete
m, b = new_mat("yard"); g, s = world_pos(m); nz = noise(m, 0.8, 8, vec=g.outputs["Position"])
L(m, ramp(m, [(0.3, srgb("#9d998f")), (0.7, srgb("#bab5a9"))], nz.outputs["Fac"]).outputs["Color"], b.inputs["Base Color"]); setin(b, Roughness=0.9); M["yard"] = m

# sand: dry and pale inland, darker and wet toward the sea
m, b = new_mat("sand"); g, s = world_pos(m); nz = noise(m, 1.5, 10, vec=g.outputs["Position"])
dry = ramp(m, [(0.3, srgb("#cdb48c")), (0.7, srgb("#dcc7a1"))], nz.outputs["Fac"])
wet = math_n(m, "SUBTRACT", s.outputs["Y"], None, vb=32); wet = math_n(m, "MULTIPLY", wet.outputs[0], None, vb=0.08, clamp=True)
L(m, mix_rgb(m, wet.outputs[0], dry.outputs["Color"], rgba("#8a7658")).outputs[2], b.inputs["Base Color"])
bump(m, noise(m, 6, 6, vec=g.outputs["Position"]).outputs["Fac"], 0.15, 0.05, b); setin(b, Roughness=0.95); M["sand"] = m

# farmland: patches of paddy greens, fallow browns
m, b = new_mat("fields"); g, s = world_pos(m)
vo = N(m, "ShaderNodeTexVoronoi"); setin(vo, Scale=0.012, Randomness=0.9); L(m, mapping(m, (1, 1.8, 1), g.outputs["Position"]).outputs[0], vo.inputs["Vector"])
sep = N(m, "ShaderNodeSeparateColor"); L(m, vo.outputs["Color"], sep.inputs[0])
pc = ramp(m, [(0.0, srgb("#6f8a3c")), (0.3, srgb("#58792f")), (0.55, srgb("#8e9a4a")), (0.75, srgb("#a08e62")), (1.0, srgb("#4f6e2c"))], sep.outputs[0])
nz = noise(m, 0.08, 8, vec=g.outputs["Position"])
L(m, mix_rgb(m, 0.35, pc.outputs["Color"], nz.outputs["Color"], "OVERLAY").outputs[2], b.inputs["Base Color"]); setin(b, Roughness=0.9); M["fields"] = m

# the sea: calm, silty, reflecting a hazy sky
m, b = new_mat("sea"); g, s = world_pos(m)
n1 = noise(m, 0.05, 4, vec=g.outputs["Position"], dims="4D"); drive(n1.inputs["W"], "frame/90")
n2 = noise(m, 0.6, 3, vec=g.outputs["Position"], dims="4D"); drive(n2.inputs["W"], "frame/40")
h = math_n(m, "ADD", n1.outputs["Fac"], math_n(m, "MULTIPLY", n2.outputs["Fac"], None, vb=0.4).outputs[0])
bump(m, h.outputs[0], 0.25, 0.4, b); setin(b, Base_Color=rgba("#6b665a"), Roughness=0.08); M["sea"] = m

# inside: pale mint walls, dark green mildew running down from the tank rims
m, b = new_mat("inwall"); g, s = world_pos(m)
st = noise(m, 1, 10, vec=mapping(m, (9, 9, 0.45), g.outputs["Position"]).outputs[0])
lo = math_n(m, "SUBTRACT", None, s.outputs["Z"], va=2.3); lo = math_n(m, "MULTIPLY", lo.outputs[0], None, vb=0.7, clamp=True)
blot = noise(m, 0.9, 10, vec=g.outputs["Position"])
dm = math_n(m, "MULTIPLY", lo.outputs[0], math_n(m, "ADD", st.outputs["Fac"], blot.outputs["Fac"]).outputs[0])
dm = math_n(m, "SUBTRACT", dm.outputs[0], None, vb=0.35); fac = math_n(m, "MULTIPLY", dm.outputs[0], None, vb=1.6, clamp=True)
base = ramp(m, [(0.3, srgb("#dfe8e0")), (0.7, srgb("#cbd9cf"))], noise(m, 3, 6).outputs["Fac"])
L(m, mix_rgb(m, fac.outputs[0], base.outputs["Color"], rgba("#4a5230")).outputs[2], b.inputs["Base Color"]); setin(b, Roughness=0.8); M["inwall"] = m

# concrete rims, wet and darker close to the water
m, b = new_mat("rim"); g, s = world_pos(m); nz = noise(m, 4, 10, vec=g.outputs["Position"])
cr = ramp(m, [(0.25, srgb("#8d8c84")), (0.6, srgb("#a9a79e")), (0.85, srgb("#7c7a6d"))], nz.outputs["Fac"])
wet = math_n(m, "SUBTRACT", None, s.outputs["Z"], va=1.35); wet = math_n(m, "MULTIPLY", wet.outputs[0], None, vb=4, clamp=True)
L(m, mix_rgb(m, wet.outputs[0], cr.outputs["Color"], rgba("#4d5140")).outputs[2], b.inputs["Base Color"])
bump(m, nz.outputs["Fac"], 0.2, 0.02, b); setin(b, Roughness=0.75); M["rim"] = m

m, b = new_mat("floor"); g, s = world_pos(m); nz = noise(m, 2, 8, vec=g.outputs["Position"])
L(m, ramp(m, [(0.3, srgb("#4d4f45")), (0.7, srgb("#666659"))], nz.outputs["Fac"]).outputs["Color"], b.inputs["Base Color"]); setin(b, Roughness=0.25); M["floor"] = m

# the green shade net, lit from above, with its weave
m, b = new_mat("net"); tc = N(m, "ShaderNodeTexCoord")
ck = N(m, "ShaderNodeTexChecker"); setin(ck, Scale=260); L(m, tc.outputs["Generated"], ck.inputs["Vector"])
nn = noise(m, 3, 6, vec=tc.outputs["Generated"])
col = mix_rgb(m, 0.25, ramp(m, [(0.3, srgb("#1f8a6a")), (0.7, srgb("#2aa37d"))], nn.outputs["Fac"]).outputs["Color"], ck.outputs["Color"], "MULTIPLY")
L(m, col.outputs[2], b.inputs["Base Color"]); L(m, col.outputs[2], b.inputs["Emission Color"]); setin(b, Emission_Strength=0.55, Roughness=0.9); M["net"] = m

m, b = new_mat("tube"); setin(b, Base_Color=(1, 1, 1, 1), Emission_Color=(0.92, 1.0, 0.97, 1), Emission_Strength=28); M["tube"] = m

# raceway water: dark, glassy, rippling; aeration boils white near the inlets; bright seen from below
def water_mat(name, col, foam_mask_expr=None, under="#9fb58a"):
    m, b = new_mat(name); g, s = world_pos(m)
    n1 = noise(m, 3.0, 4, vec=g.outputs["Position"], dims="4D"); drive(n1.inputs["W"], "frame/30")
    n2 = noise(m, 11, 3, vec=g.outputs["Position"], dims="4D"); drive(n2.inputs["W"], "frame/14")
    h = math_n(m, "ADD", n1.outputs["Fac"], math_n(m, "MULTIPLY", n2.outputs["Fac"], None, vb=0.35).outputs[0])
    bump(m, h.outputs[0], 0.35, 0.05, b)
    setin(b, Base_Color=rgba(col), Roughness=0.03, IOR=1.33)
    geo = N(m, "ShaderNodeNewGeometry")
    em = N(m, "ShaderNodeEmission"); setin(em, Color=rgba(under))
    rip = math_n(m, "MULTIPLY", h.outputs[0], None, vb=1.8); L(m, math_n(m, "ADD", rip.outputs[0], None, vb=0.2).outputs[0], em.inputs["Strength"])
    mx = N(m, "ShaderNodeMixShader"); L(m, geo.outputs["Backfacing"], mx.inputs[0]); L(m, b.outputs[0], mx.inputs[1]); L(m, em.outputs[0], mx.inputs[2])
    L(m, mx.outputs[0], m.node_tree.nodes["Material Output"].inputs["Surface"]); M[name] = m; return m
water_mat("tankwater", "#16261c")
water_mat("pondwater", "#26361a", under="#a7b989"); setin(M["pondwater"].node_tree.nodes["Principled BSDF"], Specular_IOR_Level=0.3)

# aeration foam: white froth with holes, churning
m, b = new_mat("foam"); tc = N(m, "ShaderNodeTexCoord")
fn = noise(m, 7, 8, vec=tc.outputs["Object"], dims="4D"); drive(fn.inputs["W"], "frame/8")
gr = N(m, "ShaderNodeTexGradient", gradient_type="SPHERICAL"); L(m, tc.outputs["Object"], gr.inputs["Vector"])
a = math_n(m, "MULTIPLY", fn.outputs["Fac"], gr.outputs["Fac"]); a = math_n(m, "SUBTRACT", a.outputs[0], None, vb=0.22); a = math_n(m, "MULTIPLY", a.outputs[0], None, vb=4.0, clamp=True)
a = math_n(m, "POWER", a.outputs[0], None, vb=1.4)
L(m, a.outputs[0], b.inputs["Alpha"]); setin(b, Base_Color=rgba("#f1f4ee"), Roughness=0.6); blended(m); M["foam"] = m

# post-larva: clear glassy body; gut, eyes, pigment specks
m, b = new_mat("plglass"); setin(b, Base_Color=rgba("#c3cbbd"), Roughness=0.06, IOR=1.36, Transmission_Weight=1.0, Alpha=0.3, Coat_Weight=0.8)
fade_pl = N(m, "ShaderNodeValue"); fade_pl.outputs[0].default_value = 1.0
lw = N(m, "ShaderNodeLayerWeight"); lw.inputs[0].default_value = 0.35
ga = math_n(m, "MULTIPLY_ADD", lw.outputs["Fresnel"]); ga.inputs[1].default_value = 0.65; ga.inputs[2].default_value = 0.1
L(m, math_n(m, "MULTIPLY", fade_pl.outputs[0], ga.outputs[0]).outputs[0], b.inputs["Alpha"]); blended(m); M["plglass"] = m
m, b = new_mat("plgut"); setin(b, Base_Color=rgba("#4a2e14"), Roughness=0.4)
blended(m); M["plgut"] = m
m, b = new_mat("plspeck"); setin(b, Base_Color=rgba("#8a2a10"), Roughness=0.5); blended(m); M["plspeck"] = m
m, b = new_mat("eye"); setin(b, Base_Color=rgba("#050505"), Roughness=0.08); blended(m); M["eye"] = m
PL_FADES = []
for k in ("plgut", "plspeck", "eye"):
    mm = M[k]; v = N(mm, "ShaderNodeValue"); v.outputs[0].default_value = 1.0
    L(mm, v.outputs[0], mm.node_tree.nodes["Principled BSDF"].inputs["Alpha"]); PL_FADES.append(v)
PL_FADES.append(fade_pl)

# grown whiteleg prawn: translucent grey-blue with faint bands and speckle
m, b = new_mat("prawn"); tc = N(m, "ShaderNodeTexCoord")
bands = N(m, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="X"); setin(bands, Scale=1.6, Distortion=0.4); L(m, tc.outputs["Object"], bands.inputs["Vector"])
sp = noise(m, 90, 2, vec=tc.outputs["Object"]); spk = math_n(m, "GREATER_THAN", sp.outputs["Fac"], None, vb=0.66)
c0 = ramp(m, [(0.0, srgb("#b9c4c4")), (1.0, srgb("#dfe6e2"))], bands.outputs["Fac"])
c1 = mix_rgb(m, spk.outputs[0], c0.outputs["Color"], rgba("#6b5a4a"))
L(m, c1.outputs[2], b.inputs["Base Color"]); setin(b, Roughness=0.25, IOR=1.4, Transmission_Weight=0.35, Subsurface_Weight=0.3, Coat_Weight=0.6, Coat_Roughness=0.08)
fade_pr = N(m, "ShaderNodeValue"); fade_pr.outputs[0].default_value = 0.0
L(m, math_n(m, "MULTIPLY", fade_pr.outputs[0], None, vb=0.93).outputs[0], b.inputs["Alpha"]); blended(m); M["prawn"] = m
m, b = new_mat("prawneye"); setin(b, Base_Color=rgba("#040404"), Roughness=0.06); fade_pe = N(m, "ShaderNodeValue"); L(m, fade_pe.outputs[0], b.inputs["Alpha"]); blended(m); M["prawneye"] = m
PR_FADES = [fade_pr, fade_pe]

# underwater: green murk (principled volume); density animated to hide the cut between tank and pond
def murk(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"]); v = nt.nodes.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = rgba("#8aa866"); v.inputs["Density"].default_value = 0.6
    v.inputs["Absorption Color"].default_value = rgba("#6f8f3c"); v.inputs["Anisotropy"].default_value = 0.5
    v.inputs["Emission Color"].default_value = rgba("#6f8f4c"); v.inputs["Emission Strength"].default_value = 0.06
    nt.links.new(v.outputs[0], nt.nodes["Material Output"].inputs["Volume"]); M[name] = m; return m, v
_, TANK_VOL = murk("tankmurk"); _, POND_VOL = murk("pondmurk")

# light shafts under water: soft additive glow, fading with depth
m = bpy.data.materials.new("shaft"); m.use_nodes = True; nt = m.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
tc = nt.nodes.new("ShaderNodeTexCoord"); sz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sz.inputs[0])
em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = rgba("#d8ecc0")
pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 2.5; nt.links.new(sz.outputs["Z"], pw.inputs[0])
lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs[0].default_value = 0.5
inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0; nt.links.new(lw.outputs["Facing"], inv.inputs[1])
e2 = nt.nodes.new("ShaderNodeMath"); e2.operation = "POWER"; e2.inputs[1].default_value = 3.0; nt.links.new(inv.outputs[0], e2.inputs[0])
m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"; nt.links.new(pw.outputs[0], m2.inputs[0]); nt.links.new(e2.outputs[0], m2.inputs[1])
st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = 0.22; nt.links.new(m2.outputs[0], st.inputs[0]); nt.links.new(st.outputs[0], em.inputs["Strength"])
tr = nt.nodes.new("ShaderNodeBsdfTransparent"); ad = nt.nodes.new("ShaderNodeAddShader")
nt.links.new(em.outputs[0], ad.inputs[0]); nt.links.new(tr.outputs[0], ad.inputs[1]); nt.links.new(ad.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
blended(m); M["shaft"] = m

# tank floor with moving caustics
m, b = new_mat("caustic"); g, s = world_pos(m)
vo = N(m, "ShaderNodeTexVoronoi", voronoi_dimensions="4D", feature="DISTANCE_TO_EDGE"); setin(vo, Scale=2.4)
wn_ = noise(m, 0.8, 3, vec=g.outputs["Position"]); wv = N(m, "ShaderNodeVectorMath", operation="SCALE"); L(m, wn_.outputs["Color"], wv.inputs[0]); wv.inputs["Scale"].default_value = 0.9
wa = N(m, "ShaderNodeVectorMath", operation="ADD"); L(m, g.outputs["Position"], wa.inputs[0]); L(m, wv.outputs[0], wa.inputs[1]); L(m, wa.outputs[0], vo.inputs["Vector"]); drive(vo.inputs["W"], "frame/36")
c = math_n(m, "SUBTRACT", None, vo.outputs["Distance"], va=0.1); c = math_n(m, "MULTIPLY", c.outputs[0], None, vb=9, clamp=True)
c = math_n(m, "MULTIPLY", c.outputs[0], noise(m, 1.2, 4, vec=g.outputs["Position"]).outputs["Fac"])
setin(b, Base_Color=rgba("#56593f"), Roughness=0.8, Emission_Color=rgba("#d6e8b0")); L(m, math_n(m, "MULTIPLY", c.outputs[0], None, vb=0.7).outputs[0], b.inputs["Emission Strength"]); M["caustic"] = m

m, b = new_mat("bubble"); setin(b, Base_Color=(1, 1, 1, 1), Roughness=0.0, Transmission_Weight=1.0, IOR=1.0, Alpha=0.5, Coat_Weight=1); blended(m); M["bubble"] = m

# palms and trees
m, b = new_mat("trunk"); tc = N(m, "ShaderNodeTexCoord")
rg = N(m, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z"); setin(rg, Scale=9, Distortion=2); L(m, tc.outputs["Object"], rg.inputs["Vector"])
L(m, ramp(m, [(0.2, srgb("#6e6352")), (0.8, srgb("#958a76"))], rg.outputs["Fac"]).outputs["Color"], b.inputs["Base Color"]); bump(m, rg.outputs["Fac"], 0.5, 0.05, b); setin(b, Roughness=0.9); M["trunk"] = m
m, b = new_mat("frond"); it = N(m, "ShaderNodeTexImage"); it.image = bpy.data.images.load(os.path.join(TEX, "frond.png"))
L(m, it.outputs["Color"], b.inputs["Base Color"]); L(m, it.outputs["Alpha"], b.inputs["Alpha"]); setin(b, Roughness=0.6, Subsurface_Weight=0.2); dithered(m); M["frond"] = m
m, b = new_mat("canopy"); g, s = world_pos(m); nz = noise(m, 0.7, 8, vec=g.outputs["Position"])
L(m, ramp(m, [(0.3, srgb("#2c3d1c")), (0.6, srgb("#3f5427")), (0.8, srgb("#56692f"))], nz.outputs["Fac"]).outputs["Color"], b.inputs["Base Color"])
bump(m, noise(m, 6, 8, vec=g.outputs["Position"]).outputs["Fac"], 0.8, 0.3, b); setin(b, Roughness=0.9, Subsurface_Weight=0.15); M["canopy"] = m

# dikes: grass on top, raw clay on the slopes toward the water
m, b = new_mat("dike"); g, s = world_pos(m)
nz = noise(m, 0.35, 8, vec=g.outputs["Position"])
slope = N(m, "ShaderNodeSeparateXYZ"); L(m, g.outputs["Normal"], slope.inputs[0])
top = math_n(m, "SUBTRACT", slope.outputs["Z"], None, vb=0.93); top = math_n(m, "MULTIPLY", top.outputs[0], None, vb=18, clamp=True)
grass = ramp(m, [(0.3, srgb("#5d6f2f")), (0.7, srgb("#7f8a45"))], nz.outputs["Fac"]); clay = ramp(m, [(0.3, srgb("#8a7453")), (0.7, srgb("#a58c66"))], nz.outputs["Fac"])
low = math_n(m, "SUBTRACT", s.outputs["Z"], None, vb=-0.25); low = math_n(m, "MULTIPLY", low.outputs[0], None, vb=3, clamp=True)
f = math_n(m, "MULTIPLY", top.outputs[0], low.outputs[0])
L(m, mix_rgb(m, f.outputs[0], clay.outputs["Color"], grass.outputs["Color"]).outputs[2], b.inputs["Base Color"])
bump(m, noise(m, 3, 8, vec=g.outputs["Position"]).outputs["Fac"], 0.4, 0.1, b); setin(b, Roughness=0.95); M["dike"] = m

# ---------------------------------------------------------------- world, sun, haze
W = bpy.data.worlds.new("sky"); sc.world = W; W.use_nodes = True; wn = W.node_tree
sky = wn.nodes.new("ShaderNodeTexSky"); sky.sky_type = "NISHITA"
SUN_EL, SUN_AZ = math.radians(24), math.radians(125)
sky.sun_elevation = SUN_EL; sky.sun_rotation = SUN_AZ; sky.air_density = 1.4; sky.dust_density = 6.0; sky.ozone_density = 1.0; sky.sun_intensity = 0.6
wn.links.new(sky.outputs[0], wn.nodes["Background"].inputs[0]); wn.nodes["Background"].inputs[1].default_value = 0.22
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); COL.objects.link(sun)
sun.data.energy = 5.5; sun.data.color = srgb("#fff0da"); sun.data.angle = math.radians(1.2)
d = Vector((math.cos(SUN_EL) * math.sin(SUN_AZ), -math.cos(SUN_EL) * math.cos(SUN_AZ), math.sin(SUN_EL)))
d = Vector((math.cos(SUN_EL) * math.cos(SUN_AZ - math.pi / 2), math.cos(SUN_EL) * math.sin(SUN_AZ - math.pi / 2), math.sin(SUN_EL)))
sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
W.mist_settings.start = 60; W.mist_settings.depth = 1800; W.mist_settings.falloff = "QUADRATIC"

# ---------------------------------------------------------------- the coast and the land
def plane(name, cx, cy, sx, sy, z, mat, nx=1, ny=1, hfn=None):
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = cx - sx / 2 + sx * i / nx, cy - sy / 2 + sy * j / ny
            verts.append((x, y, z + (hfn(x, y) if hfn else 0)))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i; faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    b = MB(); b.add(verts, faces); return obj(name, b.mesh(name, [mat], smooth=True))

plane("sea", 0, 1400, 8000, 2800, -0.6, M["sea"])
m, b = new_mat("surf"); g, s_ = world_pos(m)
sn = noise(m, 0.25, 6, vec=mapping(m, (0.3, 1, 1), g.outputs["Position"]).outputs[0], dims="4D"); drive(sn.inputs["W"], "frame/60")
band_ = math_n(m, "SUBTRACT", s_.outputs["Y"], None, vb=41); band_ = math_n(m, "ABSOLUTE", band_.outputs[0]); band_ = math_n(m, "SUBTRACT", None, band_.outputs[0], va=1.0)
al = math_n(m, "MULTIPLY", band_.outputs[0], math_n(m, "SUBTRACT", sn.outputs["Fac"], None, vb=0.35).outputs[0]); al = math_n(m, "MULTIPLY", al.outputs[0], None, vb=4, clamp=True)
L(m, al.outputs[0], b.inputs["Alpha"]); setin(b, Base_Color=rgba("#eeeae0"), Roughness=0.7); blended(m); M["surf"] = m
plane("surfline", 0, 41, 3000, 3, -0.57, M["surf"])
def beach_h(x, y):  # 0 at the land edge (y=5), sloping under the sea past y=58, with gentle dunes
    t = max(0.0, (y - 5) / 53); return -1.3 * t * t + 0.25 * mnoise.noise(Vector((x * 0.03, y * 0.05, 0))) * (1 - t)
plane("beach", 0, 35, 3000, 70, 0.0, M["sand"], 300, 28, beach_h)
# farmland all round, with a hole where the pond farm sits (-290..290, -330..-810)
for (cx, cy, sx, sy) in ((0, -165, 6000, 330), (0, -1905, 6000, 2190), (-1645, -570, 2710, 480), (1645, -570, 2710, 480)):
    plane("land", cx, cy, sx, sy, 0.0, M["fields"], 1, 1)
plane("yard", 0, -72, 150, 170, 0.02, M["yard"])
plane("sandyard", 0, -50, 230, 170, 0.01, M["sand"])

# ---------------------------------------------------------------- hatchery sheds
SW, SL, WH, RH = 16.0, 36.0, 4.2, 2.6
def shed(cx, cy, hollow=False, door=True):
    parts = []
    t = 0.25
    if hollow:
        parts.append(box("wallL", (cx - SW / 2, cy, WH / 2), (t, SL, WH), M["wall"]))
        parts.append(box("wallR", (cx + SW / 2, cy, WH / 2), (t, SL, WH), M["wall"]))
        parts.append(box("wallB", (cx, cy - SL / 2, WH / 2), (SW, t, WH), M["wall"]))
        dw, dh = 4.4, 3.5
        for sgn in (-1, 1):
            parts.append(box("wallF", (cx + sgn * (SW / 4 + dw / 4), cy + SL / 2, WH / 2), (SW / 2 - dw / 2, t, WH), M["wall"]))
        parts.append(box("lintel", (cx, cy + SL / 2, dh + (WH - dh) / 2), (dw, t, WH - dh), M["wall"]))
    else:
        parts.append(box("shed", (cx, cy, WH / 2), (SW, SL, WH), M["wall"]))
        if door: box("door", (cx, cy + SL / 2 + 0.09, 1.6), (4.2, 0.08, 3.2), M["door"])
    # a row of small louvred windows high on each long side, a ridge cap, and a vent in each gable
    for sgn in (-1, 1):
        for k in range(7):
            box("win", (cx + sgn * (SW / 2 + 0.03), cy - SL / 2 + 3 + k * 5, 3.2), (0.06, 1.6, 0.7), M["glass"])
    box("ridge", (cx, cy, WH + RH + 0.04), (0.5, SL + 1.2, 0.12), M["steel"])
    for yy in (cy + SL / 2 + 0.03, cy - SL / 2 - 0.03):
        box("vent", (cx, yy, WH + 1.1), (1.4, 0.06, 0.6), M["glass"])
    if not hollow and door: box("doorframe", (cx, cy + SL / 2 + 0.04, 1.65), (4.6, 0.06, 3.4), M["steel"])
    # gable ends and roof sheets
    for yy in (cy + SL / 2, cy - SL / 2):
        b = MB(); b.add([(cx - SW / 2, yy, WH), (cx + SW / 2, yy, WH), (cx, yy, WH + RH)], [(0, 1, 2)])
        obj("gable", b.mesh("gable", [M["wall"]], smooth=False))
    slope = math.hypot(SW / 2 + 0.6, RH); ang = math.atan2(RH, SW / 2)
    for sgn in (-1, 1):
        # from the ridge down to 0.6 m past the eave, so the two sheets meet at the ridge and nothing crosses
        top, eave = Vector((cx, WH + RH + 0.03)), Vector((cx + sgn * (SW / 2 + 0.6), WH + RH + 0.03 - (SW / 2 + 0.6) * RH / (SW / 2)))
        mid = (top + eave) / 2
        box("roofsheet", (mid.x, cy, mid.y), ((top - eave).length, SL + 1.2, 0.06), M["roof"], (0, sgn * ang, 0))
    return parts

ENTRY = (0.0, -30.0)
for ix, x in enumerate((-22, 0, 22)):
    for iy, y in enumerate((-30, -74, -118)):
        shed(x, y, hollow=(ix == 1 and iy == 0))
# yard: storage tanks, office, sea-water intake pipe on trestles, boundary wall
for i in range(6):
    b = MB(); v, f = tube([Vector((0, 0, 0)), Vector((0, 0, 3.4))], [(1.6, 1.6)] * 2, 24); b.add(v, f)
    obj("tank", b.mesh("tank", [M["blue"]]), (44, -20 - i * 5.2, 0))
box("office", (-44, 2, 2.2), (14, 9, 4.4), M["wall"]); box("officeroof", (-44, 2, 4.5), (15, 10, 0.25), M["dark"])
b = MB(); v, f = tube([Vector((40, -10, 0.6)), Vector((40, 10, 0.6)), Vector((42, 30, 0.9)), Vector((46, 120, 0.9))], [(0.35, 0.35)] * 4, 16); b.add(v, f)
obj("pipe", b.mesh("pipe", [M["blue"]]))
for yy in range(30, 121, 6): box("trestle", (40 + (yy - 30) / 90 * 6, yy, 0.0), (0.2, 0.2, 1.8), M["dark"])
for (cx, cy, sx, sy) in ((0, 12, 150, 0.3), (0, -156, 150, 0.3), (-75, -72, 0.3, 168), (75, -72, 0.3, 168)):
    box("bwall", (cx, cy, 0.9), (sx, sy, 1.8), M["wall"])

# ---------------------------------------------------------------- palms and trees
def palm_meshes():
    b = MB(); h = 10.0; path = [Vector((0.0, 0.0, 0.0))]
    for i in range(1, 13):
        t = i / 12; path.append(Vector((0.9 * t * t, 0.0, h * t)))
    v, f = tube(path, [(0.24 - 0.08 * (i / 12), 0.24 - 0.08 * (i / 12)) for i in range(13)], 10); b.add(v, f)
    trunk = b.mesh("palmtrunk", [M["trunk"]])
    c = MB(); top = path[-1]
    for k in range(16):
        yaw = 2 * math.pi * k / 16 + R.random() * 0.2; lift = 0.5 - (k % 3) * 0.35
        Lf, Wf, n = 4.8 + R.random(), 1.3, 10
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            def pt(t, s):
                x = t * Lf; z = lift * x - 0.16 * x * x
                p = Vector((x, s * Wf / 2 * (1 - 0.3 * t), z))
                cy, sy = math.cos(yaw), math.sin(yaw)
                return top + Vector((p.x * cy - p.y * sy, p.x * sy + p.y * cy, p.z))
            c.add([pt(t0, -1), pt(t1, -1), pt(t1, 1), pt(t0, 1)], [(0, 1, 2, 3)], 0, [[(t0, 0), (t1, 0), (t1, 1), (t0, 1)]])
    return trunk, c.mesh("palmcrown", [M["frond"]])
PT, PC = palm_meshes()
palm_t, palm_c = obj("palm_t", PT, (0, 0, -100)), obj("palm_c", PC, (0, 0, -100))
def palm(x, y, s=1.0):
    if abs(x) < 12 and -20 < y < 60: return
    r = (0, 0, R.random() * 6.28)
    inst(palm_t, (x, y, 0), r, (s, s, s)); inst(palm_c, (x, y, 0), r, (s, s, s))
for i in range(90):
    x = R.uniform(-400, 400)
    if abs(x - 42) < 6: continue
    palm(x, R.uniform(4, 22), R.uniform(0.8, 1.15))
for i in range(40): palm(R.choice((-1, 1)) * R.uniform(78, 95), R.uniform(-150, 10), R.uniform(0.8, 1.1))
for i in range(14): palm(R.uniform(-60, 60), R.uniform(0, 10), R.uniform(0.85, 1.1))

def tree_mesh(seed):
    rr = random.Random(seed); b = MB()
    v, f = tube([Vector((0, 0, 0)), Vector((0, 0, 3))], [(0.25, 0.25)] * 2, 8); b.add(v, f, 1)
    for k in range(6):
        c = Vector((rr.uniform(-2, 2), rr.uniform(-2, 2), rr.uniform(4, 6.5))); r = rr.uniform(1.8, 3.0)
        v, f = sphere_v(r, c, 14, 10, 1, 1, 0.8)
        v = [p + (p - c).normalized() * 0.7 * mnoise.noise(p * 0.9 + Vector((seed, 0, 0))) for p in v]
        b.add(v, f, 0)
    return b.mesh("tree%d" % seed, [M["canopy"], M["trunk"]])
TREES = [obj("treesrc%d" % i, tree_mesh(i), (0, 0, -100)) for i in range(4)]
def tree(x, y, s=1.0): inst(R.choice(TREES), (x, y, 0), (0, 0, R.random() * 6.28), (s, s, s * R.uniform(0.9, 1.2)))

# ---------------------------------------------------------------- the pond farm
PX0, PX1, PY0, PY1 = -290.0, 290.0, -330.0, -810.0
CW, CH, DK, SLP = 58.0, 48.0, 2.2, 3.2
DRAINED = {(1, 3), (7, 6)}
def farm_h(x, y):
    u, v = (x - PX0) % CW, (PY0 - y) % CH
    ci, cj = int((x - PX0) // CW), int((PY0 - y) // CH)
    dd = min(u, CW - u, v, CH - v)
    edge = min(x - PX0, PX1 - x, PY0 - y, y - PY1)
    if edge < 6: return 0.35
    if dd < DK: h = 0.55
    elif dd < DK + SLP: t = (dd - DK) / SLP; h = 0.55 - 2.2 * (t * t * (3 - 2 * t))
    else: h = -1.65
    if (ci, cj) in DRAINED and h < -0.2: h = -0.2
    return h + 0.08 * mnoise.noise(Vector((x * 0.2, y * 0.2, 0)))
nx, ny = int((PX1 - PX0) / 1.2), int((PY0 - PY1) / 1.2)
plane("farm", (PX0 + PX1) / 2, (PY0 + PY1) / 2, PX1 - PX0, PY0 - PY1, 0.0, M["dike"], nx, ny, farm_h)
plane("pondsurface", (PX0 + PX1) / 2, (PY0 + PY1) / 2, PX1 - PX0 - 10, PY0 - PY1 - 10, -0.35, M["pondwater"], 1, 1)

# paddle-wheel aerators: floats, a paddle drum on a shaft, and the froth they throw
def aerator_mesh():
    b = MB()
    for sgn in (-1, 1):
        v, f = tube([Vector((-0.8, sgn * 1.9, 0.1)), Vector((0.8, sgn * 1.9, 0.1))], [(0.28, 0.28)] * 2, 12); b.add(v, f, 0)
    v, f = tube([Vector((0, -2.1, 0.35)), Vector((0, 2.1, 0.35))], [(0.05, 0.05)] * 2, 8); b.add(v, f, 1)
    for k in range(8):
        a = 2 * math.pi * k / 8
        for yy in (-1.3, -0.4, 0.4, 1.3):
            v, f = box_v(0.05, 0.45, 0.42, (math.cos(a) * 0.3, yy, 0.35 + math.sin(a) * 0.3)); b.add(v, f, 1)
    v, f = box_v(0.5, 0.5, 0.4, (0, 2.05, 0.7)); b.add(v, f, 1)
    return b.mesh("aerator", [M["white"], M["dark"]], smooth=False)
AER = obj("aerator_src", aerator_mesh(), (0, 0, -100))
foam_src = plane("foam_src", 0, 0, 1, 1, 0, M["foam"])
foam_src.location = (0, 0, -100)
for i in range(int((PX1 - PX0) // CW)):
    for j in range(int((PY0 - PY1) // CH)):
        if (i, j) in DRAINED: continue
        cx, cy = PX0 + CW * (i + 0.5), PY0 - CH * (j + 0.5)
        for k in range(R.choice((2, 4))):
            ax, ay = cx + (-1) ** k * 14 + R.uniform(-2, 2), cy + (1 if k < 2 else -1) * 10 + R.uniform(-2, 2)
            yaw = R.uniform(0, 6.28)
            inst(AER, (ax, ay, -0.42), (0, 0, yaw))
            fo = inst(foam_src, (ax + math.cos(yaw) * 2.8, ay + math.sin(yaw) * 2.8, -0.33), (0, 0, yaw), (6.5, 4.5, 1))
# huts and tree lines around the farm; groves scattered over the country
for (hx, hy) in ((PX0 + CW * 3, PY0 - CH * 2), (PX0 + CW * 7, PY0 - CH * 5), (PX0 + CW * 5, PY0 - CH * 8)):
    box("hut", (hx, hy, 1.6), (3.6, 3.0, 2.2), M["wall"]); box("hutroof", (hx, hy, 2.85), (4.4, 3.8, 0.2), M["roof"])
x = PX0 - 14
while x < PX1 + 14:
    tree(x + R.uniform(-2, 2), PY1 - 12 - R.uniform(0, 8), R.uniform(0.9, 1.4)); x += R.uniform(6, 10)
for side in (PX0 - 14, PX1 + 14):
    y = PY0
    while y > PY1:
        tree(side + R.uniform(-4, 4), y, R.uniform(0.9, 1.4)); y -= R.uniform(7, 11)
for g in range(160):
    gx, gy = R.uniform(-1600, 1600), R.uniform(-2500, -170)
    if PX0 - 30 < gx < PX1 + 30 and PY1 - 30 < gy < PY0 + 30: continue
    if -90 < gx < 90 and gy > -170: continue
    for k in range(R.randint(4, 14)): tree(gx + R.uniform(-30, 30), gy + R.uniform(-30, 30), R.uniform(0.9, 1.6))

# ---------------------------------------------------------------- inside the entry shed
ex, ey = ENTRY
FZ = 0.02; RIM = 1.25; WZ = 1.05; T = 0.22
box("infloor", (ex, ey, FZ), (SW - 0.3, SL - 0.3, 0.04), M["floor"])
for sgn in (-1, 1):           # inner wall faces, so the inside has its own mildewed paint
    box("inwall", (ex + sgn * (SW / 2 - 0.14), ey, WH / 2), (0.02, SL - 0.3, WH), M["inwall"])
box("inwallB", (ex, ey - SL / 2 + 0.14, WH / 2), (SW - 0.3, 0.02, WH), M["inwall"])
for sgn in (-1, 1): box("inwallF", (ex + sgn * (SW / 4 + 1.1), ey + SL / 2 - 0.14, WH / 2), (SW / 2 - 2.2, 0.02, WH), M["inwall"])
b = MB(); b.add([(ex - SW / 2, ey - SL / 2, WH - 0.2), (ex + SW / 2, ey - SL / 2, WH - 0.2), (ex + SW / 2, ey + SL / 2, WH - 0.2), (ex - SW / 2, ey + SL / 2, WH - 0.2)], [(0, 1, 2, 3)])
net = obj("net", b.mesh("net", [M["net"]], smooth=False))
for k in range(10):
    box("truss", (ex, ey + SL / 2 - 1.8 - k * 3.6, WH - 0.3), (SW - 0.3, 0.07, 0.14), M["steel"])
for sgn in (-1, 1):
    for k in range(8):
        yy = ey + SL / 2 - 3 - k * 4.4
        b = MB(); v, f = tube([Vector((0, -0.6, 0)), Vector((0, 0.6, 0))], [(0.03, 0.03)] * 2, 8); b.add(v, f)
        obj("tubelight", b.mesh("tl", [M["tube"]]), (ex + sgn * (SW / 2 - 0.35), yy, 3.25))
    L_ = bpy.data.lights.new("fill", "AREA"); L_.energy = 2600; L_.size = 1.0; L_.size_y = SL - 4; L_.shape = "RECTANGLE"; L_.color = srgb("#e6f7ee")
    lo = bpy.data.objects.new("fill", L_); lo.location = (ex + sgn * 4, ey, WH - 0.5); COL.objects.link(lo)
Ld = bpy.data.lights.new("netglow", "AREA"); Ld.energy = 900; Ld.size = SW - 1; Ld.size_y = SL - 1; Ld.shape = "RECTANGLE"; Ld.color = srgb("#9fe3c4")
lo = bpy.data.objects.new("netglow", Ld); lo.location = (ex, ey, WH - 0.3); COL.objects.link(lo)
# raceways: a narrow walkway channel down the middle, two tanks each side, split halfway down
Y0, Y1, YM = ey + SL / 2 - 2.0, ey - SL / 2 + 0.6, ey - 1.5
for sgn in (-1, 1):
    xi, xo = ex + sgn * 0.75, ex + sgn * (SW / 2 - 0.35)
    xc, xw = (xi + xo) / 2, abs(xo - xi)
    box("rimI", (xi, (Y0 + Y1) / 2, RIM / 2), (T, Y0 - Y1, RIM), M["rim"])
    box("rimO", (xo, (Y0 + Y1) / 2, RIM / 2), (T, Y0 - Y1, RIM), M["rim"])
    for yy in (Y0, YM, Y1): box("rimX", (xc, yy, RIM / 2), (xw, T, RIM), M["rim"])
    for (ya, yb) in ((Y0, YM), (YM, Y1)):
        plane("water", xc, (ya + yb) / 2, xw - T, ya - yb - T, WZ, M["tankwater"], 1, 1)
        # aeration boil where the inflow jets in, at the far end of each tank
        for q in range(3):
            fo = inst(foam_src, (xc + (q - 1) * xw * 0.28, yb + 1.2, WZ + 0.01), (0, 0, R.random() * 6.28), (2.2, 1.6, 1))
box("channelwater", (ex, (Y0 + Y1) / 2, 0.45), (1.28, Y0 - Y1, 0.02), M["tankwater"])
# the door at the far end, as in the photos
box("backdoor", (ex, ey - SL / 2 + 0.2, 1.3), (1.2, 0.05, 2.4), M["dark"])

# under water in the right front tank: murk, caustic floor, light shafts, bubbles
for o in COL.objects:
    if o.name.startswith(("water", "pondsurface", "channelwater", "net")):
        try: o.visible_shadow = False
        except Exception: pass
def underlight(x, y, z, sx, sy, e):
    Lw = bpy.data.lights.new("uw", "AREA"); Lw.shape = "RECTANGLE"; Lw.size, Lw.size_y = sx, sy; Lw.energy = e; Lw.color = srgb("#cfe6b8")
    o = bpy.data.objects.new("uw", Lw); o.location = (x, y, z); COL.objects.link(o)
TX0, TX1, TYa, TYb = ex + 0.75 + T / 2, ex + SW / 2 - 0.35 - T / 2, Y0 - T / 2, YM + T / 2
tv = box("tankmurk", ((TX0 + TX1) / 2, (TYa + TYb) / 2, (FZ + WZ) / 2), (TX1 - TX0, TYa - TYb, WZ - FZ - 0.01), M["tankmurk"])
plane("tankfloor", (TX0 + TX1) / 2, (TYa + TYb) / 2, TX1 - TX0, TYa - TYb, FZ + 0.03, M["caustic"], 1, 1)
def shafts(x0, x1, y0, y1, ztop, depth, n):
    for i in range(n):
        b = MB(); r0 = R.uniform(0.15, 0.4)
        v, f = tube([Vector((0, 0, 0)), Vector((0, 0, depth))], [(r0 * 1.8, r0 * 1.8), (r0, r0)], 16, cap=False); b.add(v, f)
        o = obj("shaft", b.mesh("shaft", [M["shaft"]]), (R.uniform(x0, x1), R.uniform(y0, y1), ztop - depth), (R.uniform(-0.25, 0.25), R.uniform(-0.25, 0.25), 0))
shafts(TX0 + 0.4, TX1 - 0.4, TYb + 1, TYa - 1, WZ, 1.0, 14)
underlight((TX0 + TX1) / 2, (TYa + TYb) / 2, WZ - 0.03, TX1 - TX0, TYa - TYb, 260)
_b = MB(); _b.add(*sphere_v(1, (0, 0, 0), 8, 6)); bsrc = obj("bubble_src", _b.mesh("bub", [M["bubble"]]), (0, 0, -100))
def bubbles(x0, x1, y0, y1, zb, zt, n, speed):
    for i in range(n):
        s = R.uniform(0.004, 0.012); o = inst(bsrc, (R.uniform(x0, x1), R.uniform(y0, y1), zb), scale=(s, s, s))
        off, sp = R.random(), speed * R.uniform(0.7, 1.4)
        d = o.driver_add("location", 2).driver; d.type = "SCRIPTED"; d.expression = "%f + ((frame*%f + %f) %% 1.0) * %f" % (zb, sp, off, zt - zb)
        d = o.driver_add("location", 0).driver; d.type = "SCRIPTED"; d.expression = "%f + 0.01*sin(frame*0.3 + %f)" % (o.location.x, off * 6)
bubbles(TX0 + 0.3, TX1 - 0.3, TYb + 0.5, TYa - 0.5, FZ + 0.05, WZ - 0.02, 260, 0.012)

# ---------------------------------------------------------------- post-larvae and the prawns they become
def pl_mesh():
    """a PL10 about 1 unit long, head at +x: slender glassy body, eyes on stalks, gut line, pigment specks, tail fan"""
    b = MB(); n = 26; path, radii = [], []
    for i in range(n + 1):
        t = i / n
        path.append(Vector((0.5 - t, 0, -0.06 * math.sin(math.pi * t) + 0.05 * t * t)))
        r = 0.055 * (0.55 + 0.45 * math.sin(math.pi * min(1, t * 2.2 + 0.08))) if t < 0.38 else 0.052 * (1 - (t - 0.38) / 0.62) ** 0.6 + 0.012
        radii.append((r * 0.8, r))
    v, f = tube(path, radii, 12); b.add(v, f, 0)
    v, f = tube([Vector((0.5, 0, 0.01)), Vector((0.7, 0, 0.035))], [(0.012, 0.012), (0.002, 0.002)], 6); b.add(v, f, 0)   # rostrum
    gut = [path[i] + Vector((0, 0, radii[i][1] * 0.35)) for i in range(6, n - 2)]
    v, f = tube(gut, [(0.0055, 0.0055)] * len(gut), 6); b.add(v, f, 1)
    for sgn in (-1, 1):
        v, f = sphere_v(0.021, (0.45, sgn * 0.045, 0.03), 10, 7); b.add(v, f, 3)
    for k in range(9):
        t = 0.12 + k * 0.09; i = int(t * n); p = path[i] + Vector((0, 0, -radii[i][1] * 0.85))
        v, f = sphere_v(0.007, p, 6, 4); b.add(v, f, 2)
    tail = path[-1]
    for a in (-0.7, -0.35, 0, 0.35, 0.7):
        d = Vector((-math.cos(a), math.sin(a), 0)) * 0.11
        v, f = tube([tail, tail + d * 0.5, tail + d], [(0.004, 0.004), (0.022, 0.003), (0.012, 0.002)], 6); b.add(v, f, 0)
    for k in range(5):     # swimmerets
        t = 0.42 + k * 0.1; i = int(t * n); p = path[i]
        v, f = tube([p, p + Vector((-0.01, 0, -radii[i][1] - 0.04))], [(0.004, 0.004), (0.002, 0.002)], 5); b.add(v, f, 0)
    return b.mesh("pl", [M["plglass"], M["plgut"], M["plspeck"], M["eye"]])

def prawn_mesh():
    """a grown whiteleg shrimp about 1 unit long, head at +x"""
    b = MB(); n = 40; path, radii = [], []
    for i in range(n + 1):
        t = i / n
        path.append(Vector((0.42 - 0.9 * t, 0, 0.02 - 0.09 * math.sin(math.pi * min(1, t * 1.05)) + 0.16 * max(0, t - 0.55) ** 1.6)))
        r = (0.07 + 0.11 * min(1, t / 0.28)) if t < 0.33 else 0.17 * (1 - (t - 0.33) / 0.67) ** 0.75 + 0.03
        seg = 0.0 if t < 0.36 else 0.012 * (math.cos((t - 0.36) / 0.107 * 2 * math.pi) * 0.5 + 0.5)   # abdominal segments
        radii.append(((r - seg) * 0.72, r - seg))
    v, f = tube(path, radii, 18); b.add(v, f, 0)
    rp = [Vector((0.42 + 0.05 * k, 0, 0.06 + 0.012 * k)) for k in range(6)]
    v, f = tube(rp, [(0.03 - 0.005 * k, 0.03 - 0.005 * k) for k in range(6)], 6); b.add(v, f, 0)       # rostrum
    for k in range(5):
        v, f = tube([Vector((0.45 + k * 0.045, 0, 0.085 + k * 0.012)), Vector((0.44 + k * 0.045, 0, 0.12 + k * 0.012))], [(0.006, 0.006), (0.001, 0.001)], 4); b.add(v, f, 0)
    for sgn in (-1, 1):
        v, f = sphere_v(0.045, (0.43, sgn * 0.075, 0.07), 12, 8); b.add(v, f, 1)
        for (ln, up, rad) in ((1.6, 0.1, 0.0035), (1.35, 0.06, 0.003)):         # long antennae sweeping back
            ap = [Vector((0.45 + 0.1 * math.sin(math.pi * k / 20) - ln * (k / 20) ** 1.3, sgn * (0.06 + 0.25 * (k / 20)), 0.05 + up * math.sin(math.pi * k / 20))) for k in range(21)]
            v, f = tube(ap, [(rad * (1 - 0.8 * k / 20), rad * (1 - 0.8 * k / 20)) for k in range(21)], 5); b.add(v, f, 0)
        for k in range(2):
            ap = [Vector((0.46 + 0.2 * j / 6, sgn * (0.04 + 0.03 * k), 0.03 + 0.06 * j / 6)) for j in range(7)]
            v, f = tube(ap, [(0.006, 0.006)] * 7, 5); b.add(v, f, 0)
        for k in range(5):     # walking legs
            t = 0.05 + k * 0.055; i = int(t * n); p = path[i]
            lp = [p + Vector((0.02 * j, sgn * (0.045 + 0.006 * j), -radii[i][1] * 0.65 - 0.042 * j)) for j in range(4)]
            v, f = tube(lp, [(0.008, 0.008)] * 4, 5); b.add(v, f, 0)
        for k in range(5):     # swimmerets
            t = 0.4 + k * 0.1; i = int(t * n); p = path[i]
            lp = [p + Vector((-0.012 * j, sgn * 0.01 * j, -radii[i][1] * 0.82 - 0.018 * j)) for j in range(4)]
            v, f = tube(lp, [(0.012, 0.004)] * 4, 5); b.add(v, f, 0)
    tail = path[-1]; td = (path[-1] - path[-4]).normalized()
    for a, ln, wd in ((-0.55, 0.19, 0.06), (-0.22, 0.21, 0.07), (0, 0.23, 0.035), (0.22, 0.21, 0.07), (0.55, 0.19, 0.06)):
        d = Vector((td.x * math.cos(a), math.sin(a) * 0.9, td.z * math.cos(a)))
        v, f = tube([tail, tail + d * ln * 0.5, tail + d * ln], [(0.01, 0.006), (wd, 0.006), (wd * 0.4, 0.004)], 8); b.add(v, f, 0)
    return b.mesh("prawn", [M["prawn"], M["prawneye"]])

PLM, PRM = pl_mesh(), prawn_mesh()
pl_src = obj("pl_src", PLM, (0, 0, -100)); pr_src = obj("pr_src", PRM, (0, 0, -100))

def swimmer(src, pos, size, yaw, drift, frames, wob=0.25):
    o = inst(src, pos, (0, R.uniform(-0.2, 0.2), yaw), (size, size, size))
    f0, f1 = frames; hd = Vector((math.cos(yaw), math.sin(yaw), 0))
    o.keyframe_insert("location", frame=f0)
    o.location = Vector(pos) + hd * drift; o.keyframe_insert("location", frame=f1)
    o.keyframe_insert("rotation_euler", frame=f0)
    for fc in o.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
        md = fc.modifiers.new("NOISE"); md.scale = R.uniform(18, 40); md.strength = (0.02 if fc.data_path == "location" else wob) * (size * 12 if fc.data_path == "location" else 1); md.phase = R.uniform(0, 100)
    return o

# ---------------------------------------------------------------- timeline and camera
F = dict(start=1, sheds=200, door=350, inside=400, water=585, grow0=700, grow1=790, murk=812, pond=816, surface=890, end=1080)
sc.frame_start, sc.frame_end = F["start"], F["end"]; sc.render.fps = FPS

PLS = []
CAMX = 4.1
def across(): return R.choice((0.0, math.pi)) + R.uniform(-0.5, 0.5)     # swim across the view, side on
for i in range(520):     # the swarm fills the water just ahead of the lens along its whole path
    y = R.uniform(-21.3, -27.5); x = min(TX1 - 0.15, max(TX0 + 0.15, CAMX + R.gauss(0, 0.45)))
    z = min(WZ - 0.12, max(FZ + 0.12, 0.62 + R.gauss(0, 0.2))); s = R.uniform(0.042, 0.065)
    if abs(x - 4.1) < 0.2 and abs(z - 0.65) < 0.16: continue          # none glued to the lens
    PLS.append(swimmer(pl_src, (x, y, z), s, across(), R.uniform(0.02, 0.2), (F["water"] - 40, F["murk"]), 0.35))
PRS = []
for i in range(34):
    y = R.uniform(-23.3, -26.5); x = min(TX1 - 0.3, max(TX0 + 0.3, CAMX + R.gauss(0, 0.55))); z = min(WZ - 0.15, max(FZ + 0.15, 0.6 + R.gauss(0, 0.15)))
    if abs(x - 4.12) < 0.4 and abs(z - 0.6) < 0.28: x = 4.12 + math.copysign(R.uniform(0.4, 0.8), x - 4.12)   # keep clear of the lens
    PRS.append(swimmer(pr_src, (x, y, z), R.uniform(0.13, 0.18), across(), R.uniform(0.1, 0.35), (F["grow0"] - 10, F["murk"] + 2), 0.12))
def key(sock, frame, v):
    sock.default_value = v; sock.keyframe_insert("default_value", frame=frame)
for v in PL_FADES: key(v.outputs[0], F["grow0"], 1.0); key(v.outputs[0], F["grow1"], 0.0)
for v in PR_FADES: key(v.outputs[0], F["grow0"], 0.0); key(v.outputs[0], F["grow1"] - 20, 1.0)
for o in PRS:   # the prawns swell up as they fade in
    s = o.scale.x; o.scale = (s * 0.4,) * 3; o.keyframe_insert("scale", frame=F["grow0"]); o.scale = (s,) * 3; o.keyframe_insert("scale", frame=F["grow1"])
key(TANK_VOL.inputs["Density"], F["murk"] - 30, 0.6); key(TANK_VOL.inputs["Density"], F["murk"], 9.0)
key(TANK_VOL.inputs["Emission Strength"], F["murk"] - 30, 0.06); key(TANK_VOL.inputs["Emission Strength"], F["murk"], 4.0)

# the grow-out pond we come up in: grown prawns near the bottom, murk thinning as we rise
PCX, PCY = PX0 + CW * 4.5, PY0 - CH * 2.5
PV = box("pondmurk", (PCX, PCY, -1.0), (CW - 2 * (DK + SLP) + 4, CH - 2 * (DK + SLP) + 4, 1.3), M["pondmurk"])
key(POND_VOL.inputs["Density"], F["pond"], 9.0); key(POND_VOL.inputs["Density"], F["pond"] + 22, 0.5)
key(POND_VOL.inputs["Emission Strength"], F["pond"], 4.0); key(POND_VOL.inputs["Emission Strength"], F["pond"] + 22, 0.05)
shafts(PCX - 12, PCX + 12, PCY - 10, PCY + 10, -0.35, 1.3, 30)
underlight(PCX, PCY, -0.38, 44, 34, 3200)
bubbles(PCX - 6, PCX + 6, PCY - 4, PCY + 8, -1.6, -0.37, 120, 0.01)
for i in range(40):
    swimmer(pr_src, (PCX + R.gauss(0, 1.1), PCY + R.uniform(1.2, 5.5), R.uniform(-1.4, -0.75)), R.uniform(0.13, 0.18), across(), R.uniform(0.2, 0.5), (F["pond"], F["end"]), 0.12)

def camera(name, keys, lens_keys):
    cd = bpy.data.cameras.new(name); c = bpy.data.objects.new(name, cd); COL.objects.link(c)
    tgt = bpy.data.objects.new(name + "_t", None); COL.objects.link(tgt)
    con = c.constraints.new("TRACK_TO"); con.target = tgt; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    for fr, p, t in keys:
        c.location = p; c.keyframe_insert("location", frame=fr); tgt.location = t; tgt.keyframe_insert("location", frame=fr)
    for o in (c, tgt):
        for fc in o.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    cd.clip_start = 0.01; cd.clip_end = 20000; cd.sensor_width = 36; cd.dof.use_dof = True
    for fr, lens, focus, fstop in lens_keys:
        cd.lens = lens; cd.keyframe_insert("lens", frame=fr)
        cd.dof.focus_distance = focus; cd.dof.keyframe_insert("focus_distance", frame=fr)
        cd.dof.aperture_fstop = fstop; cd.dof.keyframe_insert("aperture_fstop", frame=fr)
    return c

cam1 = camera("cam1", [
    (1,   (40, 560, 150),  (0, -45, 0)),
    (110, (26, 300, 95),   (0, -50, 0)),
    (200, (12, 110, 42),   (0, -45, 3)),
    (290, (3, 30, 9.5),    (0, -14, 3)),
    (350, (0, 1.5, 2.9),   (0, -14, 2.3)),
    (400, (0, -13.5, 2.55), (0, -24, 1.7)),
    (470, (0.3, -17.5, 2.45), (2.6, -26, 1.2)),
    (540, (2.8, -19.2, 2.0),  (4.1, -24.5, 0.95)),
    (585, (3.9, -20.2, 1.22), (4.2, -23.5, 0.85)),
    (615, (4.05, -20.9, 0.72), (4.15, -24.5, 0.62)),
    (700, (4.1, -22.4, 0.62),  (4.2, -26, 0.6)),
    (812, (4.15, -24.6, 0.58), (4.3, -28, 0.58)),
], [(1, 26, 400, 16), (350, 24, 20, 16), (400, 20, 8, 16), (585, 22, 3, 11), (615, 24, 0.9, 2.8), (812, 24, 1.1, 2.8)])
cam2 = camera("cam2", [
    (816, (PCX, PCY + 6.5, -1.05), (PCX, PCY, -1.0)),
    (860, (PCX, PCY + 4.0, -0.75), (PCX, PCY - 2, -0.3)),
    (890, (PCX, PCY + 2.2, -0.12), (PCX, PCY - 6, 0.5)),
    (905, (PCX, PCY + 1.2, 0.6),   (PCX - 2, PCY - 14, 0.2)),
    (960, (PCX + 6, PCY + 6, 9),   (PCX - 16, PCY - 70, -0.3)),
    (1020, (PCX + 22, PCY + 34, 34), (PCX - 40, PCY - 170, -0.3)),
    (1080, (PCX + 48, PCY + 70, 78), (PCX - 70, PCY - 280, -0.3)),
], [(816, 24, 1.2, 2.8), (880, 24, 1.5, 4), (905, 22, 30, 16), (1080, 26, 300, 16)])
sc.camera = cam1
m1 = sc.timeline_markers.new("tank", frame=1); m1.camera = cam1
m2 = sc.timeline_markers.new("pond", frame=F["pond"]); m2.camera = cam2

# ---------------------------------------------------------------- render settings
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try: sc.render.engine = eng; break
    except Exception: pass
ee = sc.eevee
def tryset(o, k, v):
    try: setattr(o, k, v)
    except Exception as e: print("skip", k, e)
tryset(ee, "taa_render_samples", int(arg("--samples", 48)))
tryset(ee, "use_raytracing", True)
tryset(ee.ray_tracing_options, "resolution_scale", "2")
tryset(ee, "use_shadows", True); tryset(ee, "shadow_ray_count", 2); tryset(ee, "shadow_step_count", 8)
tryset(ee, "volumetric_tile_size", "4"); tryset(ee, "volumetric_samples", 64); tryset(ee, "use_volumetric_shadows", True)
tryset(ee, "volumetric_end", 60.0)
tryset(ee, "use_fast_gi", True); tryset(ee, "fast_gi_method", "GLOBAL_ILLUMINATION")
tryset(ee, "use_bloom", True)
sc.render.use_motion_blur = True; tryset(sc.render, "motion_blur_shutter", 0.35)
rx, ry = (int(v) for v in arg("--res", "1600x900").split("x"))
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = rx, ry, 100
sc.view_settings.view_transform = "AgX"; tryset(sc.view_settings, "look", "AgX - Medium High Contrast"); sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 92
sc.view_layers[0].use_pass_mist = True

# compositor: aerial haze from the mist pass, a soft glow, a touch of lens vignette
sc.use_nodes = True; ct = sc.node_tree
for n in list(ct.nodes): ct.nodes.remove(n)
rl = ct.nodes.new("CompositorNodeRLayers"); out = ct.nodes.new("CompositorNodeComposite")
mm = ct.nodes.new("CompositorNodeMath"); mm.operation = "MULTIPLY"; mm.inputs[1].default_value = 0.55; ct.links.new(rl.outputs["Mist"], mm.inputs[0])
hz = ct.nodes.new("CompositorNodeMixRGB"); hz.inputs[2].default_value = (*srgb("#c9c6ba"), 1)
ct.links.new(mm.outputs[0], hz.inputs[0]); ct.links.new(rl.outputs["Image"], hz.inputs[1])
gl = ct.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "MEDIUM"; tryset(gl, "mix", -0.85); tryset(gl, "threshold", 0.9); tryset(gl, "size", 8)
ct.links.new(hz.outputs[0], gl.inputs[0])
lens = ct.nodes.new("CompositorNodeLensdist")
for k, v in (("Dispersion", 0.004), ("Distort", -0.004), ("Distortion", -0.004)):
    if k in lens.inputs: lens.inputs[k].default_value = v
ct.links.new(gl.outputs[0], lens.inputs[0]); ct.links.new(lens.outputs[0], out.inputs[0])

bpy.context.view_layer.update()
if arg("--save"): bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(arg("--save")))
if arg("--anim"):
    od = arg("--out", os.path.join(HERE, "frames")); os.makedirs(od, exist_ok=True)
    sc.render.filepath = os.path.join(od, "f####"); sc.frame_step = int(arg("--anim"))
    sc.render.use_overwrite = False; sc.render.use_placeholder = True
    if arg("--range"): sc.frame_start, sc.frame_end = (int(x) for x in arg("--range").split("-"))
    bpy.ops.render.render(animation=True)
if arg("--test"):
    od = arg("--out", os.path.join(HERE, "test")); os.makedirs(od, exist_ok=True)
    for fr in [int(x) for x in arg("--test").split(",")]:
        sc.frame_set(fr); sc.render.filepath = os.path.join(od, "f%04d.jpg" % fr)
        bpy.ops.render.render(write_still=True)
        print("rendered", fr, flush=True)
