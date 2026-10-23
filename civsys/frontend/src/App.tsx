import React, { useEffect } from 'react';
import { useSimulationStore } from './store/useSimulationStore';
import { simWebSocket } from './api/websocket';
import { createSimulation, fetchWorldSnapshot } from './api/client';

import { Header } from './components/Header';

import { AgentInspector } from './components/AgentInspector';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ExperimentPanel } from './components/ExperimentPanel';
import { CausalGraphPanel } from './components/CausalGraphPanel';
import { PopulationDirectory } from './components/PopulationDirectory';
import { NetworkGraph } from './components/NetworkGraph';
import { MarketEconomy } from './components/MarketEconomy';
import { WorldCanvas } from './canvas/WorldCanvas';

export function App() {
  const { activeTab, setActiveTab, seed, setSimState, tick, isRunning } = useSimulationStore();

  useEffect(() => {
    // Initialize default simulation and connect WebSocket stream
    createSimulation(seed, 150)
      .then(() => {
        return fetchWorldSnapshot();
      })
      .then((snapshot) => {
        setSimState({ 
          worldBounds: { width: snapshot.width, height: snapshot.height },
          terrainCells: snapshot.cells,
          buildingsList: snapshot.buildings
        });
        simWebSocket.connect(seed);
      })
      .catch((err) => console.warn('Initialization error:', err));

    return () => {
      simWebSocket.disconnect();
    };
  }, [seed, setSimState]);

  return (
    <div className="h-screen bg-[#140c13] text-zinc-200 font-mono flex flex-col overflow-hidden select-none">
      <Header />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#160e16] p-2 gap-2">
        {/* Main Viewport Container */}
        <section aria-label="Simulation Environment Viewport" className="lg:col-span-8 flex flex-col h-full bg-[#20151c] rounded border-4 border-[#502c20] shadow-wood-frame overflow-hidden relative">
          
          <div className="bg-[#2e1d27] border-b-2 border-[#543024] px-3 py-1.5 flex items-center justify-between z-20 shrink-0 text-xs">
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${isRunning ? 'bg-pixelgreen shadow-glow-green' : 'bg-zinc-500'}`}></span>
              <span className="font-retro text-[12px] text-parchment-200 tracking-wider uppercase">
                {activeTab === 'WORLD' ? 'WORLD VIEW' : activeTab}
              </span>
            </div>
            <span className="text-[10px] text-wood-400 font-mono">TICK {tick.toLocaleString()}</span>
          </div>
          
          <div className="flex-1 relative overflow-hidden bg-[#130b12] flex items-center justify-center">
             <div className={`absolute inset-0 ${activeTab === 'WORLD' ? 'block' : 'hidden'}`}>
                <WorldCanvas />
             </div>
             
             {activeTab === 'PEOPLE' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto p-6 z-10">
                <PopulationDirectory />
              </div>
             )}

             {activeTab === 'NETWORKS' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto p-6 z-10">
                <NetworkGraph />
              </div>
             )}

             {activeTab === 'ECONOMY' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto p-6 z-10">
                <MarketEconomy />
              </div>
             )}

             {activeTab === 'ANALYTICS' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto z-10">
                <AnalyticsPanel />
              </div>
             )}
             
             {activeTab === 'EXPERIMENTS' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto z-10">
                <ExperimentPanel />
              </div>
             )}
             
             {activeTab === 'CAUSALITY' && (
              <div className="absolute inset-0 bg-[#100a08] overflow-y-auto z-10">
                <CausalGraphPanel />
              </div>
             )}
          </div>
          
          <div className="bg-[#241720] border-t-2 border-[#4f2c22] p-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
             <div className="flex items-center space-x-1.5">
               <span className="font-retro text-[10px] text-wood-300 uppercase mr-1">Observatory:</span>
               <button 
                onClick={() => setActiveTab('CAUSALITY')}
                className="px-3 py-1.5 bg-wood-800/80 hover:bg-wood-700 text-wood-200 border-2 border-wood-600 rounded-md font-mono text-xs shadow-pixel-bezel active:translate-y-0.5 flex items-center space-x-1.5 transition-colors"
              >
                 <span>🕸</span> <span>Causality Graph</span>
               </button>
               <button 
                onClick={() => setActiveTab('ANALYTICS')}
                className="px-3 py-1.5 bg-wood-800/80 hover:bg-wood-700 text-wood-200 border-2 border-wood-600 rounded-md font-mono text-xs shadow-pixel-bezel active:translate-y-0.5 flex items-center space-x-1.5 transition-colors"
              >
                 <span>📈</span> <span>Analytics</span>
               </button>
             </div>
             <div className="text-[11px] text-wood-300 font-mono">
               Status: <span className={`font-semibold ${isRunning ? 'text-pixelgreen' : 'text-zinc-400'}`}>{isRunning ? 'RUNNING' : 'PAUSED'}</span>
             </div>
          </div>
        </section>

        {/* Sidebar Dossier */}
        <aside aria-label="Agent Dossier & Telemetry" className="lg:col-span-4 flex flex-col h-full space-y-2 overflow-y-auto">
          <AgentInspector />
        </aside>
      </main>

      <footer className="w-full bg-[#1b1019] border-t-2 border-[#41241c] px-4 py-1 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 font-mono">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-pixelgreen' : 'bg-zinc-500'}`}></span>
            <span>{isRunning ? 'SIMULATION: RUNNING' : 'SIMULATION: PAUSED'}</span>
          </span>
          <span className="hidden md:inline text-zinc-500">|</span>
          <span className="hidden md:inline">TICK: <strong className="text-white">{tick.toLocaleString()}</strong></span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-wood-300 font-retro text-[10px]">CIV-SYSTEMS OBSERVATORY</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

