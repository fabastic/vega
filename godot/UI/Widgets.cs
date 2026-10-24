// The look of the interface (dark glass over the 3D world, warm accent), the small drawn controls, and the
// plain-language phrasing every screen uses so that nobody needs to know what a GRU is.
using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using Vega.Mind;
using Vega.Sim;

namespace Vega.UI;

public static class Pal
{
    public static readonly Color Glass = new(.07f, .08f, .1f, .84f), Glass2 = new(1, 1, 1, .06f), Text = new(.94f, .94f, .92f), Dim = new(.68f, .7f, .72f), Faint = new(.45f, .47f, .5f),
        Accent = new(.96f, .76f, .45f), Alarm = new(.93f, .42f, .33f), Calm = new(.45f, .72f, .86f), Mind = new(.68f, .58f, .92f), Moss = new(.6f, .78f, .45f), Civ = new(.88f, .62f, .32f),
        Ink = new(.94f, .94f, .92f), Ink2 = new(.68f, .7f, .72f), Rule = new(1, 1, 1, .12f);

    public static StyleBoxFlat Box(Color bg, int r = 10, int m = 14, Color? border = null)
    {
        var s = new StyleBoxFlat { BgColor = bg, CornerRadiusTopLeft = r, CornerRadiusTopRight = r, CornerRadiusBottomLeft = r, CornerRadiusBottomRight = r,
            ContentMarginLeft = m, ContentMarginRight = m, ContentMarginTop = m * .75f, ContentMarginBottom = m * .75f };
        if (border is Color b) { s.BorderColor = b; s.BorderWidthBottom = s.BorderWidthTop = s.BorderWidthLeft = s.BorderWidthRight = 1; }
        return s;
    }

    public static Theme Build()
    {
        var t = new Theme { DefaultFont = new SystemFont { FontNames = new[] { "Segoe UI Variable Text", "Segoe UI", "Helvetica Neue", "Arial" } }, DefaultFontSize = 15 };
        t.SetStylebox("panel", "PanelContainer", Box(Glass, 14, 18));
        t.SetColor("font_color", "Label", Text);
        foreach (var type in new[] { "Button", "OptionButton", "CheckButton" })
        {
            t.SetStylebox("normal", type, Box(Glass2, 8, 12));
            t.SetStylebox("hover", type, Box(new Color(1, 1, 1, .13f), 8, 12));
            t.SetStylebox("pressed", type, Box(Accent, 8, 12));
            t.SetStylebox("hover_pressed", type, Box(Accent, 8, 12));
            t.SetStylebox("disabled", type, Box(new Color(1, 1, 1, .03f), 8, 12));
            t.SetStylebox("focus", type, new StyleBoxEmpty());
            t.SetColor("font_color", type, Text); t.SetColor("font_hover_color", type, Colors.White); t.SetColor("font_focus_color", type, Text);
            t.SetColor("font_pressed_color", type, new Color(.1f, .08f, .05f)); t.SetColor("font_hover_pressed_color", type, new Color(.1f, .08f, .05f));
            t.SetColor("font_disabled_color", type, Faint);
        }
        t.SetStylebox("panel", "TabContainer", Box(new Color(0, 0, 0, 0), 8, 4));
        t.SetStylebox("tab_selected", "TabContainer", Box(new Color(1, 1, 1, .14f), 8, 12));
        t.SetStylebox("tab_unselected", "TabContainer", Box(new Color(0, 0, 0, 0), 8, 12));
        t.SetStylebox("tab_hovered", "TabContainer", Box(new Color(1, 1, 1, .08f), 8, 12));
        t.SetStylebox("tabbar_background", "TabContainer", new StyleBoxEmpty());
        t.SetColor("font_selected_color", "TabContainer", Colors.White); t.SetColor("font_unselected_color", "TabContainer", Dim); t.SetColor("font_hovered_color", "TabContainer", Text);
        t.SetColor("default_color", "RichTextLabel", Text);
        t.SetStylebox("panel", "PopupMenu", Box(new Color(.1f, .11f, .13f, .98f), 8, 8));
        t.SetColor("font_color", "PopupMenu", Text); t.SetColor("font_hover_color", "PopupMenu", Colors.White);
        t.SetStylebox("hover", "PopupMenu", Box(new Color(1, 1, 1, .1f), 6, 6));
        t.SetStylebox("separator", "HSeparator", new StyleBoxLine { Color = Rule, Thickness = 1 });
        t.SetStylebox("slider", "HSlider", Box(new Color(1, 1, 1, .15f), 3, 2));
        t.SetStylebox("grabber_area", "HSlider", Box(Accent, 3, 2));
        t.SetStylebox("grabber_area_highlight", "HSlider", Box(Accent, 3, 2));
        t.SetStylebox("panel", "TooltipPanel", Box(new Color(.1f, .11f, .13f, .97f), 6, 10));
        t.SetColor("font_color", "TooltipLabel", Text);
        return t;
    }

