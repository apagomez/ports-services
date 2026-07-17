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
  FileSpreadsheet,
  Settings
} from 'lucide-react';
import { VesselApplication } from '../types';
import { cn } from '../lib/utils';
import { VesselEntryForm } from './VesselEntryForm';
import { PASForm } from './PASForm';
import { GatePassForm } from './GatePassForm';
import { 
  getAccessToken, 
  googleSignIn, 
  logout as googleLogout, 
  initAuth as googleInitAuth,
  getVesselMasterSpreadsheetId,
  setVesselMasterSpreadsheetId,
  getProcessMonitoringSpreadsheetId,
  setProcessMonitoringSpreadsheetId,
  getPaymentsSpreadsheetId,
  setPaymentsSpreadsheetId
} from '../services/googleSheetsService';
import { ProcessMonitoringReport } from './ProcessMonitoringReport';
import { formatSystemDate, formatSystemDateTime } from '../utils/dateFormatter';

interface ApplicationDashboardProps {
  applications: VesselApplication[];
  onUpdateStatus: (id: string, newStatus: VesselApplication['status'], extraFields?: Partial<VesselApplication>) => void;
  onUpdateApp?: (id: string, updatedApp: Partial<VesselApplication>) => Promise<void> | void;
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

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);

  const [showSheetSettings, setShowSheetSettings] = useState(false);
  const [vesselMasterId, setVesselMasterId] = useState('');
  const [processMonitoringId, setProcessMonitoringId] = useState('');
  const [paymentsId, setPaymentsId] = useState('');

  useEffect(() => {
    setVesselMasterId(getVesselMasterSpreadsheetId());
    setProcessMonitoringId(getProcessMonitoringSpreadsheetId());
    setPaymentsId(getPaymentsSpreadsheetId());
  }, []);

  const handleSaveSheetSettings = () => {
    setVesselMasterSpreadsheetId(vesselMasterId);
    setProcessMonitoringSpreadsheetId(processMonitoringId);
    setPaymentsSpreadsheetId(paymentsId);
    setToast({ type: 'success', message: 'Spreadsheet connection parameters updated!' });
    setShowSheetSettings(false);
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  useEffect(() => {
    let unsubscribe: any;
    try {
      unsubscribe = googleInitAuth(
        (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
        },
        () => {
          setGoogleUser(null);
          setGoogleToken(null);
        }
      );
    } catch (e) {
      console.warn("initAuth failed:", e);
    }
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setIsGoogleConnecting(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setToast({ type: 'success', message: `Connected Google Sheets: ${res.user.email}` });
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user')) {
        setToast({ type: 'error', message: 'Google Sheets connection cancelled (popup closed).' });
        return;
      }
      setToast({ type: 'error', message: `Google Connection Failed: ${error.message}` });
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setToast({ type: 'success', message: 'Google Sheets account unlinked.' });
    } catch (error: any) {
      console.error('Google Sheets sign out failed:', error);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: VesselApplication['status'], extraFields?: Partial<VesselApplication>) => {
    await onUpdateStatus(id, newStatus, extraFields);
    setSelectedApp(prev => prev && prev.id === id ? { ...prev, status: newStatus, ...extraFields } : prev);
  };
  const [viewMode, setViewMode] = useState<'apps' | 'report'>('apps');
  const [selectedType, setSelectedType] = useState<'VEP' | 'PAS' | 'PGP'>('VEP');
  
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
  const [dialogPasControlNo, setDialogPasControlNo] = useState('');
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
  const vepApps = applications.filter(a => a.applicationType !== 'PAS' && a.applicationType !== 'PGP');
  const pasApps = applications.filter(a => a.applicationType === 'PAS');
  const pgpApps = applications.filter(a => a.applicationType === 'PGP');
  const currentTypeApps = selectedType === 'PAS' ? pasApps : selectedType === 'PGP' ? pgpApps : vepApps;

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
      (app.company && app.company.toLowerCase().includes(searchLower)) ||
      (app.nameOfRepresentative && app.nameOfRepresentative.toLowerCase().includes(searchLower)) ||
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
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0",
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

          {/* Google Sheets Access Module */}
          <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 p-2 rounded-xl text-xs font-sans shadow-2xs self-start md:self-auto max-w-full md:max-w-xs">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Google Sheets Sync</span>
              {googleUser ? (
                <span className="text-[9.5px] font-extrabold text-emerald-700 truncate block uppercase max-w-[130px]" title={googleUser.email}>
                  Active: {googleUser.email.split('@')[0]}
                </span>
              ) : (
                <span className="text-[9.5px] font-extrabold text-amber-600 block uppercase">
                  Inactive / Offline
                </span>
              )}
            </div>
            {googleUser ? (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="hover:bg-red-50 text-red-600 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0 border border-red-200/50"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isGoogleConnecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50 flex-shrink-0"
              >
                {isGoogleConnecting ? "Linking..." : "Link Google"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSheetSettings(true)}
              className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex-shrink-0 border border-slate-200/50"
              title="Configure Spreadsheet IDs"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-end gap-4 print:hidden">
            
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
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

            <button
              onClick={() => {
                setSelectedType('PGP');
              }}
              className={cn(
                "p-4 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer",
                selectedType === 'PGP'
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={cn("font-bold text-sm uppercase tracking-wider", selectedType === 'PGP' ? "text-white" : "text-slate-800")}>
                    Port Gate Passes (PGP)
                  </h3>
                  <p className={cn("text-xs mt-1", selectedType === 'PGP' ? "text-slate-300" : "text-slate-500")}>
                    Review and authorize port cargo movement & gate clearance passes.
                  </p>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedType === 'PGP' ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                )}>
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={cn("text-2xl font-black", selectedType === 'PGP' ? "text-white" : "text-slate-900")}>
                  {pgpApps.length}
                </span>
                <span className={cn("text-[10px] font-bold uppercase", selectedType === 'PGP' ? "text-slate-400" : "text-slate-500")}>
                  Total PGP Applications
                </span>
              </div>
              {selectedType === 'PGP' && (
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
                        {app.applicationType === 'PGP' && (
                          <span className="text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded tracking-wider uppercase block w-max mb-1.5">Port Gate Pass</span>
                        )}
                        <h3 className="font-bold text-slate-900 border-b-2 border-slate-200 inline-block pb-0.5 text-lg uppercase tracking-tight">
                          {app.applicationType === 'PGP' ? (app.company || 'Port Gate Pass') : (app.vesselName || 'Unnamed Vessel')}
                        </h3>
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
                      ) : app.applicationType === 'PGP' ? (
                        <>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Representative:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px] truncate max-w-[150px]">{app.nameOfRepresentative || '-'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Cargo Type:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.typeOfCargo || '-'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-50 pb-1.5">
                            <span className="text-slate-500">Operation Dates:</span>
                            <span className="font-medium text-slate-900 text-right uppercase text-[11px]">{app.dateOfOperationStart ? formatSystemDate(app.dateOfOperationStart) : '-'} - {app.dateOfOperationEnd ? formatSystemDate(app.dateOfOperationEnd) : '-'}</span>
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
              {/* Premium top accent brand line */}
              <div className="h-1.5 w-full bg-gradient-to-r from-fab-blue via-fab-blue/85 to-fab-gold sticky top-0 z-50 print:hidden shrink-0"></div>
              
              <div className="sticky top-1.5 bg-white border-b border-slate-200 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center z-40 print:hidden shadow-sm">
                
                {/* Left Section: Information & Reference */}
                <div className="col-span-12 lg:col-span-4 flex flex-col items-start gap-1 pb-2 lg:pb-0 lg:border-r lg:border-slate-100 lg:pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-black uppercase border border-slate-200/50">
                      {selectedApp.applicationType || 'VEP'}
                    </span>
                    <h2 className="font-extrabold text-slate-950 uppercase tracking-tight text-sm truncate max-w-[200px]" title={selectedApp.applicationType === 'PGP' ? (selectedApp.company || 'Gate Pass') : (selectedApp.vesselName || 'Unnamed Vessel')}>
                      {selectedApp.applicationType === 'PGP' ? (selectedApp.company || 'Gate Pass') : (selectedApp.vesselName || 'Unnamed Vessel')}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                      getStatusBadgeStyles(selectedApp.status)
                    )}>
                      {getStatusIcon(selectedApp.status)}
                      {getStatusLabel(selectedApp.status)}
                    </span>
                    <span className="text-xs font-mono text-slate-650 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/40">
                      Ref: {selectedApp.id}
                    </span>
                  </div>

                  {/* Workflow / Process Audit Trail Timestamps */}
                  <div className="mt-2 text-[9px] font-bold space-y-0.5 w-full border-t border-slate-150 pt-2 text-slate-500 font-mono leading-none">
                    <div className="flex justify-between items-center gap-1">
                      <span className="uppercase text-slate-400">1. Submitted:</span>
                      <span className="text-slate-700 font-extrabold">{formatSystemDateTime(selectedApp.submittedAt || selectedApp.createdAt)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-1">
                      <span className="uppercase text-slate-400">2. Checked:</span>
                      <span className="text-slate-750 font-extrabold">
                        {selectedApp.checkedAt ? formatSystemDateTime(selectedApp.checkedAt) : <span className="text-slate-350 italic font-semibold">Pending Check...</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-1">
                      <span className="uppercase text-slate-400">3. Approved:</span>
                      <span className="text-slate-800 font-extrabold">
                        {selectedApp.approvedAt ? formatSystemDateTime(selectedApp.approvedAt) : <span className="text-slate-350 italic font-semibold">Pending Approval...</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* VISUAL PIPELINE FLOW TRACKER (Middle Section) */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center justify-start lg:justify-center border-t border-b border-slate-100 py-2.5 md:py-0 md:border-none">
                  <div className="flex items-center text-[10px] font-black uppercase tracking-wider gap-2 text-slate-400 w-full justify-between md:justify-center">
                    
                    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">
                      <span className="w-5 h-5 bg-green-200 border border-green-300 text-green-800 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm">1</span>
                      <span>Submit</span>
                    </div>
                    
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all",
                      (selectedApp.status === 'Pending Check' || selectedApp.status === 'Pending') 
                        ? "text-amber-700 bg-amber-50 border-amber-200 animate-pulse shadow-sm" 
                        : (selectedApp.status === 'Pending Approval' || selectedApp.status === 'Approved') 
                          ? "text-green-700 bg-green-50 border-green-100" 
                          : "text-slate-400 bg-slate-50 border-transparent"
                    )}>
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border shadow-sm transition-all",
                        (selectedApp.status === 'Pending Check' || selectedApp.status === 'Pending') 
                          ? "bg-amber-200 border-amber-300 text-amber-900" 
                          : (selectedApp.status === 'Pending Approval' || selectedApp.status === 'Approved') 
                            ? "bg-green-200 border-green-300 text-green-800" 
                            : "bg-slate-100 border-slate-200 text-slate-500"
                      )}>
                        2
                      </span>
                      <span>Checker</span>
                    </div>
                    
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all",
                      selectedApp.status === 'Pending Approval' 
                        ? "text-purple-700 bg-purple-50 border-purple-200 animate-pulse shadow-sm" 
                        : selectedApp.status === 'Approved' 
                          ? "text-green-700 bg-green-50 border-green-100" 
                          : "text-slate-400 bg-slate-50 border-transparent"
                    )}>
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border shadow-sm transition-all",
                        selectedApp.status === 'Pending Approval' 
                          ? "bg-purple-200 border-purple-300 text-purple-900" 
                          : selectedApp.status === 'Approved' 
                            ? "bg-green-200 border-green-300 text-green-800" 
                            : "bg-slate-100 border-slate-200 text-slate-500"
                      )}>
                        3
                      </span>
                      <span>Approver</span>
                    </div>

                  </div>
                </div>
                
                {/* ACTIONS CORNER (Right Section) */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex flex-wrap items-center justify-end gap-2">
                  
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
                              setDialogPasControlNo(selectedApp.id);
                              setConfirmDialog({
                                title: "Verify Vessel Station",
                                message: "Confirming verification certifies that all arrival indices, berth targets, and declarations are validated. Please fill your name and sign-off below to route this application to the AFAB Authorized Official's review station.",
                                actionLabel: "Verify & Pass",
                                actionStyle: "bg-purple-600 hover:bg-purple-700",
                                requireSignature: true,
                                roleLabel: "AFAB Authorized Official Name",
                                onConfirm: async (signerName, signatureData) => {
                                  const today = new Date().toISOString();
                                  const updatedControlNo = dialogPasControlNo.trim() 
                                    ? dialogPasControlNo.trim() 
                                    : selectedApp.id;

                                  await handleUpdateStatus(selectedApp.id, 'Pending Approval', {
                                    id: updatedControlNo,
                                    checkedByName: signerName,
                                    checkedAt: today,
                                    checkedSignatureData: signatureData
                                  });

                                  // Automatically close the pop up/drawer on verification approval
                                  setSelectedApp(null);

                                  setToast({ type: 'success', message: 'Application successfully verified and routed to the Port Approver.' });
                                }
                              });
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Verify & Pass
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
                                  setSelectedApp(null);
                                  setToast({ type: 'error', message: 'The vessel application was flagged and rejected.' });
                                }
                              });
                            }}
                            className="bg-white border hover:bg-red-50 border-red-200 text-red-600 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      ) : (
                        <div className="bg-amber-50 text-amber-800 text-[10px] px-3 py-1.5 rounded-md font-bold border border-amber-200 uppercase tracking-wider select-none text-center">
                          {authRole === 'approver' 
                            ? "Awaiting Port Checker Review" 
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
                              setDialogPasControlNo(selectedApp.id);
                              const msgSuffix = "Please fill your name and sign-off below to archive parameters and automatically sync records to the official Google Sheets ledger.";
                              setConfirmDialog({
                                title: "Authorize Entry Permit Station",
                                message: `Issue formal approval for this vessel entry permit? ${msgSuffix}`,
                                actionLabel: "Approve & Issue",
                                actionStyle: "bg-green-600 hover:bg-green-700",
                                requireSignature: true,
                                roleLabel: "AFAB Authorized Official Name",
                                onConfirm: async (signerName, signatureData) => {
                                  try {
                                    const today = new Date().toISOString();
                                    const updatedControlNo = dialogPasControlNo.trim() 
                                      ? dialogPasControlNo.trim() 
                                      : selectedApp.id;

                                    await handleUpdateStatus(selectedApp.id, 'Approved', {
                                      id: updatedControlNo,
                                      approvedByName: signerName,
                                      approvedAt: today,
                                      approvedSignatureData: signatureData
                                    });

                                    setSelectedApp(null);

                                    setToast({ type: 'success', message: 'Vessel application finalized! Approved and logged.' });
                                  } catch (e: any) {
                                    console.error("Approval state update failed:", e);
                                    setToast({ type: 'error', message: `Approval failed to save: ${e.message}` });
                                  }
                                }
                              });
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve & Issue
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
                                  setSelectedApp(null);
                                  setToast({ type: 'error', message: 'Authorization denied and application stored as rejected.' });
                                }
                              });
                            }}
                            className="bg-white border hover:bg-red-50 border-red-200 text-red-600 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      ) : (
                        <div className="bg-purple-50 text-purple-800 text-[10px] px-3 py-1.5 rounded-md font-bold border border-purple-200 uppercase tracking-wider select-none text-center">
                          Awaiting Chief Approver Authorization
                        </div>
                      )}
                    </>
                  )}

                  {selectedApp.status === 'Approved' && (
                    <div className="flex items-center gap-1.5">
                      <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] px-3 py-1.5 rounded-md font-bold uppercase tracking-wider select-none">
                        Approved & Issued
                      </div>
                      {(authRole === 'admin' || authRole === 'approver') && (
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
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" /> Revert
                        </button>
                      )}
                    </div>
                  )}

                  {selectedApp.status === 'Rejected' && (
                    <div className="flex items-center gap-1.5">
                      <div className="bg-red-50 text-red-800 text-[10px] px-3 py-1.5 rounded-md font-bold border border-red-200 uppercase tracking-wider select-none">
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
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
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
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="Delete application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <button 
                    onClick={() => {
                        setSelectedApp(null);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-800 hover:rotate-90 bg-slate-50 hover:bg-slate-100 rounded-full transition-all duration-200 cursor-pointer border border-slate-200/60"
                    title="Close Details"
                  >
                    <X className="w-4.5 h-4.5" />
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
                    authRole={authRole}
                    onBack={() => setSelectedApp(null)}
                    onSubmitApp={async (updatedData) => {
                      await onUpdateApp?.(selectedApp.id, updatedData);
                      if (updatedData.id && updatedData.id !== selectedApp.id) {
                        setSelectedApp(prev => prev ? { ...prev, ...updatedData } : null);
                      }
                    }}
                  />
                ) : selectedApp.applicationType === 'PGP' ? (
                  <GatePassForm 
                    key={`pgp-${selectedApp.id}-${selectedApp.status}-${selectedApp.checkedAt || ''}-${selectedApp.approvedAt || ''}`}
                    options={options}
                    initialData={selectedApp}
                    isEditMode={true}
                    authRole={authRole}
                    onBack={() => setSelectedApp(null)}
                    onSubmitApp={async (updatedData) => {
                      await onUpdateApp?.(selectedApp.id, updatedData);
                      if (updatedData.id && updatedData.id !== selectedApp.id) {
                        setSelectedApp(prev => prev ? { ...prev, ...updatedData } : null);
                      }
                    }}
                  />
                ) : (
                  <VesselEntryForm 
                    key={`vep-${selectedApp.id}-${selectedApp.status}-${selectedApp.checkedAt || ''}-${selectedApp.approvedAt || ''}`}
                    options={options}
                    initialData={selectedApp}
                    isEditMode={true}
                    authRole={authRole}
                    onBack={() => setSelectedApp(null)}
                    onSubmitApp={async (updatedData) => {
                      await onUpdateApp?.(selectedApp.id, updatedData);
                      if (updatedData.id && updatedData.id !== selectedApp.id) {
                        setSelectedApp(prev => prev ? { ...prev, ...updatedData } : null);
                      }
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

                  {/* Control Number Input (For checkers, approvers, and admins) */}
                  {(selectedApp.applicationType === 'PAS' || selectedApp.applicationType === 'VEP' || selectedApp.applicationType === 'PGP') && (
                    <div className="bg-amber-50/70 p-3.5 rounded-lg border border-amber-200/50 space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
                        {selectedApp.applicationType === 'VEP' ? 'VEP Control Number' :
                         selectedApp.applicationType === 'PGP' ? 'PGP Control Number' :
                         'PAS Control Number'}
                      </label>
                      <input
                        type="text"
                        value={dialogPasControlNo}
                        onChange={(e) => setDialogPasControlNo(e.target.value.toUpperCase())}
                        placeholder={
                          selectedApp.applicationType === 'VEP' ? 'PSD-26-XXX' :
                          selectedApp.applicationType === 'PGP' ? 'PGP-26-XXX' :
                          'PAS-26-XXX'
                        }
                        className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        required
                      />
                      <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                        Notice: You can change/customize this control number before finalizing verification/approval.
                      </p>
                    </div>
                  )}

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

      {/* Spreadsheet Configuration Settings Modal */}
      <AnimatePresence>
        {showSheetSettings && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative"
            >
              <button
                type="button"
                onClick={() => setShowSheetSettings(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-900 text-sm">Spreadsheet Connection Settings</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Configure target spreadsheet IDs for automatic ledger synchronization.</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-xs text-left">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vessel Master Spreadsheet ID</label>
                  <input
                    type="text"
                    value={vesselMasterId}
                    onChange={(e) => setVesselMasterId(e.target.value)}
                    placeholder="Enter Vessel Master Sheet ID..."
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono text-[10.5px] placeholder:text-slate-400 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Default ID is used for Vessel Entry Permits (VEPs).</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Process Monitoring Spreadsheet ID (PAS / PGP)</label>
                  <input
                    type="text"
                    value={processMonitoringId}
                    onChange={(e) => setProcessMonitoringId(e.target.value)}
                    placeholder="Enter Process Monitoring Sheet ID..."
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono text-[10.5px] placeholder:text-slate-400 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used for Port Ancillary Services (PAS) & Port Gate Passes (PGP).</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payments & Revenue Spreadsheet ID</label>
                  <input
                    type="text"
                    value={paymentsId}
                    onChange={(e) => setPaymentsId(e.target.value)}
                    placeholder="Enter Payments & Revenue Sheet ID..."
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono text-[10.5px] placeholder:text-slate-400 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used for Payment Dashboard metrics and Voyage Payment CSV exports.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSheetSettings(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSheetSettings}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-extrabold uppercase tracking-wider text-[10px] transition-colors shadow-sm cursor-pointer"
                >
                  Save & Reload
                </button>
              </div>
            </motion.div>
          </div>
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
