"""VoiceNet trainer: a small transformer that writes a first-person sentence conditioned on a state vector.

The state vector has the same 49-dimension layout as Brain.VoiceCond() in godot/Mind/Brain.cs:
  16 feelings (the Grip slot carries *unreality*, 1 - grip) | 20 senses | 13 acts
Training sentences come from public-domain first-person prose (corpus/, from Project Gutenberg). Each sentence
is labelled with the feelings, senses and acts it expresses, using the lexicon below. These are word lists, not
lines: the model learns to write in the manner of a state, and in the game the state is his.

  py -3.12 train_voice.py            prepare, train, evaluate, export ../../voice.bin
"""
import glob, math, os, random, re, struct, sys, time
from collections import Counter

import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'voice.bin')

FEELS = ['Fear', 'Hope', 'Loneliness', 'Boredom', 'Anger', 'Grief', 'Curiosity', 'Calm', 'Dread', 'Joy', 'Longing', 'Shame', 'Love', 'Awe', 'Despair', 'Faith', 'Grip']
SENSES = ['Light', 'Noise', 'Tray', 'Hunger', 'Thirst', 'Fatigue', 'Pain', 'Cold', 'Company', 'Books', 'Photo', 'Radio', 'Mirror', 'Seam', 'DoorOpen', 'Knock', 'Crowding', 'SinceMeal', 'Assault', 'Novelty', 'Outdoors', 'Ruin', 'Dead', 'Danger', 'Sign']
DEEDS = ['Rest', 'Sleep', 'Pace', 'Search', 'Eat', 'Shout', 'Hug', 'Exercise', 'Tally', 'Remember', 'Read', 'Pound', 'Talk', 'Work', 'Explore', 'Forage', 'Build', 'Bury', 'Socialize', 'Pray']
C = len(FEELS) + len(SENSES) + len(DEEDS)

W = lambda s: set(s.split())
LEX = {
    'Fear': W('afraid fear feared fearful fears terror terrified frightened fright horror panic trembled tremble trembling scared alarm alarmed'),
    'Hope': W('hope hoped hopes hoping hopeful expect expected expecting rescue deliverance someday faith'),
    'Loneliness': W('alone lonely loneliness solitude solitary nobody forsaken abandoned isolated companionless friendless'),
    'Boredom': W('weary tedious dull monotony monotonous idle idleness tedium endless sameness'),
    'Anger': W('angry anger rage raged fury furious hate hated hatred cursed curse wrath indignation resentment'),
    'Grief': W('grief grieve grieved mourn mourned sorrow sorrowful wept weep weeping tears lost'),
    'Curiosity': W('wonder wondered wondering curious curiosity strange discover discovered examine examined puzzled'),
    'Calm': W('calm quiet peace peaceful still rest gentle serene composed tranquil calmly quietly'),
    'Dread': W('dread dreaded dreadful doom ominous foreboding awful apprehension apprehensive'),
    'Joy': W('joy joyful happy happiness glad delight delighted laughed laugh smile smiled pleasure cheerful'),
    'Longing': W('longed longing yearn yearned yearning miss missed wish wished home'),
    'Shame': W('shame ashamed guilt guilty disgrace humiliated humiliation foolish'),
    'Love': W('love loved loving beloved dear darling tender affection'),
    'Awe': W('awe sublime wonderful magnificent vast infinite heaven glory majestic'),
    'Despair': W('despair despaired hopeless misery miserable wretched wretchedness ruin desolate'),
    'Faith': W('god faith heaven lord providence soul blessed blessing mercy prayer believe believed almighty'),
    'Grip': W('mad madness dream dreamed dreaming unreal imagine imagined fancy fancied phantom ghost delusion vision visions'),
    'Light': W('light bright white sun lamp glare'),
    'Noise': W('noise sound sounds loud din roar'),
    'Tray': W('food bread meal tray water'),
    'Hunger': W('hungry hunger starving famished starved'),
    'Thirst': W('thirst thirsty parched'),
    'Fatigue': W('tired exhausted sleepy fatigue fatigued'),
    'Pain': W('pain hurt ached ache aching wound wounded bleeding'),
    'Cold': W('cold chill chilled shivered shivering freezing'),
    'Company': W('friend friends someone voice voices together companion people'),
    'Books': W('book books page pages'),
    'Photo': W('picture portrait likeness'),
    'Radio': W('music song singing'),
    'Mirror': W('mirror reflection'),
    'Seam': W('crack seam gap chink'),
    'DoorOpen': W('door doors opened free freedom'),
    'Knock': W('knock knocked knocking tapping rapping'),
    'Crowding': W('narrow cramped walls cell confined'),
    'SinceMeal': W('days hours waited waiting'),
    'Assault': W('scream screamed shriek shrieked flash blinding'),
    'Novelty': W('suddenly sudden appeared new'),
    'Rest': W('sat sit sitting rested lay'),
    'Sleep': W('slept sleep asleep'),
    'Pace': W('walked paced walk walking pacing'),
    'Search': W('searched search felt groped sought'),
    'Eat': W('ate eat eating devoured'),
    'Shout': W('shouted cried called screamed shout'),
    'Hug': W('knees huddled curled crouched'),
    'Exercise': W('strength labour laboured worked'),
    'Tally': W('counted count marked notches notch'),
    'Remember': W('remembered remember memory recalled recollection'),
    'Read': W('read reading'),
    'Pound': W('struck beat pounded hammered'),
    'Talk': W('spoke said talked told speak'),
    'Outdoors': W('field fields garden trees sky village road hills meadow'),
    'Ruin': W('ruin ruins ruined burned broken fallen empty abandoned'),
    'Dead': W('dead corpse body bodies grave graves killed'),
    'Danger': W('danger dangerous wolf wolves enemy savages attack attacked'),
    'Work': W('work worked working labour toil'),
    'Explore': W('wandered explored journey travelled roamed'),
    'Forage': W('gathered berries fished hunted fruit corn'),
    'Build': W('built build building fence shelter'),
    'Bury': W('buried bury burial grave'),
    'Sign': W('sign signs miracle omen sent'),
    'Pray': W('pray prayed praying prayers knelt kneeling church'),
    'Socialize': W('visited danced supper company conversation'),
}
DIMS = FEELS + SENSES + DEEDS
FIRST = W('i me my myself')
TOK = re.compile(r"[a-z]+(?:'[a-z]+)?|[.,!?;]")


