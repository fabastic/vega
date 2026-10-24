// The white chamber as a simulation with no rendering in it: his body, the room's schedule, God's acts and his
// position. It runs at any speed in the game, and in the background for the Setup previews.
using System;
using System.Collections.Generic;
using Vega.Mind;

namespace Vega.Sim;

public sealed record Event(float Hour, string Kind, string Text);

public sealed class GodAct
{
    public string Key, Group, Label, Desc; public Action<Chamber> Apply; public Func<Chamber, bool> Active;
}

public sealed class Chamber
{
    public readonly Settings Cfg; public readonly Brain Brain; public readonly Voice Voice; readonly Rng rng;
    public float Hours, RS;
    public int Day => (int)(Hours / 24) + 1;
    public bool Done => Hours >= Cfg["time.days"] * 24 || DoorOpen && Deed == Deed.Rest && Hours - openedAt > 2;
    // body
    public float Hunger = .2f, Thirst = .2f, Fatigue = .3f, Pain, Cold, Health = 1;
    // room
    public bool Tray, Dark, SeamFound, DoorOpen, Books, Photo, Radio, Mirror, Rat, Strobe, Siren, Static;
    public float SinceMeal, NextMeal, SeamWork, Novelty, KnockT, VoiceT, Warmth, Shrink;
    public int Tallies, Meals, Hallucinations;
    float openedAt, nextKnock, nextVoice, skipMeal, seamAt;
    // what he is doing, and where
    public Deed Deed = Deed.Rest; public float DeedLeft, X, Z, Yaw, TX, TZ; public bool Moving;
    public readonly List<Event> Log = new();
    public readonly List<(float h, string act, float[] before, float[] after)> GodEffects = new();
    readonly List<(float due, int idx)> pendingEffects = new();
    public (Sense sense, float strength) Phantom;

    public Chamber(Settings cfg, Voice voice = null)
    {
        Cfg = cfg.Clone(); Voice = voice;
        rng = new Rng((ulong)Cfg.I("time.seed") * 2654435761UL);
        var me = new Personality { Openness = Cfg["vega.open"], Neuroticism = Cfg["vega.neuro"], Sociability = Cfg["vega.social"], Resilience = Cfg["vega.resil"] };
        Brain = new Brain(me, (ulong)Cfg.I("time.seed"));
        RS = Cfg.RoomHalf; Books = Cfg.I("room.furnish") == 2; Static = Cfg.I("room.sound") == 2;
        LivePrelude();
        NextMeal = 3; nextKnock = rng.Range(6, 14); nextVoice = 10;
        X = 0; Z = .3f; TX = X; TZ = Z;
        Note("room", "He wakes on the floor of a white room.");
        Begin(Deed.Rest, 1.5f);
    }

    // Before the room there was a life. A few days of village senses build his world model and the memories the
    // room will later hand back to him.
    void LivePrelude()
    {
        var s = new float[Brain.S];
        for (int t = 0; t < 4 * 24 * 4; t++)
        {
            float h = t / 4f, day = h % 24;
            Array.Clear(s);
            s[(int)Sense.Light] = day > 6 && day < 20 ? 1 : .1f;
            s[(int)Sense.Noise] = day > 7 && day < 22 ? .4f + rng.Float() * .3f : .05f;
            s[(int)Sense.Company] = day > 8 && day < 21 ? (rng.Float() < .7f ? .8f : .2f) : .1f;
            s[(int)Sense.Novelty] = rng.Float() * .6f;
            s[(int)Sense.Hunger] = (day % 6) / 12f; s[(int)Sense.Fatigue] = day < 7 ? .2f : (day - 7) / 20f;
            s[(int)Sense.Photo] = 0; s[(int)Sense.Radio] = day > 18 && day < 22 ? .5f : 0;
            Brain.Hour = h - 96;
            Brain.Perceive(s, .25f);
        }
    }

    public void Note(string kind, string text) { Log.Add(new Event(Hours, kind, text)); if (Log.Count > 400) Log.RemoveAt(0); }

