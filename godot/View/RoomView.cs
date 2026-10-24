// The white chamber in 3D. Built from the run's settings and redrawn from its state each frame. The walls are
// single-sided and face inward, so from outside the camera always looks in.
using System.Collections.Generic;
using Godot;
using Vega.Mind;
using Vega.Sim;

namespace Vega.View;

public partial class RoomView : Node3D
{
    Chamber c;
    VegaFigure vega, phantom;
    OmniLight3D lamp; MeshInstance3D panel, tray, seam, door, books, photo, radio, mirror, rat, ghostTray;
    StandardMaterial3D panelMat, wallMat;
    Node3D tallyRoot; int tallyShown;
    Vector3 vis; float visYaw;
    readonly List<MeshInstance3D> walls = new();

    static MeshInstance3D Box(Node3D p, Vector3 size, Vector3 at, Material m, bool shadow = true)
    {
        var mi = new MeshInstance3D { Mesh = new BoxMesh { Size = size }, MaterialOverride = m, Position = at, CastShadow = shadow ? GeometryInstance3D.ShadowCastingSetting.On : GeometryInstance3D.ShadowCastingSetting.Off };
        p.AddChild(mi); return mi;
    }
    static StandardMaterial3D M(Color c, float rough = .9f) => new() { AlbedoColor = c, Roughness = rough };

