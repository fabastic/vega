// The world outside in 3D: three villages, forest, the neighbours going about their day, and Vega. After the room
// the same place is drawn as he finds it: houses fallen in, bodies, the graves he digs, what he builds.
using System.Collections.Generic;
using System.Linq;
using Godot;
using Vega.Mind;
using Vega.Sim;
using V2 = System.Numerics.Vector2;

namespace Vega.View;

public partial class VillageView : Node3D
{
    Run r; World w;
    VegaFigure vega; readonly Dictionary<Person, VegaFigure> figs = new(); readonly Dictionary<Person, Label3D> names = new();
    readonly Dictionary<Person, Node3D> graves = new();
    readonly List<(House h, Node3D node, Node3D roof, StandardMaterial3D wall)> houses = new();
    readonly List<Node3D> built = new(); readonly List<Node3D> wolves = new();
    Node3D lanterns; Vector3 vis; float visYaw; Label3D bubble; MeshInstance3D bubbleBg; int lastLog; float bubbleT;
    public Vector3 VegaAt => vis;

    static Vector3 P(V2 v, float y = 0) => new(v.X, y, v.Y);
    static StandardMaterial3D M(Color c, float rough = .9f) => new() { AlbedoColor = c, Roughness = rough };
    static MeshInstance3D Mesh(Node3D p, Mesh m, Material mat, Vector3 at)
    {
        var mi = new MeshInstance3D { Mesh = m, MaterialOverride = mat, Position = at }; p.AddChild(mi); return mi;
    }

    public void Build(Run run)
    {
        foreach (var ch in GetChildren()) ch.QueueFree();
        lastLog = 0; figs.Clear(); names.Clear(); graves.Clear(); houses.Clear(); built.Clear(); wolves.Clear();
        r = run; w = run.World;
        Mesh(this, new PlaneMesh { Size = new Vector2(400, 400) }, Grass(), new Vector3(0, 0, -20));
        // tufts of grass, so the ground has texture up close
        var tuft = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseColors = true, InstanceCount = 6000, Mesh = new PrismMesh { Size = new Vector3(.12f, .35f, .02f) } };
        var trng = new RandomNumberGenerator { Seed = 11 };
        for (int i = 0; i < tuft.InstanceCount; i++)
        {
            var at = new Vector3(trng.RandfRange(-140, 140), .15f, trng.RandfRange(-150, 110));
            if (w.Villages.Any(v => new Vector2(at.X - v.At.X, at.Z - v.At.Y).Length() < 10)) at.Y = -5;
            tuft.SetInstanceTransform(i, new Transform3D(new Basis(Vector3.Up, trng.Randf() * Mathf.Tau).Scaled(Vector3.One * trng.RandfRange(.7f, 1.6f)), at));
            tuft.SetInstanceColor(i, new Color(.3f, .48f, .2f).Lerp(new Color(.55f, .6f, .28f), trng.Randf()));
        }
        AddChild(new MultiMeshInstance3D { Multimesh = tuft, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off, MaterialOverride = new StandardMaterial3D { VertexColorUseAsAlbedo = true, Roughness = 1, CullMode = BaseMaterial3D.CullModeEnum.Disabled } });
        foreach (var v in w.Villages)
        {
            Mesh(this, new CylinderMesh { TopRadius = 9, BottomRadius = 9, Height = .04f }, M(new Color(.78f, .72f, .6f)), P(v.At, .02f));
            Mesh(this, new CylinderMesh { TopRadius = .8f, BottomRadius = .9f, Height = .8f }, M(new Color(.55f, .53f, .5f)), P(v.At, .4f));
            // fields outside the village
            for (int k = 0; k < 4; k++)
            {
                var a = k * Mathf.Pi / 2 + .4f; var at = v.At + new V2(Mathf.Cos(a), Mathf.Sin(a)) * 32;
                Mesh(this, new BoxMesh { Size = new Vector3(14, .05f, 9) }, M(new Color(.62f, .55f, .3f)), P(at, .03f)).Rotation = new Vector3(0, a, 0);
            }
            foreach (var h in v.Houses) houses.Add(House(h));
            Chapel(v);
        }
        Mesh(this, new BoxMesh { Size = new Vector3(3, 1.6f, 2.4f) }, M(new Color(.5f, .38f, .26f)), P(w.Workshop, .8f));
        // the lake the fishers work by
        Mesh(this, new CylinderMesh { TopRadius = 14, BottomRadius = 14, Height = .05f }, new StandardMaterial3D { AlbedoColor = new Color(.25f, .42f, .55f), Roughness = .15f, Metallic = .2f }, new Vector3(0, .04f, 46));

