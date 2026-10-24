// Vega's mind: separate networks, each with its own job and its own learning signal.
//   SenseNet   senses -> percept (a fixed projection, like an early sensory layer)
//   WorldNet   a GRU over percept + last action. Its PredictHead learns online to predict the next senses, and the
//              error is surprise. When the senses go flat (a white room), percepts drift toward the predictions:
//              he begins to perceive his own model. That is where his hallucinations come from.
//   FeelNet    16 named feelings: an appraisal prior on the senses plus a residual on the world state. The
//              residual is conditioned online by what followed, so states that preceded pain come to feel like dread.
//   MemoryNet  episodic slots, written when something matters and recalled by attention on the world state
//   WillNet    a policy over actions, with innate drive priors, learned online by REINFORCE on wellbeing
//   ThoughtNet world + feelings + recall + senses + action -> the thought vector that VoiceNet puts into words
using System;
using System.Collections.Generic;

namespace Vega.Mind;

public enum Sense { Light, Noise, Tray, Hunger, Thirst, Fatigue, Pain, Cold, Company, Books, Photo, Radio, Mirror, Seam, DoorOpen, Knock, Crowding, SinceMeal, Assault, Novelty, Outdoors, Ruin, Dead, Danger }
public enum Feel { Fear, Hope, Loneliness, Boredom, Anger, Grief, Curiosity, Calm, Dread, Joy, Longing, Shame, Love, Awe, Despair, Grip }
public enum Deed { Rest, Sleep, Pace, Search, Eat, Shout, Hug, Exercise, Tally, Remember, Read, Pound, Talk, Work, Explore, Forage, Build, Bury, Socialize }

public sealed class Episode
{
    public float[] Key, Feel; public float Valence, Hour; public Deed Deed; public float[] Senses; public string Who;
}

public sealed class Brain
{
    public const int S = 24, F = 16, A = 19, P = 32, H = 64, T = 48;
    public static readonly string[] SenseNames = Enum.GetNames<Sense>(), FeelNames = Enum.GetNames<Feel>(), DeedNames = Enum.GetNames<Deed>();

    public readonly Linear SenseNet, PredictHead, FeelPrior, FeelResidual, WillPrior, WillNet, ThoughtNet;
    public readonly Gru WorldNet;
    public readonly List<Episode> Memory = new();
    public const int MemoryCap = 256;

    // live state, read by the views
    public float[] Senses = new float[S], Perceived = new float[S], Predicted = new float[S], Percept = new float[P];
    public float[] World = new float[H], Feelings = new float[F], Recall = new float[F], Thought = new float[T], Intent = new float[A];
    public float Surprise, SurpriseAvg = .2f, Monotony, Variety = .1f, Wellbeing, RecallValence; public int Recalled = -1;
    public float[] LastAction = new float[A];
    public readonly Personality Me;
    readonly Rng rng;
    float[] willIn, chosenP; int chosen = -1; float baseline;

    public Brain(Personality me, ulong seed)
    {
        Me = me; rng = new Rng(seed);
        SenseNet = new Linear(S, P, rng, 1.4f);
        WorldNet = new Gru(P + A, H, rng, 1.1f);
        PredictHead = new Linear(H, S, rng, .3f);
        FeelPrior = new Linear(S, F, rng, 0f);
        FeelResidual = new Linear(H, F, rng, .05f);
        WillPrior = new Linear(S + F, A, rng, 0f);
        WillNet = new Linear(H + F + F, A, rng, .05f);
        ThoughtNet = new Linear(H + F + F + S + A, T, rng, 1f);
        SeedAppraisal(); SeedDrives();
        for (int i = 0; i < F; i++) Feelings[i] = .2f;
        Feelings[(int)Feel.Grip] = 1f; Feelings[(int)Feel.Hope] = .6f; Feelings[(int)Feel.Fear] = .5f;
    }

