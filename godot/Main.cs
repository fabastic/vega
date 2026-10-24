// The application: one life (village, room, after), the places it happens in 3D, the mind as a place of its own,
// an orbit camera that follows him between them, and the shell over the top.
using Godot;
using Vega.Mind;
using Vega.Sim;
using Vega.UI;
using Vega.View;

namespace Vega;

public partial class Main : Node3D
{
    public Run R; public Voice Voice; public float Speed = .25f;   // sim hours per real second
    RoomView room; VillageView village; MindView mind; Camera3D cam; Shell shell; WorldEnvironment env; DirectionalLight3D sun;
    Environment indoor, outdoor; ProceduralSkyMaterial sky;
    public static readonly Vector3 RoomAt = new(0, 0, 400), MindAt = new(0, 0, -600);
    public string Place = "watch";
    Vector3 focus; float yaw = .7f, pitch = -.55f, dist = 9, yawT = .7f, pitchT = -.55f, distT = 14;
    Vector3? mindFocus; bool dragging; float acc;

    public override void _Ready()
    {
        if (FileAccess.FileExists("res://voice.bin")) { using var f = FileAccess.Open("res://voice.bin", FileAccess.ModeFlags.Read); Voice = Voice.Load(new System.IO.MemoryStream(f.GetBuffer((long)f.GetLength()))); }
        indoor = new Environment { BackgroundMode = Environment.BGMode.Color, BackgroundColor = new Color(.13f, .135f, .15f), AmbientLightSource = Environment.AmbientSource.Color, AmbientLightColor = new Color(.8f, .82f, .85f), AmbientLightEnergy = .35f,
            TonemapMode = Environment.ToneMapper.Filmic, SsaoEnabled = true, SsaoRadius = .6f, SsaoIntensity = 1.4f, GlowEnabled = true, GlowIntensity = .4f };
        sky = new ProceduralSkyMaterial();
        outdoor = new Environment { BackgroundMode = Environment.BGMode.Sky, Sky = new Sky { SkyMaterial = sky }, AmbientLightSource = Environment.AmbientSource.Sky, AmbientLightEnergy = .6f,
            TonemapMode = Environment.ToneMapper.Aces, TonemapExposure = 1.05f, SsaoEnabled = true, SsaoRadius = 1.2f, SsaoIntensity = 1.6f, SsilEnabled = true, SsilIntensity = .8f,
            GlowEnabled = true, GlowIntensity = .5f, GlowBloom = .05f, FogEnabled = true, FogDensity = .003f, FogLightColor = new Color(.7f, .75f, .8f), FogAerialPerspective = .6f,
            AdjustmentEnabled = true, AdjustmentSaturation = 1.08f, AdjustmentContrast = 1.04f };
        env = new WorldEnvironment { Environment = outdoor }; AddChild(env);
        sun = new DirectionalLight3D { ShadowEnabled = true, DirectionalShadowMaxDistance = 90, DirectionalShadowMode = DirectionalLight3D.ShadowMode.Parallel4Splits, ShadowBlur = 1.5f, LightAngularDistance = .6f }; AddChild(sun);
        cam = new Camera3D { Fov = 45, Far = 1500 }; AddChild(cam);
        village = new VillageView(); AddChild(village);
        room = new RoomView { Position = RoomAt }; AddChild(room);
        mind = new MindView { Position = MindAt }; AddChild(mind);
        var layer = new CanvasLayer(); AddChild(layer);
        shell = new Shell { Host = this };
        Restart(new Settings(), build: false);
        layer.AddChild(shell);
    }

    public void Restart(Settings s, bool build = true)
    {
        R = new Run(s, Voice);
        village.Build(R); mind.Bind(R.Brain); mind.Voiced = Voice != null;
        if (build) shell.Go("");
    }

    public void Focus(string place) { Place = place; mindFocus = null; if (place == "mind") { distT = 15; yawT = 0; pitchT = -.12f; } else { distT = R?.Phase == Phase.Chamber ? 4 + R.Chamber.RS * 2.2f : 16; pitchT = -.55f; } }
    public void FocusMind(Vector3 at) { mindFocus = MindAt + at; distT = 6; yawT = 0; pitchT = -.12f; }

