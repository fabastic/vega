import { AgentState, ExperimentConfig, ExperimentResult, CausalRecord } from '../types/simulation';

export const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

export async function createSimulation(seed: number = 42, populationSize: number = 150) {
  const res = await fetch(`${API_BASE_URL}/simulation/create?seed=${seed}&population_size=${populationSize}`, {
    method: 'POST'
  });
  return res.json();
}

export async function fetchWorldSnapshot(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/world-snapshot?sim_id=${simId}`);
  return res.json();
}

export async function stepSimulation(steps: number = 1) {
  const res = await fetch(`${API_BASE_URL}/simulation/step?steps=${steps}`, {
    method: 'POST'
  });
  return res.json();
}


export async function injectEvent(eventType: string = 'DROUGHT', duration: number = 48) {
  const res = await fetch(`${API_BASE_URL}/simulation/inject_event?event_type=${eventType}&duration=${duration}`, {
    method: 'POST'
  });
  return res.json();
}

export async function fetchAgentDetail(agentId: string): Promise<AgentState> {
  const res = await fetch(`${API_BASE_URL}/simulation/inspect_agent/${agentId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch agent ${agentId}`);
  }
  return res.json();
}

export async function fetchCausalGraph(): Promise<{ causal_ledger: CausalRecord[] }> {
  const res = await fetch(`${API_BASE_URL}/simulation/causal_graph`);
  return res.json();
}

export async function fetchRegistry(): Promise<{ parameters: any[] }> {
  const res = await fetch(`${API_BASE_URL}/experiments/registry`);
  return res.json();
}

export async function startSimulation(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/start?sim_id=${simId}`, { method: 'POST' });
  return res.json();
}

export async function pauseSimulation(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/pause?sim_id=${simId}`, { method: 'POST' });
  return res.json();
}

export async function setSimulationSpeed(speed: number, simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/speed?speed=${speed}&sim_id=${simId}`, { method: 'POST' });
  return res.json();
}

export async function fetchPopulation(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/population?sim_id=${simId}`);
  return res.json();
}

export async function fetchNetwork(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/network?sim_id=${simId}`);
  return res.json();
}

export async function fetchEconomy(simId: string = "sim_default") {
  const res = await fetch(`${API_BASE_URL}/simulation/economy?sim_id=${simId}`);
  return res.json();
}

export async function interpretHypothesis(query: string): Promise<ExperimentConfig> {
  const res = await fetch(`${API_BASE_URL}/experiments/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

export async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  const res = await fetch(`${API_BASE_URL}/experiments/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}

export async function fetchPresets(): Promise<{ presets: any[] }> {
  const res = await fetch(`${API_BASE_URL}/experiments/presets`);
  return res.json();
}

