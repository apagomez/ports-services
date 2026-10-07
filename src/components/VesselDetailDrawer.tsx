import { motion, AnimatePresence } from 'motion/react';
import { Ship, Anchor, Globe, ChevronRight, ShieldAlert, AlertCircle, AlertTriangle, Info, Package } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { VesselData } from '../types';
import { DetailItem, TRENDING_UP } from './common';
import { cn } from '../lib/utils';
import { detectVesselAnomalies } from '../utils/anomalyDetector';
import { formatSystemDate } from '../utils/dateFormatter';

export function VesselDetailDrawer({ 
  selectedVessel, 
  setSelectedVessel, 
  data 
}: { 
  selectedVessel: VesselData | null, 
  setSelectedVessel: (v: VesselData | null) => void,
  data: VesselData[]
}) {
  return (
    <AnimatePresence>
      {selectedVessel && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedVessel(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#E4E3E0] border-l-2 border-[#141414] z-[101] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-xs font-mono opacity-50 uppercase tracking-widest">{selectedVessel.controlNo}</span>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase leading-tight">{selectedVessel.vesselName}</h2>
                </div>
                <button 
                  onClick={() => setSelectedVessel(null)}
                  className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              {/* Vessel Identifiers */}
              <div className="mb-8 p-3 rounded-lg bg-white border border-[#141414] shadow-[3px_3px_0px_0px_#141414] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-fab-blue rounded border border-blue-200">
                    <Ship className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono font-black text-slate-400 block tracking-wider">
                      Vessel Entry Record
                    </span>
                    <span className="font-extrabold text-[#141414] text-xs">
                      {selectedVessel.vesselName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[9.5px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    Control: {selectedVessel.controlNo}
                  </span>
                  <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                    AVE #{selectedVessel.aveNumber || '000'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <DetailItem label="Vessel Type" value={selectedVessel.vesselType} icon={Ship} />
                <DetailItem label="Status" value={selectedVessel.status} icon={Anchor} />
                <DetailItem label="Registry" value={selectedVessel.registry} icon={Globe} />
                <DetailItem label="Gross Tonnage" value={selectedVessel.gt?.toLocaleString()} icon={TRENDING_UP} />
                <DetailItem label="Origin Port" value={selectedVessel.origin} icon={Anchor} />
                <DetailItem label="Next Destination" value={selectedVessel.nextPort} icon={Anchor} />
                <DetailItem label="Agent" value={selectedVessel.agent} icon={Ship} />
                <DetailItem label="Terminal" value={selectedVessel.terminal} icon={ChevronRight} />
              </div>

              <div className="space-y-6">
                {/* Automated Anomaly Detection Panel */}
                {(() => {
                  const vesselAnomalies = detectVesselAnomalies(selectedVessel);
                  return (
                    <div className="border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_0px_#141414]">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-blue-900" /> Health Diagnostic Checks
                      </h4>
                      
                      {vesselAnomalies.length === 0 ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide">Vessel Health Record: Normal</p>
                            <p className="text-[10px] opacity-75">No automated operational anomalies, data mismatches, or efficiency alerts were identified for this transit.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {vesselAnomalies.length} Automated Flag(s) Identified
                          </div>
                          <div className="space-y-2.5">
                            {vesselAnomalies.map((a, idx) => {
                              const isError = a.level === 'error';
                              const isWarning = a.level === 'warning';
                              return (
                                <div 
                                  key={idx} 
                                  className={cn(
                                    "border p-3 rounded-lg flex gap-3 transition-colors",
                                    isError ? "bg-red-50/50 border-red-200 text-red-950" :
                                    isWarning ? "bg-amber-50/50 border-amber-200 text-amber-950" :
                                    "bg-blue-50/50 border-blue-200 text-blue-950"
                                  )}
                                >
                                  <div className="mt-0.5 flex-shrink-0">
                                    {isError ? <AlertCircle className="w-4 h-4 text-red-600" /> :
                                     isWarning ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
                                     <Info className="w-4 h-4 text-blue-600" />}
                                  </div>
                                  <div className="space-y-0.5 w-full">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap w-full">
                                      <h5 className="text-xs font-extrabold uppercase tracking-tight">{a.title}</h5>
                                      <span className={cn(
                                        "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider",
                                        isError ? "bg-red-200 text-red-800" :
                                        isWarning ? "bg-amber-200 text-amber-800" :
                                        "bg-blue-200 text-blue-800"
                                      )}>
                                        {a.category}
                                      </span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed opacity-85">{a.message}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="border border-[#141414] p-6 bg-white">
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4 flex items-center gap-2">
                     <Package className="w-3 h-3" /> Cargo Information
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs opacity-50 mb-1">Description</p>
                      <p className="font-bold text-lg uppercase tracking-tight">{selectedVessel.cargoDescription || 'NONE REPORTED'}</p>
                    </div>
                    <div className="flex gap-8 flex-wrap">
                      {selectedVessel.cargoVolumeMT > 0 && (
                        <div>
                          <p className="text-xs opacity-50 mb-1">Volume (MT)</p>
                          <p className="font-mono text-xl">{selectedVessel.cargoVolumeMT.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedVessel.cargoVolumeCBM > 0 && (
                        <div>
                          <p className="text-xs opacity-50 mb-1">Volume (CBM)</p>
                          <p className="font-mono text-xl text-amber-600">{selectedVessel.cargoVolumeCBM.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs opacity-50 mb-1">Shipment Type</p>
                        <p className="font-mono uppercase">{selectedVessel.shipmentKind || 'N/A'}</p>
                      </div>
                    </div>

                    {(() => {
                      const parseVesselDate = (dateStr: string) => {
                        if (!dateStr) return new Date(0);
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                          const day = parseInt(parts[0], 10);
                          const mStr = parts[1].toLowerCase();
                          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                          const monthIdx = monthNames.findIndex(m => mStr.startsWith(m));
                          let year = parseInt(parts[2], 10);
                          if (year < 100) year += 2000;
                          if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
                            return new Date(year, monthIdx, day);
                          }
                        }
                        const parsed = new Date(dateStr);
                        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
                      };

                      const historicalVoyages = data
                        .filter(v => v.vesselName.toLowerCase() === selectedVessel.vesselName.toLowerCase())
                        .sort((a, b) => parseVesselDate(a.arrivalDate).getTime() - parseVesselDate(b.arrivalDate).getTime())
                        .slice(-5)
                        .map(v => ({
                          voyageNo: v.voyageNo || 'N/A',
                          volumeMT: v.cargoVolumeMT || 0,
                          volumeCBM: v.cargoVolumeCBM || 0,
                          label: v.voyageNo ? `V-${v.voyageNo}` : 'N/A',
                        }));

                      const hasMT = historicalVoyages.some(v => v.volumeMT > 0);
                      const hasCBM = historicalVoyages.some(v => v.volumeCBM > 0);

                      if (historicalVoyages.length === 0 || (!hasMT && !hasCBM)) return null;

                      return (
                        <div className="pt-4 border-t border-slate-100 mt-2">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">Voyage Cargo History (Last 5 Voyages)</p>
                          <div className="h-28 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={historicalVoyages} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" fontSize={8} stroke="#94a3b8" />
                                <YAxis fontSize={8} stroke="#94a3b8" />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#FFFFFF', fontSize: '9px', padding: '6px' }}
                                  itemStyle={{ color: '#FFFFFF', padding: '2px 0' }}
                                  labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '2px' }}
                                />
                                {hasMT && (
                                  <Line 
                                    type="monotone" 
                                    dataKey="volumeMT" 
                                    name="Vol (MT)" 
                                    stroke="#004a99" 
                                    strokeWidth={2} 
                                    dot={{ r: 3 }} 
                                    activeDot={{ r: 5 }} 
                                  />
                                )}
                                {hasCBM && (
                                  <Line 
                                    type="monotone" 
                                    dataKey="volumeCBM" 
                                    name="Vol (CBM)" 
                                    stroke="#d97706" 
                                    strokeWidth={2} 
                                    dot={{ r: 3 }} 
                                    activeDot={{ r: 5 }} 
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="border border-[#141414] p-6 bg-[#141414] text-[#E4E3E0]">
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4">Operational Logs</h4>
                  <ul className="space-y-3 font-mono text-[10px] uppercase">
                    <li className="flex justify-between border-b border-[#E4E3E022] pb-2">
                      <span className="opacity-60">Arrival Date</span>
                      <span>{formatSystemDate(selectedVessel.arrivalDate)}</span>
                    </li>
                    <li className="flex justify-between border-b border-[#E4E3E022] pb-2">
                      <span className="opacity-60">Departure Date</span>
                      <span>{formatSystemDate(selectedVessel.departureDate)}</span>
                    </li>
                    <li className="flex justify-between border-b border-[#E4E3E022] pb-2">
                      <span className="opacity-60">Voyage No</span>
                      <span>{selectedVessel.voyageNo}</span>
                    </li>
                    <li className="flex justify-between border-b border-[#E4E3E022] pb-2">
                      <span className="opacity-60">Motorized</span>
                      <span>{selectedVessel.motorized}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="opacity-60">Passengers</span>
                      <span>{selectedVessel.passengers}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