    // for checking the look without a person at the window:
    //   godot -- --shot=out.png --place=mind --hours=60 --god=photo,rat
    int frames; string shotPath;
    void Shot()
    {
        if (frames++ == 0)
            foreach (var a in OS.GetCmdlineUserArgs())
            {
                var (k, v) = a.Contains('=') ? (a[..a.IndexOf('=')], a[(a.IndexOf('=') + 1)..]) : (a, "");
                if (k == "--shot") shotPath = v;
                if (k == "--story") shell.StartPreset(int.Parse(v));
                if (k == "--hours") while (R.Hours < float.Parse(v, System.Globalization.CultureInfo.InvariantCulture) && !R.Done) R.Step(Preview.Dt);
                if (k == "--god") foreach (var g in v.Split(',')) R.God(Run.Acts.Find(x => x.Key == g));
                if (k == "--place") shell.Go(v);
            }
        if (shotPath != null && frames == 120) { GetViewport().GetTexture().GetImage().SavePng(shotPath); GetTree().Quit(); }
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventMouseButton mb)
        {
            if (mb.ButtonIndex is MouseButton.Left or MouseButton.Right) dragging = mb.Pressed;
            if (mb.ButtonIndex == MouseButton.WheelUp) distT = Mathf.Max(2, distT * .9f);
            if (mb.ButtonIndex == MouseButton.WheelDown) distT = Mathf.Min(120, distT * 1.1f);
        }
        if (e is InputEventMouseMotion mm && dragging) { yawT -= mm.Relative.X * .006f; pitchT = Mathf.Clamp(pitchT - mm.Relative.Y * .005f, -1.4f, .3f); }
    }

    Phase lastPhase = Phase.Life;
    public override void _Process(double delta)
    {
        float dt = (float)delta;
        // fixed steps of a quarter sim hour, so a run is the same at every speed
        acc += Speed * dt; int n = 0;
        while (acc >= Preview.Dt && n++ < 80 && !R.Done) { R.Step(Preview.Dt); acc -= Preview.Dt; }
        if (n >= 80) acc = 0;
        if (R.Chamber != null && room.Built != R.Chamber) room.Build(R);
        if (R.Phase != lastPhase) { lastPhase = R.Phase; Focus(Place); shell.PhaseChanged(); }
        Shot();

        bool inRoom = R.Phase == Phase.Chamber || R.DiedInRoom;
        env.Environment = inRoom || Place == "mind" ? indoor : outdoor;
        float day = R.World.Daylight;
        float hour = R.Hours % 24;
        sun.Visible = !inRoom && Place != "mind";
        sun.Rotation = new Vector3(-Mathf.Lerp(.05f, 1.2f, day), (hour - 12) / 12f * 1.5f, 0);
        sun.LightEnergy = .05f + day * 1.1f;
        sun.LightColor = new Color(1, .75f, .55f).Lerp(new Color(1, .97f, .92f), day);
        sky.SkyTopColor = new Color(.05f, .07f, .14f).Lerp(new Color(.32f, .52f, .8f), day).Lerp(new Color(.3f, .32f, .35f), R.World.StormT > 0 ? .7f : 0);
        sky.SkyHorizonColor = new Color(.15f, .14f, .2f).Lerp(new Color(.7f, .78f, .85f), day);
        outdoor.AmbientLightEnergy = .15f + day * .5f;

        Vector3 focusT = Place == "mind" ? mindFocus ?? MindAt + new Vector3(1.5f, 0, 0) : inRoom ? RoomAt + room.VegaAt * .6f + new Vector3(0, .9f, 0) : village.VegaAt + new Vector3(0, 1, 0);
        float k = 1 - Mathf.Exp(-dt * 4);
        if (focus.DistanceTo(focusT) > 150) focus = focusT;   // a different place: cut, don't fly
        focus = focus.Lerp(focusT, k); yaw = Mathf.LerpAngle(yaw, yawT, k); pitch = Mathf.Lerp(pitch, pitchT, k); dist = Mathf.Lerp(dist, distT, k);
        var off = new Vector3(Mathf.Sin(yaw) * Mathf.Cos(pitch), -Mathf.Sin(pitch), Mathf.Cos(yaw) * Mathf.Cos(pitch)) * dist;
        cam.Position = focus + off; cam.LookAt(focus, Vector3.Up);
        // the panel covers the right of the screen, so frame the subject in the space left of it
        cam.HOffset = Mathf.Lerp(cam.HOffset, Place == "mind" ? 0 : dist * .17f, k);
        mind.Visible = Place == "mind";
    }
}
