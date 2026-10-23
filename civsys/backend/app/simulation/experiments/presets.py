"""
Experiment Preset Library - authoritative backend definitions.
These are named, human-readable configurations that the frontend can
fetch, display, and submit as ExperimentConfig. The frontend is a consumer
only; execution always runs through the backend simulation engine.
"""
from typing import List, Dict, Any

PRESET_LIBRARY: List[Dict[str, Any]] = [
    # ─── NATURAL DISASTERS ──────────────────────────────────────────────────
    {
        "id": "preset_drought_severe",
        "name": "Severe Drought",
        "category": "Natural Disaster",
        "description": "A prolonged, severe drought reduces crop yields by 80% for 300 ticks.",
        "icon": "🌵",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.2, "start_tick": 100, "end_tick": 400, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_drought_moderate",
        "name": "Moderate Drought",
        "category": "Natural Disaster",
        "description": "A regional drought reduces crop yields by 50% for 200 ticks.",
        "icon": "🌾",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.5, "start_tick": 50, "end_tick": 250, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_flood_north",
        "name": "Northern Region Flood",
        "category": "Natural Disaster",
        "description": "Flooding in the northern forest. Reduces crop yields in the north_forest region.",
        "icon": "🌊",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.1, "start_tick": 50, "end_tick": 150, "scope": {"scope_type": "REGION", "target_id": "north_forest"}}
        ]
    },
    {
        "id": "preset_flood_central",
        "name": "Central Valley Flood",
        "category": "Natural Disaster",
        "description": "Flash flooding in the central valley disrupts farming and trade.",
        "icon": "💧",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.15, "start_tick": 50, "end_tick": 200, "scope": {"scope_type": "REGION", "target_id": "central_valley"}}
        ]
    },
    {
        "id": "preset_earthquake_east",
        "name": "Earthquake (Eastern Crags)",
        "category": "Natural Disaster",
        "description": "A major earthquake damages infrastructure in the eastern mining region.",
        "icon": "🌋",
        "interventions": [
            {"target": "infrastructure_multiplier", "operation": "set", "value": 0.3, "start_tick": 50, "end_tick": 200, "scope": {"scope_type": "REGION", "target_id": "east_mines"}}
        ]
    },
    {
        "id": "preset_famine",
        "name": "Famine",
        "category": "Natural Disaster",
        "description": "A severe, prolonged famine reduces food supply across the entire civilization.",
        "icon": "🍂",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.05, "start_tick": 100, "end_tick": 500, "scope": {"scope_type": "GLOBAL", "target_id": None}},
            {"target": "trade_friction", "operation": "set", "value": 3.0, "start_tick": 100, "end_tick": 500, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_volcanic_winter",
        "name": "Volcanic Winter",
        "category": "Natural Disaster",
        "description": "Ash cloud reduces global crop yields and raises trade friction for 400 ticks.",
        "icon": "🌋",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.3, "start_tick": 50, "end_tick": 450, "scope": {"scope_type": "GLOBAL", "target_id": None}},
            {"target": "trade_friction", "operation": "set", "value": 2.0, "start_tick": 50, "end_tick": 450, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_desert_expansion",
        "name": "Desert Expansion",
        "category": "Natural Disaster",
        "description": "The southern desert expands, permanently reducing southern agricultural output.",
        "icon": "🏜️",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.1, "start_tick": 50, "end_tick": 9999, "scope": {"scope_type": "REGION", "target_id": "south_desert"}}
        ]
    },
    # ─── RESOURCE & ECONOMY ─────────────────────────────────────────────────
    {
        "id": "preset_resource_discovery",
        "name": "Metal Vein Discovery",
        "category": "Resource",
        "description": "A rich metal deposit is discovered in the eastern crags, opening new economic opportunities.",
        "icon": "⛏️",
        "interventions": [
            {"target": "resource_deposits", "operation": "activate", "value": "east_mines", "start_tick": 50, "end_tick": 9999, "scope": {"scope_type": "REGION", "target_id": "east_mines"}}
        ]
    },
    {
        "id": "preset_market_crash",
        "name": "Market Crash",
        "category": "Economy",
        "description": "A sudden market crash increases trade friction and destabilizes prices.",
        "icon": "📉",
        "interventions": [
            {"target": "trade_friction", "operation": "set", "value": 5.0, "start_tick": 100, "end_tick": 300, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_trade_boom",
        "name": "Trade Boom",
        "category": "Economy",
        "description": "A period of reduced trade friction drives economic growth.",
        "icon": "📈",
        "interventions": [
            {"target": "trade_friction", "operation": "set", "value": 0.3, "start_tick": 50, "end_tick": 300, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_scarcity_wood",
        "name": "Deforestation Crisis",
        "category": "Resource",
        "description": "Forest depletion makes wood scarce across the civilization.",
        "icon": "🌲",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "multiply", "value": 0.7, "start_tick": 50, "end_tick": 400, "scope": {"scope_type": "REGION", "target_id": "north_forest"}}
        ]
    },
    {
        "id": "preset_food_surplus",
        "name": "Agricultural Revolution (Local)",
        "category": "Economy",
        "description": "New farming techniques dramatically increase crop yields.",
        "icon": "🌱",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 3.0, "start_tick": 50, "end_tick": 400, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    # ─── TECHNOLOGY ─────────────────────────────────────────────────────────
    {
        "id": "preset_electricity_delayed",
        "name": "Electricity Delayed 200 Years",
        "category": "Technology",
        "description": "Electricity is not invented until tick 2000, delaying mechanized production.",
        "icon": "⚡",
        "interventions": [
            {"target": "electricity", "operation": "delay", "value": 2000, "start_tick": 0, "end_tick": 2000, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_electricity_early",
        "name": "Electricity Invented Early",
        "category": "Technology",
        "description": "Electricity is invented at tick 50, triggering early mechanization.",
        "icon": "💡",
        "interventions": [
            {"target": "electricity", "operation": "unlock", "value": True, "start_tick": 50, "end_tick": 9999, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_irrigation_early",
        "name": "Irrigation Systems Early",
        "category": "Technology",
        "description": "Irrigation technology is unlocked early, boosting farming yields.",
        "icon": "🚿",
        "interventions": [
            {"target": "irrigation", "operation": "unlock", "value": True, "start_tick": 50, "end_tick": 9999, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    # ─── SOCIAL & CULTURAL ──────────────────────────────────────────────────
    {
        "id": "preset_authoritarianism_high",
        "name": "Rise of Authoritarianism",
        "category": "Social",
        "description": "Authoritarian governance increases, suppressing cooperation and trust.",
        "icon": "🏛️",
        "interventions": [
            {"target": "authoritarianism", "operation": "set", "value": 0.9, "start_tick": 100, "end_tick": 500, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_authoritarianism_low",
        "name": "Democratic Reform",
        "category": "Social",
        "description": "Authoritarianism decreases, increasing cooperation and social cohesion.",
        "icon": "🗳️",
        "interventions": [
            {"target": "authoritarianism", "operation": "set", "value": 0.1, "start_tick": 100, "end_tick": 9999, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_population_shock",
        "name": "Population Shock (Plague)",
        "category": "Population",
        "description": "A severe disease event dramatically increases mortality rates.",
        "icon": "💀",
        "interventions": [
            {"target": "mortality_rate", "operation": "set", "value": 5.0, "start_tick": 100, "end_tick": 200, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_migration_wave",
        "name": "Migration Pressure (North)",
        "category": "Population",
        "description": "Environmental pressure in the north forces mass migration southward.",
        "icon": "🚶",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 0.05, "start_tick": 50, "end_tick": 350, "scope": {"scope_type": "REGION", "target_id": "north_forest"}}
        ]
    },
    {
        "id": "preset_golden_age",
        "name": "Golden Age",
        "category": "Economy",
        "description": "A period of prosperity with high crop yields and low trade friction.",
        "icon": "✨",
        "interventions": [
            {"target": "crop_yield_multiplier", "operation": "set", "value": 2.5, "start_tick": 50, "end_tick": 500, "scope": {"scope_type": "GLOBAL", "target_id": None}},
            {"target": "trade_friction", "operation": "set", "value": 0.2, "start_tick": 50, "end_tick": 500, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
    {
        "id": "preset_infrastructure_collapse",
        "name": "Infrastructure Collapse",
        "category": "Natural Disaster",
        "description": "Critical infrastructure fails across multiple regions simultaneously.",
        "icon": "🏚️",
        "interventions": [
            {"target": "infrastructure_multiplier", "operation": "set", "value": 0.2, "start_tick": 100, "end_tick": 400, "scope": {"scope_type": "GLOBAL", "target_id": None}}
        ]
    },
]