    // The innate part: what a sense means to a body before anything has been learned. Biases sit at the resting level.
    void SeedAppraisal()
    {
        void W(Feel f, Sense s, float w) => FeelPrior[(int)f, (int)s] = w;
        float n = Me.Neuroticism, so = Me.Sociability, op = Me.Openness;
        FeelPrior.B[(int)Feel.Fear] = -1.6f; W(Feel.Fear, Sense.Pain, 2.2f); W(Feel.Fear, Sense.Assault, 2.6f); W(Feel.Fear, Sense.Knock, .8f); W(Feel.Fear, Sense.Light, -.3f); W(Feel.Fear, Sense.Novelty, .8f + n); W(Feel.Fear, Sense.Danger, 2.4f); W(Feel.Fear, Sense.Dead, 1f);
        FeelPrior.B[(int)Feel.Hope] = -.7f; W(Feel.Hope, Sense.Tray, .9f); W(Feel.Hope, Sense.Seam, 1f); W(Feel.Hope, Sense.DoorOpen, 3f); W(Feel.Hope, Sense.Radio, .7f); W(Feel.Hope, Sense.SinceMeal, -1.2f);
        FeelPrior.B[(int)Feel.Loneliness] = -.3f + so; W(Feel.Loneliness, Sense.Company, -2.5f); W(Feel.Loneliness, Sense.Photo, -.5f); W(Feel.Loneliness, Sense.Radio, -.4f);
        FeelPrior.B[(int)Feel.Boredom] = .2f; W(Feel.Boredom, Sense.Books, -1.6f); W(Feel.Boredom, Sense.Novelty, -2f); W(Feel.Boredom, Sense.Company, -1f); W(Feel.Boredom, Sense.Radio, -.7f);
        FeelPrior.B[(int)Feel.Anger] = -2f; W(Feel.Anger, Sense.Hunger, 1.2f); W(Feel.Anger, Sense.Assault, 1.6f); W(Feel.Anger, Sense.Crowding, .9f); W(Feel.Anger, Sense.Noise, .8f);
        FeelPrior.B[(int)Feel.Grief] = -2.2f; W(Feel.Grief, Sense.Photo, .9f); W(Feel.Grief, Sense.Dead, 2.8f); W(Feel.Grief, Sense.Ruin, 1f);
        FeelPrior.B[(int)Feel.Curiosity] = -1f + 2f * op; W(Feel.Curiosity, Sense.Novelty, 2.2f); W(Feel.Curiosity, Sense.Books, .6f); W(Feel.Curiosity, Sense.Seam, 1f); W(Feel.Curiosity, Sense.Fatigue, -1f);
        FeelPrior.B[(int)Feel.Calm] = .2f; W(Feel.Calm, Sense.Noise, -1.2f); W(Feel.Calm, Sense.Assault, -2.5f); W(Feel.Calm, Sense.Pain, -1.5f); W(Feel.Calm, Sense.Hunger, -.8f); W(Feel.Calm, Sense.Outdoors, .6f); W(Feel.Calm, Sense.Danger, -2f);
        FeelPrior.B[(int)Feel.Dread] = -1.2f + n; W(Feel.Dread, Sense.SinceMeal, 1.4f); W(Feel.Dread, Sense.Crowding, .8f); W(Feel.Dread, Sense.Light, .3f);
        FeelPrior.B[(int)Feel.Joy] = -1.5f; W(Feel.Joy, Sense.Tray, .9f); W(Feel.Joy, Sense.Company, 1.6f); W(Feel.Joy, Sense.DoorOpen, 2.5f); W(Feel.Joy, Sense.Hunger, -1f);
        FeelPrior.B[(int)Feel.Longing] = -1f + so * .8f; W(Feel.Longing, Sense.Photo, 1.4f); W(Feel.Longing, Sense.Company, -1f);
        FeelPrior.B[(int)Feel.Shame] = -2.4f; W(Feel.Shame, Sense.Mirror, 1.4f);
        FeelPrior.B[(int)Feel.Love] = -1.4f; W(Feel.Love, Sense.Photo, 1.6f); W(Feel.Love, Sense.Company, 1f);
        FeelPrior.B[(int)Feel.Awe] = -2.5f + op; W(Feel.Awe, Sense.Novelty, 1f); W(Feel.Awe, Sense.Books, .5f);
        FeelPrior.B[(int)Feel.Despair] = -2f + n; W(Feel.Despair, Sense.SinceMeal, 1.2f); W(Feel.Despair, Sense.Hunger, .8f); W(Feel.Despair, Sense.Company, -1f); W(Feel.Despair, Sense.Ruin, 1f); W(Feel.Despair, Sense.Dead, 1f);
    }

