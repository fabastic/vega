import json
from sqlalchemy.orm import Session
from app.db import models
from app.simulation.context import SimulationContext
from app.simulation.state import SimulationState
from app.db.session import SessionLocal

def flush_simulation_to_db(sim_id: str, seed: int, state: SimulationState, context: SimulationContext):
    """
    Called periodically by the runner or websocket to persist the state.
    """
    db = SessionLocal()
    try:
        # Ensure run exists
        run = db.query(models.SimulationRun).filter(models.SimulationRun.id == sim_id).first()
        if not run:
            run = models.SimulationRun(id=sim_id, seed=seed, status="running")
            db.add(run)
            db.commit()

        # Save Snapshot
        state_dict = state.model_dump()
        snap = models.SimulationSnapshot(
            simulation_id=sim_id,
            tick=state.tick,
            state_json=state_dict
        )
        db.add(snap)

        # Flush Causal Events
        if hasattr(context, "pending_causal_records") and context.pending_causal_records:
            for record in context.pending_causal_records:
                ce = models.CausalEvent(
                    id=record.event_id,
                    simulation_id=sim_id,
                    tick=record.tick,
                    event_type=record.event_type,
                    subject_id=record.subject_id,
                    reason=record.reason,
                    previous_state=record.previous_state,
                    new_state=record.new_state,
                    source_event_id=record.source_event_id
                )
                db.add(ce)
            # Clear pending after flushing
            context.pending_causal_records.clear()

        db.commit()
    except Exception as e:
        print(f"Error flushing to DB: {e}")
        db.rollback()
    finally:
        db.close()
