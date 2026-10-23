import { create } from 'zustand';
import { AgentPosPayload, MetricsSnapshot, CausalRecord, ExperimentResult, AgentState } from '../types/simulation';

export type ActiveTab = 'WORLD' | 'PEOPLE' | 'NETWORKS' | 'ECONOMY' | 'ANALYTICS' | 'EXPERIMENTS' | 'CAUSALITY';

const METRICS_HISTORY_MAX = 2000;

interface SimulationStore {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  simId: string;
  seed: number;
  tick: number;
  isRunning: boolean;
  weather: string;
  cropYieldMultiplier: number;
  foodPrice: number;
  worldBounds: { width: number; height: number };
  terrainCells: any[];
  buildingsList: any[];
  buildings: any[];
  agents: AgentPosPayload[];
  selectedAgentId: string | null;
  selectedAgentDetail: AgentState | null;
  
  latestMetrics: MetricsSnapshot | null;
  metricsHistory: MetricsSnapshot[];
  causalLedger: CausalRecord[];
  experimentResult: ExperimentResult | null;
  
  setSimState: (payload: Partial<SimulationStore>) => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedAgentDetail: (detail: AgentState | null) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  activeTab: 'WORLD',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  simId: 'sim_default',
  seed: 42,
  tick: 0,
  isRunning: false,
  weather: 'clear',
  cropYieldMultiplier: 1.0,
  foodPrice: 10.0,
  worldBounds: { width: 256, height: 256 },
  terrainCells: [],
  buildingsList: [],
  buildings: [],
  agents: [],
  selectedAgentId: null,
  selectedAgentDetail: null,
  
  latestMetrics: null,
  metricsHistory: [],
  causalLedger: [],
  experimentResult: null,
  
  setSimState: (payload) => set((state) => {
    let updatedMetricsHistory = state.metricsHistory;
    if (payload.latestMetrics) {
      updatedMetricsHistory = [...state.metricsHistory, payload.latestMetrics];
      // Cap to prevent memory growth during long runs
      if (updatedMetricsHistory.length > METRICS_HISTORY_MAX) {
        updatedMetricsHistory = updatedMetricsHistory.slice(-METRICS_HISTORY_MAX);
      }
    }
      
    return {
      ...payload,
      metricsHistory: updatedMetricsHistory
    };
  }),
  
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setSelectedAgentDetail: (detail) => set({ selectedAgentDetail: detail })
}));
