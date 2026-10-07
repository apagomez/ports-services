
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import { PaymentDashboardData, VesselData, VoyagePaymentRecord } from '../types';
import { Landmark, TrendingUp, Anchor, Ship, PlusCircle, Star, Search, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { PortTerminalModules } from './PortTerminalModules';
import { VoyagePaymentLedger } from './VoyagePaymentLedger';

interface PaymentDashboardProps {
  data: PaymentDashboardData;
  vesselData: VesselData[];
}

// Official Freeport Area of Bataan (FAB) & Port Regulations navigation/regulatory signaling colors:
const COLORS = ['#004a99', '#10b981', '#fdb913', '#ed1c24', '#00aeef', '#f97316', '#6366f1'];

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ data, vesselData }) => {
  const [revenueFilter, setRevenueFilter] = React.useState<'All' | 'Foreign' | 'Domestic'>('All');
  const [terminalFilter, setTerminalFilter] = React.useState<string>('All');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'vmf' | 'tugboat' | 'ancillary'>('overview');
  const [selectedServiceType, setSelectedServiceType] = React.useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = React.useState<VoyagePaymentRecord | null>(null);
  const [activeModal, setActiveModal] = React.useState<'provider' | 'shippingLine' | 'consignee' | null>(null);
  const [modalSearch, setModalSearch] = React.useState<string>('');
  
  const months = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);

  const [startMonth, setStartMonth] = React.useState<string>(months[0]);
  const [endMonth, setEndMonth] = React.useState<string>(months[months.length - 1]);

  const monthToIndex = (month: string) => months.indexOf(month.toUpperCase());

  // Fast map lookup by control number for vessel metadata
  const vesselMap = useMemo(() => {
    const map = new Map<string, VesselData>();
    (vesselData || []).forEach(v => {
      if (v.controlNo) {
        map.set(v.controlNo.trim().toUpperCase(), v);
      }
    });
    return map;
  }, [vesselData]);

  // Reliable terminal extraction helper
  const getRecordTerminal = (record: { controlNo?: string; terminal?: string }) => {
    if (record.terminal && record.terminal.trim() && record.terminal.trim().toUpperCase() !== 'UNKNOWN') {
      return record.terminal.trim();
    }
    if (record.controlNo) {
      const v = vesselMap.get(record.controlNo.trim().toUpperCase());
      if (v && v.terminal && v.terminal.trim() && v.terminal.trim().toUpperCase() !== 'UNKNOWN') {
        return v.terminal.trim();
      }
    }
    return '';
  };

  // Aggregated unique terminals across all datasets
  const uniqueTerminals = useMemo(() => {
    const termSet = new Set<string>();

    (vesselData || []).forEach(v => {
      const t = v.terminal?.trim();
      if (t && t.toUpperCase() !== 'UNKNOWN' && t.toUpperCase() !== 'PORT TERMINAL' && !t.startsWith('#')) {
        termSet.add(t);
      }
    });

    (data.voyagePayments || []).forEach(p => {
      const t = getRecordTerminal(p);
      if (t && t.toUpperCase() !== 'UNKNOWN' && t.toUpperCase() !== 'PORT TERMINAL' && !t.startsWith('#')) {
        termSet.add(t);
      }
    });

    (data.ancillaryRecords || []).forEach(a => {
      const t = a.terminal?.trim();
      if (t && t.toUpperCase() !== 'UNKNOWN' && t.toUpperCase() !== 'PORT TERMINAL' && !t.startsWith('#')) {
        termSet.add(t);
      }
    });

    return Array.from(termSet).sort();
  }, [vesselData, data.voyagePayments, data.ancillaryRecords, vesselMap]);

  // Terminal modules data for interactive module selection
  const terminalModulesData = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const termMap: Record<string, { name: string; count: number; revenue: number; vesselCount: number }> = {};

    uniqueTerminals.forEach(term => {
      termMap[term] = { name: term, count: 0, revenue: 0, vesselCount: 0 };
    });

    (vesselData || []).forEach(v => {
      const idx = monthToIndex(v.month);
      if (idx < startIndex || idx > endIndex) return;
      const t = v.terminal?.trim();
      if (t && termMap[t]) {
        termMap[t].vesselCount += 1;
      }
    });

    (data.voyagePayments || []).forEach(p => {
      const idx = monthToIndex(p.month);
      if (idx < startIndex || idx > endIndex) return;
      const t = getRecordTerminal(p);
      if (t && termMap[t]) {
        termMap[t].count += 1;
        termMap[t].revenue += (p.vesselTotal || 0) + (p.cargoTotal || 0);
      }
    });

    (data.ancillaryRecords || []).forEach(a => {
      const idx = monthToIndex(a.monthApplied);
      if ((idx >= startIndex && idx <= endIndex) || a.monthApplied === 'UNKNOWN') {
        const t = a.terminal?.trim();
        if (t && termMap[t]) {
          termMap[t].count += 1;
          termMap[t].revenue += a.total || 0;
        }
      }
    });

    return Object.values(termMap).sort((a, b) => b.revenue - a.revenue || b.vesselCount - a.vesselCount);
  }, [uniqueTerminals, vesselData, data.voyagePayments, data.ancillaryRecords, startMonth, endMonth, monthToIndex, vesselMap]);

  // Terminal-filtered voyage payments aggregated by month
  const terminalPaymentsByMonth = useMemo(() => {
    if (terminalFilter === 'All') return null;
    const map = new Map<string, { foreignVessel: number; domesticVessel: number; foreignCargo: number; domesticCargo: number; total: number }>();

    months.forEach(m => {
      map.set(m, { foreignVessel: 0, domesticVessel: 0, foreignCargo: 0, domesticCargo: 0, total: 0 });
    });

    (data.voyagePayments || []).forEach(p => {
      const term = getRecordTerminal(p);
      if (term.toUpperCase() !== terminalFilter.toUpperCase()) return;

      const isForeign = p.controlNo.includes('-F');
      const month = p.month.toUpperCase();
      if (!map.has(month)) return;

      const curr = map.get(month)!;
      const vessel = p.vesselTotal || 0;
      const cargo = p.cargoTotal || 0;

      if (isForeign) {
        curr.foreignVessel += vessel;
        curr.foreignCargo += cargo;
      } else {
        curr.domesticVessel += vessel;
        curr.domesticCargo += cargo;
      }
      curr.total += vessel + cargo;
    });

    return map;
  }, [data.voyagePayments, terminalFilter, months, vesselMap]);

  // Terminal-filtered fee breakdown aggregated by month
  const terminalFeesByMonth = useMemo(() => {
    if (terminalFilter === 'All') return null;
    const map = new Map<string, {
      portDues: number;
      dockage: number;
      anchorage: number;
      pilotage: number;
      usageFee: number;
      wharfage: number;
      foreignTotal: number;
      domesticTotal: number;
      total: number;
    }>();

    months.forEach(m => {
      map.set(m, { portDues: 0, dockage: 0, anchorage: 0, pilotage: 0, usageFee: 0, wharfage: 0, foreignTotal: 0, domesticTotal: 0, total: 0 });
    });

    (data.voyagePayments || []).forEach(p => {
      const term = getRecordTerminal(p);
      if (term.toUpperCase() !== terminalFilter.toUpperCase()) return;

      const isForeign = p.controlNo.includes('-F');
      const month = p.month.toUpperCase();
      if (!map.has(month)) return;

      const curr = map.get(month)!;
      const wharfage = (p.importWharfage || 0) + (p.domesticWharfage || 0);

      curr.portDues += p.portDues || 0;
      curr.dockage += p.dockage || 0;
      curr.anchorage += p.anchorage || 0;
      curr.pilotage += p.pilotage || 0;
      curr.usageFee += p.usageFee || 0;
      curr.wharfage += wharfage;

      const rowTot = (p.vesselTotal || 0) + (p.cargoTotal || 0);
      if (isForeign) {
        curr.foreignTotal += rowTot;
      } else {
        curr.domesticTotal += rowTot;
      }
      curr.total += rowTot;
    });

    return map;
  }, [data.voyagePayments, terminalFilter, months, vesselMap]);

  const filteredRevenue = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    if (terminalFilter === 'All') {
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
    }

    // Dynamic terminal breakdown
    return months
      .filter((_, idx) => idx >= startIndex && idx <= endIndex)
      .map(month => {
        const stats = terminalPaymentsByMonth?.get(month) || { foreignVessel: 0, domesticVessel: 0, foreignCargo: 0, domesticCargo: 0, total: 0 };
        let vessel = stats.foreignVessel + stats.domesticVessel;
        let cargo = stats.foreignCargo + stats.domesticCargo;
        if (revenueFilter === 'Foreign') {
          vessel = stats.foreignVessel;
          cargo = stats.foreignCargo;
        } else if (revenueFilter === 'Domestic') {
          vessel = stats.domesticVessel;
          cargo = stats.domesticCargo;
        }
        return {
          month,
          foreignVessel: stats.foreignVessel,
          domesticVessel: stats.domesticVessel,
          foreignCargo: stats.foreignCargo,
          domesticCargo: stats.domesticCargo,
          vessel,
          cargo,
          total: vessel + cargo,
          totalWithVat: vessel + cargo
        };
      });
  }, [data.monthlyRevenue, revenueFilter, terminalFilter, terminalPaymentsByMonth, startMonth, endMonth, months, monthToIndex]);

  const filteredFees = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    if (terminalFilter === 'All') {
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
    }

    return months
      .filter((_, idx) => idx >= startIndex && idx <= endIndex)
      .map(month => {
        const f = terminalFeesByMonth?.get(month) || { portDues: 0, dockage: 0, anchorage: 0, pilotage: 0, usageFee: 0, wharfage: 0, foreignTotal: 0, domesticTotal: 0, total: 0 };
        const ratio = f.total > 0 ? (revenueFilter === 'Foreign' ? (f.foreignTotal / f.total) : (f.domesticTotal / f.total)) : 0;
        return {
          month,
          portDues: f.portDues * (revenueFilter === 'Domestic' ? 0 : 1),
          dockage: f.dockage * (revenueFilter === 'Domestic' ? 0 : 1),
          anchorage: revenueFilter === 'All' ? f.anchorage : f.anchorage * ratio,
          pilotage: revenueFilter === 'All' ? f.pilotage : f.pilotage * ratio,
          usageFee: f.usageFee * (revenueFilter === 'Foreign' ? 0 : 1),
          wharfage: revenueFilter === 'All' ? f.wharfage : f.wharfage * ratio,
          foreignTotal: f.foreignTotal,
          domesticTotal: f.domesticTotal,
          total: revenueFilter === 'Foreign' ? f.foreignTotal : revenueFilter === 'Domestic' ? f.domesticTotal : f.total,
          totalWithVat: revenueFilter === 'Foreign' ? f.foreignTotal : revenueFilter === 'Domestic' ? f.domesticTotal : f.total
        };
      });
  }, [data.feeBreakdown, revenueFilter, terminalFilter, terminalFeesByMonth, startMonth, endMonth, months, monthToIndex]);

  const ancillaryStats = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    const filtered = data.ancillaryRecords.filter(r => {
      const idx = monthToIndex(r.monthApplied);
      const isWithinMonths = (idx >= startIndex && idx <= endIndex) || r.monthApplied === 'UNKNOWN';
      if (!isWithinMonths) return false;
      if (terminalFilter !== 'All') {
        const term = getRecordTerminal(r);
        if (term.toUpperCase() !== terminalFilter.toUpperCase()) return false;
      }
      return true;
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
      byProviderAll: Object.entries(byProvider).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      totalFiltered: filtered.reduce((acc, curr) => acc + curr.total, 0),
      count: filtered.length
    };
  }, [data.ancillaryRecords, terminalFilter, startMonth, endMonth, months, monthToIndex, vesselMap]);

  const filteredAncillaryRecordsByType = useMemo(() => {
    if (!selectedServiceType) return [];
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.ancillaryRecords.filter(r => {
      const idx = monthToIndex(r.monthApplied);
      const isWithinMonths = (idx >= startIndex && idx <= endIndex) || r.monthApplied === 'UNKNOWN';
      if (!isWithinMonths) return false;
      if (terminalFilter !== 'All') {
        const term = getRecordTerminal(r);
        if (term.toUpperCase() !== terminalFilter.toUpperCase()) return false;
      }
      return (r.serviceType || 'Other') === selectedServiceType;
    });
  }, [data.ancillaryRecords, selectedServiceType, terminalFilter, startMonth, endMonth, monthToIndex, vesselMap]);

  const vmfFiltered = useMemo(() => {
    if (terminalFilter !== 'All' && terminalFilter.toUpperCase() !== 'STC') return 0;
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.vmfMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);
  }, [data.vmfMonthly, terminalFilter, startMonth, endMonth, monthToIndex]);

  const tugboatFiltered = useMemo(() => {
    if (terminalFilter !== 'All') return 0;
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return data.tugboatMonthly
      .filter(m => {
        const idx = monthToIndex(m.month);
        return idx >= startIndex && idx <= endIndex;
      })
      .reduce((acc, curr) => acc + curr.value, 0);
  }, [data.tugboatMonthly, terminalFilter, startMonth, endMonth, monthToIndex]);

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
    if (terminalFilter !== 'All' && terminalFilter.toUpperCase() !== 'STC') return [];
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return data.vmfMonthly.filter(m => {
      const idx = monthToIndex(m.month);
      return idx >= startIndex && idx <= endIndex;
    });
  }, [data.vmfMonthly, terminalFilter, startMonth, endMonth, monthToIndex]);

  const tugboatFilteredList = useMemo(() => {
    if (terminalFilter !== 'All') return [];
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);
    return data.tugboatMonthly.filter(m => {
      const idx = monthToIndex(m.month);
      return idx >= startIndex && idx <= endIndex;
    });
  }, [data.tugboatMonthly, terminalFilter, startMonth, endMonth, monthToIndex]);

  const topContributors = useMemo(() => {
    const shippingLinesVol: Record<string, number> = {};
    const consigneesVol: Record<string, number> = {};
    const shippingLinesPeso: Record<string, number> = {};
    const consigneesPeso: Record<string, number> = {};

    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    // Filter transaction payments to match the selected month range, orientation, and terminal
    const filteredPayments = (data.voyagePayments || []).filter(p => {
      const idx = monthToIndex(p.month);
      if (idx < startIndex || idx > endIndex) return false;

      const isForeign = p.controlNo.includes('-F');
      const isDomestic = p.controlNo.includes('-D');

      if (revenueFilter === 'Foreign') {
        if (!isForeign) return false;
      } else if (revenueFilter === 'Domestic') {
        if (!isDomestic) return false;
      }

      if (terminalFilter !== 'All') {
        const term = getRecordTerminal(p);
        if (term.toUpperCase() !== terminalFilter.toUpperCase()) return false;
      }

      return true;
    });

    // Filter vessels to match the currently selected month range, orientation, and terminal for volume activity
    const filteredVessels = (vesselData || []).filter(v => {
      const idx = monthToIndex(v.month);
      if (idx < startIndex || idx > endIndex) return false;

      if (revenueFilter === 'Foreign') {
        if (v.orientation !== 'Foreign') return false;
      } else if (revenueFilter === 'Domestic') {
        if (v.orientation !== 'Domestic') return false;
      }

      if (terminalFilter !== 'All') {
        if (v.terminal?.trim()?.toUpperCase() !== terminalFilter.toUpperCase()) return false;
      }

      return true;
    });

    // Accumulate actual volume activity from vessel logs
    filteredVessels.forEach(v => {
      const sl = v.shippingLine?.trim();
      const cg = v.consignee?.trim();
      const cargoVol = (v.cargoVolumeMT || 0) + (v.cargoVolumeCBM || 0);

      if (sl && sl.toUpperCase() !== 'UNKNOWN' && sl !== '') {
        shippingLinesVol[sl] = (shippingLinesVol[sl] || 0) + cargoVol;
      }
      if (cg && cg.toUpperCase() !== 'UNKNOWN' && cg !== '') {
        consigneesVol[cg] = (consigneesVol[cg] || 0) + cargoVol;
      }
    });

    // Accumulate actual fees paid from GID 261075415 transaction records
    filteredPayments.forEach(p => {
      const sl = p.shippingAgency?.trim();
      const cg = p.consignee?.trim();

      if (sl && sl.toUpperCase() !== 'UNKNOWN' && sl !== '') {
        shippingLinesPeso[sl] = (shippingLinesPeso[sl] || 0) + p.vesselTotal;
      }
      if (cg && cg.toUpperCase() !== 'UNKNOWN' && cg !== '') {
        consigneesPeso[cg] = (consigneesPeso[cg] || 0) + p.cargoTotal;
      }
    });

    const topShippingLine = Object.entries(shippingLinesPeso).sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    const topConsignee = Object.entries(consigneesPeso).sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    const topProvider = ancillaryStats.byProvider[0] || { name: 'None', value: 0 };

    const topShippingLineVol = shippingLinesVol[topShippingLine[0]] || 0;
    const topConsigneeVol = consigneesVol[topConsignee[0]] || 0;

    const sortedShippingLines = Object.entries(shippingLinesPeso)
      .map(([name, peso]) => ({
        name,
        peso,
        volume: shippingLinesVol[name] || 0
      }))
      .sort((a, b) => b.peso - a.peso);

    const sortedConsignees = Object.entries(consigneesPeso)
      .map(([name, peso]) => ({
        name,
        peso,
        volume: consigneesVol[name] || 0
      }))
      .sort((a, b) => b.peso - a.peso);

    return {
      shippingLine: [topShippingLine[0], topShippingLineVol, topShippingLine[1]], // [Name, Volume, PesoAmount]
      consignee: [topConsignee[0], topConsigneeVol, topConsignee[1]], // [Name, Volume, PesoAmount]
      provider: topProvider,
      sortedShippingLines,
      sortedConsignees
    };
  }, [vesselData, data.voyagePayments, ancillaryStats, startMonth, endMonth, revenueFilter, terminalFilter, monthToIndex, vesselMap]);

  // Filtered Voyage Payment records for the transactions table
  const filteredVoyagePayments = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return (data.voyagePayments || []).filter(p => {
      const idx = monthToIndex(p.month);
      if (idx < startIndex || idx > endIndex) return false;

      const isForeign = p.controlNo.includes('-F');
      const isDomestic = p.controlNo.includes('-D');

      if (revenueFilter === 'Foreign' && !isForeign) return false;
      if (revenueFilter === 'Domestic' && !isDomestic) return false;

      if (terminalFilter !== 'All') {
        const term = getRecordTerminal(p);
        if (term.toUpperCase() !== terminalFilter.toUpperCase()) return false;
      }

      return true;
    });
  }, [data.voyagePayments, startMonth, endMonth, revenueFilter, terminalFilter, monthToIndex, vesselMap]);

  // All Voyage Payment records within selected month range for the enhanced ledger
  const periodVoyagePayments = useMemo(() => {
    const startIndex = monthToIndex(startMonth);
    const endIndex = monthToIndex(endMonth);

    return (data.voyagePayments || []).filter(p => {
      const idx = monthToIndex(p.month);
      return idx >= startIndex && idx <= endIndex;
    });
  }, [data.voyagePayments, startMonth, endMonth, monthToIndex]);

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
        <div>
          <h2 className="text-xl font-bold font-mono uppercase tracking-tighter">Financial Overview</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {terminalFilter !== 'All' && (
              <span className="text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold flex items-center gap-1.5">
                <span>Terminal:</span>
                <span className="text-indigo-900 font-extrabold">{terminalFilter}</span>
                <button 
                  onClick={() => setTerminalFilter('All')} 
                  className="hover:text-red-600 ml-0.5 p-0.5 cursor-pointer rounded hover:bg-indigo-100 transition-colors"
                  title="Clear terminal filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Port Terminal Filter */}
          <div className="flex items-center bg-white border border-[#141414] rounded-sm p-1 gap-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase px-2 opacity-60">Terminal:</span>
            <select 
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="text-[10px] font-mono border-none focus:ring-0 bg-transparent uppercase cursor-pointer py-1 font-semibold max-w-[170px]"
            >
              <option value="All">All Terminals</option>
              {uniqueTerminals.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {terminalFilter !== 'All' && (
              <button
                onClick={() => setTerminalFilter('All')}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded hover:bg-slate-100 transition-colors"
                title="Reset to All Terminals"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="flex items-center bg-white border border-[#141414] rounded-sm p-1 gap-1 shadow-sm">
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
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-full font-bold">
                Consolidated Performance Ledger
              </span>
              {terminalFilter !== 'All' && (
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2.5 py-1 rounded-full font-bold">
                  {terminalFilter}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-black mt-3 flex items-baseline gap-2 text-slate-100">
              {formatCurrency(grandConsolidatedTotal)}
            </h1>
            <p className="text-xs text-slate-300 font-mono mt-1">
              Consolidated Gross Revenue for chosen range ({startMonth} — {endMonth})
              {terminalFilter !== 'All' && ` • Terminal: ${terminalFilter}`}
            </p>
          </div>
          <div className="border-t border-slate-800/80 xl:border-t-0 xl:border-l xl:border-slate-800/80 xl:pl-6 pt-4 xl:pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-200">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "text-left p-2.5 rounded-lg transition-all cursor-pointer group border",
                activeTab === 'overview' 
                  ? "bg-white/15 border-blue-400/60 ring-2 ring-blue-400/20" 
                  : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20"
              )}
            >
              <p className="text-[10px] text-slate-400 group-hover:text-blue-300 font-mono uppercase tracking-wider flex items-center justify-between">
                <span>Vessel & Cargo</span>
                <span className="text-[9px] opacity-60">→</span>
              </p>
              <p className="text-sm font-bold text-blue-400 mt-0.5">{formatCurrency(vesselCargoTotal)}</p>
            </button>
            <button 
              onClick={() => setActiveTab('vmf')}
              className={cn(
                "text-left p-2.5 rounded-lg transition-all cursor-pointer group border",
                activeTab === 'vmf' 
                  ? "bg-white/15 border-green-400/60 ring-2 ring-green-400/20" 
                  : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20"
              )}
            >
              <p className="text-[10px] text-slate-400 group-hover:text-green-300 font-mono uppercase tracking-wider flex items-center justify-between">
                <span>VMF Total</span>
                <span className="text-[9px] opacity-60">→</span>
              </p>
              <p className="text-sm font-bold text-green-400 mt-0.5">{formatCurrency(vmfFiltered)}</p>
            </button>
            <button 
              onClick={() => setActiveTab('tugboat')}
              className={cn(
                "text-left p-2.5 rounded-lg transition-all cursor-pointer group border",
                activeTab === 'tugboat' 
                  ? "bg-white/15 border-orange-400/60 ring-2 ring-orange-400/20" 
                  : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20"
              )}
            >
              <p className="text-[10px] text-slate-400 group-hover:text-orange-300 font-mono uppercase tracking-wider flex items-center justify-between">
                <span>Tugboat Service</span>
                <span className="text-[9px] opacity-60">→</span>
              </p>
              <p className="text-sm font-bold text-orange-400 mt-0.5">{formatCurrency(tugboatFiltered)}</p>
            </button>
            <button 
              onClick={() => setActiveTab('ancillary')}
              className={cn(
                "text-left p-2.5 rounded-lg transition-all cursor-pointer group border",
                activeTab === 'ancillary' 
                  ? "bg-white/15 border-purple-400/60 ring-2 ring-purple-400/20" 
                  : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20"
              )}
            >
              <p className="text-[10px] text-slate-400 group-hover:text-purple-300 font-mono uppercase tracking-wider flex items-center justify-between">
                <span>Ancillary Services</span>
                <span className="text-[9px] opacity-60">→</span>
              </p>
              <p className="text-sm font-bold text-purple-400 mt-0.5">{formatCurrency(ancillaryFiltered)}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Port Terminal Modules (PC Multi-Grid Deck & Search) */}
      <PortTerminalModules
        terminals={terminalModulesData}
        selectedTerminal={terminalFilter}
        onSelectTerminal={setTerminalFilter}
        formatCurrencyShort={formatCurrencyShort}
        totalRevenue={grandConsolidatedTotal}
      />

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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Revenue Stream Distribution</h3>
                <span className="text-[9px] font-mono select-none px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm border border-blue-100 font-bold">
                  Click bar to open module
                </span>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} layout="vertical" margin={{ left: 20, right: 80, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            if (entry.name === 'VMF') setActiveTab('vmf');
                            else if (entry.name === 'Tugboat') setActiveTab('tugboat');
                            else if (entry.name === 'Ancillary') setActiveTab('ancillary');
                            else if (entry.name === 'Vessel Revenue') {
                              setActiveTab('overview');
                              setRevenueFilter(prev => prev === 'Foreign' ? 'All' : 'Foreign');
                            } else if (entry.name === 'Cargo Revenue') {
                              setActiveTab('overview');
                              setRevenueFilter(prev => prev === 'Domestic' ? 'All' : 'Domestic');
                            }
                          }}
                        />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => { setActiveModal('provider'); setModalSearch(''); }}
              className="group text-left bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 rounded-xl border border-indigo-800 text-white shadow-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-950/20 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full animate-in fade-in zoom-in duration-300"
            >
              <Star className="absolute right-[-10px] bottom-[-10px] h-24 w-24 text-indigo-800 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">Top Service Provider</span>
                <span className="text-[9px] font-mono bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
              </div>
              <h4 className="text-xl font-bold line-clamp-1 mb-2 group-hover:text-indigo-200 transition-colors">{topContributors.provider.name}</h4>
              <p className="text-2xl font-black text-indigo-100 font-mono">{formatCurrency(topContributors.provider.value as number)}</p>
              <p className="text-indigo-300 text-xs mt-1">Ancillary Services Revenue Collected</p>
            </button>

            <button 
              onClick={() => { setActiveModal('shippingLine'); setModalSearch(''); }}
              className="group text-left bg-gradient-to-br from-blue-900 to-blue-950 p-6 rounded-xl border border-blue-800 text-white shadow-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-950/20 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 w-full animate-in fade-in zoom-in duration-300"
            >
              <Star className="absolute right-[-10px] bottom-[-10px] h-24 w-24 text-blue-800 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-300 font-bold">Top Shipping Line</span>
                <span className="text-[9px] font-mono bg-blue-500/20 px-2 py-0.5 rounded text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
              </div>
              <h4 className="text-xl font-bold line-clamp-1 mb-2 group-hover:text-blue-200 transition-colors">{topContributors.shippingLine[0]}</h4>
              <p className="text-2xl font-black text-blue-100 font-mono">{formatCurrency(topContributors.shippingLine[2] as number)}</p>
              <p className="text-blue-300 text-xs mt-1">Shipping Line Revenue Collected</p>
            </button>

            <button 
              onClick={() => { setActiveModal('consignee'); setModalSearch(''); }}
              className="group text-left bg-gradient-to-br from-emerald-900 to-emerald-950 p-6 rounded-xl border border-emerald-800 text-white shadow-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-emerald-950/20 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full animate-in fade-in zoom-in duration-300"
            >
              <Star className="absolute right-[-10px] bottom-[-10px] h-24 w-24 text-emerald-800 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 font-bold">Top Consignee</span>
                <span className="text-[9px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
              </div>
              <h4 className="text-xl font-bold line-clamp-1 mb-2 group-hover:text-emerald-200 transition-colors">{topContributors.consignee[0]}</h4>
              <p className="text-2xl font-black text-emerald-100 font-mono">{formatCurrency(topContributors.consignee[2] as number)}</p>
              <p className="text-emerald-300 text-xs mt-1">Consignee Revenue Collected</p>
            </button>
          </div>

          {/* Voyage Payment Transactions Ledger with Omni-Search & Multi-Filter */}
          <VoyagePaymentLedger
            payments={periodVoyagePayments}
            startMonth={startMonth}
            endMonth={endMonth}
            globalTerminalFilter={terminalFilter}
            globalRevenueFilter={revenueFilter}
            uniqueTerminals={uniqueTerminals}
            onSelectPayment={setSelectedPayment}
            formatCurrency={formatCurrency}
            getRecordTerminal={getRecordTerminal}
          />
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
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Collection by Terminal</h4>
                <span className="text-[9px] font-mono select-none px-2 py-0.5 bg-purple-50 text-purple-700 rounded-sm border border-purple-100 font-bold">
                  Click bar to filter terminal
                </span>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ancillaryStats.byTerminal} layout="vertical" margin={{ left: 20, right: 80, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {ancillaryStats.byTerminal.map((entry, index) => {
                        const isSelected = terminalFilter.toUpperCase() === entry.name.toUpperCase();
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isSelected ? '#6d28d9' : COLORS[index % COLORS.length]} 
                            className="cursor-pointer hover:opacity-85 transition-opacity"
                            onClick={() => {
                              setTerminalFilter(prev => prev.toUpperCase() === entry.name.toUpperCase() ? 'All' : entry.name);
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
                      <th className="p-3">Voyage No</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Terminal</th>
                      <th className="p-3">Service Type</th>
                      <th className="p-3">Date Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredAncillaryRecordsByType.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium font-mono">
                          No matching records found for this service type in the chosen time window.
                        </td>
                      </tr>
                    ) : (
                      filteredAncillaryRecordsByType.map((record, idx) => (
                        <tr key={record.controlNo + '-' + idx} className="hover:bg-slate-50/65 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-800">{record.controlNo}</td>
                          <td className="p-3 font-semibold uppercase">{record.vesselName || 'UNKNOWN'}</td>
                          <td className="p-3 font-mono text-[10px] uppercase text-slate-500">{record.voyageNo || '-'}</td>
                          <td className="p-3 text-slate-600">{record.provider}</td>
                          <td className="p-3 text-slate-500 font-mono text-[10px] uppercase">{record.terminal}</td>
                          <td className="p-3 text-slate-600 font-mono text-[10px] uppercase">{record.serviceType}</td>
                          <td className="p-3 text-slate-500 font-mono">{record.date || record.monthApplied}</td>
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

      {/* Interactive Details Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          />
          
          {/* Modal Container */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className={cn(
              "px-6 py-5 border-b flex items-center justify-between text-white",
              activeModal === 'provider' && "bg-gradient-to-r from-indigo-900 to-indigo-950 border-indigo-950",
              activeModal === 'shippingLine' && "bg-gradient-to-r from-blue-900 to-blue-950 border-blue-950",
              activeModal === 'consignee' && "bg-gradient-to-r from-emerald-900 to-emerald-950 border-emerald-950"
            )}>
              <div>
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-80 block mb-0.5">
                  {activeModal === 'provider' && 'Ancillary Services Breakdown'}
                  {activeModal === 'shippingLine' && 'Shipping Agencies & Lines Ledger'}
                  {activeModal === 'consignee' && 'Consignees Cargo Wharfage'}
                </span>
                <h3 className="text-lg font-bold font-mono tracking-tight flex items-center">
                  <Star className="mr-2 h-5 w-5 text-yellow-400 fill-yellow-400" />
                  {activeModal === 'provider' && 'Ancillary Providers Ranking'}
                  {activeModal === 'shippingLine' && 'Shipping Line Revenue Ledger'}
                  {activeModal === 'consignee' && 'Consignee Payment Ranking'}
                </h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-white hover:bg-white/15 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-Header / Search Input */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search by name..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-white border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder-gray-400"
                />
              </div>
              <div className="text-[11px] font-mono text-gray-500 text-right w-full sm:w-auto flex items-center justify-end gap-2">
                <span>Period: <strong className="text-gray-700">{startMonth} — {endMonth}</strong></span>
                {terminalFilter !== 'All' && (
                  <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold uppercase text-[10px]">
                    {terminalFilter}
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable List Table */}
            <div className="overflow-y-auto flex-1 p-6">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-[10px] font-mono text-gray-500 uppercase border-b border-gray-100">
                  <tr>
                    <th className="p-3 w-12 text-center">Rank</th>
                    <th className="p-3">Entity Name</th>
                    <th className="p-3 text-right">Total Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {(() => {
                    let items: { name: string; value: number }[] = [];
                    if (activeModal === 'provider') {
                      items = (ancillaryStats.byProviderAll || []).map(p => ({
                        name: p.name,
                        value: p.value
                      }));
                    } else if (activeModal === 'shippingLine') {
                      items = (topContributors.sortedShippingLines || []).map(s => ({
                        name: s.name,
                        value: s.peso
                      }));
                    } else if (activeModal === 'consignee') {
                      items = (topContributors.sortedConsignees || []).map(c => ({
                        name: c.name,
                        value: c.peso
                      }));
                    }

                    const filteredItems = items.filter(item => 
                      item.name.toLowerCase().includes(modalSearch.toLowerCase())
                    );

                    if (filteredItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-gray-400 font-mono font-medium">
                            No matching items found.
                          </td>
                        </tr>
                      );
                    }

                    const overallTotal = items.reduce((sum, i) => sum + i.value, 0);

                    return filteredItems.map((item, idx) => {
                      const absoluteRank = items.findIndex(orig => orig.name === item.name) + 1;
                      const percentage = overallTotal > 0 ? (item.value / overallTotal) * 100 : 0;
                      return (
                        <tr key={item.name + '-' + idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-gray-400">
                            #{absoluteRank}
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-gray-900 uppercase tracking-tight">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {percentage.toFixed(1)}% of category collection
                            </p>
                          </td>
                          <td className={cn(
                            "p-3 text-right font-mono font-bold",
                            activeModal === 'provider' && "text-indigo-600",
                            activeModal === 'shippingLine' && "text-blue-600",
                            activeModal === 'consignee' && "text-emerald-600"
                          )}>
                            {formatCurrency(item.value)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Voyage Payment Inspector Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedPayment(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 border-b border-indigo-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                    Voyage Settlement Record
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold uppercase">
                    Encoded: Google Sheets GID 261075415
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold uppercase">
                    {getRecordTerminal(selectedPayment) || 'Port Terminal'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-200 font-bold uppercase">
                    {selectedPayment.month}
                  </span>
                </div>
                <h3 className="text-xl font-black font-mono tracking-tight flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-indigo-400" />
                  {selectedPayment.controlNo}
                </h3>
                <p className="text-xs text-indigo-200/80 mt-0.5 font-sans font-medium">
                  {selectedPayment.vesselName} • {selectedPayment.shippingAgency || 'No Shipping Agency'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="text-white hover:bg-white/15 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-xl">
                  <p className="text-[10px] font-mono uppercase text-blue-700 font-bold">Total Vessel Charges</p>
                  <p className="text-xl font-black text-blue-950 mt-1 font-mono">{formatCurrency(selectedPayment.vesselTotal)}</p>
                  <p className="text-[10px] text-blue-600/80 mt-0.5">Port dues, dockage, anchorage, pilotage</p>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-xl">
                  <p className="text-[10px] font-mono uppercase text-emerald-700 font-bold">Total Cargo Charges</p>
                  <p className="text-xl font-black text-emerald-950 mt-1 font-mono">{formatCurrency(selectedPayment.cargoTotal)}</p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">Import & domestic wharfage + VAT</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                  <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Total Actual Payment</p>
                  <p className="text-xl font-black text-amber-400 mt-1 font-mono">{formatCurrency(selectedPayment.actualPayment || (selectedPayment.vesselTotal + selectedPayment.cargoTotal))}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Grand fee settlement total</p>
                </div>
              </div>

              {/* Vessel Charges Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h5 className="text-xs font-bold font-mono uppercase text-slate-800 flex items-center gap-2">
                    <Ship className="w-3.5 h-3.5 text-blue-600" />
                    Vessel Tariffs & Regulatory Dues
                  </h5>
                  <span className="text-xs font-mono font-bold text-blue-700">{formatCurrency(selectedPayment.vesselTotal)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 text-xs">
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Port Dues</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.portDues)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Dockage Fee</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.dockage)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Anchorage Fee</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.anchorage)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Pilotage Fee</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.pilotage)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Usage Fee</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.usageFee)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Service Fee</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.serviceFee)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">VAT Vessel</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.vatVessel)}</span>
                  </div>
                  <div className="p-3 bg-blue-50/40">
                    <span className="text-[10px] font-mono text-blue-700 uppercase font-bold block">Vessel Subtotal</span>
                    <span className="font-extrabold text-blue-900 font-mono mt-0.5 block">{formatCurrency(selectedPayment.vesselTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Cargo Charges Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h5 className="text-xs font-bold font-mono uppercase text-slate-800 flex items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                    Cargo Wharfage & Consignee Charges
                  </h5>
                  <span className="text-xs font-mono font-bold text-emerald-700">{formatCurrency(selectedPayment.cargoTotal)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 text-xs">
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Consignee</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">{selectedPayment.consignee || '—'}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Import Wharfage</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.importWharfage)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Domestic Wharfage</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.domesticWharfage)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">VAT Cargo</span>
                    <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(selectedPayment.vatCargo)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500">
                Payment Control ID: <strong className="text-slate-800 font-bold">{selectedPayment.controlNo}</strong>
              </span>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
