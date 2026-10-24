// The heads-up layer. Five places, one panel at a time, nothing that scrolls the page:
//   Watch     what he is doing and why, how he feels, his body
//   Mind      the networks in 3D, with what each one does
//   Setup     every setting, what it changes, and a preview that runs the change against the current settings
//   God       interventions grouped by kind, each with its effect measured an hour later
//   Evidence  the experiment's results (milestone 4)
using System;
using System.Linq;
using Godot;
using Vega.Mind;
using Vega.Sim;
using Vega.View;

namespace Vega.UI;

public partial class Shell : Control
{
    public Main Host;
    Label status, deedL, whyL; RichTextLabel strip;
    PanelContainer panel; VBoxContainer body;
    Bars feelBars, bodyBars, mindBars; Label facts, mindLive, voiceNote;
    string place = "watch";
    readonly System.Collections.Generic.Dictionary<string, Button> rail = new();
    Settings draft; Label previewOut; Spark sparkGrip, sparkFear; Button applyBtn;
    VBoxContainer godLog; int godShown = -1;

    public override void _Ready()
    {
        Theme = Pal.Build();
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect); MouseFilter = MouseFilterEnum.Ignore;

        // top bar
        var top = new PanelContainer(); AddChild(top);
        top.SetAnchorsPreset(LayoutPreset.TopWide); top.OffsetLeft = 12; top.OffsetRight = -12; top.OffsetTop = 10;
        var th = new HBoxContainer(); th.AddThemeConstantOverride("separation", 14); top.AddChild(th);
        th.AddChild(Pal.L("VEGA", 20, Pal.Ink)); th.AddChild(Pal.L("the white room", 13, Pal.Ink2));
        th.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
        status = Pal.L("", 14, Pal.Ink); th.AddChild(status);
        th.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
        var sg = new ButtonGroup();
        foreach (var (label, sp) in new[] { ("Pause", 0f), ("1x", .25f), ("4x", 1f), ("16x", 4f), ("64x", 16f) })
        {
            var b = new Button { Text = label, ToggleMode = true, ButtonGroup = sg, ButtonPressed = sp == .25f, TooltipText = sp == 0 ? "Pause" : $"{sp:0.##} sim hours per second" };
            b.Pressed += () => Host.Speed = sp; th.AddChild(b);
        }

        // left rail
        var railBox = new PanelContainer(); AddChild(railBox);
        railBox.SetAnchorsPreset(LayoutPreset.TopLeft); railBox.OffsetLeft = 12; railBox.OffsetTop = 74;
        var rv = new VBoxContainer(); rv.AddThemeConstantOverride("separation", 6); railBox.AddChild(rv);
        var rg = new ButtonGroup();
        foreach (var (key, label) in new[] { ("watch", "Watch"), ("mind", "Mind"), ("setup", "Setup"), ("god", "God"), ("evidence", "Evidence") })
        {
            var b = new Button { Text = label, ToggleMode = true, ButtonGroup = rg, CustomMinimumSize = new Vector2(96, 36), ButtonPressed = key == place };
            b.Pressed += () => Go(key); rv.AddChild(b); rail[key] = b;
        }

        // the one panel
        panel = new PanelContainer(); AddChild(panel);
        panel.SetAnchorsPreset(LayoutPreset.RightWide); panel.OffsetLeft = -440; panel.OffsetRight = -12; panel.OffsetTop = 74; panel.OffsetBottom = -12;
        body = new VBoxContainer(); body.AddThemeConstantOverride("separation", 10); panel.AddChild(body);

        // event strip
        var bottom = new PanelContainer(); AddChild(bottom);
        bottom.SetAnchorsPreset(LayoutPreset.BottomWide); bottom.OffsetLeft = 124; bottom.OffsetRight = -452; bottom.OffsetTop = -112; bottom.OffsetBottom = -12;
        strip = new RichTextLabel { BbcodeEnabled = true, ScrollActive = false, FitContent = false }; bottom.AddChild(strip);
        strip.AddThemeFontSizeOverride("normal_font_size", 13);

