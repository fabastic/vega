// Command-line tools for the mind, with no Godot.
//   dotnet run --project Trainer -- check     run the default chamber and print how he fares day by day
using System;
using System.Linq;
using Vega.Mind;
using Vega.Sim;

var cmd = args.Length > 0 ? args[0] : "check";
if (cmd == "check")
{
    var s = new Settings();
    var t0 = DateTime.Now; var c = new Chamber(s);
    var deeds = new int[Brain.A];
    for (int day = 1; c.Hours < s["time.days"] * 24 && !c.Done; day++)
    {
        while (c.Hours < day * 24 && !c.Done) { c.Step(Preview.Dt); deeds[(int)c.Deed]++; }
        var b = c.Brain;
        Console.WriteLine($"day {day,2}  grip {b.F_(Feel.Grip):0.00} fear {b.F_(Feel.Fear):0.00} hope {b.F_(Feel.Hope):0.00} lonely {b.F_(Feel.Loneliness):0.00} bored {b.F_(Feel.Boredom):0.00} despair {b.F_(Feel.Despair):0.00} | hunger {c.Hunger:0.00} fatigue {c.Fatigue:0.00} | surprise {b.SurpriseAvg:0.00} monotony {b.Monotony:0.00} | meals {c.Meals} phantoms {c.Hallucinations} mem {b.Memory.Count} seam {c.SeamFound}");
    }
    Console.WriteLine("deeds: " + string.Join(", ", deeds.Select((n, i) => (n, i)).OrderByDescending(x => x.n).Select(x => $"{Brain.DeedNames[x.i]} {100f * x.n / deeds.Sum():0}%")));
    foreach (var e in c.Log.Where(e => e.Kind != "tray").Take(25)) Console.WriteLine($"  h{e.Hour,6:0.0} {e.Kind,-8} {e.Text}");
    Console.WriteLine($"took {(DateTime.Now - t0).TotalMilliseconds:0} ms");
    var a = Preview.Run(s); var s2 = s.Clone(); s2["room.light"] = 1; var b2 = Preview.Run(s2);
    Console.WriteLine("Always on -> Day and night:\n  " + string.Join("\n  ", Preview.Compare(a, b2)));
}