    public void Build(Chamber chamber)
    {
        foreach (var ch in GetChildren()) ch.QueueFree();
        walls.Clear(); tallyShown = 0;
        c = chamber; float R = c.RS, H = R > 3 ? 3.4f : 3f;
        var white = M(new Color(.95f, .95f, .93f)); wallMat = M(new Color(.95f, .95f, .93f)); wallMat.CullMode = BaseMaterial3D.CullModeEnum.Back;
        var floor = new MeshInstance3D { Mesh = new PlaneMesh { Size = new Vector2(R * 2, R * 2) }, MaterialOverride = M(new Color(.92f, .92f, .9f)) }; AddChild(floor);
        // four inward-facing walls and a ceiling; from outside, back-face culling makes them see-through
        for (int i = 0; i < 4; i++)
        {
            var q = new MeshInstance3D { Mesh = new QuadMesh { Size = new Vector2(R * 2, H) }, MaterialOverride = wallMat };
            float a = i * Mathf.Pi / 2;
            q.Position = new Vector3(Mathf.Sin(a) * -R, H / 2, Mathf.Cos(a) * -R);
            q.Rotation = new Vector3(0, a, 0);
            AddChild(q); walls.Add(q);
        }
        var ceil = new MeshInstance3D { Mesh = new QuadMesh { Size = new Vector2(R * 2, R * 2) }, MaterialOverride = wallMat, Position = new Vector3(0, H, 0), Rotation = new Vector3(Mathf.Pi / 2, 0, 0) }; AddChild(ceil);
        panelMat = new StandardMaterial3D { AlbedoColor = Colors.White, EmissionEnabled = true, Emission = Colors.White, EmissionEnergyMultiplier = 2 };
        panel = new MeshInstance3D { Mesh = new QuadMesh { Size = new Vector2(R * .6f, R * .6f) }, MaterialOverride = panelMat, Position = new Vector3(0, H - .01f, 0), Rotation = new Vector3(Mathf.Pi / 2, 0, 0) }; AddChild(panel);
        lamp = new OmniLight3D { Position = new Vector3(0, H - .2f, 0), OmniRange = R * 4, LightEnergy = 1.3f, ShadowEnabled = true, LightColor = new Color(1, 1, .98f) }; AddChild(lamp);

        int furnish = c.Cfg.I("room.furnish");
        if (furnish > 0)
        {
            var bed = new Node3D { Position = new Vector3(-R + .55f, 0, -R + 1.15f) }; AddChild(bed);
            Box(bed, new Vector3(.95f, .28f, 2f), new Vector3(0, .14f, 0), M(new Color(.72f, .73f, .72f), .6f));
            Box(bed, new Vector3(.88f, .16f, 1.9f), new Vector3(0, .36f, 0), white);
            Box(bed, new Vector3(.6f, .1f, .32f), new Vector3(0, .48f, -.75f), M(new Color(.98f, .98f, .97f)));
            var toilet = new Node3D { Position = new Vector3(R - .4f, 0, -R + .5f) }; AddChild(toilet);
            toilet.AddChild(new MeshInstance3D { Mesh = new CylinderMesh { TopRadius = .2f, BottomRadius = .16f, Height = .4f }, Position = new Vector3(0, .2f, 0), MaterialOverride = M(new Color(.79f, .8f, .81f), .25f) });
            Box(toilet, new Vector3(.15f, .3f, .38f), new Vector3(.2f, .45f, 0), M(new Color(.79f, .8f, .81f), .25f));
        }
        // the shelf and books are always built and shown when he has books, so God can add them mid-run
        books = new MeshInstance3D(); AddChild(books); books.Position = new Vector3(-R + .2f, 0, R - 1.5f);
        Box(books, new Vector3(.3f, 1.6f, 1.2f), new Vector3(0, .8f, 0), M(new Color(.85f, .82f, .77f)));
        var bookCols = new[] { new Color(.54f, .23f, .17f), new Color(.17f, .35f, .48f), new Color(.36f, .44f, .23f), new Color(.66f, .41f, .16f), new Color(.24f, .24f, .33f) };
        for (int r = 0; r < 3; r++) for (int k = 0; k < 7; k++) Box(books, new Vector3(.2f, .26f, .1f), new Vector3(.1f, .45f + r * .45f, -.45f + k * .15f), M(bookCols[(r * 7 + k) % 5]));

        tray = new MeshInstance3D(); AddChild(tray); tray.Position = new Vector3(0, 0, R - .3f);
        Box(tray, new Vector3(.4f, .03f, .28f), new Vector3(0, .015f, 0), M(new Color(.6f, .6f, .58f)));
        Box(tray, new Vector3(.14f, .06f, .09f), new Vector3(-.08f, .06f, 0), M(new Color(.78f, .61f, .37f)));
        tray.AddChild(new MeshInstance3D { Mesh = new CylinderMesh { TopRadius = .04f, BottomRadius = .035f, Height = .1f }, Position = new Vector3(.1f, .08f, 0), MaterialOverride = M(new Color(.86f, .86f, .84f)) });
        ghostTray = (MeshInstance3D)tray.Duplicate(); AddChild(ghostTray);
        foreach (var ch in ghostTray.GetChildren()) ((MeshInstance3D)ch).MaterialOverride = VegaFigure.Mat(Colors.White, true);

        float dx = Mathf.Min(.8f, R - .8f);
        seam = Box(this, new Vector3(.94f, 2.07f, .005f), new Vector3(dx, 1.035f, -R + .004f), new StandardMaterial3D { AlbedoColor = new Color(.3f, .3f, .29f) }, false);
        Box(seam, new Vector3(.9f, 2.03f, .006f), Vector3.Zero, M(new Color(.95f, .95f, .93f)), false);
        door = Box(this, new Vector3(.92f, 2.05f, .02f), new Vector3(dx, 1.025f, -R + .012f), new StandardMaterial3D { AlbedoColor = new Color(.85f, .88f, .8f), EmissionEnabled = true, Emission = new Color(.9f, .95f, .85f), EmissionEnergyMultiplier = 3 }, false);
        photo = Box(this, new Vector3(.18f, .24f, .02f), new Vector3(R - .35f, .02f, R - .8f), M(new Color(.5f, .42f, .33f)));
        photo.Rotation = new Vector3(-Mathf.Pi / 2, 0, 0);
        radio = Box(this, new Vector3(.3f, .18f, .12f), new Vector3(R - .3f, .09f, R - 1.4f), M(new Color(.25f, .25f, .27f), .4f));
        mirror = Box(this, new Vector3(.6f, .9f, .02f), new Vector3(R - .01f, 1.5f, 0), new StandardMaterial3D { AlbedoColor = new Color(.8f, .85f, .88f), Metallic = 1, Roughness = .05f });
        mirror.Rotation = new Vector3(0, Mathf.Pi / 2, 0);
        rat = new MeshInstance3D { Mesh = new CapsuleMesh { Radius = .04f, Height = .16f }, MaterialOverride = M(new Color(.4f, .36f, .33f)), Rotation = new Vector3(Mathf.Pi / 2, 0, 0) }; AddChild(rat);
        tallyRoot = new Node3D(); AddChild(tallyRoot);

        vega = new VegaFigure(); AddChild(vega);
        phantom = new VegaFigure { Ghost = true }; AddChild(phantom);
        vis = new Vector3(c.X, 0, c.Z);
    }

