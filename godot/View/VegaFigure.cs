// Vega as a jointed figure: hips, spine, head, shoulders, elbows, hips and knees as pivots, posed per act and
// blended smoothly between poses.
using System.Collections.Generic;
using Godot;
using Vega.Mind;

namespace Vega.View;

public partial class VegaFigure : Node3D
{
    Node3D body, spine, head, lSh, rSh, lEl, rEl, lHip, rHip, lKn, rKn;
    readonly Dictionary<string, float> cur = new(), tgt = new();
    float walkT;
    public bool Ghost;

    public static StandardMaterial3D Mat(Color c, bool ghost = false, float rough = .8f)
    {
        var m = new StandardMaterial3D { AlbedoColor = c, Roughness = rough };
        if (ghost) { m.Transparency = BaseMaterial3D.TransparencyEnum.Alpha; m.AlbedoColor = new Color(.55f, .45f, .8f, .35f); m.EmissionEnabled = true; m.Emission = new Color(.4f, .3f, .7f); m.ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded; }
        return m;
    }
    static MeshInstance3D Part(Mesh mesh, Material m, Vector3 at, Node3D parent)
    {
        var mi = new MeshInstance3D { Mesh = mesh, MaterialOverride = m, Position = at, CastShadow = GeometryInstance3D.ShadowCastingSetting.On };
        parent.AddChild(mi); return mi;
    }
    static Node3D Pivot(Node3D parent, Vector3 at) { var n = new Node3D { Position = at }; parent.AddChild(n); return n; }

    public override void _Ready()
    {
        var skin = Mat(new Color(.80f, .64f, .52f), Ghost); var shirt = Mat(new Color(.86f, .86f, .83f), Ghost); var pants = Mat(new Color(.36f, .38f, .42f), Ghost); var hair = Mat(new Color(.18f, .14f, .12f), Ghost);
        body = Pivot(this, new Vector3(0, .92f, 0));
        spine = Pivot(body, Vector3.Zero);
        Part(new CapsuleMesh { Radius = .17f, Height = .62f }, shirt, new Vector3(0, .3f, 0), spine);
        head = Pivot(spine, new Vector3(0, .66f, 0));
        Part(new SphereMesh { Radius = .12f, Height = .26f }, skin, new Vector3(0, .1f, 0), head);
        Part(new SphereMesh { Radius = .125f, Height = .16f }, hair, new Vector3(0, .17f, -.015f), head);
        Part(new CylinderMesh { TopRadius = .05f, BottomRadius = .05f, Height = .08f }, skin, new Vector3(0, -.01f, 0), head);
        (lSh, lEl) = Arm(-1, shirt, skin); (rSh, rEl) = Arm(1, shirt, skin);
        (lHip, lKn) = Leg(-1, pants, skin); (rHip, rKn) = Leg(1, pants, skin);
        Pose("stand"); foreach (var kv in tgt) cur[kv.Key] = kv.Value;
    }
    (Node3D, Node3D) Arm(int s, Material shirt, Material skin)
    {
        var sh = Pivot(spine, new Vector3(s * .22f, .55f, 0));
        Part(new CapsuleMesh { Radius = .05f, Height = .32f }, shirt, new Vector3(0, -.14f, 0), sh);
        var el = Pivot(sh, new Vector3(0, -.29f, 0));
        Part(new CapsuleMesh { Radius = .042f, Height = .3f }, skin, new Vector3(0, -.13f, 0), el);
        return (sh, el);
    }
    (Node3D, Node3D) Leg(int s, Material pants, Material skin)
    {
        var hp = Pivot(body, new Vector3(s * .1f, 0, 0));
        Part(new CapsuleMesh { Radius = .07f, Height = .48f }, pants, new Vector3(0, -.22f, 0), hp);
        var kn = Pivot(hp, new Vector3(0, -.45f, 0));
        Part(new CapsuleMesh { Radius = .06f, Height = .46f }, pants, new Vector3(0, -.2f, 0), kn);
        Part(new BoxMesh { Size = new Vector3(.1f, .06f, .2f) }, Mat(new Color(.2f, .2f, .22f), Ghost), new Vector3(0, -.44f, .04f), kn);
        return (hp, kn);
    }

