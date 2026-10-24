// One whole life, with no rendering: days in the village, the white room, then the world he comes back to. A
// single Brain carries through all three, so what he lived through outside is what the room hands back to him,
// and what the room did to him is what walks out.
using System;
using System.Collections.Generic;
using Vega.Mind;

namespace Vega.Sim;

public enum Phase { Life, Chamber, After, End }
public sealed record Event(float Hour, string Kind, string Text);

public sealed class Body
{
    public float Hunger = .2f, Thirst = .2f, Fatigue = .3f, Pain, Cold, Health = 1, SinceMeal;
    public void Tick(float dtH, bool asleep, float sleepQ, float exertion)
    {
        Hunger = Math.Clamp(Hunger + dtH / 30f, 0, 1); Thirst = Math.Clamp(Thirst + dtH / 20f, 0, 1);
        Fatigue = Math.Clamp(Fatigue + (asleep ? -dtH / 7f * sleepQ : dtH / 18f * exertion), 0, 1);
        Pain = Math.Clamp(Pain - .05f * dtH + (Hunger > .85f ? .02f * dtH : 0) + (Cold > .5f ? .01f * dtH : 0), 0, 1);
        if (Hunger > .95f || Thirst > .95f) Health = Math.Max(0, Health - .01f * dtH);
        else if (Pain < .2f) Health = Math.Min(1, Health + .002f * dtH);
        SinceMeal += dtH;
    }
    public void Eat(float amount = 1) { Hunger = Math.Max(0, Hunger - .75f * amount); Thirst = Math.Max(0, Thirst - .8f * amount); SinceMeal = 0; }
}

public sealed class GodAct
{
    public string Key, Group, Label, Desc; public Phase[] When; public Action<Run> Apply; public Func<Run, bool> Active;
    public bool Allowed(Run r) => Array.IndexOf(When, r.Phase) >= 0;
}

public sealed class Run
{
    public readonly Settings Cfg; public readonly Brain Brain; public readonly Voice Voice; public readonly Rng Rng;
    public readonly Body Body = new();
    public readonly World World; public Chamber Chamber;
    public Phase Phase = Phase.Life;
    public float Hours, PhaseStart;
    public int Day => (int)(Hours / 24) + 1;
    public float PhaseHours => Hours - PhaseStart;
    public readonly List<Event> Log = new();
    public readonly List<(float h, string act, float[] before, float[] after)> GodEffects = new();
    readonly List<(float due, int idx)> pendingEffects = new();
    readonly System.Collections.Concurrent.ConcurrentQueue<string> spoken = new();
    float voiceCooldown;
    public int Lines;

    public Run(Settings cfg, Voice voice = null)
    {
        Cfg = cfg.Clone(); Voice = voice;
        Rng = new Rng((ulong)Cfg.I("time.seed") * 2654435761UL);
        var me = new Personality { Openness = Cfg["vega.open"], Neuroticism = Cfg["vega.neuro"], Sociability = Cfg["vega.social"], Resilience = Cfg["vega.resil"], Faith = Cfg["vega.faith"] };
        Brain = new Brain(me, (ulong)Cfg.I("time.seed"));
        World = new World(this);
        Hours = 7; PhaseStart = 7;   // the first morning
        Note("life", "Morning in " + World.Villages[0].Name + ".");
        World.Begin();
    }

    public void Note(string kind, string text) { Log.Add(new Event(Hours, kind, text)); if (Log.Count > 600) Log.RemoveAt(0); }

    // the act he is doing and where he is, whichever place he is in
    public Deed Deed => Phase == Phase.Chamber ? Chamber.Deed : World.Deed;
    public bool Moving => Phase == Phase.Chamber ? Chamber.Moving : World.Moving;
    public (Sense sense, float strength) Phantom;
    public int Hallucinations;

    public void Step(float dtH)
    {
        if (Phase == Phase.End) return;
        while (spoken.TryDequeue(out var s)) { Note("say", s); Lines++; }
        if (FaithAtStart < 0) FaithAtStart = Brain.F_(Feel.Faith);
        Hours += dtH; Brain.Hour = Hours; SignT = Math.Max(0, SignT - dtH);
        if (Phase == Phase.Chamber) Chamber.Step(dtH); else World.Step(dtH);
        Phantom = Brain.Phantom();
        if (Phantom.strength > .1f && Rng.Float() < Phantom.strength * .3f * dtH) { Hallucinations++; Note("phantom", PhantomText(Phantom.sense)); }
        for (int i = pendingEffects.Count - 1; i >= 0; i--)
            if (Hours >= pendingEffects[i].due) { var e = GodEffects[pendingEffects[i].idx]; GodEffects[pendingEffects[i].idx] = (e.h, e.act, e.before, (float[])Brain.Feelings.Clone()); pendingEffects.RemoveAt(i); }
        Advance();
    }

