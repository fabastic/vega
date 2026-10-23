import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { fetchAgentDetail } from '../api/client';

// Color helpers
const barColor = (val: number, invert = false) => {
  const v = invert ? 1 - val : val;
  if (v > 0.7) return '#ef4444'; // bad/high
  if (v > 0.4) return '#f59e0b'; // medium
  return '#10b981'; // good/low
};

const NeedBar: React.FC<{ label: string; value: number; invert?: boolean; color?: string }> = ({ label, value, invert = false, color }) => {
  const clampedVal = Math.max(0, Math.min(1, value ?? 0));
  const displayColor = color ?? barColor(clampedVal, invert);
  return (
    <div>
      <div className="flex justify-between text-[11px] font-mono mb-0.5">
        <span className="text-zinc-300">{label}</span>
        <span className="font-bold" style={{ color: displayColor }}>{(clampedVal * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-900 border border-wood-700 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${clampedVal * 100}%`, backgroundColor: displayColor }}></div>
      </div>
    </div>
  );
};

export const AgentInspector: React.FC = () => {
  const { selectedAgentId, setSelectedAgentId, selectedAgentDetail, setSelectedAgentDetail, tick } = useSimulationStore();

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentDetail(selectedAgentId)
        .then((detail) => setSelectedAgentDetail(detail))
        .catch((err) => console.warn(err));
    }
  }, [selectedAgentId, tick, setSelectedAgentDetail]);

  if (!selectedAgentId || !selectedAgentDetail) {
    return (
      <div className="bg-[#261821] border-4 border-[#5c3326] rounded shadow-wood-frame p-4 text-center text-wood-400 text-xs font-mono shrink-0">
        <div className="text-2xl mb-2">👁</div>
        <p className="uppercase tracking-widest">Select an agent in the world<br/>to open their dossier.</p>
      </div>
    );
  }

  const agent = selectedAgentDetail;
  const currentGoal = agent.goals?.sort((a, b) => b.priority - a.priority)[0];

  // Real emotional state (not synthetic calculations)
  const trustEmotion = agent.emotions?.trust?.intensity ?? 0;
  const anxietyEmotion = agent.emotions?.anxiety?.intensity ?? 0;
  const happinessEmotion = agent.emotions?.happiness?.intensity ?? 0;
  const guiltEmotion = agent.emotions?.guilt?.intensity ?? 0;
  const fearEmotion = agent.emotions?.fear?.intensity ?? 0;
  const angerEmotion = agent.emotions?.anger?.intensity ?? 0;

  // Top 3 dominant emotions for display
  const emotionEntries = Object.entries(agent.emotions ?? {}).map(([k, v]: [string, any]) => ({ name: k, intensity: v?.intensity ?? 0 }));
  const topEmotions = emotionEntries.sort((a, b) => b.intensity - a.intensity).slice(0, 3);

  return (
    <>
      {/* Dossier Main Container */}
      <div className="bg-[#261821] border-4 border-[#5c3326] rounded shadow-wood-frame p-3.5 flex flex-col space-y-3 relative shrink-0">
        
        {/* Agent Nameplate Header */}
        <div className="flex items-center justify-between border-b-2 border-wood-700 pb-2.5">
          <div className="bg-gradient-to-r from-wood-600 to-wood-500 border-2 border-wood-300 px-4 py-1 rounded shadow-pixel-bezel">
            <h2 className="font-pixel text-base md:text-lg text-parchment-100 tracking-wider">
              {agent.name.toUpperCase()}
            </h2>
          </div>
          <button 
            onClick={() => setSelectedAgentId(null)}
            aria-label="Close Dossier" 
            className="w-8 h-8 bg-[#322338] hover:bg-[#432d4b] border-2 border-[#5a3e66] text-white font-pixel text-xs rounded flex items-center justify-center shadow-pixel-bezel"
          >
            ✕
          </button>
        </div>

        {/* Quick Sub-header: ID, Age, Occupation */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-pixelcyan font-semibold">
            AGE {agent.age} • {(agent.economic.occupation || 'WANDERER').toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 text-[11px] rounded border ${agent.is_migrating ? 'text-violet-300 border-violet-600 bg-violet-950/50' : 'text-pixelgreen border-green-700 bg-green-950/50'}`}>
            {agent.is_migrating ? '🚶 MIGRATING' : `📍 ${agent.social_identity?.community_id?.toUpperCase() ?? 'UNKNOWN'}`}
          </span>
        </div>

        {/* Current Goal */}
        {currentGoal && (
          <div className="bg-wood-900/90 border border-wood-600 px-3 py-2 rounded">
            <span className="text-[10px] font-retro text-wood-300 block uppercase">Active Goal:</span>
            <p className="text-xs font-mono text-parchment-200 mt-0.5">
              → {currentGoal.name} <span className="text-zinc-500 text-[10px]">(priority: {currentGoal.priority?.toFixed(1)})</span>
            </p>
          </div>
        )}

        {/* Vital Needs - Real data */}
        <div className="bg-[#1b1018] border border-wood-700 p-2.5 rounded space-y-1.5">
          <div className="text-[10px] font-retro text-wood-300 uppercase tracking-wider mb-2">Vital Needs</div>
          <NeedBar label="Hunger" value={agent.needs?.hunger ?? 0} invert={true} />
          <NeedBar label="Energy" value={agent.needs?.energy ?? 1} color="#38bdf8" />
          <NeedBar label="Health" value={agent.needs?.health ?? 1} color="#10b981" />
          <NeedBar label="Safety" value={agent.needs?.safety ?? 1} color="#a78bfa" />
        </div>

        {/* Emotional State - Real data */}
        <div className="bg-[#1b1018] border border-wood-700 p-2.5 rounded space-y-1.5">
          <div className="text-[10px] font-retro text-wood-300 uppercase tracking-wider mb-2">
            Emotional State
            {anxietyEmotion > 0.6 && <span className="ml-2 text-[9px] font-mono text-red-400 bg-red-950/60 px-1 border border-red-800 rounded">HIGH ANXIETY</span>}
          </div>
          <NeedBar label="Trust" value={trustEmotion} color="#22d3ee" />
          <NeedBar label="Happiness" value={happinessEmotion} color="#fbbf24" />
          <NeedBar label="Anxiety" value={anxietyEmotion} invert={true} />
          <NeedBar label="Fear" value={fearEmotion} invert={true} />
        </div>

        {/* Economic Status - Real data */}
        <div className="bg-[#1b1018] border border-wood-700 p-2.5 rounded">
          <div className="text-[10px] font-retro text-wood-300 uppercase tracking-wider mb-2">Economic Status</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-zinc-400">Wealth</span><span className="text-pixelamber font-bold">${agent.economic?.money?.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Food</span><span className="text-pixelgreen font-bold">{agent.economic?.food_inventory?.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Tools</span><span className="text-pixelcyan font-bold">{agent.economic?.tools_inventory?.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Income</span><span className="text-white font-bold">${agent.economic?.income?.toFixed(2)}/tick</span></div>
          </div>
        </div>

        {/* Current Action */}
        <div className="bg-wood-900/90 border border-wood-600 px-3 py-2 rounded">
          <span className="text-[10px] font-retro text-wood-300 block uppercase">Current Action:</span>
          <p className="text-sm font-mono text-pixelgreen mt-0.5 font-bold">
            {(agent.current_action || 'idle').toUpperCase()}
            {agent.action_intent && <span className="text-zinc-400 font-normal text-[11px] ml-2">({agent.action_intent})</span>}
          </p>
        </div>
      </div>

      {/* Memory Inspector Panel */}
      <div className="flex-1 bg-[#261821] border-4 border-[#5c3326] rounded shadow-wood-frame p-3 flex flex-col space-y-2 overflow-hidden min-h-[200px]">
        
        <div className="bg-gradient-to-r from-wood-700 to-wood-600 border border-wood-400 px-3 py-1 rounded flex items-center justify-between shadow-pixel-bezel shrink-0">
          <span className="font-retro text-xs text-parchment-100 font-bold uppercase">
            Memory Log
          </span>
          <span className="text-[10px] font-pixel text-pixelgreen animate-pulse">● LIVE</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {!agent.memories || agent.memories.length === 0 ? (
            <div className="bg-wood-900/50 border border-wood-700 rounded p-3 text-xs font-retro text-wood-400 italic">
              • No memories recorded yet.
            </div>
          ) : (
            agent.memories.slice(-10).reverse().map((mem, idx) => (
              <div key={idx} className={`border p-2 rounded text-xs space-y-1 ${mem.emotional_weight > 0.5 ? 'bg-[#2c1a24] border-wood-500' : 'bg-[#1b1118] border-wood-700'}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-retro text-[11px] ${mem.emotional_weight > 0.5 ? 'text-pixelcyan' : 'text-pixelamber'}`}>
                    {mem.event_type?.toUpperCase() || 'MEMORY'}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">Tick {mem.tick}</span>
                </div>
                <p className="font-mono text-parchment-100 text-[11px] leading-snug">
                  "{mem.description}"
                </p>
                {mem.emotional_weight > 0.5 && (
                  <div className="mt-1 pt-1 border-t border-wood-700 flex items-center justify-between text-[10px] text-wood-300">
                    <span>Weight: <em className="text-pixelred">{(mem.emotional_weight * 100).toFixed(0)}%</em></span>
                    <span>Type: <em className="text-pixelcyan">{mem.memory_type}</em></span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
