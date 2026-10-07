import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2, ArrowLeft, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { VesselApplication } from '../types';
import { formatSystemDateTime } from '../utils/dateFormatter';
import { oklchToRgb } from '../utils/colorConverter';
import { normalizeTerminal, FAB_PORT_TERMINALS } from '../utils/terminalNormalizer';
import fabLogo from '../assets/images/fab-logo.png';

interface PASFormProps {
  onBack: () => void;
  onSubmitApp?: (app: Omit<VesselApplication, 'id' | 'createdAt' | 'status'> & { id?: string }) => void;
  initialData?: Partial<VesselApplication>;
  isEditMode?: boolean;
  authRole?: 'admin' | 'user' | 'checker' | 'approver';
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

export const PASForm: React.FC<PASFormProps> = ({ 
  onBack, 
  onSubmitApp, 
  options, 
  initialData, 
  isEditMode = false,
  authRole = 'user'
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSavingControlNo, setIsSavingControlNo] = useState(false);

  // Initialize form data with fallback values or initial data
  const [controlNumber, setControlNumber] = useState<string>(initialData?.id || '');
  const [formData, setFormData] = useState<Partial<VesselApplication>>({
    applicationType: 'PAS',
    serviceProviderName: initialData?.serviceProviderName || '',
    vesselName: initialData?.vesselName || '',
    voyageNo: initialData?.voyageNo || '',
    voyageType: initialData?.voyageType || 'Domestic',
    serviceBusinessAddress: initialData?.serviceBusinessAddress || '',
    terminal: initialData?.terminal || '',
    serviceContactNo: initialData?.serviceContactNo || '',
    selectedServices: initialData?.selectedServices || [],
    otherServiceSpecify: initialData?.otherServiceSpecify || '',
    detailsOfService: initialData?.detailsOfService || '',
    validity: initialData?.validity || '30 DAYS',
    submitterName: initialData?.submitterName || '',
    signatureType: initialData?.signatureType || 'draw',
    signatureData: initialData?.signatureData || '',
    // Propagate standard fields for routing
    agent: initialData?.agent || initialData?.serviceProviderName || '',
  });

  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const previewParentRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(794);

  const terminalOptions = React.useMemo(() => {
    const list = (options?.terminals || []).map(normalizeTerminal).filter(Boolean);
    if (list.length > 0) {
      return Array.from(new Set(list)).sort();
    }
    return [...FAB_PORT_TERMINALS];
  }, [options?.terminals]);

  useEffect(() => {
    if (!previewParentRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(previewParentRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Generate/Update control number in real-time for fresh applications
  useEffect(() => {
    if (isEditMode) return;

    let isMounted = true;

    const fetchAndSetControlNumber = async () => {
      const yearPrefix = '26';
      let maxSeq = 350; // Start with the user's specified last control number

      // 1. Process current applications/options list if available
      const used = options?.usedControlNumbers || [];
      used.forEach(num => {
        const cleanNum = String(num).trim();
        const match = cleanNum.match(/PAS-(?:26-)?(\d+)/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > maxSeq) {
            maxSeq = val;
          }
        }
      });

      // 2. Fetch the live Google Sheet to ensure we have the absolute latest records from other sessions
      try {
        let rows: string[][] = [];
        let fetchedSuccessfully = false;

        // Try using Google Sheets API first if we have an active access token
        try {
          const { getAccessToken, getProcessMonitoringSpreadsheetId } = await import('../services/googleSheetsService');
          const token = await getAccessToken();
          if (token) {
            const sheetName = 'PORT ANCILLARY SERVICES'; // Default sheet name for GID 185820608
            const res = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${getProcessMonitoringSpreadsheetId()}/values/'${encodeURIComponent(sheetName)}'!C:C`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );
            if (res.ok) {
              const data = await res.json();
              if (data.values) {
                rows = data.values;
                fetchedSuccessfully = true;
                console.log("[PASForm] Successfully fetched latest control numbers via Google Sheets API. Count:", rows.length);
              }
            }
          }
        } catch (apiErr) {
          console.warn("[PASForm] Failed to fetch via Google Sheets API, trying CSV export fallback:", apiErr);
        }

        if (!fetchedSuccessfully) {
          const { getProcessMonitoringSpreadsheetId } = await import('../services/googleSheetsService');
          const sheetUrl = `https://docs.google.com/spreadsheets/d/${getProcessMonitoringSpreadsheetId()}/export?format=csv&gid=185820608&t=${Date.now()}`;
          const res = await fetch(sheetUrl, { cache: "no-store" });
          let csvText = "";

          if (res.redirected && res.url.includes("ServiceLogin")) {
            console.warn("Google Sheets redirected to login. Using fallback CSV for PAS.");
            const fallbackRes = await fetch(`/ancillary_mock.csv?t=${Date.now()}`);
            csvText = await fallbackRes.text();
          } else if (!res.ok) {
            console.warn("Google Sheets fetch failed. Using fallback CSV for PAS.");
            const fallbackRes = await fetch(`/ancillary_mock.csv?t=${Date.now()}`);
            csvText = await fallbackRes.text();
          } else {
            csvText = await res.text();
          }

          if (csvText) {
            await new Promise<void>((resolve) => {
              Papa.parse(csvText, {
                header: false,
                complete: (result) => {
                  rows = result.data as string[][];
                  resolve();
                }
              });
            });
          }
        }

        if (rows && rows.length > 0 && isMounted) {
          rows.forEach(row => {
            if (row) {
              row.forEach(cell => {
                const ctrl = String(cell).trim().toUpperCase();
                if (ctrl.startsWith("PAS-") || ctrl.startsWith("PS-")) {
                  const match = ctrl.match(/PAS-(?:26-)?(\d+)/i) || ctrl.match(/PAS-(\d+)/i);
                  if (match) {
                    const seq = parseInt(match[1], 10);
                    if (!isNaN(seq) && seq > maxSeq) {
                      maxSeq = seq;
                    }
                  }
                }
              });
            }
          });

          const nextSeq = maxSeq + 1;
          const paddedSeq = String(nextSeq).padStart(3, '0');
          const candidate = `PAS-${yearPrefix}-${paddedSeq}`;
          if (isMounted && controlNumber !== candidate) {
            setControlNumber(candidate);
          }
        } else if (isMounted) {
          const nextSeq = maxSeq + 1;
          const paddedSeq = String(nextSeq).padStart(3, '0');
          const candidate = `PAS-${yearPrefix}-${paddedSeq}`;
          if (isMounted && controlNumber !== candidate) {
            setControlNumber(candidate);
          }
        }
      } catch (err) {
        console.warn("Error fetching live ancillary sheet for PAS control number sequence:", err);
        // Fallback to options/local maxSeq immediately on network failure
        const nextSeq = maxSeq + 1;
        const paddedSeq = String(nextSeq).padStart(3, '0');
        const candidate = `PAS-${yearPrefix}-${paddedSeq}`;
        if (isMounted && controlNumber !== candidate) {
          setControlNumber(candidate);
        }
      }
    };

    fetchAndSetControlNumber();

    return () => {
      isMounted = false;
    };
  }, [isEditMode, options?.usedControlNumbers, controlNumber]);

  // Keep agent field synced with serviceProviderName for compatibility with general logs
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      agent: prev.serviceProviderName
    }));
  }, [formData.serviceProviderName]);

