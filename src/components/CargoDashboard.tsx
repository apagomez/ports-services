
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { VesselData } from '../types';
import { Package, TrendingUp, Scale, Boxes, X, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';

interface CargoDashboardProps {
  data: VesselData[];
}

const COLORS = ['#141414', '#4D4D4D', '#E44D26', '#F16529', '#264DE4', '#2965F1', '#555'];

export const CargoDashboard: React.FC<CargoDashboardProps> = ({ data }) => {
  const [cargoFilter, setCargoFilter] = useState<'All' | 'Foreign' | 'Domestic'>('All');
  const [terminalFilter, setTerminalFilter] = useState<string>('All');
  const [colFilters, setColFilters] = useState({
    id: '',
    vessel: '',
    description: '',
    type: 'All'
  });

  const months = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);

  const [startMonth, setStartMonth] = useState<string>(months[0]);
  const [endMonth, setEndMonth] = useState<string>(months[months.length - 1]);

  const monthToIndex = (month: string) => months.indexOf(month.toUpperCase());

  const uniqueTerminals = useMemo(() => {
    const terminals = new Set(data.map(v => v.terminal).filter(Boolean));
    return Array.from(terminals).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.filter(v => {
      // Basic cargo presence check
      const hasCargo = v.cargoDescription && v.cargoDescription.trim() !== '';
      const hasWeight = (v.cargoVolumeMT || 0) > 0;
      
      if (!hasCargo || !hasWeight) return false;

      const vMonthIdx = monthToIndex(v.month);
      const matchesMonthRange = vMonthIdx >= startIndex && vMonthIdx <= endIndex;

      const matchesMain = cargoFilter === 'All' || v.orientation === cargoFilter;
      const matchesTerminal = terminalFilter === 'All' || v.terminal === terminalFilter;
      const matchesId = v.controlNo.toLowerCase().includes(colFilters.id.toLowerCase());
      const matchesVessel = v.vesselName.toLowerCase().includes(colFilters.vessel.toLowerCase());
      const matchesDesc = (v.cargoDescription || '').toLowerCase().includes(colFilters.description.toLowerCase());
      const matchesType = colFilters.type === 'All' || v.orientation === colFilters.type;

      return matchesMonthRange && matchesMain && matchesTerminal && matchesId && matchesVessel && matchesDesc && matchesType;
    });
  }, [data, cargoFilter, terminalFilter, colFilters, startMonth, endMonth]);

  const totalVolumeMT = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + (curr.cargoVolumeMT || 0), 0);
  }, [filteredData]);

  const [expandedStat, setExpandedStat] = useState<string | null>(null);

  const cargoStats = useMemo(() => {
    const statsDetail: Record<string, { volume: number, count: number }> = {};
    filteredData.forEach(v => {
      const type = v.cargoDescription || 'OTHER/UNSPECIFIED';
      if (!statsDetail[type]) statsDetail[type] = { volume: 0, count: 0 };
      statsDetail[type].volume += (v.cargoVolumeMT || 0);
      statsDetail[type].count += 1;
    });
    return Object.entries(statsDetail)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.volume - a.volume);
  }, [filteredData]);

  const stats = useMemo(() => {
    const totalVolume = totalVolumeMT;
    const uniqueCargoTypes = new Set(filteredData.map(v => v.cargoDescription).filter(Boolean)).size;
    const avgVolume = filteredData.length > 0 ? totalVolume / filteredData.length : 0;
    
    return [
      { label: 'Total Volume (MT)', value: totalVolume.toLocaleString(), icon: Scale, color: 'text-blue-600', bg: 'bg-blue-100', clickable: false },
      { label: 'Cargo Varieties', value: uniqueCargoTypes, icon: Boxes, color: 'text-orange-600', bg: 'bg-orange-100', clickable: true, id: 'varieties' },
      { label: 'Avg Cargo/Vessel', value: Math.round(avgVolume).toLocaleString() + ' MT', icon: Package, color: 'text-green-600', bg: 'bg-green-100', clickable: false },
    ];
  }, [filteredData, totalVolumeMT]);

  const cargoByType = useMemo(() => {
    return cargoStats.slice(0, 8).map(s => ({ name: s.name, value: s.volume }));
  }, [cargoStats]);

  const monthlyTrend = useMemo(() => {
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    const dataByMonth: Record<string, { month: string, volume: number, count: number }> = {};
    
    months.forEach(m => {
      dataByMonth[m] = { month: m.substring(0, 3), volume: 0, count: 0 };
    });

    filteredData.forEach(v => {
      const m = v.month.toUpperCase();
      if (dataByMonth[m]) {
        dataByMonth[m].volume += (v.cargoVolumeMT || 0);
        dataByMonth[m].count += 1;
      }
    });

    return months.map(m => dataByMonth[m]).filter(d => d.count > 0);
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold font-mono uppercase tracking-tighter">Cargo Statistics Analysis</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center bg-white border border-[#141414] rounded-sm p-1 gap-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase px-2 opacity-60">Period:</span>
            <select 
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1"
            >
              {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
            </select>
            <span className="text-[10px] font-mono opacity-40">—</span>
            <select 
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1"
            >
              {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
            </select>
          </div>

          {/* Terminal Filter */}
          <div className="flex items-center bg-white border border-[#141414] rounded-sm p-1 gap-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase px-2 opacity-60">Terminal:</span>
            <select 
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1"
            >
              <option value="All">All Terminals</option>
              {uniqueTerminals.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex bg-white border border-[#141414] p-1 rounded-sm shadow-sm">
            {(['All', 'Foreign', 'Domestic'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setCargoFilter(type)}
                className={cn(
                  "px-4 py-1 text-[10px] font-mono uppercase tracking-widest transition-all",
                  cargoFilter === type ? "bg-[#141414] text-white" : "hover:bg-gray-100"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => stat.clickable && setExpandedStat(stat.id || null)}
            className={cn(
              "bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4",
              stat.clickable && "cursor-pointer hover:border-orange-200 hover:shadow-md transition-all active:scale-95"
            )}
          >
            <div className={`${stat.bg} p-3 rounded-lg`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 font-medium flex items-center justify-between">
                {stat.label}
                {stat.clickable && <Fingerprint className="w-3 h-3 opacity-30" />}
              </p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Stat Detail View (Varieties) */}
      {expandedStat === 'varieties' && (
        <div className="bg-[#141414] text-[#E4E3E0] p-6 rounded-sm border-l-4 border-orange-500 shadow-2xl relative overflow-hidden animate-in slide-in-from-top duration-300">
          <div className="absolute top-0 right-0 p-4">
            <button 
              onClick={() => setExpandedStat(null)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <Boxes className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-mono uppercase tracking-widest">Detailed Cargo Breakdown</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {cargoStats.map((item, idx) => (
                <div key={idx} className="flex flex-col border-b border-white/10 pb-3 hover:bg-white/5 transition-colors p-2 rounded">
                  <div className="flex justify-between items-start mb-1 text-xs">
                    <span className="font-bold opacity-90">{item.name}</span>
                    <span className="font-mono text-orange-400">{item.volume.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mr-3">
                      <div 
                        className="bg-orange-500 h-full" 
                        style={{ width: `${(item.volume / cargoStats[0].volume) * 100}%` }} 
                      />
                    </div>
                    <span className="text-[10px] opacity-50 font-mono whitespace-nowrap">{item.count} VESSEL(S)</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="lg:col-span-2 bg-white/5 p-4 rounded border border-white/10">
              <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-4">Volume Distribution Analysis</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cargoStats.slice(0, 15)} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9, fill: '#E4E3E077' }} />
                    <Tooltip 
                      cursor={{ fill: '#ffffff05' }}
                      contentStyle={{ backgroundColor: '#141414', border: '1px solid #ffffff22', fontSize: '10px' }}
                    />
                    <Bar dataKey="volume" fill="#f97316" radius={[0, 2, 2, 0]} name="Volume (MT)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-white/5 border border-white/10 text-[10px] font-mono leading-relaxed opacity-70 italic">
                Note: Statistics reflect the current filtered period ({startMonth} - {endMonth}) and territory ({cargoFilter}). 
                The breakdown reveals "{cargoStats[0].name}" as the primary commodity by tonnage.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Cargo Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
            Monthly Cargo Tonnage Trend
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`} />
                <Tooltip formatter={(value: number) => value.toLocaleString() + ' MT'} />
                <Area type="monotone" dataKey="volume" stroke="#141414" fill="#14141422" name="Volume (MT)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cargo Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Top Cargo Commodities by Volume</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cargoByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name }) => name.length > 15 ? name.substring(0, 15) + '...' : name}
                >
                  {cargoByType.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString() + ' MT'} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cargo Table */}
      <div className="bg-white border border-[#141414] rounded-sm overflow-hidden">
        <div className="bg-[#141414] p-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#E4E3E0]">Cargo Manifest Detail</h3>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs uppercase">
            <thead className="sticky top-0 bg-gray-100 z-10 border-b border-[#141414]">
              <tr className="bg-[#141414] text-[#E4E3E0]">
                <th className="p-3 font-mono text-[10px] tracking-widest border-r border-[#E4E3E022]">ID</th>
                <th className="p-3 font-bold border-r border-[#E4E3E022]">Vessel</th>
                <th className="p-3 border-r border-[#E4E3E022]">Cargo Description</th>
                <th className="p-3 border-r border-[#E4E3E022]">Weight (MT)</th>
                <th className="p-3">Type</th>
              </tr>
              <tr className="bg-gray-50 border-b border-[#141414]">
                <td className="p-2 border-r border-[#14141411]">
                  <input 
                    type="text" 
                    placeholder="ID..." 
                    className="w-full text-[10px] p-1 bg-white border border-[#14141422] uppercase font-mono"
                    value={colFilters.id}
                    onChange={(e) => setColFilters(prev => ({ ...prev, id: e.target.value }))}
                  />
                </td>
                <td className="p-2 border-r border-[#14141411]">
                  <input 
                    type="text" 
                    placeholder="VESSEL..." 
                    className="w-full text-[10px] p-1 bg-white border border-[#14141422] uppercase font-mono"
                    value={colFilters.vessel}
                    onChange={(e) => setColFilters(prev => ({ ...prev, vessel: e.target.value }))}
                  />
                </td>
                <td className="p-2 border-r border-[#14141411]">
                  <input 
                    type="text" 
                    placeholder="DESC..." 
                    className="w-full text-[10px] p-1 bg-white border border-[#14141422] uppercase font-mono"
                    value={colFilters.description}
                    onChange={(e) => setColFilters(prev => ({ ...prev, description: e.target.value }))}
                  />
                </td>
                <td className="p-2 border-r border-[#14141411]">
                  {/* Weight filter not requested specifically but good for spacing or can be empty */}
                  <div className="w-full h-6 bg-gray-200/20" />
                </td>
                <td className="p-2">
                  <select 
                    className="w-full text-[10px] p-1 bg-white border border-[#14141422] uppercase font-mono"
                    value={colFilters.type}
                    onChange={(e) => setColFilters(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="All">All</option>
                    <option value="Foreign">Foreign</option>
                    <option value="Domestic">Domestic</option>
                  </select>
                </td>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((v, i) => (
                <tr key={i} className={cn("border-b border-gray-100 hover:bg-gray-50 transition-colors", i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                  <td className="p-3 font-mono opacity-50 border-r border-gray-100">{v.controlNo}</td>
                  <td className="p-3 font-bold border-r border-gray-100">{v.vesselName}</td>
                  <td className="p-3 border-r border-gray-100">{v.cargoDescription || 'N/A'}</td>
                  <td className="p-3 font-mono border-r border-gray-100">{(v.cargoVolumeMT || 0).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-sm text-[10px] block text-center",
                      v.orientation === 'Foreign' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    )}>
                      {v.orientation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#141414] text-[#E4E3E0] z-10 font-mono text-[10px] uppercase">
              <tr>
                <td colSpan={3} className="p-3 text-right font-bold tracking-widest">Total Filtered Cargo Weight:</td>
                <td className="p-3 font-bold text-sm">{totalVolumeMT.toLocaleString()} MT</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
