// The white chamber: the room's schedule, what God has put in it, and where he is in it. His body and mind
// belong to the Run, so the room acts on the same man who lived in the village.
using System;
using Vega.Mind;

namespace Vega.Sim;

public sealed class Chamber
{
    readonly Run run; public Settings Cfg => run.Cfg; Brain Brain => run.Brain; Body B => run.Body; Rng rng => run.Rng;
    public float RS;
    public float Hours => run.PhaseHours;
    public bool Done => Hours >= Cfg["time.days"] * 24 || DoorOpen && Hours - openedAt > 2 || B.Health <= 0;
    // room
    public bool Tray, Dark, SeamFound, DoorOpen, Books, Photo, Radio, Mirror, Rat, Strobe, Siren, Static;
    public float NextMeal, SeamWork, PoundWork, Novelty, KnockT, VoiceT, Shrink;
    public int Tallies, Meals, SkipMeal;
    float openedAt, nextKnock, nextVoice, seamAt;
    // what he is doing, and where
    public Deed Deed = Deed.Rest; public float DeedLeft, X, Z, Yaw, TX, TZ; public bool Moving;

    public Chamber(Run r)
    {
        run = r;
        RS = Cfg.RoomHalf; Books = Cfg.I("room.furnish") == 2; Static = Cfg.I("room.sound") == 2;
        NextMeal = 3; nextKnock = rng.Range(6, 14); nextVoice = 10;
        X = 0; Z = .3f; TX = X; TZ = Z;
        run.Note("room", "He wakes on the floor of a white room.");
        Begin(Deed.Rest, 1.5f);
    }

    public float[] Senses()
    {
        var s = new float[Brain.S]; int light = Cfg.I("room.light");
        bool night = light == 1 && (Hours % 24 > 20 || Hours % 24 < 8);
        float lvl = Dark || night ? .05f : light == 2 ? .45f : 1f;
        if (Strobe) lvl = (Hours * 40 % 1) < .5f ? 1 : 0;
        s[(int)Sense.Light] = lvl;
        s[(int)Sense.Noise] = Math.Clamp((Static ? .7f : Cfg.I("room.sound") == 1 ? .2f : 0) + (Siren ? .9f : 0) + (Radio ? .3f : 0), 0, 1);
        s[(int)Sense.Tray] = Tray ? 1 : 0;
        s[(int)Sense.Hunger] = B.Hunger; s[(int)Sense.Thirst] = B.Thirst; s[(int)Sense.Fatigue] = B.Fatigue; s[(int)Sense.Pain] = B.Pain; s[(int)Sense.Cold] = B.Cold;
        s[(int)Sense.Company] = Math.Clamp((VoiceT > 0 ? .9f : 0) + (Rat ? .35f : 0), 0, 1);
        s[(int)Sense.Books] = Books ? (Deed == Deed.Read ? 1 : .3f) : 0;
        s[(int)Sense.Photo] = Photo ? .6f : 0; s[(int)Sense.Radio] = Radio ? .6f : 0; s[(int)Sense.Mirror] = Mirror ? .5f : 0;
        // finding the seam is vivid at first; it fades to a fact unless pounding makes progress on it
        s[(int)Sense.Seam] = SeamFound ? .25f + .6f * MathF.Exp(-(Hours - seamAt) / 24f) + (Deed == Deed.Pound && Cfg.I("room.door") == 1 ? .2f : 0) : 0;
        s[(int)Sense.DoorOpen] = DoorOpen ? 1 : 0;
        s[(int)Sense.Knock] = KnockT > 0 ? 1 : 0;
        s[(int)Sense.Crowding] = Math.Clamp(1.6f / RS - .4f + Shrink, 0, 1);
        s[(int)Sense.SinceMeal] = Math.Clamp(B.SinceMeal / 30f, 0, 1);
        s[(int)Sense.Assault] = Strobe || Siren ? 1 : 0;
        s[(int)Sense.Novelty] = Novelty;
        s[(int)Sense.Sign] = run.SignT > 0 ? 1 : 0;
        return s;
    }

    bool[] Allowed()
    {
        var a = new bool[Brain.A]; Array.Fill(a, true);
        a[(int)Deed.Eat] = Tray; a[(int)Deed.Read] = Books;
        for (var d = Deed.Work; d <= Deed.Socialize; d++) a[(int)d] = false;
        a[(int)Deed.Pray] = true;   // acts of the world outside
        a[(int)Deed.Talk] = Photo || Rat || VoiceT > 0 || Brain.Perceived[(int)Sense.Company] > .4f;
        a[(int)Deed.Sleep] = B.Fatigue > .35f;
        return a;
    }

