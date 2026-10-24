// The application: one chamber run, the room and the mind as 3D places, an orbit camera that moves between
// them, and the shell over the top.
using Godot;
using Vega.Mind;
using Vega.Sim;
using Vega.UI;
using Vega.View;

namespace Vega;

public partial class Main : Node3D
{
    public Chamber C; public Voice Voice; public float Speed = .25f;   // sim hours per real second
    RoomView room; MindView mind; Camera3D cam; Shell shell; WorldEnvironment env;
    static readonly Vector3 MindAt = new(60, 0, 0);
    Vector3 focus, focusT; float yaw = .7f, pitch = -.55f, dist = 9, yawT = .7f, pitchT = -.55f, distT = 9;
    bool dragging; float acc;

    public override void _Ready()
    {
        if (FileAccess.FileExists("res://voice.bin")) { using var f = FileAccess.Open("res://voice.bin", FileAccess.ModeFlags.Read); Voice = Voice.Load(new System.IO.MemoryStream(f.GetBuffer((long)f.GetLength()))); }
        env = new WorldEnvironment { Environment = new Environment {
            BackgroundMode = Environment.BGMode.Color, BackgroundColor = new Color(.13f, .135f, .15f),
            AmbientLightSource = Environment.AmbientSource.Color, AmbientLightColor = new Color(.8f, .82f, .85f), AmbientLightEnergy = .35f,
            TonemapMode = Environment.ToneMapper.Filmic, SsaoEnabled = true, SsaoRadius = .6f, SsaoIntensity = 1.4f, GlowEnabled = true, GlowIntensity = .4f } };
        AddChild(env);
        var sun = new DirectionalLight3D { RotationDegrees = new Vector3(-50, 30, 0), LightEnergy = .25f }; AddChild(sun);
        cam = new Camera3D { Fov = 45 }; AddChild(cam);
        room = new RoomView(); AddChild(room);
        mind = new MindView { Position = MindAt }; AddChild(mind);
        var layer = new CanvasLayer(); AddChild(layer);
        shell = new Shell { Host = this };
        Restart(new Settings(), build: false);
        layer.AddChild(shell);
    }

    public void Restart(Settings s, bool build = true)
    {
        C = new Chamber(s, Voice);
        room.Build(C); mind.Bind(C.Brain); mind.Voiced = Voice != null;
        if (build) shell.Go("watch");
    }

    public void Focus(string place)
    {
        if (place == "mind") FocusMind(MindAt + new Vector3(1.5f, 0, 0), 15);
        else { focusT = new Vector3(0, .9f, 0); distT = C != null ? 4 + C.RS * 2.2f : 9; pitchT = -.55f; }
    }
    public void FocusMind(Vector3 at, float d = 6) { focusT = at.X < 30 ? MindAt + at : at; distT = d; yawT = 0; pitchT = -.12f; }

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
                if (k == "--place") shell.Go(v);
                if (k == "--hours") while (C.Hours < float.Parse(v, System.Globalization.CultureInfo.InvariantCulture) && !C.Done) C.Step(Preview.Dt);
                if (k == "--god") foreach (var g in v.Split(',')) C.God(Chamber.Acts.Find(x => x.Key == g));
            }
        if (shotPath != null && frames == 90) { GetViewport().GetTexture().GetImage().SavePng(shotPath); GetTree().Quit(); }
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventMouseButton mb)
        {
            if (mb.ButtonIndex is MouseButton.Left or MouseButton.Right) dragging = mb.Pressed;
            if (mb.ButtonIndex == MouseButton.WheelUp) distT = Mathf.Max(2, distT * .9f);
            if (mb.ButtonIndex == MouseButton.WheelDown) distT = Mathf.Min(40, distT * 1.1f);
        }
        if (e is InputEventMouseMotion mm && dragging) { yawT -= mm.Relative.X * .006f; pitchT = Mathf.Clamp(pitchT - mm.Relative.Y * .005f, -1.4f, .3f); }
    }

    public override void _Process(double delta)
    {
        float dt = (float)delta;
        // fixed steps of a quarter sim hour, so a run is the same at every speed
        acc += Speed * dt; int n = 0;
        while (acc >= Preview.Dt && n++ < 80 && !C.Done) { C.Step(Preview.Dt); acc -= Preview.Dt; }
        if (n >= 80) acc = 0;
        Shot();
        float k = 1 - Mathf.Exp(-dt * 4);
        focus = focus.Lerp(focusT, k); yaw = Mathf.LerpAngle(yaw, yawT, k); pitch = Mathf.Lerp(pitch, pitchT, k); dist = Mathf.Lerp(dist, distT, k);
        var off = new Vector3(Mathf.Sin(yaw) * Mathf.Cos(pitch), -Mathf.Sin(pitch), Mathf.Cos(yaw) * Mathf.Cos(pitch)) * dist;
        cam.Position = focus + off; cam.LookAt(focus, Vector3.Up);
        // the panel covers the right of the screen, so frame the subject in the space left of it
        cam.HOffset = Mathf.Lerp(cam.HOffset, focusT.X > 30 ? 0 : dist * .17f, k);
        mind.Visible = focus.X > 30 || focusT.X > 30;
    }
}
