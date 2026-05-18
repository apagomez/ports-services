
import React, { useMemo, useState } from 'react';
import { VesselData } from '../types';
import { 
  Ship, 
  Globe, 
  Anchor, 
  TrendingUp, 
  Activity, 
  Scale, 
  Users, 
  Calendar,
  Building2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface StatisticsDashboardProps {
  data: VesselData[];
  onVesselSelect?: (vessel: VesselData) => void;
}

interface TrafficStats {
  calls: number;
  gt: number;
  pax: number;
  cargo: number;
}

export const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ data, onVesselSelect }) => {
  const months = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);

  const [startMonth, setStartMonth] = useState<string>('JANUARY');
  const [endMonth, setEndMonth] = useState<string>('DECEMBER');
  const [orientationFilter, setOrientationFilter] = useState<string>('ALL');

  const [selectedCategoryVessels, setSelectedCategoryVessels] = useState<{ title: string; vessels: VesselData[] } | null>(null);

  const handleRowClick = (title: string, filterFn: (v: VesselData) => boolean) => {
    setSelectedCategoryVessels({
      title,
      vessels: filteredData.filter(filterFn)
    });
  };

  const monthToIndex = (month: string) => months.indexOf(month.toUpperCase());

  const filteredData = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return data.filter(v => {
      const vMonthIdx = monthToIndex(v.month);
      const matchesMonth = vMonthIdx >= startIndex && vMonthIdx <= endIndex;
      const matchesOrientation = orientationFilter === 'ALL' || v.orientation.toUpperCase() === orientationFilter;
      return matchesMonth && matchesOrientation;
    });
  }, [data, startMonth, endMonth, orientationFilter]);

  // Aggregate stats by Orientation and Vessel type
  const vesselTrafficSummary = useMemo(() => {
    const categories = ['Passenger', 'Cargo', 'Tanker', 'Others'];
    const summary: {
      Foreign: Record<string, TrafficStats>,
      Domestic: Record<string, TrafficStats>
    } = {
      Foreign: {},
      Domestic: {}
    };

    ['Foreign', 'Domestic'].forEach(o => {
      categories.forEach(c => {
        summary[o as 'Foreign' | 'Domestic'][c] = { calls: 0, gt: 0, pax: 0, cargo: 0 };
      });
    });

    filteredData.forEach(v => {
      const orientation = v.orientation;
      let category = 'Others';
      const type = v.vesselType.toLowerCase();
      if (type.includes('passenger') || type.includes('roro')) category = 'Passenger';
      else if (type.includes('cargo') || type.includes('container') || type.includes('bulk')) category = 'Cargo';
      else if (type.includes('tanker')) category = 'Tanker';

      const stats = summary[orientation][category];
      stats.calls += 1;
      stats.gt += (v.gt || 0);
      stats.pax += (v.passengers || 0);
      stats.cargo += (v.cargoVolumeMT || 0);
    });

    return summary;
  }, [filteredData]);

  const terminalStats = useMemo(() => {
    const groups: Record<string, { calls: number, gt: number, cargo: number }> = {};
    filteredData.forEach(v => {
      if (!groups[v.terminal]) groups[v.terminal] = { calls: 0, gt: 0, cargo: 0 };
      groups[v.terminal].calls += 1;
      groups[v.terminal].gt += (v.gt || 0);
      groups[v.terminal].cargo += (v.cargoVolumeMT || 0);
    });
    return Object.entries(groups)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.calls - a.calls);
  }, [filteredData]);

  const monthlyTrend = useMemo(() => {
    const trend = months.map(m => {
      const mData = filteredData.filter(v => v.month.toUpperCase() === m);
      return {
        month: m.substring(0, 3),
        calls: mData.length,
        gt: mData.reduce((acc, v) => acc + (v.gt || 0), 0),
        cargo: mData.reduce((acc, v) => acc + (v.cargoVolumeMT || 0), 0)
      };
    }).filter(d => d.calls > 0);

    return trend;
  }, [filteredData]);

  const vesselCountsByMonth = useMemo(() => {
    return months.map(m => {
      const monthData = filteredData.filter(v => v.month.toUpperCase() === m);
      const domestic = monthData.filter(v => v.orientation === 'Domestic').length;
      const foreign = monthData.filter(v => v.orientation === 'Foreign').length;
      return {
        month: m.substring(0, 3),
        domestic,
        foreign,
        total: domestic + foreign
      };
    }).filter(m => m.total > 0 || orientationFilter !== 'ALL');
  }, [filteredData, months, orientationFilter]);

  const domesticPurposeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const filtered = filteredData.filter(v => v.orientation === 'Domestic');
    filtered.forEach(v => {
      const p = v.purpose || 'NOT STATED';
      stats[p] = (stats[p] || 0) + 1;
    });
    const total = Object.values(stats).reduce((acc, s) => acc + s, 0);
    return Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const foreignPurposeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const filtered = filteredData.filter(v => v.orientation === 'Foreign');
    filtered.forEach(v => {
      const p = v.purpose || 'NOT STATED';
      stats[p] = (stats[p] || 0) + 1;
    });
    const total = Object.values(stats).reduce((acc, s) => acc + s, 0);
    return Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const domesticCargoMixStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const filtered = filteredData.filter(v => v.orientation === 'Domestic');
    filtered.forEach(v => {
      const s = v.shipmentKind || 'OTHERS';
      stats[s] = (stats[s] || 0) + (v.cargoVolumeMT || 0);
    });
    const total = Object.values(stats).reduce((acc, s) => acc + s, 0);
    return Object.entries(stats)
      .map(([name, weight]) => ({
        name,
        weight,
        percentage: total > 0 ? (weight / total) * 100 : 0
      }))
      .filter(item => item.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [filteredData]);

  const foreignCargoMixStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const filtered = filteredData.filter(v => v.orientation === 'Foreign');
    filtered.forEach(v => {
      const s = v.shipmentKind || 'OTHERS';
      stats[s] = (stats[s] || 0) + (v.cargoVolumeMT || 0);
    });
    const total = Object.values(stats).reduce((acc, s) => acc + s, 0);
    return Object.entries(stats)
      .map(([name, weight]) => ({
        name,
        weight,
        percentage: total > 0 ? (weight / total) * 100 : 0
      }))
      .filter(item => item.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [filteredData]);

  const cargoVarietyStats = useMemo(() => {
    const orientationGroups: Record<string, Record<string, number>> = {
      Domestic: {},
      Foreign: {}
    };

    let grandTotalWeight = 0;

    filteredData.forEach(v => {
      const o = v.orientation;
      const c = v.cargoDescription || 'NOT STATED';
      const weight = v.cargoVolumeMT || 0;
      
      orientationGroups[o][c] = (orientationGroups[o][c] || 0) + weight;
      grandTotalWeight += weight;
    });

    const formatGroup = (o: string) => {
      const items = Object.entries(orientationGroups[o])
        .map(([name, weight]) => ({
          name,
          weight,
          percentage: grandTotalWeight > 0 ? (weight / grandTotalWeight) * 100 : 0
        }))
        .filter(item => item.weight > 0)
        .sort((a, b) => b.weight - a.weight);

      const subTotalWeight = items.reduce((acc, i) => acc + i.weight, 0);
      const subTotalPercentage = grandTotalWeight > 0 ? (subTotalWeight / grandTotalWeight) * 100 : 0;

      return {
        items,
        subTotalWeight,
        subTotalPercentage
      };
    };

    return {
      domestic: formatGroup('Domestic'),
      foreign: formatGroup('Foreign'),
      grandTotalWeight
    };
  }, [filteredData]);

  const productivityStats = useMemo(() => {
    const calcStats = (orientation: 'Foreign' | 'Domestic' | 'ALL') => {
      const vessels = filteredData.filter(v => {
        const matchesOrientation = orientation === 'ALL' ? true : v.orientation === orientation;
        const isDeparted = v.status?.toUpperCase() === 'DEPARTED';
        return matchesOrientation && isDeparted;
      });
      const calls = vessels.length;
      const totalVolume = vessels.reduce((acc, v) => acc + (v.cargoVolumeMT || 0), 0);
      const totalBerthTime = vessels.reduce((acc, v) => acc + (v.atBerthDays || 0), 0);

      return {
        calls,
        avgVolume: calls > 0 ? totalVolume / calls : 0,
        avgBerthTime: calls > 0 ? totalBerthTime / calls : 0,
        avgProductivity: totalBerthTime > 0 ? totalVolume / totalBerthTime : 0
      };
    };

    return {
      foreign: calcStats('Foreign'),
      domestic: calcStats('Domestic'),
      grandTotal: calcStats('ALL')
    };
  }, [filteredData]);

  const formatNum = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const formatDec = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatInt = (num: number) => num.toLocaleString();

  // Custom 3D Vertical Bar
  const Vertical3DBar = (props: any) => {
    const { x, y, width, height, fill } = props;
    if (height === 0) return null;
    const depth = width * 0.2;
    return (
      <g>
        {/* Top face */}
        <path
          d={`M ${x},${y} L ${x + depth},${y - depth} L ${x + width + depth},${y - depth} L ${x + width},${y} Z`}
          fill={fill}
          style={{ filter: 'brightness(1.1)' }}
        />
        {/* Side face */}
        <path
          d={`M ${x + width},${y} L ${x + width + depth},${y - depth} L ${x + width + depth},${y + height - depth} L ${x + width},${y + height} Z`}
          fill={fill}
          style={{ filter: 'brightness(0.8)' }}
        />
        {/* Front face */}
        <rect x={x} y={y} width={width} height={height} fill={fill} />
      </g>
    );
  };

  // Custom 3D Horizontal Bar
  const Horizontal3DBar = (props: any) => {
    const { x, y, width, height, fill } = props;
    if (width === 0) return null;
    const depth = height * 0.3;
    return (
      <g>
        {/* Top side face */}
        <path
          d={`M ${x},${y} L ${x + depth},${y - depth} L ${x + width + depth},${y - depth} L ${x + width},${y} Z`}
          fill={fill}
          style={{ filter: 'brightness(1.1)' }}
        />
        {/* Right side face */}
        <path
          d={`M ${x + width},${y} L ${x + width + depth},${y - depth} L ${x + width + depth},${y + height - depth} L ${x + width},${y + height} Z`}
          fill={fill}
          style={{ filter: 'brightness(0.8)' }}
        />
        {/* Front face */}
        <rect x={x} y={y} width={width} height={height} fill={fill} />
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-extrabold text-fab-blue uppercase tracking-tight">System Performance Stats</h2>
        
        <div className="flex flex-wrap items-center bg-white border border-slate-200 rounded-lg p-1 gap-1 shadow-sm">
          <div className="flex items-center gap-1 border-r border-slate-100 pr-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Orientation:</span>
            <select 
              value={orientationFilter}
              onChange={(e) => setOrientationFilter(e.target.value)}
              className="text-[10px] font-bold border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1 text-fab-blue"
            >
              <option value="ALL">ALL VOYAGES</option>
              <option value="DOMESTIC">DOMESTIC</option>
              <option value="FOREIGN">FOREIGN</option>
            </select>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Period:</span>
          <select 
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="text-[10px] font-bold border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1 text-slate-600"
          >
            {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
          </select>
          <span className="text-[10px] font-bold text-slate-300">—</span>
          <select 
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="text-[10px] font-bold border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1 text-slate-600"
          >
            {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
          </select>
        </div>
      </div>

      {/* Main Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-fab-blue text-white px-4 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider">Comparative Vessel Traffic Report</h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-fab-red animate-pulse" />
            <span className="text-[10px] font-bold text-fab-red animate-pulse">LIVE MONITORING</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <th className="p-4 border-r border-slate-100 w-64">Vessel Category / Service</th>
                <th className="p-4 border-r border-slate-100 text-center">Calls</th>
                <th className="p-4 border-r border-slate-100 text-center">Gross Tonnage</th>
                <th className="p-4 border-r border-slate-100 text-center">Passengers</th>
                <th className="p-4 text-center">Cargo (MT)</th>
              </tr>
            </thead>
            <tbody className="text-[11px] uppercase">
              {/* Foreign Section */}
              <tr className="bg-slate-50/50 font-extrabold border-b border-slate-100 text-fab-blue cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleRowClick('All Foreign Vessels', v => v.orientation === 'Foreign')}
              >
                <td className="p-3 border-r border-slate-100 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Foreign Vessels
                </td>
                <td colSpan={4}></td>
              </tr>
              {Object.entries(vesselTrafficSummary.Foreign)
                .filter(([_, stats]: [string, TrafficStats]) => stats.calls > 0)
                .map(([cat, stats]: [string, TrafficStats]) => (
                <tr 
                  key={`f-${cat}`} 
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(`Foreign - ${cat}`, v => {
                      if (v.orientation !== 'Foreign') return false;
                      const t = v.vesselType.toLowerCase();
                      let c = 'Others';
                      if (t.includes('passenger') || t.includes('roro')) c = 'Passenger';
                      else if (t.includes('cargo') || t.includes('container') || t.includes('bulk')) c = 'Cargo';
                      else if (t.includes('tanker')) c = 'Tanker';
                      return c === cat;
                    });
                  }}
                >
                  <td className="p-3 pl-8 border-r border-slate-100 text-slate-500 font-medium group-hover:text-fab-blue transition-colors">
                    {cat}
                  </td>
                  <td className="p-3 border-r border-slate-100 text-center font-bold text-fab-blue">{formatInt(stats.calls)}</td>
                  <td className="p-3 border-r border-slate-100 text-center text-slate-600">{formatInt(Math.round(stats.gt))}</td>
                  <td className="p-3 border-r border-slate-100 text-center text-slate-600">{formatInt(stats.pax)}</td>
                  <td className="p-3 text-center text-slate-600 font-bold">{formatInt(Math.round(stats.cargo))}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-b-2 border-fab-blue/20">
                <td className="p-3 border-r border-slate-100 pl-4 italic text-fab-blue">Foreign Sub-Total</td>
                <td className="p-3 border-r border-slate-100 text-center text-fab-blue">
                  {formatInt((Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0))}
                </td>
                <td className="p-3 border-r border-slate-100 text-center">
                  {formatInt(Math.round((Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.gt, 0)))}
                </td>
                <td className="p-3 border-r border-slate-100 text-center">
                  {formatInt((Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.pax, 0))}
                </td>
                <td className="p-3 text-center text-fab-blue">
                  {formatInt(Math.round((Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.cargo, 0)))}
                </td>
              </tr>

              {/* Domestic Section */}
              <tr className="bg-slate-50/50 font-extrabold border-b border-slate-100 mt-4 text-fab-cyan cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleRowClick('All Domestic Vessels', v => v.orientation === 'Domestic')}
              >
                <td className="p-3 border-r border-slate-100 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Domestic Vessels
                </td>
                <td colSpan={4}></td>
              </tr>
              {Object.entries(vesselTrafficSummary.Domestic)
                .filter(([_, stats]: [string, TrafficStats]) => stats.calls > 0)
                .map(([cat, stats]: [string, TrafficStats]) => (
                <tr 
                  key={`d-${cat}`} 
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(`Domestic - ${cat}`, v => {
                      if (v.orientation !== 'Domestic') return false;
                      const t = v.vesselType.toLowerCase();
                      let c = 'Others';
                      if (t.includes('passenger') || t.includes('roro')) c = 'Passenger';
                      else if (t.includes('cargo') || t.includes('container') || t.includes('bulk')) c = 'Cargo';
                      else if (t.includes('tanker')) c = 'Tanker';
                      return c === cat;
                    });
                  }}
                >
                  <td className="p-3 pl-8 border-r border-slate-100 text-slate-500 font-medium group-hover:text-fab-cyan transition-colors">
                    {cat}
                  </td>
                  <td className="p-3 border-r border-slate-100 text-center font-bold text-fab-blue">{formatInt(stats.calls)}</td>
                  <td className="p-3 border-r border-slate-100 text-center text-slate-600">{formatInt(Math.round(stats.gt))}</td>
                  <td className="p-3 border-r border-slate-100 text-center text-slate-600">{formatInt(stats.pax)}</td>
                  <td className="p-3 text-center text-slate-600 font-bold">{formatInt(Math.round(stats.cargo))}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-b-2 border-fab-blue/20">
                <td className="p-3 border-r border-slate-100 pl-4 italic text-fab-cyan">Domestic Sub-Total</td>
                <td className="p-3 border-r border-slate-100 text-center text-fab-blue">
                  {formatInt((Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0))}
                </td>
                <td className="p-3 border-r border-slate-100 text-center">
                  {formatInt(Math.round((Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.gt, 0)))}
                </td>
                <td className="p-3 border-r border-slate-100 text-center">
                  {formatInt((Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.pax, 0))}
                </td>
                <td className="p-3 text-center text-fab-blue">
                  {formatInt(Math.round((Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.cargo, 0)))}
                </td>
              </tr>

              {/* Grand Total */}
              <tr className="bg-fab-blue text-white font-black uppercase tracking-wider text-xs shadow-inner">
                <td className="p-4 border-r border-white/10">Grand Aggregate Total</td>
                <td className="p-4 border-r border-white/10 text-center text-fab-gold font-bold">
                  {formatInt(
                    (Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0) +
                    (Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0)
                  )}
                </td>
                <td className="p-4 border-r border-white/10 text-center grayscale brightness-200 opacity-60">
                   {formatInt(Math.round(
                      (Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.gt, 0) +
                      (Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.gt, 0)
                   ))}
                </td>
                <td className="p-4 border-r border-white/10 text-center grayscale brightness-200 opacity-60">
                   {formatInt(
                      (Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.pax, 0) +
                      (Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.pax, 0)
                   )}
                </td>
                <td className="p-4 text-center text-fab-cyan font-bold">
                   {formatInt(Math.round(
                      (Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.cargo, 0) +
                      (Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.cargo, 0)
                   ))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly Vessel Traffic Breakdown</h3>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Volume Per Orientation</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[9px] font-bold uppercase border-b border-slate-100 text-slate-400">
                <th className="p-4 border-r border-slate-100 text-left w-32 tracking-wider">Orientation</th>
                {vesselCountsByMonth.map(m => (
                  <th key={m.month} className="p-4 border-r border-slate-100">{m.month}</th>
                ))}
                <th className="p-4 bg-fab-blue/5 text-fab-blue">TOTAL</th>
              </tr>
            </thead>
            <tbody className="text-[10px] uppercase font-medium">
              <tr 
                className="border-b border-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                onClick={() => handleRowClick('All Domestic Vessels', v => v.orientation === 'Domestic')}
              >
                <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500 bg-slate-50/30 group-hover:bg-slate-100 transition-colors">Domestic Vessels</td>
                {vesselCountsByMonth.map((m, i) => (
                  <td key={i} className="p-4 border-r border-slate-100 text-slate-600">{m.domestic || '-'}</td>
                ))}
                <td className="p-4 font-extrabold bg-slate-50 text-fab-cyan">
                  {vesselCountsByMonth.reduce((acc, m) => acc + m.domestic, 0)}
                </td>
              </tr>
              <tr 
                className="border-b border-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                onClick={() => handleRowClick('All Foreign Vessels', v => v.orientation === 'Foreign')}
              >
                <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500 bg-slate-50/30 group-hover:bg-slate-100 transition-colors">Foreign Vessels</td>
                {vesselCountsByMonth.map((m, i) => (
                  <td key={i} className="p-4 border-r border-slate-100 text-slate-600">{m.foreign || '-'}</td>
                ))}
                <td className="p-4 font-extrabold bg-slate-50 text-fab-blue">
                  {vesselCountsByMonth.reduce((acc, m) => acc + m.foreign, 0)}
                </td>
              </tr>
              <tr className="bg-fab-blue text-white font-black">
                <td className="p-4 border-r border-white/10 text-left">Aggregate Monthly Calls</td>
                {vesselCountsByMonth.map((m, i) => (
                  <td key={i} className="p-4 border-r border-white/10">{m.total || '-'}</td>
                ))}
                <td className="p-4 text-fab-gold font-black shadow-inner">
                  {vesselCountsByMonth.reduce((acc, m) => acc + m.total, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Purpose of Call Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domestic Purpose Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-fab-cyan text-white px-4 py-3 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Domestic purpose of call
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-bold uppercase border-b border-slate-100 text-slate-400">
                  <th className="p-4 border-r border-slate-100 text-left">Purpose</th>
                  <th className="p-4 border-r border-slate-100">Transactions</th>
                  <th className="p-4 text-right pr-6">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] uppercase font-medium">
                {domesticPurposeStats.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(`Domestic Purpose: ${item.name}`, v => v.orientation === 'Domestic' && (v.purpose || 'NOT STATED') === item.name)}
                  >
                    <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500">{item.name}</td>
                    <td className="p-4 border-r border-slate-100 text-slate-600">{formatInt(item.count)}</td>
                    <td className="p-4 text-right pr-6 font-bold text-fab-cyan bg-fab-cyan/5">
                      {item.percentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {domesticPurposeStats.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No domestic records</td></tr>
                )}
                <tr className="bg-slate-100 font-extrabold text-fab-blue">
                  <td className="p-4 border-r border-slate-100 text-left">TOTAL DOMESTIC</td>
                  <td className="p-4 border-r border-slate-100">
                    {formatInt(domesticPurposeStats.reduce((acc, i) => acc + i.count, 0))}
                  </td>
                  <td className="p-4 text-right pr-6">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Foreign Purpose Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-fab-blue text-white px-4 py-3 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> Foreign purpose of call
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-bold uppercase border-b border-slate-100 text-slate-400">
                  <th className="p-4 border-r border-slate-100 text-left">Purpose</th>
                  <th className="p-4 border-r border-slate-100">Transactions</th>
                  <th className="p-4 text-right pr-6">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] uppercase font-medium">
                {foreignPurposeStats.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(`Foreign Purpose: ${item.name}`, v => v.orientation === 'Foreign' && (v.purpose || 'NOT STATED') === item.name)}
                  >
                    <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500">{item.name}</td>
                    <td className="p-4 border-r border-slate-100 text-slate-600">{formatInt(item.count)}</td>
                    <td className="p-4 text-right pr-6 font-bold text-fab-gold bg-fab-gold/5">
                      {item.percentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {foreignPurposeStats.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No foreign records</td></tr>
                )}
                <tr className="bg-slate-100 font-extrabold text-fab-blue">
                  <td className="p-4 border-r border-slate-100 text-left">TOTAL FOREIGN</td>
                  <td className="p-4 border-r border-slate-100">
                    {formatInt(foreignPurposeStats.reduce((acc, i) => acc + i.count, 0))}
                  </td>
                  <td className="p-4 text-right pr-6">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cargo Mix Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domestic Cargo Mix Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-fab-cyan text-white px-4 py-3 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-3.5 h-3.5" /> Domestic Cargo Mix
            </h3>
            <span className="text-[10px] font-medium opacity-80">METRIC TONS (MT)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-bold uppercase border-b border-slate-100 text-slate-400">
                  <th className="p-4 border-r border-slate-100 text-left">Shipment Kind</th>
                  <th className="p-4 border-r border-slate-100">Weight (MT)</th>
                  <th className="p-4 text-right pr-6">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] uppercase font-medium">
                {domesticCargoMixStats.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(`Domestic Cargo: ${item.name}`, v => v.orientation === 'Domestic' && (v.shipmentKind || 'OTHERS') === item.name)}
                  >
                    <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500">{item.name}</td>
                    <td className="p-4 border-r border-slate-100 text-slate-600">{formatInt(Math.round(item.weight))}</td>
                    <td className="p-4 text-right pr-6 font-bold text-fab-cyan bg-fab-cyan/5">
                      {item.percentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {domesticCargoMixStats.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No domestic cargo records</td></tr>
                )}
                <tr className="bg-slate-100 font-extrabold text-fab-blue">
                  <td className="p-4 border-r border-slate-100 text-left">CARGO SUB-TOTAL</td>
                  <td className="p-4 border-r border-slate-100">
                    {formatInt(Math.round(domesticCargoMixStats.reduce((acc, i) => acc + i.weight, 0)))}
                  </td>
                  <td className="p-4 text-right pr-6">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Foreign Cargo Mix Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-fab-blue text-white px-4 py-3 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-3.5 h-3.5" /> Foreign Cargo Mix
            </h3>
            <span className="text-[10px] font-medium opacity-80">METRIC TONS (MT)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-bold uppercase border-b border-slate-100 text-slate-400">
                  <th className="p-4 border-r border-slate-100 text-left">Shipment Kind</th>
                  <th className="p-4 border-r border-slate-100">Weight (MT)</th>
                  <th className="p-4 text-right pr-6">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] uppercase font-medium">
                {foreignCargoMixStats.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(`Foreign Cargo: ${item.name}`, v => v.orientation === 'Foreign' && (v.shipmentKind || 'OTHERS') === item.name)}
                  >
                    <td className="p-4 border-r border-slate-100 text-left font-bold text-slate-500">{item.name}</td>
                    <td className="p-4 border-r border-slate-100 text-slate-600">{formatInt(Math.round(item.weight))}</td>
                    <td className="p-4 text-right pr-6 font-bold text-fab-gold bg-fab-gold/5">
                      {item.percentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {foreignCargoMixStats.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No foreign cargo records</td></tr>
                )}
                <tr className="bg-slate-100 font-extrabold text-fab-blue">
                  <td className="p-4 border-r border-slate-100 text-left">CARGO SUB-TOTAL</td>
                  <td className="p-4 border-r border-slate-100">
                    {formatInt(Math.round(foreignCargoMixStats.reduce((acc, i) => acc + i.weight, 0)))}
                  </td>
                  <td className="p-4 text-right pr-6">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Cargo Description Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-fab-blue text-white px-4 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider">Detailed Cargo Classification by Voyage Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase border-b border-slate-200 text-slate-500">
                <th className="p-4 border-r border-slate-100 text-left w-1/4">Voyage Type</th>
                <th className="p-4 border-r border-slate-100 text-left w-1/2">Cargo Description</th>
                <th className="p-4 border-r border-slate-100 w-32">Metric Tons (MT)</th>
                <th className="p-4 w-32">Percentage</th>
              </tr>
            </thead>
            <tbody className="text-[10px] uppercase font-medium">
              {/* DOMESTIC SECTION */}
              <tr 
                className={cn("border-b border-slate-50", cargoVarietyStats.domestic.items.length > 0 && "hover:bg-slate-50 transition-colors cursor-pointer")}
                onClick={() => {
                  if (cargoVarietyStats.domestic.items.length > 0) {
                    const item = cargoVarietyStats.domestic.items[0];
                    handleRowClick(`Domestic Cargo Desc: ${item.name}`, v => v.orientation === 'Domestic' && (v.cargoDescription || 'NOT STATED') === item.name);
                  }
                }}
              >
                <td rowSpan={cargoVarietyStats.domestic.items.length + (cargoVarietyStats.domestic.items.length > 0 ? 1 : 2)} className="p-4 border-r border-slate-100 text-left font-bold text-fab-cyan align-top bg-fab-cyan/[0.02] pt-6">
                  DOMESTIC REVENUE
                </td>
                {cargoVarietyStats.domestic.items.length === 0 ? (
                  <>
                    <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-400 italic">No historical records</td>
                    <td className="p-3 border-r border-slate-100 text-right pr-6 text-slate-400">0.000</td>
                    <td className="p-3 text-right pr-6 text-slate-400">0.00%</td>
                  </>
                ) : (
                  <>
                    <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-500">{cargoVarietyStats.domestic.items[0].name}</td>
                    <td className="p-3 border-r border-slate-100 text-right pr-6 font-mono text-slate-600">{formatNum(cargoVarietyStats.domestic.items[0].weight)}</td>
                    <td className="p-3 text-right pr-6 text-fab-cyan font-bold">{cargoVarietyStats.domestic.items[0].percentage.toFixed(2)}%</td>
                  </>
                )}
              </tr>
              {cargoVarietyStats.domestic.items.slice(1).map((item, idx) => (
                <tr 
                  key={`dom-${idx}`} 
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(`Domestic Cargo Desc: ${item.name}`, v => v.orientation === 'Domestic' && (v.cargoDescription || 'NOT STATED') === item.name)}
                >
                  <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-500">{item.name}</td>
                  <td className="p-3 border-r border-slate-100 text-right pr-6 font-mono text-slate-600">{formatNum(item.weight)}</td>
                  <td className="p-3 text-right pr-6 text-fab-cyan font-bold">{item.percentage.toFixed(2)}%</td>
                </tr>
              ))}
              <tr className="bg-slate-100/50 font-black border-b-2 border-fab-cyan/20">
                <td className="p-3 border-r border-slate-100 text-left pl-6 italic text-fab-cyan">DOMAIN TOTAL</td>
                <td className="p-3 border-r border-slate-100 text-right pr-6 text-fab-blue">{formatNum(cargoVarietyStats.domestic.subTotalWeight)}</td>
                <td className="p-3 text-right pr-6 text-fab-blue">{cargoVarietyStats.domestic.subTotalPercentage.toFixed(2)}%</td>
              </tr>

              {/* FOREIGN SECTION */}
              <tr 
                className={cn("border-b border-slate-50", cargoVarietyStats.foreign.items.length > 0 && "hover:bg-slate-50 transition-colors cursor-pointer")}
                onClick={() => {
                  if (cargoVarietyStats.foreign.items.length > 0) {
                    const item = cargoVarietyStats.foreign.items[0];
                    handleRowClick(`Foreign Cargo Desc: ${item.name}`, v => v.orientation === 'Foreign' && (v.cargoDescription || 'NOT STATED') === item.name);
                  }
                }}
              >
                <td rowSpan={cargoVarietyStats.foreign.items.length + (cargoVarietyStats.foreign.items.length > 0 ? 1 : 2)} className="p-4 border-r border-slate-100 text-left font-bold text-fab-blue align-top bg-fab-blue/[0.02] pt-6">
                  FOREIGN COMMERCE
                </td>
                {cargoVarietyStats.foreign.items.length === 0 ? (
                  <>
                    <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-400 italic">No historical records</td>
                    <td className="p-3 border-r border-slate-100 text-right pr-6 text-slate-400">0.000</td>
                    <td className="p-3 text-right pr-6 text-slate-400">0.00%</td>
                  </>
                ) : (
                  <>
                    <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-500">{cargoVarietyStats.foreign.items[0].name}</td>
                    <td className="p-3 border-r border-slate-100 text-right pr-6 font-mono text-slate-600">{formatNum(cargoVarietyStats.foreign.items[0].weight)}</td>
                    <td className="p-3 text-right pr-6 text-fab-gold font-bold">{cargoVarietyStats.foreign.items[0].percentage.toFixed(2)}%</td>
                  </>
                )}
              </tr>
              {cargoVarietyStats.foreign.items.slice(1).map((item, idx) => (
                <tr 
                  key={`for-${idx}`} 
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(`Foreign Cargo Desc: ${item.name}`, v => v.orientation === 'Foreign' && (v.cargoDescription || 'NOT STATED') === item.name)}
                >
                  <td className="p-3 border-r border-slate-100 text-left pl-6 text-slate-500">{item.name}</td>
                  <td className="p-3 border-r border-slate-100 text-right pr-6 font-mono text-slate-600">{formatNum(item.weight)}</td>
                  <td className="p-3 text-right pr-6 text-fab-gold font-bold">{item.percentage.toFixed(2)}%</td>
                </tr>
              ))}
              <tr className="bg-slate-100/50 font-black border-b-2 border-fab-blue/20">
                <td className="p-3 border-r border-slate-100 text-left pl-6 italic text-fab-blue">COMMERCE TOTAL</td>
                <td className="p-3 border-r border-slate-100 text-right pr-6 text-fab-gold">{formatNum(cargoVarietyStats.foreign.subTotalWeight)}</td>
                <td className="p-3 text-right pr-6 text-fab-gold">{cargoVarietyStats.foreign.subTotalPercentage.toFixed(2)}%</td>
              </tr>

              {/* GRAND TOTAL */}
              <tr className="bg-fab-blue text-white font-black uppercase tracking-wider text-[11px] shadow-inner">
                <td className="p-4 border-r border-white/10 text-left" colSpan={2}>Aggregate Global Cargo Volume</td>
                <td className="p-4 border-r border-white/10 text-right pr-6 text-fab-gold font-bold">{formatNum(cargoVarietyStats.grandTotalWeight)}</td>
                <td className="p-4 text-right pr-6">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Berth Stay Time and Terminal Productivity */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Berth Stay Time & Terminal Productivity Indices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold uppercase border-b border-slate-200 text-slate-500">
                <th className="p-4 border-r border-slate-100 text-left w-1/4">Voyage Category</th>
                <th className="p-4 border-r border-slate-100 w-32">Vessel Calls</th>
                <th className="p-4 border-r border-slate-100 w-48">Average Volume (MT)</th>
                <th className="p-4 border-r border-slate-100 w-48">Avg Berth Stay (Days)</th>
                <th className="p-4 w-64">Avg Productivity (MT/Day)</th>
              </tr>
            </thead>
            <tbody className="text-[11px] uppercase font-medium">
              <tr 
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => handleRowClick('Foreign Commercial Calls', v => v.orientation === 'Foreign' && v.status?.toUpperCase() === 'DEPARTED')}
              >
                <td className="p-4 border-r border-slate-100 text-left font-bold text-fab-blue bg-fab-blue/5">FOREIGN COMMERCIAL</td>
                <td className="p-4 border-r border-slate-100 text-slate-600 font-bold">{formatInt(productivityStats.foreign.calls)}</td>
                <td className="p-4 border-r border-slate-100 text-slate-500">{formatDec(productivityStats.foreign.avgVolume)}</td>
                <td className="p-4 border-r border-slate-100 text-slate-500">{formatDec(productivityStats.foreign.avgBerthTime)}</td>
                <td className="p-4 font-extrabold text-fab-blue">{formatDec(productivityStats.foreign.avgProductivity)}</td>
              </tr>
              <tr 
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => handleRowClick('Domestic Commercial Calls', v => v.orientation === 'Domestic' && v.status?.toUpperCase() === 'DEPARTED')}
              >
                <td className="p-4 border-r border-slate-100 text-left font-bold text-fab-cyan bg-fab-cyan/5">DOMESTIC COVETED</td>
                <td className="p-4 border-r border-slate-100 text-slate-600 font-bold">{formatInt(productivityStats.domestic.calls)}</td>
                <td className="p-4 border-r border-slate-100 text-slate-500">{formatDec(productivityStats.domestic.avgVolume)}</td>
                <td className="p-4 border-r border-slate-100 text-slate-500">{formatDec(productivityStats.domestic.avgBerthTime)}</td>
                <td className="p-4 font-extrabold text-fab-cyan">{formatDec(productivityStats.domestic.avgProductivity)}</td>
              </tr>
              <tr className="bg-fab-blue text-white font-black uppercase tracking-wider text-[11px] shadow-inner">
                <td className="p-4 border-r border-white/10 text-left">Systems Aggregate Performance</td>
                <td className="p-4 border-r border-white/10">{formatInt(productivityStats.grandTotal.calls)}</td>
                <td className="p-4 border-r border-white/10">{formatDec(productivityStats.grandTotal.avgVolume)}</td>
                <td className="p-4 border-r border-white/10">{formatDec(productivityStats.grandTotal.avgBerthTime)}</td>
                <td className="p-4 text-fab-gold font-bold">{formatDec(productivityStats.grandTotal.avgProductivity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-fab-blue">
              <TrendingUp className="w-4 h-4" /> Vessel Activity Trend
            </h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} />
                <YAxis tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{backgroundColor: '#003366', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '10px', fontWeight: 'bold'}}
                  itemStyle={{color: '#ed1c24'}}
                />
                <Bar dataKey="calls" fill="#003366" name="Vessel Calls" shape={<Vertical3DBar />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Terminal Rankings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-fab-cyan">
              <Anchor className="w-4 h-4" /> Terminal Efficiency
            </h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terminalStats.slice(0, 5)} layout="vertical" margin={{ left: 20, top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9, fontWeight: 600, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{backgroundColor: '#008b8b', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '10px', fontWeight: 'bold'}}
                />
                <Bar dataKey="calls" fill="#008b8b" name="Total Calls" shape={<Horizontal3DBar />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard 
          label="Orientation Split" 
          v1={formatNum((Object.values(vesselTrafficSummary.Foreign) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0))}
          l1="Foreign"
          v2={formatNum((Object.values(vesselTrafficSummary.Domestic) as TrafficStats[]).reduce((acc, s) => acc + s.calls, 0))}
          l2="Domestic"
          icon={Globe}
          onClick={() => handleRowClick('Foreign vs Domestic Split', v => true)}
        />
        <InsightCard 
          label="Top Cargo Type" 
          v1={(() => {
            const grouped = filteredData.reduce((acc, v) => ({...acc, [v.cargoDescription]: (acc[v.cargoDescription] || 0) + v.cargoVolumeMT}), {} as Record<string, number>);
            const entries = Object.entries(grouped).sort((a: [string, number], b: [string, number]) => b[1]-a[1]);
            return entries[0]?.[0]?.substring(0,20) || 'N/A';
          })()}
          l1="Mostly Handled"
          v2={(() => {
            const grouped = filteredData.reduce((acc, v) => ({...acc, [v.cargoDescription]: (acc[v.cargoDescription] || 0) + v.cargoVolumeMT}), {} as Record<string, number>);
            const values = (Object.values(grouped) as number[]).sort((a,b) => b-a);
            return formatNum(Math.round(values[0] || 0));
          })()}
          l2="Total Tonnage (MT)"
          icon={Scale}
        />
        <InsightCard 
          label="Passenger Stats" 
          v1={formatNum(filteredData.reduce((acc, v) => acc + v.passengers, 0))}
          l1="Total Foot Traffic"
          v2={(filteredData.reduce((acc, v) => acc + v.passengers, 0) / (filteredData.length || 1)).toFixed(1)}
          l2="Avg Per Vessel"
          icon={Users}
        />
        <InsightCard 
          label="Peak Period" 
          v1={(() => {
            const sorted = [...monthlyTrend].sort((a,b) => b.calls - a.calls);
            return sorted[0]?.month || 'N/A';
          })()}
          l1="Highest Activity"
          v2={(() => {
            const sorted = [...monthlyTrend].sort((a,b) => b.calls - a.calls);
            return formatNum(sorted[0]?.calls || 0);
          })()}
          l2="Vessel Arrivals"
          icon={Calendar}
        />
      </div>

      {/* Vessel List Drawer */}
      <AnimatePresence>
        {selectedCategoryVessels && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCategoryVessels(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-4xl bg-slate-50 border-l-2 border-fab-blue z-[95] overflow-y-auto flex flex-col"
            >
              <div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10 flex justify-between items-center shadow-sm">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-fab-blue uppercase">{selectedCategoryVessels.title}</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedCategoryVessels.vessels.length} VESSELS MATCHING CRITERIA</p>
                </div>
                <button 
                  onClick={() => setSelectedCategoryVessels(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-fab-blue transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-x-auto flex-1">
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden min-h-[300px]">
                   <table className="w-full text-left font-sans border-collapse">
                     <thead className="bg-fab-blue text-white shadow-sm">
                       <tr>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">ID</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Vessel Name</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Type</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Terminal</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Cargo (MT)</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Status</th>
                         <th className="p-4 text-[10px] font-bold uppercase tracking-wider">Arrival</th>
                       </tr>
                     </thead>
                     <tbody className="text-[11px] uppercase">
                       {selectedCategoryVessels.vessels.length === 0 ? (
                         <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 italic">No vessels found for this selection.</td>
                         </tr>
                       ) : selectedCategoryVessels.vessels.map((v, i) => (
                         <tr 
                           key={`${v.controlNo}-${i}`} 
                           className={cn("border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors", i % 2 === 0 ? "bg-white" : "bg-slate-50/30")}
                           onClick={() => {
                             if (onVesselSelect) onVesselSelect(v);
                           }}
                         >
                           <td className="p-4 font-mono border-r border-slate-100 text-slate-400">{v.controlNo}</td>
                           <td className="p-4 font-bold border-r border-slate-100 text-fab-blue">{v.vesselName}</td>
                           <td className="p-4 border-r border-slate-100 text-slate-600 font-medium">{v.vesselType}</td>
                           <td className="p-4 border-r border-slate-100 text-slate-500 italic">{v.terminal}</td>
                           <td className="p-4 border-r border-slate-100 text-right font-mono text-slate-600">{v.cargoVolumeMT ? Math.round(v.cargoVolumeMT).toLocaleString() : '-'}</td>
                           <td className="p-4 border-r border-slate-100">
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                               v.status.toLowerCase().includes('departed') ? "bg-green-50 text-green-600 border-green-200" : "bg-fab-gold/10 text-fab-gold border-fab-gold/30"
                             )}>
                               {v.status}
                             </span>
                           </td>
                           <td className="p-4 text-slate-400 font-mono italic">{v.arrivalDate}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

function InsightCard({ label, v1, l1, v2, l2, icon: Icon, onClick }: { label: string, v1: string, l1: string, v2: string, l2: string, icon: any, onClick?: () => void }) {
  const isSpecial = label.includes('Split') || label.includes('Peak');
  return (
    <div 
      className={cn(
        "bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1",
        isSpecial ? "border-l-4 border-l-fab-red" : "border-l-4 border-l-fab-blue",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <Icon className={cn("w-4 h-4", isSpecial ? "text-fab-gold" : "text-fab-blue")} />
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-black text-slate-800 tracking-tight leading-none">{v1}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{l1}</p>
        </div>
        <div className="pt-3 border-t border-slate-100 flex justify-between items-end">
          <div>
            <p className="text-sm font-extrabold text-slate-600 tracking-tight">{v2}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase">{l2}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
