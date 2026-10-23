import React, { useEffect, useState } from 'react';
import { fetchPopulation } from '../api/client';
import { useSimulationStore } from '../store/useSimulationStore';
import { Search, Users, Activity, Heart, Briefcase, MapPin } from 'lucide-react';

export const PopulationDirectory: React.FC = () => {
  const [population, setPopulation] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const { setSelectedAgentId, setActiveTab, tick } = useSimulationStore();

  // Throttle: update every 5 ticks
  const refreshTick = Math.floor(tick / 5) * 5;

  useEffect(() => {
    // Only show loading if first load
    if (population.length === 0) setLoading(true);
    fetchPopulation()
      .then(res => {
        setPopulation(Array.isArray(res.population) ? res.population : (Array.isArray(res) ? res : []));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [refreshTick]);

  const filtered = (population || []).filter(agent => 
    agent.name?.toLowerCase().includes(search.toLowerCase()) ||
    agent.occupation?.toLowerCase().includes(search.toLowerCase()) ||
    agent.community_id?.toLowerCase().includes(search.toLowerCase())
  );

  const safePopulation = population || [];
  const totalPop = safePopulation.length;
  const alivePop = safePopulation.filter(a => a.is_alive).length;
  const averageAge = safePopulation.length > 0 ? (safePopulation.reduce((acc, a) => acc + a.age, 0) / safePopulation.length).toFixed(1) : 0;

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    setActiveTab('WORLD');
  };

  return (
    <div className="max-w-7xl mx-auto font-mono text-xs text-slate-100 pb-20">
      <div className="flex items-center space-x-3 mb-6 border-b border-[#78350f] pb-4">
        <div className="w-10 h-10 border-2 border-[#b45309] bg-[#451a03] flex items-center justify-center rounded-sm">
          <Users className="w-5 h-5 text-[#f59e0b]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
            CIVILIZATION POPULATION DIRECTORY
          </h2>
          <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">
            Demographics, occupations, and vital states.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <span className="text-[#94a3b8] block uppercase tracking-widest mb-1 text-[10px]">TOTAL / ALIVE</span>
          <span className="text-[#f59e0b] font-bold text-xl">{totalPop} / {alivePop}</span>
        </div>
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <span className="text-[#94a3b8] block uppercase tracking-widest mb-1 text-[10px]">AVERAGE AGE</span>
          <span className="text-[#38bdf8] font-bold text-xl">{averageAge}</span>
        </div>
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] col-span-2 flex items-center">
          <div className="flex-1">
            <span className="text-[#94a3b8] block uppercase tracking-widest mb-1 text-[10px]">SEARCH REGISTRY</span>
            <div className="flex items-center bg-[#0a0705] border border-[#44403c] px-2 py-1 mt-2">
              <Search className="w-3 h-3 text-[#78716c] mr-2" />
              <input 
                type="text" 
                placeholder="Name, role, region..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[#e2e8f0] w-full placeholder-[#44403c]"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#78716c] animate-pulse">FETCHING CENSUS DATA...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(agent => (
            <div 
              key={agent.id} 
              onClick={() => handleSelectAgent(agent.id)}
              className={`bg-[#1c1410] border ${agent.is_alive ? 'border-[#78350f] hover:border-[#f59e0b]' : 'border-[#333] opacity-50'} rounded-sm p-4 cursor-pointer transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col`}
            >
              <div className="flex justify-between items-start mb-3 border-b border-[#333] pb-2">
                <div>
                  <div className="text-[#fef3c7] font-bold text-sm">{agent.name}</div>
                  <div className="text-[#78716c] text-[9px] uppercase">{agent.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#34d399] uppercase font-bold">{agent.current_action}</div>
                  <div className="text-[#94a3b8] text-[10px]">{agent.age}yo • {agent.gender}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center space-x-1 text-[#cbd5e1]">
                  <Briefcase className="w-3 h-3 text-[#f59e0b]" />
                  <span className="uppercase truncate">{agent.occupation}</span>
                </div>
                <div className="flex items-center space-x-1 text-[#cbd5e1]">
                  <MapPin className="w-3 h-3 text-[#38bdf8]" />
                  <span className="uppercase truncate">{agent.community_id}</span>
                </div>
                <div className="flex items-center space-x-1 text-[#cbd5e1] mt-1">
                  <Heart className="w-3 h-3 text-[#ef4444]" />
                  <span className="uppercase">HP: {Math.round(agent.health * 100)}%</span>
                </div>
                <div className="flex items-center space-x-1 text-[#cbd5e1] mt-1">
                  <Activity className="w-3 h-3 text-[#a855f7]" />
                  <span className="uppercase">STR: {Math.round(agent.stress * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
