// The world outside the room: three villages, their people, and Vega among them. The neighbours follow a simple
// day (sleep, work, meals, the plaza in the evening) and grow fond of whoever they spend evenings with. Vega's
// acts come from his own networks. While he is in the room the world decays; when he comes back, he finds it.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Vega.Mind;

namespace Vega.Sim;

public sealed class Village { public string Name; public Vector2 At; public List<House> Houses = new(); public Vector2 Plaza => At; }
public sealed class House { public Vector2 At; public float Yaw; public int Village; public bool Ruined; public float Tilt; }
public sealed class Person
{
    public string Name, Job; public int Village, Id; public House Home; public Vector2 Pos, Target, JobAt;
    public string Doing = "sleep"; public bool Alive = true, Away, Survivor, Buried; public float Offset, Shirt, Height;
}
public sealed class Structure { public string Kind; public Vector2 At; }

public sealed class World
{
    readonly Run run; Rng R => run.Rng;
    public readonly List<Village> Villages = new();
    public readonly List<Person> People = new();
    public readonly List<Vector2> Bushes = new(), Trees = new();
    public readonly List<Structure> Built = new();
    public readonly List<Vector2> Wolves = new();
    public float[,] Aff;          // fondness between people; the last index is Vega
    public int VegaId => People.Count;
    public Vector2 Pos, Target; public float Yaw; public bool Moving, Indoors;
    public House Home; public Vector2 Workshop;
    public Deed Deed = Deed.Sleep; public float DeedLeft;
    public float Food, Novelty, StormT, WolvesT, FestivalT;
    public bool Ruined;
    public int Buried, Foraged, Talks;
    public string Companion;

    static readonly string[] Names = { "Ines", "Mira", "Kofi", "Tomas", "Hana", "Anaya", "Lena", "Luca", "Ravi", "Elif", "Jun", "Sana", "Ola", "Nils", "Pavel", "Noor", "Dario", "Felix", "Amara", "Yusuf", "Keiko", "Ade", "Rhea", "Bram", "Mateo", "Tess", "Ivy", "Omar", "Greta", "Sol" };
    static readonly string[] Jobs = { "farmer", "baker", "smith", "fisher", "teacher", "healer", "weaver", "miller" };
    static readonly string[] VillageNames = { "Ashford", "Lindhollow", "Marrow Creek" };

    public World(Run r)
    {
        run = r;
        var centres = new[] { new Vector2(0, 0), new Vector2(75, -40), new Vector2(-65, -55) };
        for (int v = 0; v < 3; v++)
        {
            var vil = new Village { Name = VillageNames[v], At = centres[v] }; Villages.Add(vil);
            int n = v == 0 ? 10 : 8;
            for (int k = 0; k < n; k++)
            {
                float a = MathF.Tau * k / n + R.Range(-.15f, .15f), d = R.Range(14, 20);
                var at = vil.At + new Vector2(MathF.Cos(a), MathF.Sin(a)) * d;
                vil.Houses.Add(new House { At = at, Yaw = MathF.Atan2(vil.At.X - at.X, vil.At.Y - at.Y), Village = v });
            }
        }
        for (int i = 0; i < 260; i++)
        {
            var p = new Vector2(R.Range(-130, 130), R.Range(-130, 100));
            if (Villages.Any(v => Vector2.Distance(v.At, p) < 30)) continue;
            Trees.Add(p);
            if (R.Float() < .25f) Bushes.Add(p + new Vector2(R.Range(-3, 3), R.Range(-3, 3)));
        }
        int id = 0;
        foreach (var vil in Villages)
            foreach (var h in vil.Houses.Skip(vil == Villages[0] ? 1 : 0))
            {
                int per = R.Float() < .6f ? 1 : 2;
                for (int j = 0; j < per && id < Names.Length; j++)
                {
                    var job = Jobs[(int)(R.Float() * Jobs.Length)];
                    People.Add(new Person { Id = id, Name = Names[id], Job = job, Village = Villages.IndexOf(vil), Home = h, Pos = h.At,
                        JobAt = job == "farmer" ? vil.At + Dir(R.Range(0, MathF.Tau)) * 32 : job == "fisher" ? vil.At + new Vector2(0, 34) : vil.At + Dir(R.Range(0, MathF.Tau)) * 8,
                        Offset = R.Range(-1, 1), Shirt = R.Float(), Height = R.Range(.92f, 1.08f) });
                    id++;
                }
            }
        Home = Villages[0].Houses[0]; Pos = Home.At; Target = Pos; Workshop = Villages[0].At + new Vector2(6, -6);
        Aff = new float[People.Count + 1, People.Count + 1];
        for (int a = 0; a <= People.Count; a++) for (int b = 0; b <= People.Count; b++) if (a != b) Aff[a, b] = R.Range(0, .25f);
        // he grew up here: a few people are already close to him
        foreach (var p in People.Where(p => p.Village == 0).OrderBy(_ => R.Float()).Take(3)) { Aff[VegaId, p.Id] = R.Range(.45f, .7f); Aff[p.Id, VegaId] = R.Range(.4f, .7f); }
    }
    static Vector2 Dir(float a) => new(MathF.Cos(a), MathF.Sin(a));

