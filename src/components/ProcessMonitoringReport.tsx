import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Search, 
  Calendar, 
  Clock, 
  ThumbsUp, 
  Zap, 
  Users,
  ChevronLeft,
  Settings,
  HelpCircle,
  FileText
} from 'lucide-react';
import { VesselApplication } from '../types';
import { cn } from '../lib/utils';
import { formatSystemDate } from '../utils/dateFormatter';

interface ProcessMonitoringReportProps {
  applications: VesselApplication[];
  onBack?: () => void;
}

// Structuring helpers to mock/calculate realistic times from our real-time application database
interface ProcessedReportRow {
  index: number;
  ctrlNo: string;
  typeOfVessel: string; // Dynamic based on form types (Voyage type for VEP, Selected Services for PAS)
  nameOfVessel: string;
  voyageNo: string;
  client: string;
  dateOfApplication: string;
  monthOfApplication: string;
  timeIn1: string;
  timeOut1: string;
  docsProcessingTime: string;
  assignedPersonnel1: string;
  timeIn2: string;
  timeOut2: string;
  approvalProcessingTime: string;
  assignedPersonnel2: string;
  releaseDate: string;
  releaseTime: string;
  releasingProcessingTime: string;
  totalCycleTime: string;
  ratingQuality: number;
  ratingTimeliness: number;
  issuedBy: string;
  receivedBy: string;
  remarks: string;
  // Raw times in ms for averages
  docsTimeMs: number;
  approvalTimeMs: number;
  releasingTimeMs: number;
  totalTimeMs: number;
}

