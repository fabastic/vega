from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    
    id = Column(String, primary_key=True, index=True)
    seed = Column(Integer, nullable=False)
    status = Column(String, default="running")
    created_at = Column(DateTime, default=datetime.utcnow)

class SimulationSnapshot(Base):
    __tablename__ = "simulation_snapshots"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    simulation_id = Column(String, ForeignKey("simulation_runs.id"), index=True)
    tick = Column(Integer, index=True)
    state_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CausalEvent(Base):
    __tablename__ = "causal_events"
    
    id = Column(String, primary_key=True, index=True)
    simulation_id = Column(String, ForeignKey("simulation_runs.id"), index=True)
    tick = Column(Integer, index=True)
    event_type = Column(String, index=True)
    subject_id = Column(String, index=True)
    reason = Column(String)
    previous_state = Column(JSON)
    new_state = Column(JSON)
    source_event_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