    public static Label L(string text, int size = 15, Color? col = null, bool wrap = false)
    {
        var l = new Label { Text = text, AutowrapMode = wrap ? TextServer.AutowrapMode.WordSmart : TextServer.AutowrapMode.Off };
        if (size != 15) l.AddThemeFontSizeOverride("font_size", size);
        if (col is Color c) l.AddThemeColorOverride("font_color", c);
        return l;
    }
    public static Label Head(string text) => L(text.ToUpperInvariant(), 12, Faint);
}

// The plain words for what the mind is doing.
public static class Words
{
    public static string Doing(Run r) => Doing(r, r.Deed, r.Moving);
    public static string Doing(Run r, Deed d, bool moving)
    {
        var b = r.Brain; bool room = r.Phase == Phase.Chamber, after = r.Phase == Phase.After;
        string who = b.Context;
        string s = d switch
        {
            Deed.Rest => room ? "Sitting against the wall" : "Resting at home",
            Deed.Sleep => room ? "Asleep on the floor of the white room" : "Asleep",
            Deed.Pace => "Pacing from wall to wall",
            Deed.Search => "Feeling along the walls for a way out",
            Deed.Eat => room ? "Eating from the tray" : "Eating",
            Deed.Shout => room ? "Shouting for someone to hear him" : "Calling out across the fields",
            Deed.Hug => "Curled up, hugging his knees",
            Deed.Exercise => "Exercising to stay strong",
            Deed.Tally => "Scratching another day onto the wall",
            Deed.Remember => "Lost in a memory",
            Deed.Read => "Reading",
            Deed.Pound => "Pounding on the door",
            Deed.Talk => room ? (r.Chamber.Photo ? "Talking to the photograph" : r.Chamber.Rat ? "Talking to the rat" : "Talking to someone who isn't there") : who != null ? $"Talking with {who}" : "Looking for someone to talk to",
            Deed.Work => "Working in the workshop",
            Deed.Explore => after ? "Searching the empty country" : "Wandering out to explore",
            Deed.Forage => "Looking for food",
            Deed.Build => "Building something to keep him safe",
            Deed.Bury => "Burying the dead",
            Deed.Socialize => who != null ? $"Spending the evening with {who}" : "Out in the plaza",
            Deed.Pray => room ? "Kneeling in prayer" : "Praying in the chapel",
            _ => d.ToString(),
        };
        return moving ? "On his way: " + char.ToLowerInvariant(s[0]) + s[1..] : s;
    }

    // what he might have done instead, as a short phrase
    public static string Option(Deed d) => d switch
    {
        Deed.Rest => "resting", Deed.Sleep => "sleeping", Deed.Pace => "pacing", Deed.Search => "searching the walls", Deed.Eat => "eating", Deed.Shout => "shouting",
        Deed.Hug => "curling up", Deed.Exercise => "exercising", Deed.Tally => "marking the days", Deed.Remember => "remembering", Deed.Read => "reading", Deed.Pound => "pounding on the door",
        Deed.Talk => "talking", Deed.Work => "working", Deed.Explore => "exploring", Deed.Forage => "finding food", Deed.Build => "building", Deed.Bury => "burying the dead",
        Deed.Socialize => "seeing friends", Deed.Pray => "praying", _ => d.ToString().ToLowerInvariant(),
    };

    static readonly Dictionary<Feel, string> Adj = new()
    {
        [Feel.Fear] = "afraid", [Feel.Hope] = "hopeful", [Feel.Loneliness] = "lonely", [Feel.Boredom] = "bored", [Feel.Anger] = "angry", [Feel.Grief] = "grieving",
        [Feel.Curiosity] = "curious", [Feel.Calm] = "calm", [Feel.Dread] = "full of dread", [Feel.Joy] = "happy", [Feel.Longing] = "homesick", [Feel.Shame] = "ashamed",
        [Feel.Love] = "full of love", [Feel.Awe] = "in awe", [Feel.Despair] = "in despair", [Feel.Faith] = "held by his faith",
    };
    public static string Adjective(Feel f) => Adj.TryGetValue(f, out var a) ? a : f.ToString().ToLowerInvariant();
    public static string Mood(Brain b)
    {
        var top = Enumerable.Range(0, Brain.F).Where(i => i != (int)Feel.Grip && b.Feelings[i] > .35f).OrderByDescending(i => b.Feelings[i]).Take(3).ToList();
        if (top.Count == 0) return "Feels very little right now.";
        var parts = top.Select(i => (b.Feelings[i] > .75f ? "very " : b.Feelings[i] < .5f ? "a little " : "") + Adjective((Feel)i)).ToList();
        string list = parts.Count == 1 ? parts[0] : string.Join(", ", parts.Take(parts.Count - 1)) + " and " + parts[^1];
        return "Feels " + list + ".";
    }
    public static (string word, Color col) Grip(float g) => g > .8f ? ("Steady", Pal.Moss) : g > .6f ? ("Slipping", Pal.Accent) : g > .4f ? ("Fragile", Pal.Civ) : ("Coming apart", Pal.Alarm);

