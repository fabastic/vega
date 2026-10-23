import React, { useEffect, useState } from 'react';
import ReactFlow, { Node, Edge, Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { fetchCausalGraph } from '../api/client';
import { CausalRecord } from '../types/simulation';
import { GitCommit, RefreshCw, Eye } from 'lucide-react';

export const CausalGraphPanel: React.FC = () => {
  const [records, setRecords] = useState<CausalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CausalRecord | null>(null);

  const loadGraph = async () => {
    try {
      const data = await fetchCausalGraph();
      setRecords(data.causal_ledger);
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // Build React Flow nodes and edges dynamically from actual causal records
  const nodes: Node[] = records.map((record, index) => {
    // Generate a pseudo-Y based on tick and X based on index to spread them out
    // A proper layout engine (like dagre) would be better, but we'll approximate a downward flow
    const isRoot = !record.source_event_id;
    let colorScheme = { bg: '#291c18', border: '#854d0e', text: '#fef3c7' };
    
    if (record.event_type.includes('drought')) {
      colorScheme = { bg: '#4c0519', border: '#e11d48', text: '#fca5a5' };
    } else if (record.event_type.includes('migration')) {
      colorScheme = { bg: '#082f49', border: '#0ea5e9', text: '#bae6fd' };
    } else if (record.event_type.includes('price')) {
      colorScheme = { bg: '#4c1d95', border: '#8b5cf6', text: '#ddd6fe' };
    }

    return {
      id: record.event_id,
      position: { x: (index % 3) * 300, y: index * 100 }, // Simple cascading grid layout
      data: { 
        label: (
          <div className="flex flex-col items-start p-1 cursor-pointer" onClick={() => setSelectedRecord(record)}>
            <span className="text-[9px] text-[#94a3b8] uppercase">[{record.tick}] {record.subject_id}</span>
            <span className="font-bold tracking-wider uppercase mt-1 text-[11px]" style={{ color: colorScheme.text }}>
              {record.event_type.replace(/_/g, ' ')}
            </span>
          </div>
        )
      },
      style: { 
        background: colorScheme.bg, 
        borderColor: colorScheme.border, 
        color: colorScheme.text,
        borderWidth: 1, 
        borderRadius: 4, 
        fontFamily: 'monospace', 
        minWidth: 220
      }
    };
  });

  const edges: Edge[] = records
    .filter(record => record.source_event_id) // Only create edge if there is a source
    .map((record) => ({
      id: `e-${record.source_event_id}-${record.event_id}`,
      source: record.source_event_id!,
      target: record.event_id,
      animated: true,
      style: { stroke: '#854d0e', strokeWidth: 2 }
    }));

  return (
    <div className="p-6 bg-[#100a08] min-h-[calc(100vh-60px)] font-mono text-xs text-slate-100 flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-[#78350f] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 border-2 border-[#4f46e5] bg-[#312e81] flex items-center justify-center rounded-sm">
            <GitCommit className="w-5 h-5 text-[#818cf8]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(79,70,229,0.5)' }}>
              INTERACTIVE CAUSAL DEPENDENCY DAG
            </h2>
            <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">
              Trace macro outcomes back to individual agent decisions. (Dynamically parsed from backend ledger)
            </p>
          </div>
        </div>

        <button
          onClick={loadGraph}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-sm bg-[#1c1410] text-[#cbd5e1] border border-[#78350f] hover:bg-[#291c18] hover:text-[#fef3c7] uppercase font-bold tracking-widest transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH LEDGER</span>
        </button>
      </div>

      <div className="flex flex-1 gap-6 pb-10">
        {/* React Flow Canvas */}
        <div className="flex-1 bg-[#0a0705] border border-[#78350f] rounded-sm overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)] relative min-h-[500px]">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background color="#44403c" gap={20} size={1} />
            <Controls style={{ backgroundColor: '#1c1410', borderColor: '#78350f' }} />
          </ReactFlow>
        </div>

        {/* Causal Inspector Side Panel */}
        {selectedRecord && (
          <div className="w-[400px] bg-[#1c1410] border border-[#b45309] rounded-sm flex flex-col overflow-hidden shadow-[0_0_15px_rgba(180,83,9,0.2)]">
            <div className="bg-[#451a03] p-3 border-b border-[#b45309] flex items-center justify-between">
              <span className="font-bold text-[#fcd34d] tracking-widest uppercase text-[10px] flex items-center">
                <Eye className="w-3.5 h-3.5 mr-2" />
                RECORD INSPECTOR
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-[10px]">
              <div>
                <span className="text-[#a16207] font-bold tracking-widest uppercase block mb-1">EVENT ID</span>
                <span className="text-[#94a3b8]">{selectedRecord.event_id}</span>
              </div>
              <div>
                <span className="text-[#a16207] font-bold tracking-widest uppercase block mb-1">TYPE & TICK</span>
                <span className="text-[#e2e8f0] uppercase">{selectedRecord.event_type} @ TICK {selectedRecord.tick}</span>
              </div>
              <div>
                <span className="text-[#a16207] font-bold tracking-widest uppercase block mb-1">SUBJECT</span>
                <span className="text-[#38bdf8] uppercase">{selectedRecord.subject_id}</span>
              </div>
              <div>
                <span className="text-[#a16207] font-bold tracking-widest uppercase block mb-1">RECORDED REASON</span>
                <div className="bg-[#291c18] border border-[#78350f] p-2 text-[#fef3c7] leading-relaxed">
                  "{selectedRecord.reason}"
                </div>
              </div>
              
              <div className="border-t border-[#78350f]/50 pt-4">
                <span className="text-[#a16207] font-bold tracking-widest uppercase block mb-2">STATE TRANSITION (RAW)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#94a3b8] text-[9px] mb-1 block">PREVIOUS STATE</span>
                    <pre className="bg-[#0a0705] p-2 border border-[#44403c] text-[#ef4444] overflow-x-auto rounded-sm">
                      {JSON.stringify(selectedRecord.previous_state, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] text-[9px] mb-1 block">NEW STATE</span>
                    <pre className="bg-[#0a0705] p-2 border border-[#44403c] text-[#34d399] overflow-x-auto rounded-sm">
                      {JSON.stringify(selectedRecord.new_state, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
