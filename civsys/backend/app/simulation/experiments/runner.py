from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.simulation.civilization.metrics import MetricsSnapshot

class InterventionScope(BaseModel):
    scope_type: str = "GLOBAL" # GLOBAL, REGION, GROUP
    target_id: Optional[str] = None # region_id or group_id if applicable

class Intervention(BaseModel):
    target: str
    operation: str = "set" # set, add, multiply
    value: Any
    start_tick: int
    end_tick: int
    scope: InterventionScope = Field(default_factory=InterventionScope)

class ExperimentConfig(BaseModel):
    id: str
    name: str = "Custom Experiment"
    seed: int = 42
    population_size: int = 150
    world_width: int = 128
    world_height: int = 128
    duration_ticks: int = 500
    interventions: List[Intervention] = Field(default_factory=list)

class ExperimentResult(BaseModel):
    experiment_id: str
    control_metrics: List[MetricsSnapshot] = Field(default_factory=list)
    treatment_metrics: List[MetricsSnapshot] = Field(default_factory=list)
    divergence_summary: Dict[str, float] = Field(default_factory=dict)


from app.simulation.engine import SimulationEngine
from app.simulation.registry import registry

from app.simulation.experiments.causality import CausalRecord

class ExperimentEngine:
    """
    Manages dual Control vs Treatment simulation runs initialized from identical seed S.
    Control continues baseline. Treatment receives list of Interventions at their respective ticks.
    """
    def __init__(self, config: ExperimentConfig):
        self.config: ExperimentConfig = config
        
        # Instantiate Control Engine
        self.control_engine: SimulationEngine = SimulationEngine(
            seed=config.seed,
            population_size=config.population_size,
            width=config.world_width,
            height=config.world_height
        )
        
        # Instantiate Treatment Engine from identical seed and initial state
        self.treatment_engine: SimulationEngine = SimulationEngine(
            seed=config.seed,
            population_size=config.population_size,
            width=config.world_width,
            height=config.world_height
        )

    def _apply_intervention(self, engine: SimulationEngine, intervention: Intervention, revert: bool = False):
        # 1. Check if target is an Event
        evt_def = registry.events.get(intervention.target)
        if evt_def and intervention.operation == "trigger" and not revert:
            from app.simulation.events import ActiveEvent, SpatialScope, SpatialScopeType
            
            scope_type = SpatialScopeType(intervention.scope.scope_type)
            active_event = ActiveEvent(
                id=f"evt_{evt_def.id}_{engine.state.tick}",
                definition_id=evt_def.id,
                spatial_scope=SpatialScope(scope_type=scope_type, target_id=intervention.scope.target_id),
                severity=float(intervention.value),
                start_tick=engine.state.tick,
                duration=intervention.end_tick - engine.state.tick,
                is_active=True
            )
            engine.inject_event(active_event)
            return

        # 2. Check if target is a Capability
        cap_def = registry.capabilities.get(intervention.target)
        if cap_def:
            if not revert:
                if intervention.value and cap_def.id not in engine.state.world.active_capabilities:
                    engine.state.world.active_capabilities.append(cap_def.id)
                elif not intervention.value and cap_def.id in engine.state.world.active_capabilities:
                    engine.state.world.active_capabilities.remove(cap_def.id)
            else:
                # Naive revert: assuming capabilities are unlocked interventions usually
                if intervention.value and cap_def.id in engine.state.world.active_capabilities:
                    engine.state.world.active_capabilities.remove(cap_def.id)
                elif not intervention.value and cap_def.id not in engine.state.world.active_capabilities:
                    engine.state.world.active_capabilities.append(cap_def.id)
            return
            
        # 3. Check if target is a Parameter
        param_def = registry.get_parameter(intervention.target)
        if not param_def:
            return
            
        value = intervention.value
        # If reverting, we assume 'set' was to default, or we reverse add/multiply.
        # For simplicity in this robust generic engine, we apply inverse operations.
        if revert:
            if intervention.operation == "set":
                value = param_def.default_value
            elif intervention.operation == "add":
                value = -float(intervention.value)
                intervention.operation = "add"
            elif intervention.operation == "multiply":
                value = 1.0 / float(intervention.value)
                intervention.operation = "multiply"
                
        # Currently we apply GLOBAL scope to World parameters if they exist on the world state
        if hasattr(engine.state.world, intervention.target):
            current_val = getattr(engine.state.world, intervention.target, param_def.default_value)
            new_val = current_val
            
            if intervention.operation == "set":
                new_val = value
            elif intervention.operation == "add":
                new_val = current_val + float(value)
            elif intervention.operation == "multiply":
                new_val = current_val * float(value)
                
            setattr(engine.state.world, intervention.target, new_val)
            
            # Log causality for the intervention
            if not revert:
                engine.state.causal_ledger.append(
                    CausalRecord(
                        event_id=f"evt_interv_{intervention.target}_{engine.state.tick}",
                        subject_id="world",
                        event_type=f"intervention_{intervention.target}",
                        reason="experiment_intervention",
                        tick=engine.state.tick,
                        previous_state={intervention.target: current_val},
                        new_state={intervention.target: new_val}
                    )
                )

    def run_experiment(self) -> ExperimentResult:
        """
        Executes duration_ticks on both Control and Treatment simulations.
        """
        for tick in range(self.config.duration_ticks):
            # Check for Interventions starting or ending
            for inv in self.config.interventions:
                if tick == inv.start_tick:
                    self._apply_intervention(self.treatment_engine, inv, revert=False)
                elif tick == inv.end_tick:
                    self._apply_intervention(self.treatment_engine, inv, revert=True)
                
            # Execute 1 tick on Control & Treatment
            self.control_engine.step()
            self.treatment_engine.step()
            
        # Compile result metrics
        ctrl_metrics = self.control_engine.state.metrics_history
        trt_metrics = self.treatment_engine.state.metrics_history
        
        divergence = {}
        if ctrl_metrics and trt_metrics:
            # We want to track peak divergence, final divergence, and recovery.
            # For simplicity of the returned dict, we'll calculate this for food_price_index as the primary metric,
            # but we can apply it to others.
            
            peak_food_delta = 0.0
            peak_food_tick = 0
            
            peak_mig_delta = 0
            peak_hunger_delta = 0.0
            peak_stress_delta = 0.0
            
            for c, t in zip(ctrl_metrics, trt_metrics):
                fd = t.food_price_index - c.food_price_index
                md = t.migrated_count - c.migrated_count
                hd = t.average_hunger - c.average_hunger
                sd = t.average_stress - c.average_stress
                
                if abs(fd) > abs(peak_food_delta):
                    peak_food_delta = fd
                    peak_food_tick = t.tick
                if abs(md) > abs(peak_mig_delta): peak_mig_delta = md
                if abs(hd) > abs(peak_hunger_delta): peak_hunger_delta = hd
                if abs(sd) > abs(peak_stress_delta): peak_stress_delta = sd

            last_ctrl = ctrl_metrics[-1]
            last_trt = trt_metrics[-1]
            
            # Post-intervention delta (at the end of the last intervention)
            end_tick = max((inv.end_tick for inv in self.config.interventions), default=0)
            post_int_c = next((m for m in ctrl_metrics if m.tick == end_tick), last_ctrl)
            post_int_t = next((m for m in trt_metrics if m.tick == end_tick), last_trt)
            
            # Recovery time: ticks after end_tick until delta < 1.0 (for food price)
            recovery_time = -1
            if end_tick > 0:
                for c, t in zip(ctrl_metrics, trt_metrics):
                    if c.tick > end_tick:
                        if abs(t.food_price_index - c.food_price_index) < 1.0:
                            recovery_time = c.tick - end_tick
                            break
            
            divergence = {
                "food_price_delta": round(peak_food_delta, 2), # Legacy key for UI
                "peak_food_delta": round(peak_food_delta, 2),
                "peak_food_tick": peak_food_tick,
                "final_food_delta": round(last_trt.food_price_index - last_ctrl.food_price_index, 2),
                "post_int_food_delta": round(post_int_t.food_price_index - post_int_c.food_price_index, 2),
                "recovery_time": recovery_time,
                
                "migrated_delta": peak_mig_delta,
                "hunger_delta": round(peak_hunger_delta, 2),
                "stress_delta": round(peak_stress_delta, 2)
            }
            
        return ExperimentResult(
            experiment_id=self.config.id,
            control_metrics=ctrl_metrics,
            treatment_metrics=trt_metrics,
            divergence_summary=divergence
        )