    // innate drives: the obvious act for a pressing need, before experience reshapes it
    void SeedDrives()
    {
        void W(Deed d, int input, float w) => WillPrior[(int)d, input] = w;
        int s(Sense x) => (int)x; int f(Feel x) => S + (int)x;
        W(Deed.Eat, s(Sense.Hunger), 4f); W(Deed.Eat, s(Sense.Thirst), 3f);
        W(Deed.Sleep, s(Sense.Fatigue), 4.5f); W(Deed.Sleep, s(Sense.Light), -.6f);
        W(Deed.Rest, s(Sense.Pain), 1.5f); W(Deed.Rest, f(Feel.Calm), .8f);
        W(Deed.Pace, f(Feel.Boredom), 1.4f); W(Deed.Pace, f(Feel.Anger), .6f);
        W(Deed.Search, f(Feel.Curiosity), 1.2f); W(Deed.Search, f(Feel.Hope), .6f); W(Deed.Pound, s(Sense.Seam), 1.2f);
        W(Deed.Shout, f(Feel.Loneliness), 1.2f); W(Deed.Shout, f(Feel.Anger), .8f); W(Deed.Shout, s(Sense.Knock), 1.5f);
        W(Deed.Hug, f(Feel.Fear), 1.5f); W(Deed.Hug, f(Feel.Despair), 1.4f);
        W(Deed.Exercise, f(Feel.Anger), .7f); W(Deed.Exercise, f(Feel.Hope), .6f); W(Deed.Exercise, s(Sense.Fatigue), -2f);
        W(Deed.Tally, f(Feel.Grip), .6f);
        W(Deed.Remember, f(Feel.Longing), 1.6f); W(Deed.Remember, f(Feel.Grief), 1f);
        W(Deed.Read, s(Sense.Books), 1.5f); W(Deed.Read, f(Feel.Boredom), 1.2f); W(Deed.Read, f(Feel.Curiosity), .6f);
        W(Deed.Pound, f(Feel.Anger), 1.8f);
        W(Deed.Talk, f(Feel.Loneliness), 1.5f); W(Deed.Talk, s(Sense.Company), 1.6f);
        // outside: life in the village, and the world after
        W(Deed.Work, s(Sense.Outdoors), 1.2f); W(Deed.Work, f(Feel.Calm), .8f); W(Deed.Work, s(Sense.Fatigue), -1.5f);
        W(Deed.Socialize, s(Sense.Company), 2.2f); W(Deed.Socialize, f(Feel.Joy), 1f); W(Deed.Socialize, f(Feel.Love), .8f);
        W(Deed.Explore, s(Sense.Outdoors), .8f); W(Deed.Explore, f(Feel.Curiosity), 1.4f); W(Deed.Explore, s(Sense.Danger), -1.5f);
        W(Deed.Forage, s(Sense.Outdoors), .5f); W(Deed.Forage, s(Sense.Hunger), 3.5f); W(Deed.Forage, s(Sense.Thirst), 2f);
        W(Deed.Build, s(Sense.Ruin), 1.2f); W(Deed.Build, s(Sense.Danger), 1.2f); W(Deed.Build, f(Feel.Hope), .8f);
        W(Deed.Bury, s(Sense.Dead), 3f); W(Deed.Bury, f(Feel.Grief), 1.2f);
        for (int a = 0; a < A; a++) WillPrior.B[a] = -1f;
    }

    public float F_(Feel f) => Feelings[(int)f];
    static readonly Sense[] Outside = { Sense.Light, Sense.Noise, Sense.Tray, Sense.Company, Sense.Books, Sense.Photo, Sense.Radio, Sense.Mirror, Sense.Knock, Sense.DoorOpen, Sense.Novelty, Sense.Outdoors, Sense.Ruin, Sense.Dead, Sense.Danger };
    readonly float[] lastOutside = new float[S];

