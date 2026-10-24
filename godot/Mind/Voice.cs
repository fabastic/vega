// VoiceNet: turns a thought vector into words. A word-level GRU decoder whose initial state and every step are
// conditioned on the thought, so what he says comes from what his other networks are doing at that moment.
// It is trained by Trainer/ (milestone 3). Until a trained voice.bin exists it stays silent: no stand-in lines.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace Vega.Mind;

public sealed class Voice
{
    public const int E = 32, Hd = 96;
    public readonly string[] Vocab;
    public readonly Dictionary<string, int> Index = new();
    public readonly float[] Embed;        // [V, E]
    public readonly Linear Init;          // thought -> h0
    public readonly Gru Cell;             // [embed | thought] -> h
    public readonly Linear Out;           // h -> vocab logits
    public bool Trained { get; private set; }
    public int V => Vocab.Length;
    public const string Bos = "<s>", Eos = "</s>";

    public Voice(string[] vocab, ulong seed)
    {
        Vocab = vocab; for (int i = 0; i < vocab.Length; i++) Index[vocab[i]] = i;
        var rng = new Rng(seed);
        Embed = new float[vocab.Length * E]; for (int i = 0; i < Embed.Length; i++) Embed[i] = rng.Gauss() * .1f;
        Init = new Linear(Brain.T, Hd, rng); Cell = new Gru(E + Brain.T, Hd, rng); Out = new Linear(Hd, vocab.Length, rng);
    }

    public string Speak(float[] thought, Rng rng, float temperature = .8f, int max = 18)
    {
        if (!Trained) return null;
        var h = Init.Forward(thought); Act.Tanh(h);
        int w = Index[Bos]; var sb = new StringBuilder();
        for (int t = 0; t < max; t++)
        {
            var x = new float[E + Brain.T]; Array.Copy(Embed, w * E, x, 0, E); thought.CopyTo(x, E);
            h = Cell.Step(x, h);
            w = rng.Pick(Act.Softmax(Out.Forward(h), temperature));
            if (Vocab[w] == Eos) break;
            if (sb.Length > 0 && !IsPunct(Vocab[w])) sb.Append(' ');
            sb.Append(Vocab[w]);
        }
        if (sb.Length == 0) return null;
        sb[0] = char.ToUpperInvariant(sb[0]);
        return sb.ToString();
    }
    static bool IsPunct(string s) => s is "." or "," or "?" or "!" or ";" or ":" or "'s" or "n't";

    public void Save(string path)
    {
        using var w = new BinaryWriter(File.Create(path));
        w.Write(Vocab.Length); foreach (var s in Vocab) w.Write(s);
        foreach (var v in Embed) w.Write(v);
        Init.Write(w); Cell.Write(w); Out.Write(w);
    }
    public static Voice Load(Stream s)
    {
        using var r = new BinaryReader(s);
        var vocab = new string[r.ReadInt32()]; for (int i = 0; i < vocab.Length; i++) vocab[i] = r.ReadString();
        var v = new Voice(vocab, 1);
        for (int i = 0; i < v.Embed.Length; i++) v.Embed[i] = r.ReadSingle();
        v.Init.Read(r); v.Cell.Read(r); v.Out.Read(r); v.Trained = true;
        return v;
    }
}
