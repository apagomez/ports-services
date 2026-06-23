
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import { PaymentDashboardData } from '../types';
import { Landmark, TrendingUp, Anchor, Ship, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaymentDashboardProps {
  data: PaymentDashboardData;
}

// Official Freeport Area of Bataan (FAB) & Port Regulations navigation/regulatory signaling colors:
const COLORS = ['#004a99', '#10b981', '#fdb913', '#ed1c24', '#00aeef', '#f97316', '#6366f1'];

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ data }) => {
  const [revenueFilter, setRevenueFilter] = React.useState<'All' | 'Foreign' | 'Domestic'>('All');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'vmf' | 'tugboat' | 'ancillary'>('overview');
  const [selectedServiceType, setSelectedServiceType] = React.useState<string | null>(null);
  
  const months = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);

  const [startMonth, setStartMonth] = React.useState<string>(months[0]);
  const [endMonth, setEndMonth] = React.useState<string>(months[months.length - 1]);

  const monthToIndex = (month: string) => months.indexOf(month.toUpperCase());

  const filteredRevenue = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const revenue = data.monthlyRevenue
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .map(m => {
        let vessel = m.foreignVessel + m.domesticVessel;
        let cargo = m.foreignCargo + m.domesticCargo;
        let total = m.total;

        if (revenueFilter === 'Foreign') {
          vessel = m.foreignVessel;
          cargo = m.foreignCargo;
          total = vessel + cargo;
        } else if (revenueFilter === 'Domestic') {
          vessel = m.domesticVessel;
          cargo = m.domesticCargo;
          total = vessel + cargo;
        }

        return {
          ...m,
          vessel,
          cargo,
          total: vessel + cargo
        };
      });

    return revenue;
  }, [data.monthlyRevenue, revenueFilter, startMonth, endMonth, months]);

  const filteredFees = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.feeBreakdown
      .filter(f => {
        const idx = monthToIndex(f.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .map(f => {
        if (revenueFilter === 'All') return { ...f, total: f.portDues + f.dockage + f.anchorage + f.pilotage + f.usageFee + f.wharfage };
        const ratio = f.total > 0 ? (revenueFilter === 'Foreign' ? (f.foreignTotal / f.total) : (f.domesticTotal / f.total)) : 0;
        return {
          ...f,
          portDues: f.portDues * (revenueFilter === 'Foreign' ? 1 : 0),
          usageFee: f.usageFee * (revenueFilter === 'Domestic' ? 1 : 0),
          dockage: f.dockage * (revenueFilter === 'Foreign' ? 1 : 0),
          anchorage: f.anchorage * ratio,
          pilotage: f.pilotage * ratio,
          wharfage: f.wharfage * ratio,
          total: revenueFilter === 'Foreign' ? f.foreignTotal : f.domesticTotal
        };
      });
  }, [data.feeBreakdown, revenueFilter, startMonth, endMonth, months]);

  const ancillaryStats = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const filtered = data.ancillaryRecords.filter(r => {
      const idx = monthToIndex(r.monthApplied);
      return (idx >= startIndex && idx <= endIndex) || r.monthApplied === 'UNKNOWN';
    });

    const byType: Record<string, number> = {};
    const byTerminal: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    filtered.forEach(r => {
      const type = r.serviceType || 'Other';
      const term = r.terminal || 'Unknown';
      const prov = r.provider || 'Individual/Other';
      byType[type] = (byType[type] || 0) + r.total;
      byTerminal[term] = (byTerminal[term] || 0) + r.total;
      byProvider[prov] = (byProvider[prov] || 0) + r.total;
    });

    return {
      byType: Object.entries(byType).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      byTerminal: Object.entries(byTerminal).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      byProvider: Object.entries(byProvider).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
      totalFiltered: filtered.reduce((acc, curr) => acc + curr.total, 0),
      count: filtered.length
    };
  }, [data.ancillaryRecords, startMonth, endMonth, months, monthToIndex]);

  const filteredAncillaryRecordsByType = useMemo(() => {
    if (!selectedServiceType) return [];
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.ancillaryRecords.filter(r => {
      const idx = monthToIndex(r.monthApplied);
      const isWithinMonths = (idx >= startIndex && idx <= endIndex) || r.monthApplied === 'UNKNOWN';
      return isWithinMonths && (r.serviceType || 'Other') === selectedServiceType;
    });
  }, [data.ancillaryRecords, selectedServiceType, startMonth, endMonth, monthToIndex]);

  const vmfFiltered = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.vmfMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);
  }, [data.vmfMonthly, startMonth, endMonth, monthToIndex]);

  const tugboatFiltered = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.tugboatMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);
  }, [data.tugboatMonthly, startMonth, endMonth, monthToIndex]);

  const vesselCargoTotal = useMemo(() => {
    return filteredRevenue.reduce((acc, curr) => acc + curr.total, 0);
  }, [filteredRevenue]);

  const ancillaryFiltered = useMemo(() => {
    return ancillaryStats.totalFiltered;
  }, [ancillaryStats.totalFiltered]);

  const grandConsolidatedTotal = useMemo(() => {
    return vesselCargoTotal + vmfFiltered + tugboatFiltered + ancillaryFiltered;
  }, [vesselCargoTotal, vmfFiltered, tugboatFiltered, ancillaryFiltered]);

  const vmfFilteredList = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return data.vmfMonthly.filter(m => {
      const idx = monthToIndex(m.month);
      return idx >= startIndex && idx <= endIndex;
    });
  }, [data.vmfMonthly, startMonth, endMonth, monthToIndex]);

  const tugboatFilteredList = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return data.tugboatMonthly.filter(m => {
      const idx = monthToIndex(m.month);
      return idx >= startIndex && idx <= endIndex;
    });
  }, [data.tugboatMonthly, startMonth, endMonth, monthToIndex]);

  const monthsInSelection = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return Math.max(1, endIndex - startIndex + 1);
  }, [startMonth, endMonth, monthToIndex]);

  const stats = useMemo(() => {
    return [
      { id: 'overview', label: `${revenueFilter === 'All' ? 'Total' : revenueFilter} Vessel & Cargo`, value: vesselCargoTotal, icon: Landmark, color: 'text-fab-blue', bg: 'bg-fab-blue/10', hoverBg: 'hover:bg-fab-blue/5' },
      { id: 'vmf', label: 'VMF Total', value: vmfFiltered, icon: Anchor, color: 'text-fab-green', bg: 'bg-fab-green/10', hoverBg: 'hover:bg-fab-green/5' },
      { id: 'tugboat', label: 'Tugboat Services', value: tugboatFiltered, icon: Ship, color: 'text-fab-gold', bg: 'bg-fab-gold/10', hoverBg: 'hover:bg-fab-gold/5' },
      { id: 'ancillary', label: 'Ancillary Services', value: ancillaryFiltered, icon: PlusCircle, color: 'text-fab-cyan', bg: 'bg-fab-cyan/10', hoverBg: 'hover:bg-fab-cyan/5' },
    ];
  }, [revenueFilter, vesselCargoTotal, vmfFiltered, tugboatFiltered, ancillaryFiltered]);

  const pieData = useMemo(() => {
    const vesselTotal = filteredRevenue.reduce((acc, curr) => acc + curr.vessel, 0);
    const cargoTotal = filteredRevenue.reduce((acc, curr) => acc + curr.cargo, 0);

    return [
      { name: 'Vessel Revenue', value: vesselTotal },
      { name: 'Cargo Revenue', value: cargoTotal },
      { name: 'VMF', value: vmfFiltered },
      { name: 'Tugboat', value: tugboatFiltered },
      { name: 'Ancillary', value: ancillaryFiltered },
    ];
  }, [filteredRevenue, vmfFiltered, tugboatFiltered, ancillaryFiltered]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP', 
      notation: 'compact',
      maximumFractionDigits: 1 
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold font-mono uppercase tracking-tighter">Financial Overview</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center bg-white border border-[#141414] rounded-sm p-1 gap-1">
            <span className="text-[10px] font-mono uppercase px-2 opacity-60">Period:</span>
            <select 
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer"
            >
              {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
            </select>
            <span className="text-[10px] font-mono opacity-40">—</span>
            <select 
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer"
            >
              {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
            </select>
          </div>

          {/* Revenue Type Filter */}
          <div className="flex bg-white border border-[#141414] p-1 rounded-sm shadow-sm">
            {(['All', 'Foreign', 'Domestic'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setRevenueFilter(type)}
                className={cn(
                  "px-4 py-1 text-[10px] font-mono uppercase tracking-widest transition-all",
                  revenueFilter === type ? "bg-[#141414] text-white" : "hover:bg-gray-100"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Consolidated Grand Port Revenue Ledger */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-5 flex items-center justify-center p-8 pointer-events-none select-none">
          <Landmark className="h-44 w-44 text-white" />
        </div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-full font-bold">
              Consolidated Performance Ledger
            </span>
            <h1 className="text-3xl md:text-4xl font-black mt-3 flex items-baseline gap-2 text-slate-100">
              {formatCurrency(grandConsolidatedTotal)}
            </h1>
            <p className="text-xs text-slate-300 font-mono mt-1">
              Consolidated Gross Port Revenue for chosen range ({startMonth} — {endMonth})
            </p>
          </div>
          <div className="border-t border-slate-800/80 xl:border-t-0 xl:border-l xl:border-slate-800/80 xl:pl-6 pt-4 xl:pt-0 grid grid-cols-2 sm:grid-cols-4 gap-6 text-slate-200">
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Vessel & Cargo</p>
              <p className="text-sm font-bold text-blue-400 mt-0.5">{formatCurrency(vesselCargoTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">VMF Total</p>
              <p className="text-sm font-bold text-green-400 mt-0.5">{formatCurrency(vmfFiltered)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Tugboat Service</p>
              <p className="text-sm font-bold text-orange-400 mt-0.5">{formatCurrency(tugboatFiltered)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Ancillary Services</p>
              <p className="text-sm font-bold text-purple-400 mt-0.5">{formatCurrency(ancillaryFiltered)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid (Interlocking Color-Themed Tabs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const isActive = activeTab === stat.id;
          let activeStyles = "";
          
          if (isActive) {
            if (stat.id === 'overview') activeStyles = "border-fab-blue ring-4 ring-fab-blue/10 bg-fab-blue/5";
            else if (stat.id === 'vmf') activeStyles = "border-fab-green ring-4 ring-fab-green/10 bg-fab-green/5";
            else if (stat.id === 'tugboat') activeStyles = "border-fab-gold ring-4 ring-fab-gold/10 bg-fab-gold/5";
            else if (stat.id === 'ancillary') activeStyles = "border-fab-cyan ring-4 ring-fab-cyan/10 bg-fab-cyan/5";
          } else {
            activeStyles = "border-slate-100 hover:border-slate-300 hover:bg-slate-50/50";
          }

          return (
            <button 
              key={i} 
              onClick={() => setActiveTab(stat.id as any)}
              className={cn(
                "bg-white p-5 rounded-2xl border flex items-center space-x-4 transition-all duration-300 text-left relative overflow-hidden cursor-pointer",
                activeStyles
              )}
            >
              {isActive && (
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  stat.id === 'overview' && "bg-fab-blue",
                  stat.id === 'vmf' && "bg-fab-green",
                  stat.id === 'tugboat' && "bg-fab-gold",
                  stat.id === 'ancillary' && "bg-fab-cyan"
                )} />
              )}
              <div className={cn(
                stat.bg,
                "p-3 rounded-xl transition-transform duration-300",
                isActive && "scale-105"
              )}>
                <stat.icon className={cn("h-6 w-6 transition-all", stat.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">{stat.label}</p>
                <p className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight">{formatCurrency(stat.value)}</p>
                <span className={cn(
                  "text-[9px] font-bold font-mono uppercase block mt-1",
                  isActive 
                    ? (stat.id === 'overview' ? "text-fab-blue" : stat.id === 'vmf' ? "text-fab-green" : stat.id === 'tugboat' ? "text-fab-gold" : "text-fab-cyan")
                    : "text-gray-400"
                )}>
                  {isActive ? "● Active Ledger" : "Select View →"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <React.Fragment>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Revenue Trend */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                Monthly Revenue Trend (Vessel & Cargo)
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(val) => `₱${(val / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="vessel" 
                      stackId="1" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      name="Vessel Charges" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cargo" 
                      stackId="1" 
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      name="Cargo Charges" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Revenue Stream Distribution</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} layout="vertical" margin={{ left: 20, right: 80, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="right" formatter={formatCurrencyShort} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Fee Category Breakdown (Monthly)</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredFees}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `₱${(val / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="portDues" stackId="a" fill="#0088FE" name="Port Dues" />
                  <Bar dataKey="dockage" stackId="a" fill="#00C49F" name="Dockage" />
                  <Bar dataKey="anchorage" stackId="a" fill="#FFBB28" name="Anchorage" />
                  <Bar dataKey="pilotage" stackId="a" fill="#FF8042" name="Pilotage" />
                  <Bar dataKey="usageFee" stackId="a" fill="#8884d8" name="Usage Fee" />
                  <Bar dataKey="wharfage" stackId="a" fill="#a4de6c" name="Wharfage" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* VMF Tab In-Depth (Cohesive Green Color Scheme) */}
      {activeTab === 'vmf' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-bold">
                Vessel Maritime Fees
              </span>
              <h3 className="text-xl font-bold flex items-center text-green-950 mt-2">
                <Anchor className="mr-2 h-5 w-5 text-green-600 animate-pulse" />
                VMF Analysis Ledger
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Comprehensive tracking of Vessel Maritime Fees (VMF) collected for {startMonth} — {endMonth}
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('overview')}
              className="text-xs font-bold font-mono text-green-700 hover:text-green-900 hover:underline bg-green-50 border border-green-200 px-4 py-2 rounded-lg cursor-pointer"
            >
              ← BACK TO GENERAL OVERVIEW
            </button>
          </div>

          {/* VMF Key Stats Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/25">
              <p className="text-[10px] text-green-600 font-mono uppercase tracking-wider font-bold">VMF Net Collection</p>
              <p className="text-2xl font-black text-green-950 mt-1">{formatCurrency(vmfFiltered)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Total revenue collected in chosen range</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/25">
              <p className="text-[10px] text-green-600 font-mono uppercase tracking-wider font-bold">Average Monthly VMF</p>
              <p className="text-2xl font-black text-green-950 mt-1">{formatCurrency(vmfFiltered / monthsInSelection)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Calculated across {monthsInSelection} months</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/25">
              <p className="text-[10px] text-green-600 font-mono uppercase tracking-wider font-bold">VMF Stream Contribution</p>
              <p className="text-2xl font-black text-green-950 mt-1">
                {grandConsolidatedTotal > 0 ? ((vmfFiltered / grandConsolidatedTotal) * 100).toFixed(1) : "0.0"}%
              </p>
              <p className="text-[10px] text-gray-400 mt-1">VMF share of grand total gross collection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* VMF Graph Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                Monthly Collections Trend (VMF)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vmfFilteredList}>
                    <defs>
                      <linearGradient id="vmfColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#vmfColor)" 
                      name="VMF Fee Total" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* VMF Table Ledger Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-50 bg-gray-50/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Period Ledger Log</h4>
              </div>
              <div className="overflow-y-auto max-h-[300px] flex-1">
                <table className="w-full text-left font-sans">
                  <thead className="bg-[#141414] text-[9px] uppercase font-mono text-white">
                    <tr>
                      <th className="px-4 py-2.5">Month</th>
                      <th className="px-4 py-2.5 text-right font-medium">Collection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-slate-700">
                    {vmfFilteredList.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-slate-400 font-mono">No data in range</td>
                      </tr>
                    ) : (
                      vmfFilteredList.map((m, i) => (
                        <tr key={i} className="hover:bg-green-50/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 uppercase">{m.month}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-green-600">{formatCurrency(m.value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tugboat Tab In-Depth (Cohesive Orange Color Scheme) */}
      {activeTab === 'tugboat' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full font-bold">
                Harbor Assistance Logs
              </span>
              <h3 className="text-xl font-bold flex items-center text-orange-950 mt-2">
                <Ship className="mr-2 h-5 w-5 text-orange-600 animate-pulse" />
                Tugboat Service Ledger
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Breakdown of tug assistance & harbor deployment collections for {startMonth} — {endMonth}
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('overview')}
              className="text-xs font-bold font-mono text-orange-700 hover:text-orange-900 hover:underline bg-orange-50 border border-orange-200 px-4 py-2 rounded-lg cursor-pointer"
            >
              ← BACK TO GENERAL OVERVIEW
            </button>
          </div>

          {/* Tugboat Key Stats Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/25">
              <p className="text-[10px] text-orange-600 font-mono uppercase tracking-wider font-bold">Tugboat Net Revenue</p>
              <p className="text-2xl font-black text-orange-950 mt-1">{formatCurrency(tugboatFiltered)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Total revenue collected in chosen range</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/25">
              <p className="text-[10px] text-orange-600 font-mono uppercase tracking-wider font-bold">Average Monthly Fees</p>
              <p className="text-2xl font-black text-orange-950 mt-1">{formatCurrency(tugboatFiltered / monthsInSelection)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Calculated across {monthsInSelection} months</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/25">
              <p className="text-[10px] text-orange-600 font-mono uppercase tracking-wider font-bold">Tugboat share</p>
              <p className="text-2xl font-black text-orange-950 mt-1">
                {grandConsolidatedTotal > 0 ? ((tugboatFiltered / grandConsolidatedTotal) * 100).toFixed(1) : "0.0"}%
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Tugboat share of grand total gross collection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tugboat Graph Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 text-orange-500 mr-2" />
                Monthly Collections Trend (Tugboat)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tugboatFilteredList}>
                    <defs>
                      <linearGradient id="tugColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#tugColor)" 
                      name="Tugboat Fees Total" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tugboat Table Ledger Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-50 bg-gray-50/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Period Ledger Log</h4>
              </div>
              <div className="overflow-y-auto max-h-[300px] flex-1">
                <table className="w-full text-left">
                  <thead className="bg-[#141414] text-[9px] uppercase font-mono text-white">
                    <tr>
                      <th className="px-4 py-2.5">Month</th>
                      <th className="px-4 py-2.5 text-right font-medium">Collection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-slate-700">
                    {tugboatFilteredList.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-slate-400 font-mono">No data in range</td>
                      </tr>
                    ) : (
                      tugboatFilteredList.map((m, i) => (
                        <tr key={i} className="hover:bg-orange-50/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 uppercase">{m.month}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-orange-600">{formatCurrency(m.value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ancillary Tab In-Depth (Cohesive Purple Color Scheme) */}
      {activeTab === 'ancillary' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center text-purple-900">
              <PlusCircle className="mr-2 h-6 w-6" />
              Ancillary Services In-Depth
            </h3>
            <button 
              onClick={() => setActiveTab('overview')}
              className="text-sm font-mono text-gray-500 hover:text-black"
            >
              ← BACK TO OVERVIEW
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Service Type Distribution</h4>
                <span className="text-[9px] font-mono select-none px-2 py-0.5 bg-purple-50 text-purple-700 rounded-sm border border-purple-100">Click a bar to inspect</span>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ancillaryStats.byType} layout="vertical" margin={{ left: 40, right: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {ancillaryStats.byType.map((entry, index) => {
                        const isSelected = selectedServiceType === entry.name;
                        const hasSelection = selectedServiceType !== null;
                        const barColor = isSelected 
                          ? '#6d28d9' 
                          : hasSelection 
                            ? '#e2e8f0' 
                            : COLORS[index % COLORS.length];
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={barColor}
                            className="cursor-pointer hover:opacity-85 transition-opacity"
                            onClick={() => {
                              setSelectedServiceType(prev => prev === entry.name ? null : entry.name);
                            }}
                          />
                        );
                      })}
                      <LabelList dataKey="value" position="right" formatter={formatCurrencyShort} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6">Collection by Terminal</h4>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ancillaryStats.byTerminal} layout="vertical" margin={{ left: 20, right: 80, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {ancillaryStats.byTerminal.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="right" formatter={formatCurrencyShort} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive Drill-down details when a service type is clicked */}
          {selectedServiceType && (
            <div className="bg-white border border-purple-200 rounded-xl shadow-md p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-350">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-purple-50/70 p-4 rounded-lg border border-purple-100 gap-4">
                <div>
                  <h4 className="font-extrabold text-sm uppercase tracking-tight text-purple-950 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-purple-700" />
                    Interactive Ledger Analysis: {selectedServiceType}
                  </h4>
                  <p className="text-xs text-purple-700/80 mt-1 font-medium font-sans">
                    Showing {filteredAncillaryRecordsByType.length} matched ledger logs in selected period ({startMonth} — {endMonth})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedServiceType(null)}
                  className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 hover:bg-purple-200 px-4 py-2 rounded-md transition-all cursor-pointer whitespace-nowrap select-none"
                >
                  Clear Selection
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#141414] text-white text-[10px] uppercase font-mono">
                    <tr>
                      <th className="p-3">Ctrl No</th>
                      <th className="p-3">Vessel Name</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Terminal</th>
                      <th className="p-3">Date Applied</th>
                      <th className="p-3 text-right">Base Amount</th>
                      <th className="p-3 text-right">VAT</th>
                      <th className="p-3 text-right">Total Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredAncillaryRecordsByType.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-medium font-mono">
                          No matching records found for this service type in the chosen time window.
                        </td>
                      </tr>
                    ) : (
                      filteredAncillaryRecordsByType.map((record, idx) => (
                        <tr key={record.controlNo + '-' + idx} className="hover:bg-slate-50/65 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-800">{record.controlNo}</td>
                          <td className="p-3 font-semibold uppercase">{record.vesselName || 'UNKNOWN'}</td>
                          <td className="p-3 text-slate-600">{record.provider}</td>
                          <td className="p-3 text-slate-500 font-mono text-[10px] uppercase">{record.terminal}</td>
                          <td className="p-3 text-slate-500 font-mono">{record.date || record.monthApplied}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{formatCurrency(record.amount)}</td>
                          <td className="p-3 text-right font-mono text-slate-500">{formatCurrency(record.vat)}</td>
                          <td className="p-3 text-right font-mono font-bold text-purple-700">{formatCurrency(record.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700">Top Service Providers</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] uppercase font-mono text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Provider</th>
                    <th className="px-6 py-3 text-right">Total Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ancillaryStats.byProvider.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-right font-mono font-bold text-purple-600">{formatCurrency(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