    // One tick of perception, world-modelling and feeling.
    public void Perceive(float[] senses, float dtH)
    {
        Array.Copy(senses, Senses, S);
        // surprise: what the world model expected versus what arrived
        float err = 0, var = 0;
        for (int i = 0; i < S; i++) { float d = senses[i] - Predicted[i]; err += d * d; }
        // only the world outside his body counts toward monotony; hunger rising is not variety
        foreach (var e in Outside) var += MathF.Abs(senses[(int)e] - lastOutside[(int)e]);
        Array.Copy(senses, lastOutside, S);
        Surprise = MathF.Sqrt(err / S);
        SurpriseAvg += (Surprise - SurpriseAvg) * MathF.Min(1, .15f * dtH);
        // monotony: how little the senses have changed, slowly integrated. A white room drives it up.
        // variety is how much the world has been changing over the last hours; monotony is its absence, slowly felt
        Variety += (var - Variety) * MathF.Min(1, .25f * dtH);
        Monotony += (Math.Clamp(1.1f - Variety * 5, 0, 1) - Monotony) * MathF.Min(1, .02f * dtH);
        // the prediction head learns the world from what actually came
        var dPred = new float[S]; for (int i = 0; i < S; i++) dPred[i] = Predicted[i] - senses[i];
        PredictHead.Learn(World, dPred, .02f * MathF.Min(1, dtH * 4));
        // what he expects: the model's prediction, and, the flatter the room, the senses of whatever he is remembering
        RecallFrom(World);
        float grip = F_(Feel.Grip), blend = Math.Clamp((1 - grip) * 1.2f, 0, .8f);
        float topDown = Recalled >= 0 ? Math.Clamp(Monotony * (1.2f - grip), 0, .8f) : 0;
        for (int i = 0; i < S; i++)
        {
            float expect = Predicted[i] + (topDown > 0 ? (Memory[Recalled].Senses[i] - Predicted[i]) * topDown : 0);
            // as his grip loosens, he perceives more of his expectation and less of the room
            Perceived[i] = senses[i] * (1 - blend) + expect * blend;
        }
        Percept = SenseNet.Forward(Perceived); Act.Tanh(Percept);
        World = WorldNet.Step(Act.Concat(Percept, LastAction), World);
        Predicted = PredictHead.Forward(World); for (int i = 0; i < S; i++) Predicted[i] = Math.Clamp(Predicted[i], 0, 1);
        // feelings: prior on what he perceives plus the learned residual, integrated over time
        var pri = FeelPrior.Forward(Perceived); var res = FeelResidual.Forward(World);
        float rate = MathF.Min(1, .5f * dtH);
        for (int i = 0; i < F; i++)
        {
            if (i == (int)Feel.Grip) continue;
            // what he has learned can shade a feeling but not erase it
            float target = Act.Sigmoid(pri[i] + 1.2f * MathF.Tanh(res[i] / 1.2f) + (Recall[i] - .3f) * .6f);
            Feelings[i] += (target - Feelings[i]) * rate;
        }
        // grip: how well his model still matches the world, eroded by monotony and by surprise he can't absorb
        float gripT = Math.Clamp(1.05f - Monotony * .55f - SurpriseAvg * 1.2f - F_(Feel.Despair) * .25f + F_(Feel.Calm) * .1f, 0, 1);
        float gRate = gripT > Feelings[(int)Feel.Grip] ? .015f + .06f * Me.Resilience : .03f;
        Feelings[(int)Feel.Grip] += (gripT - Feelings[(int)Feel.Grip]) * MathF.Min(1, gRate * dtH);

        Wellbeing = -(senses[(int)Sense.Hunger] + senses[(int)Sense.Thirst] + senses[(int)Sense.Pain] * 1.5f + senses[(int)Sense.Cold]) * .5f
                    + senses[(int)Sense.Company] * .4f - F_(Feel.Fear) * .3f - F_(Feel.Despair) * .3f + F_(Feel.Joy) * .3f + F_(Feel.Calm) * .2f;
        Condition(dtH);
        Think();
    }

    float lastWell; bool hasLast;
    // emotional conditioning: when things get worse, the state that came before learns to feel like fear and dread;
    // when they get better, like hope and joy
    void Condition(float dtH)
    {
        if (!hasLast) { lastWell = Wellbeing; hasLast = true; return; }
        float dw = Wellbeing - lastWell; lastWell = Wellbeing;
        if (MathF.Abs(dw) < .02f) return;
        var dy = new float[F];
        // dy is dL/dy, so a negative value pushes that feeling up for this state and a positive one pushes it down
        dy[(int)Feel.Fear] = dw; dy[(int)Feel.Dread] = dw * 1.2f; dy[(int)Feel.Despair] = dw * .6f;
        dy[(int)Feel.Hope] = -dw; dy[(int)Feel.Joy] = -dw * .8f;
        FeelResidual.Learn(World, dy, .05f, decay: .002f);
        if (MathF.Abs(dw) > .08f || rng.Float() < .01f * dtH) Remember(dw);
    }

