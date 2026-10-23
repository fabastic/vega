import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { stepSimulation, injectEvent, createSimulation, startSimulation, pauseSimulation } from '../api/client';
import { Play, Pause, SkipForward, CloudRain, RotateCcw, Activity } from 'lucide-react';

export const ControlsBar: React.FC = () => {
  const { isRunning, seed, setSimState } = useSimulationStore();
  const [loading, setLoading] = useState(false);

  const handleStep = async (count: number = 1) => {
    setLoading(true);
    await stepSimulation(count);
    setLoading(false);
  };

  const handleToggleRun = async () => {
    setLoading(true);
    if (isRunning) {
      await pauseSimulation();
      setSimState({ isRunning: false });
    } else {
      await startSimulation();
      setSimState({ isRunning: true });
    }
    setLoading(false);
  };

  const handleInjectDrought = async () => {
    setLoading(true);
    await injectEvent('DROUGHT', 48);
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    await createSimulation(seed, 150);
    setLoading(false);
  };

  return (
    <div className="bg-[#1c1410] border-b border-[#b45309] px-4 py-1.5 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-20 relative">
      
      {/* Left controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleToggleRun}
          className={`flex items-center space-x-1.5 px-4 py-1 rounded-sm text-[11px] font-mono font-bold tracking-widest uppercase transition-colors ${
            isRunning
              ? 'bg-[#b45309]/20 text-[#fcd34d] border border-[#f59e0b] hover:bg-[#b45309]/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
              : 'bg-[#064e3b] text-[#6ee7b7] border border-[#10b981] hover:bg-[#065f46] shadow-[0_0_8px_rgba(16,185,129,0.3)]'
          }`}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'PAUSE' : 'START SIMULATION'}</span>
        </button>

        <div className="h-4 w-px bg-[#78350f] mx-1"></div>

        <button
          onClick={() => handleStep(1)}
          disabled={loading || isRunning}
          className="flex items-center space-x-1 px-3 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#291c18] text-[#cbd5e1] border border-[#78350f] hover:bg-[#451a03] hover:text-[#fcd34d] disabled:opacity-50 uppercase"
        >
          <SkipForward className="w-3 h-3" />
          <span>STEP (1x)</span>
        </button>
        <button
          onClick={() => handleStep(10)}
          disabled={loading || isRunning}
          className="flex items-center space-x-1 px-3 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#291c18] text-[#cbd5e1] border border-[#78350f] hover:bg-[#451a03] hover:text-[#fcd34d] disabled:opacity-50 uppercase"
        >
          <SkipForward className="w-3 h-3" />
          <span>STEP (10x)</span>
        </button>
        
        <div className="h-4 w-px bg-[#78350f] mx-1"></div>

        <button
          onClick={handleReset}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#291c18] text-[#94a3b8] border border-[#78350f] hover:bg-[#451a03] hover:text-[#fef3c7] uppercase"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET</span>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-[#100a08] border border-[#78350f] rounded-sm text-[#94a3b8] text-[9px] font-mono uppercase font-bold">
          <Activity className="w-3 h-3 text-[#34d399]" />
          <span>Status: {isRunning ? <span className="text-[#34d399]">SYNCHRONIZED (60 FPS)</span> : <span className="text-[#f59e0b]">PAUSED</span>}</span>
        </div>

        <button
          onClick={handleInjectDrought}
          disabled={loading}
          className="flex items-center space-x-1.5 px-4 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#4c0519] text-[#fca5a5] border border-[#e11d48] hover:bg-[#881337] shadow-[0_0_12px_rgba(225,29,72,0.4)] uppercase tracking-wider"
        >
          <CloudRain className="w-3.5 h-3.5" />
          <span>EVENT TRIGGER: DROUGHT</span>
        </button>
      </div>
    </div>
  );
};
