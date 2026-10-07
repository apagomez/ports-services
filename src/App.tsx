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
import { StatCard, DetailItem, TRENDING_UP } from './components/common';
import { VesselTable } from './components/VesselTable';
import { VesselDetailDrawer } from './components/VesselDetailDrawer';
import { LoginForm } from './components/LoginForm';
import { UserDashboard } from './components/UserDashboard';
import { ApplicationDashboard } from './components/ApplicationDashboard';
import { formatSystemDate } from './utils/dateFormatter';
import { safeStorage } from './utils/safeStorage';
import { normalizeTerminal, matchesTerminalFilter, FAB_PORT_TERMINALS } from './utils/terminalNormalizer';
import { initAuth, logout as googleLogout, googleSignIn, getAccessToken, appendApplicationToSheet, deleteApplicationFromSheet } from './services/googleSheetsService';

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
  const [authRole, setAuthRole] = useState<'admin' | 'user' | 'checker' | 'approver' | null>(() => (safeStorage.getItem('auth_role') as any) || null);
  const [userEmail, setUserEmail] = useState<string | null>(() => safeStorage.getItem('auth_email') || null);
  
  const [data, setData] = useState<VesselData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentDashboardData | null>(null);
  const [applications, setApplications] = useState<VesselApplication[]>([]);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    
    import('./services/firebaseService').then(({ subscribeToApplications, saveApplicationToFirestore }) => {
      // Automatic migration from localStorage to Firestore
      const localData = safeStorage.getItem('vessel_applications');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Migrating local applications to Firestore...');
            
            const migrate = async () => {
              safeStorage.removeItem('vessel_applications');
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
    let unsubscribe: any;
    try {
      const hasToken = !!safeStorage.getItem('google_access_token');
      if (hasToken) {
        unsubscribe = initAuth(
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
      } else {
        setIsGoogleLoading(false);
      }
    } catch(e) {
      setIsGoogleLoading(false);
    }
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
        safeAlert(`Successfully connected Google Sheets account: ${res.user.email}`);
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user') || error?.code === 'auth/cancelled-popup-request') {
        console.log('User cancelled Google Sheets connection popup.');
        return;
      }
      console.error('Google Sheets auth failed:', error);
      safeAlert(`Google Connection Failed: ${error.message}`);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      safeAlert('Google Sheets account unlinked.');
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

  const allVessels = useMemo(() => {
    // Start with the fetched vessel list from Google Sheets or fallback CSV
    const list = [...data];
    
    // Find all VEP applications that are Approved and NOT already in the list
    const approvedVepApps = applications.filter(
      app => 
        (app.applicationType === 'VEP' || !app.applicationType) && 
        app.status === 'Approved'
    );
    
    approvedVepApps.forEach(app => {
      // Avoid duplicate control number
      const cleanAppId = (app.id || '').trim().toUpperCase();
      const alreadyExists = list.some(
        v => (v.controlNo || '').trim().toUpperCase() === cleanAppId
      );
      
      if (!alreadyExists) {
        const orientation = (app.voyageType || '').toLowerCase().includes('foreign') ? 'Foreign' : 'Domestic';
        const gt = parseFloat(String(app.grossTonnage || '0').replace(/,/g, '')) || 0;
        
        // Calculate status dynamically
        let vesselStatus = 'APPROVED';
        if (app.arrivalDate) {
          const arrDate = new Date(app.arrivalDate);
          if (arrDate.getTime() <= Date.now()) {
            vesselStatus = 'BERTHED';
          } else {
            vesselStatus = 'ARRIVING';
          }
        }
        
        const mappedVessel: VesselData = {
          controlNo: app.id || '',
          aveNumber: (app.id || '').match(/-(\d{3})-?/)?.[1] || '000',
          month: app.createdAt ? new Date(app.createdAt).toLocaleString('default', { month: 'long' }).toUpperCase() : 'UNKNOWN',
          terminal: normalizeTerminal(app.terminal) || 'ANCHORAGE',
          voyageType: app.voyageType || 'DOMESTIC',
          vesselName: app.vesselName || 'UNNAMED VESSEL',
          voyageNo: app.voyageNo || 'N/A',
          status: vesselStatus,
          remarks: `Approved by: ${app.approvedByName || 'Authorized Official'}`,
          purpose: app.purpose || '',
          operation: app.vesselOperations || '',
          vesselType: app.vesselType || 'CARGO',
          orientation: orientation as 'Foreign' | 'Domestic',
          agent: app.agent || '',
          shippingLine: app.shippingLine || '',
          consignee: '',
          origin: app.origin || '',
          nextPort: app.nextPort || '',
          shipmentKind: '',
          passengers: 0,
          registry: app.registry || '',
          gt: gt,
          motorized: 'YES',
          arrivalDate: app.arrivalDate || '',
          departureDate: app.departureDate || '',
          cargoDescription: app.cargoDescription || '',
          cargoVolumeMT: 0,
          cargoVolumeCBM: 0,
          atBerthDays: 2,
          berthProductivity: 0
        };
        list.push(mappedVessel);
      }
    });
    
    return list;
  }, [data, applications]);

  const filteredData = useMemo(() => {
    return allVessels.filter(v => {
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
      const matchesTerminal = matchesTerminalFilter(v.terminal, colFilters.terminal);
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
  }, [allVessels, search, filterType, filterVoyage, startMonth, endMonth, filterAnomaly, colFilters, monthsList]);

  const arrivingVessels = useMemo(() => {
    return allVessels
      .filter(v => v.status.toLowerCase().includes('arriving') || v.status.toLowerCase().includes('expected') || v.status.toLowerCase().includes('anchorage') || v.status.toLowerCase().includes('port') || v.status.toLowerCase().includes('berthed'))
      .sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime())
      .slice(0, 15);
  }, [allVessels]);

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
    const match = allVessels.find(v => {
      const status = v.status.toLowerCase();
      if (type === 'atAnchorage') return status.includes('anchorage');
      if (type === 'arriving') return status.includes('arriving') || status.includes('expected');
      return status.includes(type.toLowerCase());
    });
    
    if (match) {
      setColFilters(prev => ({ ...prev, status: match.status }));
    }
  };

  const uniqueVoyages = useMemo(() => Array.from(new Set(allVessels.map(v => v.voyageType))).sort(), [allVessels]);

  const uniqueTypes = useMemo(() => Array.from(new Set(allVessels.map(v => v.vesselType))).sort(), [allVessels]);
  const uniqueTerminals = useMemo(() => {
    const set = new Set<string>();
    allVessels.forEach(v => {
      const norm = normalizeTerminal(v.terminal);
      if (norm) set.add(norm);
    });
    return Array.from(set).sort();
  }, [allVessels]);
  const uniqueOrigins = useMemo(() => Array.from(new Set(allVessels.map(v => v.origin))).sort(), [allVessels]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(allVessels.map(v => v.status))).sort(), [allVessels]);

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

  const sharedFormOptions = useMemo(() => {
    const rawUsed = [
      ...allVessels.map(d => (d.controlNo || '').trim().replace(/-(F|D|P)$/i, '')),
      ...(paymentData?.ancillaryRecords || []).map(r => (r.controlNo || '').trim()),
      ...(paymentData?.pgpControlNumbers || []).map(c => (c || '').trim()),
      ...applications.map(a => (a.id || '').trim().replace(/-(F|D|P)$/i, ''))
    ];
    const cleanUsed = Array.from(new Set(rawUsed.filter(n => typeof n === 'string' && n.trim().length > 0)));
    return {
      voyages: uniqueVoyages,
      types: uniqueTypes,
      terminals: uniqueTerminals,
      origins: uniqueOrigins,
      usedControlNumbers: cleanUsed
    };
  }, [allVessels, paymentData, applications, uniqueVoyages, uniqueTypes, uniqueTerminals, uniqueOrigins]);

  if (authRole === null) {
    return <LoginForm onLogin={(role, email) => {
      safeStorage.setItem('auth_role', role);
      if (email) {
        safeStorage.setItem('auth_email', email);
        setUserEmail(email);
      } else {
        safeStorage.removeItem('auth_email');
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
        safeStorage.removeItem('auth_role');
        safeStorage.removeItem('auth_email');
        googleLogout();
      }} 
      onSubmitApp={async (app, originalId) => {
        try {
          const lookupId = originalId || (app as any).id;
          // Use case-insensitive lookup to find the existing application record
          const existingApp = lookupId 
            ? applications.find(a => a.id.toUpperCase() === lookupId.toUpperCase()) 
            : undefined;
          
          const nowIso = new Date().toISOString();
          const finalId = (app as any).id || (app.vesselName || 'APP').replace(/\s+/g, '-').toUpperCase() + '-' + Date.now();
          const fullApp = {
            ...app,
            id: finalId,
            userEmail: userEmail || 'user@example.com',
            createdAt: existingApp ? existingApp.createdAt : nowIso,
            submittedAt: existingApp ? (existingApp.submittedAt || existingApp.createdAt) : nowIso,
            status: existingApp ? existingApp.status : 'Pending Check'
          } as VesselApplication;

          const { saveApplicationToFirestore, deleteApplicationFromFirestore } = await import('./services/firebaseService');
          await saveApplicationToFirestore(fullApp);
          
          // Clean up old document if the ID has changed or if it existed under a different case variant
          if (lookupId && lookupId.toUpperCase() !== finalId.toUpperCase()) {
            console.log(`Cleaning up old/renamed application record: ${lookupId} -> ${finalId}`);
            const targetsToClean = applications.filter(a => a.id.toUpperCase() === lookupId.toUpperCase() && a.id !== finalId);
            for (const oldApp of targetsToClean) {
              await deleteApplicationFromFirestore(oldApp.id);
            }
          }
          
          if (existingApp) {
            safeAlert('Successfully updated your application!');
          } else {
            safeAlert('Successfully submitted application! It is now routed to the Port Checker for review.');
          }
        } catch (error: any) {
          console.error("Submission failed:", error);
          safeAlert(`Failed to save application: ${error.message}`);
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
      options={sharedFormOptions} 
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
                  safeStorage.removeItem('auth_role');
                  safeStorage.removeItem('auth_email');
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
            <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto w-full lg:w-auto no-scrollbar relative shadow-inner flex-1">
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

            {activeTab === 'vessels' && (
              <div className="flex items-center self-end lg:self-auto border border-slate-200 rounded-xl bg-slate-50/80 px-3 py-1.5 gap-1.5 shadow-2xs hover:border-fab-blue/30 transition-all max-w-full">
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
            )}
          </div>

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
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
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
              <VesselTable paginatedData={paginatedData} colFilters={colFilters} setColFilters={setColFilters} uniqueTerminals={uniqueTerminals} uniqueStatuses={uniqueStatuses} setSelectedVessel={setSelectedVessel} />

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
                    let finalAppId = extraFields?.id || id;
                    if (newStatus === 'Approved' && currentApp) {
                      let hasToken = !!(await getAccessToken());
                      if (!hasToken && authRole === 'admin') {
                        try {
                          safeAlert('Google Sheets automatic link required for Admin ledger sync. Opening authorization popup...');
                          const linkRes = await googleSignIn();
                          if (linkRes) {
                            setGoogleUser(linkRes.user);
                            setGoogleToken(linkRes.accessToken);
                            hasToken = true;
                          }
                        } catch (err: any) {
                          console.warn('Admin automatic Google Sheets link failed during approval:', err);
                        }
                      }

                      if (hasToken) {
                        try {
                          const syncResult = await appendApplicationToSheet({ ...currentApp, ...extraFields, status: 'Approved', id: finalAppId });
                          sheetSyncSuccess = true;
                          if (syncResult && syncResult.finalControlNo) {
                            finalAppId = syncResult.finalControlNo;
                          }
                        } catch (error: any) {
                          console.warn('Failed to append to Google Sheets during approval:', error);
                          sheetErrorMsg = error?.message || 'Authentication or connection failed.';
                        }
                      } else {
                        sheetErrorMsg = 'Google Sheets was not connected.';
                      }
                    }

                    const { updateApplicationInFirestore } = await import('./services/firebaseService');
                    await updateApplicationInFirestore(id, { status: newStatus, ...extraFields, id: finalAppId });
                    
                    if (newStatus === 'Approved') {
                      if (sheetSyncSuccess) {
                        safeAlert('Application approved and successfully recorded in the Google Sheets database!');
                      } else {
                        safeAlert(`Application approved successfully in the Portal database!\n\n(Notice: Google Sheets ledger syncing was bypassed: ${sheetErrorMsg})`);
                      }
                      // Instantly re-fetch newest rows from Google Sheets
                      await fetchData(false);
                    } else if (newStatus !== 'Approved' && currentApp && currentApp.status === 'Approved') {
                      let sheetDeleteMsg = '';
                      let sheetDeleteSuccess = false;
                      try {
                        let hasToken = !!(await getAccessToken());
                        if (!hasToken && authRole === 'admin') {
                          try {
                            safeAlert('Google Sheets automatic link required to remove record from ledger. Opening authorization popup...');
                            const linkRes = await googleSignIn();
                            if (linkRes) {
                              setGoogleUser(linkRes.user);
                              setGoogleToken(linkRes.accessToken);
                              hasToken = true;
                            }
                          } catch (err: any) {
                            console.warn('Admin automatic Google Sheets link failed during rejection/revert:', err);
                          }
                        }

                        if (hasToken) {
                          await deleteApplicationFromSheet(currentApp);
                          sheetDeleteSuccess = true;
                        } else {
                          sheetDeleteMsg = 'Google Sheets was not connected.';
                        }
                      } catch (error: any) {
                        console.warn('Failed to delete from Google Sheets during revert/rejection:', error);
                        sheetDeleteMsg = error?.message || 'Failed to authenticate or connect.';
                      }
                      
                      if (sheetDeleteSuccess) {
                        safeAlert('Application status updated and corresponding record successfully removed from Google Sheets!');
                      } else {
                        safeAlert(`Application status updated successfully in the Portal!\n\n(Notice: Google Sheets record could not be removed automatically: ${sheetDeleteMsg})`);
                      }
                      // Refresh data
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
                  const currentApp = applications.find(a => a.id === id);
                  const mergedApp = { ...currentApp, ...updatedApp };

                  const { updateApplicationInFirestore } = await import('./services/firebaseService');
                  await updateApplicationInFirestore(id, updatedApp);

                  // Sync to Google Sheets if it is already approved
                  if (mergedApp.status === 'Approved') {
                    let hasToken = !!(await getAccessToken());
                    if (!hasToken && authRole === 'admin') {
                      try {
                        safeAlert('Google Sheets automatic link required to update ledger during edit. Opening authorization popup...');
                        const linkRes = await googleSignIn();
                        if (linkRes) {
                          setGoogleUser(linkRes.user);
                          setGoogleToken(linkRes.accessToken);
                          hasToken = true;
                        }
                      } catch (err: any) {
                        console.warn('Admin automatic Google Sheets link failed during app edit:', err);
                      }
                    }

                    if (hasToken) {
                      try {
                        await appendApplicationToSheet(mergedApp as VesselApplication);
                      } catch (error: any) {
                        console.warn('Failed to update Google Sheets during app edit:', error);
                      }
                    }
                  }
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
                options={sharedFormOptions}
              />
            </motion.div>
          ) : activeTab === 'payments' ? (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {paymentData && <PaymentDashboard data={paymentData} vesselData={allVessels} />}
            </motion.div>
          ) : activeTab === 'cargo' ? (
            <motion.div
              key="cargo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CargoDashboard data={allVessels} />
            </motion.div>
          ) : activeTab === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StatisticsDashboard data={allVessels} onVesselSelect={setSelectedVessel} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <VesselDetailDrawer selectedVessel={selectedVessel} setSelectedVessel={setSelectedVessel} data={data} />
    </div>
  );
}

