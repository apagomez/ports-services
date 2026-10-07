import React, { useState, useMemo } from 'react';
import { 
  LayoutGrid, 
  ListFilter, 
  Search, 
  X, 
  ArrowUpDown, 
  Anchor, 
  Ship, 
  Building2, 
  Check, 
  ChevronRight,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface TerminalModuleData {
  name: string;
  count: number;
  revenue: number;
  vesselCount: number;
}

interface PortTerminalModulesProps {
  terminals: TerminalModuleData[];
  selectedTerminal: string;
  onSelectTerminal: (terminalName: string) => void;
  formatCurrencyShort: (val: number) => string;
  totalVesselCount?: number;
  totalRevenue?: number;
  className?: string;
}

type SortOption = 'revenue' | 'calls' | 'name';
type ViewMode = 'grid' | 'strip';

export const PortTerminalModules: React.FC<PortTerminalModulesProps> = ({
  terminals,
  selectedTerminal,
  onSelectTerminal,
  formatCurrencyShort,
  totalVesselCount,
  totalRevenue,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('revenue');
  const [viewMode, setViewMode] = useState<ViewMode>('grid'); // Default to grid for PC visibility!

  // Calculate totals if not explicitly passed
  const portTotals = useMemo(() => {
    const rev = totalRevenue ?? terminals.reduce((acc, t) => acc + (t.revenue || 0), 0);
    const calls = totalVesselCount ?? terminals.reduce((acc, t) => acc + (t.vesselCount || 0), 0);
    return { revenue: rev, calls };
  }, [terminals, totalRevenue, totalVesselCount]);

  // Filter and sort the individual terminals
  const filteredAndSortedTerminals = useMemo(() => {
    let list = [...terminals];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'revenue') {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        return b.vesselCount - a.vesselCount;
      }
      if (sortBy === 'calls') {
        if (b.vesselCount !== a.vesselCount) return b.vesselCount - a.vesselCount;
        return b.revenue - a.revenue;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  }, [terminals, searchQuery, sortBy]);

  const isAllSelected = selectedTerminal === 'All';

  // Get active terminal stats if one is selected
  const activeTerminalData = useMemo(() => {
    if (isAllSelected) return null;
    return terminals.find(t => t.name.toUpperCase() === selectedTerminal.toUpperCase());
  }, [terminals, selectedTerminal, isAllSelected]);

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4", className)}>
      {/* Header and Control Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black font-mono uppercase tracking-tight text-slate-900 flex items-center gap-2">
              Port Terminal Modules
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {terminals.length} Terminals
              </span>
            </h3>

            {/* Selection indicator pill */}
            {!isAllSelected && (
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-900 text-white font-bold flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Active Filter: <span className="text-cyan-300 uppercase">{selectedTerminal}</span>
                <button
                  onClick={() => onSelectTerminal('All')}
                  className="hover:text-red-300 ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="Reset to All Terminals"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            Full PC multi-view deck: Select any terminal module to inspect dedicated voyage payments, billing records, and vessel calls.
          </p>
        </div>

        {/* Toolbar: Search, Sort, View Toggle */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Search Box */}
          <div className="relative flex items-center min-w-[160px] sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter terminal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-mono pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-[11px] font-mono">
            <span className="text-slate-400 px-1.5 py-0.5 flex items-center gap-1 text-[10px] uppercase font-bold">
              <ArrowUpDown className="w-3 h-3" />
            </span>
            <button
              onClick={() => setSortBy('revenue')}
              className={cn(
                "px-2 py-1 rounded font-bold uppercase transition-colors text-[10px]",
                sortBy === 'revenue' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
              )}
              title="Sort by highest revenue"
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy('calls')}
              className={cn(
                "px-2 py-1 rounded font-bold uppercase transition-colors text-[10px]",
                sortBy === 'calls' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
              )}
              title="Sort by most vessel calls"
            >
              Calls
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={cn(
                "px-2 py-1 rounded font-bold uppercase transition-colors text-[10px]",
                sortBy === 'name' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
              )}
              title="Sort alphabetically A to Z"
            >
              A–Z
            </button>
          </div>

          {/* View mode toggle (PC Grid vs Horizontal Strip) */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-[11px] font-mono">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-2 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1 text-[10px]",
                viewMode === 'grid' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
              )}
              title="Grid View: See all terminals simultaneously on PC screen"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden sm:inline">Grid (All)</span>
            </button>
            <button
              onClick={() => setViewMode('strip')}
              className={cn(
                "px-2 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1 text-[10px]",
                viewMode === 'strip' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
              )}
              title="Strip View: Compact horizontal carousel"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Strip</span>
            </button>
          </div>

          {/* Reset button if filtered */}
          {!isAllSelected && (
            <button
              onClick={() => onSelectTerminal('All')}
              className="text-[10px] font-mono font-black uppercase text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Modules Display Container */}
      {viewMode === 'grid' ? (
        /* ======================== PC GRID VIEW ======================== */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {/* Master "ALL TERMINALS" Hub Module Card */}
          <button
            onClick={() => onSelectTerminal('All')}
            className={cn(
              "p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative group select-none overflow-hidden",
              isAllSelected
                ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-emerald-400/50"
                : "bg-slate-50 hover:bg-slate-100/90 border-slate-200/90 text-slate-800 hover:border-slate-300"
            )}
          >
            {/* Top row: Pulse indicator and Hub badge */}
            <div className="flex items-center justify-between gap-1 w-full mb-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isAllSelected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-400"
              )} />
              <span className={cn(
                "text-[8px] font-mono uppercase px-1.5 py-0.5 rounded font-extrabold tracking-wider",
                isAllSelected ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" : "bg-slate-200/60 text-slate-600"
              )}>
                MASTER HUB
              </span>
            </div>

            {/* Center: Title */}
            <div className="space-y-0.5 mb-2.5">
              <p className={cn(
                "text-[11px] font-mono font-black uppercase tracking-tight leading-snug",
                isAllSelected ? "text-white" : "text-slate-900"
              )}>
                ALL TERMINALS
              </p>
              <p className={cn(
                "text-[9px] font-mono",
                isAllSelected ? "text-slate-300" : "text-slate-500"
              )}>
                Port-Wide Operations
              </p>
            </div>

            {/* Bottom: Aggregate metrics */}
            <div className={cn(
              "pt-2 border-t text-[10px] font-mono flex items-center justify-between",
              isAllSelected ? "border-white/10 text-emerald-300" : "border-slate-200 text-slate-700"
            )}>
              <span className="font-extrabold">{formatCurrencyShort(portTotals.revenue)}</span>
              <span className={isAllSelected ? "text-slate-300" : "text-slate-500"}>
                {portTotals.calls} calls
              </span>
            </div>
          </button>

          {/* Individual Terminal Cards in Grid */}
          {filteredAndSortedTerminals.map((term) => {
            const isSelected = selectedTerminal.toUpperCase() === term.name.toUpperCase();
            const hasActivity = term.vesselCount > 0 || term.revenue > 0;

            return (
              <button
                key={term.name}
                onClick={() => onSelectTerminal(isSelected ? 'All' : term.name)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative group select-none overflow-hidden",
                  isSelected
                    ? "bg-indigo-950 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/60"
                    : "bg-white hover:bg-indigo-50/30 border-slate-200 hover:border-indigo-300 hover:shadow-xs text-slate-800"
                )}
                title={`${term.name}: ${formatCurrencyShort(term.revenue)} (${term.vesselCount} calls)`}
              >
                {/* Top row: Status dot & badge */}
                <div className="flex items-center justify-between gap-1 w-full mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full transition-transform group-hover:scale-125",
                      isSelected ? "bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.8)]" : 
                      hasActivity ? "bg-indigo-500" : "bg-slate-300"
                    )} />
                    {isSelected && (
                      <span className="text-[7.5px] font-mono px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-200 uppercase font-black tracking-widest border border-cyan-400/30">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-[8px] font-mono uppercase font-bold",
                    isSelected ? "text-indigo-300" : hasActivity ? "text-slate-400" : "text-slate-400/60"
                  )}>
                    {term.count > 0 ? `${term.count} rec` : '0 rec'}
                  </span>
                </div>

                {/* Center: Terminal Name with full wrap */}
                <div className="space-y-0.5 mb-2.5 min-h-[32px] flex items-center">
                  <p className={cn(
                    "text-[10.5px] font-mono font-black uppercase tracking-tight leading-snug break-words",
                    isSelected ? "text-white" : "text-slate-900 group-hover:text-indigo-950"
                  )}>
                    {term.name}
                  </p>
                </div>

                {/* Bottom: Revenue & Vessel Calls */}
                <div className={cn(
                  "pt-2 border-t text-[10px] font-mono flex items-center justify-between",
                  isSelected 
                    ? "border-white/10 text-cyan-300" 
                    : hasActivity
                      ? "border-slate-100 text-indigo-700"
                      : "border-slate-100 text-slate-400"
                )}>
                  <span className="font-extrabold">{formatCurrencyShort(term.revenue)}</span>
                  <span className={cn(
                    "text-[9px]",
                    isSelected ? "text-indigo-200" : "text-slate-500"
                  )}>
                    {term.vesselCount} {term.vesselCount === 1 ? 'call' : 'calls'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ======================== STRIP / CAROUSEL VIEW ======================== */
        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {/* Master "ALL TERMINALS" Hub Module Card in Strip */}
          <button
            onClick={() => onSelectTerminal('All')}
            className={cn(
              "px-4 py-2.5 rounded-xl border text-left transition-all duration-200 whitespace-nowrap cursor-pointer flex-shrink-0 flex items-center gap-3",
              isAllSelected
                ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-emerald-400/50"
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            )}
          >
            <div className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0",
              isAllSelected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-400"
            )} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-mono font-black uppercase leading-none">ALL TERMINALS</p>
                <span className={cn(
                  "text-[7.5px] font-mono uppercase px-1 py-0.2 rounded font-bold",
                  isAllSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-200 text-slate-600"
                )}>
                  HUB
                </span>
              </div>
              <p className={cn("text-[9px] font-mono mt-1 font-bold", isAllSelected ? "text-emerald-300" : "text-slate-600")}>
                {formatCurrencyShort(portTotals.revenue)} • {portTotals.calls} calls
              </p>
            </div>
          </button>

          {/* Individual Terminal Cards in Strip */}
          {filteredAndSortedTerminals.map((term) => {
            const isSelected = selectedTerminal.toUpperCase() === term.name.toUpperCase();
            return (
              <button
                key={term.name}
                onClick={() => onSelectTerminal(isSelected ? 'All' : term.name)}
                className={cn(
                  "px-4 py-2.5 rounded-xl border text-left transition-all duration-200 whitespace-nowrap cursor-pointer flex-shrink-0 flex items-center gap-3 group",
                  isSelected
                    ? "bg-indigo-950 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/60"
                    : "bg-white hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-200 text-slate-800"
                )}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125",
                  isSelected ? "bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.8)]" : "bg-indigo-400"
                )} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-mono font-black uppercase tracking-tight">{term.name}</p>
                    {isSelected && (
                      <span className="text-[7.5px] font-mono px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-200 uppercase font-black">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-[9px] font-mono mt-1 font-bold",
                    isSelected ? "text-cyan-300" : "text-indigo-600"
                  )}>
                    {formatCurrencyShort(term.revenue)} • {term.vesselCount} calls
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty Search State */}
      {filteredAndSortedTerminals.length === 0 && (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs font-mono font-bold text-slate-500 uppercase">
            No terminals matching "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-[10px] font-mono font-bold uppercase text-indigo-600 hover:underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Bottom Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[10px] font-mono text-slate-500 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span>Showing: <strong className="text-slate-800">{filteredAndSortedTerminals.length}</strong> of {terminals.length} terminals</span>
          {searchQuery && (
            <span className="text-indigo-600 font-bold">(Search active)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>Port Total: <strong className="text-slate-900">{formatCurrencyShort(portTotals.revenue)}</strong></span>
          <span className="text-slate-300">•</span>
          <span>Calls: <strong className="text-slate-900">{portTotals.calls}</strong></span>
        </div>
      </div>
    </div>
  );
};
