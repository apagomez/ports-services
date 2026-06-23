import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ship, 
  Anchor, 
  Search, 
  Filter, 
  Globe, 
  Navigation, 
  Package, 
  Users, 
  ChevronLeft,
  ChevronRight, 
  Activity,
  BarChart3,
  Container,
  History,
  TrendingUp,
  X,
  CreditCard,
  LayoutDashboard,
  PlusCircle,
  LogOut,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Info,
  AlertCircle
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { fetchVesselData, fetchPaymentData } from './services/dataService';
import { VesselData, SummaryStats, PaymentDashboardData, VesselApplication } from './types';
import { cn } from './lib/utils';
import { detectVesselAnomalies } from './utils/anomalyDetector';
import { PaymentDashboard } from './components/PaymentDashboard';
import { CargoDashboard } from './components/CargoDashboard';
import { StatisticsDashboard } from './components/StatisticsDashboard';
import { LoginForm } from './components/LoginForm';
import { UserDashboard } from './components/UserDashboard';
import { ApplicationDashboard } from './components/ApplicationDashboard';
import { formatSystemDate } from './utils/dateFormatter';
import { initAuth, logout as googleLogout, googleSignIn, getAccessToken, appendApplicationToSheet } from './services/googleSheetsService';

// Official Freeport Area of Bataan (FAB) & Port Regulations navigation/regulatory signaling colors:
// Blue (Authority Blue), Green (Starboard Clearance), Gold (Caution/Beacon), Red (Port Hazard), Cyan (Information Signal), Orange (Safety Assistance)
const COLORS = ['#004a99', '#10b981', '#fdb913', '#ed1c24', '#00aeef', '#f97316', '#6366f1'];

const safeAlert = (message: string) => {
  console.log("[Alert Message]:", message);
  try {
    window.alert(message);
  } catch (e) {
    console.warn("[SafeAlert] Browser standard alert() blocked in sandboxed iframe environment:", message, e);
  }
};