    public static string TimeOfDay(float hours)
    {
        float h = hours % 24;
        string t = h < 5 ? "the dead of night" : h < 8 ? "early morning" : h < 12 ? "morning" : h < 14 ? "midday" : h < 17 ? "afternoon" : h < 20 ? "evening" : h < 23 ? "night" : "late night";
        return $"Day {(int)(hours / 24) + 1}, {t}";
    }
    public static string Chapter(Run r) => r.Phase switch
    {
        Phase.Life => $"Chapter 1 · Life in {r.World.Villages[0].Name}", Phase.Chamber => "Chapter 2 · The white room",
        Phase.After => "Chapter 3 · After", _ => "The end",
    };

    // turns the difference between two runs into a sentence
    public static string Compare(Outcome a, Outcome b)
    {
        var diffs = Enumerable.Range(0, Brain.F).Where(i => i != (int)Feel.Grip).Select(i => (f: (Feel)i, d: b.MeanFeel[i] - a.MeanFeel[i]))
            .Where(x => MathF.Abs(x.d) > .02f).OrderByDescending(x => MathF.Abs(x.d)).Take(4).ToList();
        var bits = diffs.Select(x => (MathF.Abs(x.d) > .1f ? "much " : MathF.Abs(x.d) > .05f ? "" : "slightly ") + (x.d > 0 ? "more " : "less ") + Adjective(x.f)).ToList();
        string s = bits.Count == 0 ? "This barely changes how he feels." : "Over his whole story he would feel " + string.Join(", ", bits) + ".";
        float gd = b.MeanFeel[(int)Feel.Grip] - a.MeanFeel[(int)Feel.Grip];
        if (MathF.Abs(gd) > .02f) s += gd < 0 ? " His hold on reality would slip further." : " He would keep a firmer hold on reality.";
        if (b.Hallucinations != a.Hallucinations) s += $" He would see things that aren't there {b.Hallucinations} times instead of {a.Hallucinations}.";
        if (a.Out != b.Out) s += b.Out ? " He would break out of the room." : " He would no longer break out.";
        if (MathF.Abs(a.Health - b.Health) > .05f) s += b.Health < a.Health ? " His body would suffer more." : " His body would fare better.";
        return s;
    }
}

// labelled meters
public partial class Bars : Control
{
    public readonly List<(string name, float v, Color col)> Rows = new();
    public float RowH = 22; public bool Numbers;
    public void Set(IEnumerable<(string, float, Color)> rows) { Rows.Clear(); Rows.AddRange(rows); CustomMinimumSize = new Vector2(0, Rows.Count * RowH); QueueRedraw(); }
    public override void _Draw()
    {
        var font = GetThemeDefaultFont(); float w = Size.X, lw = 96, nw = Numbers ? 36 : 0;
        for (int i = 0; i < Rows.Count; i++)
        {
            var (n, v, c) = Rows[i]; float y = i * RowH;
            DrawString(font, new Vector2(0, y + 15), n, HorizontalAlignment.Left, lw, 13, Pal.Dim);
            var bg = new Rect2(lw, y + 8, w - lw - nw, 6);
            DrawRect(bg, new Color(1, 1, 1, .1f));
            DrawRect(new Rect2(bg.Position, new Vector2(bg.Size.X * Mathf.Clamp(v, 0, 1), 6)), c);
            if (Numbers) DrawString(font, new Vector2(w - 32, y + 15), v.ToString("0.00"), HorizontalAlignment.Right, 32, 12, Pal.Faint);
        }
    }
}

// two runs' daily values side by side
public partial class Spark : Control
{
    public float[] A, B; public string Title = "";
    public override void _Draw()
    {
        var font = GetThemeDefaultFont();
        DrawString(font, new Vector2(0, 13), Title, HorizontalAlignment.Left, -1, 12, Pal.Dim);
        var r = new Rect2(0, 20, Size.X, Size.Y - 22); DrawRect(r, new Color(1, 1, 1, .05f));
        void Line(float[] v, Color c, float width)
        {
            if (v == null || v.Length < 2) return;
            var pts = new Vector2[v.Length];
            for (int i = 0; i < v.Length; i++) pts[i] = new Vector2(r.Position.X + r.Size.X * i / (v.Length - 1), r.End.Y - r.Size.Y * Mathf.Clamp(v[i], 0, 1));
            DrawPolyline(pts, c, width, true);
        }
        Line(A, Pal.Faint, 1.5f); Line(B, Pal.Accent, 2.5f);
    }
}