        Go("watch");
    }

    public void Go(string key)
    {
        place = key; rail[key].ButtonPressed = true;
        foreach (Node n in body.GetChildren()) n.QueueFree();
        feelBars = bodyBars = mindBars = null; previewOut = null; godLog = null; godShown = -1;
        Host.Focus(key);
        switch (key)
        {
            case "watch": BuildWatch(); break;
            case "mind": BuildMind(); break;
            case "setup": BuildSetup(); break;
            case "god": BuildGod(); break;
            default: body.AddChild(Pal.Head("Evidence")); body.AddChild(Pal.L("The round 2 and 3 results (the minds in the white room against what sensory deprivation does to people) will be rebuilt here as 3D scenes. This is milestone 4 in PLAN.md.", 14, Pal.Ink2, true)); break;
        }
    }

    // ---------- Watch ----------
    void BuildWatch()
    {
        body.AddChild(Pal.Head("Now"));
        deedL = Pal.L("", 22, Pal.Ink); body.AddChild(deedL);
        whyL = Pal.L("", 12, Pal.Ink2, true); body.AddChild(whyL);
        body.AddChild(new HSeparator());
        body.AddChild(Pal.Head("Strongest feelings")); feelBars = new Bars(); body.AddChild(feelBars);
        body.AddChild(Pal.Head("Body")); bodyBars = new Bars(); body.AddChild(bodyBars);
        body.AddChild(Pal.Head("Hold on reality")); mindBars = new Bars(); body.AddChild(mindBars);
        facts = Pal.L("", 12, Pal.Ink2, true); body.AddChild(facts);
    }

    // ---------- Mind ----------
    void BuildMind()
    {
        body.AddChild(Pal.Head("His networks"));
        body.AddChild(Pal.L("Each one is a separate network with its own job and its own learning signal. Choose one to look at it.", 12, Pal.Ink2, true));
        var grid = new GridContainer { Columns = 2 }; body.AddChild(grid);
        var what = Pal.L(MindView.Modules[2].What, 13, Pal.Ink, true);
        foreach (var m in MindView.Modules)
        {
            var b = new Button { Text = m.Title, SizeFlagsHorizontal = SizeFlags.ExpandFill };
            b.Pressed += () => { what.Text = m.What; Host.FocusMind(m.At); };
            grid.AddChild(b);
        }
        body.AddChild(new HSeparator()); body.AddChild(what);
        body.AddChild(new HSeparator()); body.AddChild(Pal.Head("Live"));
        mindLive = Pal.L("", 12, Pal.Ink, true); body.AddChild(mindLive);
        voiceNote = Pal.L(Host.Voice == null ? "VoiceNet has not been trained, so he does not speak. Every line he says will come from his thought vector, never from a script." : "VoiceNet is trained. What he says comes from his thought vector.", 12, Pal.Mind, true);
        body.AddChild(voiceNote);
    }

    // ---------- Setup ----------
    void BuildSetup()
    {
        draft = Host.C.Cfg.Clone();
        body.AddChild(Pal.Head("Setup"));
        body.AddChild(Pal.L("Change anything, then Preview to see what it does: the same seed is run with your changes and without them.", 12, Pal.Ink2, true));
        var tabs = new TabContainer { CustomMinimumSize = new Vector2(0, 300), SizeFlagsVertical = SizeFlags.ExpandFill }; body.AddChild(tabs);
        foreach (var g in Settings.Groups)
        {
            var scroll = new ScrollContainer { Name = g, HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled }; tabs.AddChild(scroll);
            var v = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill }; v.AddThemeConstantOverride("separation", 4); scroll.AddChild(v);
            foreach (var d in Settings.Defs.Where(d => d.Group == g))
            {
                var row = new HBoxContainer(); v.AddChild(row);
                row.AddChild(Pal.L(d.Label, 14, Pal.Ink)); row.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
                var explain = Pal.L(d.Explain(draft), 12, Pal.Ink2, true);
                if (d.IsChoice)
                {
                    var ob = new OptionButton { CustomMinimumSize = new Vector2(170, 0) };
                    foreach (var o in d.Options) ob.AddItem(o);
                    ob.Selected = draft.I(d.Key);
                    ob.ItemSelected += i => { draft[d.Key] = i; explain.Text = d.Explain(draft); Dirty(); };
                    row.AddChild(ob);
                }
                else
                {
                    var val = Pal.L(draft.Show(d), 13, Pal.Ink);
                    var sl = new HSlider { MinValue = d.Min, MaxValue = d.Max, Step = d.Step, Value = draft[d.Key], CustomMinimumSize = new Vector2(150, 0), SizeFlagsVertical = SizeFlags.ShrinkCenter };
                    sl.ValueChanged += x => { draft[d.Key] = (float)x; val.Text = draft.Show(d); explain.Text = d.Explain(draft); Dirty(); };
                    row.AddChild(sl); row.AddChild(val);
                }
                v.AddChild(explain); v.AddChild(new HSeparator());
            }
        }
        var btns = new HBoxContainer(); body.AddChild(btns);
        var prev = new Button { Text = "Preview", SizeFlagsHorizontal = SizeFlags.ExpandFill }; btns.AddChild(prev);
        applyBtn = new Button { Text = "Restart with these", SizeFlagsHorizontal = SizeFlags.ExpandFill, Disabled = true }; btns.AddChild(applyBtn);
        previewOut = Pal.L("", 12, Pal.Ink, false); previewOut.AddThemeFontOverride("font", new SystemFont { FontNames = new[] { "Consolas", "Menlo", "monospace" } });
        body.AddChild(previewOut);
        var sparks = new HBoxContainer(); body.AddChild(sparks);
        sparkGrip = new Spark { Title = "Grip by day", CustomMinimumSize = new Vector2(0, 70), SizeFlagsHorizontal = SizeFlags.ExpandFill }; sparks.AddChild(sparkGrip);
        sparkFear = new Spark { Title = "Loneliness by day", CustomMinimumSize = new Vector2(0, 70), SizeFlagsHorizontal = SizeFlags.ExpandFill }; sparks.AddChild(sparkFear);
        prev.Pressed += RunPreview;
        applyBtn.Pressed += () => Host.Restart(draft);
    }
    void Dirty() { if (applyBtn != null) applyBtn.Disabled = false; }

    void RunPreview()
    {
        previewOut.Text = "Running both...";
        var cur = Host.C.Cfg.Clone(); var nxt = draft.Clone();
        // both runs on worker threads; the mind has no Godot state, so this is safe
        System.Threading.Tasks.Task.Run(() =>
        {
            var a = Preview.Run(cur); var b = Preview.Run(nxt);
            var lines = Preview.Compare(a, b);
            Callable.From(() =>
            {
                if (previewOut == null || !IsInstanceValid(previewOut)) return;
                previewOut.Text = "Your changes vs now (mean over the run):\n" + string.Join("\n", lines) + "\ngrey: now   violet: with your changes";
                sparkGrip.A = a.DailyGrip; sparkGrip.B = b.DailyGrip; sparkGrip.QueueRedraw();
                sparkFear.A = a.DailyLonely; sparkFear.B = b.DailyLonely; sparkFear.QueueRedraw();
            }).CallDeferred();
        });
    }

    // ---------- God ----------
    void BuildGod()
    {
        body.AddChild(Pal.Head("God mode"));
        body.AddChild(Pal.L("Each act changes what his senses report. An hour after each act, the change in his feelings is measured and listed below.", 12, Pal.Ink2, true));
        var tabs = new TabContainer { CustomMinimumSize = new Vector2(0, 280) }; body.AddChild(tabs);
        foreach (var g in Chamber.GodGroups)
        {
            var v = new VBoxContainer { Name = g }; v.AddThemeConstantOverride("separation", 6); tabs.AddChild(v);
            foreach (var act in Chamber.Acts.Where(a => a.Group == g))
            {
                var b = new Button { Text = act.Label, ToggleMode = act.Active != null, ButtonPressed = act.Active?.Invoke(Host.C) ?? false, Alignment = HorizontalAlignment.Left, TooltipText = act.Desc };
                b.Pressed += () => { Host.C.God(act); if (act.Active != null) b.SetPressedNoSignal(act.Active(Host.C)); };
                v.AddChild(b); v.AddChild(Pal.L(act.Desc, 11, Pal.Ink2, true));
            }
        }
        body.AddChild(Pal.Head("What each act did (1 hour later)"));
        var scroll = new ScrollContainer { SizeFlagsVertical = SizeFlags.ExpandFill, HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled }; body.AddChild(scroll);
        godLog = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill }; scroll.AddChild(godLog);
    }

    void RefreshGodLog()
    {
        var fx = Host.C.GodEffects; int done = fx.Count(e => e.after != null);
        if (done == godShown) return; godShown = done;
        foreach (Node n in godLog.GetChildren()) n.QueueFree();
        foreach (var (h, act, before, after) in fx.AsEnumerable().Reverse().Take(12))
        {
            string eff = after == null ? "measuring..." : string.Join("   ", Enumerable.Range(0, Brain.F).Select(i => (i, d: after[i] - before[i])).OrderByDescending(x => MathF.Abs(x.d)).Take(3)
                .Select(x => $"{Brain.FeelNames[x.i]} {(x.d >= 0 ? "+" : "-")}{MathF.Abs(x.d):0.00}"));
            godLog.AddChild(Pal.L($"Day {(int)(h / 24) + 1} {Clock(h)}  {act}\n    {eff}", 12, Pal.Ink, true));
        }
    }

    static string Clock(float h) => $"{(int)(h % 24):00}:{(int)(h * 60 % 60):00}";

    public override void _Process(double delta)
    {
        var c = Host.C; if (c == null) return; var b = c.Brain;
        status.Text = $"Day {c.Day}  {Clock(c.Hours)}   {c.Deed}{(c.Moving ? " (walking)" : "")}{(c.DoorOpen ? "   the door is open" : "")}";
        int n = 0; var sb = new System.Text.StringBuilder();
        foreach (var e in c.Log.AsEnumerable().Reverse().Take(4))
        {
            string col = e.Kind switch { "phantom" => "#6a4f9c", "god" => "#a8692a", "say" => "#16181b", "seam" or "door" => "#2b6684", _ => "#5b6168" };
            sb.Append($"[color=#8a8f96]Day {(int)(e.Hour / 24) + 1} {Clock(e.Hour)}[/color]  [color={col}]{(e.Kind == "say" ? "“" + e.Text + "”" : e.Text)}[/color]\n"); n++;
        }
        strip.Text = sb.ToString();

        if (place == "watch" && feelBars != null)
        {
            deedL.Text = c.Moving ? $"Going to {c.Deed}" : c.Deed.ToString();
            int me = (int)c.Deed;
            var alt = Enumerable.Range(0, Brain.A).Where(i => i != me).OrderByDescending(i => b.Intent[i]).Take(2).ToArray();
            whyL.Text = $"WillNet gave it p={b.Intent[me]:0.00}. The next strongest were {Brain.DeedNames[alt[0]]} ({b.Intent[alt[0]]:0.00}) and {Brain.DeedNames[alt[1]]} ({b.Intent[alt[1]]:0.00}).";
            feelBars.Set(Enumerable.Range(0, Brain.F).Where(i => i != (int)Feel.Grip).OrderByDescending(i => b.Feelings[i]).Take(6).Select(i => (Brain.FeelNames[i], b.Feelings[i], FeelCol(i))));
            bodyBars.Set(new[] { ("Hunger", c.Hunger, Pal.Civ), ("Thirst", c.Thirst, Pal.Calm), ("Fatigue", c.Fatigue, Pal.Ink2), ("Pain", c.Pain, Pal.Alarm), ("Cold", c.Cold, Pal.Calm), ("Health", c.Health, Pal.Moss) });
            mindBars.Set(new[] { ("Grip", b.F_(Feel.Grip), Pal.Ink), ("Monotony", b.Monotony, Pal.Ink2), ("Surprise", Mathf.Clamp(b.SurpriseAvg * 3, 0, 1), Pal.Civ) });
            facts.Text = $"Meals {c.Meals}   Marks on the wall {c.Tallies}   Phantoms {c.Hallucinations}   Memories {b.Memory.Count}   {(c.SeamFound ? "He has found the seam." : "")}";
        }
        if (place == "mind" && mindLive != null)
        {
            string rec = b.Recalled >= 0 ? $"Recalling an episode from {(b.Memory[b.Recalled].Hour < 0 ? "his life before" : "day " + ((int)(b.Memory[b.Recalled].Hour / 24) + 1))}, while he was doing {b.Memory[b.Recalled].Deed} (valence {b.Memory[b.Recalled].Valence:+0.00;-0.00})." : "No memories yet.";
            var (ps, str) = c.Phantom;
            mindLive.Text = $"Surprise {b.Surprise:0.00} (average {b.SurpriseAvg:0.00})   Monotony {b.Monotony:0.00}   Grip {b.F_(Feel.Grip):0.00}\n{rec}\n" +
                            (str > .15f ? $"He perceives {ps} that isn't there (strength {str:0.00})." : "What he perceives matches the room.");
        }
        if (place == "god" && godLog != null) RefreshGodLog();
    }

    static Color FeelCol(int i) => (Feel)i switch
    {
        Feel.Fear or Feel.Dread or Feel.Despair or Feel.Anger or Feel.Shame or Feel.Grief => Pal.Alarm,
        Feel.Loneliness or Feel.Longing or Feel.Love => Pal.Mind, Feel.Hope or Feel.Joy or Feel.Calm or Feel.Awe or Feel.Curiosity => Pal.Calm, _ => Pal.Civ,
    };
}
