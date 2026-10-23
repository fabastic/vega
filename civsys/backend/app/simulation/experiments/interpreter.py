from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.simulation.experiments.runner import ExperimentConfig, Intervention, InterventionScope
from app.simulation.registry import registry, ParameterDomain
import time

class SemanticInterpretationResult(BaseModel):
    is_valid: bool
    config: Optional[ExperimentConfig] = None
    error_message: Optional[str] = None
    warnings: List[str] = []

class HypothesisInterpreter:
    """
    Semantic NLP Parser for mapping natural-language hypotheses 
    into structured ExperimentConfig scenarios using strict Ontology Boundaries.
    """
    def __init__(self):
        # Semantic mapping from concepts to ontology entries
        # A real NLP system would use embeddings/LLM here, but we enforce the boundary strictly.
        
        self.concept_bindings = {
            "drought": {"type": "event", "id": "drought"},
            "flood": {"type": "event", "id": "flood"},
            "earthquake": {"type": "event", "id": "earthquake"},
            "mine": {"type": "event", "id": "resource_discovery"},
            "discovery": {"type": "event", "id": "resource_discovery"},
            "metal": {"type": "event", "id": "resource_discovery"},
            "boom": {"type": "event", "id": "resource_discovery"},
            "electricity": {"type": "capability", "id": "electricity"},
            "irrigation": {"type": "capability", "id": "irrigation"},
            "rainfall": {"type": "parameter", "id": "rainfall"},
            "trust": {"type": "parameter", "id": "trust_decay"},
            "leftist": {"type": "parameter", "id": "progressivism"},
            "progressive": {"type": "parameter", "id": "progressivism"},
            "right-wing": {"type": "parameter", "id": "authoritarianism"},
            "authoritarian": {"type": "parameter", "id": "authoritarianism"},
            "dictator": {"type": "parameter", "id": "authoritarianism"},
            "religion": {"type": "parameter", "id": "religiosity"},
            "cult": {"type": "parameter", "id": "religiosity"},
            "atheism": {"type": "parameter", "id": "religiosity"},
            "trade": {"type": "parameter", "id": "trade_friction"},
            "embargo": {"type": "parameter", "id": "trade_friction"},
            "war": {"type": "parameter", "id": "trust_decay"},
            "peace": {"type": "parameter", "id": "trust_decay"},
            "crop": {"type": "parameter", "id": "crop_yield_multiplier"},
            "famine": {"type": "parameter", "id": "crop_yield_multiplier"},
            "disease": {"type": "parameter", "id": "mortality_rate"},
            "plague": {"type": "parameter", "id": "mortality_rate"},
            "immortal": {"type": "parameter", "id": "mortality_rate"}
        }

    def interpret(self, query: str) -> SemanticInterpretationResult:
        query_lower = query.lower()
        
        # We start by detecting ANY unknown major concepts to explicitly block them
        # (Mock implementation for boundary demonstration)
        banned_concepts = ["telepathy", "magic", "aliens", "time travel", "psychic"]
        for b in banned_concepts:
            if b in query_lower:
                return SemanticInterpretationResult(
                    is_valid=False,
                    error_message=f"UNSUPPORTED: capability/concept '{b}' is not registered in the simulation ontology."
                )

        # Base default config
        config = ExperimentConfig(
            id=f"exp_hypo_{int(time.time())}",
            name="Natural Language Hypothesis",
            seed=42,
            population_size=150,
            world_width=128,
            world_height=128,
            duration_ticks=500,
            interventions=[]
        )
        
        warnings = []
        
        # 1. Temporal Interpretation
        start_tick = 0
        if "later" in query_lower:
            words = query_lower.split()
            for i, word in enumerate(words):
                if word == "years" and i > 0 and words[i-1].isdigit():
                    years = int(words[i-1])
                    start_tick = years * 100 # Adjust prototype timescale mapping as needed
                    config.duration_ticks = max(config.duration_ticks, start_tick + 500)
                    
        # 2. Semantic Binding
        bound_concepts = []
        for term, binding in self.concept_bindings.items():
            if term in query_lower:
                bound_concepts.append(binding)
                
        if not bound_concepts:
            return SemanticInterpretationResult(
                is_valid=False,
                error_message="UNSUPPORTED: No recognized ontology entities found in query."
            )
            
        for binding in bound_concepts:
            if binding["type"] == "capability":
                cap = registry.capabilities.get(binding["id"])
                if cap:
                    operation = "delay_unlock" if start_tick > 0 else "disable"
                    if "never" in query_lower: operation = "disable"
                    
                    inv = Intervention(
                        target=cap.id, # Capability ID
                        operation=operation,
                        value=False if operation == "disable" else True,
                        start_tick=start_tick if operation == "delay_unlock" else 0,
                        end_tick=config.duration_ticks,
                        scope=InterventionScope(scope_type="GLOBAL")
                    )
                    config.interventions.append(inv)
                    config.name = f"Hypothesis: {cap.label} Intervention"

            elif binding["type"] == "event":
                evt = registry.events.get(binding["id"])
                if evt:
                    # Spatial Scope parsing
                    scope_type = "GLOBAL"
                    target_id = None
                    if "northern" in query_lower:
                        scope_type = "REGION"
                        target_id = "north_forest"
                        
                    inv = Intervention(
                        target=evt.id,
                        operation="trigger",
                        value=0.8, # Severity magnitude
                        start_tick=start_tick or 100,
                        end_tick=(start_tick or 100) + 200,
                        scope=InterventionScope(scope_type=scope_type, target_id=target_id)
                    )
                    config.interventions.append(inv)
                    config.name = f"Hypothesis: {evt.label} Event"
                    
            elif binding["type"] == "parameter":
                param = registry.get_parameter(binding["id"])
                if param:
                    # Advanced heuristic logic for the NLP values
                    val = param.default_value * 2
                    if "zero" in query_lower or "erase" in query_lower or "none" in query_lower or "atheism" in query_lower:
                        val = 0.0
                    if ("leftist" in query_lower or "leftisit" in query_lower) and "erase" in query_lower:
                        val = 0.0
                    if "authoritarian" in query_lower and "erase" in query_lower:
                        val = 0.0
                    if "embargo" in query_lower:
                        val = 5.0
                    if "famine" in query_lower:
                        val = 0.1
                    if "plague" in query_lower:
                        val = 0.1
                    if "immortal" in query_lower:
                        val = 0.0
                    if "peace" in query_lower:
                        val = 0.01

                    inv = Intervention(
                        target=param.id,
                        operation="set",
                        value=val,
                        start_tick=start_tick,
                        end_tick=config.duration_ticks,
                        scope=InterventionScope(scope_type="GLOBAL")
                    )
                    config.interventions.append(inv)
                    config.name = f"Hypothesis: {param.label} Parameter Shift"

        return SemanticInterpretationResult(
            is_valid=True,
            config=config,
            warnings=warnings
        )

interpreter = HypothesisInterpreter()
