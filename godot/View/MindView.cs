// His networks as a structure in 3D, left to right in the order a moment flows through them: senses, percept,
// world model (with memory beneath it), feelings, will, thought, voice. Every unit glows with its live activation.
using System.Collections.Generic;
using Godot;
using Vega.Mind;

namespace Vega.View;

public partial class MindView : Node3D
{
    public sealed record Module(string Key, string Title, string What, Vector3 At);
    public static readonly Module[] Modules =
    {
        new("senses", "Senses", "Twenty readings from the room and his body: light, noise, the tray, hunger, company and so on. Left: what is there. Right: what he perceives. When his grip loosens, the right column drifts away from the left.", new(-7, 0, 0)),
        new("percept", "SenseNet", "A fixed projection of what he perceives into 32 units: an early sensory layer.", new(-4.5f, 0, 0)),
        new("world", "WorldNet", "A recurrent network (GRU, 64 units) that carries the moment forward. Its prediction head learns online to predict his next senses, and the error is surprise. In a flat room his percepts lean on these predictions, and on the senses of whatever he is remembering. That is how hallucinations arise here.", new(-1.5f, 0, 0)),
        new("memory", "MemoryNet", "Episodes written when something mattered (a big change in wellbeing). Recalled by attention on the current world state. The bright one is what he is remembering now.", new(-1.5f, -3.4f, 0)),
        new("feel", "FeelNet", "Sixteen feelings. An appraisal prior on his senses plus a residual on his world state, conditioned by what followed: states that came before things got worse learn to feel like fear and dread.", new(2, 0, 0)),
        new("will", "WillNet", "Innate drives plus a learned policy over thirteen acts, trained by REINFORCE on whether an act left him better or worse off. Acts done too often lose their pull for a while.", new(5, 0, 0)),
        new("thought", "ThoughtNet", "World state, feelings, what he recalls, what he perceives and what he is doing, folded into a 48-unit thought vector.", new(8, 0, 0)),
        new("voice", "VoiceNet", "A word-level GRU decoder that turns the thought vector into words. Not trained yet: until it is, he says nothing. There are no stand-in lines.", new(10.5f, 0, 0)),
    };

    MultiMeshInstance3D sensesReal, sensesSeen, percept, world, memory, thought, will;
    readonly List<MeshInstance3D> feelBars = new(); readonly List<Label3D> willLabels = new();
    Label3D voiceLabel; ImmediateMesh links; MeshInstance3D linkMesh;
    Brain b; public bool Voiced;