    public float[] Senses()
    {
        var s = new float[Brain.S]; int light = Cfg.I("room.light");
        bool night = light == 1 && Hours % 24 > 20 || light == 1 && Hours % 24 < 8;
        float lvl = Dark || night ? .05f : light == 2 ? .45f : 1f;
        if (Strobe) lvl = (Hours * 40 % 1) < .5f ? 1 : 0;
        s[(int)Sense.Light] = lvl;
        s[(int)Sense.Noise] = Math.Clamp((Static ? .7f : Cfg.I("room.sound") == 1 ? .2f : 0) + (Siren ? .9f : 0) + (Radio ? .3f : 0), 0, 1);
        s[(int)Sense.Tray] = Tray ? 1 : 0;
        s[(int)Sense.Hunger] = Hunger; s[(int)Sense.Thirst] = Thirst; s[(int)Sense.Fatigue] = Fatigue; s[(int)Sense.Pain] = Pain; s[(int)Sense.Cold] = Cold;
        s[(int)Sense.Company] = Math.Clamp((VoiceT > 0 ? .9f : 0) + (Rat ? .35f : 0), 0, 1);
        s[(int)Sense.Books] = Books ? (Deed == Deed.Read ? 1 : .3f) : 0;
        s[(int)Sense.Photo] = Photo ? .6f : 0; s[(int)Sense.Radio] = Radio ? .6f : 0; s[(int)Sense.Mirror] = Mirror ? .5f : 0;
        // finding the seam is vivid at first; it fades to a fact unless pounding makes progress on it
        s[(int)Sense.Seam] = SeamFound ? .25f + .6f * MathF.Exp(-(Hours - seamAt) / 24f) + (Deed == Deed.Pound && Cfg.I("room.door") == 1 ? .2f : 0) : 0; s[(int)Sense.DoorOpen] = DoorOpen ? 1 : 0;
        s[(int)Sense.Knock] = KnockT > 0 ? 1 : 0;
        s[(int)Sense.Crowding] = Math.Clamp(1.6f / RS - .4f + Shrink, 0, 1);
        s[(int)Sense.SinceMeal] = Math.Clamp(SinceMeal / 30f, 0, 1);
        s[(int)Sense.Assault] = Strobe || Siren ? 1 : 0;
        s[(int)Sense.Novelty] = Novelty;
        return s;
    }

    bool[] Allowed()
    {
        var a = new bool[Brain.A]; Array.Fill(a, true);
        a[(int)Deed.Eat] = Tray; a[(int)Deed.Read] = Books;
        a[(int)Deed.Talk] = Photo || Rat || VoiceT > 0 || Brain.Perceived[(int)Sense.Company] > .4f;
        a[(int)Deed.Sleep] = Fatigue > .35f;
        return a;
    }

    public void Step(float dtH)
    {
        Hours += dtH; Brain.Hour = Hours;
        Body(dtH); Room(dtH);
        Brain.Perceive(Senses(), dtH);
        Phantom = Brain.Phantom();
        if (Phantom.strength > .15f && rng.Float() < Phantom.strength * .25f * dtH) { Hallucinations++; Note("phantom", PhantomText(Phantom.sense)); }
        Move(dtH);
        DeedLeft -= dtH;
        if (DeedLeft <= 0 && !Moving) { Finish(); var d = Brain.Choose(Allowed()); Begin(d, Duration(d)); }
        for (int i = pendingEffects.Count - 1; i >= 0; i--)
            if (Hours >= pendingEffects[i].due) { var e = GodEffects[pendingEffects[i].idx]; GodEffects[pendingEffects[i].idx] = (e.h, e.act, e.before, (float[])Brain.Feelings.Clone()); pendingEffects.RemoveAt(i); }
    }

    // A hallucination is reported as the observer sees it, not in his words
    static string PhantomText(Sense s) => s switch
    {
        Sense.Company => "He turns toward someone who isn't there.",
        Sense.Knock => "He goes still, listening for a knock that never came.",
        Sense.Tray => "He reaches for a tray that isn't there.",
        Sense.DoorOpen => "He stares at the wall as if a door stood open in it.",
        Sense.Radio => "He hums along to music nobody is playing.",
        _ => "He watches something move that isn't moving.",
    };

    void Body(float dtH)
    {
        bool asleep = Deed == Deed.Sleep && !Moving;
        Hunger = Math.Clamp(Hunger + dtH / 30f, 0, 1); Thirst = Math.Clamp(Thirst + dtH / 20f, 0, 1);
        float sleepQ = (Cfg.I("room.light") == 0 && !Dark ? .6f : 1f) * (Cfg.I("room.furnish") == 0 ? .75f : 1f) * (Siren || Strobe ? .3f : 1f);
        Fatigue = Math.Clamp(Fatigue + (asleep ? -dtH / 7f * sleepQ : dtH / 18f * (Deed == Deed.Exercise ? 2 : 1)), 0, 1);
        Pain = Math.Clamp(Pain - .05f * dtH + (Hunger > .85f ? .02f * dtH : 0) + (Cold > .5f ? .01f * dtH : 0), 0, 1);
        Cold = Math.Clamp(Cold + (-Warmth - Cold) * .2f * dtH, 0, 1);
        if (Hunger > .95f || Thirst > .95f) Health = Math.Max(0, Health - .01f * dtH);
        SinceMeal += dtH;
    }

