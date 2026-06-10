import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Clock, 
  ChevronRight, 
  X, 
  Trash2, 
  RotateCcw, 
  ArrowRight,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import { VesselApplication } from '../types';
import { cn } from '../lib/utils';
import { VesselEntryForm } from './VesselEntryForm';
import { PASForm } from './PASForm';
import { getAccessToken } from '../services/googleSheetsService';
import { ProcessMonitoringReport } from './ProcessMonitoringReport';
import { formatSystemDate } from '../utils/dateFormatter';

interface ApplicationDashboardProps {
  applications: VesselApplication[];
  onUpdateStatus: (id: string, newStatus: VesselApplication['status'], extraFields?: Partial<VesselApplication>) => void;
  onUpdateApp?: (id: string, updatedApp: Partial<VesselApplication>) => void;
  onDeleteApp?: (id: string) => Promise<void> | void;
  authRole?: 'admin' | 'user' | 'checker' | 'approver';
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

export const ApplicationDashboard: React.FC<ApplicationDashboardProps> = ({ 
  applications, 
  onUpdateStatus, 
  onUpdateApp, 
  onDeleteApp, 
  authRole = 'admin',
  options 
}) => {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<VesselApplication | null>(null);

  const handleUpdateStatus = async (id: string, newStatus: VesselApplication['status'], extraFields?: Partial<VesselApplication>) => {
    await onUpdateStatus(id, newStatus, extraFields);
    setSelectedApp(prev => prev && prev.id === id ? { ...prev, status: newStatus, ...extraFields } : prev);
  };
  const [viewMode, setViewMode] = useState<'apps' | 'report'>('apps');
  const [selectedType, setSelectedType] = useState<'VEP' | 'PAS'>('VEP');
  
  // Custom dialog confirmations and friendly notifications (to bypass iframe window.confirm/alert blocks)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    actionStyle: string;
    onConfirm: (signerName?: string, signatureData?: string) => void | Promise<void>;
    requireSignature?: boolean;
    roleLabel?: string;
  } | null>(null);
  