  // Toggle service checkbox selection
  const handleServiceChange = (serviceName: string) => {
    const current = formData.selectedServices || [];
    if (current.includes(serviceName)) {
      setFormData(prev => ({
        ...prev,
        selectedServices: current.filter(s => s !== serviceName)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedServices: [...current, serviceName]
      }));
    }
  };

  // Drawing signature pad handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#0f172a'; // slate-900 (explicit color to support html2canvas correctly)
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignature();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData(prev => ({ ...prev, signatureData: '' }));
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setFormData(prev => ({ ...prev, signatureData: dataUrl }));
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({
          ...prev,
          signatureType: 'upload',
          signatureData: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceProviderName) return alert('Service Provider Name is required.');
    if (!formData.vesselName) return alert('Vessel Name is required.');
    if (!formData.signatureData) return alert('Your Representative Signature is required to submit.');

    setIsSubmitting(true);
    try {
      if (onSubmitApp) {
        await onSubmitApp({
          ...formData,
          id: controlNumber,
        } as any);
      }
      setShowSuccess(true);
      if (isEditMode) {
        setTimeout(() => {
          setShowSuccess(false);
          onBack();
        }, 2000);
      }
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe High Resolution Image / Document export utilizing html2canvas
  const handleExportPNG = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPDF(true);
    
    // Setup style/link rollbacks and override getComputedStyle for html2canvas
    const styleRollback: { element: HTMLElement; text?: string; disabled?: boolean }[] = [];
    const linkRollback: { element: HTMLLinkElement; disabled: boolean }[] = [];
    const originalGetComputedStyle = window.getComputedStyle;

    const sanitizeColorString = (val: string): string => {
      if (!val || typeof val !== 'string') return val;
      let result = val;
      const colorFuncs = ['oklch', 'oklab'];
      
      for (const func of colorFuncs) {
        let index = result.indexOf(func + '(');
        while (index !== -1) {
          let depth = 1;
          let end = -1;
          const start = index + func.length + 1;
          for (let i = start; i < result.length; i++) {
            if (result[i] === '(') depth++;
            else if (result[i] === ')') {
              depth--;
              if (depth === 0) {
                end = i;
                break;
              }
            }
          }
          
          if (end !== -1) {
            const fullColorSpec = result.substring(index, end + 1);
            let replacement = 'rgb(148, 163, 184)'; // Fallback slate-400 color
            if (fullColorSpec.includes(' / 0') || fullColorSpec.includes('/0')) {
              replacement = 'rgba(0,0,0,0)';
            } else if (fullColorSpec.toLowerCase().includes('white') || fullColorSpec.includes('0.9') || fullColorSpec.includes(' 1 ') || fullColorSpec.includes(' 1)')) {
              replacement = 'rgb(255,255,255)';
            } else if (fullColorSpec.includes('0.2') || fullColorSpec.includes('0.1') || fullColorSpec.includes('0.0')) {
              replacement = 'rgba(148, 163, 184, 0.2)';
            } else if (fullColorSpec.includes(' 0 ') || fullColorSpec.includes(' 0)')) {
              replacement = 'rgb(0,0,0)';
            }
            result = result.substring(0, index) + replacement + result.substring(end + 1);
            index = result.indexOf(func + '(');
          } else {
            break;
          }
        }
      }
      return result;
    };

    try {
      // Intercept window.getComputedStyle to rewrite modern CSS-color-4 output format to rgb/rgba
      window.getComputedStyle = function (el, pseudoElt) {
        const style = originalGetComputedStyle(el, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (typeof prop === 'string') {
              if (prop === 'getPropertyValue') {
                return function (propertyName: string) {
                  const val = target.getPropertyValue(propertyName);
                  return sanitizeColorString(val);
                };
              }
              const val = target[prop as any];
              if (typeof val === 'string') {
                return sanitizeColorString(val);
              }
            }
            const val = Reflect.get(target, prop);
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };

      // Process internal style blocks using our oklch-to-rgb converter
      document.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
          styleRollback.push({ element: styleEl, text: styleEl.textContent });
          styleEl.textContent = oklchToRgb(styleEl.textContent);
        }
      });

      // Fetch and process same-origin stylesheet links
      const linkPromises: Promise<void>[] = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach((linkEl) => {
        const href = linkEl.getAttribute('href');
        if (href) {
          if (href.startsWith('/') || href.startsWith(window.location.origin)) {
            const promise = fetch(href)
              .then(res => res.text())
              .then(cssText => {
                if (cssText.includes('oklch') || cssText.includes('oklab')) {
                  const el = linkEl as HTMLLinkElement;
                  linkRollback.push({ element: el, disabled: el.disabled });
                  el.disabled = true;

                  const tempStyle = document.createElement('style');
                  tempStyle.textContent = oklchToRgb(cssText);
                  document.head.appendChild(tempStyle);
                  styleRollback.push({ element: tempStyle });
                }
              })
              .catch(err => {
                console.warn('Could not preprocess link stylesheet:', href, err);
              });
            linkPromises.push(promise);
          }
        }
      });

      if (linkPromises.length > 0) {
        await Promise.all(linkPromises);
      }

      // Small pause to settle visual states and styles
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(printAreaRef.current, {
        scale: 2.5, // double the scale for sharp details
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      const fileData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${controlNumber || 'Port-Ancillary-Service'}-PAS-Form.png`;
      link.href = fileData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failure:", e);
      alert("Failed to export PAS file. Please try again.");
    } finally {
      // Restore window.getComputedStyle immediately to prevent affecting original app behaviors
      window.getComputedStyle = originalGetComputedStyle;

      // Restore original styles/links
      styleRollback.forEach(item => {
        if (item.text !== undefined) {
          item.element.textContent = item.text;
        } else {
          item.element.parentNode?.removeChild(item.element);
        }
      });

      linkRollback.forEach(item => {
        item.element.disabled = item.disabled;
      });

      setIsGeneratingPDF(false);
    }
  };

  if (showSuccess && !isEditMode) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 font-sans">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Application Transmitted!</h2>
        <p className="text-slate-600 mt-3 text-sm leading-relaxed font-medium">
          Your Port Ancillary Service (PAS) form has been securely submitted under registration reference:
        </p>
        <div className="bg-slate-100 border border-slate-200 font-mono text-base font-bold text-slate-800 py-2.5 px-4 rounded-lg inline-block my-4 select-all">
          {controlNumber}
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          The application has been routed directly to the Port Services Division Checker queue for visual validations. Once checked, it advances to the Chef Port Approver stage.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 font-semibold uppercase tracking-wider text-xs">
          <button 
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const scaleFactor = isGeneratingPDF ? 1 : (containerWidth < 794 ? containerWidth / 794 : 1);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start min-h-0 font-sans print:block">
      
      {/* LEFT FORM/ENTRY SPACE - HIDDEN FROM PRINT */}
      <div className="xl:col-span-5 space-y-6 print:hidden">
        
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-600 hover:text-fab-blue transition-colors font-bold uppercase text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </button>
          
          {isEditMode && (
            <button
              onClick={handleExportPNG}
              disabled={isGeneratingPDF}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> 
              {isGeneratingPDF ? 'Generating Document...' : 'Export PNG Form'}
            </button>
          )}
        </div>

        {/* Dynamic header summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2.5 rounded-lg text-purple-700">
              <span className="text-xl">🛠️</span>
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 leading-tight text-base uppercase">PAS Application Portal</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Request or file a Port Ancillary Service Permit (PAS) under Bataan Authority guidelines.</p>
            </div>
          </div>
        </div>

        {isEditMode && (authRole === 'admin' || authRole === 'checker' || authRole === 'approver') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mb-2">Stage Control & Actions</h3>
            <p className="text-slate-600 text-xs leading-relaxed font-semibold">
              This application is in review/edit mode. You can edit any field in the form below and click "Save Changes" to update.
            </p>

            {/* Show Edit PAS Control Number input for checkers, approvers, and admins */}
            <div className="bg-amber-50/70 p-4 rounded-lg border border-amber-200/50 space-y-2 mt-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
                Edit PAS Control Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value.toUpperCase())}
                  placeholder="PAS-26-XXX"
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  disabled={isSavingControlNo || controlNumber.trim() === (initialData?.id || '') || !controlNumber.trim()}
                  onClick={async () => {
                    if (!controlNumber.trim()) return;
                    try {
                      setIsSavingControlNo(true);
                      await onSubmitApp?.({
                        ...formData,
                        id: controlNumber.trim(),
                      } as any);
                      alert("PAS Control Number successfully updated!");
                    } catch (err: any) {
                      console.error("Failed to update PAS Control Number:", err);
                      alert(`Failed to update: ${err.message}`);
                    } finally {
                      setIsSavingControlNo(false);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
                >
                  {isSavingControlNo ? "Saving..." : "Update"}
                </button>
              </div>
              <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                Notice: Changing this will rename the document key in Firestore and automatically update linked records.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onBack}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] rounded-lg border transition-colors inline-block text-center cursor-pointer"
              >
                Return to Dashboard List
              </button>
            </div>
          </div>
        )}

        {/* Success banner for in-place edits */}
        {isEditMode && showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4 flex items-center gap-3 text-left"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-bold text-xs">Changes saved successfully! Returning to list...</span>
          </motion.div>
        )}

        {(!isEditMode || (authRole === 'admin' || authRole === 'checker' || authRole === 'approver')) ? (
          <form onSubmit={handleFinalSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5 text-left">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                1. Service & Voyage Profiles
              </h3>
            </div>

            {/* Service Provider Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                1. Name of Service Provider <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                value={formData.serviceProviderName}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceProviderName: e.target.value.toUpperCase() }))}
                placeholder="e.g. MALAYAN TOWAGE & SALVAGE CORP."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name of Vessel */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  2. Name of Vessel <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                  value={formData.vesselName}
                  onChange={(e) => setFormData(prev => ({ ...prev, vesselName: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MT BATAAN STAR"
                />
              </div>

              {/* Voyage No */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  3. Voyage No.
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                  value={formData.voyageNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, voyageNo: e.target.value.toUpperCase() }))}
                  placeholder="e.g. V-2608"
                />
              </div>
            </div>

            {/* Voyage Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                4. Voyage Type <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="voyageType"
                    value="Foreign"
                    checked={formData.voyageType === 'Foreign'}
                    onChange={() => setFormData(prev => ({ ...prev, voyageType: 'Foreign' }))}
                    className="accent-fab-blue w-4 h-4"
                  />
                  <span>FOREIGN</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="voyageType"
                    value="Domestic"
                    checked={formData.voyageType === 'Domestic'}
                    onChange={() => setFormData(prev => ({ ...prev, voyageType: 'Domestic' }))}
                    className="accent-fab-blue w-4 h-4"
                  />
                  <span>DOMESTIC</span>
                </label>
              </div>
            </div>

            {/* Business Address */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                5. Business Address
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                value={formData.serviceBusinessAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceBusinessAddress: e.target.value.toUpperCase() }))}
                placeholder="e.g. PORT ROAD, BRGY. ALAS-ASIN, MARIVELES BATAAN"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Port Terminal dropdown / suggestions */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  6. Port Terminal <span className="text-red-500">*</span>
                </label>
                <select 
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-fab-blue/25"
                  value={formData.terminal}
                  onChange={(e) => setFormData(prev => ({ ...prev, terminal: e.target.value }))}
                  required
                >
                  <option value="">-- CHOOSE TERMINAL --</option>
                  {terminalOptions.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>

              {/* Contact No */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  7. Contact No.
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                  value={formData.serviceContactNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceContactNo: e.target.value.toUpperCase() }))}
                  placeholder="e.g. +63 917 123 4567"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                2. Types of Ancillary Services
              </h3>
            </div>

            {/* Interactive checkboxes layout matching form types */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Bunkering')}
                  onChange={() => handleServiceChange('Bunkering')}
                />
                <span>Bunkering</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Waste Collection')}
                  onChange={() => handleServiceChange('Waste Collection')}
                />
                <span>Waste Collection</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Tugboat Services')}
                  onChange={() => handleServiceChange('Tugboat Services')}
                />
                <span>Tugboat Services</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Water Tendering')}
                  onChange={() => handleServiceChange('Water Tendering')}
                />
                <span>Water Tendering</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Cargo Handling Services')}
                  onChange={() => handleServiceChange('Cargo Handling Services')}
                />
                <span>Cargo Handling Services</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Chandling')}
                  onChange={() => handleServiceChange('Chandling')}
                />
                <span>Chandling</span>
              </label>
              <label className="flex items-start gap-2.5 text-slate-700 font-semibold cursor-pointer py-1 sm:col-span-2">
                <input 
                  type="checkbox" 
                  className="accent-fab-blue rounded mt-0.5"
                  checked={(formData.selectedServices || []).includes('Vessel Repairs, Hotworks & Maintenance')}
                  onChange={() => handleServiceChange('Vessel Repairs, Hotworks & Maintenance')}
                />
                <span>Vessel Repairs, Hotworks & Maintenance</span>
              </label>
              <div className="sm:col-span-2 border-t border-slate-200/60 pt-2.5 mt-1">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Others, specify:
                </label>
                <input 
                  type="text"
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-800 uppercase"
                  placeholder="e.g. MARITIME INSPECTION / SALVAGE SURVEYS"
                  value={formData.otherServiceSpecify}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherServiceSpecify: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            {/* Validity Display / Configuration */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Requested License Validity
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-800 uppercase tracking-wider"
                value={formData.validity}
                onChange={(e) => setFormData(prev => ({ ...prev, validity: e.target.value.toUpperCase() }))}
                placeholder="e.g. 30 DAYS / 7 DAYS"
              />
            </div>

            {/* Details of Service */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                9. Details of Service <span className="text-red-500">*</span>
              </label>
              <textarea 
                required
                rows={4}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                value={formData.detailsOfService}
                onChange={(e) => setFormData(prev => ({ ...prev, detailsOfService: e.target.value.toUpperCase() }))}
                placeholder="PLEASE DESCRIBE SPECIFIC TASKS, LOGS, TONNAGE, AND LOGISTICS REQUIREMENTS..."
              />
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                3. Submitter Representative Sign-Off
              </h3>
            </div>

            {/* Submitter Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Service Representative Full Name <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-fab-blue/25 transition-all"
                value={formData.submitterName}
                onChange={(e) => setFormData(prev => ({ ...prev, submitterName: e.target.value.toUpperCase() }))}
                placeholder="e.g. JUAN DE LA CRUZ"
              />
            </div>

            {/* Interactive Signature Methods (Draw / Upload File) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Digital Signature Authorization <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, signatureType: 'draw', signatureData: '' }))}
                  className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded-md border uppercase tracking-wider transition-all duration-150 ${
                    formData.signatureType === 'draw'
                      ? 'bg-fab-blue text-white border-fab-blue shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  🖋️ Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, signatureType: 'upload', signatureData: '' }))}
                  className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded-md border uppercase tracking-wider transition-all duration-150 ${
                    formData.signatureType === 'upload'
                      ? 'bg-fab-blue text-white border-fab-blue shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  📁 Upload Image
                </button>
              </div>

              {/* Pad / File area */}
              {formData.signatureType === 'draw' ? (
                <div className="mt-3 bg-slate-50 border border-slate-300 rounded-lg p-2.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Sign inside box:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[9px] font-extrabold uppercase tracking-wide text-red-600 hover:text-red-800 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="border border-dashed border-slate-300 rounded bg-white">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-24 cursor-crosshair touch-none bg-white block"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 bg-slate-50 border border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-center h-[120px]">
                  {formData.signatureData ? (
                    <div className="flex flex-col items-center justify-between h-full w-full">
                      <div className="flex-1 flex items-center justify-center">
                        <img
                          src={formData.signatureData}
                          alt="Representative sign"
                          className="max-h-16 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, signatureData: '' }))}
                        className="text-[9px] font-bold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        id="signature-file-uploader-pas"
                        className="hidden"
                      />
                      <label
                        htmlFor="signature-file-uploader-pas"
                        className="inline-block cursor-pointer px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-bold text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Browse Signature
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1">
                        PNG or JPEG (transparent backgrounds fit perfectly)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions list */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.signatureData}
                className="flex-1 py-2.5 bg-fab-red hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-black uppercase tracking-wider text-xs transition-colors shadow-sm cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Transmit PAS Form'}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mb-2">Stage Control & Actions</h3>
            <p className="text-slate-600 text-xs leading-relaxed font-semibold">
              This application is in review mode. You can inspect the document structure on the right side.
            </p>

            <div className="pt-2">
              <button
                onClick={onBack}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] rounded-lg border transition-colors inline-block text-center cursor-pointer"
              >
                Return to Dashboard List
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PREVIEW CANVAS - DISPLAYED AS MAIN CARD AT HIGH FIDELITY */}
      <div className="xl:col-span-7 print:block">
        
        {/* Title for preview section */}
        <div className="mb-3 flex justify-between items-center print:hidden">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PAS Form Document Preview:</span>
          {!isEditMode && (
            <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-extrabold uppercase">
              Draft Mode
            </span>
          )}
        </div>

        {/* Printable actual form frame */}
        <div 
          ref={previewParentRef}
          className="bg-slate-100 p-4 sm:p-6 rounded-xl border border-slate-200 overflow-x-auto print:border-none print:shadow-none print:p-0 print:bg-white select-none"
        >
          <div
            style={{
              height: `${1123 * scaleFactor}px`,
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
            className="print:h-auto print:overflow-visible print:block"
          >
            <div 
              ref={printAreaRef}
              className="w-[794px] h-[1123px] bg-white text-black p-10 select-none shadow-md print:shadow-none font-serif relative border border-slate-300/40 print:border-none mx-auto print:m-0"
              style={{
                minWidth: '794px',
                maxWidth: '794px',
                aspectRatio: '1 / 1.414',
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'top center',
                flexShrink: 0
              }}
            >
            {/* Header section with logos */}
            <div className="flex justify-between items-start border-b border-slate-950 pb-4 font-sans select-none">
              <div className="flex gap-4 items-center">
                <img 
                  src={fabLogo} 
                  alt="Authority of the Freeport Area of Bataan" 
                  className="w-16 h-16 object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left select-none leading-none">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest leading-none">Republic of the Philippines</p>
                  <p className="text-[13px] font-extrabold text-slate-800 uppercase tracking-widest mt-1 leading-none">Authority of the Freeport Area of Bataan</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 leading-none">Freeport Area of Bataan, Mariveles Bataan</p>
                  <p className="text-[12px] font-black text-slate-700 uppercase tracking-widest mt-2 border-t border-slate-100 pt-1 leading-none">Port Services Division</p>
                </div>
              </div>
              
              <div className="w-[200px] border border-slate-300 rounded p-2 select-none">
                <p className="text-[8px] font-bold leading-relaxed text-slate-500 uppercase text-justify">
                  Privacy Notice: "The Authority of the Freeport Area of Bataan (AFAB) ensures that the data gathered in this form are held under strict confidentiality in accordance with the R.A.10173 otherwise known as the Data Privacy Act of 2012."
                </p>
              </div>
            </div>

            {/* Title Block & Control fields */}
            <div className="grid grid-cols-12 border-b border-l border-r border-slate-950 font-sans select-none">
              <div className="col-span-8 bg-slate-100 border-r border-slate-950 py-3 px-4 flex items-center justify-center">
                <h1 className="text-lg font-black tracking-wide uppercase text-slate-900 leading-tight">Port Ancillary Service (PAS) Form</h1>
              </div>
              <div className="col-span-4 grid grid-rows-2 select-none">
                <div className="border-b border-slate-950 px-2.5 py-1 text-left flex flex-col justify-center">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Control No.:</span>
                  <span className="text-[11px] font-mono font-bold text-slate-800 leading-none">{controlNumber || 'Awaiting Submit...'}</span>
                </div>
                <div className="px-2.5 py-1 text-left flex flex-col justify-center select-none">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Validity:</span>
                  <span className="text-[10px] font-bold text-slate-700">{formData.validity || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Field Matrix Block 1 */}
            <div className="font-sans border-l border-r border-b border-slate-950 grid grid-cols-12 text-left text-[10px] leading-tight select-none">
              
              {/* Field 1: Service Provider */}
              <div className="col-span-5 border-r border-slate-950 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">1. Name of Service Provider:</p>
                <p className="text-[11px] font-extrabold uppercase mt-1 text-slate-800 truncate">{formData.serviceProviderName || ' '}</p>
              </div>
              
              {/* Field 2: Vessel Name */}
              <div className="col-span-3 border-r border-slate-950 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">2. Name of Vessel:</p>
                <p className="text-[11px] font-extrabold uppercase mt-1 text-slate-800 truncate">{formData.vesselName || ' '}</p>
              </div>

              {/* Field 3: Voyage No */}
              <div className="col-span-2 border-r border-slate-950 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">3. Voyage No.:</p>
                <p className="text-[11px] font-bold uppercase mt-1 text-slate-800">{formData.voyageNo || ' '}</p>
              </div>

              {/* Field 4: Voyage Type */}
              <div className="col-span-2 p-2 h-[45px] flex flex-col justify-between">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">4. Voyage Type:</p>
                <div className="flex flex-col gap-0.5 text-[8px] font-bold mt-1 text-slate-700 select-none">
                  <div className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 border border-slate-800 rounded-sm flex items-center justify-center text-[7px] ${formData.voyageType === 'Foreign' ? 'bg-slate-900 text-white' : ''}`}>
                      {formData.voyageType === 'Foreign' ? '✓' : ''}
                    </span>
                    <span>Foreign</span>
                  </div>
                  <div className="flex items-center gap-1 select-none">
                    <span className={`w-2.5 h-2.5 border border-slate-800 rounded-sm flex items-center justify-center text-[7px] ${formData.voyageType === 'Domestic' ? 'bg-slate-900 text-white' : ''}`}>
                      {formData.voyageType === 'Domestic' ? '✓' : ''}
                    </span>
                    <span>Domestic</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Matrix Block 2 */}
            <div className="font-sans border-l border-r border-b border-slate-950 grid grid-cols-12 text-left text-[10px] leading-tight select-none">
              
              {/* Field 5: Business Address */}
              <div className="col-span-6 border-r border-slate-950 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">5. Business Address:</p>
                <p className="text-[9.5px] font-medium uppercase mt-1 text-slate-600 truncate">{formData.serviceBusinessAddress || ' '}</p>
              </div>

              {/* Field 6: Port Terminal */}
              <div className="col-span-3 border-r border-slate-950 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">6. Port Terminal:</p>
                <p className="text-[10px] font-extrabold uppercase mt-1 text-slate-800 truncate">{formData.terminal || ' '}</p>
              </div>

              {/* Field 7: Contact No */}
              <div className="col-span-3 p-2 h-[45px]">
                <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide">7. Contact No.:</p>
                <p className="text-[10px] font-bold uppercase mt-1 text-slate-800">{formData.serviceContactNo || ' '}</p>
              </div>
            </div>

            {/* Field Matrix Block 3 - Main Details */}
            <div className="font-sans border-l border-r border-b border-slate-950 grid grid-cols-12 text-left text-[10px] leading-tight select-none">
              
              {/* Field 8: Type of Service */}
              <div className="col-span-7 border-r border-slate-950 p-3 flex flex-col justify-start">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2.5">8. Type of Service:</p>
                
                <div className="grid grid-cols-2 gap-y-2 text-[8.5px] font-extrabold text-slate-700 leading-none select-none">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Bunkering') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Bunkering') ? '✓' : ''}
                    </span>
                    <span>Bunkering</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Waste Collection') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Waste Collection') ? '✓' : ''}
                    </span>
                    <span>Waste Collection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Tugboat Services') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Tugboat Services') ? '✓' : ''}
                    </span>
                    <span>Tugboat Services</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Water Tendering') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Water Tendering') ? '✓' : ''}
                    </span>
                    <span>Water Tendering</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Cargo Handling Services') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Cargo Handling Services') ? '✓' : ''}
                    </span>
                    <span>Cargo Handling Services</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Chandling') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Chandling') ? '✓' : ''}
                    </span>
                    <span>Chandling</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 mt-0.5">
                    <span className={`w-3 h-3 border border-slate-950 rounded-sm flex items-center justify-center font-bold text-[8px] ${formData.selectedServices?.includes('Vessel Repairs, Hotworks & Maintenance') ? 'bg-slate-950 text-white' : ''}`}>
                      {formData.selectedServices?.includes('Vessel Repairs, Hotworks & Maintenance') ? '✓' : ''}
                    </span>
                    <span>Vessel Repairs, Hotworks & Maintenance</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-2.5">
                  <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">Others, specify:</p>
                  <p className="text-[9.5px] font-bold uppercase text-slate-800 mt-1 border-b border-b-slate-950 border-dotted min-h-[14px]">
                    {formData.otherServiceSpecify || ' '}
                  </p>
                </div>
              </div>

              {/* Field 9: Details of Service */}
              <div className="col-span-5 p-3 flex flex-col text-left">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2.5">9. Details of Service:</p>
                <div className="text-[9px] font-medium text-slate-700 leading-normal uppercase whitespace-pre-wrap flex-grow overflow-hidden max-h-[150px] border border-slate-100 p-1.5 bg-slate-50/50 rounded">
                  {formData.detailsOfService || 'Awaiting services details...'}
                </div>
              </div>
            </div>

            {/* Legal / Penalty statement */}
            <div className="font-sans border-l border-r border-b border-slate-950 py-3.5 px-6 text-center select-none bg-slate-50/20">
              <p className="text-[8.5px] font-bold italic leading-relaxed text-slate-500">
                The undersigned of the aforementioned Port Service Provider submits this application in FAB:<br/>
                "Any false statement or misrepresentation in this application shall be subjected to the penalties imposed under R.A. 9728 or other applicable laws."
              </p>
            </div>

            {/* Workflow Approvals Grid (Prepared, Checked, Approved) */}
            <div className="font-sans border-l border-r border-b border-slate-950 grid grid-cols-3 select-none">
              
              {/* Prepared (Submitter / Representative) */}
              <div className="border-r border-slate-950 p-3 h-[125px] flex flex-col justify-between text-left relative">
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">Prepared by:</span>
                
                {/* Visual signature image */}
                {formData.signatureData ? (
                  <div className="absolute inset-x-4 top-5 bottom-8 flex items-center justify-center opacity-90 select-none">
                    <img 
                      src={formData.signatureData} 
                      alt="Signature Prep" 
                      className="max-h-12 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-x-4 top-5 bottom-8 border border-dashed border-slate-200 bg-slate-50/20 flex items-center justify-center text-[8px] font-bold text-slate-300 uppercase italic">Awaiting Sign-off</div>
                )}
                
                <div className="border-t border-slate-400 pt-1 text-center leading-none">
                  <p className="text-[9px] font-black uppercase text-slate-800 line-clamp-1">{formData.submitterName || 'SERVICE REPRESENTATIVE'}</p>
                  <p className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">Service Provider's Representative</p>
                  <p className="text-[6.5px] text-slate-500 font-extrabold tracking-tight mt-1">
                    Submitted: {formatSystemDateTime(isEditMode && initialData?.submittedAt ? initialData.submittedAt : (isEditMode && initialData?.createdAt ? initialData.createdAt : new Date().toISOString()))}
                  </p>
                </div>
              </div>

              {/* Checked by (Port Checker) */}
              <div className="border-r border-slate-950 p-3 h-[125px] flex flex-col justify-between text-left relative select-none">
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">Checked by:</span>
                
                {initialData?.checkedSignatureData ? (
                  <div className="absolute inset-x-4 top-5 bottom-8 flex items-center justify-center opacity-90">
                    <img 
                      src={initialData.checkedSignatureData} 
                      alt="Signature Checked" 
                      className="max-h-12 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-x-4 top-5 bottom-8 border border-dashed border-slate-200 bg-slate-50/20 flex items-center justify-center text-[8px] font-bold text-slate-300 uppercase italic">Awaiting Verification</div>
                )}

                <div className="border-t border-slate-400 pt-1 text-center leading-none select-none">
                  <p className="text-[9px] font-black uppercase text-slate-800 line-clamp-1">{initialData?.checkedByName || 'AFAB AUTHORIZED OFFICIAL'}</p>
                  <p className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">AFAB Authorized Official</p>
                  <p className="text-[6.5px] text-slate-500 font-extrabold tracking-tight mt-1">
                    Checked: {initialData?.checkedAt ? formatSystemDateTime(initialData.checkedAt) : ' '}
                  </p>
                </div>
              </div>

              {/* Approved by (Chief Port Approver) */}
              <div className="p-3 h-[125px] flex flex-col justify-between text-left relative select-none">
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">Approved by:</span>
                
                {initialData?.approvedSignatureData ? (
                  <div className="absolute inset-x-4 top-5 bottom-8 flex items-center justify-center opacity-90">
                    <img 
                      src={initialData.approvedSignatureData} 
                      alt="Signature Approved" 
                      className="max-h-12 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-x-4 top-5 bottom-8 border border-dashed border-slate-200 bg-slate-50/20 flex items-center justify-center text-[8px] font-bold text-slate-300 uppercase italic">Awaiting Authorization</div>
                )}

                <div className="border-t border-slate-400 pt-1 text-center leading-none">
                  <p className="text-[9px] font-black uppercase text-slate-800 line-clamp-1">{initialData?.approvedByName || 'AFAB AUTHORIZED OFFICIAL'}</p>
                  <p className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">AFAB Authorized Official</p>
                  <p className="text-[6.5px] text-slate-500 font-extrabold tracking-tight mt-1">
                    Approved: {initialData?.approvedAt ? formatSystemDateTime(initialData.approvedAt) : ' '}
                  </p>
                </div>
              </div>

            </div>

            {/* Template Version details */}
            <div className="flex justify-between items-center font-sans mt-2 text-[7px] text-slate-400 font-semibold select-none">
              <span>PORT SERVICES DIVISION</span>
              <span className="text-right uppercase">PSD-FM-000<br/>Rev.00 Date Effective ___________</span>
            </div>

            {/* Print watermark/guide */}
            <div className="absolute bottom-10 right-10 block print:hidden opacity-5 select-none leading-none text-slate-800 font-sans uppercase font-black text-[32px] tracking-widest pointer-events-none text-right">
              PORT ANCILLARY<br/>SERVICE RECORD
            </div>

          </div>
        </div>
        </div>

      </div>

    </div>
  );
};
