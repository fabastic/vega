// Small drawn controls and the theme: the White Room's palette of paper, ink, ochre for his life and violet for
// his mind.
using System.Collections.Generic;
using Godot;

namespace Vega.UI;

public static class Pal
{
    public static readonly Color Paper = new(.95f, .953f, .94f, .95f), Ink = new(.086f, .094f, .106f), Ink2 = new(.36f, .38f, .41f), Rule = new(.85f, .86f, .84f),
        Alarm = new(.77f, .2f, .12f), Civ = new(.66f, .41f, .16f), Calm = new(.17f, .4f, .52f), Mind = new(.42f, .31f, .61f), Moss = new(.36f, .44f, .23f);

    public static Theme Build()
    {
        var t = new Theme { DefaultFont = new SystemFont { FontNames = new[] { "Segoe UI", "Helvetica Neue", "Arial" } }, DefaultFontSize = 14 };
        StyleBoxFlat Box(Color bg, int r = 6, int m = 12, Color? border = null)
        {
            var s = new StyleBoxFlat { BgColor = bg, CornerRadiusTopLeft = r, CornerRadiusTopRight = r, CornerRadiusBottomLeft = r, CornerRadiusBottomRight = r,
                ContentMarginLeft = m, ContentMarginRight = m, ContentMarginTop = m * .7f, ContentMarginBottom = m * .7f };
            if (border is Color b) { s.BorderColor = b; s.BorderWidthBottom = s.BorderWidthTop = s.BorderWidthLeft = s.BorderWidthRight = 1; }
            return s;
        }
        t.SetStylebox("panel", "PanelContainer", Box(Paper, 8, 16));
        t.SetColor("font_color", "Label", Ink);
        foreach (var type in new[] { "Button", "OptionButton" })
        {
            t.SetStylebox("normal", type, Box(new Color(1, 1, 1, .7f), 5, 10, Rule));
            t.SetStylebox("hover", type, Box(new Color(1, 1, 1, 1), 5, 10, Ink2));
            t.SetStylebox("pressed", type, Box(Ink, 5, 10));
            t.SetStylebox("hover_pressed", type, Box(Ink, 5, 10));
            t.SetStylebox("disabled", type, Box(new Color(1, 1, 1, .3f), 5, 10, Rule));
            t.SetStylebox("focus", type, new StyleBoxEmpty());
            t.SetColor("font_color", type, Ink); t.SetColor("font_hover_color", type, Ink);
            t.SetColor("font_pressed_color", type, Colors.White); t.SetColor("font_hover_pressed_color", type, Colors.White);
            t.SetColor("font_focus_color", type, Ink); t.SetColor("font_disabled_color", type, Ink2);
        }
        t.SetStylebox("panel", "TabContainer", Box(new Color(1, 1, 1, .5f), 6, 12));
        t.SetStylebox("tab_selected", "TabContainer", Box(Ink, 5, 10));
        t.SetStylebox("tab_unselected", "TabContainer", Box(new Color(0, 0, 0, 0), 5, 10));
        t.SetStylebox("tab_hovered", "TabContainer", Box(new Color(1, 1, 1, .8f), 5, 10));
        t.SetColor("font_selected_color", "TabContainer", Colors.White); t.SetColor("font_unselected_color", "TabContainer", Ink2); t.SetColor("font_hovered_color", "TabContainer", Ink);
        t.SetColor("default_color", "RichTextLabel", Ink);
        t.SetStylebox("panel", "PopupMenu", Box(new Color(.98f, .98f, .97f), 4, 8, Rule));
        t.SetColor("font_color", "PopupMenu", Ink); t.SetColor("font_hover_color", "PopupMenu", Colors.White);
        t.SetStylebox("hover", "PopupMenu", Box(Ink, 3, 6));
        return t;
    }

    public static Label L(string text, int size = 14, Color? col = null, bool wrap = false)
    {
        var l = new Label { Text = text, AutowrapMode = wrap ? TextServer.AutowrapMode.WordSmart : TextServer.AutowrapMode.Off };
        if (size != 14) l.AddThemeFontSizeOverride("font_size", size);
        if (col is Color c) l.AddThemeColorOverride("font_color", c);
        return l;
    }
    public static Label Head(string text) => L(text.ToUpperInvariant(), 11, Ink2);
}

// labelled horizontal bars
public partial class Bars : Control
{
    public readonly List<(string name, float v, Color col)> Rows = new();
    public float RowH = 18;
    public void Set(IEnumerable<(string, float, Color)> rows) { Rows.Clear(); Rows.AddRange(rows); CustomMinimumSize = new Vector2(0, Rows.Count * RowH); QueueRedraw(); }
    public override void _Draw()
    {
        var font = GetThemeDefaultFont(); float w = Size.X, lw = 92;
        for (int i = 0; i < Rows.Count; i++)
        {
            var (n, v, c) = Rows[i]; float y = i * RowH;
            DrawString(font, new Vector2(0, y + 13), n, HorizontalAlignment.Left, lw, 12, Pal.Ink2);
            DrawRect(new Rect2(lw, y + 5, w - lw - 36, 8), Pal.Rule);
            DrawRect(new Rect2(lw, y + 5, (w - lw - 36) * Mathf.Clamp(v, 0, 1), 8), c);
            DrawString(font, new Vector2(w - 32, y + 13), v.ToString("0.00"), HorizontalAlignment.Right, 32, 11, Pal.Ink2);
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
        DrawString(font, new Vector2(0, 12), Title, HorizontalAlignment.Left, -1, 11, Pal.Ink2);
        var r = new Rect2(0, 18, Size.X, Size.Y - 20); DrawRect(r, new Color(1, 1, 1, .6f));
        void Line(float[] v, Color c, float width)
        {
            if (v == null || v.Length < 2) return;
            var pts = new Vector2[v.Length];
            for (int i = 0; i < v.Length; i++) pts[i] = new Vector2(r.Position.X + r.Size.X * i / (v.Length - 1), r.End.Y - r.Size.Y * Mathf.Clamp(v[i], 0, 1));
            DrawPolyline(pts, c, width, true);
        }
        Line(A, Pal.Ink2, 1.5f); Line(B, Pal.Mind, 2.5f);
    }
}
