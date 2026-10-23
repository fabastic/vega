import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';

export const AnalyticsPanel: React.FC = () => {
  const { metricsHistory } = useSimulationStore();

  return (
    <div className="p-6 bg-[#100a08] font-mono text-xs text-slate-100">
      <div className="mb-6 flex items-center space-x-3 border-b border-[#78350f] pb-4">
        <div className="w-10 h-10 border-2 border-[#b45309] bg-[#451a03] flex items-center justify-center rounded-sm">
          <BarChart3 className="w-5 h-5 text-[#f59e0b]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>CIVILIZATION METRICS ANALYTICS</h2>
          <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">Real-time macro indicators derived from agent micro-states.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pb-20">
        {/* Food Price Index Chart */}
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">FOOD PRICE INDEX ($)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
                <XAxis dataKey="tick" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <YAxis stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <Tooltip contentStyle={{ backgroundColor: '#291c18', borderColor: '#854d0e', color: '#fef3c7' }} itemStyle={{ color: '#fcd34d' }} />
                <Line type="stepAfter" dataKey="food_price_index" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Stress & Hunger Chart */}
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">POPULATION STRESS & HUNGER</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
                <XAxis dataKey="tick" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <YAxis stroke="#78716c" domain={[0, 1]} tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <Tooltip contentStyle={{ backgroundColor: '#291c18', borderColor: '#854d0e', color: '#fef3c7' }} />
                <Line type="monotone" dataKey="average_hunger" stroke="#ef4444" strokeWidth={2} name="Avg Hunger" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="average_stress" stroke="#a855f7" strokeWidth={2} name="Avg Stress" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Migration Count Chart */}
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">SPATIAL MIGRATION COUNT</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
                <XAxis dataKey="tick" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <YAxis stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <Tooltip contentStyle={{ backgroundColor: '#291c18', borderColor: '#854d0e', color: '#fef3c7' }} itemStyle={{ color: '#38bdf8' }} />
                <Line type="stepAfter" dataKey="migrated_count" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Population & Food Supply Chart */}
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">TOTAL FOOD SUPPLY VS POPULATION</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
                <XAxis dataKey="tick" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <YAxis yAxisId="right" orientation="right" stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} tickMargin={10} />
                <Tooltip contentStyle={{ backgroundColor: '#291c18', borderColor: '#854d0e', color: '#fef3c7' }} />
                <Line yAxisId="left" type="monotone" dataKey="total_food_produced" stroke="#10b981" strokeWidth={2} name="Food Supply" dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="stepAfter" dataKey="living_population" stroke="#38bdf8" strokeWidth={2} name="Living Pop" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