    public void Step(float dtH)
    {
        bool asleep = Deed == Deed.Sleep && !Moving;
        float sleepQ = (Cfg.I("room.light") == 0 && !Dark ? .6f : 1f) * (Cfg.I("room.furnish") == 0 ? .75f : 1f) * (Siren || Strobe ? .3f : 1f);
        B.Cold = Math.Clamp(B.Cold + (run.Chill - B.Cold) * .2f * dtH, 0, 1);
        B.Tick(dtH, asleep, sleepQ, Deed == Deed.Exercise ? 2 : 1);
        Room(dtH);
        Brain.Context = null;
        Brain.Perceive(Senses(), dtH);
        Move(dtH);
        DeedLeft -= dtH;
        if (DeedLeft <= 0 && !Moving) { Finish(); var d = Brain.Choose(Allowed()); Begin(d, Duration(d)); }
    }

    void Room(float dtH)
    {
        Novelty = Math.Max(0, Novelty - .3f * dtH);
        KnockT = Math.Max(0, KnockT - dtH); VoiceT = Math.Max(0, VoiceT - dtH);
        if (!Tray && Hours >= NextMeal)
        {
            if (SkipMeal > 0) { SkipMeal--; NextMeal = Hours + MealDelay(); }
            else { Tray = true; Novelty = Math.Max(Novelty, .4f); run.Note("tray", "A tray slides in through the hatch."); }
        }
        int contact = Cfg.I("care.contact");
        if (contact == 1 && Hours >= nextKnock) { KnockT = .1f; nextKnock = Hours + rng.Range(8, 16); run.Note("knock", "Three knocks on the wall."); }
        if (contact == 2 && Hours >= nextVoice) { VoiceT = .2f; nextVoice = Hours + 24; run.Note("voice", "A voice through the wall speaks to him kindly."); }
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
        Deed.Sleep => 2 + B.Fatigue * 7, Deed.Rest => rng.Range(.5f, 1.5f), Deed.Pace => rng.Range(.4f, 1f), Deed.Search => rng.Range(.8f, 1.6f),
        Deed.Eat => .3f, Deed.Shout => .2f, Deed.Hug => rng.Range(.6f, 1.4f), Deed.Exercise => .5f, Deed.Tally => .1f,
        Deed.Remember => rng.Range(.6f, 1.4f), Deed.Pray => rng.Range(.4f, 1f), Deed.Read => rng.Range(1, 2), Deed.Pound => .3f, Deed.Talk => .6f, _ => 1,
    };

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
        if (Brain.F_(Feel.Grip) < .5f && d == Deed.Talk && !Photo && !Rat && VoiceT <= 0) run.Note("phantom", "He talks to someone only he can see.");
        run.Began(d);
    }

    (float, float) WallPoint()
    {
        float a = rng.Range(-RS + .5f, RS - .5f);
        return (int)(rng.Float() * 4) switch { 0 => (a, -RS + .45f), 1 => (RS - .45f, a), 2 => (a, RS - .45f), _ => (-RS + .45f, a) };
    }

    void Finish()
    {
        Brain.Finished();
        switch (Deed)
        {
            case Deed.Eat when Tray: Tray = false; Meals++; B.Eat(); NextMeal = Hours + MealDelay(); break;
            case Deed.Tally: Tallies++; break;
            case Deed.Pound: B.Pain = Math.Min(1, B.Pain + .12f); if (SeamFound && Cfg.I("room.door") == 1) PoundWork += 1; break;
            case Deed.Search when Cfg.I("room.door") > 0 && !SeamFound:
                SeamWork += 1; if (SeamWork > 10 + rng.Float() * 4) { SeamFound = true; seamAt = Hours; Novelty = 1; run.Note("seam", "His fingers find the edge of a door in the wall."); }
                break;
        }
        if (SeamFound && Cfg.I("room.door") == 1 && PoundWork >= 25 && !DoorOpen) Open("The seam gives. The door swings out.");
    }

    public void Open(string text) { if (DoorOpen) return; DoorOpen = true; openedAt = Hours; Novelty = 1; run.Note("door", text); }

    void Move(float dtH)
    {
        float dx = TX - X, dz = TZ - Z, d = MathF.Sqrt(dx * dx + dz * dz), step = 66 * dtH;
        Moving = d > .05f;
        if (!Moving) return;
        Yaw = MathF.Atan2(dx, dz);
        if (step >= d) { X = TX; Z = TZ; } else { X += dx / d * step; Z += dz / d * step; }
    }
}