    void Advance()
    {
        if (Phase == Phase.Life && PhaseHours >= Cfg["life.days"] * 24 - 2 && World.Deed == Deed.Sleep && !World.Moving || Phase == Phase.Life && PhaseHours >= Cfg["life.days"] * 24 + 6)
        {
            Note("taken", "He falls asleep in his own bed. He does not wake there.");
            Phase = Phase.Chamber; PhaseStart = Hours; Chamber = new Chamber(this);
            World.Decay();   // while he is gone, the world outside goes on without him
        }
        else if (Phase == Phase.Chamber && Chamber.Done)
        {
            if (Body.Health <= 0) { Note("end", "He dies in the white room."); Phase = Phase.End; DiedInRoom = true; return; }
            Note("out", Chamber.DoorOpen ? "He walks out through the door into the light." : "He wakes in the grass outside. The room is gone.");
            Phase = Phase.After; PhaseStart = Hours; World.Return();
        }
        else if (Phase == Phase.After && (PhaseHours >= Cfg["after.days"] * 24 || Body.Health <= 0))
        {
            Note("end", Body.Health <= 0 ? "His body gives out." : "The story stops here. He goes on.");
            Phase = Phase.End;
        }
    }

    // a phantom as an observer would report it; the person comes from whatever memory he is leaning on
    string PhantomText(Sense s)
    {
        string who = Brain.Recalled >= 0 && Brain.Memory[Brain.Recalled].Who is string w ? w : "someone";
        return s switch
        {
            Sense.Company => $"He turns toward {who}, who isn't there.",
            Sense.Knock => "He goes still, listening for a knock that never came.",
            Sense.Tray => "He reaches for food that isn't there.",
            Sense.DoorOpen => "He stares at the wall as if a door stood open in it.",
            Sense.Radio => "He hums along to music nobody is playing.",
            Sense.Dead => "He sees a body where there is none.",
            Sense.Danger => "He spins round at a sound nobody made.",
            _ => "He watches something move that isn't moving.",
        };
    }

    // Called whenever he starts an act: sometimes his voice puts the moment into words, off the main thread.
    public void Began(Deed d)
    {
        if (Voice == null || d == Deed.Sleep || voiceCooldown > Hours || Rng.Float() > .35f) return;
        voiceCooldown = Hours + 1.2f;
        var cond = Brain.VoiceCond(d); var r = new Rng(Rng.Next());
        System.Threading.Tasks.Task.Run(() => { var line = Voice.Speak(cond, r); if (line != null) spoken.Enqueue(line); });
    }

    public bool Done => Phase == Phase.End;

    public void God(GodAct act)
    {
        if (!act.Allowed(this)) return;
        var before = (float[])Brain.Feelings.Clone();
        act.Apply(this); Note("god", act.Label);
        SignT = 3;   // he may read it as a sign
        GodEffects.Add((Hours, act.Label, before, null)); pendingEffects.Add((Hours + 1, GodEffects.Count - 1));
    }

