# Vega White Room: prompt for working on it locally

Paste everything below the line into Claude Code, started in the root of your `vega` checkout.

---

You are working on **Vega White Room**, a single-page 3D simulation in the `vega` repository. Read this whole brief before changing anything.

## Why it exists

The point of this project is to understand **what the white room does to an agent**, and how close that comes to what sensory deprivation does to a human mind. Keep that goal in front of everything else.

The simulation on the site is an illustration. Its breakdown (hallucinations, PTSD, the feelings) is authored to match human deprivation literature, so on its own it cannot show that artificial minds resemble ours: that would be circular. The evidence lives in the repo's experiments. Read `RESULTS_ROUND2.md`, `results_round2/` and `SPEC.md`. With exteroception removed, the learned mind (v2, an RSSM world model) shows measured rises in phantom percepts, shifts in time estimation, and changes in self-discovery measures. Respect the honesty note: these are functional state variables, never claims of felt experience.

The next big piece of work is an **evidence view** that:
- puts the measured vega curves (per arm, per mind, with confidence intervals) next to documented human findings (Ganzfeld hallucinations, the McGill isolation studies of the 1950s, time distortion in solitary confinement)
- drives the chamber animation from the measured trajectories instead of hand-tuned rules
- labels every claim as **measured**, **from human studies**, or **illustration**

## What it is

A person, Vega, lives a normal life among villages simulated in the spirit of CivSYS. He is then sealed in a white chamber while the world outside dies, and afterwards he walks out into what is left.

Everything he does comes from his own model: needs, about 100 emotion families that feed the 681-word emotion lexicon, personality, relationships, yesterday's residue, mind depth and PTSD. **Nothing is scripted or on a timetable.** Every option is scored from his state, then bent by his feelings (`feelBias`) and by yesterday (`dayBias`). God-mode tools, enemies, weather and items only change his surroundings or his body; he chooses what to do about them.

- **Live site:** https://vega-white-room.vercel.app (served from `site/index.html`)
- **Shipped page:** `viz/whiteroom.html`, the same HTML without the document wrapper
- **Source parts:** `viz/whiteroom/src/`, concatenated in this order:
  1. `a_head.html`: CSS, markup, and the CDN scripts (three.js r128 and OrbitControls from jsdelivr three@0.128.0)
  2. `b_core.js`: utilities, renderer, faces (sculpted head with a painted canvas face that repaints with expression), clothes as knit and denim canvas textures, skinned bodies (one `SkinnedMesh` on 13 bones with a thinness morph target), poses, tools held in hand, animals
  3. `c_world.js`: terrain, Project Zomboid-style houses (siding, pitched shingle roofs, porches, furnished interiors, walls that cut away near the focus), cars, fences, cemeteries, villagers, CivSYS-style needs and wants, romance (orientation, sparks, crushes, couples, dates, jealousy), shopping, decay
  4. `d_chamber.js`: the white chamber: behaviours, hazards, rendering, smoothed motion, getting up via sit and kneel, the CCTV camera following him
  5. `d2_emotion.js`: the emotion lexicon (681 words in families and intensity bands, plus situational words such as Kenopsia and Saudade), `emoFamilies`, `romanceStep`, `lifeState`
  6. `d2_mind.js`: `extendMind`, `moodStep`, `ITEMS` and `GOD`, the `DAY` system (yesterday shapes today), depth and philosophy, `HALL` (staged, adaptive hallucinations drawn on wall layers), `sensorium` (heartbeat, blinks, lost time, tinnitus), PTSD (cues, flashbacks, recovery), `vegaCtx`, `FEEL_DRIVES` and `feelBias`
  7. `d2_room.js`: chamber hazards and their visuals, and the first-person camera
  8. `e_after.js`: the dead country: survival utilities, research, structures, companions, revival
  9. `e2_ui.js`: God-mode tools for the chamber and the world, status icons, the emotion atlas, panel HTML builders
  10. `e2_world.js`: weather, enemies (the risen dead, raiders, dogs, bears), stores (grocery, supermarket, pharmacy, hardware, supply crates), family and children, his extra outdoor options
  11. `f_ui.js`: setup tabs, presets and `cfg`, phases, cameras (town, follow, map, CCTV, isometric, his eyes), panels, audio, the main loop

Build with `viz/whiteroom/build.sh`. It concatenates the parts into `viz/whiteroom.html` and wraps a full-document copy into `site/index.html`. Keep the two outputs in sync, and never hand-edit the built files.

## Conventions

- One IIFE in a single script; function declarations are hoisted across parts. Top-level `const`s must not be read before their part has run.
- three.js r128 globals only. A `SkinnedMesh` material needs `skinning: true` and `morphTargets: true`.
- Colours are authored in sRGB and converted with `convertSRGBToLinear()` for people. Face textures stay linear.
- Seeded randomness: `R()`, `rnd()` and `pick()` are seeded per world (`cfg.world.seed`; a new seed each run by default). Use `Math.random()` only for purely visual jitter.
- Style: compact, matching the surrounding code; comments explain why. UI text is plain and literal, and the page uses the existing CSS tokens.
- Don't add determinism. A new feature is a new pressure on his state, or a new scored option, with its feelings listed in `FEEL_DRIVES`.

## How to test

```bash
npm i playwright three@0.128.0
cp node_modules/three/build/three.min.js viz/whiteroom/test/
cp node_modules/three/examples/js/controls/OrbitControls.js viz/whiteroom/test/orbit.js
viz/whiteroom/build.sh --test     # also writes viz/whiteroom/test/t.html with a window.__v debug hook
node viz/whiteroom/test/smoke.js  # life → chamber → after, with screenshots and errors
```

The test scripts route the CDN scripts to the local copies. Always look at the screenshots, and check the console errors before calling something done. `window.__v` exposes `S`, `A`, `ROOM`, `sim`, `citizens`, `COMPANIONS`, `camera`, `controls`, `makeHuman`, `pose` and others. `sim.skipTo = sim.hours + N` fast-forwards.

## Open threads and ideas

- The evidence view described above. It comes first.

- Balance pass over long outdoor runs, so his feelings don't pin at the extremes.
- More God tools: a second prisoner in the chamber, a cruel radio broadcast.
- Raiders who can be talked down instead of fought.
- Children growing into companions with their own needs.
- Performance with many people on screen. Faces repaint only when near the camera.