    public void Begin() => StartDeed(Deed.Rest, 1);

    public int Hour => (int)(run.Hours % 24);
    public float Daylight { get { float h = run.Hours % 24; return Math.Clamp(MathF.Sin((h - 6) / 14f * MathF.PI), 0, 1); } }

    // ---------- the neighbours' day ----------
    void People_(float dtH)
    {
        float h = run.Hours % 24;
        foreach (var p in People)
        {
            if (!p.Alive || p.Away) continue;
            float t = h + p.Offset * .5f;
            (p.Doing, p.Target) =
                StormT > 0 ? ("shelter", p.Home.At) :
                FestivalT > 0 && t > 17 ? ("festival", Villages[p.Village].Plaza + Dir(p.Id * 1.7f) * 4) :
                t < 6 || t >= 22 ? ("sleep", p.Home.At) :
                t < 8 ? ("home", p.Home.At) :
                t < 12 || (t >= 13 && t < 17) ? ("work", p.JobAt) :
                t < 13 ? ("eat", p.Home.At) :
                t < 18 ? ("market", Villages[p.Village].Plaza + Dir(p.Id) * 5) :
                t < 21 ? ("plaza", Villages[p.Village].Plaza + Dir(p.Id * 2.3f) * 3.5f) : ("home", p.Home.At);
            p.Pos = Vector2.Lerp(p.Pos, p.Target, Math.Min(1, dtH * 6));
        }
        // evenings together make people fonder of each other
        foreach (var a in People) foreach (var b in People)
            if (a.Id < b.Id && a.Alive && b.Alive && (a.Doing is "plaza" or "festival") && Vector2.Distance(a.Pos, b.Pos) < 5)
            { Aff[a.Id, b.Id] = Math.Min(1, Aff[a.Id, b.Id] + .01f * dtH); Aff[b.Id, a.Id] = Math.Min(1, Aff[b.Id, a.Id] + .01f * dtH); }
    }

    // who he is with and how close they are
    public IEnumerable<(Person p, float d)> Near(float r) => People.Where(p => p.Alive && !p.Away).Select(p => (p, d: Vector2.Distance(p.Pos, Pos))).Where(x => x.d < r);