    static MultiMeshInstance3D Grid(Node3D p, int n, int cols, float gap, Vector3 at, float size, bool cube = false)
    {
        var mm = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseColors = true, InstanceCount = n,
            Mesh = cube ? new BoxMesh { Size = Vector3.One * size } : new SphereMesh { Radius = size / 2, Height = size, RadialSegments = 10, Rings = 6 } };
        int rows = (n + cols - 1) / cols;
        for (int i = 0; i < n; i++)
        {
            int cx = i % cols, cy = i / cols;
            mm.SetInstanceTransform(i, new Transform3D(Basis.Identity, new Vector3((cx - (cols - 1) / 2f) * gap, ((rows - 1) / 2f - cy) * gap, 0)));
            mm.SetInstanceColor(i, new Color(.3f, .3f, .3f));
        }
        var mi = new MultiMeshInstance3D { Multimesh = mm, Position = at, MaterialOverride = new StandardMaterial3D { VertexColorUseAsAlbedo = true, ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded } };
        p.AddChild(mi); return mi;
    }
    static Label3D Text(Node3D p, string s, Vector3 at, int size = 48, Color? col = null, HorizontalAlignment align = HorizontalAlignment.Center)
    {
        var l = new Label3D { Text = s, Position = at, FontSize = size, PixelSize = .004f, Modulate = col ?? new Color(.85f, .86f, .88f), HorizontalAlignment = align, OutlineSize = 0, Billboard = BaseMaterial3D.BillboardModeEnum.Disabled };
        p.AddChild(l); return l;
    }

    public override void _Ready()
    {
        // a dark stage of its own, so the mind reads as a separate place
        var floor = new MeshInstance3D { Mesh = new PlaneMesh { Size = new Vector2(26, 14) }, Position = new Vector3(1.5f, -5.5f, 0), MaterialOverride = new StandardMaterial3D { AlbedoColor = new Color(.06f, .065f, .08f), Roughness = 1 } };
        AddChild(floor);
        foreach (var m in Modules) Text(this, m.Title, m.At + new Vector3(0, m.Key == "memory" ? 1.6f : 2.9f, 0), 64, new Color(.95f, .9f, .8f));
        sensesReal = Grid(this, Brain.S, 1, .26f, Modules[0].At + new Vector3(-.2f, 0, 0), .18f);
        sensesSeen = Grid(this, Brain.S, 1, .26f, Modules[0].At + new Vector3(.2f, 0, 0), .18f);
        for (int i = 0; i < Brain.S; i++) Text(this, Brain.SenseNames[i], Modules[0].At + new Vector3(-.4f, ((Brain.S - 1) / 2f - i) * .26f, 0), 28, null, HorizontalAlignment.Right).Position += new Vector3(0, 0, 0);
        percept = Grid(this, Brain.P, 4, .3f, Modules[1].At, .2f);
        world = Grid(this, Brain.H, 8, .3f, Modules[2].At, .2f);
        memory = Grid(this, Brain.MemoryCap, 32, .12f, Modules[3].At, .09f, true);
        for (int i = 0; i < Brain.F; i++)
        {
            float y = ((Brain.F - 1) / 2f - i) * .3f;
            var bar = new MeshInstance3D { Mesh = new BoxMesh { Size = new Vector3(1, .2f, .2f) }, Position = Modules[4].At + new Vector3(0, y, 0), MaterialOverride = new StandardMaterial3D { AlbedoColor = FeelColor(i), EmissionEnabled = true, Emission = FeelColor(i), EmissionEnergyMultiplier = .6f } };
            AddChild(bar); feelBars.Add(bar);
            Text(this, Brain.FeelNames[i], Modules[4].At + new Vector3(-.15f, y, 0), 28, null, HorizontalAlignment.Right);
        }
        will = Grid(this, Brain.A, 1, .36f, Modules[5].At, .26f);
        for (int i = 0; i < Brain.A; i++) willLabels.Add(Text(this, Brain.DeedNames[i], Modules[5].At + new Vector3(.3f, ((Brain.A - 1) / 2f - i) * .36f, 0), 28, null, HorizontalAlignment.Left));
        thought = Grid(this, Brain.T, 6, .3f, Modules[6].At, .2f);
        var vbox = new MeshInstance3D { Mesh = new BoxMesh { Size = new Vector3(1.4f, 2.2f, .3f) }, Position = Modules[7].At, MaterialOverride = new StandardMaterial3D { AlbedoColor = new Color(.25f, .2f, .35f, .5f), Transparency = BaseMaterial3D.TransparencyEnum.Alpha } };
        AddChild(vbox);
        voiceLabel = Text(this, "untrained\nsilent", Modules[7].At + new Vector3(0, 0, .2f), 36, new Color(.75f, .7f, .9f));
        links = new ImmediateMesh(); linkMesh = new MeshInstance3D { Mesh = links, MaterialOverride = new StandardMaterial3D { ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded, VertexColorUseAsAlbedo = true, Transparency = BaseMaterial3D.TransparencyEnum.Alpha } };
        AddChild(linkMesh);
    }

    // feelings that hurt are warm, the steadying ones cool, the ones about others violet
    static Color FeelColor(int i) => (Feel)i switch
    {
        Feel.Fear or Feel.Dread or Feel.Despair or Feel.Anger or Feel.Shame or Feel.Grief => new Color(.77f, .2f, .12f),
        Feel.Hope or Feel.Joy or Feel.Calm or Feel.Awe or Feel.Curiosity => new Color(.17f, .5f, .62f),
        Feel.Loneliness or Feel.Longing or Feel.Love => new Color(.45f, .33f, .7f),
        Feel.Grip => new Color(.93f, .93f, .9f), _ => new Color(.66f, .41f, .16f),
    };
    static Color Heat(float v)
    {
        v = Mathf.Clamp(v, -1, 1);
        return v >= 0 ? new Color(.18f, .18f, .2f).Lerp(new Color(1f, .72f, .35f), v) : new Color(.18f, .18f, .2f).Lerp(new Color(.35f, .6f, 1f), -v);
    }

    public void Bind(Brain brain) => b = brain;

    public override void _Process(double delta)
    {
        if (b == null || !Visible) return;
        for (int i = 0; i < Brain.S; i++) { sensesReal.Multimesh.SetInstanceColor(i, Heat(b.Senses[i])); sensesSeen.Multimesh.SetInstanceColor(i, Heat(b.Perceived[i])); }
        for (int i = 0; i < Brain.P; i++) percept.Multimesh.SetInstanceColor(i, Heat(b.Percept[i]));
        for (int i = 0; i < Brain.H; i++) world.Multimesh.SetInstanceColor(i, Heat(b.World[i]));
        for (int i = 0; i < Brain.T; i++) thought.Multimesh.SetInstanceColor(i, Heat(b.Thought[i]));
        for (int i = 0; i < Brain.MemoryCap; i++)
        {
            Color col = i < b.Memory.Count ? (b.Memory[i].Valence >= 0 ? new Color(.25f, .45f, .55f) : new Color(.55f, .25f, .2f)) : new Color(.1f, .1f, .12f);
            if (i == b.Recalled) col = new Color(1, .95f, .7f);
            memory.Multimesh.SetInstanceColor(i, col);
        }
        for (int i = 0; i < Brain.F; i++)
        {
            float v = b.Feelings[i]; var bar = feelBars[i];
            bar.Scale = new Vector3(Mathf.Max(.02f, v) * 1.6f, 1, 1); bar.Position = Modules[4].At + new Vector3(v * .8f, ((Brain.F - 1) / 2f - i) * .3f, 0);
        }
        int top = 0; for (int i = 0; i < Brain.A; i++) if (b.Intent[i] > b.Intent[top]) top = i;
        for (int i = 0; i < Brain.A; i++)
        {
            float p = b.Intent[i]; will.Multimesh.SetInstanceColor(i, Heat(p * 2));
            will.Multimesh.SetInstanceTransform(i, new Transform3D(Basis.Identity.Scaled(Vector3.One * (.5f + p)), new Vector3(0, ((Brain.A - 1) / 2f - i) * .36f, 0)));
            willLabels[i].Modulate = b.LastAction[i] > 0 ? new Color(1, .85f, .5f) : new Color(.6f, .62f, .66f);
        }
        voiceLabel.Text = Voiced ? "trained" : "untrained\nsilent";
        // the flow between networks, pulsing with how surprised he is
        float pulse = .25f + Mathf.Clamp(b.Surprise * 3, 0, .6f);
        links.ClearSurfaces(); links.SurfaceBegin(Mesh.PrimitiveType.Lines);
        void L(int a, int z) { links.SurfaceSetColor(new Color(.9f, .8f, .6f, pulse)); links.SurfaceAddVertex(Modules[a].At + new Vector3(.6f, 0, -.2f)); links.SurfaceSetColor(new Color(.9f, .8f, .6f, pulse * .4f)); links.SurfaceAddVertex(Modules[z].At + new Vector3(-.6f, 0, -.2f)); }
        L(0, 1); L(1, 2); L(2, 4); L(2, 3); L(3, 4); L(4, 5); L(2, 5); L(4, 6); L(5, 6); L(6, 7);
        links.SurfaceEnd();
    }
}