    void Room(float dtH)
    {
        Novelty = Math.Max(0, Novelty - .3f * dtH);
        KnockT = Math.Max(0, KnockT - dtH); VoiceT = Math.Max(0, VoiceT - dtH);
        if (!Tray && Hours >= NextMeal)
        {
            if (skipMeal > 0) { skipMeal--; NextMeal = Hours + MealDelay(); }
            else { Tray = true; Novelty = Math.Max(Novelty, .4f); Note("tray", "A tray slides in through the hatch."); }
        }
        int contact = Cfg.I("care.contact");
        if (contact == 1 && Hours >= nextKnock) { KnockT = .1f; nextKnock = Hours + rng.Range(8, 16); Note("knock", "Three knocks on the wall."); }
        if (contact == 2 && Hours >= nextVoice) { VoiceT = .2f; nextVoice = Hours + 24; Note("voice", "A voice through the wall speaks to him kindly."); }
    }

    float MealDelay()
    {
        float d = Hours / 24, total = Cfg["time.days"];
        return Cfg.I("care.food") switch
        {
            0 => rng.Range(7, 9), 1 => rng.Range(4, 20), 2 => rng.Range(14, 30),
            _ => d < total * .5f ? rng.Range(7, 9) : d < total * .85f ? rng.Range(12, 24) : 1e9f,
        };
    }

    float Duration(Deed d) => d switch
    {
        Deed.Sleep => 2 + Fatigue * 7, Deed.Rest => rng.Range(.5f, 1.5f), Deed.Pace => rng.Range(.4f, 1f), Deed.Search => rng.Range(.8f, 1.6f),
        Deed.Eat => .3f, Deed.Shout => .2f, Deed.Hug => rng.Range(.6f, 1.4f), Deed.Exercise => .5f, Deed.Tally => .1f,
        Deed.Remember => rng.Range(.6f, 1.4f), Deed.Read => rng.Range(1, 2), Deed.Pound => .3f, Deed.Talk => .6f, _ => 1,
    };

    public float VoiceCooldown;
    void Begin(Deed d, float dur)
    {
        Deed = d; DeedLeft = dur;
        (TX, TZ) = d switch
        {
            Deed.Sleep => Cfg.I("room.furnish") > 0 ? (-RS + .55f, -RS + 1.1f) : (-RS + .5f, RS - .5f),
            Deed.Eat => (0, RS - .45f),
            Deed.Search => WallPoint(),
            Deed.Pound => (Math.Min(.8f, RS - .8f), -RS + .45f),
            Deed.Tally => (0, RS - .45f),
            Deed.Read => (-RS + .8f, RS - 1.5f),
            Deed.Hug => (RS - .5f, RS - .5f),
            Deed.Pace => (rng.Range(-RS + .5f, RS - .5f), rng.Range(-RS + .5f, RS - .5f)),
            _ => (X, Z),
        };
        if (Brain.F_(Feel.Grip) < .5f && d == Deed.Talk && !Photo && !Rat && VoiceT <= 0) Note("phantom", "He talks to someone only he can see.");
        // he speaks only from his voice network, and only when it is trained
        if (Voice != null && VoiceCooldown <= Hours && rng.Float() < .35f)
        {
            var line = Voice.Speak(Brain.Thought, rng);
            if (line != null) { Note("say", line); VoiceCooldown = Hours + 1.5f; }
        }
    }

    (float, float) WallPoint()
    {
        float a = rng.Range(-RS + .5f, RS - .5f);
        return rng.Pick(new[] { .25f, .25f, .25f, .25f }) switch { 0 => (a, -RS + .45f), 1 => (RS - .45f, a), 2 => (a, RS - .45f), _ => (-RS + .45f, a) };
    }

    void Finish()
    {
        Brain.Finished();
        switch (Deed)
        {
            case Deed.Eat when Tray:
                Tray = false; Meals++; Hunger = Math.Max(0, Hunger - .75f); Thirst = Math.Max(0, Thirst - .8f); SinceMeal = 0; NextMeal = Hours + MealDelay(); break;
            case Deed.Tally: Tallies++; break;
            case Deed.Pound: Pain = Math.Min(1, Pain + .12f); if (SeamFound && Cfg.I("room.door") == 1) SeamWork += .05f; break;
            case Deed.Search when Cfg.I("room.door") > 0 && !SeamFound:
                SeamWork += 1; if (SeamWork > 10 + rng.Float() * 4) { SeamFound = true; seamAt = Hours; Novelty = 1; Note("seam", "His fingers find the edge of a door in the wall."); }
                break;
        }
        if (SeamFound && Cfg.I("room.door") == 1 && SeamWork > 13.5f && !DoorOpen) Open("The seam gives. The door swings out.");
    }

    void Open(string text) { DoorOpen = true; openedAt = Hours; Note("door", text); }