  const [dialogSignerName, setDialogSignerName] = useState('');
  const [dialogSignatureType, setDialogSignatureType] = useState<'draw' | 'upload'>('draw');
  const [dialogSignatureData, setDialogSignatureData] = useState('');
  const [isDialogDrawing, setIsDialogDrawing] = useState(false);
  const dialogCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const getDialogMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!dialogCanvasRef.current) return { x: 0, y: 0 };
    const canvas = dialogCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const startDialogDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = dialogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#020617'; // slate-950
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pos = getDialogMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDialogDrawing(true);
  };

  const drawDialog = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDialogDrawing) return;
    e.preventDefault();
    const canvas = dialogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getDialogMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDialogDrawing = () => {
    if (!isDialogDrawing) return;
    setIsDialogDrawing(false);
    saveDialogSignature();
  };

  const clearDialogCanvas = () => {
    const canvas = dialogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDialogSignatureData('');
  };

  const saveDialogSignature = () => {
    const canvas = dialogCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setDialogSignatureData(dataUrl);
  };

  const handleDialogSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setDialogSignatureData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Pipeline Stage Filter
  const [selectedStage, setSelectedStage] = useState<string>('All');
  
  // Set default stage filter based on current officer role to save clicks
  useEffect(() => {
    if (authRole === 'checker') {
      setSelectedStage('Pending Check');
    } else if (authRole === 'approver') {
      setSelectedStage('Pending Approval');
    } else {
      setSelectedStage('All');
    }
  }, [authRole]);

  // Keep selected app status synced if it changes in firestore subscription
  useEffect(() => {
    if (selectedApp) {
      const updated = applications.find(a => a.id === selectedApp.id);
      if (updated) {
        // Safe comparison ensures we keep our local view perfectly synchronized with live Firestore documents
        if (JSON.stringify(updated) !== JSON.stringify(selectedApp)) {
          setSelectedApp(updated);
        }
      }
    }
  }, [applications, selectedApp]);

  // Custom status helpers for colors & icons
  const getStatusBadgeStyles = (status: VesselApplication['status']) => {
    switch (status) {
      case 'Pending Check':
      case 'Pending':
        return "bg-amber-50 border border-amber-200 text-amber-700";
      case 'Pending Approval':
        return "bg-purple-50 border border-purple-200 text-purple-700";
      case 'Approved':
        return "bg-green-50 border border-green-200 text-green-700";
      case 'Rejected':
        return "bg-red-50 border border-red-200 text-red-700";
      default:
        return "bg-slate-50 border border-slate-200 text-slate-700";
    }
  };

  const getStatusLabel = (status: VesselApplication['status']) => {
    if (status === 'Pending' || status === 'Pending Check') {
      return 'Pending Checker';
    }
    if (status === 'Pending Approval') {
      return 'Pending Approver';
    }
    return status;
  };

  const getStatusIcon = (status: VesselApplication['status']) => {
    switch (status) {
      case 'Pending Check':
      case 'Pending':
        return <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />;
      case 'Pending Approval':
        return <Clock className="w-3.5 h-3.5 text-purple-600 animate-pulse" />;
      case 'Approved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
      case 'Rejected':
        return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      default:
        return null;
    }
  };

  // Segment applications by type
  const vepApps = applications.filter(a => a.applicationType !== 'PAS');
  const pasApps = applications.filter(a => a.applicationType === 'PAS');
  const currentTypeApps = selectedType === 'PAS' ? pasApps : vepApps;

  // Build list of stages for filtering
  const stages = [
    { key: 'All', label: 'All', count: currentTypeApps.length },
    { 
      key: 'Pending Check', 
      label: '1. Checker Queue', 
      count: currentTypeApps.filter(a => a.status === 'Pending Check' || a.status === 'Pending').length,
    },
    { 
      key: 'Pending Approval', 
      label: '2. Approver Queue', 
      count: currentTypeApps.filter(a => a.status === 'Pending Approval').length,
    },
    { 
      key: 'Approved', 
      label: 'Approved', 
      count: currentTypeApps.filter(a => a.status === 'Approved').length,
    },
    { 
      key: 'Rejected', 
      label: 'Rejected', 
      count: currentTypeApps.filter(a => a.status === 'Rejected').length,
    }
  ];

  const filteredApps = currentTypeApps.filter(app => {
    // 1. Stage filter
    if (selectedStage !== 'All') {
      if (selectedStage === 'Pending Check') {
        if (app.status !== 'Pending Check' && app.status !== 'Pending') {
          return false;
        }
      } else if (app.status !== selectedStage) {
        return false;
      }
    }
    
    // 2. Search query
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (app.vesselName || '').toLowerCase().includes(searchLower) || 
      (app.agent && app.agent.toLowerCase().includes(searchLower)) ||
      (app.id || '').toLowerCase().includes(searchLower);
      
    return matchesSearch;
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="space-y-6 flex flex-col min-h-0 print:m-0 print:p-0">
      
      {/* Role Notice Banner */}
      <div className={cn(
        "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm",
        authRole === 'checker' ? "bg-amber-50/50 border-amber-200 text-amber-900" :
        authRole === 'approver' ? "bg-purple-50/50 border-purple-200 text-purple-900" :
        "bg-slate-50 border-slate-200 text-slate-800"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            authRole === 'checker' ? "bg-amber-100 text-amber-700" :
            authRole === 'approver' ? "bg-purple-100 text-purple-700" :
            "bg-blue-100 text-blue-700"
          )}>
            {authRole === 'checker' ? <UserCheck className="w-5 h-5" /> :
             authRole === 'approver' ? <ShieldCheck className="w-5 h-5" /> :
             <FileText className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider">
              {authRole === 'checker' && "Port Checker Review Desk"}
              {authRole === 'approver' && "Port Approver Authorization Panel"}
              {authRole === 'admin' && "Full Administrator Command Station"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {authRole === 'checker' && "Ensure physical logs, payload specs, and arrival chronologies match. Forward approved files to the Port Approver."}
              {authRole === 'approver' && "Review checked applications and finalize authorizations. Approved permits will auto-append to the Google Sheet ledger."}
              {authRole === 'admin' && "Oversee, bypass, modify, or delete any applications across either checker or approval pipeline stages."}
            </p>
          </div>
        </div>
      </div>

      {viewMode === 'report' ? (
        <ProcessMonitoringReport 
          applications={applications} 
          onBack={() => setViewMode('apps')} 
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-fab-blue" /> Vessel Entry Applications
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">Review and manage pending entry permits from clients.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <button 
                type="button"
                onClick={() => setViewMode('report')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-2 rounded-lg text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" /> Process Monitoring Report
              </button>
              
              <div className="relative w-full lg:w-64 group">
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
          </div>

          {/* Application Type Tabs Grid to separate each type completely */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
            <button
              onClick={() => {
                setSelectedType('VEP');
              }}
              className={cn(
                "p-4 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer",
                selectedType === 'VEP'
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={cn("font-bold text-sm uppercase tracking-wider", selectedType === 'VEP' ? "text-white" : "text-slate-800")}>
                    Vessel Entry Permits (VEP)
                  </h3>
                  <p className={cn("text-xs mt-1", selectedType === 'VEP' ? "text-slate-300" : "text-slate-500")}>
                    Review and authorize vessel arrival & docking applications.
                  </p>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedType === 'VEP' ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                )}>
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={cn("text-2xl font-black", selectedType === 'VEP' ? "text-white" : "text-slate-900")}>
                  {vepApps.length}
                </span>
                <span className={cn("text-[10px] font-bold uppercase", selectedType === 'VEP' ? "text-slate-400" : "text-slate-500")}>
                  Total VEP Applications
                </span>
              </div>
              {selectedType === 'VEP' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-fab-red" />
              )}
            </button>

            <button
              onClick={() => {
                setSelectedType('PAS');
              }}
              className={cn(
                "p-4 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer",
                selectedType === 'PAS'
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={cn("font-bold text-sm uppercase tracking-wider", selectedType === 'PAS' ? "text-white" : "text-slate-800")}>
                    Port Ancillary Services (PAS)
                  </h3>
                  <p className={cn("text-xs mt-1", selectedType === 'PAS' ? "text-slate-300" : "text-slate-500")}>
                    Review and authorize port ancillary, bunkering, & waste services.
                  </p>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedType === 'PAS' ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                )}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={cn("text-2xl font-black", selectedType === 'PAS' ? "text-white" : "text-slate-900")}>
                  {pasApps.length}
                </span>
                <span className={cn("text-[10px] font-bold uppercase", selectedType === 'PAS' ? "text-slate-400" : "text-slate-500")}>
                  Total PAS Applications
                </span>
              </div>
              {selectedType === 'PAS' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-fab-red" />
              )}
            </button>
          </div>

          {/* Pipeline Stage Tracker Headers */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-px print:hidden bg-slate-100/50 p-1.5 rounded-lg">
            {stages.map((st) => (
              <button
                key={st.key}
                onClick={() => setSelectedStage(st.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2",
                  selectedStage === st.key 
                    ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-b-2 border-b-fab-blue" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {st.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  selectedStage === st.key ? "bg-fab-blue/10 text-fab-blue" : "bg-slate-200 text-slate-600"
                )}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          {/* Grid of Applications */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
            <AnimatePresence>
              {filteredApps.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-16 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-white"
                >
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-slate-700">No applications in this queue</p>
                  <p className="text-sm text-slate-400 mt-1">There are no applications matching the stage filter.</p>
                </motion.div>
              ) : (
                filteredApps.map((app) => (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white border text-left border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-start relative group"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="flex justify-between items-start w-full mb-3">
                      <div>
                        {app.applicationType === 'PAS' && (
                          <span className="text-[8px] font-black bg-purple-100 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded tracking-wider uppercase block w-max mb-1.5">Port Ancillary Service</span>
                        )}
                        <h3 className="font-bold text-slate-900 border-b-2 border-slate-200 inline-block pb-0.5 text-lg uppercase tracking-tight">{app.vesselName || 'Unnamed Vessel'}</h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase font-mono">{formatSystemDate(app.createdAt)}</p>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider items-center gap-1.5 flex",
                        getStatusBadgeStyles(app.status)
                      )}>
                        {getStatusIcon(app.status)}
                        {getStatusLabel(app.status)}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 text-sm w-full mt-2 flex-grow">
                      {app.applicationType === 'PAS' ? (
                        <>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Provider:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px] truncate max-w-[150px]">{app.serviceProviderName || '-'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Terminal:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.terminal || '-'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Voyage / Call:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.voyageType || 'Domestic'} - {app.voyageNo || '-'}</span>
                          </div>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>

                    {/* Progress Indicators */}
                    <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-fab-blue text-xs font-bold uppercase tracking-wider group-hover:text-amber-600 transition-colors">
                      <span className="flex items-center gap-1.5">
                        View Details & Action
                      </span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Application Details Modal with Visual Progress Pipeline */}
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
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex flex-col lg:flex-row items-center justify-between gap-4 z-40 print:hidden shadow-sm">
                
                {/* Status Badges or Ref */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn(
                    "px-3 py-1 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-1.5",
                    getStatusBadgeStyles(selectedApp.status)
                  )}>
                    {getStatusIcon(selectedApp.status)}
                    {getStatusLabel(selectedApp.status)}
                  </span>
                  <span className="text-sm font-mono text-slate-500 font-bold">Ref: {selectedApp.id}</span>
                </div>

                {/* VISUAL PIPELINE FLOW TRACKER */}
                <div className="flex items-center text-[10px] font-bold uppercase tracking-wider gap-2 text-slate-400">
                  <div className="flex items-center gap-1 text-green-600">
                    <span className="w-5 h-5 bg-green-100 border border-green-200 text-green-700 rounded-full flex items-center justify-center text-[9px]">1</span>
                    <span>Submit</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  
                  <div className={cn(
                    "flex items-center gap-1",
                    (selectedApp.status === 'Pending Check' || selectedApp.status === 'Pending') ? "text-amber-600 font-extrabold animate-pulse" :
                    (selectedApp.status === 'Pending Approval' || selectedApp.status === 'Approved') ? "text-green-600" :
                    "text-slate-400"
                  )}>
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] border",
                      (selectedApp.status === 'Pending Check' || selectedApp.status === 'Pending') ? "bg-amber-100 border-amber-300 text-amber-700" :
                      (selectedApp.status === 'Pending Approval' || selectedApp.status === 'Approved') ? "bg-green-100 border-green-300 text-green-700" :
                      "bg-slate-100 border-slate-200 text-slate-500"
                    )}>
                      2
                    </span>
                    <span>Checker</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-300" />

                  <div className={cn(
                    "flex items-center gap-1",
                    selectedApp.status === 'Pending Approval' ? "text-purple-600 font-extrabold animate-pulse" :
                    selectedApp.status === 'Approved' ? "text-green-600" :
                    "text-slate-400"
                  )}>
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] border",
                      selectedApp.status === 'Pending Approval' ? "bg-purple-100 border-purple-300 text-purple-700" :
                      selectedApp.status === 'Approved' ? "bg-green-100 border-green-300 text-green-700" :
                      "bg-slate-100 border-slate-200 text-slate-500"
                    )}>
                      3
                    </span>
                    <span>Approver</span>
                  </div>
                </div>
                
                {/* ACTIONS CORNER */}
                <div className="flex flex-wrap items-center gap-2">
                  
                  {/* Action buttons based on status and role */}
                  {(selectedApp.status === 'Pending Check' || selectedApp.status === 'Pending') && (
                    <>
                      {(authRole === 'checker' || authRole === 'admin') ? (
                        <>
                          <button 
                            onClick={() => {
                              setDialogSignerName('');
                              setDialogSignatureType('draw');
                              setDialogSignatureData('');
                              setConfirmDialog({
                                title: "Verify Vessel Station",
                                message: "Confirming verification certifies that all arrival indices, berth targets, and declarations are validated. Please fill your name and sign-off below to route this application to the Chief Port Approver's review station.",
                                actionLabel: "Verify & Pass",
                                actionStyle: "bg-purple-600 hover:bg-purple-700",
                                requireSignature: true,
                                roleLabel: "Port Checker Full Name",
                                onConfirm: async (signerName, signatureData) => {
                                  const today = new Date().toISOString();
                                  await handleUpdateStatus(selectedApp.id, 'Pending Approval', {
                                    checkedByName: signerName,
                                    checkedAt: today,
                                    checkedSignatureData: signatureData
                                  });
                                  setToast({ type: 'success', message: 'Application successfully verified and routed to the Port Approver.' });
                                }
                              });
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Verify & Pass to Approver
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmDialog({
                                title: "Reject Vessel Proposal",
                                message: "Are you sure you want to reject this vessel's entry proposal? The applicant will be notified of this action.",
                                actionLabel: "Reject Entry",
                                actionStyle: "bg-red-600 hover:bg-red-700",
                                onConfirm: async () => {
                                  await handleUpdateStatus(selectedApp.id, 'Rejected');
                                  setToast({ type: 'error', message: 'The vessel application was flagged and rejected.' });
                                }
                              });
                            }}
                            className="bg-white border hover:bg-red-50 border-red-200 text-red-600 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      ) : (
                        <div className="bg-amber-50 text-amber-800 text-[11px] px-3.5 py-2 rounded-lg font-bold border border-amber-200 uppercase tracking-wide select-none text-center">
                          {authRole === 'approver' 
                            ? "Awaiting Port Checker Review — Approver cannot approve directly" 
                            : "Awaiting Port Checker Verification"
                          }
                        </div>
                      )}
                    </>
                  )}

                  {selectedApp.status === 'Pending Approval' && (
                    <>
                      {(authRole === 'approver' || authRole === 'admin') ? (
                        <>
                          <button 
                            onClick={async () => {
                              setDialogSignerName('');
                              setDialogSignatureType('draw');
                              setDialogSignatureData('');
                              const token = await getAccessToken();
                              const msgSuffix = token 
                                ? "Please fill your name and sign-off below to archive parameters offline and log records in the official Google Sheet ledger."
                                : "Warning: No active Google Sheets connection detected. You can still approve this permit inside the portal; however, it will not be synced to Google Sheets. Fill your name and sign-off below to issue approval.";
                              setConfirmDialog({
                                title: "Authorize Entry Permit Station",
                                message: `Issue formal approval for this vessel entry permit? ${msgSuffix}`,
                                actionLabel: "Approve & Issue",
                                actionStyle: "bg-green-600 hover:bg-green-700",
                                requireSignature: true,
                                roleLabel: "Port Approver Full Name",
                                onConfirm: async (signerName, signatureData) => {
                                  try {
                                    const today = new Date().toISOString();
                                    await handleUpdateStatus(selectedApp.id, 'Approved', {
                                      approvedByName: signerName,
                                      approvedAt: today,
                                      approvedSignatureData: signatureData
                                    });
                                    setToast({ type: 'success', message: 'Vessel application finalized! Approved and logged.' });
                                  } catch (e: any) {
                                    console.error("Approval state update failed:", e);
                                    setToast({ type: 'error', message: `Approval failed to save: ${e.message}` });
                                  }
                                }
                              });
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Authorize & Approve Entry
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmDialog({
                                title: "Confirm Deny",
                                message: "Are you sure you want to deny this authorization and re-route this application to the rejected archive?",
                                actionLabel: "Deny & Reject",
                                actionStyle: "bg-red-600 hover:bg-red-700",
                                onConfirm: async () => {
                                  await handleUpdateStatus(selectedApp.id, 'Rejected');
                                  setToast({ type: 'error', message: 'Authorization denied and application stored as rejected.' });
                                }
                              });
                            }}
                            className="bg-white border hover:bg-red-50 border-red-200 text-red-600 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> Deny Approve
                          </button>
                        </>
                      ) : (
                        <div className="bg-purple-50 text-purple-800 text-xs px-3 py-1.5 rounded-lg font-bold border border-purple-200 uppercase tracking-wider select-none">
                          Awaiting Approver Authorization
                        </div>
                      )}
                    </>
                  )}

                  {selectedApp.status === 'Approved' && (
                    <div className="flex items-center gap-1.5">
                      <div className="bg-green-100 border border-green-300 text-green-800 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider select-none">
                        Approved & Saved to Sheets
                      </div>
                      {authRole === 'admin' && (
                        <button 
                          onClick={() => {
                            setConfirmDialog({
                              title: "Revert Application",
                              message: `Are you sure you want to revert this Approved application ("${selectedApp.vesselName || 'Unnamed'}") back to the Port Checker review queue? This action will clear all checker and approver signatures, allowing a fresh review cycle.`,
                              actionLabel: "Revert to Pending Check",
                              actionStyle: "bg-amber-600 hover:bg-amber-700",
                              onConfirm: async () => {
                                const clearedFields = {
                                  checkedByName: '',
                                  checkedAt: '',
                                  checkedSignatureData: '',
                                  approvedByName: '',
                                  approvedAt: '',
                                  approvedSignatureData: ''
                                };
                                await handleUpdateStatus(selectedApp.id, 'Pending Check', clearedFields);
                                setToast({ type: 'success', message: 'Application successfully reverted to Port Checker queue with sign-offs cleared!' });
                              }
                            });
                          }}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Revert
                        </button>
                      )}
                    </div>
                  )}

                  {selectedApp.status === 'Rejected' && (
                    <div className="flex items-center gap-1.5">
                      <div className="bg-red-50 text-red-800 text-xs px-3 py-1.5 rounded-lg font-bold border border-red-200 uppercase tracking-wider select-none">
                        Rejected
                      </div>
                      {(authRole === 'admin' || authRole === 'checker' || authRole === 'approver') && (
                        <button 
                          onClick={() => {
                            setConfirmDialog({
                              title: "Restart Application",
                              message: `Are you sure you want to restart this Rejected application ("${selectedApp.vesselName || 'Unnamed'}")? It will be returned to the Port Checker's review queue.`,
                              actionLabel: "Restart Application",
                              actionStyle: "bg-amber-600 hover:bg-amber-700",
                              onConfirm: async () => {
                                const clearedFields = {
                                  checkedByName: '',
                                  checkedAt: '',
                                  checkedSignatureData: '',
                                  approvedByName: '',
                                  approvedAt: '',
                                  approvedSignatureData: ''
                                };
                                await handleUpdateStatus(selectedApp.id, 'Pending Check', clearedFields);
                                setToast({ type: 'success', message: 'Application status restarted and returned to the Checker queue!' });
                              }
                            });
                          }}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Restart
                        </button>
                      )}
                    </div>
                  )}

                  {(authRole === 'admin' || authRole === 'checker' || authRole === 'approver') && (
                    <button 
                      onClick={() => {
                        setConfirmDialog({
                          title: "Delete Vessel Application",
                          message: `Are you sure you want to permanently delete and purge this vessel application ("${selectedApp.vesselName || 'Unnamed Vessel'}") from the database? This operation is IRREVERSIBLE.`,
                          actionLabel: "Permanently Delete",
                          actionStyle: "bg-red-600 hover:bg-red-700",
                          onConfirm: async () => {
                            try {
                              if (onDeleteApp) {
                                await onDeleteApp(selectedApp.id);
                              }
                              setSelectedApp(null);
                              setToast({ type: 'success', message: 'Application successfully deleted and purged from database!' });
                            } catch (error: any) {
                              console.error("Deletion error in dashboard:", error);
                              setToast({ type: 'error', message: `Purge failed: ${error.message || error}` });
                            }
                          }
                        });
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-px h-6 bg-slate-300 mx-1"></div>
                  <button 
                    onClick={() => {
                        setSelectedApp(null);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-8">
                {selectedApp.applicationType === 'PAS' ? (
                  <PASForm 
                    key={`pas-${selectedApp.id}-${selectedApp.status}-${selectedApp.checkedAt || ''}-${selectedApp.approvedAt || ''}`}
                    options={options}
                    initialData={selectedApp}
                    isEditMode={true}
                    onBack={() => setSelectedApp(null)}
                    onSubmitApp={(updatedData) => {
                      onUpdateApp?.(selectedApp.id, updatedData);
                    }}
                  />
                ) : (
                  <VesselEntryForm 
                    key={`vep-${selectedApp.id}-${selectedApp.status}-${selectedApp.checkedAt || ''}-${selectedApp.approvedAt || ''}`}
                    options={options}
                    initialData={selectedApp}
                    isEditMode={true}
                    isAdmin={true}
                    onBack={() => setSelectedApp(null)}
                    onSubmitApp={(updatedData) => {
                      onUpdateApp?.(selectedApp.id, updatedData);
                    }}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Dialog for Iframe Support */}
      <AnimatePresence>
        {confirmDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60]"
              onClick={() => setConfirmDialog(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-white rounded-xl shadow-2xl p-6 z-[70] border border-slate-200 text-left overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-base font-bold text-slate-900 mb-2 uppercase tracking-wide flex items-center gap-2 font-sans">
                <ShieldCheck className="w-5 h-5 text-fab-blue" />
                {confirmDialog.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4 font-sans border-b border-slate-100 pb-3">
                {confirmDialog.message}
              </p>

              {confirmDialog.requireSignature && (
                <div className="space-y-4 mb-6 font-sans">
                  {/* Name input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1">
                      {confirmDialog.roleLabel || "Authorized Signer Name"} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={dialogSignerName}
                      onChange={(e) => setDialogSignerName(e.target.value.toUpperCase())}
                      placeholder="e.g. JUAN DELA CRUZ"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 outline-none focus:border-fab-blue transition-colors focus:ring-1 focus:ring-fab-blue"
                      required
                    />
                  </div>

                  {/* Signature Type Tabs */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                      Signature Method <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDialogSignatureType('draw');
                          setDialogSignatureData('');
                        }}
                        className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded border uppercase tracking-wider transition-all duration-150 ${
                          dialogSignatureType === 'draw'
                            ? 'bg-fab-blue text-white border-fab-blue shadow-sm'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        🖋️ Draw
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDialogSignatureType('upload');
                          setDialogSignatureData('');
                        }}
                        className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded border uppercase tracking-wider transition-all duration-150 ${
                          dialogSignatureType === 'upload'
                            ? 'bg-fab-blue text-white border-fab-blue shadow-sm'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        📁 Upload
                      </button>
                    </div>
                  </div>

                  {/* Canvas or Upload area */}
                  {dialogSignatureType === 'draw' ? (
                    <div className="bg-slate-50 border border-slate-300 rounded p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Sign inside box:</span>
                        <button
                          type="button"
                          onClick={clearDialogCanvas}
                          className="text-[9px] font-bold uppercase tracking-wider text-red-600 hover:text-red-800 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="border border-dashed border-slate-300 rounded overflow-hidden bg-white">
                        <canvas
                          ref={dialogCanvasRef}
                          width={400}
                          height={120}
                          onMouseDown={startDialogDrawing}
                          onMouseMove={drawDialog}
                          onMouseUp={stopDialogDrawing}
                          onMouseLeave={stopDialogDrawing}
                          onTouchStart={startDialogDrawing}
                          onTouchMove={drawDialog}
                          onTouchEnd={stopDialogDrawing}
                          className="w-full h-24 cursor-crosshair touch-none bg-white block"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-300 rounded p-4 flex flex-col items-center justify-center text-center h-[130px]">
                      {dialogSignatureData ? (
                        <div className="flex flex-col items-center justify-between h-full w-full font-sans">
                          <div className="flex-1 flex items-center justify-center">
                            <img
                              src={dialogSignatureData}
                              alt="Uploaded signature"
                              className="max-h-16 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setDialogSignatureData('')}
                            className="text-[9px] font-extrabold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors pt-1"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleDialogSignatureUpload}
                            id="dialog-signature-file-uploader"
                            className="hidden"
                          />
                          <label
                            htmlFor="dialog-signature-file-uploader"
                            className="inline-block cursor-pointer px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-bold text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                          >
                            Browse Signature
                          </label>
                          <p className="text-[9px] text-slate-400 mt-1">
                            Supported: PNG, JPEG (transparent background ideal)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!dialogSignatureData && (
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest animate-pulse">
                      ⚠️ Awaiting signature sign-off to authorize
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 font-semibold uppercase tracking-wider text-xs font-sans border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!confirmDialog.requireSignature && (!dialogSignerName.trim() || !dialogSignatureData)}
                  onClick={async () => {
                    const action = confirmDialog.onConfirm;
                    const name = dialogSignerName;
                    const sig = dialogSignatureData;
                    setConfirmDialog(null);
                    await action(name, sig);
                  }}
                  className={cn(
                    "px-4 py-2 text-white rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed", 
                    confirmDialog.actionStyle
                  )}
                >
                  {confirmDialog.actionLabel}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Elegant Custom Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="fixed bottom-6 right-6 z-[80] shadow-xl rounded-lg p-4 max-w-md flex items-start gap-3 border border-l-4 font-sans bg-white"
            style={{
              borderColor: '#e2e8f0',
              borderLeftColor: toast.type === 'success' ? '#22c55e' : '#ef4444'
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {toast.type === 'success' ? 'Task Completed' : 'Warning / Error'}
              </p>
              <p className="text-slate-500 text-xs mt-1 font-medium leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