def sentences():
    for path in sorted(glob.glob(os.path.join(HERE, 'corpus', '*.txt'))):
        t = open(path, encoding='utf-8', errors='ignore').read()
        a, b = t.find('*** START'), t.find('*** END')
        t = t[t.find('\n', a) + 1 if a >= 0 else 0: b if b > 0 else len(t)]
        t = re.sub(r'[‘’]', "'", t); t = re.sub(r'[“”"_*]', ' ', t); t = re.sub(r'\s+', ' ', t)
        for s in re.split(r'(?<=[.!?])\s+', t):
            toks = TOK.findall(s.lower())
            if 4 <= len(toks) <= 26 and toks[-1] in '.!?':
                yield toks, bool(FIRST & set(toks))


def label(toks):
    v = [0.0] * C; ts = set(toks)
    for i, d in enumerate(DIMS):
        n = len(LEX[d] & ts)
        if n: v[i] = min(1.0, .6 + .4 * (n - 1))
    return v


class Block(nn.Module):
    def __init__(s, d, h):
        super().__init__(); s.h = h
        s.ln1, s.ln2 = nn.LayerNorm(d), nn.LayerNorm(d)
        s.qkv, s.proj = nn.Linear(d, 3 * d), nn.Linear(d, d)
        s.fc, s.fc2 = nn.Linear(d, 4 * d), nn.Linear(4 * d, d)

    def forward(s, x):
        B, T, D = x.shape
        q, k, v = s.qkv(s.ln1(x)).split(D, 2)
        q, k, v = (t.view(B, T, s.h, D // s.h).transpose(1, 2) for t in (q, k, v))
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True).transpose(1, 2).reshape(B, T, D)
        x = x + s.proj(y)
        return x + s.fc2(F.gelu(s.fc(s.ln2(x)), approximate='tanh'))


class Voice(nn.Module):
    def __init__(s, V, d=384, L=6, h=6, ctx=32):
        super().__init__(); s.ctx = ctx
        s.tok, s.pos = nn.Embedding(V, d), nn.Embedding(ctx, d)
        s.cond = nn.Linear(C, d)
        s.blocks = nn.ModuleList(Block(d, h) for _ in range(L))
        s.lnf = nn.LayerNorm(d)

    def forward(s, idx, c):
        x = s.tok(idx) + s.pos(torch.arange(idx.shape[1], device=idx.device)) + s.cond(c)[:, None, :]
        for b in s.blocks: x = b(x)
        return s.lnf(x) @ s.tok.weight.T


def write_str(f, s):
    b = s.encode('utf-8'); n = len(b)
    while n >= 0x80: f.write(bytes([(n & 0x7f) | 0x80])); n >>= 7
    f.write(bytes([n])); f.write(b)


def export(m, vocab, path):
    with open(path, 'wb') as f:
        d = m.tok.weight.shape[1]
        f.write(struct.pack('<6i', len(vocab), d, len(m.blocks), m.blocks[0].h, m.ctx, C))
        for w in vocab: write_str(f, w)
        def t(x): v = x.detach().float().cpu().flatten().tolist(); f.write(struct.pack(f'<{len(v)}f', *v))
        t(m.tok.weight); t(m.pos.weight); t(m.cond.weight); t(m.cond.bias)
        for b in m.blocks:
            for p in (b.ln1.weight, b.ln1.bias, b.qkv.weight, b.qkv.bias, b.proj.weight, b.proj.bias, b.ln2.weight, b.ln2.bias, b.fc.weight, b.fc.bias, b.fc2.weight, b.fc2.bias): t(p)
        t(m.lnf.weight); t(m.lnf.bias)


@torch.no_grad()
def generate(m, vocab, c, dev, temp=.8, n=1):
    m.eval(); out = []
    for _ in range(n):
        idx = torch.tensor([[1]], device=dev); cc = torch.tensor([c], device=dev)
        for _ in range(m.ctx - 1):
            lg = m(idx, cc)[0, -1] / temp; lg[3] = -1e9; lg[0] = -1e9
            nx = torch.multinomial(F.softmax(lg, -1), 1)
            if nx.item() == 2: break
            idx = torch.cat([idx, nx[None]], 1)
        out.append(' '.join(vocab[i] for i in idx[0, 1:].tolist()))
    m.train(); return out


def main():
    random.seed(7); torch.manual_seed(7)
    sents = list(sentences())
    cnt = Counter(w for s, _ in sents for w in s)
    vocab = ['<pad>', '<s>', '</s>', '<unk>'] + [w for w, _ in cnt.most_common(12000 - 4)]
    ix = {w: i for i, w in enumerate(vocab)}
    data = []
    for s, first in sents:
        ids = [ix.get(w, 3) for w in s]
        if ids.count(3) > 1: continue
        data.append(([1] + ids + [2], label(s), first))
    labelled = sum(1 for _, l, _ in data if any(l))
    print(f'{len(sents)} sentences ({sum(f for _, f in sents)} first-person), {len(data)} kept, {labelled} with at least one label, vocab {len(vocab)}', flush=True)
    random.shuffle(data); val, train = data[:2000], data[2000:]
    firsts = [d for d in train if d[2]]
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    m = Voice(len(vocab)).to(dev)
    print(f'{sum(p.numel() for p in m.parameters()) / 1e6:.1f}M parameters on {dev}', flush=True)
    opt = torch.optim.AdamW(m.parameters(), lr=4e-4, weight_decay=.05)
    T, BS, STEPS = m.ctx, 192, int(os.environ.get('STEPS', 30000))

    def batch(src):
        bt = random.sample(src, BS)
        x = torch.zeros(BS, T + 1, dtype=torch.long)
        for i, (ids, _, _) in enumerate(bt): ids = ids[:T + 1]; x[i, :len(ids)] = torch.tensor(ids)
        c = torch.tensor([l for _, l, _ in bt])
        c = c * (torch.rand(BS, 1) > .1)   # sometimes unconditioned, so it also learns plain speech
        return x.to(dev), c.to(dev)

    t0 = time.time()
    for step in range(STEPS + 1):
        lr = 4e-4 * min(1, step / 500) * (.1 + .9 * .5 * (1 + math.cos(math.pi * step / STEPS)))
        for g in opt.param_groups: g['lr'] = lr
        # first the language, then his voice: the last 35% of steps are first-person sentences only
        x, c = batch(train if step < STEPS * .65 else firsts)
        with torch.autocast(dev, dtype=torch.bfloat16, enabled=dev == 'cuda'):
            lg = m(x[:, :-1], c)
            loss = F.cross_entropy(lg.reshape(-1, lg.shape[-1]).float(), x[:, 1:].reshape(-1), ignore_index=0)
        opt.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(m.parameters(), 1); opt.step()
        if step % 1000 == 0:
            with torch.no_grad():
                vx, vc = batch(val); vl = m(vx[:, :-1], vc)
                vloss = F.cross_entropy(vl.reshape(-1, vl.shape[-1]).float(), vx[:, 1:].reshape(-1), ignore_index=0).item()
            print(f'step {step} loss {loss.item():.3f} val {vloss:.3f} ({time.time() - t0:.0f}s)', flush=True)

    # does the state show in what it writes? generate under one strong feeling at a time and check with the lexicon
    print('\nconditioning check (share of sentences that use a word of the asked-for feeling):')
    hits = tot = base = 0
    for i, f in enumerate(FEELS):
        c = [0.0] * C; c[i] = 1.0
        outs = generate(m, vocab, c, dev, n=30)
        h = sum(1 for o in outs if LEX[f] & set(o.split())); hits += h; tot += len(outs)
        b0 = sum(1 for o in generate(m, vocab, [0.0] * C, dev, n=30) if LEX[f] & set(o.split())); base += b0
        print(f'  {f:<11} {h:2d}/30 (with no state: {b0:2d}/30)   e.g. {outs[0]}')
    print(f'overall {hits}/{tot} vs {base}/{tot} without the state')
    for name, c in [('hungry, alone, dread', {'Hunger': 1, 'Loneliness': 1, 'Dread': 1}), ('knock, hope', {'Knock': 1, 'Hope': 1}), ('unreal, company', {'Grip': 1, 'Company': 1})]:
        v = [0.0] * C
        for k, x in c.items(): v[DIMS.index(k)] = x
        print(f'\n[{name}]'); [print('  ', o) for o in generate(m, vocab, v, dev, n=4)]
    export(m, vocab, OUT); print('\nwrote', os.path.abspath(OUT), os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
