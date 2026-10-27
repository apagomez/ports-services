import React from "react";
import { Anchor, ShieldAlert, AlertCircle, AlertTriangle, Info, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { VesselData } from '../types';
import { cn } from '../lib/utils';
import { detectVesselAnomalies } from '../utils/anomalyDetector';
import { formatSystemDate } from '../utils/dateFormatter';
import { normalizeTerminal } from '../utils/terminalNormalizer';

export function VesselTable({
  paginatedData,
  colFilters,
  setColFilters,
  uniqueTerminals,
  uniqueStatuses,
  setSelectedVessel,
  sortField,
  sortOrder,
  onSort
}: {
  paginatedData: VesselData[];
  colFilters: any;
  setColFilters: React.Dispatch<React.SetStateAction<any>>;
  uniqueTerminals: string[];
  uniqueStatuses: string[];
  setSelectedVessel: (v: VesselData) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}) {
  const renderSortIndicator = (field: string) => {
    if (!onSort) return null;
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-white/40 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-fab-gold ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-fab-gold ml-1 inline" />;
  };

  return (
    <section className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden relative">
      <div className="overflow-x-auto max-h-[600px] no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-fab-blue text-white shadow-sm">
              <th 
                onClick={() => onSort?.('controlNo')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>ID</span>
                  {renderSortIndicator('controlNo')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('vesselName')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Vessel Name</span>
                  {renderSortIndicator('vesselName')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('orientation')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Voyage Type</span>
                  {renderSortIndicator('orientation')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('terminal')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Terminal</span>
                  {renderSortIndicator('terminal')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('loadVolume')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Load Volume (MT/CBM)</span>
                  {renderSortIndicator('loadVolume')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('cargoDesc')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Cargo Description</span>
                  {renderSortIndicator('cargoDesc')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('status')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Status</span>
                  {renderSortIndicator('status')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('arrivalDate')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Arrival</span>
                  {renderSortIndicator('arrivalDate')}
                </div>
              </th>
              <th 
                onClick={() => onSort?.('departureDate')}
                className="p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors group select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Departure</span>
                  {renderSortIndicator('departureDate')}
                </div>
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200">
              <td className="p-2 border-r border-slate-200">
                <input 
                  type="text" 
                  placeholder="ID..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.id}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, id: e.target.value }))}
                />
              </td>
              <td className="p-2 border-r border-slate-200">
                <input 
                  type="text" 
                  placeholder="NAME..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.name}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, name: e.target.value }))}
                />
              </td>
              <td className="p-2 border-r border-slate-200">
                <select 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue font-bold uppercase focus:outline-none"
                  value={colFilters.orientation}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, orientation: e.target.value }))}
                >
                  <option value="All">All</option>
                  <option value="Foreign">Foreign</option>
                  <option value="Domestic">Domestic</option>
                </select>
              </td>
              <td className="p-2 border-r border-slate-200">
                <select 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue font-bold uppercase focus:outline-none"
                  value={colFilters.terminal}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, terminal: e.target.value }))}
                >
                  <option value="All">All</option>
                  {uniqueTerminals.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="p-2 border-r border-slate-200">
                <input 
                  type="text" 
                  placeholder="LOAD..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.loadVolume}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, loadVolume: e.target.value }))}
                />
              </td>
              <td className="p-2 border-r border-slate-200">
                <input 
                  type="text" 
                  placeholder="CARGO..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.cargoDesc}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, cargoDesc: e.target.value }))}
                />
              </td>
              <td className="p-2 border-r border-slate-200">
                <select 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue font-bold uppercase focus:outline-none"
                  value={colFilters.status}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="All">All</option>
                  {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="p-2 border-r border-slate-200">
                <input 
                  type="text" 
                  placeholder="ARRIVAL..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.arrival}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, arrival: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input 
                  type="text" 
                  placeholder="DEPARTURE..." 
                  className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                  value={colFilters.departure}
                  onChange={(e) => setColFilters((prev: any) => ({ ...prev, departure: e.target.value }))}
                />
              </td>
            </tr>
          </thead>
          <tbody className="text-[11px] uppercase">
            {paginatedData.map((v, i) => {
              const vAnomalies = detectVesselAnomalies(v);
              const vHasErrors = vAnomalies.some(a => a.level === 'error');
              const vHasWarnings = vAnomalies.some(a => a.level === 'warning');
              const vHasInfos = vAnomalies.some(a => a.level === 'info');

              return (
                <tr 
                  key={`${v.controlNo}-${i}`} 
                  className={cn("border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors", i % 2 === 0 ? "bg-white" : "bg-slate-50")}
                  onClick={() => setSelectedVessel(v)}
                >
                  <td className="p-4 font-mono border-r border-slate-100 text-slate-400">{v.controlNo}</td>
                  <td className="p-4 font-bold border-r border-slate-100 text-fab-blue">
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="truncate max-w-[170px]">{v.vesselName}</span>
                      {vAnomalies.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {vHasErrors && (
                            <span title="Critical Integrity Issue Detected" className="p-0.5 bg-red-100 rounded text-red-600">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {vHasWarnings && (
                            <span title="Operational Warning Detected" className="p-0.5 bg-amber-100 rounded text-amber-600">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {vHasInfos && (
                            <span title="Diagnostic Notice" className="p-0.5 bg-blue-100 rounded text-blue-600">
                              <Info className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-100">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                      v.orientation === 'Foreign' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"
                    )}>
                      {v.orientation}
                    </span>
                  </td>
                  <td className="p-4 border-r border-slate-100 text-[#141414] font-medium text-right">{normalizeTerminal(v.terminal) || 'ANCHORAGE'}</td>
                  <td className="p-4 border-r border-slate-100 text-right font-mono text-slate-600">
                    {v.cargoVolumeCBM && v.cargoVolumeCBM > 0 ? (
                      <span>{Math.round(v.cargoVolumeCBM).toLocaleString()}<span className="text-[9px] text-slate-400 ml-1 font-normal select-none">CBM</span></span>
                    ) : v.cargoVolumeMT && v.cargoVolumeMT > 0 ? (
                      <span>{Math.round(v.cargoVolumeMT).toLocaleString()}<span className="text-[9px] text-slate-400 ml-1 font-normal select-none">MT</span></span>
                    ) : '-'}
                  </td>
                  <td className="p-4 border-r border-slate-100 text-slate-600 text-[10px]">{v.cargoDescription || '-'}</td>
                  <td className="p-4 border-r border-slate-100">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                      v.status.toLowerCase().includes('departed') ? "bg-green-50 text-green-600 border-green-200" : "bg-fab-gold/10 text-fab-gold border-fab-gold/30"
                    )}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-4 border-r border-slate-100 text-slate-400 font-mono italic">{formatSystemDate(v.arrivalDate)}</td>
                  <td className="p-4 text-slate-400 font-mono italic">{v.departureDate ? formatSystemDate(v.departureDate) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