    public override void _Process(double delta)
    {
        if (c == null) return;
        float dt = (float)delta, R = c.RS, t = (float)Time.GetTicksMsec() / 1000f;
        var s = c.Senses();
        float light = s[(int)Sense.Light];
        lamp.LightEnergy = Mathf.Lerp(.08f, 1.3f, light); panelMat.EmissionEnergyMultiplier = Mathf.Lerp(.05f, 2f, light);
        float w = c.Shrink > 0 ? .92f : 1f; Scale = Scale.Lerp(new Vector3(w, 1, w), dt * 2);

        // he walks in view at a human pace; at high sim speeds the view catches up faster
        var target = new Vector3(c.X, 0, c.Z); float d = vis.DistanceTo(target);
        bool walking = d > .03f;
        if (walking) { vis = vis.MoveToward(target, Mathf.Max(1.2f, d * 3) * dt); visYaw = Mathf.LerpAngle(visYaw, Mathf.Atan2(target.X - vis.X, target.Z - vis.Z), dt * 8); }
        else if (c.Deed == Deed.Sleep) visYaw = Mathf.LerpAngle(visYaw, 0, dt * 4);
        else if (c.Deed is Deed.Search or Deed.Pound or Deed.Tally) visYaw = Mathf.LerpAngle(visYaw, FaceWall(target, R), dt * 4);
        vega.Position = vis; vega.Rotation = new Vector3(0, visYaw, 0);
        vega.Animate(VegaFigure.PoseFor(c.Deed, c.Cfg.I("room.furnish") > 0), walking, dt);

        tray.Visible = c.Tray;
        books.Visible = c.Books; photo.Visible = c.Photo; radio.Visible = c.Radio; mirror.Visible = c.Mirror; rat.Visible = c.Rat;
        if (c.Rat) rat.Position = new Vector3(Mathf.Sin(t * .3f) * (R - .4f), .04f, Mathf.Cos(t * .23f) * (R - .4f));
        seam.Visible = c.SeamFound; door.Visible = c.DoorOpen;
        while (tallyShown < c.Tallies)
        {
            int k = tallyShown++, grp = k / 5, j = k % 5;
            var mark = Box(tallyRoot, new Vector3(j == 4 ? .2f : .012f, j == 4 ? .012f : .18f, .004f), new Vector3(-R + .6f + grp * .3f + (j == 4 ? .06f : j * .04f), 1.4f - (grp / 12) * .3f, R - .003f), M(new Color(.2f, .2f, .2f)), false);
            if (j == 4) mark.Rotation = new Vector3(0, 0, .5f);
        }

        // what his mind adds to the room: a figure, or a tray, made of his expectation
        var (ps, str) = c.Phantom;
        bool showP = str > .15f && ps == Sense.Company; phantom.Visible = showP;
        if (showP) { phantom.Position = new Vector3(Mathf.Sin(t * .1f) * R * .4f, 0, -R * .4f); phantom.Rotation = new Vector3(0, Mathf.Atan2(vis.X - phantom.Position.X, vis.Z - phantom.Position.Z), 0); phantom.Animate("stand", false, dt); }
        ghostTray.Visible = ps == Sense.Tray && str > .15f && !c.Tray; ghostTray.Position = tray.Position;
    }

    static float FaceWall(Vector3 p, float R)
    {
        float dN = p.Z + R, dS = R - p.Z, dE = R - p.X, dW = p.X + R, m = Mathf.Min(Mathf.Min(dN, dS), Mathf.Min(dE, dW));
        return m == dN ? Mathf.Pi : m == dS ? 0 : m == dE ? Mathf.Pi / 2 : -Mathf.Pi / 2;
    }
}
