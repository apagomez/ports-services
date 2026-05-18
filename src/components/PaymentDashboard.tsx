
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ data }) => {
  const [revenueFilter, setRevenueFilter] = React.useState<'All' | 'Foreign' | 'Domestic'>('All');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'ancillary'>('overview');
  
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

  const stats = useMemo(() => {
    const total = filteredRevenue.reduce((acc, curr) => acc + curr.total, 0);
    
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const vmfFiltered = data.vmfMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);

    const ancillaryFiltered = ancillaryStats.totalFiltered;
    
    const tugboatFiltered = data.tugboatMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);

    return [
      { id: 'revenue', label: `${revenueFilter === 'All' ? 'Total' : revenueFilter} Revenue`, value: total, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-100' },
      { id: 'vmf', label: 'VMF Total', value: vmfFiltered, icon: Anchor, color: 'text-green-600', bg: 'bg-green-100' },
      { id: 'tugboat', label: 'Tugboat Services', value: tugboatFiltered, icon: Ship, color: 'text-orange-600', bg: 'bg-orange-100' },
      { id: 'ancillary', label: 'Ancillary Services', value: ancillaryFiltered, icon: PlusCircle, color: 'text-purple-600', bg: 'bg-purple-100' },
    ];
  }, [data, revenueFilter, filteredRevenue, startMonth, endMonth, monthToIndex, ancillaryStats]);

  const pieData = useMemo(() => {
    const vesselTotal = filteredRevenue.reduce((acc, curr) => acc + curr.vessel, 0);
    const cargoTotal = filteredRevenue.reduce((acc, curr) => acc + curr.cargo, 0);
    
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const vmfFiltered = data.vmfMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);

    const ancillaryFiltered = ancillaryStats.totalFiltered;
    
    const tugboatFiltered = data.tugboatMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);

    return [
      { name: 'Vessel Revenue', value: vesselTotal },
      { name: 'Cargo Revenue', value: cargoTotal },
      { name: 'VMF', value: vmfFiltered },
      { name: 'Tugboat', value: tugboatFiltered },
      { name: 'Ancillary', value: ancillaryFiltered },
    ];
  }, [data, filteredRevenue, startMonth, endMonth, monthToIndex, ancillaryStats]);

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

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => {
              if (stat.id === 'ancillary') setActiveTab('ancillary');
              else setActiveTab('overview');
            }}
            className={cn(
              "bg-white p-6 rounded-xl shadow-sm border flex items-center space-x-4 transition-all text-left",
              activeTab === 'ancillary' && stat.id === 'ancillary' ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-100 hover:border-gray-300",
              stat.id === 'ancillary' ? "cursor-pointer" : ""
            )}
          >
            <div className={`${stat.bg} p-3 rounded-lg`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stat.value)}</p>
              {stat.id === 'ancillary' && <p className="text-[10px] text-purple-600 font-mono mt-1 underline">VIEW DETAILS</p>}
            </div>
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
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
      ) : (
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
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6">Service Type Distribution</h4>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ancillaryStats.byType} layout="vertical" margin={{ left: 40, right: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
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
