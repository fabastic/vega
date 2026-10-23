import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/simulation/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "simulation"}

def test_simulation_create_and_step():
    res = client.post("/api/simulation/create?seed=42&population_size=100")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "created"
    assert data["seed"] == 42
    
    step_res = client.post("/api/simulation/step?steps=5")
    assert step_res.status_code == 200
    step_data = step_res.json()
    assert step_data["tick"] == 5

def test_inject_drought_event():
    res = client.post("/api/simulation/inject_event?event_type=DROUGHT")
    assert res.status_code == 200
    assert res.json()["status"] == "event_injected"

def test_inspect_agent():
    # First ensure sim exists
    client.post("/api/simulation/create?seed=42&population_size=100")
    res = client.get("/api/simulation/inspect_agent/agent_0001")
    assert res.status_code == 200
    agent = res.json()
    assert agent["id"] == "agent_0001"
    assert "needs" in agent
    assert "emotions" in agent