export default function App() {
  const [authRole, setAuthRole] = useState<'admin' | 'user' | 'checker' | 'approver' | null>(() => (localStorage.getItem('auth_role') as any) || null);
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('auth_email') || null);
  
  const [data, setData] = useState<VesselData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentDashboardData | null>(null);
  const [applications, setApplications] = useState<VesselApplication[]>([]);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    
    import('./services/firebaseService').then(({ subscribeToApplications, saveApplicationToFirestore }) => {
      // Automatic migration from localStorage to Firestore
      const localData = localStorage.getItem('vessel_applications');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Migrating local applications to Firestore...');
            
            const migrate = async () => {
              localStorage.removeItem('vessel_applications');
              for (const app of parsed) {
                try {
                  await saveApplicationToFirestore(app);
                } catch (e) {
                  console.error('Migration error for app', app, e);
                }
              }
              console.log('Migration complete.');
            };
            migrate();
          }
        } catch (e) {
          console.error("Migration parse error", e);
        }
      }

      if (isMounted) {
        unsubscribe = subscribeToApplications((apps) => {
          console.log('Apps updated in UI:', apps.length);
          setApplications(apps);
        });
      }
    }).catch(err => {
      console.error('Failed to import firebaseService:', err);
    });
    
    return () => {
      isMounted = false;
      if (unsubscribe) {
        console.log('Unsubscribing from applications...');
        unsubscribe();
      }
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [selectedVessel, setSelectedVessel] = useState<VesselData | null>(null);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterVoyage, setFilterVoyage] = useState<string>('All');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('All');
  const monthsList = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);
  const [startMonth, setStartMonth] = useState<string>('JANUARY');
  const [endMonth, setEndMonth] = useState<string>('DECEMBER');
  const [activeTab, setActiveTab] = useState<'vessels' | 'payments' | 'cargo' | 'stats' | 'applications'>('vessels');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Remove the restriction that forces mobile view away from the statistics tab.
  // This ensures the Statistics tab remains fully accessible on phone screens.

  const [colFilters, setColFilters] = useState({
    id: '',
    name: '',
    orientation: 'All',
    type: 'All',
    terminal: 'All',
    loadVolume: '',
    cargoDesc: '',
    status: 'All',
    arrival: '',
    departure: ''
  });

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);

  useEffect(() => {
    setIsGoogleLoading(true);
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsGoogleLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsGoogleLoading(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        alert(`Successfully connected Google Sheets account: ${res.user.email}`);
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user') || error?.code === 'auth/cancelled-popup-request') {
        console.log('User cancelled Google Sheets connection popup.');
        return;
      }
      console.error('Google Sheets auth failed:', error);
      alert(`Google Connection Failed: ${error.message}`);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      alert('Google Sheets account unlinked.');
    } catch (error: any) {
      console.error('Google Sheets sign out failed:', error);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterVoyage, startMonth, endMonth, filterAnomaly, colFilters]);

  const fetchData = useCallback(async (isInitial = false) => {
    if (!authRole) return; // Don't fetch until logged in
    if (!isInitial) setIsSyncing(true);
    try {
      const [vesselData, payments] = await Promise.all([
        fetchVesselData(),
        fetchPaymentData()
      ]);
      setData(vesselData);
      setPaymentData(payments);
      setLastUpdated(new Date());
      setFetchError(null);
    } catch (error: any) {
      console.error('Fetch failed:', error);
      setFetchError(error.message || 'Failed to connect to Google Sheets');
    } finally {
      if (isInitial) setLoading(false);
      setIsSyncing(false);
    }
  }, [authRole]);

  useEffect(() => {
    if (authRole !== null) {
      // Initial fetch
      fetchData(true);

      // Setup real-time polling every 30 seconds
      const interval = setInterval(() => {
        fetchData(false);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [authRole, fetchData]);

  const filteredData = useMemo(() => {
    return data.filter(v => {
      const matchesSearch = v.vesselName.toLowerCase().includes(search.toLowerCase()) || 
                          v.controlNo.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'All' || v.vesselType === filterType;
      const matchesVoyage = filterVoyage === 'All' || v.voyageType === filterVoyage;
      
      const vMonthIdx = v.month ? monthsList.indexOf(v.month.trim().toUpperCase()) : -1;
      const startIdx = monthsList.indexOf(startMonth.toUpperCase());
      const endIdx = monthsList.indexOf(endMonth.toUpperCase());
      const matchesMonth = vMonthIdx >= startIdx && vMonthIdx <= endIdx;

      // Anomaly checks
      const anomalies = detectVesselAnomalies(v);
      const hasAnomalies = anomalies.length > 0;
      const hasErrors = anomalies.some(a => a.level === 'error');
      const hasWarnings = anomalies.some(a => a.level === 'warning');

      const matchesAnomaly = filterAnomaly === 'All' ||
        (filterAnomaly === 'Anomalies' && hasAnomalies) ||
        (filterAnomaly === 'Errors' && hasErrors) ||
        (filterAnomaly === 'Warnings' && hasWarnings) ||
        (filterAnomaly === 'Clean' && !hasAnomalies);

      // Column filters
      const matchesId = v.controlNo.toLowerCase().includes(colFilters.id.toLowerCase());
      const matchesName = v.vesselName.toLowerCase().includes(colFilters.name.toLowerCase());
      const matchesOrientation = colFilters.orientation === 'All' || v.orientation === colFilters.orientation;
      const matchesColType = colFilters.type === 'All' || v.vesselType === colFilters.type;
      const matchesTerminal = colFilters.terminal === 'All' || v.terminal === colFilters.terminal;
      const matchesLoadVolume = !colFilters.loadVolume || 
        (v.cargoVolumeMT != null && String(Math.round(v.cargoVolumeMT)).includes(colFilters.loadVolume)) ||
        (v.cargoVolumeCBM != null && String(Math.round(v.cargoVolumeCBM)).includes(colFilters.loadVolume));
      const matchesCargoDesc = !colFilters.cargoDesc || (v.cargoDescription && v.cargoDescription.toLowerCase().includes(colFilters.cargoDesc.toLowerCase()));
      const matchesStatus = colFilters.status === 'All' || v.status === colFilters.status;
      const matchesArrival = v.arrivalDate.toLowerCase().includes(colFilters.arrival.toLowerCase());
      const matchesDeparture = (v.departureDate || '').toLowerCase().includes(colFilters.departure.toLowerCase());

      return matchesSearch && matchesType && matchesVoyage && matchesMonth && matchesAnomaly &&
             matchesId && matchesName && matchesOrientation && matchesColType &&
             matchesTerminal && matchesLoadVolume && matchesCargoDesc && matchesStatus && matchesArrival && matchesDeparture;
    }).sort((a, b) => b.controlNo.localeCompare(a.controlNo));
  }, [data, search, filterType, filterVoyage, startMonth, endMonth, filterAnomaly, colFilters, monthsList]);

  const arrivingVessels = useMemo(() => {
    return data
      .filter(v => v.status.toLowerCase().includes('arriving') || v.status.toLowerCase().includes('expected') || v.status.toLowerCase().includes('anchorage') || v.status.toLowerCase().includes('port') || v.status.toLowerCase().includes('berthed'))
      .sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime())
      .slice(0, 15);
  }, [data]);

  const stats = useMemo<SummaryStats>(() => {
    const vesselTypes: Record<string, number> = {};
    const registries: Record<string, number> = {};
    let departed = 0;
    let atPort = 0;
    let atAnchorage = 0;
    let berthed = 0;
    let arriving = 0;

    let flaggedCount = 0;
    let criticalCount = 0;

    filteredData.forEach(v => {
      vesselTypes[v.vesselType] = (vesselTypes[v.vesselType] || 0) + 1;
      registries[v.registry] = (registries[v.registry] || 0) + 1;
      
      const status = v.status.toLowerCase();
      if (status.includes('departed')) departed++;
      else if (status.includes('port')) atPort++;
      else if (status.includes('anchorage')) atAnchorage++;
      else if (status.includes('berthed')) berthed++;
      else if (status.includes('arriving') || status.includes('expected')) arriving++;

      const anomalies = detectVesselAnomalies(v);
      if (anomalies.length > 0) {
        flaggedCount++;
        if (anomalies.some(a => a.level === 'error')) {
          criticalCount++;
        }
      }
    });

    return {
      total: filteredData.length,
      departed,
      atPort,
      atAnchorage: atAnchorage,
      berthed,
      arriving,
      vesselTypes,
      registries,
      flaggedCount,
      criticalCount
    };
  }, [filteredData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleStatClick = (type: 'total' | 'departed' | 'atAnchorage' | 'berthed' | 'arriving') => {
    // Reset all status checks and find matching status from data
    if (type === 'total') {
      setColFilters(prev => ({ ...prev, status: 'All' }));
      setFilterAnomaly('All');
      return;
    }

    // Find the first status string that matches the category to select it in the dropdown
    const match = data.find(v => {
      const status = v.status.toLowerCase();
      if (type === 'atAnchorage') return status.includes('anchorage');
      if (type === 'arriving') return status.includes('arriving') || status.includes('expected');
      return status.includes(type.toLowerCase());
    });
    
    if (match) {
      setColFilters(prev => ({ ...prev, status: match.status }));
    }
  };

  const uniqueVoyages = useMemo(() => Array.from(new Set(data.map(v => v.voyageType))).sort(), [data]);

  const uniqueTypes = useMemo(() => Array.from(new Set(data.map(v => v.vesselType))).sort(), [data]);
  const uniqueTerminals = useMemo(() => Array.from(new Set(data.map(v => v.terminal))).sort(), [data]);
  const uniqueOrigins = useMemo(() => Array.from(new Set(data.map(v => v.origin))).sort(), [data]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(data.map(v => v.status))).sort(), [data]);

  const chartData = useMemo(() => {
    return Object.entries(stats.vesselTypes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (b.value as number) - (a.value as number))
      .slice(0, 7);
  }, [stats]);

  const registryData = useMemo(() => {
    return Object.entries(stats.registries)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (b.value as number) - (a.value as number))
      .slice(0, 5);
  }, [stats]);

  if (authRole === null) {
    return <LoginForm onLogin={(role, email) => {
      localStorage.setItem('auth_role', role);
      if (email) {
        localStorage.setItem('auth_email', email);
        setUserEmail(email);
      } else {
        localStorage.removeItem('auth_email');
        setUserEmail(null);
      }
      setAuthRole(role);
      if (role === 'checker' || role === 'approver') {
        setActiveTab('applications');
      }
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center font-mono text-[#141414]">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Ship className="w-12 h-12 animate-pulse" />
          <p className="tracking-widest uppercase text-sm">Synchronizing Data...</p>
        </motion.div>
      </div>
    );
  }

  if (authRole === 'user') {
    return <UserDashboard 
      applications={applications.filter(a => a.userEmail === userEmail)}
      userEmail={userEmail}
      onLogout={() => {
        setAuthRole(null);
        setUserEmail(null);
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_email');
        googleLogout();
      }} 
      onSubmitApp={async (app) => {
        try {
          const existingApp = applications.find(a => a.id === (app as any).id);
          const fullApp = {
            ...app,
            id: (app as any).id || (app.vesselName || 'APP').replace(/\s+/g, '-').toUpperCase() + '-' + Date.now(),
            userEmail: userEmail || 'user@example.com',
            createdAt: existingApp ? existingApp.createdAt : new Date().toISOString(),
            status: existingApp ? existingApp.status : 'Pending Check'
          } as VesselApplication;

          const { saveApplicationToFirestore } = await import('./services/firebaseService');
          await saveApplicationToFirestore(fullApp);
          
          if (existingApp) {
            alert('Successfully updated your application!');
          } else {
            alert('Successfully submitted application! It is now routed to the Port Checker for review.');
          }
        } catch (error: any) {
          console.error("Submission failed:", error);
          alert(`Failed to save application: ${error.message}`);
        }
      }}
      onDeleteApp={async (id) => {
        try {
          const { deleteApplicationFromFirestore } = await import('./services/firebaseService');
          await deleteApplicationFromFirestore(id);
          safeAlert('Application successfully withdrawn!');
        } catch (err: any) {
          console.error("Failed to delete application:", err);
          safeAlert(`Failed to delete application: ${err.message}`);
        }
      }}
      options={{ 
        voyages: uniqueVoyages, 
        types: uniqueTypes, 
        terminals: uniqueTerminals,
        origins: uniqueOrigins,
        usedControlNumbers: [
          ...data.map(d => (d.controlNo || '').replace(/-(F|D|P)$/i, '')),
          ...(paymentData?.ancillaryRecords || []).map(r => (r.controlNo || '')),
          ...applications.map(a => (a.id || '').replace(/-(F|D|P)$/i, ''))
        ]
      }} 
    />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-fab-gold selection:text-fab-blue">
      {/* Top Bar */}
      {/* Top Bar */}
      <header className="border-b border-fab-blue/15 px-4 md:px-6 py-3.5 sticky top-0 bg-white/95 backdrop-blur-md z-20 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col gap-3.5">
          
          {/* Row 1: Brand Identifier & Action Controls */}
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2.5">
              <div className="bg-fab-blue p-1.5 md:p-2 rounded-lg shadow-md flex-shrink-0 relative">
                <Ship className="text-white w-5 h-5 md:w-5.5 md:h-5.5" />
                {isSyncing && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-fab-red rounded-full border-2 border-white animate-pulse" />}
              </div>
              <div>
                <h1 className="text-base md:text-lg font-black tracking-tight uppercase leading-none text-fab-blue">Port Services Division</h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-[8px] md:text-[9.5px] font-mono text-fab-cyan font-bold uppercase tracking-[0.15em]">Freeport Area of Bataan</p>
                  <div className="h-2.5 w-px bg-slate-300" />
                  <p className="text-[7.5px] md:text-[8px] font-bold text-slate-500 flex items-center gap-1 uppercase font-mono bg-slate-100 px-1 py-0.5 rounded">
                    <span className={cn("w-1.5 h-1.5 rounded-full inline-block", isSyncing ? "bg-fab-red shadow-[0_0_8px_rgba(237,28,36,0.8)] animate-pulse" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]")} />
                    {isSyncing ? "Sync" : lastUpdated ? `Live: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Connecting"}
                  </p>
                </div>
              </div>
            </div>

            {/* Role & Signout Module (remains side-by-side on phone!) */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[8px] md:text-[9px] font-extrabold px-2 py-0.5 md:py-1 rounded font-mono uppercase tracking-wider border",
                authRole === 'admin' ? "bg-red-50 text-red-700 border-red-200" :
                authRole === 'checker' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                authRole === 'approver' ? "bg-purple-50 text-purple-700 border border-purple-200" :
                "bg-slate-50 text-slate-700 border-slate-200"
              )}>
                {authRole === 'admin' ? 'Admin' : authRole === 'checker' ? 'Checker' : authRole === 'approver' ? 'Approver' : 'User'}
              </span>
              <button 
                onClick={() => {
                  setAuthRole(null);
                  setUserEmail(null);
                  localStorage.removeItem('auth_role');
                  localStorage.removeItem('auth_email');
                  handleGoogleLogout();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors font-bold uppercase tracking-wider cursor-pointer font-sans"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[9px] md:text-[10px]">Logout</span>
              </button>
            </div>
          </div>

          {/* Row 2: Port Control Navigation Deck (Highly Visible, color-themed tabs for mobile & desktop) */}
          <div className="w-full">
            <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto w-full no-scrollbar relative shadow-inner">
              {[
                { id: 'vessels', label: 'Vessels', icon: LayoutDashboard, colorClass: 'text-fab-blue', activeBorder: 'border-fab-blue', bgActive: 'bg-fab-blue/5', beacon: 'bg-fab-blue' },
                { id: 'payments', label: 'Payments', icon: CreditCard, colorClass: 'text-fab-green', activeBorder: 'border-fab-green', bgActive: 'bg-fab-green/5', beacon: 'bg-fab-green' },
                { id: 'cargo', label: 'Cargo', icon: Package, colorClass: 'text-fab-gold', activeBorder: 'border-fab-gold', bgActive: 'bg-fab-gold/5', beacon: 'bg-fab-gold' },
                { id: 'stats', label: 'Statistics', icon: BarChart3, colorClass: 'text-fab-cyan', activeBorder: 'border-fab-cyan', bgActive: 'bg-fab-cyan/5', beacon: 'bg-fab-cyan' },
                { id: 'applications', label: 'Applications', icon: FileText, colorClass: 'text-fab-red', activeBorder: 'border-fab-red', bgActive: 'bg-fab-red/5', beacon: 'bg-fab-red' }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 md:flex-none px-2 sm:px-3 md:px-5 py-2 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-lg flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap cursor-pointer select-none relative",
                      isActive
                        ? `bg-white ${tab.bgActive} text-slate-950 shadow-xs border border-slate-200`
                        : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
                    )}
                  >
                    {/* Pulsing Beacon Indicator */}
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      {isActive && (
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", tab.beacon)}></span>
                      )}
                      <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5 transition-colors duration-300", isActive ? tab.beacon : "bg-slate-300")}></span>
                    </span>

                    <TabIcon className={cn("w-3.5 h-3.5 transition-all duration-200-all", isActive ? `${tab.colorClass} scale-110 drop-shadow-xs` : "text-slate-400")} />
                    <span className={cn("transition-colors duration-200", isActive ? "font-black" : "font-semibold")}>
                      {tab.label}
                    </span>

                    {/* Bottom active signal ribbon */}
                    {isActive && (
                      <div className={cn(
                        "absolute bottom-0 left-1.5 right-1.5 h-[3px] rounded-t-full transition-all duration-300",
                        tab.id === 'vessels' && "bg-fab-blue shadow-[0_-1px_6px_rgba(0,74,153,0.4)]",
                        tab.id === 'payments' && "bg-fab-green shadow-[0_-1px_6px_rgba(16,185,129,0.4)]",
                        tab.id === 'cargo' && "bg-fab-gold shadow-[0_-1px_6px_rgba(253,185,19,0.4)]",
                        tab.id === 'stats' && "bg-fab-cyan shadow-[0_-1px_6px_rgba(0,174,239,0.4)]",
                        tab.id === 'applications' && "bg-fab-red shadow-[0_-1px_6px_rgba(237,28,36,0.4)]"
                      )} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Row 3: Live Filters / Date Selections (Active when applicable) */}
          {activeTab === 'vessels' && (
            <div className="w-full flex justify-end">
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/80 px-2.5 py-1.5 gap-1.5 shadow-2xs hover:border-fab-blue/30 transition-all max-w-full sm:max-w-xs">
                <History className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-[9px] font-bold uppercase text-slate-400 select-none whitespace-nowrap">Period:</span>
                <select 
                  className="bg-transparent text-[10px] font-black text-slate-600 focus:outline-none uppercase cursor-pointer min-w-[50px] text-center"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                >
                  {monthsList.map(m => (
                    <option key={m} value={m}>{m.substring(0, 3)}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-300 font-bold px-1 select-none">—</span>
                <select 
                  className="bg-transparent text-[10px] font-black text-slate-600 focus:outline-none uppercase cursor-pointer min-w-[50px] text-center"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                >
                  {monthsList.map(m => (
                    <option key={m} value={m}>{m.substring(0, 3)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

        </div>
      </header>

      {fetchError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6 mb-0 rounded-r-lg shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <LogOut className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                Data Sync Error: {fetchError}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Please try logging in again if you persist to see this issue. The Google Sheets might require authentication.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="p-6 space-y-6 print:p-0 print:space-y-0 print:m-0 print:bg-white min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'vessels' ? (
            <motion.div
              key="vessels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <StatCard 
                  label="Total Vessels" 
                  value={stats.total} 
                  icon={Activity} 
                  onClick={() => handleStatClick('total')}
                />
                <StatCard 
                  label="Departed" 
                  value={stats.departed} 
                  icon={Navigation} 
                  onClick={() => handleStatClick('departed')}
                />
                <StatCard 
                  label="At Anchorage" 
                  value={stats.atAnchorage} 
                  icon={Anchor} 
                  onClick={() => handleStatClick('atAnchorage')}
                />
                <StatCard 
                  label="Berthed" 
                  value={stats.berthed} 
                  icon={Ship} 
                  onClick={() => handleStatClick('berthed')}
                />
                <StatCard 
                  label="Arriving Vessels" 
                  value={stats.arriving} 
                  icon={Navigation} 
                  onClick={() => handleStatClick('arriving')}
                />
                <StatCard 
                  label="Flagged Issues" 
                  value={stats.flaggedCount || 0} 
                  icon={ShieldAlert} 
                  onClick={() => setFilterAnomaly(filterAnomaly === 'Anomalies' ? 'All' : 'Anomalies')}
                  className={cn(
                    stats.flaggedCount && stats.flaggedCount > 0 
                      ? "border-amber-500 bg-amber-500/5 hover:border-amber-500 text-amber-600 shadow-sm" 
                      : "opacity-60"
                  )}
                  trend={stats.criticalCount && stats.criticalCount > 0 ? `${stats.criticalCount} CRIT` : undefined}
                />
              </section>

              {/* Full Table View */}
              <section className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-fab-blue text-white shadow-sm">
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">ID</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Vessel Name</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Voyage Type</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Terminal</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Load Volume (MT/CBM)</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Cargo Description</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Status</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Arrival</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider">Departure</th>
                      </tr>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200">
                          <input 
                            type="text" 
                            placeholder="ID..." 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                            value={colFilters.id}
                            onChange={(e) => setColFilters(prev => ({ ...prev, id: e.target.value }))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input 
                            type="text" 
                            placeholder="NAME..." 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                            value={colFilters.name}
                            onChange={(e) => setColFilters(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <select 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue font-bold uppercase focus:outline-none"
                            value={colFilters.orientation}
                            onChange={(e) => setColFilters(prev => ({ ...prev, orientation: e.target.value }))}
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
                            onChange={(e) => setColFilters(prev => ({ ...prev, terminal: e.target.value }))}
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
                            onChange={(e) => setColFilters(prev => ({ ...prev, loadVolume: e.target.value }))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input 
                            type="text" 
                            placeholder="CARGO..." 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                            value={colFilters.cargoDesc}
                            onChange={(e) => setColFilters(prev => ({ ...prev, cargoDesc: e.target.value }))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <select 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue font-bold uppercase focus:outline-none"
                            value={colFilters.status}
                            onChange={(e) => setColFilters(prev => ({ ...prev, status: e.target.value }))}
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
                            onChange={(e) => setColFilters(prev => ({ ...prev, arrival: e.target.value }))}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            placeholder="DEPARTURE..." 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                            value={colFilters.departure}
                            onChange={(e) => setColFilters(prev => ({ ...prev, departure: e.target.value }))}
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
                          <td className="p-4 border-r border-slate-100 text-[#141414] font-medium text-right">{v.terminal}</td>
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

              {/* Pagination Controls */}
              <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-t-0 border-slate-200 rounded-b-xl shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-4 md:mb-0 tracking-wider">
                  Displaying {Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredData.length, currentPage * itemsPerPage)} of {filteredData.length} vessels
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-fab-blue hover:text-white hover:border-fab-blue transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-[10px] font-extrabold text-fab-blue px-4 tracking-tighter uppercase">
                    Page {currentPage} of {Math.max(1, totalPages)}
                  </div>
                  <button 
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-fab-blue hover:text-white hover:border-fab-blue transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <section className="grid grid-cols-1 gap-6">
                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-fab-blue">Fleet Distribution</h3>
                      </div>
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="p-6 flex-1">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#003366', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '10px' }}
                              itemStyle={{ color: '#FFFFFF' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 mt-4 gap-2">
                        {chartData.slice(0, 4).map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-fab-blue">Top Vessel Registries</h3>
                      </div>
                      <Globe className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="p-6 flex-1">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={registryData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" fontSize={10} stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" fontSize={10} width={80} interval={0} stroke="#64748b" />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }} 
                              contentStyle={{ backgroundColor: '#003366', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '10px' }}
                            />
                            <Bar dataKey="value" fill="#003366" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-fab-blue">Recent Arrivals & Expected</h3>
                      </div>
                      <Anchor className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="p-0 flex-1 overflow-y-auto max-h-[300px]">
                      <table className="w-full text-left">
                        <tbody className="text-[10px] uppercase font-bold divide-y divide-slate-100">
                          {arrivingVessels.length > 0 ? arrivingVessels.map((v, i) => (
                            <tr key={`${v.controlNo}-${i}`} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedVessel(v)}>
                              <td className="p-3 align-top">
                                <div className="text-fab-blue">{v.vesselName}</div>
                                <div className="text-slate-400 font-medium font-mono lowercase tracking-tighter mt-1">{formatSystemDate(v.arrivalDate)}</div>
                              </td>
                              <td className="p-3 align-top text-right">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] border inline-block whitespace-nowrap",
                                  v.status.toLowerCase().includes('port') || v.status.toLowerCase().includes('berthed') 
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-200" 
                                    : "bg-fab-gold/10 text-fab-gold border-fab-gold/30"
                                )}>
                                  {v.status}
                                </span>
                                <div className="text-slate-500 font-medium mt-1 uppercase text-[8px] tracking-widest">{v.terminal}</div>
                              </td>
                            </tr>
                          )) : (
                            <tr><td className="p-6 text-center text-slate-400 italic font-medium lowercase">no arriving vessels</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : activeTab === 'applications' ? (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="print:contents print:transform-none print:m-0 print:p-0 wrapper-print"
            >
              <ApplicationDashboard 
                authRole={authRole as any}
                applications={applications} 
                onUpdateStatus={async (id, newStatus, extraFields) => {
                  try {
                    const currentApp = applications.find(a => a.id === id);
                    if (newStatus === 'Approved' && currentApp && currentApp.status !== 'Pending Approval') {
                      safeAlert('Security Block: Applications must be verified by the Port Checker before they can be approved.');
                      return;
                    }

                    let sheetSyncSuccess = false;
                    let sheetErrorMsg = '';
                    if (newStatus === 'Approved' && currentApp) {
                      try {
                        // Dynamically append directly. If not logged in yet, it will prompt the google connection pop-up automatically!
                        await appendApplicationToSheet({ ...currentApp, ...extraFields, status: 'Approved' });
                        sheetSyncSuccess = true;
                      } catch (error: any) {
                        console.error('Failed to append to Google Sheets during approval:', error);
                        sheetErrorMsg = error?.message || 'Connection popup was closed or authentication failed.';
                      }
                    }

                    const { updateApplicationInFirestore } = await import('./services/firebaseService');
                    await updateApplicationInFirestore(id, { status: newStatus, ...extraFields });
                    
                    if (newStatus === 'Approved') {
                      if (sheetSyncSuccess) {
                        safeAlert('Application approved and successfully recorded in the Google Sheets database!');
                      } else {
                        safeAlert(`Application approved successfully in the Portal database!\n\n(Notice: Google Sheets ledger syncing was bypassed or failed: ${sheetErrorMsg})`);
                      }
                      // Instantly re-fetch newest rows from Google Sheets
                      await fetchData(false);
                    } else if (newStatus === 'Pending Check') {
                      safeAlert('Application status reverted back to Port Checker review queue, clearing any prior officer sign-off signatures!');
                    }
                  } catch (err: any) {
                    console.error("Failed to update status", err);
                    safeAlert(`Failed to update status: ${err.message}`);
                  }
                }} 
                onUpdateApp={async (id, updatedApp) => {
                  const { updateApplicationInFirestore } = await import('./services/firebaseService');
                  await updateApplicationInFirestore(id, updatedApp);
                }}
                onDeleteApp={async (id) => {
                  try {
                    const { deleteApplicationFromFirestore } = await import('./services/firebaseService');
                    await deleteApplicationFromFirestore(id);
                    safeAlert('Application successfully deleted!');
                  } catch (err: any) {
                    console.error("Failed to delete application:", err);
                    safeAlert(`Failed to delete application: ${err.message}`);
                  }
                }}
                options={{ 
                  voyages: uniqueVoyages, 
                  types: uniqueTypes, 
                  terminals: uniqueTerminals,
                  origins: uniqueOrigins,
                  usedControlNumbers: [
                    ...data.map(d => (d.controlNo || '').replace(/-(F|D|P)$/i, '')),
                    ...(paymentData?.ancillaryRecords || []).map(r => (r.controlNo || '')),
                    ...applications.map(a => (a.id || '').replace(/-(F|D|P)$/i, ''))
                  ]
                }}
              />
            </motion.div>
          ) : activeTab === 'payments' ? (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {paymentData && <PaymentDashboard data={paymentData} />}
            </motion.div>
          ) : activeTab === 'cargo' ? (
            <motion.div
              key="cargo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CargoDashboard data={data} />
            </motion.div>
          ) : activeTab === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StatisticsDashboard data={data} onVesselSelect={setSelectedVessel} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Vessel Detail Drawer/Modal */}
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
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                  <DetailItem label="Vessel Type" value={selectedVessel.vesselType} icon={Ship} />
                  <DetailItem label="Status" value={selectedVessel.status} icon={Navigation} />
                  <DetailItem label="Registry" value={selectedVessel.registry} icon={Globe} />
                  <DetailItem label="Gross Tonnage" value={selectedVessel.gt.toLocaleString()} icon={TRENDING_UP} />
                  <DetailItem label="Origin Port" value={selectedVessel.origin} icon={Anchor} />
                  <DetailItem label="Next Destination" value={selectedVessel.nextPort} icon={Navigation} />
                  <DetailItem label="Agent" value={selectedVessel.agent} icon={Users} />
                  <DetailItem label="Terminal" value={selectedVessel.terminal} icon={ChevronRight} />
                </div>

                <div className="space-y-6">
                  {/* Automated Anomaly Detection Panel */}
                  {(() => {
                    const vesselAnomalies = detectVesselAnomalies(selectedVessel);
                    return (
                      <div className="border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_0px_#141414]">
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-fab-blue" /> Health Diagnostic Checks
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
                                          isError ? "bg-red-250 text-red-800" :
                                          isWarning ? "bg-amber-250 text-amber-800" :
                                          "bg-blue-250 text-blue-800"
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
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, onClick, className }: { label: string, value: string | number, icon: any, trend?: string, onClick?: () => void, className?: string }) {
  return (
    <div 
      className={cn(
        "border border-slate-200 rounded-xl p-5 bg-white hover:border-fab-blue/50 hover:shadow-xl transition-all group cursor-pointer",
        onClick && "active:scale-95",
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="bg-fab-blue/5 p-2 rounded-lg group-hover:bg-fab-blue transition-colors">
          <Icon className="w-5 h-5 text-fab-blue group-hover:text-white" />
        </div>
        {trend && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{trend}</span>}
      </div>
      <div className="space-y-1">
        <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</h3>
        <p className="text-3xl font-black tracking-tight text-fab-blue">{value}</p>
      </div>
    </div>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1">
        <Icon className="w-4 h-4 opacity-30" />
      </div>
      <div>
        <p className="text-[10px] font-mono uppercase opacity-40 mb-0.5">{label}</p>
        <p className="font-bold text-sm uppercase tracking-tight">{value || 'N/A'}</p>
      </div>
    </div>
  );
}

// Fixed typo in icon reference
const TRENDING_UP = TrendingUp;

