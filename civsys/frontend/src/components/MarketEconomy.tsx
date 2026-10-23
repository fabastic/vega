import React, { useEffect, useState } from 'react';
import { fetchEconomy } from '../api/client';
import { useSimulationStore } from '../store/useSimulationStore';
import { LineChart, DollarSign, TrendingUp, TrendingDown, Box } from 'lucide-react';

interface MarketData {
  food_price: number;
  food_supply: number;
  food_demand: number;
  wood_price: number;
  wood_supply: number;
  wood_demand: number;
  stone_price: number;
  stone_supply: number;
  stone_demand: number;
  metal_price: number;
  metal_supply: number;
  metal_demand: number;
  tools_price: number;
  tools_supply: number;
  tools_demand: number;
}

interface AggregateData {
  total_wealth: number;
  total_food_inventory: number;
  living_population: number;
}

export const MarketEconomy: React.FC = () => {
  const { tick } = useSimulationStore();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Throttle: update every 5 ticks
  const refreshTick = Math.floor(tick / 5) * 5;

  useEffect(() => {
    fetchEconomy().then(res => {
      setMarket(res.market);
      setAggregate(res.aggregate);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [refreshTick]);

  const CommodityRow = ({ name, price, supply, demand, color }: { name: string, price: number, supply: number, demand: number, color: string }) => {
    const isDeficit = demand > supply;
    return (
      <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 border border-[#333] bg-[#0a0a0a] flex items-center justify-center">
            <Box className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <h3 className="text-[#fef3c7] font-bold uppercase tracking-widest">{name}</h3>
            <div className="text-[10px] text-[#94a3b8] flex items-center mt-1">
              <span className="text-[#10b981]">SUPPLY: {supply.toFixed(0)}</span>
              <span className="mx-2">|</span>
              <span className="text-[#ef4444]">DEMAND: {demand.toFixed(0)}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right flex items-center space-x-4">
          {isDeficit ? (
            <div className="text-[#ef4444] text-[10px] uppercase flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> DEFICIT
            </div>
          ) : (
            <div className="text-[#10b981] text-[10px] uppercase flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" /> SURPLUS
            </div>
          )}
          
          <div className="text-xl font-bold text-[#f59e0b] w-20">
            ${price.toFixed(2)}
          </div>
        </div>
      </div>
    );
  };

  if (!market) {
    return (
      <div className="w-full h-full flex items-center justify-center font-retro text-[#78350f]">
        ERROR LOADING ECONOMY
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto font-mono text-xs text-slate-100 pb-20">
      <div className="flex items-center space-x-3 mb-6 border-b border-[#78350f] pb-4">
        <div className="w-10 h-10 border-2 border-[#b45309] bg-[#451a03] flex items-center justify-center rounded-sm">
          <LineChart className="w-5 h-5 text-[#f59e0b]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#fef3c7] uppercase tracking-wider" style={{ textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
            MACROECONOMICS & COMMODITY MARKETS
          </h2>
          <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase mt-1">
            Real-time supply, demand, and EMA price discovery.
          </p>
        </div>
      </div>

      {loading || !market || !aggregate ? (
        <div className="text-center py-20 text-[#78716c] animate-pulse">CALCULATING MARKET EQUILIBRIUM...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <span className="text-[#94a3b8] block uppercase tracking-widest mb-2 text-[10px] flex items-center">
                <DollarSign className="w-3 h-3 mr-1 text-[#f59e0b]" /> TOTAL CIVILIZATION WEALTH
              </span>
              <span className="text-[#f59e0b] font-bold text-2xl">${aggregate.total_wealth.toFixed(0)}</span>
              <div className="text-[#78716c] text-[9px] mt-1">
                AVG: ${(aggregate.total_wealth / Math.max(1, aggregate.living_population)).toFixed(1)} / CAPITA
              </div>
            </div>
            
            <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <span className="text-[#94a3b8] block uppercase tracking-widest mb-2 text-[10px] flex items-center">
                <Box className="w-3 h-3 mr-1 text-[#10b981]" /> GROSS FOOD INVENTORY
              </span>
              <span className="text-[#10b981] font-bold text-2xl">{aggregate.total_food_inventory.toFixed(0)}</span>
              <div className="text-[#78716c] text-[9px] mt-1">
                DISTRIBUTED ACROSS {aggregate.living_population} AGENTS
              </div>
            </div>
            
            <div className="bg-[#1c1410] border border-[#78350f] rounded-sm p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col justify-center">
               <span className="text-[#94a3b8] block uppercase tracking-widest mb-1 text-[10px]">MARKET STATUS</span>
               <span className="text-[#34d399] font-bold text-lg">OPEN & TRADING</span>
            </div>
          </div>

          <h3 className="text-[#fbbf24] font-bold mb-4 tracking-widest uppercase text-[10px]">COMMODITY EXCHANGE</h3>
          <div className="space-y-3">
            <CommodityRow name="Food" price={market.food_price} supply={market.food_supply} demand={market.food_demand} color="#10b981" />
            <CommodityRow name="Wood" price={market.wood_price} supply={market.wood_supply} demand={market.wood_demand} color="#8b5cf6" />
            <CommodityRow name="Stone" price={market.stone_price} supply={market.stone_supply} demand={market.stone_demand} color="#64748b" />
            <CommodityRow name="Metal" price={market.metal_price} supply={market.metal_supply} demand={market.metal_demand} color="#38bdf8" />
            <CommodityRow name="Tools" price={market.tools_price} supply={market.tools_supply} demand={market.tools_demand} color="#f59e0b" />
          </div>
        </>
      )}
    </div>
  );
};