    void Remember(float valence)
    {
        Memory.Add(new Episode { Key = (float[])World.Clone(), Feel = (float[])Feelings.Clone(), Valence = valence, Deed = chosen < 0 ? Deed.Rest : (Deed)chosen, Senses = (float[])Senses.Clone(), Hour = Hour, Who = Context });
        if (Memory.Count > MemoryCap) Memory.RemoveAt(0);
    }
    public float Hour;
    public string Context;   // who is with him, set by the world; kept with each memory

    void RecallFrom(float[] q)
    {
        Array.Clear(Recall); RecallValence = 0; Recalled = -1;
        if (Memory.Count == 0) return;
        var sc = new float[Memory.Count]; float best = float.MinValue;
        for (int i = 0; i < sc.Length; i++) { sc[i] = Act.Dot(Memory[i].Key, q) * 4f / MathF.Sqrt(H); if (sc[i] > best) { best = sc[i]; Recalled = i; } }
        var w = Act.Softmax(sc);
        for (int i = 0; i < w.Length; i++) { for (int k = 0; k < F; k++) Recall[k] += w[i] * Memory[i].Feel[k]; RecallValence += w[i] * Memory[i].Valence; }
    }

    void Think()
    {
        Thought = ThoughtNet.Forward(Act.Concat(World, Feelings, Recall, Perceived, LastAction)); Act.Tanh(Thought);
    }

    // choose the next act among those the room allows
    public Deed Choose(bool[] allowed, float temperature = .6f)
    {
        var drive = WillPrior.Forward(Act.Concat(Perceived, Feelings));
        willIn = Act.Concat(World, Feelings, Recall);
        var learned = WillNet.Forward(willIn);
        var z = new float[A];
        // satiation: an act done over and over loses its pull for a while
        for (int a = 0; a < A; a++) z[a] = allowed[a] ? drive[a] + learned[a] - Habit[a] * 3f : -1e4f;
        chosenP = Act.Softmax(z, temperature);
        Array.Copy(chosenP, Intent, A);
        chosen = rng.Pick(chosenP);
        for (int a = 0; a < A; a++) Habit[a] = Habit[a] * .85f + (a == chosen ? .15f : 0);
        Array.Clear(LastAction); LastAction[chosen] = 1;
        startWell = Wellbeing;
        return (Deed)chosen;
    }
    float startWell;
    public readonly float[] Habit = new float[A];

    // when an act ends, REINFORCE on how much better or worse he felt for it
    public void Finished()
    {
        if (chosen < 0 || willIn == null) return;
        float r = Wellbeing - startWell, adv = r - baseline; baseline += (r - baseline) * .05f;
        var dy = new float[A];
        for (int a = 0; a < A; a++) dy[a] = -adv * ((a == chosen ? 1 : 0) - chosenP[a]);
        WillNet.Learn(willIn, dy, .08f);
    }

    // What VoiceNet is conditioned on, in the layout it was trained with (train_voice.py): his strongest feelings,
    // with unreality (1 - grip) in the Grip slot, then what he perceives, then what he is doing.
    public float[] VoiceCond(Deed doing)
    {
        var c = new float[F + S + A];
        var top = new List<int>(); for (int i = 0; i < F - 1; i++) top.Add(i);
        top.Sort((a, b) => Feelings[b].CompareTo(Feelings[a]));
        for (int k = 0; k < 3; k++) { int i = top[k]; c[i] = Math.Clamp((Feelings[i] - .3f) / .4f, 0, 1); }
        c[(int)Feel.Grip] = Math.Clamp((.8f - F_(Feel.Grip)) / .4f, 0, 1);
        for (int i = 0; i < S; i++) if (i != (int)Sense.Light && Perceived[i] > .5f) c[F + i] = Math.Clamp(Perceived[i], 0, 1);
        c[F + S + (int)doing] = 1;
        return c;
    }

    // a sense he perceives strongly that isn't there: the material of a hallucination
    public (Sense sense, float strength) Phantom()
    {
        int best = -1; float bv = .1f;
        foreach (var s in new[] { Sense.Company, Sense.Knock, Sense.Tray, Sense.DoorOpen, Sense.Radio, Sense.Novelty })
        { float v = Perceived[(int)s] - Senses[(int)s]; if (v > bv) { bv = v; best = (int)s; } }
        return best < 0 ? (Sense.Light, 0) : ((Sense)best, bv);
    }
}

public sealed class Personality
{
    public float Openness = .6f, Neuroticism = .5f, Sociability = .6f, Resilience = .5f;
}