    public float[] Senses()
    {
        var s = new float[Brain.S]; var b = run.Body;
        float day = Daylight;
        s[(int)Sense.Light] = Indoors ? .3f + day * .3f : .1f + day * .9f;
        var near = Near(15).ToList(); var close = near.Where(x => x.d < 5).ToList();
        s[(int)Sense.Noise] = Math.Clamp(near.Count / 8f + (StormT > 0 ? .6f : 0) + (FestivalT > 0 ? .3f : 0), 0, 1);
        s[(int)Sense.Company] = Math.Clamp(close.Sum(x => .25f + Aff[VegaId, x.p.Id] * .6f), 0, 1);
        s[(int)Sense.Tray] = Indoors && Vector2.Distance(Pos, Home.At) < 3 && (!Ruined || Food > 0) ? 1 : Food > 0 ? .6f : 0;
        s[(int)Sense.Hunger] = b.Hunger; s[(int)Sense.Thirst] = b.Thirst; s[(int)Sense.Fatigue] = b.Fatigue; s[(int)Sense.Pain] = b.Pain; s[(int)Sense.Cold] = b.Cold;
        s[(int)Sense.Radio] = FestivalT > 0 && !Indoors ? .7f : 0;   // music at the festival
        s[(int)Sense.SinceMeal] = Math.Clamp(b.SinceMeal / 30f, 0, 1);
        s[(int)Sense.Novelty] = Novelty;
        s[(int)Sense.Outdoors] = Indoors ? .1f : 1;
        float toVillage = Villages.Min(v => Vector2.Distance(v.At, Pos));
        s[(int)Sense.Ruin] = Ruined ? (toVillage < 30 ? .85f : .35f) : 0;
        s[(int)Sense.Dead] = Math.Clamp(People.Count(p => !p.Alive && !p.Buried && Vector2.Distance(p.Pos, Pos) < 12) * .45f, 0, 1);
        s[(int)Sense.Danger] = Math.Clamp(Wolves.Count(w => Vector2.Distance(w, Pos) < 25) * .4f + (StormT > 0 && !Indoors ? .2f : 0), 0, 1);
        return s;
    }

    bool[] Allowed()
    {
        var a = new bool[Brain.A];
        foreach (var d in new[] { Deed.Rest, Deed.Sleep, Deed.Exercise, Deed.Remember, Deed.Explore, Deed.Shout, Deed.Hug }) a[(int)d] = true;
        a[(int)Deed.Sleep] = run.Body.Fatigue > .35f;
        a[(int)Deed.Eat] = !Ruined || Food > 0;
        a[(int)Deed.Work] = !Ruined;
        bool anyone = People.Any(p => p.Alive && !p.Away && (!Ruined || p.Survivor));
        a[(int)Deed.Socialize] = anyone && !Ruined && (Hour >= 17 || FestivalT > 0);
        a[(int)Deed.Talk] = anyone;
        a[(int)Deed.Forage] = Ruined || Hour > 8 && Hour < 18;
        a[(int)Deed.Build] = Ruined;
        a[(int)Deed.Bury] = People.Any(p => !p.Alive && !p.Buried);
        return a;
    }

    public void Step(float dtH)
    {
        var b = run.Body;
        Novelty = Math.Max(0, Novelty - .3f * dtH);
        StormT = Math.Max(0, StormT - dtH); FestivalT = Math.Max(0, FestivalT - dtH);
        if (!Ruined) People_(dtH); else Survivors(dtH);
        WolvesStep(dtH);
        float cold = run.Chill + (StormT > 0 && !Indoors ? .5f : 0) + (Ruined && !Indoors && Daylight < .1f && !Built.Any(s => s.Kind == "shelter") ? .35f : 0);
        b.Cold = Math.Clamp(b.Cold + (Math.Min(1, cold) - b.Cold) * .3f * dtH, 0, 1);
        bool asleep = Deed == Deed.Sleep && !Moving;
        b.Tick(dtH, asleep, Indoors || Built.Any(s => s.Kind == "shelter") ? 1 : .7f, Deed is Deed.Work or Deed.Build or Deed.Exercise ? 1.6f : 1);
        var near = Near(5).OrderByDescending(x => Aff[VegaId, x.p.Id]).FirstOrDefault();
        run.Brain.Context = near.p?.Name;
        run.Brain.Perceive(Senses(), dtH);
        // walking: across a village takes a few minutes, so in a quarter-hour step he arrives
        var dv = Target - Pos; Moving = dv.Length() > .3f;
        if (Moving) { Yaw = MathF.Atan2(dv.X, dv.Y); Pos += dv * Math.Min(1, 4500 * dtH / dv.Length()); Moving = (Target - Pos).Length() > .3f; }
        DeedLeft -= dtH;
        if (DeedLeft <= 0 && !Moving) { Finish(); run.Brain.Finished(); var d = run.Brain.Choose(Allowed()); StartDeed(d, Duration(d)); }
    }

