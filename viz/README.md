# viz

Browser pages for vega. Each is a single self-contained HTML file; open it directly or publish it.

| File | What |
|---|---|
| `whiteroom.html` | **Vega White Room**, an interactive simulation. Set up a life, a chamber and what comes after, then watch: a normal life among several CivSYS villages, a long stay sealed in a white chamber while the world outside dies, and survival afterwards (scavenging, hunting, farming, building, research, survivors, and bringing the dead back). Includes a "His mind" view of what he perceives as his grip on reality fails, his first-person view, a 681-word emotion lexicon, romance and family, PTSD, depth of mind, enemies, and God-mode tools. Built from `whiteroom/src/` by `whiteroom/build.sh`; see `whiteroom/PROMPT.md` for the full brief. |
| `brain.html` | **Vega Dream Brain**, a scroll-driven data page of the learned v2 mind's recurrent state, replayed from real data (seed 42, life ticks 300–539), with the senses cut at t=420. |

`../site/` holds the deployable copy of `whiteroom.html` (a full HTML document plus `vercel.json`) used for the Vercel deployment at https://vega-white-room.vercel.app.

The simulation's agents, needs and wants follow CivSYS and vega's own models in spirit, but the page is a standalone JavaScript re-implementation; it does not run the Python code.

The White Room is an illustration: its breakdown is authored to resemble human sensory deprivation. The measured effects of deprivation on vega's agents are in `../RESULTS_ROUND2.md` and `../results_round2/`.