    static readonly Phase[] Room = { Phase.Chamber }, Out = { Phase.Life, Phase.After }, Any = { Phase.Life, Phase.Chamber, Phase.After };
    public static readonly string[] GodGroups = { "Provide", "Environment", "Contact", "Torment", "World" };
    public static readonly List<GodAct> Acts = new()
    {
        new() { Key = "tray", Group = "Provide", When = Room, Label = "Send a tray now", Desc = "Food and water through the hatch, off schedule. Breaks the rhythm his world model learned.", Apply = r => { r.Chamber.Tray = true; r.Chamber.Novelty = .6f; }, Active = r => r.Chamber?.Tray ?? false },
        new() { Key = "books", Group = "Provide", When = Room, Label = "Books", Desc = "A shelf of books. Adds the Books sense: less boredom, and Read becomes possible.", Apply = r => r.Chamber.Books = !r.Chamber.Books, Active = r => r.Chamber?.Books ?? false },
        new() { Key = "photo", Group = "Provide", When = Room, Label = "A photograph", Desc = "A photo of the person he loves most. Love and longing rise, and he can Talk to it.", Apply = r => r.Chamber.Photo = !r.Chamber.Photo, Active = r => r.Chamber?.Photo ?? false },
        new() { Key = "radio", Group = "Provide", When = Room, Label = "A radio", Desc = "Mostly static, sometimes music. Hope rises, and his senses stop being flat.", Apply = r => r.Chamber.Radio = !r.Chamber.Radio, Active = r => r.Chamber?.Radio ?? false },
        new() { Key = "mirror", Group = "Provide", When = Room, Label = "A mirror", Desc = "He can see himself. Shame comes in, and so does company of a kind.", Apply = r => r.Chamber.Mirror = !r.Chamber.Mirror, Active = r => r.Chamber?.Mirror ?? false },
        new() { Key = "food", Group = "Provide", When = Out, Label = "Leave food for him", Desc = "A basket of food appears near him: three meals' worth.", Apply = r => { r.World.Food += 3; r.World.Novelty = .6f; } },
        new() { Key = "dark", Group = "Environment", When = Room, Label = "Lights off / on", Desc = "Darkness lets him sleep properly, but in long darkness monotony grows faster.", Apply = r => r.Chamber.Dark = !r.Chamber.Dark, Active = r => r.Chamber?.Dark ?? false },
        new() { Key = "cold", Group = "Environment", When = Any, Label = "Cold", Desc = "Cold rises to 80% within a few hours: pain, worse sleep, less wellbeing.", Apply = r => r.Chill = r.Chill > 0 ? 0 : .8f, Active = r => r.Chill > 0 },
        new() { Key = "static", Group = "Environment", When = Room, Label = "Static noise", Desc = "Constant static. Anger up, calm down.", Apply = r => r.Chamber.Static = !r.Chamber.Static, Active = r => r.Chamber?.Static ?? false },
        new() { Key = "shrink", Group = "Environment", When = Room, Label = "Close the walls in", Desc = "Adds 0.3 Crowding: anger and dread.", Apply = r => r.Chamber.Shrink = r.Chamber.Shrink > 0 ? 0 : .3f, Active = r => (r.Chamber?.Shrink ?? 0) > 0 },
        new() { Key = "storm", Group = "Environment", When = Out, Label = "Storm", Desc = "Rain and wind for six hours: Noise, cold, and everyone goes indoors.", Apply = r => { r.World.StormT = 6; r.World.Novelty = .7f; }, Active = r => r.World.StormT > 0 },
        new() { Key = "knock", Group = "Contact", When = Room, Label = "Knock", Desc = "Three knocks on the wall. A spike of fear, then something to answer.", Apply = r => { r.Chamber.KnockT = .1f; r.Chamber.Novelty = .5f; } },
        new() { Key = "voice", Group = "Contact", When = Room, Label = "Speak kindly", Desc = "Ten minutes of a kind voice: real Company.", Apply = r => { r.Chamber.VoiceT = .2f; r.Chamber.Novelty = .4f; } },
        new() { Key = "rat", Group = "Contact", When = Room, Label = "Let a rat in", Desc = "Something alive. Some company, until you take it away.", Apply = r => r.Chamber.Rat = !r.Chamber.Rat, Active = r => r.Chamber?.Rat ?? false },
        new() { Key = "survivor", Group = "Contact", When = new[] { Phase.After }, Label = "Send a survivor", Desc = "Someone from his old life walks up the road, alive.", Apply = r => r.World.SendSurvivor() },
        new() { Key = "strobe", Group = "Torment", When = Room, Label = "Strobe", Desc = "Flashing light: an Assault sense, no real sleep, fear.", Apply = r => r.Chamber.Strobe = !r.Chamber.Strobe, Active = r => r.Chamber?.Strobe ?? false },
        new() { Key = "siren", Group = "Torment", When = Room, Label = "Siren", Desc = "A siren: Noise and Assault together.", Apply = r => r.Chamber.Siren = !r.Chamber.Siren, Active = r => r.Chamber?.Siren ?? false },
        new() { Key = "skip", Group = "Torment", When = Room, Label = "Skip the next meal", Desc = "The tray doesn't come when it should. What his model predicted fails to arrive.", Apply = r => r.Chamber.SkipMeal++ },
        new() { Key = "wolves", Group = "Torment", When = Out, Label = "Wolves", Desc = "Wolves come close tonight: Danger. If he has no fence they may hurt him.", Apply = r => r.World.WolvesT = 8, Active = r => r.World.WolvesT > 0 },
        new() { Key = "open", Group = "World", When = Room, Label = "Open the door", Desc = "The door opens. The DoorOpen sense: the biggest jump in hope and joy there is.", Apply = r => r.Chamber.Open("The door opens from the outside.") },
        new() { Key = "festival", Group = "World", When = new[] { Phase.Life }, Label = "A festival", Desc = "Everyone comes to the plaza tonight: company, music, novelty. Memories made here are the ones the room hands back.", Apply = r => r.World.FestivalT = 5 },
        new() { Key = "plague", Group = "World", When = new[] { Phase.Life }, Label = "Sickness in the village", Desc = "Two neighbours die. Bodies and grief before the room ever comes.", Apply = r => r.World.Sicken(2) },
        new() { Key = "skiplife", Group = "World", When = new[] { Phase.Life }, Label = "Take him now", Desc = "End his life in the village tonight and put him in the room.", Apply = r => r.Cfg["life.days"] = Math.Max(1, r.PhaseHours / 24 + .01f) },
    };
    public float Chill, SignT; public bool DiedInRoom;
    public float FaithAtStart = -1;
}
