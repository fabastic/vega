import { useSimulationStore } from '../store/useSimulationStore';
import { WebSocketStatePayload } from '../types/simulation';

export class SimulationWebSocket {
  private ws: WebSocket | null = null;

  connect(seed: number = 42) {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = `ws://localhost:8000/api/simulation/ws?sim_id=sim_default&seed=${seed}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const payload: WebSocketStatePayload = JSON.parse(event.data);
        useSimulationStore.getState().setSimState({
          simId: payload.simulation_id,
          tick: payload.tick,
          isRunning: payload.is_running,
          weather: payload.weather,
          cropYieldMultiplier: payload.crop_yield_multiplier,
          foodPrice: payload.food_price,
          agents: payload.agents,
          buildings: payload.buildings || [],
          latestMetrics: payload.latest_metrics || undefined
        });
      } catch (err) {
        console.error('Error parsing WebSocket frame:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const simWebSocket = new SimulationWebSocket();
