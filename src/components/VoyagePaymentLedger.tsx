import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Landmark, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal,
  Ship,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { VoyagePaymentRecord } from '../types';
import { cn } from '../lib/utils';

interface VoyagePaymentLedgerProps {
  payments: VoyagePaymentRecord[];
  startMonth: string;
  endMonth: string;
  globalTerminalFilter: string;
  globalRevenueFilter: 'All' | 'Foreign' | 'Domestic';
  uniqueTerminals: string[];
  onSelectPayment: (payment: VoyagePaymentRecord) => void;
  formatCurrency: (value: number) => string;
  getRecordTerminal: (record: { controlNo?: string; terminal?: string }) => string;
}

type SortField = 'controlNo' | 'terminal' | 'vesselName' | 'shippingAgency' | 'consignee' | 'vesselTotal' | 'cargoTotal' | 'actualPayment' | 'month';
type SortOrder = 'asc' | 'desc';

export const VoyagePaymentLedger: React.FC<VoyagePaymentLedgerProps> = ({
  payments,
  startMonth,
  endMonth,
  globalTerminalFilter,
  globalRevenueFilter,
  uniqueTerminals,
  onSelectPayment,
  formatCurrency,
  getRecordTerminal
}) => {
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [vesselFilter, setVesselFilter] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<'All' | 'Foreign' | 'Domestic'>(globalRevenueFilter);
  const [selectedTerminal, setSelectedTerminal] = useState<string>(globalTerminalFilter);
  const [selectedChargeType, setSelectedChargeType] = useState<'All' | 'vessel' | 'cargo' | 'both'>('All');
  const [amountRange, setAmountRange] = useState<'All' | 'gt1m' | '100k-1m' | 'lt100k'>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('actualPayment');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Sync with global filters if they change externally
  React.useEffect(() => {
    setSelectedTrade(globalRevenueFilter);
  }, [globalRevenueFilter]);

  React.useEffect(() => {
    setSelectedTerminal(globalTerminalFilter);
  }, [globalTerminalFilter]);

  // Extract all distinct months available in the payments dataset
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    payments.forEach(p => {
      if (p.month) set.add(p.month.toUpperCase());
    });
    return Array.from(set);
  }, [payments]);

  // Extract distinct vessels with call counts for the dedicated vessel filter
  const uniqueVessels = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(p => {
      const v = p.vesselName?.trim();
      if (v) {
        map.set(v, (map.get(v) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  // Multi-criteria filtering logic
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const recordTerm = getRecordTerminal(p);
      const isForeign = p.controlNo?.includes('-F') || false;
      const isDomestic = p.controlNo?.includes('-D') || false;

      // 1. Dedicated Vessel Name Search Filter
      if (vesselFilter.trim()) {
        const vQuery = vesselFilter.toLowerCase().trim();
        if (!p.vesselName || !p.vesselName.toLowerCase().includes(vQuery)) {
          return false;
        }
      }

      // 2. Omni-Text Search across key fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesControl = p.controlNo?.toLowerCase().includes(q);
        const matchesVessel = p.vesselName?.toLowerCase().includes(q);
        const matchesAgency = p.shippingAgency?.toLowerCase().includes(q);
        const matchesConsignee = p.consignee?.toLowerCase().includes(q);
        const matchesTerm = recordTerm.toLowerCase().includes(q);
        const matchesMonth = p.month?.toLowerCase().includes(q);

        if (!matchesControl && !matchesVessel && !matchesAgency && !matchesConsignee && !matchesTerm && !matchesMonth) {
          return false;
        }
      }

      // 3. Trade orientation filter
      if (selectedTrade === 'Foreign' && !isForeign) return false;
      if (selectedTrade === 'Domestic' && !isDomestic) return false;

      // 4. Terminal filter
      if (selectedTerminal !== 'All') {
        if (recordTerm.toUpperCase() !== selectedTerminal.toUpperCase()) {
          return false;
        }
      }

      // 5. Specific Month filter
      if (selectedMonth !== 'All') {
        if (p.month?.toUpperCase() !== selectedMonth.toUpperCase()) {
          return false;
        }
      }

      // 6. Charge Category filter
      if (selectedChargeType === 'vessel' && (p.vesselTotal || 0) <= 0) return false;
      if (selectedChargeType === 'cargo' && (p.cargoTotal || 0) <= 0) return false;
      if (selectedChargeType === 'both' && ((p.vesselTotal || 0) <= 0 || (p.cargoTotal || 0) <= 0)) return false;

      // 7. Amount Range filter
      const totalAmount = p.actualPayment || (p.vesselTotal + p.cargoTotal) || 0;
      if (amountRange === 'gt1m' && totalAmount < 1000000) return false;
      if (amountRange === '100k-1m' && (totalAmount < 100000 || totalAmount >= 1000000)) return false;
      if (amountRange === 'lt100k' && totalAmount >= 100000) return false;

      return true;
    });
  }, [
    payments,
    vesselFilter,
    searchQuery,
    selectedTrade,
    selectedTerminal,
    selectedMonth,
    selectedChargeType,
    amountRange,
    getRecordTerminal
  ]);

  // Sorting logic
  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'terminal') {
        aVal = getRecordTerminal(a);
        bVal = getRecordTerminal(b);
      } else if (sortField === 'actualPayment') {
        aVal = a.actualPayment || (a.vesselTotal + a.cargoTotal) || 0;
        bVal = b.actualPayment || (b.vesselTotal + b.cargoTotal) || 0;
      }

      if (typeof aVal === 'string') {
        const comp = (aVal || '').localeCompare(bVal || '');
        return sortOrder === 'asc' ? comp : -comp;
      }

      if (typeof aVal === 'number') {
        const comp = (aVal || 0) - (bVal || 0);
        return sortOrder === 'asc' ? comp : -comp;
      }

      return 0;
    });
  }, [filteredPayments, sortField, sortOrder, getRecordTerminal]);

  // Aggregate totals for the filtered subset
  const aggregates = useMemo(() => {
    let totalVessel = 0;
    let totalCargo = 0;
    let totalPaid = 0;

    sortedPayments.forEach(p => {
      totalVessel += p.vesselTotal || 0;
      totalCargo += p.cargoTotal || 0;
      totalPaid += p.actualPayment || (p.vesselTotal + p.cargoTotal) || 0;
    });

    return { totalVessel, totalCargo, totalPaid, count: sortedPayments.length };
  }, [sortedPayments]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / pageSize));
  const paginatedPayments = useMemo(() => {
    if (pageSize >= 9999) return sortedPayments;
    const start = (currentPage - 1) * pageSize;
    return sortedPayments.slice(start, start + pageSize);
  }, [sortedPayments, currentPage, pageSize]);

  // Reset current page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, vesselFilter, selectedTrade, selectedTerminal, selectedMonth, selectedChargeType, amountRange, pageSize]);

  // Toggle sort direction
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to descending for numbers/amounts
    }
  };

  // Reset all filters
  const hasActiveFilters = Boolean(
    searchQuery.trim() || 
    vesselFilter.trim() ||
    selectedTrade !== 'All' || 
    selectedTerminal !== 'All' || 
    selectedMonth !== 'All' || 
    selectedChargeType !== 'All' || 
    amountRange !== 'All'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setVesselFilter('');
    setSelectedTrade('All');
    setSelectedTerminal('All');
    setSelectedMonth('All');
    setSelectedChargeType('All');
    setAmountRange('All');
  };

  // Export filtered transactions to CSV
  const handleExportCSV = () => {
    if (sortedPayments.length === 0) return;

    const headers = [
      'Control No.',
      'Month',
      'Port Terminal',
      'Vessel Name',
      'Shipping Line / Agency',
      'Consignee',
      'Port Dues (PHP)',
      'Dockage (PHP)',
      'Vessel Total (PHP)',
      'Cargo Wharfage (PHP)',
      'Actual Payment (PHP)'
    ];

    const rows = sortedPayments.map(p => [
      `"${p.controlNo || ''}"`,
      `"${p.month || ''}"`,
      `"${getRecordTerminal(p) || ''}"`,
      `"${(p.vesselName || '').replace(/"/g, '""')}"`,
      `"${(p.shippingAgency || '').replace(/"/g, '""')}"`,
      `"${(p.consignee || '').replace(/"/g, '""')}"`,
      p.portDues || 0,
      p.dockage || 0,
      p.vesselTotal || 0,
      p.cargoTotal || 0,
      p.actualPayment || (p.vesselTotal + p.cargoTotal) || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Voyage_Payments_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/90 overflow-hidden space-y-0">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-black font-mono uppercase tracking-tight text-gray-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-fab-blue" />
              Voyage Payment Transactions Ledger
            </h4>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold">
              {filteredPayments.length} of {payments.length} Records
            </span>
            {vesselFilter.trim() && (
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 font-bold flex items-center gap-1.5 shadow-2xs">
                <Ship className="w-3 h-3 text-cyan-700" />
                Vessel: <span className="font-black uppercase">{vesselFilter}</span>
                <button
                  onClick={() => setVesselFilter('')}
                  className="hover:text-red-600 ml-0.5 p-0.5 rounded cursor-pointer transition-colors"
                  title="Clear vessel filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTerminal !== 'All' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                Terminal: {selectedTerminal}
              </span>
            )}
            {selectedTrade !== 'All' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                Trade: {selectedTrade}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Detailed settlement logs of vessel port dues, dockage, and cargo wharfage fees • Filter and search by vessel name, control number, or terminal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          <div className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            Period: <strong className="text-slate-800">{startMonth.substring(0,3)} — {endMonth.substring(0,3)}</strong>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={sortedPayments.length === 0}
            className="text-xs font-mono font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            title="Download filtered transactions as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Interactive Search & Multi-Filter Control Console */}
      <div className="p-4 sm:p-5 bg-white border-b border-gray-100 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Dedicated Vessel Name Search Filter (Spans 4 cols on PC) */}
          <div className="md:col-span-4 relative">
            <Ship className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 pointer-events-none" />
            <input
              type="text"
              list="vessel-suggestions"
              placeholder="Search / Filter Vessel Name..."
              value={vesselFilter}
              onChange={(e) => setVesselFilter(e.target.value)}
              className={cn(
                "w-full text-xs font-mono pl-9 pr-9 py-2.5 rounded-xl border transition-all shadow-inner uppercase font-bold",
                vesselFilter.trim()
                  ? "bg-cyan-50/80 border-cyan-400 text-cyan-950 focus:ring-2 focus:ring-cyan-500/20"
                  : "bg-cyan-50/30 hover:bg-cyan-50/60 focus:bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              )}
            />
            <datalist id="vessel-suggestions">
              {uniqueVessels.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.count} records)</option>
              ))}
            </datalist>
            {vesselFilter && (
              <button
                onClick={() => setVesselFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-700 hover:text-red-600 p-0.5 rounded transition-colors"
                title="Clear vessel filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Omni-Search Input (Spans 4 cols on PC) */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Control No, Agency, Consignee, Terminal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-mono pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                title="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Trade Filter (Foreign / Domestic / All - Spans 2 cols on PC) */}
          <div className="md:col-span-2 flex items-center bg-slate-50 p-1 border border-slate-200 rounded-xl">
            {(['All', 'Foreign', 'Domestic'] as const).map(trade => (
              <button
                key={trade}
                onClick={() => setSelectedTrade(trade)}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg transition-all text-center cursor-pointer",
                  selectedTrade === trade
                    ? "bg-white text-indigo-900 shadow-xs border border-slate-200/80 font-black"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {trade === 'Foreign' ? 'F' : trade === 'Domestic' ? 'D' : 'All'}
              </button>
            ))}
          </div>

          {/* Terminal Dropdown Selector (Spans 2 cols on PC) */}
          <div className="md:col-span-2">
            <select
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              className="w-full text-xs font-mono py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase cursor-pointer truncate"
            >
              <option value="All">All Terminals</option>
              {uniqueTerminals.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Charges, Amounts, Months, Clear Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Charge Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Charge:</span>
              <select
                value={selectedChargeType}
                onChange={(e) => setSelectedChargeType(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer uppercase"
              >
                <option value="All">All Charges</option>
                <option value="vessel">Vessel Only (&gt; ₱0)</option>
                <option value="cargo">Cargo Only (&gt; ₱0)</option>
                <option value="both">Both Vessel & Cargo</option>
              </select>
            </div>

            {/* Amount Range Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Amount:</span>
              <select
                value={amountRange}
                onChange={(e) => setAmountRange(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer uppercase"
              >
                <option value="All">All Amounts</option>
                <option value="gt1m">&gt; ₱1,000,000 (Major)</option>
                <option value="100k-1m">₱100K – ₱1M</option>
                <option value="lt100k">&lt; ₱100,000</option>
              </select>
            </div>

            {/* Specific Month Filter */}
            {availableMonths.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer uppercase"
                >
                  <option value="All">All Months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Page Size selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>All</option>
              </select>
            </div>

            {/* Quick popular vessels if vessel is not filtered */}
            {!vesselFilter && uniqueVessels.length > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 ml-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
                  <Ship className="w-3 h-3 text-cyan-600" />
                  Top Vessels:
                </span>
                {uniqueVessels.slice(0, 3).map(v => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setVesselFilter(v.name)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-50/70 hover:bg-cyan-100 text-cyan-900 border border-cyan-200/60 font-semibold transition-colors cursor-pointer truncate max-w-[120px]"
                    title={`Filter ledger by ${v.name} (${v.count} calls)`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-mono font-black uppercase text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Live Filter Summary & Financial Aggregates Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs font-mono">
          <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Matched Records</span>
            <span className="text-sm font-black text-slate-900">{aggregates.count}</span>
            <span className="text-[10px] text-slate-400 ml-1">transactions</span>
          </div>
          <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200/80">
            <span className="text-[10px] text-blue-600 uppercase font-bold block">Vessel Charges Sum</span>
            <span className="text-sm font-black text-blue-900">{formatCurrency(aggregates.totalVessel)}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/80">
            <span className="text-[10px] text-emerald-600 uppercase font-bold block">Cargo Wharfage Sum</span>
            <span className="text-sm font-black text-emerald-900">{formatCurrency(aggregates.totalCargo)}</span>
          </div>
          <div className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200/80">
            <span className="text-[10px] text-indigo-600 uppercase font-bold block">Total Settled Value</span>
            <span className="text-sm font-black text-indigo-950">{formatCurrency(aggregates.totalPaid)}</span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#141414] text-white text-[9px] uppercase font-mono tracking-wider select-none">
            <tr>
              <th 
                onClick={() => handleSort('controlNo')}
                className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Control No.</span>
                  {sortField === 'controlNo' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('terminal')}
                className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Port Terminal</span>
                  {sortField === 'terminal' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('vesselName')}
                className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Vessel Name</span>
                  {sortField === 'vesselName' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('shippingAgency')}
                className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Shipping Line / Agency</span>
                  {sortField === 'shippingAgency' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('consignee')}
                className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Consignee</span>
                  {sortField === 'consignee' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('vesselTotal')}
                className="p-3 text-right cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Vessel Charges</span>
                  {sortField === 'vesselTotal' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('cargoTotal')}
                className="p-3 text-right cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Cargo Charges</span>
                  {sortField === 'cargoTotal' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('actualPayment')}
                className="p-3 text-right cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Actual Payment</span>
                  {sortField === 'actualPayment' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th 
                onClick={() => handleSort('month')}
                className="p-3 text-center cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Month</span>
                  {sortField === 'month' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </div>
              </th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-slate-700">
            {paginatedPayments.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-400 font-mono text-xs">
                  <div className="max-w-md mx-auto space-y-2">
                    <p className="font-bold text-slate-600">No transactions match your search filter</p>
                    {vesselFilter && (
                      <p className="text-[11px] text-cyan-700 font-mono">
                        Filtered by vessel: <strong className="font-bold uppercase">"{vesselFilter}"</strong>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 font-sans">
                      Try searching with different terms, clearing the vessel filter, or resetting all search options.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px] hover:bg-indigo-100 transition-colors uppercase cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedPayments.map((p, idx) => {
                const recordTerm = getRecordTerminal(p) || '—';
                const totalSettlement = p.actualPayment || (p.vesselTotal + p.cargoTotal) || 0;

                return (
                  <tr 
                    key={p.controlNo + '-' + idx} 
                    onClick={() => onSelectPayment(p)}
                    className="hover:bg-indigo-50/75 transition-colors cursor-pointer group"
                  >
                    <td className="p-3 font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                      {p.controlNo}
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-700 uppercase">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] whitespace-nowrap">
                        {recordTerm}
                      </span>
                    </td>
                    <td className="p-3 font-semibold uppercase text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 group/vessel">
                        <span>{p.vesselName || 'UNKNOWN'}</span>
                        {p.vesselName && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVesselFilter(p.vesselName);
                            }}
                            className={cn(
                              "p-1 rounded text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 transition-all cursor-pointer",
                              vesselFilter.toUpperCase() === p.vesselName.toUpperCase()
                                ? "opacity-100 text-cyan-700 bg-cyan-100"
                                : "opacity-0 group-hover/vessel:opacity-100"
                            )}
                            title={`Filter transactions for ${p.vesselName}`}
                          >
                            <Filter className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[150px]" title={p.shippingAgency}>
                      {p.shippingAgency || '—'}
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[150px]" title={p.consignee}>
                      {p.consignee || '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-blue-600 whitespace-nowrap">
                      {formatCurrency(p.vesselTotal)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap">
                      {formatCurrency(p.cargoTotal)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(totalSettlement)}
                    </td>
                    <td className="p-3 text-center font-mono text-[10px] uppercase text-slate-500 whitespace-nowrap">
                      {p.month}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase font-bold text-indigo-600 group-hover:text-indigo-800 bg-indigo-50 group-hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                        Inspect →
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {sortedPayments.length > 0 && pageSize < 9999 && (
        <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-slate-900">{Math.min(currentPage * pageSize, sortedPayments.length)}</strong> of{' '}
            <strong className="text-slate-900">{sortedPayments.length}</strong> transactions
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