    float Duration(Deed d) => d switch
    {
        Deed.Sleep => 2 + run.Body.Fatigue * 7, Deed.Work => R.Range(2, 4), Deed.Socialize => R.Range(1, 2), Deed.Explore => R.Range(1, 3),
        Deed.Forage => R.Range(1, 2), Deed.Build => R.Range(2, 3), Deed.Bury => 1.5f, Deed.Eat => .5f, Deed.Talk => .7f, Deed.Exercise => .7f, _ => R.Range(.5f, 1.5f),
    };

    void StartDeed(Deed d, float dur)
    {
        Deed = d; DeedLeft = dur;
        Person nearest(Func<Person, bool> f) => People.Where(p => p.Alive && !p.Away && f(p)).OrderBy(p => Vector2.Distance(p.Pos, Pos) - Aff[VegaId, p.Id] * 20).FirstOrDefault();
        Target = d switch
        {
            Deed.Sleep or Deed.Rest or Deed.Remember or Deed.Hug or Deed.Eat when !Ruined || Food <= 0 || d != Deed.Eat => Home.At,
            Deed.Work => Workshop,
            Deed.Socialize => (nearest(p => p.Doing is "plaza" or "festival")?.Pos ?? Villages[0].Plaza) + Dir(R.Range(0, MathF.Tau)) * 1.2f,
            Deed.Talk => (nearest(p => !Ruined || p.Survivor)?.Pos ?? Pos) + Dir(R.Range(0, MathF.Tau)) * 1.1f,
            Deed.Explore => Home.At + Dir(R.Range(0, MathF.Tau)) * R.Range(25, 60),
            Deed.Forage => Bushes.OrderBy(x => Vector2.Distance(x, Pos) + R.Range(0, 20)).First(),
            Deed.Build => Home.At + Dir(Built.Count * 1.1f) * 5,
            Deed.Bury => People.Where(p => !p.Alive && !p.Buried).OrderBy(p => Vector2.Distance(p.Pos, Pos)).Select(p => p.Pos).FirstOrDefault(),
            _ => Pos,
        };
        Indoors = d is Deed.Sleep or Deed.Rest or Deed.Remember or Deed.Hug && !(Ruined && Home.Ruined);
        run.Began(d);
    }

    void Finish()
    {
        var b = run.Body;
        switch (Deed)
        {
            case Deed.Eat: if (Ruined) Food = Math.Max(0, Food - 1); b.Eat(); break;
            case Deed.Forage:
                float luck = Ruined ? .55f : .8f;
                if (R.Float() < luck) { Food += 1 + (R.Float() < .4f ? 1 : 0); Foraged++; } else run.Note("forage", "He comes back with nothing.");
                break;
            case Deed.Work: if (!Ruined) Food = Math.Min(Food + .5f, 6); break;
            case Deed.Build:
                string kind = Built.Count(s => s.Kind == "fence") < 2 ? "fence" : !Built.Any(s => s.Kind == "shelter") ? "shelter" : "garden";
                Built.Add(new Structure { Kind = kind, At = Target }); run.Note("build", $"He builds a {kind}."); Novelty = .4f;
                break;
            case Deed.Bury:
                var body = People.Where(p => !p.Alive && !p.Buried).OrderBy(p => Vector2.Distance(p.Pos, Pos)).FirstOrDefault();
                if (body != null) { body.Buried = true; Buried++; run.Note("bury", $"He buries {body.Name}."); }
                break;
            case Deed.Talk: case Deed.Socialize:
                foreach (var (p, d) in Near(4)) { Aff[VegaId, p.Id] = Math.Min(1, Aff[VegaId, p.Id] + .04f); Aff[p.Id, VegaId] = Math.Min(1, Aff[p.Id, VegaId] + .04f); Talks++; }
                break;
        }
    }

