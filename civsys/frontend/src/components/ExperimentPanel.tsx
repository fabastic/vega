import React, { useState, useEffect, useCallback } from 'react';
import { runExperiment, fetchRegistry, interpretHypothesis, fetchPresets } from '../api/client';
import { ExperimentConfig, ExperimentResult, Intervention } from '../types/simulation';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Play, FlaskConical, AlertTriangle, Activity, Plus, Trash2, BrainCircuit, BookOpen, Search } from 'lucide-react';

export const ExperimentPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [registry, setRegistry] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetSearch, setPresetSearch] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  
  const [seed, setSeed] = useState<number>(42);
  const [durationTicks, setDurationTicks] = useState<number>(500);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [hypothesisQuery, setHypothesisQuery] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistry().then(data => setRegistry(data.parameters || []));
    // Fetch authoritative presets from backend
    fetchPresets().then(data => setPresets(data.presets || [])).catch(() => {});
  }, []);

  const handleAddIntervention = () => {
    setInterventions([...interventions, {
      target: registry[0]?.id || 'crop_yield_multiplier',
      operation: 'set',
      value: 1.0,
      start_tick: 100,
      end_tick: 300,
      scope: { scope_type: 'GLOBAL', target_id: null }
    }]);
  };

  const handleRemoveIntervention = (index: number) => {
    const newInv = [...interventions];
    newInv.splice(index, 1);
    setInterventions(newInv);
  };

  const updateIntervention = (index: number, field: string, value: any) => {
    const newInv = [...interventions];
    (newInv[index] as any)[field] = value;
    setInterventions(newInv);
  };

  // Load a preset from the backend-authoritative library
  const loadPreset = useCallback((preset: any) => {
    setSeed(42);
    setDurationTicks(500);
    setInterventions(preset.interventions || []);
    setShowPresets(false);
    setHypothesisQuery('');
    setInterpretError(null);
  }, []);

  const handleInterpretHypothesis = async () => {
    if (!hypothesisQuery.trim()) return;
    setInterpreting(true);
    setInterpretError(null);
    try {
      const res: any = await interpretHypothesis(hypothesisQuery);
      if (!res.is_valid) {
        setInterpretError(res.error_message || 'Could not interpret hypothesis. Try selecting a preset from the library.');
        return;
      }
      const config = res.config;
      setSeed(config.seed || 42);
      setDurationTicks(config.duration_ticks || 500);
      setInterventions(config.interventions || []);
    } catch (err) {
      console.error(err);
      setInterpretError('API error interpreting hypothesis. Check backend connection.');
    } finally {
      setInterpreting(false);
    }
  };

  const handleRunExperiment = async () => {
    if (interventions.length === 0) {
      alert('Add at least one intervention to create a treatment condition.');
      return;
    }
    setLoading(true);
    const config: ExperimentConfig = {
      id: `exp_${Date.now()}`,
      name: hypothesisQuery || 'Custom Experiment',
      seed,
      population_size: 150,
      world_width: 128,
      world_height: 128,
      duration_ticks: durationTicks,
      interventions
    };

    try {
      const res = await runExperiment(config);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = React.useMemo(() => {
    if (!result) return [];
    return result.control_metrics.map((c, i) => {
      const t = result.treatment_metrics[i];
      return {
        tick: c.tick,
        control_food_price: c.food_price_index,
        treatment_food_price: t?.food_price_index ?? c.food_price_index,
        control_migration: c.migrated_count,
        treatment_migration: t?.migrated_count ?? c.migrated_count,
        control_hunger: c.average_hunger,
        treatment_hunger: t?.average_hunger ?? c.average_hunger,
      };
    });
  }, [result]);

  const startTick = interventions.length > 0 ? Math.min(...interventions.map(i => i.start_tick)) : undefined;
  const endTick = interventions.length > 0 ? Math.max(...interventions.map(i => i.end_tick)) : undefined;
  const peakTick = result?.divergence_summary?.peak_food_tick;

  const filteredPresets = presets.filter(p =>
    !presetSearch || p.name.toLowerCase().includes(presetSearch.toLowerCase()) || p.category.toLowerCase().includes(presetSearch.toLowerCase())
  );

  const categoryColors: Record<string, string> = {
    'Natural Disaster': '#ef4444',
    'Economy': '#f59e0b',
    'Resource': '#10b981',
    'Technology': '#38bdf8',
    'Social': '#a855f7',
    'Population': '#f97316',
  };

  return (
    <div className="p-6 bg-[#100a08] font-mono text-xs text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[#78350f] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 border-2 border-[#10b981] bg-[#064e3b] flex items-center justify-center rounded-sm">
            <FlaskConical className="w-5 h-5 text-[#34d399]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(16,185,129,0.5)' }}>
              EXPERIMENTAL SCENARIO BUILDER
            </h2>
            <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">
              Type a hypothesis or pick from the preset library → run control vs treatment.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center space-x-2 px-4 py-2 rounded-sm bg-[#1e1b4b] text-[#818cf8] border border-[#4f46e5] hover:bg-[#312e81] uppercase font-bold tracking-widest transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>PRESETS</span>
          </button>
          <button
            onClick={handleRunExperiment}
            disabled={loading || interventions.length === 0}
            className="flex items-center space-x-2 px-6 py-2 rounded-sm bg-[#064e3b] text-[#6ee7b7] border border-[#10b981] hover:bg-[#065f46] shadow-[0_0_12px_rgba(16,185,129,0.4)] disabled:opacity-40 uppercase font-bold tracking-widest transition-all"
          >
            {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{loading ? `SIMULATING ${durationTicks} TICKS...` : 'LAUNCH EXPERIMENT'}</span>
          </button>
        </div>
      </div>

      {/* Preset Library (backend-driven) */}
      {showPresets && (
        <div className="mb-6 bg-[#0f0c1a] border border-[#4f46e5] rounded-sm p-4 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#818cf8] font-bold tracking-widest uppercase text-[10px]">
              📚 EXPERIMENT PRESET LIBRARY ({presets.length} templates — backend authoritative)
            </h3>
            <div className="flex items-center bg-[#1e1b4b] border border-[#312e81] px-2 py-1">
              <Search className="w-3 h-3 text-[#6366f1] mr-1.5" />
              <input
                type="text"
                placeholder="Filter presets..."
                value={presetSearch}
                onChange={e => setPresetSearch(e.target.value)}
                className="bg-transparent text-[#e2e8f0] text-[11px] outline-none w-32 placeholder-[#475569]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {filteredPresets.map(preset => (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className="text-left bg-[#1c1410] border border-[#44403c] hover:border-[#f59e0b] p-3 rounded-sm transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{preset.icon}</span>
                  <span className="text-[#fef3c7] font-bold text-[11px] group-hover:text-[#fbbf24]">{preset.name}</span>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase" style={{ background: `${categoryColors[preset.category] || '#78716c'}20`, color: categoryColors[preset.category] || '#78716c', border: `1px solid ${categoryColors[preset.category] || '#78716c'}40` }}>
                    {preset.category}
                  </span>
                </div>
                <p className="text-[#78716c] text-[10px] leading-relaxed">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NLP Interpreter */}
      <div className="mb-6 bg-[#1c1410] border border-[#4f46e5] rounded-sm p-4 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
        <h3 className="text-[#818cf8] font-bold mb-3 tracking-widest uppercase text-[10px] flex items-center">
          <BrainCircuit className="w-4 h-4 mr-2" />
          NATURAL LANGUAGE HYPOTHESIS INTERPRETER
        </h3>
        <div className="flex items-center space-x-3">
          <input 
            type="text" 
            placeholder='"What if electricity is invented 200 years later?" or "What if a northern region floods?"'
            value={hypothesisQuery}
            onChange={(e) => setHypothesisQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInterpretHypothesis()}
            className="flex-1 bg-[#0a0705] border border-[#312e81] p-3 text-[#e2e8f0] focus:border-[#6366f1] outline-none placeholder-[#475569]"
          />
          <button 
            onClick={handleInterpretHypothesis}
            disabled={interpreting || !hypothesisQuery.trim()}
            className="px-6 py-3 rounded-sm bg-[#312e81] text-[#c7d2fe] border border-[#4f46e5] hover:bg-[#3730a3] disabled:opacity-50 uppercase font-bold tracking-widest whitespace-nowrap transition-all"
          >
            {interpreting ? 'PARSING...' : 'PARSE'}
          </button>
        </div>
        {interpretError && (
          <div className="mt-3 text-[#ef4444] text-[10px] uppercase font-bold p-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-sm flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{interpretError}</span>
          </div>
        )}
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Timeline */}
        <div className="col-span-1 bg-[#1c1410] border border-[#78350f] rounded-sm p-4">
          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">TIMELINE</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[#94a3b8] text-[9px] block uppercase tracking-widest mb-1">SEED (DETERMINISTIC)</label>
              <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value))} className="w-full bg-[#0a0705] border border-[#44403c] p-2 text-[#e2e8f0] focus:border-[#fbbf24] outline-none" />
            </div>
            <div>
              <label className="text-[#94a3b8] text-[9px] block uppercase tracking-widest mb-1">DURATION (TICKS)</label>
              <input type="number" value={durationTicks} onChange={(e) => setDurationTicks(parseInt(e.target.value))} className="w-full bg-[#0a0705] border border-[#44403c] p-2 text-[#e2e8f0] focus:border-[#fbbf24] outline-none" />
            </div>
            {/* Visual info about experiment */}
            <div className="border-t border-[#44403c] pt-3 text-[10px] text-[#78716c] space-y-1">
              <div>CONTROL: seed {seed}, no interventions</div>
              <div>TREATMENT: seed {seed}, {interventions.length} intervention(s)</div>
              {startTick !== undefined && <div className="text-[#fcd34d]">Starts: tick {startTick}</div>}
              {endTick !== undefined && <div className="text-[#10b981]">Ends: tick {endTick}</div>}
            </div>
          </div>
        </div>

        {/* Interventions */}
        <div className="col-span-2 bg-[#1c1410] border border-[#78350f] rounded-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#fbbf24] font-bold tracking-widest uppercase text-[10px]">TREATMENT INTERVENTIONS</h3>
            <button onClick={handleAddIntervention} className="flex items-center space-x-1 px-2 py-1 bg-[#291c18] border border-[#78350f] hover:bg-[#451a03] text-[#fef3c7]">
              <Plus className="w-3 h-3" /> <span>ADD</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {interventions.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#44403c] text-[#78716c]">
                No interventions — add one or load a preset.<br/>
                <span className="text-[#44403c] text-[10px]">Treatment will equal Control without interventions.</span>
              </div>
            ) : (
              interventions.map((inv, idx) => (
                <div key={idx} className="bg-[#0a0705] border border-[#44403c] p-3 flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <select 
                        value={inv.target} 
                        onChange={(e) => updateIntervention(idx, 'target', e.target.value)}
                        className="bg-[#291c18] border border-[#78350f] text-[#fef3c7] p-1 flex-1 outline-none"
                      >
                        {registry.map(p => <option key={p.id} value={p.id}>{p.label} ({p.domain})</option>)}
                      </select>
                      <select 
                        value={inv.operation} 
                        onChange={(e) => updateIntervention(idx, 'operation', e.target.value)}
                        className="bg-[#291c18] border border-[#78350f] text-[#38bdf8] p-1 w-24 outline-none uppercase"
                      >
                        <option value="set">SET TO</option>
                        <option value="add">ADD</option>
                        <option value="multiply">MULTIPLY</option>
                      </select>
                      <input 
                        type="number" step="0.1" value={inv.value} 
                        onChange={(e) => updateIntervention(idx, 'value', parseFloat(e.target.value))}
                        className="bg-[#291c18] border border-[#78350f] text-[#10b981] p-1 w-20 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-[#94a3b8] text-[10px]">
                      <div className="flex items-center gap-1">
                        START: <input type="number" value={inv.start_tick} onChange={(e) => updateIntervention(idx, 'start_tick', parseInt(e.target.value))} className="bg-transparent border-b border-[#78350f] text-[#fcd34d] w-14 text-center outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        END: <input type="number" value={inv.end_tick} onChange={(e) => updateIntervention(idx, 'end_tick', parseInt(e.target.value))} className="bg-transparent border-b border-[#78350f] text-[#fcd34d] w-14 text-center outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        SCOPE:
                        <select value={inv.scope?.scope_type} onChange={(e) => updateIntervention(idx, 'scope', { ...inv.scope, scope_type: e.target.value })} className="bg-[#291c18] border border-[#44403c] text-[#94a3b8] p-0.5 outline-none">
                          <option value="GLOBAL">GLOBAL</option>
                          <option value="REGION">REGION</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveIntervention(idx)} className="mt-1 text-[#ef4444] hover:text-[#f87171]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 pb-20">
          {/* Divergence Summary */}
          <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-5">
            <h3 className="text-[10px] font-bold text-[#fbbf24] mb-4 flex items-center space-x-2 tracking-widest uppercase">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
              <span>EMERGENT DIVERGENCE SUMMARY (TICK {durationTicks})</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { label: 'Food Price Peak Δ', value: `${result.divergence_summary.peak_food_delta > 0 ? '+' : ''}${result.divergence_summary.peak_food_delta?.toFixed(2) || '0.00'}`, sub: `@ Tick ${result.divergence_summary.peak_food_tick}`, color: '#f59e0b' },
                { label: 'Migration Δ', value: `${result.divergence_summary.migrated_delta > 0 ? '+' : ''}${result.divergence_summary.migrated_delta || 0}`, sub: 'extra migrations', color: '#38bdf8' },
                { label: 'Avg Hunger Δ', value: `${result.divergence_summary.hunger_delta > 0 ? '+' : ''}${result.divergence_summary.hunger_delta?.toFixed(3) || '0.000'}`, sub: 'normalized 0–1', color: '#ef4444' },
                { label: 'Recovery Time', value: result.divergence_summary.recovery_time > -1 ? `${result.divergence_summary.recovery_time} ticks` : 'None', sub: 'to baseline price', color: '#10b981' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-[#291c18] p-3 rounded-sm border border-[#854d0e]/30">
                  <span className="text-[#94a3b8] text-[9px] block uppercase tracking-widest mb-1">{label}</span>
                  <span className="font-bold text-lg" style={{ color }}>{value}</span>
                  <div className="text-[#78716c] text-[9px] mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts: Food Price & Migration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'FOOD PRICE INDEX: CONTROL VS TREATMENT', ctrlKey: 'control_food_price', trtKey: 'treatment_food_price' },
              { title: 'MIGRATION COUNT: CONTROL VS TREATMENT', ctrlKey: 'control_migration', trtKey: 'treatment_migration' },
            ].map(({ title, ctrlKey, trtKey }) => (
              <div key={title} className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4">
                <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">{title}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
                      <XAxis dataKey="tick" stroke="#78716c" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#a8a29e', fontSize: 10 }} />
                      <YAxis stroke="#78716c" tick={{ fill: '#a8a29e', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#291c18', borderColor: '#854d0e', color: '#fef3c7' }} />
                      {startTick !== undefined && <ReferenceLine x={startTick} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'START', fill: '#ef4444', fontSize: 9 }} />}
                      {endTick !== undefined && <ReferenceLine x={endTick} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'END', fill: '#10b981', fontSize: 9 }} />}
                      {peakTick !== undefined && <ReferenceLine x={peakTick} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'PEAK', fill: '#f59e0b', fontSize: 9 }} />}
                      <Line type="monotone" dataKey={ctrlKey} stroke="#10b981" strokeWidth={2} name="Control" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey={trtKey} stroke="#ef4444" strokeWidth={2} name="Treatment" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