        var trunks = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, InstanceCount = w.Trees.Count, Mesh = new CylinderMesh { TopRadius = .18f, BottomRadius = .25f, Height = 2.2f } };
        var crowns = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseColors = true, InstanceCount = w.Trees.Count, Mesh = new SphereMesh { Radius = 1.6f, Height = 3.6f, RadialSegments = 8, Rings = 5 } };
        var rnd = new RandomNumberGenerator { Seed = 7 };
        for (int i = 0; i < w.Trees.Count; i++)
        {
            float s = rnd.RandfRange(.8f, 1.5f);
            trunks.SetInstanceTransform(i, new Transform3D(Basis.Identity.Scaled(Vector3.One * s), P(w.Trees[i], 1.1f * s)));
            crowns.SetInstanceTransform(i, new Transform3D(Basis.Identity.Scaled(Vector3.One * s), P(w.Trees[i], 3.4f * s)));
            crowns.SetInstanceColor(i, new Color(.22f, .4f, .2f).Lerp(new Color(.38f, .5f, .22f), rnd.Randf()));
        }
        // trees dissolve when the camera comes close, so they never wall off the view of him
        AddChild(new MultiMeshInstance3D { Multimesh = trunks, MaterialOverride = Fade(M(new Color(.35f, .25f, .17f))) });
        AddChild(new MultiMeshInstance3D { Multimesh = crowns, MaterialOverride = Fade(new StandardMaterial3D { VertexColorUseAsAlbedo = true, Roughness = .9f }) });
        var bush = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, InstanceCount = w.Bushes.Count, Mesh = new SphereMesh { Radius = .7f, Height = 1f } };
        for (int i = 0; i < w.Bushes.Count; i++) bush.SetInstanceTransform(i, new Transform3D(Basis.Identity, P(w.Bushes[i], .4f)));
        AddChild(new MultiMeshInstance3D { Multimesh = bush, MaterialOverride = M(new Color(.25f, .42f, .22f)) });

        foreach (var p in w.People)
        {
            var c = Color.FromHsv(p.Shirt, .45f, .7f);
            var f = new VegaFigure { Female = p.Female, Age = p.Age, HairStyle = p.Hair, Beard = p.Beard, Dress = p.Dress, Shirt = c, Pants = Color.FromHsv(p.Shirt + .5f, .2f, .35f), Hair = Color.FromHsv(.08f, .5f, .15f + p.Height * .2f), Skin = Color.FromHsv(.07f, .35f + (p.Id % 4) * .08f, .85f - (p.Id % 5) * .1f), Scale = Vector3.One * p.Height };
            AddChild(f); figs[p] = f;
            var l = new Label3D { Text = p.Name, FontSize = 32, PixelSize = .005f, Billboard = BaseMaterial3D.BillboardModeEnum.Enabled, Modulate = new Color(1, 1, 1, .85f), OutlineSize = 8, Position = new Vector3(0, 2.1f, 0), NoDepthTest = false };
            f.AddChild(l); names[p] = l;
        }
        vega = new VegaFigure { Shirt = new Color(.86f, .86f, .83f), Beard = true }; AddChild(vega);
        bubble = new Label3D { FontSize = 40, PixelSize = .0032f, Billboard = BaseMaterial3D.BillboardModeEnum.Enabled, OutlineSize = 0, Modulate = new Color(.1f, .1f, .12f), Position = new Vector3(0, 2.75f, .01f), Width = 560, AutowrapMode = TextServer.AutowrapMode.WordSmart, NoDepthTest = true, RenderPriority = 10 };
        bubbleBg = new MeshInstance3D { Mesh = new QuadMesh { Size = new Vector2(1.9f, .4f) }, MaterialOverride = new StandardMaterial3D { AlbedoColor = new Color(1, 1, 1, .92f), Transparency = BaseMaterial3D.TransparencyEnum.Alpha, ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded, BillboardMode = BaseMaterial3D.BillboardModeEnum.Enabled, NoDepthTest = true, RenderPriority = 9 }, Position = new Vector3(0, 2.75f, 0) };
        vega.AddChild(bubbleBg); vega.AddChild(bubble);
        vega.AddChild(new Label3D { Text = "Vega", FontSize = 36, PixelSize = .006f, Billboard = BaseMaterial3D.BillboardModeEnum.Enabled, OutlineSize = 10, Position = new Vector3(0, 2.2f, 0), Modulate = new Color(1, .95f, .8f) });
        lanterns = new Node3D(); AddChild(lanterns);
        for (int i = 0; i < 12; i++)
        {
            var a = i * Mathf.Tau / 12; var at = w.Villages[0].At + new V2(Mathf.Cos(a), Mathf.Sin(a)) * 7;
            Mesh(lanterns, new SphereMesh { Radius = .18f, Height = .36f }, new StandardMaterial3D { AlbedoColor = new Color(1, .8f, .4f), EmissionEnabled = true, Emission = new Color(1, .7f, .3f), EmissionEnergyMultiplier = 4 }, P(at, 2.6f));
        }
        vis = P(w.Pos);
    }

    (House, Node3D, Node3D, StandardMaterial3D) House(House h)
    {
        var g = new Node3D { Position = P(h.At), Rotation = new Vector3(0, h.Yaw, 0) }; AddChild(g);
        var wall = M(Color.FromHsv((h.At.X * .013f) % 1 * .15f + .05f, .25f, .82f));
        float W = 4.6f, D = 4, H = 2.6f, T = .15f;
        // four walls, so with the roof lifted you can see in from above
        Mesh(g, new BoxMesh { Size = new Vector3(W, H, T) }, wall, new Vector3(0, H / 2, -D / 2));
        Mesh(g, new BoxMesh { Size = new Vector3(T, H, D) }, wall, new Vector3(-W / 2, H / 2, 0));
        Mesh(g, new BoxMesh { Size = new Vector3(T, H, D) }, wall, new Vector3(W / 2, H / 2, 0));
        Mesh(g, new BoxMesh { Size = new Vector3((W - 1) / 2, H, T) }, wall, new Vector3(-(W + 1) / 4, H / 2, D / 2));
        Mesh(g, new BoxMesh { Size = new Vector3((W - 1) / 2, H, T) }, wall, new Vector3((W + 1) / 4, H / 2, D / 2));
        Mesh(g, new BoxMesh { Size = new Vector3(1, .5f, T) }, wall, new Vector3(0, H - .25f, D / 2));
        Mesh(g, new BoxMesh { Size = new Vector3(W - .3f, .05f, D - .3f) }, M(new Color(.55f, .42f, .3f)), new Vector3(0, .03f, 0));
        Mesh(g, new BoxMesh { Size = new Vector3(.9f, .35f, 1.9f) }, M(new Color(.85f, .84f, .8f)), new Vector3(-W / 2 + .7f, .18f, -.6f));
        var roof = new Node3D { Position = new Vector3(0, H, 0) }; g.AddChild(roof);
        float hue = Mathf.PosMod(h.At.Y * .01f, 1), val = Mathf.PosMod(h.At.X * .007f, 1);
        Mesh(roof, new PrismMesh { Size = new Vector3(W + .5f, 1.5f, D + .5f) }, M(Color.FromHsv(.02f + hue * .05f, .55f, .3f + val * .2f)), new Vector3(0, .75f, 0));
        Mesh(roof, new BoxMesh { Size = new Vector3(.4f, 1, .4f) }, M(new Color(.45f, .4f, .38f)), new Vector3(W * .28f, .9f, -.6f));   // chimney
        var glass = new StandardMaterial3D { AlbedoColor = new Color(.18f, .22f, .26f), Roughness = .1f, Metallic = .3f };
        var trim = M(new Color(.92f, .9f, .85f));
        foreach (var (x, z, ry) in new[] { (-W / 2 - .02f, .6f, Mathf.Pi / 2), (W / 2 + .02f, -.6f, Mathf.Pi / 2), (-1.4f, D / 2 + .02f, 0f), (1.4f, D / 2 + .02f, 0f) })
        {
            Mesh(g, new BoxMesh { Size = new Vector3(.8f, .8f, .04f) }, trim, new Vector3(x, 1.45f, z)).Rotation = new Vector3(0, ry, 0);
            Mesh(g, new BoxMesh { Size = new Vector3(.66f, .66f, .06f) }, glass, new Vector3(x, 1.45f, z)).Rotation = new Vector3(0, ry, 0);
        }
        Mesh(g, new BoxMesh { Size = new Vector3(.95f, 2, .06f) }, M(new Color(.4f, .27f, .17f)), new Vector3(0, 1, D / 2 + .02f));   // door
        return (h, g, roof, wall);
    }

    static StandardMaterial3D Fade(StandardMaterial3D m) { m.DistanceFadeMode = BaseMaterial3D.DistanceFadeModeEnum.PixelDither; m.DistanceFadeMinDistance = 6; m.DistanceFadeMaxDistance = 11; return m; }

    const string GrassCode = @"shader_type spatial;
