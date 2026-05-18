import { useEffect, useState, useMemo } from 'react';
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
  FileText
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { fetchVesselData, fetchPaymentData } from './services/dataService';
import { VesselData, SummaryStats, PaymentDashboardData, VesselApplication } from './types';
import { cn } from './lib/utils';
import { PaymentDashboard } from './components/PaymentDashboard';
import { CargoDashboard } from './components/CargoDashboard';
import { StatisticsDashboard } from './components/StatisticsDashboard';
import { LoginForm } from './components/LoginForm';
import { UserDashboard } from './components/UserDashboard';
import { ApplicationDashboard } from './components/ApplicationDashboard';
import { initAuth, logout as googleLogout } from './services/googleSheetsService';

const COLORS = ['#E44D26', '#F16529', '#264DE4', '#2965F1', '#4D4D4D', '#141414', '#555'];

export default function App() {
  const [authRole, setAuthRole] = useState<'admin' | 'user' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
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
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'vessels' | 'payments' | 'cargo' | 'stats' | 'applications'>('vessels');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [colFilters, setColFilters] = useState({
    id: '',
    name: '',
    orientation: 'All',
    type: 'All',
    terminal: 'All',
    loadVolume: '',
    cargoDesc: '',
    status: 'All',
    arrival: ''
  });

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterVoyage, filterMonth, colFilters]);

  useEffect(() => {
    const fetchData = async (isInitial = false) => {
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
        console.error('Initial fetch failed:', error);
        setFetchError(error.message || 'Failed to connect to Google Sheets');
      } finally {
        if (isInitial) setLoading(false);
        setIsSyncing(false);
      }
    };

    if (authRole !== null) {
      // Initial fetch
      fetchData(true);

      // Setup real-time polling every 30 seconds
      const interval = setInterval(() => {
        fetchData(false);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [authRole]);

  const filteredData = useMemo(() => {
    return data.filter(v => {
      const matchesSearch = v.vesselName.toLowerCase().includes(search.toLowerCase()) || 
                          v.controlNo.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'All' || v.vesselType === filterType;
      const matchesVoyage = filterVoyage === 'All' || v.voyageType === filterVoyage;
      const matchesMonth = filterMonth === 'All' || v.month === filterMonth;

      // Column filters
      const matchesId = v.controlNo.toLowerCase().includes(colFilters.id.toLowerCase());
      const matchesName = v.vesselName.toLowerCase().includes(colFilters.name.toLowerCase());
      const matchesOrientation = colFilters.orientation === 'All' || v.orientation === colFilters.orientation;
      const matchesColType = colFilters.type === 'All' || v.vesselType === colFilters.type;
      const matchesTerminal = colFilters.terminal === 'All' || v.terminal === colFilters.terminal;
      const matchesLoadVolume = !colFilters.loadVolume || (v.cargoVolumeMT != null && String(Math.round(v.cargoVolumeMT)).includes(colFilters.loadVolume));
      const matchesCargoDesc = !colFilters.cargoDesc || (v.cargoDescription && v.cargoDescription.toLowerCase().includes(colFilters.cargoDesc.toLowerCase()));
      const matchesStatus = colFilters.status === 'All' || v.status === colFilters.status;
      const matchesArrival = v.arrivalDate.toLowerCase().includes(colFilters.arrival.toLowerCase());

      return matchesSearch && matchesType && matchesVoyage && matchesMonth &&
             matchesId && matchesName && matchesOrientation && matchesColType &&
             matchesTerminal && matchesLoadVolume && matchesCargoDesc && matchesStatus && matchesArrival;
    }).sort((a, b) => b.controlNo.localeCompare(a.controlNo));
  }, [data, search, filterType, filterVoyage, filterMonth, colFilters]);

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

    filteredData.forEach(v => {
      vesselTypes[v.vesselType] = (vesselTypes[v.vesselType] || 0) + 1;
      registries[v.registry] = (registries[v.registry] || 0) + 1;
      
      const status = v.status.toLowerCase();
      if (status.includes('departed')) departed++;
      else if (status.includes('port')) atPort++;
      else if (status.includes('anchorage')) atAnchorage++;
      else if (status.includes('berthed')) berthed++;
      else if (status.includes('arriving') || status.includes('expected')) arriving++;
    });

    return {
      total: filteredData.length,
      departed,
      atPort,
      atAnchorage: atAnchorage,
      berthed,
      arriving,
      vesselTypes,
      registries
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
  const uniqueMonths = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ].filter(m => data.some(v => v.month.toUpperCase() === m)), [data]);

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
      setAuthRole(role);
      if (email) setUserEmail(email);
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
      applications={applications.filter(a => a.userEmail === userEmail || a.userEmail === 'user@example.com')}
      onLogout={() => {
        setAuthRole(null);
        googleLogout();
      }} 
      onSubmitApp={async (app) => {
        try {
          const fullApp = {
            ...app,
            id: (app as any).id || (app.vesselName || 'APP').replace(/\s+/g, '-').toUpperCase() + '-' + Date.now(),
            userEmail: userEmail || 'user@example.com',
            createdAt: new Date().toISOString(),
            status: 'Pending'
          } as VesselApplication;

          const { saveApplicationToFirestore } = await import('./services/firebaseService');
          await saveApplicationToFirestore(fullApp);
          
          alert('Successfully submitted application for admin approval!');
        } catch (error: any) {
          console.error("Submission failed:", error);
          alert(`Failed to save application: ${error.message}`);
        }
      }}
      options={{ 
        voyages: uniqueVoyages, 
        types: uniqueTypes, 
        terminals: uniqueTerminals,
        origins: uniqueOrigins,
        usedControlNumbers: applications.map(a => a.id.replace(/-(F|D|P)$/, ''))
      }} 
    />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-fab-gold selection:text-fab-blue">
      {/* Top Bar */}
      <header className="border-b border-fab-blue/20 px-6 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-20 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 w-full lg:w-auto">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="bg-fab-blue p-2 rounded-lg shadow-lg flex-shrink-0 relative">
              <Ship className="text-white w-6 h-6" />
              {isSyncing && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-fab-red rounded-full border-2 border-white animate-pulse" />}
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight uppercase leading-none text-fab-blue">Port Services Division</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-mono text-fab-cyan font-bold uppercase tracking-[0.2em]">Freeport Area of Bataan</p>
                <div className="h-3 w-px bg-slate-300" />
                <p className="text-[9px] font-bold text-slate-500 flex items-center gap-1.5 uppercase font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  <span className={cn("w-1.5 h-1.5 rounded-[1px] inline-block", isSyncing ? "bg-fab-red shadow-[0_0_8px_rgba(237,28,36,0.8)] animate-pulse" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]")} />
                  {isSyncing ? "Data Syncing..." : lastUpdated ? `Live: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : "Connecting..."}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto w-full lg:w-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('vessels')}
              className={cn(
                "px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-2 whitespace-nowrap",
                activeTab === 'vessels' ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-t-2 border-t-fab-red" : "text-slate-500 hover:text-fab-blue"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Vessels
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={cn(
                "px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-2 whitespace-nowrap",
                activeTab === 'payments' ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-t-2 border-t-fab-red" : "text-slate-500 hover:text-fab-blue"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" /> Payments
            </button>
            <button 
              onClick={() => setActiveTab('cargo')}
              className={cn(
                "px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-2 whitespace-nowrap",
                activeTab === 'cargo' ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-t-2 border-t-fab-red" : "text-slate-500 hover:text-fab-blue"
              )}
            >
              <Package className="w-3.5 h-3.5" /> Cargo
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={cn(
                "px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-2 whitespace-nowrap",
                activeTab === 'stats' ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-t-2 border-t-fab-red" : "text-slate-500 hover:text-fab-blue"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Statistics
            </button>
            <button 
              onClick={() => setActiveTab('applications')}
              className={cn(
                "px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-2 whitespace-nowrap",
                activeTab === 'applications' ? "bg-white text-fab-blue shadow-sm border border-slate-200 border-t-2 border-t-fab-red" : "text-slate-500 hover:text-fab-blue"
              )}
            >
              <FileText className="w-3.5 h-3.5" /> Applications
            </button>
          </nav>
          
          <div className="flex items-center ml-2 border-l border-slate-300 pl-4">
            <button 
              onClick={() => {
                setAuthRole(null);
                googleLogout();
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors font-bold uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          {activeTab === 'vessels' && (
            <>
              <div className="relative flex-1 min-w-[150px] md:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-fab-blue transition-colors" />
                <input 
                  type="text" 
                  placeholder="SEARCH..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-fab-blue/20 focus:border-fab-blue transition-all uppercase placeholder:text-slate-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[120px] flex items-center border border-slate-200 rounded-lg bg-slate-50 px-2 py-1.5 gap-2 focus-within:border-fab-blue transition-all">
                <Filter className="w-3 h-3 text-slate-400" />
                <select 
                  className="bg-transparent text-[10px] font-bold text-slate-600 focus:outline-none uppercase cursor-pointer w-full"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">Types</option>
                  {Object.keys(stats.vesselTypes).sort().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px] flex items-center border border-slate-200 rounded-lg bg-slate-50 px-2 py-1.5 gap-2 focus-within:border-fab-blue transition-all">
                <Navigation className="w-3 h-3 text-slate-400" />
                <select 
                  className="bg-transparent text-[10px] font-bold text-slate-600 focus:outline-none uppercase cursor-pointer w-full"
                  value={filterVoyage}
                  onChange={(e) => setFilterVoyage(e.target.value)}
                >
                  <option value="All">Voyages</option>
                  {uniqueVoyages.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px] flex items-center border border-slate-200 rounded-lg bg-slate-50 px-2 py-1.5 gap-2 focus-within:border-fab-blue transition-all">
                <History className="w-3 h-3 text-slate-400" />
                <select 
                  className="bg-transparent text-[10px] font-bold text-slate-600 focus:outline-none uppercase cursor-pointer w-full"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="All">Months</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
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
              <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Load Volume MT</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Cargo Description</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Status</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-wider">Arrival</th>
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
                        <td className="p-2">
                          <input 
                            type="text" 
                            placeholder="ARRIVAL..." 
                            className="w-full text-[10px] p-1.5 bg-white border border-slate-200 rounded text-fab-blue uppercase font-bold focus:outline-none focus:border-fab-blue"
                            value={colFilters.arrival}
                            onChange={(e) => setColFilters(prev => ({ ...prev, arrival: e.target.value }))}
                          />
                        </td>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] uppercase">
                      {paginatedData.map((v, i) => (
                        <tr 
                          key={`${v.controlNo}-${i}`} 
                          className={cn("border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors", i % 2 === 0 ? "bg-white" : "bg-slate-50/30")}
                          onClick={() => setSelectedVessel(v)}
                        >
                          <td className="p-4 font-mono border-r border-slate-100 text-slate-400">{v.controlNo}</td>
                          <td className="p-4 font-bold border-r border-slate-100 text-fab-blue">{v.vesselName}</td>
                          <td className="p-4 border-r border-slate-100">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              v.orientation === 'Foreign' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"
                            )}>
                              {v.orientation}
                            </span>
                          </td>
                          <td className="p-4 border-r border-slate-100 text-slate-600 italic font-medium">{v.terminal}</td>
                          <td className="p-4 border-r border-slate-100 text-right font-mono text-slate-600">{v.cargoVolumeMT ? Math.round(v.cargoVolumeMT).toLocaleString() : '-'}</td>
                          <td className="p-4 border-r border-slate-100 text-slate-600 text-[10px]">{v.cargoDescription || '-'}</td>
                          <td className="p-4 border-r border-slate-100">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              v.status.toLowerCase().includes('departed') ? "bg-green-50 text-green-600 border-green-200" : "bg-fab-gold/10 text-fab-gold border-fab-gold/30"
                            )}>
                              {v.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 font-mono italic">{v.arrivalDate}</td>
                        </tr>
                      ))}
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
                                <div className="text-slate-400 font-medium font-mono lowercase tracking-tighter mt-1">{v.arrivalDate}</div>
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
                applications={applications} 
                onUpdateStatus={async (id, newStatus) => {
                  try {
                    const { updateApplicationStatusInFirestore } = await import('./services/firebaseService');
                    await updateApplicationStatusInFirestore(id, newStatus);
                    
                    if (newStatus === 'Approved') {
                      const appToApprove = applications.find(a => a.id === id);
                      if (appToApprove) {
                        try {
                          const { appendApplicationToSheet } = await import('./services/googleSheetsService');
                          await appendApplicationToSheet({ ...appToApprove, status: 'Approved' });
                          alert('Application approved and sent to Google Sheets!');
                        } catch (error: any) {
                          console.error('Failed to append to Google Sheets', error);
                          if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user')) {
                            alert('Authentication cancelled. Could not save to Google Sheets. You may need to sign in again in a new tab.');
                          } else {
                            alert(`Approved in system, but failed to save to Google Sheets: ${error.message}`);
                          }
                        }
                      }
                    }
                  } catch (err: any) {
                    console.error("Failed to update status", err);
                    alert(`Failed to update status: ${err.message}`);
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
                  } catch (err: any) {
                    console.error("Failed to delete application:", err);
                    alert(`Failed to delete application: ${err.message}`);
                  }
                }}
                options={{ 
                  voyages: uniqueVoyages, 
                  types: uniqueTypes, 
                  terminals: uniqueTerminals,
                  origins: uniqueOrigins,
                  usedControlNumbers: applications.map(a => a.id.replace(/-(F|D|P)$/, ''))
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
                  <div className="border border-[#141414] p-6 bg-white">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4 flex items-center gap-2">
                       <Package className="w-3 h-3" /> Cargo Information
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs opacity-50 mb-1">Description</p>
                        <p className="font-bold text-lg uppercase tracking-tight">{selectedVessel.cargoDescription || 'NONE REPORTED'}</p>
                      </div>
                      <div className="flex gap-8">
                        <div>
                          <p className="text-xs opacity-50 mb-1">Volume (MT)</p>
                          <p className="font-mono text-xl">{selectedVessel.cargoVolumeMT.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-50 mb-1">Shipment Type</p>
                          <p className="font-mono uppercase">{selectedVessel.shipmentKind || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-[#141414] p-6 bg-[#141414] text-[#E4E3E0]">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-4">Operational Logs</h4>
                    <ul className="space-y-3 font-mono text-[10px] uppercase">
                      <li className="flex justify-between border-b border-[#E4E3E022] pb-2">
                        <span className="opacity-60">Arrival Date</span>
                        <span>{selectedVessel.arrivalDate}</span>
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

function StatCard({ label, value, icon: Icon, trend, onClick }: { label: string, value: string | number, icon: any, trend?: string, onClick?: () => void }) {
  return (
    <div 
      className={cn(
        "border border-slate-200 rounded-xl p-5 bg-white hover:border-fab-blue/50 hover:shadow-xl transition-all group cursor-pointer",
        onClick && "active:scale-95"
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

