"""Hand-set affect parameters (SPEC sections H and D.5). Not learned."""
CHANNELS = (
    "joy", "fear", "anger", "sadness", "disgust", "surprise", "anticipation", "trust",
    "loneliness", "grief", "attachment", "shame", "pride", "awe", "boredom", "curiosity",
)
SIGN = {"joy": 1, "fear": -1, "anger": -1, "sadness": -1, "disgust": -1, "surprise": 0,
        "anticipation": 1, "trust": 1, "loneliness": -1, "grief": -1, "attachment": 1,
        "shame": -1, "pride": 1, "awe": 1, "boredom": -1, "curiosity": 1}
AROUSAL = {"joy": 0.6, "fear": 0.8, "anger": 0.9, "sadness": 0.2, "disgust": 0.6, "surprise": 0.8,
           "anticipation": 0.4, "trust": 0.2, "loneliness": 0.3, "grief": 0.2, "attachment": 0.2,
           "shame": 0.5, "pride": 0.5, "awe": 0.6, "boredom": 0.1, "curiosity": 0.5}
DOMINANCE = {"joy": 1, "fear": -1, "anger": 1, "sadness": -1, "disgust": 1, "surprise": 0,
             "anticipation": 0, "trust": 0, "loneliness": -1, "grief": -1, "attachment": 0,
             "shame": -1, "pride": 1, "awe": -1, "boredom": 0, "curiosity": 0}
HALF_LIFE = {"surprise": 1, "joy": 3, "awe": 3, "disgust": 4, "fear": 6, "curiosity": 6,
             "anticipation": 6, "anger": 8, "boredom": 12, "pride": 12, "sadness": 24, "shame": 24,
             "loneliness": 48, "trust": 200, "grief": 240, "attachment": 500}
NEGATIVE = frozenset(c for c in CHANNELS if SIGN[c] < 0)
CONSCIENTIOUS_RECOVERY = 0.4   # half-life multiplier (1 - 0.4*C) for negative channels

# personality gains g_e = 1 + k_e * trait_term
GAIN = {
    "fear": ("neuroticism", 0.5),
    "shame": ("neuroticism", 0.3),
    "anger": ("disagreeableness", 0.4),
    "loneliness": ("extraversion", 0.5),
    "boredom": ("openness", 0.5),
    "curiosity": ("openness", 0.5),
    "pride": ("conscientiousness", 0.3),
}
MOOD_TAU_DAYS = 2.0
MOOD_ETA = 1.0 / (24.0 * MOOD_TAU_DAYS)