render_mode diffuse_burley;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
  float a = n(wp.xz * .05) * .6 + n(wp.xz * .3) * .3 + n(wp.xz * 2.0) * .1;
  vec3 g1 = vec3(.24, .38, .16), g2 = vec3(.45, .52, .24), dry = vec3(.55, .5, .3);
  ALBEDO = mix(mix(g1, g2, a), dry, smoothstep(.62, .8, n(wp.xz * .02 + 7.0)) * .5);
  ROUGHNESS = .95;
}";
    static ShaderMaterial Grass() => new() { Shader = new Shader { Code = GrassCode } };

    void Chapel(Village v)
    {
        var g = new Node3D { Position = P(v.Chapel) }; AddChild(g);
        var stone = M(new Color(.78f, .76f, .72f));
        Mesh(g, new BoxMesh { Size = new Vector3(5, 3.6f, 7) }, stone, new Vector3(0, 1.8f, -2.5f));
        Mesh(g, new PrismMesh { Size = new Vector3(5.6f, 2, 7.6f) }, M(new Color(.3f, .3f, .34f)), new Vector3(0, 4.6f, -2.5f));
        Mesh(g, new BoxMesh { Size = new Vector3(1.8f, 6.5f, 1.8f) }, stone, new Vector3(0, 3.25f, .6f));
        Mesh(g, new PrismMesh { Size = new Vector3(2, 2.2f, 2) }, M(new Color(.3f, .3f, .34f)), new Vector3(0, 7.6f, .6f));
        var gold = new StandardMaterial3D { AlbedoColor = new Color(.85f, .7f, .35f), Metallic = .8f, Roughness = .3f };
        Mesh(g, new BoxMesh { Size = new Vector3(.12f, 1, .12f) }, gold, new Vector3(0, 9.1f, .6f));
        Mesh(g, new BoxMesh { Size = new Vector3(.6f, .12f, .12f) }, gold, new Vector3(0, 9.3f, .6f));
        Mesh(g, new BoxMesh { Size = new Vector3(1.1f, 2.2f, .1f) }, M(new Color(.35f, .22f, .14f)), new Vector3(0, 1.1f, 1.52f));
        var glow = new StandardMaterial3D { AlbedoColor = new Color(.9f, .7f, .4f), EmissionEnabled = true, Emission = new Color(.9f, .55f, .25f), EmissionEnergyMultiplier = .6f };
        for (int i = 0; i < 3; i++) for (int sd = -1; sd <= 1; sd += 2) Mesh(g, new BoxMesh { Size = new Vector3(.06f, 1.4f, .6f) }, glow, new Vector3(sd * 2.51f, 2.2f, -1 - i * 2));
    }

    static readonly Color DeadSkin = new(.55f, .55f, .52f);

    public override void _Process(double delta)
    {
        if (r == null) return;
        float dt = (float)delta, t = (float)Time.GetTicksMsec() / 1000f;
        bool outside = r.Phase != Phase.Chamber && !r.DiedInRoom;
        Visible = outside; if (!outside) return;

        // Vega
        var target = P(w.Pos); float d = vis.DistanceTo(target); bool walking = d > .05f;
        if (walking) { vis = vis.MoveToward(target, Mathf.Max(2.5f, d * 2) * dt); visYaw = Mathf.LerpAngle(visYaw, Mathf.Atan2(target.X - vis.X, target.Z - vis.Z), dt * 8); }
        vega.Position = vis; vega.Rotation = new Vector3(0, visYaw, 0);
        vega.Animate(VegaFigure.PoseFor(w.Deed, true), walking, dt);

        foreach (var (h, node, roof, wall) in houses)
        {
            bool his = h == w.Home && w.Indoors && vis.DistanceTo(P(h.At)) < 4;
            roof.Visible = !his && !(h.Ruined && h.Tilt > .1f);
            node.Rotation = new Vector3(h.Ruined ? h.Tilt * .3f : 0, h.Yaw, h.Ruined ? h.Tilt : 0);
            wall.AlbedoColor = h.Ruined ? new Color(.45f, .42f, .38f) : wall.AlbedoColor;
        }

        foreach (var (p, f) in figs)
        {
            bool inside = p.Alive && (p.Doing is "sleep" or "home" or "eat" or "shelter") && V2.Distance(p.Pos, p.Home.At) < 2;
            f.Visible = !p.Away && !p.Buried && !inside;
            if (!f.Visible) { if (p.Buried) Grave(p); continue; }
            var to = P(p.Pos); var cur = f.Position; float dd = cur.DistanceTo(to); bool walk = p.Alive && dd > .05f;
            if (walk) { f.Position = cur.MoveToward(to, Mathf.Max(2, dd * 2) * dt); f.Rotation = new Vector3(0, Mathf.LerpAngle(f.Rotation.Y, Mathf.Atan2(to.X - cur.X, to.Z - cur.Z), dt * 6), 0); }
            if (!p.Alive) { f.Position = to; f.Animate("lie", false, dt); names[p].Visible = false; continue; }
            f.Animate(p.Doing is "plaza" or "festival" or "with him" ? "talk" : p.Doing == "work" ? "crouch" : "stand", walk, dt);
            names[p].Visible = f.Position.DistanceTo(vis) < 7;
        }
        foreach (var (p, f) in figs) if (!p.Alive && f.Visible) foreach (var mi in f.FindChildren("*", "MeshInstance3D", true, false).Cast<MeshInstance3D>()) ((StandardMaterial3D)mi.MaterialOverride).AlbedoColor = DeadSkin;

        while (built.Count < w.Built.Count) built.Add(Structure(w.Built[built.Count]));
        while (wolves.Count < w.Wolves.Count)
        {
            var wf = new Node3D(); AddChild(wf);
            Mesh(wf, new BoxMesh { Size = new Vector3(.35f, .4f, 1.1f) }, M(new Color(.33f, .32f, .3f)), new Vector3(0, .55f, 0));
            Mesh(wf, new BoxMesh { Size = new Vector3(.28f, .3f, .4f) }, M(new Color(.3f, .29f, .27f)), new Vector3(0, .75f, .65f));
            wolves.Add(wf);
        }
        for (int i = 0; i < wolves.Count; i++)
        {
            wolves[i].Visible = i < w.Wolves.Count;
            if (i < w.Wolves.Count) { var to = P(w.Wolves[i]); wolves[i].Position = wolves[i].Position.MoveToward(to, 8 * dt); wolves[i].LookAt(vis with { Y = 0 } + new Vector3(0.001f, 0, 0), Vector3.Up, true); }
        }
        lanterns.Visible = w.FestivalT > 0;
        // what he last said hangs over his head for a few seconds
        for (; lastLog < r.Log.Count; lastLog++) if (r.Log[lastLog].Kind == "say" && r.Phase != Phase.Chamber) { bubble.Text = r.Log[lastLog].Text; bubbleT = 6; }
        bubbleT -= dt; bubble.Visible = bubbleBg.Visible = bubbleT > 0;
        if (bubbleT > 0) bubbleBg.Scale = new Vector3(1, 1 + bubble.Text.Length / 45, 1); bubbleBg.Position = bubble.Position + new Vector3(0, (bubbleBg.Scale.Y - 1) * -.1f, -.01f);
    }

    void Grave(Person p)
    {
        if (graves.ContainsKey(p)) return;
        var g = new Node3D { Position = P(p.Pos) }; AddChild(g); graves[p] = g;
        Mesh(g, new BoxMesh { Size = new Vector3(.9f, .25f, 1.9f) }, M(new Color(.38f, .3f, .22f)), new Vector3(0, .12f, 0));
        Mesh(g, new BoxMesh { Size = new Vector3(.08f, 1, .08f) }, M(new Color(.5f, .4f, .3f)), new Vector3(0, .6f, -.8f));
        Mesh(g, new BoxMesh { Size = new Vector3(.5f, .08f, .08f) }, M(new Color(.5f, .4f, .3f)), new Vector3(0, .8f, -.8f));
        g.AddChild(new Label3D { Text = p.Name, FontSize = 32, PixelSize = .008f, Position = new Vector3(0, 1.15f, -.8f), Billboard = BaseMaterial3D.BillboardModeEnum.Enabled, OutlineSize = 6 });
    }

    Node3D Structure(Structure s)
    {
        var g = new Node3D { Position = P(s.At) }; AddChild(g);
        var wood = M(new Color(.52f, .4f, .28f));
        switch (s.Kind)
        {
            case "fence":
                for (int i = 0; i < 6; i++) Mesh(g, new BoxMesh { Size = new Vector3(.1f, 1.1f, .1f) }, wood, new Vector3(-2.5f + i, .55f, 0));
                Mesh(g, new BoxMesh { Size = new Vector3(5.2f, .08f, .06f) }, wood, new Vector3(0, .8f, 0));
                Mesh(g, new BoxMesh { Size = new Vector3(5.2f, .08f, .06f) }, wood, new Vector3(0, .4f, 0));
                g.Rotation = new Vector3(0, s.At.X * .3f, 0); break;
            case "shelter":
                Mesh(g, new BoxMesh { Size = new Vector3(2.6f, .08f, 2.2f) }, wood, new Vector3(0, 1.2f, 0)).Rotation = new Vector3(.5f, 0, 0);
                for (int i = 0; i < 2; i++) Mesh(g, new BoxMesh { Size = new Vector3(.1f, 1.8f, .1f) }, wood, new Vector3(-1.2f + i * 2.4f, .9f, .8f));
                break;
            default:
                Mesh(g, new BoxMesh { Size = new Vector3(3, .1f, 2) }, M(new Color(.36f, .26f, .18f)), new Vector3(0, .05f, 0));
                for (int i = 0; i < 12; i++) Mesh(g, new SphereMesh { Radius = .12f, Height = .24f }, M(new Color(.3f, .55f, .25f)), new Vector3(-1.2f + i % 6 * .48f, .18f, -.5f + i / 6 * 1f));
                break;
        }
        return g;
    }
}