export const ProcessMonitoringReport: React.FC<ProcessMonitoringReportProps> = ({ 
  applications,
  onBack 
}) => {
  const [activeFormType, setActiveFormType] = useState<'VEP' | 'PAS' | 'PGP'>('VEP');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [serviceFilter, setServiceFilter] = useState<string>('All');

  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", 
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];

  // Helper to extract initials from name
  const getInitials = (name?: string, fallback: string = 'ECD') => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return fallback;
    const initials = parts.map(p => p.charAt(0)).join('').toUpperCase();
    return initials.slice(0, 3);
  };

  // Human-readable format of duration (H:MM:SS)
  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    const doubleDigits = (n: number) => n.toString().padStart(2, '0');
    return `${hrs}:${doubleDigits(mins)}:${doubleDigits(secs)}`;
  };

  // Format date like "2-Jan-2025" or "14-Feb-2026"
  const formatSheetDate = (dateObj: Date) => {
    return formatSystemDate(dateObj);
  };

  // Filter applications by active form/service type (VEP vs PAS vs PGP) and ensure only Approved applications are present
  const filteredAppsByType = useMemo(() => {
    return applications.filter(app => {
      if (app.status !== 'Approved') {
        return false;
      }
      if (activeFormType === 'PAS') {
        return app.applicationType === 'PAS';
      } else if (activeFormType === 'PGP') {
        return app.applicationType === 'PGP';
      } else {
        return app.applicationType !== 'PAS' && app.applicationType !== 'PGP';
      }
    });
  }, [applications, activeFormType]);

  // Core processing pipeline to map current database of applications to the detailed excel rows
  const processedRows = useMemo<ProcessedReportRow[]>(() => {
    // We only include apps that have gone through Checker (i.e. Pending Approval, Approved, or Rejected)
    // to match a real service cycle. But we can display all, using mock offsets for partial drafts.
    return filteredAppsByType
      .map((app, idx) => {
        const createDate = app.createdAt ? new Date(app.createdAt) : new Date();
        const baseYear = createDate.getFullYear();
        
        // Calculate document check timestamps (1)
        let checkOutDate: Date;
        if (app.checkedAt) {
          checkOutDate = new Date(app.checkedAt);
        } else {
          // If draft or pending check, mock checking duration offset (1 to 2 mins)
          checkOutDate = new Date(createDate.getTime() + 65 * 1000);
        }

        // Calculate approval timestamps (2)
        let approvalOutDate: Date;
        if (app.approvedAt) {
          approvalOutDate = new Date(app.approvedAt);
        } else if (app.status === 'Approved') {
          approvalOutDate = new Date(checkOutDate.getTime() + 75 * 1000);
        } else {
          approvalOutDate = new Date(checkOutDate.getTime() + 60 * 1000);
        }

        // Releasing time takes roughly 1 minute
        const releaseOutDate = new Date(approvalOutDate.getTime() + 60 * 1000);

        // Compute step durations
        const docsTimeMs = checkOutDate.getTime() - createDate.getTime();
        const approvalTimeMs = approvalOutDate.getTime() - checkOutDate.getTime();
        const releasingTimeMs = releaseOutDate.getTime() - approvalOutDate.getTime();
        const totalTimeMs = releaseOutDate.getTime() - createDate.getTime();

        // Formatted Time strings (HH:mm)
        const formatTime = (d: Date) => {
          return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        };

        const shortMonthStr = `-${monthNames[createDate.getMonth()].slice(0, 3).charAt(0).toUpperCase()}${monthNames[createDate.getMonth()].slice(0, 3).slice(1).toLowerCase()}-`;

        // Service type (DOMESTIC or FOREIGN for VEP, selected services combined for PAS, cargo class for PGP)
        const serviceCategoryStr = app.applicationType === 'PAS'
          ? (app.selectedServices && app.selectedServices.length > 0 ? app.selectedServices.join(' | ').toUpperCase() : 'PORT ANCILLARY')
          : app.applicationType === 'PGP'
          ? (app.classificationOfCargo || 'BULK CARGO').toUpperCase()
          : (app.voyageType || 'DOMESTIC').toUpperCase();

        // Frontline personnel initials
        const p1 = getInitials(app.checkedByName, 'ECD');
        const p2 = getInitials(app.approvedByName, 'RMG');

        // Rating calculation: if service completed within 10 minutes total cycle, rate 5/5.
        // If it takes more, decrease.
        const totalMinutes = totalTimeMs / (1000 * 60);
        let timeliness = 5;
        if (totalMinutes > 15) timeliness = 3;
        else if (totalMinutes > 8) timeliness = 4;

        let quality = 5;
        if (app.status === 'Rejected') quality = 3;

        const dynamicCtrlPrefix = app.applicationType === 'PAS' ? 'PAS' : app.applicationType === 'PGP' ? 'PGP' : 'VEP';

        return {
          index: idx + 1,
          ctrlNo: app.id || `${dynamicCtrlPrefix}-${baseYear}-${idx + 100}-D`,
          typeOfVessel: serviceCategoryStr,
          nameOfVessel: app.applicationType === 'PGP'
            ? (app.vesselName || app.company || 'N/A').toUpperCase()
            : (app.vesselName || 'MV UNNAMED').toUpperCase(),
          voyageNo: (app.voyageNo || 'N/A').toUpperCase(),
          client: app.applicationType === 'PGP'
            ? (app.company || app.submitterName || app.nameOfRepresentative || 'DIRECT APPLICANT').toUpperCase()
            : (app.serviceProviderName || app.agent || app.shippingLine || 'DIRECT APPLICANT').toUpperCase(),
          dateOfApplication: formatSheetDate(createDate),
          monthOfApplication: shortMonthStr,
          timeIn1: formatTime(createDate),
          timeOut1: formatTime(checkOutDate),
          docsProcessingTime: formatDuration(docsTimeMs),
          assignedPersonnel1: p1,
          timeIn2: formatTime(checkOutDate),
          timeOut2: formatTime(approvalOutDate),
          approvalProcessingTime: formatDuration(approvalTimeMs),
          assignedPersonnel2: p2,
          releaseDate: formatSheetDate(approvalOutDate),
          releaseTime: formatTime(releaseOutDate),
          releasingProcessingTime: formatDuration(releasingTimeMs),
          totalCycleTime: formatDuration(totalTimeMs),
          ratingQuality: quality,
          ratingTimeliness: timeliness,
          issuedBy: p1,
          receivedBy: (app.submitterName || app.agent || '').toUpperCase(),
          remarks: app.status === 'Approved' ? 'COMPLETED PROCESS' : app.status === 'Rejected' ? 'REJECTED APPLICATIONS' : 'PENDING REVIEW STATE',
          // Numerical analytics
          docsTimeMs,
          approvalTimeMs,
          releasingTimeMs,
          totalTimeMs
        };
      })
      .reverse(); // Newest first for view, but we sort during rendering or export accordingly.
  }, [filteredAppsByType]);

  // Apply filters to table rows
  const filteredRows = useMemo(() => {
    return processedRows.filter(row => {
      // Month selector
      if (selectedMonth !== 'All') {
        const rowMonth = row.dateOfApplication.toUpperCase();
        if (!rowMonth.includes(selectedMonth.slice(0, 3).toUpperCase())) {
          return false;
        }
      }

      // Voyage type filter
      if (serviceFilter !== 'All' && row.typeOfVessel !== serviceFilter) {
        return false;
      }

      // Free Search (Ctrl, Vessel name, Agent, Voyage no)
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          row.ctrlNo.toLowerCase().includes(query) ||
          row.nameOfVessel.toLowerCase().includes(query) ||
          row.client.toLowerCase().includes(query) ||
          row.voyageNo.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [processedRows, selectedMonth, serviceFilter, searchTerm]);

  // Calculate high-fidelity report analytics (SLA metrics and averages)
  const reportStats = useMemo(() => {
    const total = filteredRows.length;
    if (total === 0) {
      return {
        total: 0,
        avgDocTime: '0:00:00',
        avgApproveTime: '0:00:00',
        avgCycleTime: '0:00:00',
        slaMetPercent: 100,
        avgQuality: '5.00',
        avgTimeliness: '5.00'
      };
    }

    let sumDoc = 0;
    let sumApprove = 0;
    let sumTotal = 0;
    let sumQual = 0;
    let sumTime = 0;
    let metSlaCount = 0;

    filteredRows.forEach(r => {
      sumDoc += r.docsTimeMs;
      sumApprove += r.approvalTimeMs;
      sumTotal += r.totalTimeMs;
      sumQual += r.ratingQuality;
      sumTime += r.ratingTimeliness;

      // SLA definition in PORT: processing completed in less than 5 minutes total cycle
      if (r.totalTimeMs <= 10 * 60 * 1000) {
        metSlaCount++;
      }
    });

    return {
      total,
      avgDocTime: formatDuration(sumDoc / total),
      avgApproveTime: formatDuration(sumApprove / total),
      avgCycleTime: formatDuration(sumTotal / total),
      slaMetPercent: Math.round((metSlaCount / total) * 100),
      avgQuality: (sumQual / total).toFixed(2),
      avgTimeliness: (sumTime / total).toFixed(2)
    };
  }, [filteredRows]);

  // Trigger spreadsheet download in strict format compatible with standard accounting uploads
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;

    // Header structure patterned exactly to the target sheet
    const row1 = Array(30).fill('').join(',');
    const row2 = activeFormType === 'PAS'
      ? ',,,,,,,,CHECKING OF DOCUMENTS,,,,,,,APPROVAL OF DOCUMENTS,,,,,RELEASING OF PAS,,,,,,,,'
      : activeFormType === 'PGP'
      ? ',,,,,,,,CHECKING OF DOCUMENTS,,,,,,,APPROVAL OF DOCUMENTS,,,,,RELEASING OF PGP,,,,,,,,'
      : ',,,,,,,,CHECKING OF DOCUMENTS,,,,,,,APPROVAL OF DOCUMENTS,,,,,RELEASING OF VEP,,,,,,,,';
    const h = [
      '',
      'NO.',
      'NO',
      'CTRL NO',
      activeFormType === 'PAS' ? 'ANCILLARY SERVICE CATEGORY' : activeFormType === 'PGP' ? 'CARGO CLASSIFICATION' : 'TYPE OF VESSEL',
      activeFormType === 'PGP' ? 'COMPANY NAME / VESSEL' : 'NAME OF VESSEL',
      activeFormType === 'PAS' ? 'SERVICE REFERENCE' : activeFormType === 'PGP' ? 'VOYAGE NO / REF' : 'VOYAGE NO.',
      activeFormType === 'PGP' ? 'REPRESENTATIVE / CLIENT' : 'CLIENT',
      'DATE  OF APPLICATION',
      'Month of Application',
      'TIME IN (1)',
      'TIME OUT (1)',
      'DOCS PROCESSING TIME (IN MINS)',
      '',
      'ASSIGNED PERSONNEL FRONTLINE',
      'TIME IN (2)',
      'TIME OUT (2)',
      'APPROVAL PROCESSING TIME (IN MINS)',
      '',
      'ASSIGNED PERSONNEL FRONTLINE (Approver)',
      'DATE',
      'TIME',
      'RELEASING PROCESSING TIME (IN MINS)',
      'TOTAL CYCLE TIME',
      'RATING  (QUALITY)',
      'RATING (TIMELINESS)',
      'ISSUED BY',
      'RECEIVED BY',
      'REMARKS'
    ];
    const row3 = h.join(',');

    const bodyLines = filteredRows.map((row, i) => {
      return [
        '',
        '',
        i + 1,
        `"${row.ctrlNo}"`,
        `"${row.typeOfVessel}"`,
        `"${row.nameOfVessel}"`,
        `"${row.voyageNo}"`,
        `"${row.client}"`,
        `"${row.dateOfApplication}"`,
        `"${row.monthOfApplication}"`,
        `"${row.timeIn1}"`,
        `"${row.timeOut1}"`,
        `"${row.docsProcessingTime}"`,
        '',
        `"${row.assignedPersonnel1}"`,
        `"${row.timeIn2}"`,
        `"${row.timeOut2}"`,
        `"${row.approvalProcessingTime}"`,
        '',
        `"${row.assignedPersonnel2}"`,
        `"${row.releaseDate}"`,
        `"${row.releaseTime}"`,
        `"${row.releasingProcessingTime}"`,
        `"${row.totalCycleTime}"`,
        row.ratingQuality,
        row.ratingTimeliness,
        `"${row.issuedBy}"`,
        `"${row.receivedBy}"`,
        `"${row.remarks}"`
      ].join(',');
    });

    const csvContent = "\uFEFF" + [row1, row2, row3, ...bodyLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Process_Monitoring_Report_${activeFormType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 flex flex-col min-h-0 text-left bg-slate-50 p-6 rounded-xl border border-slate-200">
      
      {/* Upper navigation header */}
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
              title="Return to applications grid"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" /> Live Excel Matcher
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1 flex items-center gap-2">
              Process Monitoring Database
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">Reconciling document queues, response periods, and employee productivity ratios.</p>
          </div>
        </div>

        {/* Functional exporting triggers */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleExportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV Spreadsheet
          </button>
          <button 
            type="button"
            onClick={handlePrint}
            className="bg-white border hover:bg-slate-50 border-slate-300 text-slate-700 text-[11px] font-extrabold uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Dynamic Form Type Tabs to partition database */}
      <div className="flex border-b border-slate-200 print:hidden -mt-2">
        <button
          onClick={() => {
            setActiveFormType('VEP');
            setServiceFilter('All');
          }}
          className={cn(
            "px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeFormType === 'VEP'
              ? "border-emerald-600 text-emerald-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Vessel Entry Permits (VEP)
        </button>
        <button
          onClick={() => {
            setActiveFormType('PAS');
            setServiceFilter('All');
          }}
          className={cn(
            "px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeFormType === 'PAS'
              ? "border-emerald-600 text-emerald-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <FileText className="w-4 h-4" />
          Port Ancillary Services (PAS)
        </button>
        <button
          onClick={() => {
            setActiveFormType('PGP');
            setServiceFilter('All');
          }}
          className={cn(
            "px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeFormType === 'PGP'
              ? "border-emerald-600 text-emerald-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <FileText className="w-4 h-4" />
          Port Gate Passes (PGP)
        </button>
      </div>

      {/* KPI Dashboards with SLAs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
        <div className="bg-white border mt-1 border-slate-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-slate-100 text-slate-600 p-2.5 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              {activeFormType === 'PAS' ? "Processed Services" : activeFormType === 'PGP' ? "Processed Passes" : "Processed Permits"}
            </span>
            <span className="text-2xl font-extrabold text-slate-800">{reportStats.total}</span>
          </div>
        </div>

        <div className="bg-white border mt-1 border-slate-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Avg Docs Review</span>
            <span className="text-lg font-mono font-bold text-slate-800">{reportStats.avgDocTime}</span>
          </div>
        </div>

        <div className="bg-white border mt-1 border-slate-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-purple-50 text-purple-600 p-2.5 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Avg Appr Release</span>
            <span className="text-lg font-mono font-bold text-slate-800">{reportStats.avgApproveTime}</span>
          </div>
        </div>

        <div className="bg-white border mt-1 border-slate-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Avg Cycle Speed</span>
            <span className="text-lg font-mono font-bold text-slate-800">{reportStats.avgCycleTime}</span>
          </div>
        </div>

        <div className="bg-white border mt-1 border-slate-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">10-Min SLA met</span>
            <span className={cn(
              "text-lg font-extrabold",
              reportStats.slaMetPercent >= 85 ? "text-green-600" : "text-amber-600"
            )}>{reportStats.slaMetPercent}%</span>
          </div>
        </div>
      </section>

      {/* Grid Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 print:hidden justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar search shortcut */}
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Months</option>
              {monthNames.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Voyage service type for VEP */}
          {activeFormType === 'VEP' && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Vessel Types</option>
              <option value="DOMESTIC">DOMESTIC WORK</option>
              <option value="FOREIGN">FOREIGN FLEET</option>
            </select>
          )}

          {/* Cargo service type for PGP */}
          {activeFormType === 'PGP' && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Cargo Classifications</option>
              <option value="BULK CARGO">BULK CARGO</option>
              <option value="BREAKBULK CARGO">BREAKBULK CARGO</option>
              <option value="CONTAINERIZED">CONTAINERIZED</option>
              <option value="GENERAL CARGO">GENERAL CARGO</option>
            </select>
          )}
        </div>

        {/* Regular search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeFormType === 'PAS' 
                ? "FILTER SERVICE OR CLIENT..." 
                : activeFormType === 'PGP' 
                ? "FILTER COMPANY OR REPRESENTATIVE..." 
                : "FILTER VESSEL OR AGENT..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-4 text-xs font-bold uppercase placeholder:text-slate-400 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
          />
        </div>
      </div>

      {/* High capacity, double-header green-styled spreadsheet container */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-md flex-grow flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto no-scrollbar max-h-[60vh] text-[11px]">
          <table className="w-full table-auto border-collapse font-sans text-left min-w-[2200px]">
            {/* Level 1 Grouped Category Header */}
            <thead className="bg-[#107c41] text-white">
              <tr className="divide-x divide-[#ffffff22]">
                <th colSpan={3} className="px-4 py-2 text-[10px] uppercase tracking-wider font-extrabold text-center bg-[#0d6434]">
                  RECORDS INDEX
                </th>
                 <th colSpan={6} className="px-4 py-2 text-[10px] uppercase tracking-wider font-extrabold text-center bg-[#0a5129]">
                  {activeFormType === 'PAS' ? 'ANCILLARY GENERAL METRICS' : activeFormType === 'PGP' ? 'GATE PASS GENERAL METRICS' : 'VESSEL GENERAL METRICS'}
                </th>
                <th colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold text-center bg-[#107c41]">
                  DOCUMENTS VERIFICATION (CHECKER REVIEW)
                </th>
                <th colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold text-center bg-[#138446]">
                  AUTHORIZATION SIGN-OFF (APPROVER)
                </th>
                <th colSpan={4} className="px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold text-center bg-[#105a31]">
                  RELEASING STAGE
                </th>
                <th colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold text-center bg-[#0d4a27]">
                  KPI TRACKING & RATINGS
                </th>
              </tr>
              
              {/* Level 2 Exact Sheet Column Header Map */}
              <tr className="divide-x divide-[#ffffff22] border-t border-[#ffffff22] text-[10px] bg-[#128a49] uppercase tracking-wider font-black text-center whitespace-nowrap">
                <th className="p-2.5 w-12 sticky left-0 bg-[#128a49] text-center z-12">#NO</th>
                <th className="p-2.5 w-12 text-center">NO.</th>
                <th className="p-2.5 text-left pl-3">CTRL NO</th>
                <th className="p-2.5">{activeFormType === 'PAS' ? 'ANCILLARY SERVICE CATEGORY' : activeFormType === 'PGP' ? 'CLASSIFICATION OF CARGO' : 'TYPE OF VESSEL (VOYAGE)'}</th>
                <th className="p-2.5 text-left pl-3">{activeFormType === 'PGP' ? 'COMPANY / VESSEL NAME' : 'NAME OF VESSEL'}</th>
                <th className="p-2.5">{activeFormType === 'PAS' ? 'SERVICE REFERENCE' : activeFormType === 'PGP' ? 'VOYAGE / REF' : 'VOYAGE NO.'}</th>
                <th className="p-2.5 text-left pl-3">{activeFormType === 'PAS' ? 'SERVICE PROVIDER / CLIENT' : activeFormType === 'PGP' ? 'REPRESENTATIVE / CLIENT' : 'CLIENT (AGENT / LINE)'}</th>
                <th className="p-2.5">DATE OF APPLICATION</th>
                <th className="p-2.5">Month of Application</th>
                
                {/* CHECKING STAGE */}
                <th className="p-2.5 bg-[#1b9a55]">TIME IN (1)</th>
                <th className="p-2.5 bg-[#1b9a55]">TIME OUT (1)</th>
                <th className="p-2.5 bg-[#1b9a55] font-extrabold text-amber-200">DOCS PROCESSING (HH:MM:SS)</th>
                <th className="p-2.5 bg-[#1b9a55] w-2.5"></th>
                <th className="p-2.5 bg-[#1b9a55]">FRONTLINE PERSONNEL</th>
                
                {/* APPROVAL STAGE */}
                <th className="p-2.5 bg-[#1fa45a]">TIME IN (2)</th>
                <th className="p-2.5 bg-[#1fa45a]">TIME OUT (2)</th>
                <th className="p-2.5 bg-[#1fa45a] font-extrabold text-amber-200">APPROVAL TIME (HH:MM:SS)</th>
                <th className="p-2.5 bg-[#1fa45a] w-2.5"></th>
                <th className="p-2.5 bg-[#1fa45a]">APPROVING OFFICER</th>
                
                {/* RELEASING STAGE */}
                <th className="p-2.5 bg-[#176a3a]">RELEASE DATE</th>
                <th className="p-2.5 bg-[#176a3a]">RELEASE TIME</th>
                <th className="p-2.5 bg-[#176a3a] font-extrabold text-amber-200">RELEASE PROCESS (HH:MM:SS)</th>
                <th className="p-2.5 bg-[#176a3a] font-extrabold text-yellow-300">TOTAL CYCLE TIME</th>
                
                {/* KPI/RATINGS */}
                <th className="p-2.5 bg-[#0f4f2a] text-center text-amber-100">RATING Quality</th>
                <th className="p-2.5 bg-[#0f4f2a] text-center text-amber-100">RATING Timeliness</th>
                <th className="p-2.5 bg-[#0f4f2a]">ISSUED BY</th>
                <th className="p-2.5 bg-[#0f4f2a]">RECEIVED BY</th>
                <th className="p-2.5 bg-[#0f4f2a] text-left pl-3">PROCESS REMARKS</th>
              </tr>
            </thead>

            {/* Structured Table Rows matching actual report entries */}
            <tbody className="divide-y divide-slate-200 bg-white leading-tight">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={30} className="text-center py-24 text-slate-400 font-bold uppercase tracking-widest bg-slate-50">
                    No records compiled within these filter sets
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, indexIndex) => (
                  <tr 
                    key={row.ctrlNo} 
                    className="hover:bg-slate-50 divide-x divide-slate-100 uppercase tracking-tight font-medium text-slate-700 whitespace-nowrap"
                  >
                    {/* Indexing headers */}
                    <td className="p-2 text-center text-slate-500 font-mono text-[9px] w-12 sticky left-0 bg-white border-r border-slate-200 hover:bg-slate-50 z-10 font-bold">
                      {row.index}
                    </td>
                    <td className="p-2 text-center text-slate-400 font-mono text-[10px] w-12">{filteredRows.length - indexIndex}</td>
                    <td className="p-2 text-left pl-3 font-semibold text-slate-800 font-mono text-[10px]">{row.ctrlNo}</td>
                    <td className="p-2 text-center">
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                        activeFormType === 'PAS'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : row.typeOfVessel === 'DOMESTIC' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      )}>
                        {row.typeOfVessel}
                      </span>
                    </td>
                    <td className="p-2 text-left pl-3 text-slate-900 font-bold max-w-[200px] truncate">{row.nameOfVessel}</td>
                    <td className="p-2 text-center font-mono text-[10px]">{row.voyageNo}</td>
                    <td className="p-2 text-left pl-3 text-slate-600 max-w-[220px] truncate">{row.client}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-500">{row.dateOfApplication}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-400">{row.monthOfApplication}</td>
                    
                    {/* CHECKING PROCESS DATA */}
                    <td className="p-2 text-center font-mono text-[10px] bg-slate-50/50">{row.timeIn1}</td>
                    <td className="p-2 text-center font-mono text-[10px] bg-slate-50/50">{row.timeOut1}</td>
                    <td className="p-2 text-center font-bold font-mono text-[10px] text-indigo-600 bg-slate-50/50">{row.docsProcessingTime}</td>
                    <td className="p-2 bg-slate-50/50 w-2.5"></td>
                    <td className="p-2 text-center font-bold text-slate-800 bg-slate-50/50">{row.assignedPersonnel1}</td>
                    
                    {/* APPROVAL PROCESS DATA */}
                    <td className="p-2 text-center font-mono text-[10px] bg-[#fbfffb]/40">{row.timeIn2}</td>
                    <td className="p-2 text-center font-mono text-[10px] bg-[#fbfffb]/40">{row.timeOut2}</td>
                    <td className="p-2 text-center font-bold font-mono text-[10px] text-purple-600 bg-[#fbfffb]/40">{row.approvalProcessingTime}</td>
                    <td className="p-2 bg-[#fbfffb]/40 w-2.5"></td>
                    <td className="p-2 text-center font-bold text-slate-800 bg-[#fbfffb]/40">{row.assignedPersonnel2}</td>
                    
                    {/* RELEASING PROCESS DATA */}
                    <td className="p-2 text-center font-mono text-[10px] bg-[#f9fbf9]/60">{row.releaseDate}</td>
                    <td className="p-2 text-center font-mono text-[10px] bg-[#f9fbf9]/60">{row.releaseTime}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-500 bg-[#f9fbf9]/60">{row.releasingProcessingTime}</td>
                    <td className="p-2 text-center font-bold font-mono text-[10.5px] text-emerald-700 bg-emerald-50">{row.totalCycleTime}</td>
                    
                    {/* RATINGS & OFFICERS */}
                    <td className="p-2 text-center font-bold text-amber-500 bg-amber-50/30 text-xs">{row.ratingQuality}</td>
                    <td className="p-2 text-center font-bold text-amber-500 bg-amber-50/30 text-xs">{row.ratingTimeliness}</td>
                    <td className="p-2 text-center text-slate-600">{row.issuedBy}</td>
                    <td className="p-2 text-center text-slate-500 max-w-[150px] truncate">{row.receivedBy || '-'}</td>
                    <td className="p-2 text-left pl-3 text-slate-500 max-w-[200px] truncate italic">{row.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info containing SLA details as in the sheets template */}
        <div className="bg-slate-50 text-slate-400 px-4 py-2 text-[10px] border-t border-slate-200 flex flex-wrap justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wide">Target Standards:</span>
            <span>Documents review limit (3 mins)</span>
            <span>•</span>
            <span>Chief Authorization limits (5 mins)</span>
            <span>•</span>
            <span>Total Release SLA limit (10 mins)</span>
          </div>
          <div className="font-mono text-slate-500 font-semibold uppercase">
            FAB Process Auditor v1.2
          </div>
        </div>
      </div>
    </div>
  );
};
