// Every setting the experiment has, with what it changes. The Setup screen is generated from these definitions,
// and each one explains its effect in terms of the senses it feeds into Vega's networks.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Vega.Sim;

public sealed class SettingDef
{
    public string Key, Group, Label;
    public string[] Options;            // null for a number
    public float Min, Max, Step = .05f, Default;
    public Func<Settings, string> Explain;
    public bool IsChoice => Options != null;
}

public sealed class Settings
{
    readonly Dictionary<string, float> v = new();
    public Settings() { foreach (var d in Defs) v[d.Key] = d.Default; }
    public float this[string k] { get => v[k]; set => v[k] = value; }
    public int I(string k) => (int)MathF.Round(v[k]);
    public Settings Clone() { var s = new Settings(); foreach (var kv in v) s.v[kv.Key] = kv.Value; return s; }
    public string Show(SettingDef d) => d.IsChoice ? d.Options[I(d.Key)] : d.Step >= 1 ? v[d.Key].ToString("0") : v[d.Key].ToString("0.00");

    public float RoomHalf => new[] { 1.6f, 2.5f, 3.6f }[I("room.size")];

    public static readonly string[] Groups = { "Room", "Care", "Time", "Vega" };
    public static readonly List<SettingDef> Defs = new()
    {
        new() { Key = "room.size", Group = "Room", Label = "Size", Options = new[] { "Small", "Medium", "Large" }, Default = 1,
            Explain = s => $"Walls {s.RoomHalf * 2:0.0} m apart. A smaller room raises Crowding, which feeds anger and dread, and his pacing turns around sooner." },
        new() { Key = "room.light", Group = "Room", Label = "Light", Options = new[] { "Always on", "Day and night", "Dim" }, Default = 0,
            Explain = s => s.I("room.light") switch {
                0 => "There is never any dark. His sleep is shallow (it recovers at 60%), fatigue builds, and the senses barely change: monotony rises fastest.",
                1 => "Twelve hours of light, then twelve of dark. Sleep recovers fully, and the change is something his world model can learn.",
                _ => "A grey half-light all the time. Fear is a little higher, sleep is normal, and monotony is high." } },
        new() { Key = "room.sound", Group = "Room", Label = "Sound", Options = new[] { "Silent", "Hum", "Static" }, Default = 0,
            Explain = s => s.I("room.sound") switch {
                0 => "Nothing to hear, so his senses are flat and grip erodes faster.",
                1 => "A low hum: a little Noise and slightly less monotony.",
                _ => "Constant static: high Noise, which feeds anger and drains calm, but his senses are never quite flat." } },
        new() { Key = "room.furnish", Group = "Room", Label = "Furniture", Options = new[] { "Bare", "Bed and toilet", "Bed, toilet and books" }, Default = 1,
            Explain = s => s.I("room.furnish") switch {
                0 => "He sleeps on the floor (recovery at 75%), and there is nothing to do but his body and his memory.",
                1 => "A bed to sleep in. Nothing to read.",
                _ => "Books add a Books sense: boredom falls, curiosity rises, and Read becomes an act he can learn to reach for." } },
        new() { Key = "room.door", Group = "Room", Label = "Door", Options = new[] { "None", "Hidden seam", "Steel" }, Default = 1,
            Explain = s => s.I("room.door") switch {
                0 => "No way out exists, so Search can never find anything and hope has nothing to attach to.",
                1 => "Search can find the seam (about 12 hours of searching). Finding it lights the Seam sense: a jump in hope and curiosity, and Pound gets a reason.",
                _ => "There is a seam, but the door behind it never gives. The hope it brings is learned to be empty." } },
        new() { Key = "care.food", Group = "Care", Label = "Food", Options = new[] { "Regular", "Erratic", "Scarce", "Dwindling" }, Default = 0,
            Explain = s => s.I("care.food") switch {
                0 => "A tray every 7 to 9 hours. His world model learns the rhythm, and SinceMeal stays low.",
                1 => "A tray every 4 to 20 hours. It can't be predicted, so surprise stays high and grip falls.",
                2 => "A tray every 14 to 30 hours. Hunger and despair rise, and pain comes past 85% hunger.",
                _ => "Regular at first, then the gaps widen, and the last days bring nothing. Hope is learned, then unlearned." } },
        new() { Key = "care.contact", Group = "Care", Label = "Contact", Options = new[] { "None", "Knocks", "A voice" }, Default = 0,
            Explain = s => s.I("care.contact") switch {
                0 => "Nobody, ever. Company comes only from memory and, later, hallucination.",
                1 => "Knocks on the wall about twice a day: a Knock sense, a little fear and a reason to Shout back.",
                _ => "A kind voice for ten minutes each day: real Company, which pulls loneliness down and grip up." } },
        new() { Key = "life.days", Group = "Time", Label = "Days of life before", Min = 1, Max = 20, Step = 1, Default = 4,
            Explain = s => $"{s["life.days"]:0} days in the village first. These are the days his memories come from: the people the room later hands back to him are the people he spent these evenings with." },
        new() { Key = "after.days", Group = "Time", Label = "Days after", Min = 1, Max = 40, Step = 1, Default = 10,
            Explain = s => $"{s["after.days"]:0} days in the world he comes back to." },
        new() { Key = "world.fate", Group = "Care", Label = "The world while he is gone", Options = new[] { "Everyone dies", "Most die", "Nothing happens" }, Default = 1,
            Explain = s => s.I("world.fate") switch {
                0 => "He comes back to a dead world: bodies (Dead), ruins (Ruin), no food but what he forages, wolves at night. Grief and despair have something real to attach to.",
                1 => "Most die. Three survivors are out there and drift back one by one, each a jump in company and hope.",
                _ => "The world goes on as if he had never left. Whatever he carries out of the room, he carries alone among people who don't know." } },
        new() { Key = "time.days", Group = "Time", Label = "Days in the room", Min = 3, Max = 60, Step = 1, Default = 14,
            Explain = s => $"{s["time.days"]:0} days, about {s["time.days"] * 96:0} ticks of his mind. Hallucinations need monotony to build up, usually after 4 or 5 days." },
        new() { Key = "time.seed", Group = "Time", Label = "Seed", Min = 1, Max = 9999, Step = 1, Default = 4242,
            Explain = s => "The same seed with the same settings gives the same run. The previews depend on this." },
        new() { Key = "vega.open", Group = "Vega", Label = "Openness", Min = 0, Max = 1, Default = .6f,
            Explain = s => $"Sets his resting curiosity ({-1 + 2 * s["vega.open"]:+0.0;-0.0} on its bias) and capacity for awe. High openness keeps him searching and reading." },
        new() { Key = "vega.neuro", Group = "Vega", Label = "Neuroticism", Min = 0, Max = 1, Default = .5f,
            Explain = s => "Raises his resting dread and despair, and how frightening novelty feels." },
        new() { Key = "vega.social", Group = "Vega", Label = "Sociability", Min = 0, Max = 1, Default = .6f,
            Explain = s => "How much loneliness and longing he carries at rest, and how vivid his remembered company is." },
        new() { Key = "vega.resil", Group = "Vega", Label = "Resilience", Min = 0, Max = 1, Default = .5f,
            Explain = s => "How fast his grip recovers when the room gives him something real to perceive." },
    };
    public static SettingDef Def(string key) => Defs.First(d => d.Key == key);
}
