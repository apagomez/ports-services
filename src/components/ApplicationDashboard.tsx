import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle2, XCircle, Search, Clock, ChevronRight, X, Trash2, RotateCcw } from 'lucide-react';
import { VesselApplication } from '../types';
import { cn } from '../lib/utils';
import { VesselEntryForm } from './VesselEntryForm';
import { appendApplicationToSheet } from '../services/googleSheetsService';

interface ApplicationDashboardProps {
  applications: VesselApplication[];
  onUpdateStatus: (id: string, newStatus: VesselApplication['status']) => void;
  onUpdateApp?: (id: string, updatedApp: Partial<VesselApplication>) => void;
  onDeleteApp?: (id: string) => Promise<void> | void;
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

export const ApplicationDashboard: React.FC<ApplicationDashboardProps> = ({ applications, onUpdateStatus, onUpdateApp, onDeleteApp, options }) => {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<VesselApplication | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const filteredApps = applications.filter(app => 
    (app.vesselName || '').toLowerCase().includes(search.toLowerCase()) || 
    (app.agent && app.agent.toLowerCase().includes(search.toLowerCase())) ||
    (app.status || '').toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="space-y-6 flex flex-col min-h-0 print:m-0 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-fab-blue" /> Vessel Entry Applications
          </h2>
          <p className="text-slate-500 text-sm mt-1">Review and manage pending entry permits from clients.</p>
        </div>
        
        <div className="relative w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-fab-blue transition-colors" />
          <input 
            type="text" 
            placeholder="Search applications..."
            className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-fab-blue/20 focus:border-fab-blue transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
        <AnimatePresence>
          {filteredApps.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl"
            >
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold">No applications found</p>
              <p className="text-sm">There are no applications matching your search.</p>
            </motion.div>
          ) : (
            filteredApps.map((app) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border text-left border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-start"
                onClick={() => setSelectedApp(app)}
              >
                <div className="flex justify-between items-start w-full mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 border-b-2 border-slate-200 inline-block pb-0.5 text-lg uppercase tracking-tight">{app.vesselName || 'Unnamed Vessel'}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-mono">{new Date(app.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider items-center gap-1.5 flex",
                    app.status === 'Pending' ? "bg-amber-100 text-amber-700" :
                    app.status === 'Approved' ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {app.status === 'Pending' && <Clock className="w-3.5 h-3.5" />}
                    {app.status === 'Approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {app.status === 'Rejected' && <XCircle className="w-3.5 h-3.5" />}
                    {app.status}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-sm w-full mt-2 flex-grow">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Agency:</span>
                    <span className="font-medium text-slate-900 text-right uppercase text-[11px] truncate max-w-[150px]">{app.agent || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Type:</span>
                    <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.vesselType || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-500">Voyage:</span>
                    <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.voyageType || '-'} - {app.voyageNo || '-'}</span>
                  </div>
                </div>

                <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-fab-blue text-xs font-bold uppercase tracking-wider group">
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Application Details Modal */}
      <AnimatePresence>
        {selectedApp && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
              onClick={() => setSelectedApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed inset-0 sm:inset-4 md:inset-10 lg:inset-x-20 xl:inset-x-40 bg-white sm:rounded-xl shadow-2xl z-50 overflow-y-auto application-scroll print:static print:inset-auto print:border-none print:shadow-none print:bg-transparent font-sans"
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-40 print:hidden shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-3 py-1 rounded text-xs font-bold uppercase tracking-widest",
                    selectedApp.status === 'Pending' ? "bg-amber-100 text-amber-800" :
                    selectedApp.status === 'Approved' ? "bg-green-100 text-green-800" :
                    "bg-red-100 text-red-800"
                  )}>
                    {selectedApp.status}
                  </span>
                  <span className="text-sm font-mono text-slate-500 font-bold">Ref: {selectedApp.id}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {selectedApp.status === 'Pending' && (
                    <>
                      <button 
                        onClick={async () => {
                          const confirmed = window.confirm('Are you sure you want to approve this application? This will record the application details to the connected Google Sheet.');
                          if (!confirmed) return;
                          
                          try {
                            const updatedApp = { ...selectedApp, status: 'Approved' as const };
                            await appendApplicationToSheet(updatedApp);
                            onUpdateStatus(selectedApp.id, 'Approved');
                            setSelectedApp(updatedApp);
                            alert('Application approved and saved to Google Sheets!');
                          } catch (e: any) {
                            console.error("Sheets Error:", e);
                            alert(`Error saving to Google Sheets:\n\n${e.message}\n\nPlease ensure you have allowed popups and signed in with a Google account that has access to the spreadsheet.`);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button 
                        onClick={() => {
                          onUpdateStatus(selectedApp.id, 'Rejected');
                          setSelectedApp(prev => prev ? { ...prev, status: 'Rejected' } : null);
                        }}
                        className="bg-white border hover:bg-red-50 border-red-200 text-red-600 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                  {selectedApp.status !== 'Pending' && (
                    <button 
                      onClick={() => {
                         onUpdateStatus(selectedApp.id, 'Pending');
                         setSelectedApp(prev => prev ? { ...prev, status: 'Pending' } : null);
                      }}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Revert to Pending
                    </button>
                  )}
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-red-600 uppercase">Are you sure?</span>
                       <button 
                         onClick={async () => {
                           if (onDeleteApp) {
                             await onDeleteApp(selectedApp.id);
                           }
                           setSelectedApp(null);
                           setIsConfirmingDelete(false);
                         }}
                         className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider"
                       >
                         Yes
                       </button>
                       <button 
                         onClick={() => setIsConfirmingDelete(false)}
                         className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider"
                       >
                         No
                       </button>
                    </div>
                  ) : (
                    <div className="relative group flex items-center">
                      <button 
                        onClick={() => setIsConfirmingDelete(true)}
                        className="bg-slate-100 border hover:bg-red-100 hover:text-red-700 hover:border-red-200 text-slate-600 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                      <span className="text-[9px] text-slate-400 absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 bg-white p-1 shadow border rounded">Does not delete from Sheets</span>
                    </div>
                  )}
                  <div className="w-px h-6 bg-slate-300 mx-1"></div>
                  <button 
                    onClick={() => {
                        setSelectedApp(null);
                        setIsConfirmingDelete(false);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-8">
                 <VesselEntryForm 
                   options={options}
                   initialData={selectedApp}
                   isEditMode={true}
                   onBack={() => setSelectedApp(null)}
                   onSubmitApp={(updatedData) => {
                     onUpdateApp?.(selectedApp.id, updatedData);
                     // Let it show success in VesselEntryForm
                   }}
                 />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