    void Move(float dtH)
    {
        float dx = TX - X, dz = TZ - Z, d = MathF.Sqrt(dx * dx + dz * dz), step = 1.1f * 3600 * dtH / 60f;   // he walks slowly, a sim minute per metre
        Moving = d > .05f;
        if (!Moving) return;
        Yaw = MathF.Atan2(dx, dz);
        if (step >= d) { X = TX; Z = TZ; } else { X += dx / d * step; Z += dz / d * step; }
    }

    // ---------- God mode, grouped ----------
    public static readonly string[] GodGroups = { "Provide", "Environment", "Contact", "Torment", "Release" };
    public static readonly List<GodAct> Acts = new()
    {
        new() { Key = "tray", Group = "Provide", Label = "Send a tray now", Desc = "Food and water through the hatch, off schedule. Breaks the rhythm his world model learned.", Apply = c => { c.Tray = true; c.Novelty = .6f; }, Active = c => c.Tray },
        new() { Key = "books", Group = "Provide", Label = "Books", Desc = "A shelf of books. Adds the Books sense: less boredom, and Read becomes possible.", Apply = c => c.Books = !c.Books, Active = c => c.Books },
        new() { Key = "photo", Group = "Provide", Label = "A photograph", Desc = "A photo of someone he loves. Love and longing rise, loneliness falls a little, and he can Talk to it.", Apply = c => c.Photo = !c.Photo, Active = c => c.Photo },
        new() { Key = "radio", Group = "Provide", Label = "A radio", Desc = "Mostly static, sometimes music. Hope rises, and his senses stop being flat.", Apply = c => c.Radio = !c.Radio, Active = c => c.Radio },
        new() { Key = "mirror", Group = "Provide", Label = "A mirror", Desc = "He can see himself. Shame comes in, and so does company of a kind.", Apply = c => c.Mirror = !c.Mirror, Active = c => c.Mirror },
        new() { Key = "dark", Group = "Environment", Label = "Lights off / on", Desc = "Darkness lets him sleep properly, but in long darkness monotony grows faster.", Apply = c => c.Dark = !c.Dark, Active = c => c.Dark },
        new() { Key = "warm", Group = "Environment", Label = "Warm the room", Desc = "Removes cold.", Apply = c => c.Warmth = 0, Active = c => c.Warmth == 0 },
        new() { Key = "cold", Group = "Environment", Label = "Chill the room", Desc = "Cold rises to 80% within a few hours: pain, worse sleep, less wellbeing.", Apply = c => c.Warmth = -.8f, Active = c => c.Warmth < 0 },
        new() { Key = "static", Group = "Environment", Label = "Static noise", Desc = "Constant static. Anger up, calm down.", Apply = c => c.Static = !c.Static, Active = c => c.Static },
        new() { Key = "shrink", Group = "Environment", Label = "Close the walls in", Desc = "Adds 0.3 Crowding: anger and dread.", Apply = c => c.Shrink = c.Shrink > 0 ? 0 : .3f, Active = c => c.Shrink > 0 },
        new() { Key = "knock", Group = "Contact", Label = "Knock", Desc = "Three knocks on the wall. A spike of fear, then something to answer.", Apply = c => { c.KnockT = .1f; c.Novelty = .5f; } },
        new() { Key = "voice", Group = "Contact", Label = "Speak kindly", Desc = "Ten minutes of a kind voice: real Company.", Apply = c => { c.VoiceT = .2f; c.Novelty = .4f; } },
        new() { Key = "rat", Group = "Contact", Label = "Let a rat in", Desc = "Something alive. Some company, permanent until you remove it.", Apply = c => c.Rat = !c.Rat, Active = c => c.Rat },
        new() { Key = "strobe", Group = "Torment", Label = "Strobe", Desc = "Flashing light: an Assault sense, no real sleep, fear.", Apply = c => c.Strobe = !c.Strobe, Active = c => c.Strobe },
        new() { Key = "siren", Group = "Torment", Label = "Siren", Desc = "A siren: Noise and Assault together.", Apply = c => c.Siren = !c.Siren, Active = c => c.Siren },
        new() { Key = "skip", Group = "Torment", Label = "Skip the next meal", Desc = "The tray doesn't come when it should. What his model predicted fails to arrive.", Apply = c => c.skipMeal++ },
        new() { Key = "open", Group = "Release", Label = "Open the door", Desc = "The door opens. The DoorOpen sense: the biggest jump in hope and joy there is.", Apply = c => { if (!c.DoorOpen) c.Open("The door opens from the outside."); } },
    };

    public void God(GodAct act)
    {
        var before = (float[])Brain.Feelings.Clone();
        act.Apply(this);
        Note("god", act.Label);
        GodEffects.Add((Hours, act.Label, before, null)); pendingEffects.Add((Hours + 1, GodEffects.Count - 1));
    }
}
