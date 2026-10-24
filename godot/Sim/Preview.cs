// Shows what a change does: the same seed is run twice in the background, with and without the change, and
// the outcomes are compared over his whole life (village, room and after).
using System;
using System.Linq;
using Vega.Mind;

namespace Vega.Sim;

public sealed class Outcome
{
    public float[] MeanFeel = new float[Brain.F];
    public float[] DailyGrip, DailyFear, DailyLonely;
    public int Meals, Hallucinations, Buried; public bool Seam, Out; public float Health;
    public float[] DeedShare = new float[Brain.A];
}

public static class Preview
{
    public const float Dt = .25f;
    public static Outcome Run(Settings s)
    {
        var r = new Run(s); var o = new Outcome();
        int days = (int)(s["life.days"] + s["time.days"] + s["after.days"]) + 1, n = 0;
        o.DailyGrip = new float[days]; o.DailyFear = new float[days]; o.DailyLonely = new float[days];
        while (!r.Done && r.Hours < days * 24)
        {
            r.Step(Dt); n++;
            for (int i = 0; i < Brain.F; i++) o.MeanFeel[i] += r.Brain.Feelings[i];
            o.DeedShare[(int)r.Deed]++;
            int d = Math.Min(days - 1, (int)(r.Hours / 24));
            o.DailyGrip[d] = r.Brain.F_(Feel.Grip); o.DailyFear[d] = r.Brain.F_(Feel.Fear); o.DailyLonely[d] = r.Brain.F_(Feel.Loneliness);
        }
        for (int i = 0; i < Brain.F; i++) o.MeanFeel[i] /= Math.Max(1, n);
        for (int i = 0; i < Brain.A; i++) o.DeedShare[i] /= Math.Max(1, n);
        o.Health = r.Body.Health; o.Hallucinations = r.Hallucinations; o.Buried = r.World.Buried;
        if (r.Chamber != null) { o.Meals = r.Chamber.Meals; o.Seam = r.Chamber.SeamFound; o.Out = r.Chamber.DoorOpen; }
        return o;
    }

    // the largest differences between two outcomes, as readable lines
    public static string[] Compare(Outcome a, Outcome b, int top = 6)
    {
        var lines = Enumerable.Range(0, Brain.F)
            .Select(i => (name: Brain.FeelNames[i], d: b.MeanFeel[i] - a.MeanFeel[i]))
            .OrderByDescending(x => MathF.Abs(x.d)).Take(top)
            .Select(x => $"{x.name,-11} {(x.d >= 0 ? "+" : "-")}{MathF.Abs(x.d):0.00}").ToList();
        if (a.Meals != b.Meals) lines.Add($"Room meals  {a.Meals} -> {b.Meals}");
        if (a.Hallucinations != b.Hallucinations) lines.Add($"Phantoms    {a.Hallucinations} -> {b.Hallucinations}");
        if (a.Seam != b.Seam) lines.Add($"Finds seam  {a.Seam} -> {b.Seam}");
        if (a.Out != b.Out) lines.Add($"Breaks out  {a.Out} -> {b.Out}");
        if (MathF.Abs(a.Health - b.Health) > .05f) lines.Add($"Health      {a.Health:0.00} -> {b.Health:0.00}");
        return lines.ToArray();
    }
}
