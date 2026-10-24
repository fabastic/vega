# Vega in Godot

The White Room and the evidence view are being rebuilt as one Godot 4.7 (.NET, C#) application. It replaces the
web pages in `vega-evidence/viz`. Once it looks right, it will be published to the web from here.

## Principles
- Everything is shown in 3D: the room, the village, Vega, and his mind. The 2D layer is only a heads-up display
  and never one long scroll.
- Five places, one at a time: **Watch**, **Mind**, **Setup**, **God**, **Evidence**. Each one fits on the screen.
- Every setting says what it changes, and **Preview** shows it: the same seed is run twice in the background, with
  and without the change, and the two runs are compared.
- Vega speaks only from his own networks. There are no canned lines. A thought is a vector made by his
  networks, and the voice network turns that vector into words.

## Architecture
```
Mind/   pure C#, no Godot types (shared with Trainer/)
  Nn.cs       Rng, Linear (online delta-rule learning), Gru
  Brain.cs    separate networks:
                SenseNet   senses -> percept
                WorldNet   GRU over percept+action; PredictHead learns online to predict the next senses (surprise)
                FeelNet    appraisal prior + learned residual -> 16 named feelings
                MemoryNet  episodic slots, recalled by attention
                WillNet    policy over actions, learned online by REINFORCE on wellbeing
                ThoughtNet world + feelings + recall -> thought vector
                VoiceNet   word-level GRU decoder: thought -> words (trained in Trainer/; silent until trained)
Sim/    pure C#: Settings (with effect descriptions), Chamber (body, food, events, God acts); runs headless
View/   Godot: RoomView, VegaFigure, MindView (the networks as a 3D structure)
UI/     Godot: Shell (top bar, left rail, one panel, event strip)
Trainer/ console app: trains VoiceNet on a public-domain corpus, conditioned on thought vectors (milestone 3)
```

## Milestones
1. Skeleton: the chamber in 3D, the brain running on untrained networks with online learning, the organised
   shell, Setup with previews, a God mode grouped by category.
2. Life before and after: the village, the people, the world dying, the life after the room (ported from
   `viz/whiteroom/src`).
3. Voice: the corpus, the Trainer, and the conditioning of VoiceNet on thought vectors. Words appear only once
   it is trained.
4. Evidence: the round 2/3 results as 3D scenes rather than a scroll.
5. Web export (check how Godot handles C# web export at that point).
