// Shows what a change does: the same seed is run twice in the background, with and without the change, and
// the outcomes are compared.
using System;
using System.Linq;
using Vega.Mind;

namespace Vega.Sim;

public sealed class Outcome
{
    public float[] MeanFeel = new float[Brain.F];
    public float[] DailyGrip, DailyFear, DailyLonely;
    public int Meals, Tallies, Hallucinations; public bool Seam, Out; public float Hunger, Health;
    public float[] DeedShare = new float[Brain.A];
}

public static class Preview
{
    public const float Dt = .25f;
    public static Outcome Run(Settings s, int maxDays = 21)
    {
        var c = new Chamber(s); var o = new Outcome();
        int days = Math.Min(maxDays, s.I("time.days")), n = 0;
        o.DailyGrip = new float[days]; o.DailyFear = new float[days]; o.DailyLonely = new float[days];
        while (c.Hours < days * 24 && !c.Done)
        {
            c.Step(Dt); n++;
            for (int i = 0; i < Brain.F; i++) o.MeanFeel[i] += c.Brain.Feelings[i];
            o.DeedShare[(int)c.Deed]++; o.Hunger += c.Hunger;
            int d = Math.Min(days - 1, (int)(c.Hours / 24));
            o.DailyGrip[d] = c.Brain.F_(Feel.Grip); o.DailyFear[d] = c.Brain.F_(Feel.Fear); o.DailyLonely[d] = c.Brain.F_(Feel.Loneliness);
        }
        for (int i = 0; i < Brain.F; i++) o.MeanFeel[i] /= Math.Max(1, n);
        for (int i = 0; i < Brain.A; i++) o.DeedShare[i] /= Math.Max(1, n);
        o.Hunger /= Math.Max(1, n); o.Health = c.Health;
        o.Meals = c.Meals; o.Tallies = c.Tallies; o.Hallucinations = c.Hallucinations; o.Seam = c.SeamFound; o.Out = c.DoorOpen;
        return o;
    }

    // the largest differences between two outcomes, as readable lines
    public static string[] Compare(Outcome a, Outcome b, int top = 6)
    {
        var lines = Enumerable.Range(0, Brain.F)
            .Select(i => (name: Brain.FeelNames[i], d: b.MeanFeel[i] - a.MeanFeel[i]))
            .OrderByDescending(x => MathF.Abs(x.d)).Take(top)
            .Select(x => $"{x.name,-11} {(x.d >= 0 ? "+" : "-")}{MathF.Abs(x.d):0.00}").ToList();
        if (a.Meals != b.Meals) lines.Add($"Meals       {a.Meals} -> {b.Meals}");
        if (a.Hallucinations != b.Hallucinations) lines.Add($"Phantoms    {a.Hallucinations} -> {b.Hallucinations}");
        if (a.Seam != b.Seam) lines.Add($"Finds seam  {a.Seam} -> {b.Seam}");
        if (a.Out != b.Out) lines.Add($"Gets out    {a.Out} -> {b.Out}");
        return lines.ToArray();
    }
}