    // joint targets in radians; "y" is the body height and "lie" tips the whole body over
    void Pose(string p)
    {
        foreach (var k in new[] { "spine", "head", "lsh", "rsh", "lshz", "rshz", "lel", "rel", "lhip", "rhip", "lkn", "rkn", "lie" }) tgt[k] = 0;
        tgt["y"] = .92f;
        switch (p)
        {
            case "sit": tgt["y"] = .2f; tgt["lhip"] = tgt["rhip"] = -1.5f; tgt["lkn"] = tgt["rkn"] = 1.5f; tgt["spine"] = .1f; break;
            case "hug": tgt["y"] = .16f; tgt["lhip"] = tgt["rhip"] = -2.3f; tgt["lkn"] = tgt["rkn"] = 2.4f; tgt["spine"] = .45f; tgt["head"] = .5f; tgt["lsh"] = tgt["rsh"] = -.9f; tgt["lel"] = tgt["rel"] = -1.2f; break;
            case "lie": tgt["y"] = .12f; tgt["lie"] = -1.57f; tgt["lsh"] = tgt["rsh"] = .1f; break;
            case "bed": tgt["y"] = .52f; tgt["lie"] = -1.57f; break;
            case "crouch": tgt["y"] = .62f; tgt["lhip"] = tgt["rhip"] = -1f; tgt["lkn"] = tgt["rkn"] = 1.6f; tgt["spine"] = .4f; tgt["rsh"] = -1.4f; tgt["lsh"] = -.6f; break;
            case "pound": tgt["rsh"] = -2.6f; tgt["lsh"] = -2.4f; tgt["rel"] = -.4f; tgt["lel"] = -.4f; tgt["spine"] = .1f; break;
            case "shout": tgt["head"] = -.4f; tgt["spine"] = -.15f; tgt["lsh"] = tgt["rsh"] = -.3f; tgt["lshz"] = -.5f; tgt["rshz"] = .5f; break;
            case "push": tgt["y"] = .32f; tgt["lie"] = 1.45f; tgt["lsh"] = tgt["rsh"] = -1.5f; break;
            case "read": tgt["y"] = .2f; tgt["lhip"] = tgt["rhip"] = -1.5f; tgt["lkn"] = tgt["rkn"] = 1.5f; tgt["head"] = .5f; tgt["lsh"] = tgt["rsh"] = -.8f; tgt["lel"] = tgt["rel"] = -1.1f; break;
            case "write": tgt["rsh"] = -1.6f; tgt["rel"] = -.3f; break;
            case "eat": tgt["y"] = .2f; tgt["lhip"] = tgt["rhip"] = -1.5f; tgt["lkn"] = tgt["rkn"] = 1.5f; tgt["rsh"] = -1.1f; tgt["rel"] = -1.9f; tgt["head"] = .25f; break;
            case "talk": tgt["lsh"] = -.6f; tgt["lel"] = -.6f; tgt["rsh"] = -.3f; break;
        }
    }

    public static string PoseFor(Deed d, bool bed) => d switch
    {
        Deed.Sleep => bed ? "bed" : "lie", Deed.Rest or Deed.Remember => "sit", Deed.Hug => "hug", Deed.Search => "crouch", Deed.Pound => "pound",
        Deed.Shout => "shout", Deed.Exercise => "push", Deed.Read => "read", Deed.Tally => "write", Deed.Eat => "eat", Deed.Talk => "talk", _ => "stand",
    };

    public void Animate(string pose, bool walking, float dt)
    {
        if (walking) pose = "stand";
        Pose(pose);
        float k = 1 - Mathf.Exp(-dt * 6);
        foreach (var kv in tgt) cur[kv.Key] = (cur.TryGetValue(kv.Key, out var v) ? v : 0) + (kv.Value - (cur.TryGetValue(kv.Key, out var v2) ? v2 : 0)) * k;
        float sw = 0, bob = 0, t = (float)Time.GetTicksMsec() / 1000f;
        if (walking) { walkT += dt * 7; sw = Mathf.Sin(walkT) * .6f; bob = Mathf.Abs(Mathf.Sin(walkT)) * .03f; }
        float breathe = Mathf.Sin(t * 1.6f) * .015f;
        if (pose == "push") bob = (Mathf.Sin(t * 4) * .5f + .5f) * .12f;
        if (pose == "pound") { cur["rel"] += Mathf.Sin(t * 9) * .4f; cur["lel"] += Mathf.Sin(t * 9 + 1.6f) * .4f; }
        if (pose == "crouch") cur["rsh"] += Mathf.Sin(t * 2.4f) * .3f;
        if (pose == "hug") cur["spine"] += Mathf.Sin(t * 1.2f) * .05f;
        body.Position = new Vector3(0, cur["y"] + bob, 0);
        body.Rotation = new Vector3(cur["lie"], 0, 0);
        spine.Rotation = new Vector3(cur["spine"] + breathe, 0, 0);
        head.Rotation = new Vector3(cur["head"], 0, 0);
        lSh.Rotation = new Vector3(cur["lsh"] + sw, 0, cur["lshz"]); rSh.Rotation = new Vector3(cur["rsh"] - sw, 0, cur["rshz"]);
        lEl.Rotation = new Vector3(cur["lel"], 0, 0); rEl.Rotation = new Vector3(cur["rel"], 0, 0);
        lHip.Rotation = new Vector3(cur["lhip"] - sw, 0, 0); rHip.Rotation = new Vector3(cur["rhip"] + sw, 0, 0);
        lKn.Rotation = new Vector3(cur["lkn"] + (walking ? Mathf.Max(0, -sw) : 0), 0, 0); rKn.Rotation = new Vector3(cur["rkn"] + (walking ? Mathf.Max(0, sw) : 0), 0, 0);
    }
}
