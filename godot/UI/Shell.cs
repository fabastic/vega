// The interface. It starts on a title screen with three ready-made stories. While a story plays, the world stays
// clear: a small card about Vega in plain words, the story so far, and the time controls. Menus open one panel
// at a time: Story, Mind, Intervene, Settings and Help. Numbers live behind the "researcher view" switch.
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
    public static bool Researcher;
    Label chapter, clock, doing, mood, gripL, why; Bars needs, feelNums; VBoxContainer feed; PanelContainer card, panel, start;
    VBoxContainer body; Label panelTitle; string place = "";
    readonly System.Collections.Generic.Dictionary<string, Button> menu = new();
    Settings draft; Label previewOut; Spark sparkGrip, sparkLonely; Button applyBtn;
    VBoxContainer godLog; int godShown = -1; Label mindLive; Phase builtFor;

    public override void _Ready()
    {
        Theme = Pal.Build();
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect); MouseFilter = MouseFilterEnum.Ignore;

        // top: where we are in the story, the clock, the time controls, the menus
        var top = new HBoxContainer(); AddChild(top); top_ = top; top.SetAnchorsAndOffsetsPreset(LayoutPreset.TopWide); top.OffsetLeft = 16; top.OffsetRight = -16; top.OffsetTop = 14;
        top.MouseFilter = MouseFilterEnum.Ignore;
        var where = new PanelContainer(); top.AddChild(where);
        var wv = new VBoxContainer(); wv.AddThemeConstantOverride("separation", 0); where.AddChild(wv);
        chapter = Pal.L("", 17, Pal.Text); wv.AddChild(chapter);
        clock = Pal.L("", 13, Pal.Dim); wv.AddChild(clock);
        top.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill, MouseFilter = MouseFilterEnum.Ignore });
        var speed = new PanelContainer(); top.AddChild(speed);
        var sh = new HBoxContainer(); sh.AddThemeConstantOverride("separation", 4); speed.AddChild(sh);
        var sg = new ButtonGroup();
        foreach (var (label, sp, tip) in new[] { ("Pause", 0f, "Stop time"), ("Play", .25f, "One hour every four seconds"), ("Fast", 1.5f, "A day in sixteen seconds"), ("Faster", 8f, "A day in three seconds") })
        {
            var b = new Button { Text = label, ToggleMode = true, ButtonGroup = sg, ButtonPressed = sp == .25f, TooltipText = tip, CustomMinimumSize = new Vector2(64, 0) };
            b.Pressed += () => Host.Speed = sp; sh.AddChild(b);
        }
        top.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill, MouseFilter = MouseFilterEnum.Ignore });
        var menus = new PanelContainer(); top.AddChild(menus);
        var mh = new HBoxContainer(); mh.AddThemeConstantOverride("separation", 4); menus.AddChild(mh);
        foreach (var (key, label, tip) in new[] { ("story", "Story", "Everything that has happened"), ("mind", "Mind", "Look inside his head"), ("god", "Intervene", "Change his world"), ("setup", "Settings", "Set up a new story"), ("help", "?", "How this works") })
        {
            var b = new Button { Text = label, ToggleMode = true, TooltipText = tip, CustomMinimumSize = new Vector2(key == "help" ? 40 : 0, 0) };
            b.Pressed += () => Go(place == key ? "" : key); mh.AddChild(b); menu[key] = b;
        }

        // left: Vega, in words
        card = new PanelContainer(); AddChild(card); card.SetAnchorsAndOffsetsPreset(LayoutPreset.TopLeft); card.OffsetLeft = 16; card.OffsetTop = 92; card.CustomMinimumSize = new Vector2(330, 0);
        var cv = new VBoxContainer(); cv.AddThemeConstantOverride("separation", 6); card.AddChild(cv);
        var name = new HBoxContainer(); cv.AddChild(name);
        name.AddChild(Pal.L("Vega", 22, Pal.Accent)); name.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
        gripL = Pal.L("", 13); gripL.TooltipText = "How well what he perceives still matches the world. Long monotony wears it down; when it goes, he starts seeing things."; gripL.MouseFilter = MouseFilterEnum.Pass; name.AddChild(gripL);
        doing = Pal.L("", 16, Pal.Text, true); cv.AddChild(doing);
        mood = Pal.L("", 14, Pal.Dim, true); cv.AddChild(mood);
        why = Pal.L("", 12, Pal.Faint, true); cv.AddChild(why);
        needs = new Bars(); cv.AddChild(needs);
        feelNums = new Bars { Numbers = true }; cv.AddChild(feelNums);

        // bottom left: the story so far
        var fp = new PanelContainer(); AddChild(fp); feedPanel = fp; fp.SetAnchorsAndOffsetsPreset(LayoutPreset.BottomLeft); fp.OffsetLeft = 16; fp.OffsetBottom = -16; fp.CustomMinimumSize = new Vector2(520, 0);
        fp.GrowVertical = GrowDirection.Begin;
        feed = new VBoxContainer(); feed.AddThemeConstantOverride("separation", 4); fp.AddChild(feed);

        // right: the one panel, when a menu is open
        panel = new PanelContainer { Visible = false }; AddChild(panel);
        panel.SetAnchorsAndOffsetsPreset(LayoutPreset.RightWide); panel.OffsetLeft = -460; panel.OffsetRight = -16; panel.OffsetTop = 92; panel.OffsetBottom = -16;
        var pv = new VBoxContainer(); pv.AddThemeConstantOverride("separation", 10); panel.AddChild(pv);
        var ph = new HBoxContainer(); pv.AddChild(ph);
        panelTitle = Pal.L("", 22, Pal.Text); ph.AddChild(panelTitle); ph.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
        var close = new Button { Text = "Close", TooltipText = "Close this panel" }; close.Pressed += () => Go(""); ph.AddChild(close);
        var scroll = new ScrollContainer { SizeFlagsVertical = SizeFlags.ExpandFill, HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled }; pv.AddChild(scroll);
        body = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill }; body.AddThemeConstantOverride("separation", 10); scroll.AddChild(body);

        BuildStart();
    }

    // ---------- the title screen ----------
    Control top_, feedPanel;
    void BuildStart()
    {
        Host.Speed = 0; Hud(false);
        start = new PanelContainer(); AddChild(start); start.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        start.AddThemeStyleboxOverride("panel", Pal.Box(new Color(.04f, .045f, .06f, .9f), 0, 0));
        var center = new CenterContainer(); start.AddChild(center);
        var v = new VBoxContainer { CustomMinimumSize = new Vector2(920, 0) }; v.AddThemeConstantOverride("separation", 18); center.AddChild(v);
        v.AddChild(Pal.L("VEGA", 64, Pal.Text));
        v.AddChild(Pal.L("A man lives a few ordinary days in his village. Then he wakes in a white room with no door. Then he comes back to whatever is left.", 19, Pal.Dim, true));
        v.AddChild(Pal.L("Nothing he does or says is scripted. Seven small neural networks perceive, feel, remember, choose and speak for him, and they keep learning as he lives. You can watch, or you can intervene.", 15, Pal.Faint, true));
        v.AddChild(new Control { CustomMinimumSize = new Vector2(0, 10) });
        v.AddChild(Pal.Head("Choose a story"));
        var row = new HBoxContainer(); row.AddThemeConstantOverride("separation", 14); v.AddChild(row);
        foreach (var (title, desc, apply) in Presets)
        {
            var b = new Button { CustomMinimumSize = new Vector2(0, 150), SizeFlagsHorizontal = SizeFlags.ExpandFill, Text = "" };
            var bv = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore }; bv.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect); bv.OffsetLeft = bv.OffsetTop = 16; bv.OffsetRight = bv.OffsetBottom = -16;
            bv.AddChild(Pal.L(title, 20, Pal.Accent)); var dl = Pal.L(desc, 14, Pal.Dim, true); dl.MouseFilter = MouseFilterEnum.Ignore; bv.AddChild(dl);
            b.AddChild(bv);
            b.Pressed += () => { var s = new Settings(); apply(s); Begin(s); };
            row.AddChild(b);
        }
        var own = new Button { Text = "Design your own story", SizeFlagsHorizontal = SizeFlags.ShrinkBegin };
        own.Pressed += () => { Begin(new Settings(), paused: true); Go("setup"); };
        v.AddChild(own);
        v.AddChild(Pal.L("Drag to look around, scroll to zoom. Everything can be changed later under Settings.", 13, Pal.Faint));
    }
    static readonly (string, string, Action<Settings>)[] Presets =
    {
        ("A gentle stay", "Day and night in the room, books to read, a kind voice each day. Most of the world survives.", s => { s["room.light"] = 1; s["room.furnish"] = 2; s["care.contact"] = 2; s["world.fate"] = 1; s["time.days"] = 10; }),
        ("The white room", "The classic: constant light, silence, regular meals and a hidden seam. Most of the village is gone when he gets out.", s => { }),
        ("The harshest room", "A bare, silent room, scarce food, no way out. When he comes back, no one is left.", s => { s["room.furnish"] = 0; s["care.food"] = 2; s["room.door"] = 0; s["world.fate"] = 0; s["time.days"] = 21; }),
    };
    public void StartPreset(int i) { var s = new Settings(); Presets[i].Item3(s); Begin(s); }
    void Begin(Settings s, bool paused = false)
    {
        Host.Restart(s, build: false); start.QueueFree(); start = null; Hud(true);
        Host.Speed = paused ? 0 : .25f; Go("");
    }

    void Hud(bool on) { if (top_ != null) top_.Visible = on; if (feedPanel != null) feedPanel.Visible = on; card.Visible = on; }

    // ---------- the menus ----------
    public void Go(string key)
    {
        if (start != null && key != "") return;
        place = key;
        foreach (var (k, b) in menu) b.SetPressedNoSignal(k == key);
        foreach (Node n in body.GetChildren()) n.QueueFree();
        previewOut = null; godLog = null; godShown = -1; mindLive = null;
        panel.Visible = key != "";
        Host.Focus(key == "mind" ? "mind" : "watch");
        card.Visible = key != "mind";
        switch (key)
        {
            case "story": panelTitle.Text = "The story so far"; BuildStory(); break;
            case "mind": panelTitle.Text = "Inside his head"; BuildMind(); break;
            case "god": panelTitle.Text = "Intervene"; BuildGod(); break;
            case "setup": panelTitle.Text = "Set up a story"; BuildSetup(); break;
            case "help": panelTitle.Text = "How this works"; BuildHelp(); break;
        }
        if (Host.R != null) builtFor = Host.R.Phase;
    }
    public void PhaseChanged() { if (place == "god") Go("god"); }

    void BuildStory()
    {
        foreach (var e in Host.R.Log.Where(e => e.Kind != "tray").Reverse().Take(80))
            body.AddChild(Line(e, 14));
    }

    void BuildMind()
    {
        body.AddChild(Pal.L("He is made of seven small networks, each with one job. They are shown as glowing structures: the brighter a unit, the more active it is. Choose one to look at it.", 14, Pal.Dim, true));
        var plain = new System.Collections.Generic.Dictionary<string, string>
        {
            ["senses"] = "What reaches him: light, sound, hunger, company. The two columns are what is really there and what he perceives. When they drift apart, he is seeing things.",
            ["percept"] = "Turns raw senses into a first impression.",
            ["world"] = "His model of the world. It constantly guesses what will happen next; when it is wrong he is surprised. In an empty room it starts filling the silence with its own guesses.",
            ["memory"] = "Moments that mattered, kept and called back when something feels similar. The bright square is what he is remembering now.",
            ["feel"] = "Seventeen feelings, from fear to faith. Born with some instincts; learns the rest from what follows what.",
            ["will"] = "Decides what to do next. It learns from whether things got better or worse after each choice.",
            ["thought"] = "Gathers everything into one thought.",
            ["voice"] = Host.Voice == null ? "Puts the thought into words. It is still being trained, so for now he is silent." : "Puts his feelings and situation into words, in his own way. Nothing he says is written in advance.",
        };
        var grid = new GridContainer { Columns = 2 }; body.AddChild(grid);
        var what = Pal.L(plain["world"], 15, Pal.Text, true);
        foreach (var m in MindView.Modules)
        {
            var b = new Button { Text = m.Title.Replace("Net", ""), SizeFlagsHorizontal = SizeFlags.ExpandFill };
            b.Pressed += () => { what.Text = plain[m.Key] + (Researcher ? "\n\n" + m.What : ""); Host.FocusMind(m.At); };
            grid.AddChild(b);
        }
        body.AddChild(what);
        body.AddChild(new HSeparator());
        mindLive = Pal.L("", 14, Pal.Dim, true); body.AddChild(mindLive);
    }

    void BuildGod()
    {
        var R = Host.R;
        body.AddChild(Pal.L("Change his world and watch how he takes it. Each change shows up in his senses; an hour later you can see what it did to how he feels. A man of faith may read your hand as a sign.", 14, Pal.Dim, true));
        foreach (var g in Run.GodGroups)
        {
            var acts = Run.Acts.Where(a => a.Group == g && a.Allowed(R)).ToList();
            if (acts.Count == 0) continue;
            body.AddChild(Pal.Head(g));
            var grid = new GridContainer { Columns = 2 }; grid.AddThemeConstantOverride("h_separation", 8); grid.AddThemeConstantOverride("v_separation", 8); body.AddChild(grid);
            foreach (var act in acts)
            {
                var b = new Button { Text = act.Label, ToggleMode = act.Active != null, ButtonPressed = act.Active?.Invoke(R) ?? false, TooltipText = act.Desc, SizeFlagsHorizontal = SizeFlags.ExpandFill, CustomMinimumSize = new Vector2(0, 40) };
                b.Pressed += () => { Host.R.God(act); if (act.Active != null) b.SetPressedNoSignal(act.Active(Host.R)); };
                grid.AddChild(b);
            }
        }
        int hidden = Run.Acts.Count(a => !a.Allowed(R));
        if (hidden > 0) body.AddChild(Pal.L(R.Phase == Phase.Chamber ? "More becomes possible once he is outside again." : "More becomes possible while he is in the room.", 12, Pal.Faint));
        body.AddChild(new HSeparator()); body.AddChild(Pal.Head("What your changes did"));
        godLog = new VBoxContainer(); body.AddChild(godLog);
    }

    void RefreshGodLog()
    {
        var fx = Host.R.GodEffects; int done = fx.Count(e => e.after != null);
        if (done == godShown) return; godShown = done;
        foreach (Node n in godLog.GetChildren()) n.QueueFree();
        if (fx.Count == 0) godLog.AddChild(Pal.L("Nothing yet.", 13, Pal.Faint));
        foreach (var (h, act, before, after) in fx.AsEnumerable().Reverse().Take(10))
        {
            string eff = after == null ? "watching..." : Effect(before, after);
            godLog.AddChild(Pal.L($"{act}: {eff}", 13, Pal.Text, true));
        }
    }
    static string Effect(float[] before, float[] after)
    {
        var top = Enumerable.Range(0, Brain.F).Where(i => i != (int)Feel.Grip).Select(i => (f: (Feel)i, d: after[i] - before[i])).Where(x => MathF.Abs(x.d) > .03f).OrderByDescending(x => MathF.Abs(x.d)).Take(3).ToList();
        if (top.Count == 0) return "he barely reacted.";
        return "he became " + string.Join(", ", top.Select(x => (x.d > 0 ? "more " : "less ") + Words.Adjective(x.f) + (Researcher ? $" ({x.d:+0.00;-0.00})" : ""))) + ".";
    }

    void BuildSetup()
    {
        draft = Host.R.Cfg.Clone();
        body.AddChild(Pal.L("Shape his story. Each choice explains what it changes. Press Try it to see the difference before you start: the same story is played out twice in the background, with your changes and without them.", 14, Pal.Dim, true));
        var tabs = new TabContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill }; body.AddChild(tabs);
        var tabNames = new System.Collections.Generic.Dictionary<string, string> { ["Room"] = "The room", ["Care"] = "His keepers", ["Time"] = "Time", ["Vega"] = "Who he is" };
        foreach (var g in Settings.Groups)
        {
            var v = new VBoxContainer { Name = tabNames[g] }; v.AddThemeConstantOverride("separation", 6); tabs.AddChild(v);
            foreach (var d in Settings.Defs.Where(d => d.Group == g && (Researcher || d.Key != "time.seed")))
            {
                var row = new HBoxContainer(); v.AddChild(row);
                row.AddChild(Pal.L(d.Label, 15, Pal.Text)); row.AddChild(new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill });
                var explain = Pal.L(d.Explain(draft), 13, Pal.Dim, true);
                if (d.IsChoice)
                {
                    var ob = new OptionButton { CustomMinimumSize = new Vector2(190, 0) };
                    foreach (var o in d.Options) ob.AddItem(o);
                    ob.Selected = draft.I(d.Key);
                    ob.ItemSelected += i => { draft[d.Key] = i; explain.Text = d.Explain(draft); Dirty(); };
                    row.AddChild(ob);
                }
                else
                {
                    var val = Pal.L(Show(d, draft), 14, Pal.Accent);
                    var sl = new HSlider { MinValue = d.Min, MaxValue = d.Max, Step = d.Step, Value = draft[d.Key], CustomMinimumSize = new Vector2(150, 0), SizeFlagsVertical = SizeFlags.ShrinkCenter };
                    sl.ValueChanged += x => { draft[d.Key] = (float)x; val.Text = Show(d, draft); explain.Text = d.Explain(draft); Dirty(); };
                    row.AddChild(sl); row.AddChild(val);
                }
                v.AddChild(explain); v.AddChild(new HSeparator());
            }
        }
        var btns = new HBoxContainer(); btns.AddThemeConstantOverride("separation", 8); body.AddChild(btns);
        var prev = new Button { Text = "Try it", SizeFlagsHorizontal = SizeFlags.ExpandFill, TooltipText = "See what your changes would do" }; btns.AddChild(prev);
        applyBtn = new Button { Text = "Start this story", SizeFlagsHorizontal = SizeFlags.ExpandFill, Disabled = true }; btns.AddChild(applyBtn);
        previewOut = Pal.L("", 14, Pal.Text, true); body.AddChild(previewOut);
        var sparks = new HBoxContainer(); body.AddChild(sparks);
        sparkGrip = new Spark { Title = "Hold on reality, day by day", CustomMinimumSize = new Vector2(0, 80), SizeFlagsHorizontal = SizeFlags.ExpandFill }; sparks.AddChild(sparkGrip);
        sparkLonely = new Spark { Title = "Loneliness, day by day", CustomMinimumSize = new Vector2(0, 80), SizeFlagsHorizontal = SizeFlags.ExpandFill }; sparks.AddChild(sparkLonely);
        body.AddChild(Pal.L("Grey: as things are now. Gold: with your changes.", 12, Pal.Faint));
        prev.Pressed += RunPreview;
        applyBtn.Pressed += () => { Host.Restart(draft, build: false); Host.Speed = .25f; Go(""); };
        if (Host.Speed == 0 && Host.R.Hours < 8) applyBtn.Disabled = false;
    }
    static string Show(SettingDef d, Settings s) => d.Key.StartsWith("vega.") ? (s[d.Key] < .33f ? "Low" : s[d.Key] < .66f ? "Medium" : "High") : s.Show(d);
    void Dirty() { if (applyBtn != null) applyBtn.Disabled = false; }

    void RunPreview()
    {
        previewOut.Text = "Playing both versions...";
        var cur = Host.R.Cfg.Clone(); var nxt = draft.Clone();
        System.Threading.Tasks.Task.Run(() =>
        {
            var a = Preview.Run(cur); var b = Preview.Run(nxt);
            string text = Words.Compare(a, b) + (Researcher ? "\n\n" + string.Join("\n", Preview.Compare(a, b)) : "");
            Callable.From(() =>
            {
                if (previewOut == null || !IsInstanceValid(previewOut)) return;
                previewOut.Text = text;
                sparkGrip.A = a.DailyGrip; sparkGrip.B = b.DailyGrip; sparkGrip.QueueRedraw();
                sparkLonely.A = a.DailyLonely; sparkLonely.B = b.DailyLonely; sparkLonely.QueueRedraw();
            }).CallDeferred();
        });
    }

    void BuildHelp()
    {
        foreach (var (h, t) in new[]
        {
            ("Watching", "Drag with the mouse to look around him, and scroll to zoom. Use Play, Fast and Faster to move time along, or Pause to stop it."),
            ("His story", "Chapter 1 is a few ordinary days in his village. Then he is taken to the white room. Chapter 3 is the world he comes back to."),
            ("He is not scripted", "What he does, feels and says comes from seven small neural networks that learn as he lives. The same story can go differently with a different seed."),
            ("Seeing things", "In a room where nothing changes, his mind starts filling in the gaps with memories. That is when he sees people who aren't there."),
            ("Faith", "How much he believes is part of who he is. Faith steadies him; answered prayers deepen it, and unanswered ones wear it away. Your interventions may look to him like signs."),
            ("Intervene", "You can change his room and his world while he lives in it, and see what each change does to him."),
        })
        { body.AddChild(Pal.L(h, 16, Pal.Accent)); body.AddChild(Pal.L(t, 14, Pal.Dim, true)); }
        body.AddChild(new HSeparator());
        var rv = new CheckButton { Text = "Researcher view (show the numbers)", ButtonPressed = Researcher };
        rv.Toggled += on => { Researcher = on; };
        body.AddChild(rv);
        var restart = new Button { Text = "Back to the title screen" }; restart.Pressed += () => { Go(""); BuildStart(); }; body.AddChild(restart);
    }

    // ---------- live ----------
    Control Line(Event e, int size)
    {
        string kind = e.Kind; Color c = kind switch
        {
            "say" => Pal.Text, "phantom" => Pal.Mind, "god" => Pal.Accent, "death" or "bury" or "wolves" or "hurt" or "taken" or "end" => Pal.Alarm,
            "seam" or "door" or "survivor" or "out" or "build" => Pal.Calm, _ => Pal.Dim,
        };
        string text = kind == "say" ? $"“{e.Text}”" : kind == "god" ? "You: " + e.Text : e.Text;
        var h = new HBoxContainer(); h.AddThemeConstantOverride("separation", 10);
        var t = Pal.L(Words.TimeOfDay(e.Hour).Replace("Day ", "D"), 12, Pal.Faint); t.CustomMinimumSize = new Vector2(120, 0); h.AddChild(t);
        var l = Pal.L(text, size, c, true); l.SizeFlagsHorizontal = SizeFlags.ExpandFill; if (kind == "say") l.AddThemeFontOverride("font", new SystemFont { FontNames = new[] { "Georgia", "Times New Roman" }, FontItalic = true }); h.AddChild(l);
        return h;
    }

    PanelContainer endCard;
    void ShowEnd()
    {
        var R = Host.R; var b = R.Brain;
        endCard = new PanelContainer(); AddChild(endCard); endCard.SetAnchorsAndOffsetsPreset(LayoutPreset.Center);
        endCard.CustomMinimumSize = new Vector2(560, 0); endCard.GrowHorizontal = GrowDirection.Both; endCard.GrowVertical = GrowDirection.Both;
        var v = new VBoxContainer(); v.AddThemeConstantOverride("separation", 12); endCard.AddChild(v);
        v.AddChild(Pal.L(R.DiedInRoom || R.Body.Health <= 0 ? "He did not make it" : "The story ends here", 28, Pal.Accent));
        string where = R.DiedInRoom ? "He died in the white room" : R.Body.Health <= 0 ? "His body gave out after the room" : "He survived the room and is still going";
        var lines = new System.Collections.Generic.List<string> { $"{where}, on day {R.Day}." };
        if (R.Chamber != null) lines.Add($"In the room he marked {R.Chamber.Tallies} days on the wall{(R.Chamber.SeamFound ? " and found the seam" : "")}{(R.Chamber.DoorOpen ? ", and broke out" : "")}.");
        if (R.Hallucinations > 0) lines.Add($"He saw things that weren't there {R.Hallucinations} times.");
        if (R.World.Buried > 0) lines.Add($"He buried {R.World.Buried} of his neighbours.");
        if (R.World.Built.Count > 0) lines.Add($"He built {R.World.Built.Count} things to stay alive.");
        float fd = b.F_(Feel.Faith) - R.FaithAtStart;
        if (MathF.Abs(fd) > .1f) lines.Add(fd > 0 ? "His faith grew stronger." : "He lost much of his faith.");
        lines.Add(Words.Mood(b).Replace("Feels", "At the end he felt"));
        var said = R.Log.LastOrDefault(e => e.Kind == "say");
        if (said != null) lines.Add($"The last thing he said: “{said.Text}”");
        foreach (var l in lines) v.AddChild(Pal.L(l, 15, Pal.Dim, true));
        var h = new HBoxContainer(); h.AddThemeConstantOverride("separation", 8); v.AddChild(h);
        var read = new Button { Text = "Read his story", SizeFlagsHorizontal = SizeFlags.ExpandFill }; read.Pressed += () => { endCard.QueueFree(); Go("story"); }; h.AddChild(read);
        var again = new Button { Text = "New story", SizeFlagsHorizontal = SizeFlags.ExpandFill }; again.Pressed += () => { endCard.QueueFree(); endCard = null; Go(""); BuildStart(); }; h.AddChild(again);
    }
    bool endShown; Run endFor;

    int feedCount = -1;
    public override void _Process(double delta)
    {
        var R = Host.R; if (R == null || start != null) return; var b = R.Brain; var B = R.Body;
        if (endFor != R) { endFor = R; endShown = false; }
        if (R.Done && !endShown) { endShown = true; ShowEnd(); }
        chapter.Text = Words.Chapter(R); clock.Text = Words.TimeOfDay(R.Hours);
        doing.Text = R.Done && B.Health <= 0 ? "Gone." : Words.Doing(R);
        mood.Text = Words.Mood(b);
        var (gw, gc) = Words.Grip(b.F_(Feel.Grip)); gripL.Text = "Mind: " + gw; gripL.AddThemeColorOverride("font_color", gc);
        var alt = Enumerable.Range(0, Brain.A).Where(i => i != (int)R.Deed && b.Intent[i] > .05f).OrderByDescending(i => b.Intent[i]).Take(2).Select(i => Words.Option((Deed)i)).ToList();
        why.Text = alt.Count > 0 ? "He also thought about " + string.Join(" or ", alt) + "." : "";
        var rows = new System.Collections.Generic.List<(string, float, Color)>();
        void N(string n, float v, Color c, float show = .3f) { if (v > show || Researcher) rows.Add((n, v, c)); }
        N("Hungry", B.Hunger, Pal.Civ); N("Thirsty", B.Thirst, Pal.Calm); N("Tired", B.Fatigue, Pal.Dim, .45f); N("In pain", B.Pain, Pal.Alarm, .1f); N("Cold", B.Cold, Pal.Calm, .2f);
        if (B.Health < .95f || Researcher) rows.Add(("Health", B.Health, Pal.Moss));
        needs.Set(rows);
        feelNums.Visible = Researcher;
        if (Researcher) feelNums.Set(Enumerable.Range(0, Brain.F).OrderByDescending(i => b.Feelings[i]).Take(8).Select(i => (Brain.FeelNames[i], b.Feelings[i], Pal.Mind)));

        if (R.Log.Count != feedCount)
        {
            feedCount = R.Log.Count;
            foreach (Node n in feed.GetChildren()) n.QueueFree();
            foreach (var e in R.Log.Where(e => e.Kind != "tray").Reverse().Take(4).Reverse()) feed.AddChild(Line(e, 14));
            if (place == "story") Go("story");
        }
        if (place == "mind" && mindLive != null)
        {
            string rec = b.Recalled >= 0 ? $"Right now he is remembering a moment from {(b.Memory[b.Recalled].Hour < 0 ? "long ago" : Words.TimeOfDay(b.Memory[b.Recalled].Hour).ToLowerInvariant())}{(b.Memory[b.Recalled].Who is string w ? ", with " + w : "")}." : "He has no memories yet.";
            var (ps, str) = R.Phantom;
            mindLive.Text = rec + "\n" + (str > .1f ? $"His mind is filling the silence: he senses {PhantomWord(ps)} that isn't really there." : "What he perceives still matches what is there.")
                + (Researcher ? $"\n\nsurprise {b.Surprise:0.00} (avg {b.SurpriseAvg:0.00})  monotony {b.Monotony:0.00}  grip {b.F_(Feel.Grip):0.00}  faith {b.F_(Feel.Faith):0.00}  memories {b.Memory.Count}" : "");
        }
        if (place == "god" && godLog != null) RefreshGodLog();
        if (place == "god" && R.Phase != builtFor) Go("god");
    }
    static string PhantomWord(Sense s) => s switch { Sense.Company => "someone", Sense.Tray => "food", Sense.Knock => "a knock", Sense.DoorOpen => "an open door", Sense.Radio => "music", Sense.Dead => "a body", _ => "something" };
}
