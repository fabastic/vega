// The small neural-network kit the mind is built from. Plain arrays, no Godot types: the same code runs in the
// game, in the headless previews and in the trainer.
using System;
using System.IO;

namespace Vega.Mind;

public sealed class Rng
{
    ulong s;
    public Rng(ulong seed) { s = seed == 0 ? 0x9E3779B97F4A7C15UL : seed; for (int i = 0; i < 4; i++) Next(); }
    public ulong Next() { s ^= s << 13; s ^= s >> 7; s ^= s << 17; return s; }
    public float Float() => (Next() >> 40) / (float)(1 << 24);
    public float Range(float a, float b) => a + (b - a) * Float();
    public float Gauss() { float u = MathF.Max(Float(), 1e-7f), v = Float(); return MathF.Sqrt(-2f * MathF.Log(u)) * MathF.Cos(MathF.Tau * v); }
    // sample an index from a probability vector
    public int Pick(ReadOnlySpan<float> p)
    {
        float r = Float(), acc = 0;
        for (int i = 0; i < p.Length; i++) { acc += p[i]; if (r <= acc) return i; }
        return p.Length - 1;
    }
}

public static class Act
{
    public static float Sigmoid(float x) => 1f / (1f + MathF.Exp(-x));
    public static void Tanh(Span<float> v) { for (int i = 0; i < v.Length; i++) v[i] = MathF.Tanh(v[i]); }
    public static void Sigmoid(Span<float> v) { for (int i = 0; i < v.Length; i++) v[i] = Sigmoid(v[i]); }
    public static float[] Softmax(ReadOnlySpan<float> z, float temp = 1f)
    {
        var p = new float[z.Length]; float m = float.MinValue, s = 0;
        for (int i = 0; i < z.Length; i++) m = MathF.Max(m, z[i]);
        for (int i = 0; i < z.Length; i++) { p[i] = MathF.Exp((z[i] - m) / temp); s += p[i]; }
        for (int i = 0; i < z.Length; i++) p[i] /= s;
        return p;
    }
    public static float[] Concat(params float[][] parts)
    {
        int n = 0; foreach (var p in parts) n += p.Length;
        var o = new float[n]; int k = 0;
        foreach (var p in parts) { p.CopyTo(o, k); k += p.Length; }
        return o;
    }
    public static float Dot(ReadOnlySpan<float> a, ReadOnlySpan<float> b) { float s = 0; for (int i = 0; i < a.Length; i++) s += a[i] * b[i]; return s; }
}

// y = W x + b. Learn() is one step of the delta rule: given dL/dy for the last input, move W and b against it.
public sealed class Linear
{
    public readonly int In, Out;
    public readonly float[] W, B;   // W row-major, [Out, In]
    public Linear(int inDim, int outDim, Rng rng, float gain = 1f)
    {
        In = inDim; Out = outDim; W = new float[inDim * outDim]; B = new float[outDim];
        float sd = gain * MathF.Sqrt(2f / (inDim + outDim));
        for (int i = 0; i < W.Length; i++) W[i] = rng.Gauss() * sd;
    }
    public float[] Forward(ReadOnlySpan<float> x)
    {
        var y = new float[Out];
        for (int o = 0; o < Out; o++) { float s = B[o]; int r = o * In; for (int i = 0; i < In; i++) s += W[r + i] * x[i]; y[o] = s; }
        return y;
    }
    // decay pulls weights back toward zero on every step, so online learning can't run away
    public void Learn(ReadOnlySpan<float> x, ReadOnlySpan<float> dy, float lr, float clip = 1f, float decay = 0f)
    {
        float keep = 1f - decay;
        for (int o = 0; o < Out; o++)
        {
            float g = Math.Clamp(dy[o], -clip, clip) * lr; int r = o * In;
            if (decay > 0) { for (int i = 0; i < In; i++) W[r + i] *= keep; B[o] *= keep; }
            if (g == 0) continue;
            B[o] -= g;
            for (int i = 0; i < In; i++) W[r + i] -= g * x[i];
        }
    }
    public float this[int o, int i] { get => W[o * In + i]; set => W[o * In + i] = value; }
    public void Write(BinaryWriter w) { w.Write(In); w.Write(Out); foreach (var v in W) w.Write(v); foreach (var v in B) w.Write(v); }
    public void Read(BinaryReader r)
    {
        if (r.ReadInt32() != In || r.ReadInt32() != Out) throw new InvalidDataException("layer shape mismatch");
        for (int i = 0; i < W.Length; i++) W[i] = r.ReadSingle();
        for (int i = 0; i < B.Length; i++) B[i] = r.ReadSingle();
    }
}

// A gated recurrent unit with separate input and hidden projections for the three gates.
public sealed class Gru
{
    public readonly int In, H;
    public readonly Linear X, Hh;   // [3H] each: reset, update, candidate
    public Gru(int inDim, int hidden, Rng rng, float gain = 1f) { In = inDim; H = hidden; X = new Linear(inDim, 3 * hidden, rng, gain); Hh = new Linear(hidden, 3 * hidden, rng, gain); }
    public float[] Step(ReadOnlySpan<float> x, ReadOnlySpan<float> h)
    {
        var gx = X.Forward(x); var gh = Hh.Forward(h); var o = new float[H];
        for (int i = 0; i < H; i++)
        {
            float r = Act.Sigmoid(gx[i] + gh[i]), u = Act.Sigmoid(gx[H + i] + gh[H + i]);
            float n = MathF.Tanh(gx[2 * H + i] + r * gh[2 * H + i]);
            o[i] = (1 - u) * n + u * h[i];
        }
        return o;
    }
    public void Write(BinaryWriter w) { X.Write(w); Hh.Write(w); }
    public void Read(BinaryReader r) { X.Read(r); Hh.Read(r); }
}