    void WolvesStep(float dtH)
    {
        WolvesT = Math.Max(0, WolvesT - dtH);
        bool night = Daylight < .1f;
        if (Ruined && night && WolvesT <= 0 && R.Float() < .02f * dtH) { WolvesT = 5; run.Note("wolves", "Wolves, close, in the dark."); }
        if (WolvesT > 0 && Wolves.Count == 0) for (int i = 0; i < 3; i++) Wolves.Add(Home.At + Dir(R.Range(0, MathF.Tau)) * 30);
        if (WolvesT <= 0) { Wolves.Clear(); return; }
        for (int i = 0; i < Wolves.Count; i++)
        {
            var to = Pos - Wolves[i]; float d = to.Length();
            int fences = Built.Count(s => s.Kind == "fence");
            float keep = Indoors ? 8 : 2 + fences * 6;
            if (d > keep) Wolves[i] += to / d * Math.Min(d - keep, 20 * dtH);
            if (d < 2.5f && R.Float() < .3f * dtH) { run.Body.Pain = Math.Min(1, run.Body.Pain + .35f); run.Body.Health = Math.Max(0, run.Body.Health - .08f); Novelty = 1; run.Note("hurt", "A wolf catches his arm."); }
        }
    }

    // ---------- while he is gone ----------
    public void Decay()
    {
        int fate = run.Cfg.I("world.fate");
        int keep = fate switch { 0 => 0, 1 => 3, _ => People.Count };
        var survivors = People.OrderBy(_ => R.Float()).Take(keep).ToHashSet();
        foreach (var p in People)
        {
            if (survivors.Contains(p)) { p.Survivor = true; p.Away = fate != 2; continue; }
            p.Alive = false; p.Pos = p.Home.At + Dir(p.Id) * 1.5f; p.Doing = "dead";
        }
        if (fate != 2) foreach (var v in Villages) foreach (var h in v.Houses) { h.Ruined = R.Float() < .6f; h.Tilt = h.Ruined ? R.Range(-.3f, .3f) : 0; }
        Ruined = fate != 2;
        Food = 0;
    }

    public void Return()
    {
        Pos = Home.At + new Vector2(4, 4); Target = Pos; Novelty = 1;
        if (Ruined) run.Note("after", $"{Villages[0].Name} is empty. Doors hang open. Nobody answers.");
        else run.Note("after", $"{Villages[0].Name} is just as he left it. Nobody seems to know he was gone.");
        StartDeed(Deed.Explore, 1);
    }

    // survivors drift back one by one; once found, they keep near him
    float nextReturn = 30;
    void Survivors(float dtH)
    {
        if (run.PhaseHours > nextReturn && People.FirstOrDefault(p => p.Survivor && p.Away) is Person s) { Arrive(s); nextReturn = run.PhaseHours + R.Range(40, 90); }
        foreach (var p in People.Where(p => p.Alive && !p.Away))
        {
            float h = run.Hours % 24;
            p.Target = h < 7 || h > 21 ? Home.At + Dir(p.Id) * 3 : Pos + Dir(p.Id * 1.3f + run.Hours * .05f) * 3;
            p.Doing = "with him"; p.Pos = Vector2.Lerp(p.Pos, p.Target, Math.Min(1, dtH * 3));
        }
    }
    void Arrive(Person s) { s.Away = false; s.Pos = Pos + new Vector2(20, 0); Companion = s.Name; Novelty = 1; run.Note("survivor", $"{s.Name} walks up the road, alive."); }
    public void SendSurvivor()
    {
        var s = People.FirstOrDefault(p => p.Survivor && p.Away) ?? People.FirstOrDefault(p => !p.Alive && !p.Buried);
        if (s == null) return;
        if (!s.Alive) { s.Alive = true; s.Survivor = true; }
        Arrive(s);
    }

    public void Sicken(int n)
    {
        foreach (var p in People.Where(p => p.Alive).OrderByDescending(p => p.Village == 0 ? 1 : 0).ThenBy(_ => R.Float()).Take(n))
        { p.Alive = false; p.Pos = p.Home.At; p.Doing = "dead"; run.Note("death", $"{p.Name} dies of the fever."); }
        Novelty = 1;
    }
}
