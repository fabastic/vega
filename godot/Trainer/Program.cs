// Command-line tools for the mind, with no Godot.
//   dotnet run --project Trainer -- check            run a whole life and print how he fares day by day
//   dotnet run --project Trainer -- speak [voice.bin] run a life with the trained voice and print what he says
using System;
using System.IO;
using System.Linq;
using Vega.Mind;
using Vega.Sim;

var cmd = args.Length > 0 ? args[0] : "check";
Voice voice = null;
if (cmd == "speak") voice = Voice.Load(File.OpenRead(args.Length > 1 ? args[1] : "voice.bin"));
var s = new Settings(); s["vega.faith"] = float.Parse(Environment.GetEnvironmentVariable("FAITH") ?? "0.55", System.Globalization.CultureInfo.InvariantCulture); if (Environment.GetEnvironmentVariable("SEED") is string sd) s["time.seed"] = float.Parse(sd);
var t0 = DateTime.Now; var r = new Run(s, voice);
var deeds = new int[Brain.A]; var phaseDeeds = new System.Collections.Generic.Dictionary<Phase, int[]>();
for (int day = 1; !r.Done; day++)
{
    while (r.Hours < day * 24 && !r.Done)
    {
        r.Step(Preview.Dt); deeds[(int)r.Deed]++;
        if (!phaseDeeds.ContainsKey(r.Phase)) phaseDeeds[r.Phase] = new int[Brain.A];
        phaseDeeds[r.Phase][(int)r.Deed]++;
        if (voice != null) System.Threading.Thread.Sleep(0);
    }
    var b = r.Brain; var B = r.Body;
    Console.WriteLine($"day {day,2} {r.Phase,-7} grip {b.F_(Feel.Grip):0.00} fear {b.F_(Feel.Fear):0.00} hope {b.F_(Feel.Hope):0.00} lonely {b.F_(Feel.Loneliness):0.00} grief {b.F_(Feel.Grief):0.00} joy {b.F_(Feel.Joy):0.00} despair {b.F_(Feel.Despair):0.00} | hunger {B.Hunger:0.00} health {B.Health:0.00} | monotony {b.Monotony:0.00} | phantoms {r.Hallucinations} mem {b.Memory.Count}");
}
foreach (var (ph, d) in phaseDeeds)
    Console.WriteLine($"{ph}: " + string.Join(", ", d.Select((n, i) => (n, i)).Where(x => x.n > 0).OrderByDescending(x => x.n).Take(8).Select(x => $"{Brain.DeedNames[x.i]} {100f * x.n / d.Sum():0}%")));
if (voice != null) System.Threading.Thread.Sleep(3000);
foreach (var e in r.Log.Where(e => e.Kind != "tray")) Console.WriteLine($"  d{(int)(e.Hour / 24) + 1,2} {e.Hour % 24,5:00.0} {e.Kind,-8} {e.Text}");
Console.WriteLine($"took {(DateTime.Now - t0).TotalMilliseconds:0} ms");
