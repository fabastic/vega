import React from 'react';
import { useSimulationStore, ActiveTab } from '../store/useSimulationStore';
import { startSimulation, pauseSimulation, setSimulationSpeed } from '../api/client';
import { Globe, Users, Network, TrendingUp, BarChart3, FlaskConical, GitCommit } from 'lucide-react';

const TICKS_PER_YEAR = 365; // 1 year = 365 simulation ticks

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, tick, agents, simId, isRunning, latestMetrics } = useSimulationStore();
  const [speed, setSpeed] = React.useState<number>(1);

  // Real values derived from simulation state
  const livingAgents = agents.filter(a => !a.is_migrating);
  const livingPopulation = latestMetrics?.living_population ?? livingAgents.length;
  const simulatedYear = Math.floor(tick / TICKS_PER_YEAR) + 1;
  const socialCohesion = latestMetrics?.social_cohesion_index ?? null;
  const foodPrice = latestMetrics?.food_price_index ?? null;

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'WORLD', label: 'WORLD', icon: <Globe className="w-4 h-4" /> },
    { id: 'PEOPLE', label: 'PEOPLE', icon: <Users className="w-4 h-4" /> },
    { id: 'NETWORKS', label: 'NETWORKS', icon: <Network className="w-4 h-4" /> },
    { id: 'ECONOMY', label: 'ECONOMY', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'ANALYTICS', label: 'ANALYTICS', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'EXPERIMENTS', label: 'EXPERIMENTS', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'CAUSALITY', label: 'CAUSALITY', icon: <GitCommit className="w-4 h-4" /> }
  ];

  return (
    <header className="w-full bg-[#241720] border-b-4 border-[#4f2c22] px-4 py-2 flex flex-wrap items-center justify-between shadow-lg z-30 shrink-0 gap-y-2">
      {/* Left: Brand & Epoch Telemetry */}
      <div className="flex items-center space-x-3">
        {/* Retro Logo Badge */}
        <div className="w-9 h-9 bg-wood-700 border-2 border-wood-400 flex items-center justify-center shadow-pixel-bezel rounded">
          <span className="text-pixelamber text-lg font-pixel">⧉</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-retro text-sm md:text-base tracking-wider text-parchment-100 font-bold uppercase">
              Civilization Systems
            </h1>
            <span className="text-[10px] font-pixel text-pixelcyan bg-[#172935] px-1.5 py-0.5 rounded border border-[#2ce8f5]/40 shadow-glow-cyan">
              v2.4-SIM
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-wood-300">
            <span className="flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-pixelgreen shadow-glow-green animate-ping' : 'bg-zinc-500'} inline-block`}></span>
              <span className="text-white font-semibold">YEAR {simulatedYear}</span>
              <span className="text-zinc-500">|</span>
              <span className="text-parchment-300">TICK: <span className="text-pixelamber" id="tick-counter">{tick.toLocaleString()}</span></span>
            </span>
            {foodPrice !== null && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] bg-wood-900/80 px-2 py-0.5 border border-wood-700 text-wood-200 rounded">
                <span className="text-pixelgreen">●</span> FOOD: ${foodPrice.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Tactile Simulation Playback Controls */}
      <div className="flex items-center bg-[#190e18] p-1.5 border-2 border-wood-700 rounded-md shadow-inner gap-1">
        <button 
          onClick={() => isRunning ? pauseSimulation(simId) : startSimulation(simId)}
          className={`px-2.5 py-1 ${isRunning ? 'bg-wood-600 hover:bg-wood-500' : 'bg-[#15803d] hover:bg-[#16a34a]'} active:translate-y-0.5 text-xs text-parchment-100 font-retro border border-wood-400 shadow-pixel-bezel rounded`} 
          data-purpose="sim-pause"
        >
          {isRunning ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <div className="h-4 w-px bg-wood-800 mx-1"></div>
        {[1, 2, 4, 10].map(s => (
          <button 
            key={s}
            onClick={() => { setSpeed(s); setSimulationSpeed(s, simId); }}
            className={`px-2 py-1 text-xs font-mono rounded ${speed === s ? 'bg-wood-500 text-white font-bold border border-wood-300 shadow-pixel-bezel' : 'bg-wood-800 hover:bg-wood-700 text-wood-300 border border-wood-700'}`}
          >
            {s}x
          </button>
        ))}
        <button 
          onClick={() => setActiveTab('EXPERIMENTS')}
          className="px-2.5 py-1 bg-[#47223b] hover:bg-[#5e2b4f] text-pixelamber text-xs font-retro border border-[#833c6e] shadow-pixel-bezel rounded flex items-center gap-1"
        >
          <span>⚡</span> EXPERIMENT
        </button>
      </div>

      {/* Right: Real-time Metrics & Tab Navigation */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Real metrics from simulation state */}
        <div className="hidden xl:flex items-center space-x-3 bg-wood-900/70 border border-wood-700 px-3 py-1.5 rounded">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block leading-none">Citizens</span>
            <span className="font-bold text-white font-mono">
              {livingPopulation > 0 ? `${livingPopulation} alive` : <span className="text-zinc-500">loading…</span>}
            </span>
          </div>
          <div className="h-5 w-px bg-wood-700"></div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block leading-none">Cohesion</span>
            <span className={`font-bold font-mono ${socialCohesion === null ? 'text-zinc-500' : socialCohesion > 0.6 ? 'text-pixelgreen' : socialCohesion > 0.4 ? 'text-pixelamber' : 'text-red-400'}`}>
              {socialCohesion !== null ? `${(socialCohesion * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="h-5 w-px bg-wood-700"></div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block leading-none">Avg Hunger</span>
            <span className={`font-bold font-mono ${latestMetrics ? (latestMetrics.average_hunger > 0.6 ? 'text-red-400' : 'text-pixelgreen') : 'text-zinc-500'}`}>
              {latestMetrics ? `${(latestMetrics.average_hunger * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex items-center bg-[#1a111a] border border-wood-600 rounded p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-1 text-[11px] font-retro rounded ${
                activeTab === tab.id
                  ? 'bg-wood-600 text-parchment-100 border border-wood-400 shadow-pixel-bezel'
                  : 'text-wood-300 hover:text-white border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
