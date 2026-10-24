// VoiceNet: a small transformer that writes a first-person sentence conditioned on his state (Brain.VoiceCond:
// feelings, what he perceives, what he is doing). Trained by Trainer/voice/train_voice.py on public-domain prose;
// the weights live in voice.bin. Without it he stays silent: there are no stand-in lines.
using System;
using System.IO;
using System.Text;

namespace Vega.Mind;

public sealed class Voice
{
    public readonly string[] Vocab;
    readonly int V, D, L, Hn, Ctx, C;
    readonly float[] tok, pos, condW, condB, lnfW, lnfB;
    readonly Layer[] layers;
    sealed class Layer { public float[] ln1w, ln1b, qkvW, qkvB, projW, projB, ln2w, ln2b, fcW, fcB, fc2W, fc2B; }
    public int Conditions => C;

    Voice(BinaryReader r)
    {
        V = r.ReadInt32(); D = r.ReadInt32(); L = r.ReadInt32(); Hn = r.ReadInt32(); Ctx = r.ReadInt32(); C = r.ReadInt32();
        Vocab = new string[V]; for (int i = 0; i < V; i++) Vocab[i] = r.ReadString();
        float[] T(int n) { var a = new float[n]; var b = r.ReadBytes(n * 4); Buffer.BlockCopy(b, 0, a, 0, b.Length); return a; }
        tok = T(V * D); pos = T(Ctx * D); condW = T(D * C); condB = T(D);
        layers = new Layer[L];
        for (int l = 0; l < L; l++)
            layers[l] = new Layer { ln1w = T(D), ln1b = T(D), qkvW = T(3 * D * D), qkvB = T(3 * D), projW = T(D * D), projB = T(D), ln2w = T(D), ln2b = T(D), fcW = T(4 * D * D), fcB = T(4 * D), fc2W = T(4 * D * D), fc2B = T(D) };
        lnfW = T(D); lnfB = T(D);
    }
    public static Voice Load(Stream s) { using var r = new BinaryReader(s); return new Voice(r); }

    static void MatVec(float[] W, float[] b, ReadOnlySpan<float> x, Span<float> y, int outN, int inN)
    {
        for (int o = 0; o < outN; o++) { float s = b[o]; int r = o * inN; for (int i = 0; i < inN; i++) s += W[r + i] * x[i]; y[o] = s; }
    }
    void Norm(ReadOnlySpan<float> x, float[] w, float[] b, Span<float> y)
    {
        float m = 0, v = 0; for (int i = 0; i < D; i++) m += x[i]; m /= D;
        for (int i = 0; i < D; i++) { float d = x[i] - m; v += d * d; }
        float inv = 1f / MathF.Sqrt(v / D + 1e-5f);
        for (int i = 0; i < D; i++) y[i] = (x[i] - m) * inv * w[i] + b[i];
    }

    // Writes one sentence. Keys and values are cached per layer, so each word costs one pass over the network.
    public string Speak(float[] cond, Rng rng, float temperature = .7f)
    {
        var cv = new float[D]; MatVec(condW, condB, cond, cv, D, C);
        var K = new float[L][]; var Vv = new float[L][];
        for (int l = 0; l < L; l++) { K[l] = new float[Ctx * D]; Vv[l] = new float[Ctx * D]; }
        int hd = D / Hn; float scale = 1f / MathF.Sqrt(hd);
        var x = new float[D]; var h = new float[D]; var qkv = new float[3 * D]; var att = new float[D]; var tmp = new float[D]; var ff = new float[4 * D]; var logits = new float[V]; var sc = new float[Ctx];
        int w = 1; var sb = new StringBuilder(); var said = new System.Collections.Generic.HashSet<int>(); var sorted = new float[V];
        for (int t = 0; t < Ctx - 1; t++)
        {
            for (int i = 0; i < D; i++) x[i] = tok[w * D + i] + pos[t * D + i] + cv[i];
            for (int l = 0; l < L; l++)
            {
                var ly = layers[l];
                Norm(x, ly.ln1w, ly.ln1b, h); MatVec(ly.qkvW, ly.qkvB, h, qkv, 3 * D, D);
                Array.Copy(qkv, D, K[l], t * D, D); Array.Copy(qkv, 2 * D, Vv[l], t * D, D);
                for (int hh = 0; hh < Hn; hh++)
                {
                    int o = hh * hd; float mx = float.MinValue;
                    for (int j = 0; j <= t; j++) { float s = 0; for (int k = 0; k < hd; k++) s += qkv[o + k] * K[l][j * D + o + k]; sc[j] = s * scale; mx = MathF.Max(mx, sc[j]); }
                    float sum = 0; for (int j = 0; j <= t; j++) { sc[j] = MathF.Exp(sc[j] - mx); sum += sc[j]; }
                    for (int k = 0; k < hd; k++) { float s = 0; for (int j = 0; j <= t; j++) s += sc[j] * Vv[l][j * D + o + k]; att[o + k] = s / sum; }
                }
                MatVec(ly.projW, ly.projB, att, tmp, D, D); for (int i = 0; i < D; i++) x[i] += tmp[i];
                Norm(x, ly.ln2w, ly.ln2b, h); MatVec(ly.fcW, ly.fcB, h, ff, 4 * D, D);
                for (int i = 0; i < 4 * D; i++) { float u = ff[i]; ff[i] = .5f * u * (1 + MathF.Tanh(.7978846f * (u + .044715f * u * u * u))); }
                MatVec(ly.fc2W, ly.fc2B, ff, tmp, D, 4 * D); for (int i = 0; i < D; i++) x[i] += tmp[i];
            }
            Norm(x, lnfW, lnfB, h);
            for (int v = 0; v < V; v++) { float s = 0; int r = v * D; for (int i = 0; i < D; i++) s += tok[r + i] * h[i]; logits[v] = s; }
            logits[0] = logits[3] = -1e9f;
            // a word already said is pushed down (so he doesn't stutter), and only the likeliest forty are considered
            foreach (var u in said) logits[u] -= logits[u] > 0 ? logits[u] * .35f + 1.5f : 1.5f;
            if (t < 3) logits[2] = -1e9f;
            Array.Copy(logits, sorted, V); Array.Sort(sorted); float cut = sorted[V - 40];
            for (int v = 0; v < V; v++) if (logits[v] < cut) logits[v] = -1e9f;
            w = rng.Pick(Act.Softmax(logits, temperature)); said.Add(w);
            if (w == 2) break;
            var word = Vocab[w];
            if (sb.Length > 0 && !(word is "." or "," or "!" or "?" or ";")) sb.Append(' ');
            sb.Append(word == "i" ? "I" : word.StartsWith("i'") ? "I" + word[1..] : word);
        }
        if (sb.Length == 0) return null;
        sb[0] = char.ToUpperInvariant(sb[0]);
        return sb.ToString();
    }
}
