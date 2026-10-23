from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from app.simulation.registry import registry, EventDefinition

class SpatialScopeType(str, Enum):
    GLOBAL = "GLOBAL"
    REGION = "REGION"
    CELL = "CELL"
    SETTLEMENT = "SETTLEMENT"
    GROUP = "GROUP"
    AGENT = "AGENT"

class SpatialScope(BaseModel):
    scope_type: SpatialScopeType
    target_id: Optional[str] = None
    target_predicate: Optional[Dict[str, Any]] = None

class ActiveEvent(BaseModel):
    id: str
    definition_id: str
    spatial_scope: SpatialScope = Field(default_factory=lambda: SpatialScope(scope_type=SpatialScopeType.GLOBAL))
    severity: float = Field(default=0.5, ge=0.0, le=1.0)
    start_tick: int = 0
    duration: int = 48 # Ticks duration
    is_active: bool = True
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
    # Internal state to track what was modified for reversal
    _applied_modifications: List[Any] = []

from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class EventSystem(BaseSimulationSystem):
    """
    Step 13: Event System
    Executes scope-aware events defined in the SimulationOntology.
    """
    def __init__(self):
        super().__init__(name="EventSystem", step_number=13)

    def execute(self, context: SimulationContext) -> None:
        world = context.state.world
        events = context.state.active_events
        
        for event in events:
            if not event.is_active:
                continue
                
            event_def = registry.events.get(event.definition_id)
            if not event_def:
                continue
                
            mechanism = registry.mechanisms.get(event_def.mechanism_id)
            if not mechanism:
                continue
                
            # Check if event is currently running
            if event.start_tick <= context.tick < (event.start_tick + event.duration):
                # Spatial scope resolution
                affected_regions = []
                if event.spatial_scope.scope_type == SpatialScopeType.GLOBAL:
                    affected_regions = world.regions
                elif event.spatial_scope.scope_type == SpatialScopeType.REGION and event.spatial_scope.target_id:
                    region = next((r for r in world.regions if r.id == event.spatial_scope.target_id), None)
                    if region:
                        affected_regions.append(region)
                        
                # Generic Mechanism Application
                for target_field in mechanism.target_state_fields:
                    if target_field == "world.resource_deposits":
                        # Resource Activation mechanism
                        if context.tick == event.start_tick:
                            # Activate a dormant deposit in affected regions
                            for target in (affected_regions if event.spatial_scope.scope_type == SpatialScopeType.REGION else world.regions):
                                for deposit in world.resource_deposits:
                                    if deposit.region_id == target.id and not deposit.discovered:
                                        deposit.discovered = True
                                        context.log_causal_event(
                                            event_id=f"evt_{event.id}",
                                            event_type=f"{event_def.id}_injected",
                                            subject_id=f"deposit_{deposit.id}",
                                            previous_state={"discovered": False},
                                            new_state={"discovered": True},
                                            reason="resource_activation"
                                        )
                                        break # Just discover one per affected region
                    elif target_field.startswith("world."):
                        field_name = target_field.split(".")[1]
                        
                        # Apply to all affected regions if Region scope
                        targets = affected_regions if event.spatial_scope.scope_type == SpatialScopeType.REGION else [world]
                        
                        for target in targets:
                            if hasattr(target, field_name):
                                prev_val = getattr(target, field_name)
                                
                                if event_def.event_type == "natural_disaster":
                                    new_val = max(0.0, 1.0 - event.severity)
                                elif event_def.event_type == "economic_boom":
                                    new_val = 1.0 + event.severity
                                else:
                                    new_val = prev_val
                                    
                                setattr(target, field_name, new_val)
                                
                                if context.tick == event.start_tick:
                                    subject = f"region_{target.id}" if hasattr(target, "id") else f"world_{field_name}"
                                    context.log_causal_event(
                                        event_id=f"evt_{event.id}",
                                        event_type=f"{event_def.id}_injected",
                                        subject_id=subject,
                                        previous_state={field_name: prev_val},
                                        new_state={field_name: new_val},
                                        reason=f"environmental_intervention_{event_def.id}"
                                    )
            else:
                # Event expired, restore normal parameters
                if context.tick >= (event.start_tick + event.duration):
                    event.is_active = False
                    
                    affected_regions = []
                    if event.spatial_scope.scope_type == SpatialScopeType.REGION and event.spatial_scope.target_id:
                        region = next((r for r in world.regions if r.id == event.spatial_scope.target_id), None)
                        if region:
                            affected_regions.append(region)
                            
                    for target_field in mechanism.target_state_fields:
                        if target_field.startswith("world."):
                            field_name = target_field.split(".")[1]
                            targets = affected_regions if event.spatial_scope.scope_type == SpatialScopeType.REGION else [world]
                            
                            for target in targets:
                                if hasattr(target, field_name):
                                    param_def = registry.get_parameter(field_name)
                                    if param_def:
                                        setattr(target, field_name, param_def.default_value)
