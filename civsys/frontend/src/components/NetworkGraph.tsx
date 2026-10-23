import React, { useEffect, useState, useMemo } from 'react';
import { fetchNetwork } from '../api/client';
import { Network, Search, Filter } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  community_id: string;
  group: string;
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
  trust: number;
  conflict: number;
  familiarity: number;
}

import { useSimulationStore } from '../store/useSimulationStore';

export const NetworkGraph: React.FC = () => {
  const { tick } = useSimulationStore();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Throttle: only refresh on tick multiples of 10 to avoid flooding the API
  const refreshTick = Math.floor(tick / 10) * 10;
  
  useEffect(() => {
    fetchNetwork().then(res => {
      // Circular Layout
      const total = res.nodes.length;
      const radius = 300;
      const center = { x: 400, y: 400 };
      
      const layoutedNodes = res.nodes.map((node: Node, i: number) => {
        const angle = (i / total) * Math.PI * 2;
        return {
          ...node,
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        };
      });
      
      setNodes(layoutedNodes);
      setEdges(res.edges);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [refreshTick]);

  const getNodeColors = (group: string) => {
    if (group.includes('farm')) return '#10b981';
    if (group.includes('wood')) return '#8b5cf6';
    if (group.includes('stone') || group.includes('mine')) return '#64748b';
    if (group.includes('trade')) return '#f59e0b';
    return '#38bdf8';
  };

  return (
    <div className="max-w-7xl mx-auto font-mono text-xs text-slate-100 pb-20">
      <div className="flex items-center justify-between mb-6 border-b border-[#78350f] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 border-2 border-[#10b981] bg-[#064e3b] flex items-center justify-center rounded-sm">
            <Network className="w-5 h-5 text-[#34d399]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(16,185,129,0.5)' }}>
              SOCIAL & INFLUENCE NETWORK GRAPH
            </h2>
            <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">
              Directional trust and conflict edges between agents.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#78716c] animate-pulse">COMPILING RELATIONAL MATRICES...</div>
      ) : (
        <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
          <svg width="800" height="800" viewBox="0 0 800 800" className="bg-[#0a0a0a] rounded-sm border border-[#333]">
            {/* Edges */}
            {edges.map((edge, i) => {
              const source = nodes.find(n => n.id === edge.source);
              const target = nodes.find(n => n.id === edge.target);
              if (!source || !target || !source.x || !source.y || !target.x || !target.y) return null;
              
              const isConflict = edge.conflict > 0.5;
              const strokeColor = isConflict ? 'rgba(239, 68, 68, 0.4)' : 'rgba(52, 211, 153, 0.4)';
              const strokeWidth = (isConflict ? edge.conflict : edge.trust) * 2;
              
              return (
                <line 
                  key={i} 
                  x1={source.x} 
                  y1={source.y} 
                  x2={target.x} 
                  y2={target.y} 
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth} 
                />
              );
            })}
            
            {/* Nodes */}
            {nodes.map(node => (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                <circle 
                  r="6" 
                  fill={getNodeColors(node.group)} 
                  stroke="#1c1410" 
                  strokeWidth="2"
                  className="hover:scale-125 hover:stroke-[#fcd34d] transition-all cursor-pointer origin-center"
                  style={{ transformBox: 'fill-box' }}
                />
                <text 
                  y="-12" 
                  textAnchor="middle" 
                  fill="#94a3b8" 
                  fontSize="10" 
                  className="pointer-events-none opacity-50"
                >
                  {node.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};
