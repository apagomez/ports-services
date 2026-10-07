import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2, ArrowLeft, Download, Plus, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { VesselApplication, CargoRow } from '../types';
import { formatSystemDate, formatSystemTime } from '../utils/dateFormatter';
import { oklchToRgb } from '../utils/colorConverter';
import { normalizeTerminal, FAB_PORT_TERMINALS } from '../utils/terminalNormalizer';
import fabLogo from '../assets/images/fab-logo.png';

interface GatePassFormProps {
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

export const GatePassForm: React.FC<GatePassFormProps> = ({
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

  // Initialize control number
  const [controlNumber, setControlNumber] = useState<string>(initialData?.id || '');

  // Form Fields
  const [formData, setFormData] = useState<Partial<VesselApplication>>({
    applicationType: 'PGP',
    company: initialData?.company || '',
    terminal: initialData?.terminal || '',
    companyAddress: initialData?.companyAddress || '',
    vesselName: initialData?.vesselName || '',
    voyageNo: initialData?.voyageNo || '',
    nameOfRepresentative: initialData?.nameOfRepresentative || '',
    contactNumber: initialData?.contactNumber || '',
    dateOfOperationFrom: initialData?.dateOfOperationFrom || '',
    dateOfOperationTo: initialData?.dateOfOperationTo || '',
    operationLoading: initialData?.operationLoading ?? false,
    operationUnloading: initialData?.operationUnloading ?? false,
    cargoDeclaredBL: initialData?.cargoDeclaredBL ?? true,
    articlesNotSubjectImport: initialData?.articlesNotSubjectImport ?? false,
    typeOfTransport: initialData?.typeOfTransport || 'Land',
    typeOfCargoByOrigin: initialData?.typeOfCargoByOrigin || 'Import',
    classificationOfCargo: initialData?.classificationOfCargo || 'Bulk Cargo',
    classificationSpecify: initialData?.classificationSpecify || '',
    cargoTableData: initialData?.cargoTableData || [
      { blNo: '', description: '', quantity: 0, unit: '', weightVolume: 0, total: 0 }
    ],
    submitterName: initialData?.submitterName || initialData?.nameOfRepresentative || '',
    signatureType: initialData?.signatureType || 'draw',
    signatureData: initialData?.signatureData || '',
    // Checker/Approver signatures
    checkedByName: initialData?.checkedByName || '',
    checkedSignatureData: initialData?.checkedSignatureData || '',
    checkedAt: initialData?.checkedAt || '',
    approvedByName: initialData?.approvedByName || '',
    approvedSignatureData: initialData?.approvedSignatureData || '',
    approvedAt: initialData?.approvedAt || '',
    status: initialData?.status || 'Pending Check',
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
      let maxSeq = 292; // Start with the known highest control number as baseline

      // 1. Process current applications/options list if available
      const used = options?.usedControlNumbers || [];
      used.forEach(num => {
        const cleanNum = String(num).trim();
        const match = cleanNum.match(/PGP-(?:26-)?(\d+)/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSeq) {
            maxSeq = val;
          }
        }
      });

      // 2. Fetch the live Google Sheet to ensure we have the absolute latest records from other sessions
      try {
        const { getProcessMonitoringSpreadsheetId } = await import('../services/googleSheetsService');
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${getProcessMonitoringSpreadsheetId()}/export?format=csv&gid=1459766226&t=${Date.now()}`;
        const res = await fetch(sheetUrl, { cache: "no-store" });
        let csvText = "";

        if (res.redirected && res.url.includes("ServiceLogin")) {
          console.warn("Google Sheets redirected to login. Using fallback for PGP.");
        } else if (!res.ok) {
          console.warn("Google Sheets fetch failed for PGP.");
        } else {
          csvText = await res.text();
        }

        if (csvText && isMounted) {
          Papa.parse(csvText, {
            header: false,
            complete: (result) => {
              const rows = result.data as string[][];
              rows.forEach(row => {
                if (row) {
                  row.forEach(cell => {
                    const ctrl = String(cell).trim().toUpperCase();
                    if (ctrl.includes("PGP-")) {
                      const match = ctrl.match(/PGP-(?:26-)?(\d+)/i);
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
              const candidate = `PGP-${yearPrefix}-${paddedSeq}`;
              if (isMounted && controlNumber !== candidate) {
                setControlNumber(candidate);
              }
            }
          });
        } else {
          // If no csvText fetched, fallback to the maxSeq from local option list immediately
          const nextSeq = maxSeq + 1;
          const paddedSeq = String(nextSeq).padStart(3, '0');
          const candidate = `PGP-${yearPrefix}-${paddedSeq}`;
          if (isMounted && controlNumber !== candidate) {
            setControlNumber(candidate);
          }
        }
      } catch (err) {
        console.warn("Error fetching live sheet for PGP control number sequence:", err);
        const nextSeq = maxSeq + 1;
        const paddedSeq = String(nextSeq).padStart(3, '0');
        const candidate = `PGP-${yearPrefix}-${paddedSeq}`;
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

  // Handle Cargo Row changes
  const handleCargoRowChange = (index: number, field: keyof CargoRow, value: any) => {
    const updatedRows = [...(formData.cargoTableData || [])];
    if (field === 'quantity' || field === 'weightVolume') {
      const numVal = parseFloat(value) || 0;
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: numVal,
      };
      // Auto-calculate total: Quantity * Weight per unit
      updatedRows[index].total = Number((updatedRows[index].quantity * updatedRows[index].weightVolume).toFixed(3));
    } else {
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: value,
      };
    }

    setFormData(prev => ({
      ...prev,
      cargoTableData: updatedRows
    }));
  };

  const addCargoRow = () => {
    const current = formData.cargoTableData || [];
    setFormData(prev => ({
      ...prev,
      cargoTableData: [
        ...current,
        { blNo: '', description: '', quantity: 0, unit: '', weightVolume: 0, total: 0 }
      ]
    }));
  };

  const removeCargoRow = (index: number) => {
    const current = formData.cargoTableData || [];
    if (current.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      cargoTableData: current.filter((_, i) => i !== index)
    }));
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
    
    ctx.strokeStyle = '#0f172a'; // slate-900
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
    if (!formData.company) return alert('Company Name is required.');
    if (!formData.terminal) return alert('Port Terminal is required.');
    if (!formData.vesselName) return alert('Vessel Name is required.');
    if (!formData.nameOfRepresentative) return alert('Name of Representative is required.');
    if (!formData.signatureData) return alert('Representative Signature is required to submit.');

    setIsSubmitting(true);
    try {
      if (onSubmitApp) {
        await onSubmitApp({
          ...formData,
          id: controlNumber,
          submitterName: formData.nameOfRepresentative
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

  // Sharp Document Export using html2canvas
  const handleExportPNG = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPDF(true);
    
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
            let replacement = 'rgb(148, 163, 184)'; // fallback slate-400
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

      document.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
          styleRollback.push({ element: styleEl, text: styleEl.textContent });
          styleEl.textContent = oklchToRgb(styleEl.textContent);
        }
      });

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
                console.warn('Could not preprocess stylesheet link:', href, err);
              });
            linkPromises.push(promise);
          }
        }
      });

      if (linkPromises.length > 0) {
        await Promise.all(linkPromises);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(printAreaRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      const fileData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${controlNumber || 'Port-Gate-Pass'}-Form.png`;
      link.href = fileData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failure:", e);
      alert("Failed to export Gate Pass file. Please try again.");
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
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
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Gate Pass Submitted!</h2>
        <p className="text-slate-600 mt-3 text-sm leading-relaxed font-medium">
          Your Port Gate Pass (PGP) application has been securely submitted under registration reference:
        </p>
        <div className="bg-slate-100 border border-slate-200 font-mono text-base font-bold text-slate-800 py-2.5 px-4 rounded-lg inline-block my-4 select-all">
          {controlNumber}
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          The application has been routed directly to the Port Services Division Checker queue for validations. Once checked, it will advance to the Chief Port Approver stage.
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
      <div className="xl:col-span-5 space-y-6 print:hidden text-left">
        
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
            <div className="bg-orange-100 p-2.5 rounded-lg text-orange-700">
              <span className="text-xl">🚛</span>
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 leading-tight text-base uppercase">PGP Application Portal</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Request or file a Port Gate Pass Form under Bataan Authority guidelines (Form PSD-FM-019).</p>
            </div>
          </div>
        </div>

        {isEditMode && (authRole === 'admin' || authRole === 'checker' || authRole === 'approver') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mb-2">Stage Control & Actions</h3>
            <p className="text-slate-600 text-xs leading-relaxed font-semibold">
              This application is in review/edit mode. You can edit any field in the form below and click "Save Changes" to update.
            </p>

            {/* Show Edit PGP Control Number input for checkers, approvers, and admins */}
            <div className="bg-amber-50/70 p-4 rounded-lg border border-amber-200/50 space-y-2 mt-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
                Edit PGP Control Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value.toUpperCase())}
                  placeholder="PGP-26-XXX"
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
                      alert("PGP Control Number successfully updated!");
                    } catch (err: any) {
                      console.error("Failed to update PGP Control Number:", err);
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
                1. Port & Vessel Profiles
              </h3>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                1. Name of Company <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value.toUpperCase() }))}
                placeholder="e.g. SEAFRONT MARINE SERVICES INC."
              />
            </div>

            {/* Port Terminal Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                2. Port Terminal <span className="text-red-500">*</span>
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

            {/* Company Address */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                3. Company Address <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                value={formData.companyAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, companyAddress: e.target.value.toUpperCase() }))}
                placeholder="e.g. BASECO COMPOUND, MARIVELES, BATAAN"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vessel Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  4. Name of Vessel <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                  value={formData.vesselName}
                  onChange={(e) => setFormData(prev => ({ ...prev, vesselName: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MV BATAAN CARRIER"
                />
              </div>

              {/* Voyage No */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  5. Voyage # <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all uppercase"
                  value={formData.voyageNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, voyageNo: e.target.value.toUpperCase() }))}
                  placeholder="e.g. V-026"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Representative Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  6. Representative Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-fab-blue/25 transition-all"
                  value={formData.nameOfRepresentative}
                  onChange={(e) => setFormData(prev => ({ ...prev, nameOfRepresentative: e.target.value.toUpperCase() }))}
                  placeholder="e.g. CRISTIANO SANTOS"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  7. Contact Number <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="e.g. +639198765432"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                2. Operation & Classification Profiles
              </h3>
            </div>

            {/* Operation Date/Time Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  8a. Operation From <span className="text-red-500">*</span>
                </label>
                <input 
                  type="datetime-local" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all"
                  value={formData.dateOfOperationFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfOperationFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                  8b. Operation To <span className="text-red-500">*</span>
                </label>
                <input 
                  type="datetime-local" 
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fab-blue/25 focus:border-fab-blue transition-all"
                  value={formData.dateOfOperationTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfOperationTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Operation (Loading / Unloading) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                9. Operation Mode <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.operationLoading}
                    onChange={(e) => setFormData(prev => ({ ...prev, operationLoading: e.target.checked }))}
                    className="accent-fab-blue w-4 h-4"
                  />
                  <span>LOADING</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.operationUnloading}
                    onChange={(e) => setFormData(prev => ({ ...prev, operationUnloading: e.target.checked }))}
                    className="accent-fab-blue w-4 h-4"
                  />
                  <span>UNLOADING</span>
                </label>
              </div>
            </div>

            {/* Declarations */}
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.cargoDeclaredBL}
                  onChange={(e) => setFormData(prev => ({ ...prev, cargoDeclaredBL: e.target.checked }))}
                  className="accent-fab-blue rounded mt-0.5"
                />
                <span>Cargoes declared in Bill of Lading</span>
              </label>
              <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.articlesNotSubjectImport}
                  onChange={(e) => setFormData(prev => ({ ...prev, articlesNotSubjectImport: e.target.checked }))}
                  className="accent-fab-blue rounded mt-0.5"
                />
                <span>Articles not subject to import/export or local sale</span>
              </label>
            </div>

            {/* Type of Transport */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Type of Transport <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                {['Land', 'Sea', 'Air'].map((trans) => (
                  <label key={trans} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="typeOfTransport"
                      value={trans}
                      checked={formData.typeOfTransport === trans}
                      onChange={() => setFormData(prev => ({ ...prev, typeOfTransport: trans as any }))}
                      className="accent-fab-blue w-4 h-4"
                    />
                    <span>{trans.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type of Cargo by Origin */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Type of Cargo by Origin <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                {['Import', 'Export', 'Coastwise'].map((orig) => (
                  <label key={orig} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="typeOfCargoByOrigin"
                      value={orig}
                      checked={formData.typeOfCargoByOrigin === orig}
                      onChange={() => setFormData(prev => ({ ...prev, typeOfCargoByOrigin: orig as any }))}
                      className="accent-fab-blue w-4 h-4"
                    />
                    <span>{orig.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Classification of Cargo */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                Classification of Cargo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {['Bulk Cargo', 'General Cargo', 'Containerized Cargo', 'Others'].map((classif) => (
                  <label key={classif} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="classificationOfCargo"
                      value={classif}
                      checked={formData.classificationOfCargo === classif}
                      onChange={() => setFormData(prev => ({ ...prev, classificationOfCargo: classif as any }))}
                      className="accent-fab-blue w-4 h-4"
                    />
                    <span>{classif.toUpperCase()}</span>
                  </label>
                ))}
              </div>
              {formData.classificationOfCargo === 'Others' && (
                <input 
                  type="text"
                  required
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-800 uppercase"
                  placeholder="Specify other classification"
                  value={formData.classificationSpecify}
                  onChange={(e) => setFormData(prev => ({ ...prev, classificationSpecify: e.target.value.toUpperCase() }))}
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  3. Cargo Details Table
                </h3>
                <button
                  type="button"
                  onClick={addCargoRow}
                  className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded hover:bg-slate-200 transition-all uppercase"
                >
                  <Plus className="w-3.5 h-3.5" /> Row
                </button>
              </div>
            </div>

            {/* Cargo Rows */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {(formData.cargoTableData || []).map((row, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg relative space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Item #{idx + 1}</span>
                    {(formData.cargoTableData || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCargoRow(idx)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">B/L No.</label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 uppercase"
                        value={row.blNo}
                        onChange={(e) => handleCargoRowChange(idx, 'blNo', e.target.value.toUpperCase())}
                        placeholder="e.g. BL-261"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">Description</label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 uppercase"
                        value={row.description}
                        onChange={(e) => handleCargoRowChange(idx, 'description', e.target.value.toUpperCase())}
                        placeholder="e.g. STEEL BARS"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">Quantity</label>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
                        value={row.quantity || ''}
                        onChange={(e) => handleCargoRowChange(idx, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">Unit (e.g. PCS, BNDL)</label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 uppercase"
                        value={row.unit}
                        onChange={(e) => handleCargoRowChange(idx, 'unit', e.target.value.toUpperCase())}
                        placeholder="PCS"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">Wt (MT) / Vol (CBM) per Unit</label>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
                        value={row.weightVolume || ''}
                        onChange={(e) => handleCargoRowChange(idx, 'weightVolume', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 mb-0.5">Total Weight/Vol</label>
                      <div className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800">
                        {row.total.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                4. Sign-Off Authorization
              </h3>
            </div>

            {/* Signature Pad Mode Toggle */}
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
                          alt="Representative signature"
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
                        id="signature-file-uploader-pgp"
                        className="hidden"
                      />
                      <label
                        htmlFor="signature-file-uploader-pgp"
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

            {/* Submit Action */}
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
                {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Transmit PGP Form'}
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

      {/* RIGHT PREVIEW SPACE - MATCHING THE PHYSICAL BATAAN PGP FORM */}
      <div className="xl:col-span-7 flex flex-col items-center justify-start min-h-0 print:block">
        
        {/* Helper preview bar */}
        <div className="w-full flex items-center justify-between mb-3 bg-slate-100/80 border border-slate-200 rounded-lg p-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wide">High-Fidelity Document Preview (PSD-FM-019)</span>
          </div>
          <button
            onClick={handleExportPNG}
            disabled={isGeneratingPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            {isGeneratingPDF ? 'Exporting...' : 'Export PNG Form'}
          </button>
        </div>

        {/* The Outer Scale Area */}
        <div 
          ref={previewParentRef} 
          className="w-full border border-slate-200 rounded-xl overflow-hidden shadow-md bg-slate-500 p-4 sm:p-6 flex justify-center items-start print:border-none print:p-0 print:bg-white print:shadow-none"
        >
          {/* Printable page structure styled to match physical paper exactly */}
          <div 
            ref={printAreaRef}
            style={{ 
              transform: `scale(${scaleFactor})`,
              transformOrigin: 'top center',
              width: '794px', // A4 Width at 96 DPI
              minHeight: '1123px', // A4 Height at 96 DPI
              marginBottom: `calc((1123px * (${scaleFactor} - 1)) + 24px)`
            }}
            className="bg-white text-slate-900 border border-black/10 p-10 font-sans shadow-lg relative flex flex-col justify-between print:transform-none print:shadow-none print:border-none print:m-0 print:p-8"
          >
            
            {/* Upper content of form */}
            <div>
              {/* Header Box */}
              <div className="flex items-center justify-between border-b border-black pb-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={fabLogo} 
                    alt="FAB Logo" 
                    className="w-20 h-20 object-contain block"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left">
                    <p className="text-[10px] leading-tight font-medium text-slate-600">REPUBLIC OF THE PHILIPPINES</p>
                    <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">Authority of the Freeport Area of Bataan</h1>
                    <p className="text-[10px] font-semibold text-slate-500">Freeport Area of Bataan, Mariveles, Philippines</p>
                    <p className="text-xs font-black text-fab-blue mt-1 uppercase tracking-wide">Port Services Division</p>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-end h-20 pb-1">
                  <div className="text-xs font-bold text-slate-800">
                    <span className="text-slate-400 font-medium">CONTROL NO:</span> <span className="font-mono text-black text-sm underline underline-offset-2 decoration-1">{controlNumber || 'PGP-26-PENDING'}</span>
                  </div>
                </div>
              </div>

              {/* Form Title banner */}
              <div className="bg-slate-100 border border-black/25 my-4 py-2.5 px-4 text-center">
                <h2 className="text-lg font-black tracking-widest text-black uppercase">PORT GATE PASS FORM</h2>
              </div>

              {/* Primary Grid Layout matching PDF */}
              <div className="border border-black text-left text-xs">
                
                {/* Row 1 */}
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-2 border-r border-black flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">1. Company</span>
                    <span className="font-bold text-[13px] text-black uppercase py-1">{formData.company || '—'}</span>
                  </div>
                  <div className="p-2 flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">2. Port Terminal</span>
                    <span className="font-bold text-[13px] text-black uppercase py-1">{formData.terminal || '—'}</span>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-4 border-b border-black">
                  <div className="col-span-2 p-2 border-r border-black flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">3. Company Address</span>
                    <span className="font-bold text-[11px] text-black uppercase py-1">{formData.companyAddress || '—'}</span>
                  </div>
                  <div className="p-2 border-r border-black flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">4. Vessel Name</span>
                    <span className="font-bold text-[12px] text-black uppercase py-1">{formData.vesselName || '—'}</span>
                  </div>
                  <div className="p-2 flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">5. Voyage #</span>
                    <span className="font-bold text-[12px] text-black uppercase py-1">{formData.voyageNo || '—'}</span>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-2 border-r border-black flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">6. Name of Representative</span>
                    <span className="font-bold text-[12px] text-black uppercase py-1">{formData.nameOfRepresentative || '—'}</span>
                  </div>
                  <div className="p-2 flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">7. Contact Number</span>
                    <span className="font-mono font-bold text-[12px] text-black py-1">{formData.contactNumber || '—'}</span>
                  </div>
                </div>

                {/* Row 4 */}
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-2 border-r border-black flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">8. Date and Time of Operation</span>
                    <div className="py-1 flex flex-col text-[11px]">
                      <div><span className="font-medium text-slate-400">FROM:</span> <span className="font-bold text-black">{formData.dateOfOperationFrom ? formatSystemDate(formData.dateOfOperationFrom) + ' at ' + formatSystemTime(formData.dateOfOperationFrom) : '—'}</span></div>
                      <div><span className="font-medium text-slate-400">TO:</span> <span className="font-bold text-black">{formData.dateOfOperationTo ? formatSystemDate(formData.dateOfOperationTo) + ' at ' + formatSystemTime(formData.dateOfOperationTo) : '—'}</span></div>
                    </div>
                  </div>
                  <div className="p-2 flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">9. Operation Mode</span>
                    <div className="py-1 flex gap-6 text-[11px] font-bold text-black">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block border border-black w-4 h-4 text-center leading-3 font-bold bg-white">
                          {formData.operationLoading ? '✓' : ''}
                        </span>
                        <span>LOADING</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block border border-black w-4 h-4 text-center leading-3 font-bold bg-white">
                          {formData.operationUnloading ? '✓' : ''}
                        </span>
                        <span>UNLOADING</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 5: Declarations */}
                <div className="grid grid-cols-2 border-b border-black bg-slate-50/40">
                  <div className="p-2 border-r border-black flex items-center gap-2">
                    <span className="inline-block border border-black w-4 h-4 text-center leading-3 font-bold bg-white flex-shrink-0">
                      {formData.cargoDeclaredBL ? '✓' : ''}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-800">Cargoes declared in Bill of Lading</span>
                  </div>
                  <div className="p-2 flex items-center gap-2">
                    <span className="inline-block border border-black w-4 h-4 text-center leading-3 font-bold bg-white flex-shrink-0">
                      {formData.articlesNotSubjectImport ? '✓' : ''}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-800">Articles not subject to import/export or local sale</span>
                  </div>
                </div>

                {/* Row 6: Classification Headers split */}
                <div className="grid grid-cols-3 border-b border-black text-center font-bold text-[9px] bg-slate-100 uppercase tracking-widest text-slate-700">
                  <div className="py-1 border-r border-black">Type of Transport</div>
                  <div className="py-1 border-r border-black">Type of Cargo by Origin</div>
                  <div className="py-1">Classification of Cargo</div>
                </div>

                {/* Row 7: Classification Values */}
                <div className="grid grid-cols-3 text-left text-[11px] font-bold text-black border-b border-black">
                  {/* Transport */}
                  <div className="p-2 border-r border-black space-y-1">
                    {['Land', 'Sea', 'Air'].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <span className="inline-block border border-black w-3.5 h-3.5 text-center leading-3 text-[9px] font-bold bg-white flex-shrink-0">
                          {formData.typeOfTransport === t ? '✓' : ''}
                        </span>
                        <span className="text-[10px]">{t.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Origin */}
                  <div className="p-2 border-r border-black space-y-1">
                    {['Import', 'Export', 'Coastwise'].map((o) => (
                      <div key={o} className="flex items-center gap-1.5">
                        <span className="inline-block border border-black w-3.5 h-3.5 text-center leading-3 text-[9px] font-bold bg-white flex-shrink-0">
                          {formData.typeOfCargoByOrigin === o ? '✓' : ''}
                        </span>
                        <span className="text-[10px]">{o.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Classification */}
                  <div className="p-2 space-y-1">
                    {['Bulk Cargo', 'General Cargo', 'Containerized Cargo', 'Others'].map((c) => (
                      <div key={c} className="flex items-center gap-1.5">
                        <span className="inline-block border border-black w-3.5 h-3.5 text-center leading-3 text-[9px] font-bold bg-white flex-shrink-0">
                          {formData.classificationOfCargo === c ? '✓' : ''}
                        </span>
                        <span className="text-[10px]">
                          {c === 'Others' && formData.classificationSpecify 
                            ? `OTHERS: ${formData.classificationSpecify}` 
                            : c.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cargo Table Title */}
              <div className="text-left mt-4 mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                  Detailed Cargo Statement
                </span>
                <span className="text-[9px] text-slate-400 font-semibold">* Please use additional sheet if necessary</span>
              </div>

              {/* Cargo Table */}
              <div className="border border-black text-left text-xs font-sans overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black text-[9px] font-black text-slate-800 tracking-wider text-center uppercase">
                      <th className="py-2 px-2 border-r border-black w-24">BL No.</th>
                      <th className="py-2 px-2 border-r border-black">Cargo Description</th>
                      <th className="py-2 px-2 border-r border-black w-20 text-right">Quantity</th>
                      <th className="py-2 px-2 border-r border-black w-14 text-center">Unit</th>
                      <th className="py-2 px-2 border-r border-black w-32 text-right">Wt/Vol per Unit</th>
                      <th className="py-2 px-2 w-28 text-right">Total (MT/CBM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.cargoTableData || []).map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 border-black/40 text-[11px]">
                        <td className="py-1.5 px-2 border-r border-black/40 font-mono font-semibold text-black truncate max-w-[96px]">{row.blNo || '—'}</td>
                        <td className="py-1.5 px-2 border-r border-black/40 font-bold text-black uppercase truncate max-w-[200px]">{row.description || '—'}</td>
                        <td className="py-1.5 px-2 border-r border-black/40 text-right font-medium text-black">{row.quantity || '0'}</td>
                        <td className="py-1.5 px-2 border-r border-black/40 text-center font-bold text-slate-700 uppercase">{row.unit || '—'}</td>
                        <td className="py-1.5 px-2 border-r border-black/40 text-right font-medium text-black">{row.weightVolume ? row.weightVolume.toFixed(2) : '0.00'}</td>
                        <td className="py-1.5 px-2 text-right font-black text-black">{row.total ? row.total.toFixed(3) : '0.000'}</td>
                      </tr>
                    ))}
                    {/* Pad empty rows if necessary to maintain consistent visual format */}
                    {Array.from({ length: Math.max(0, 4 - (formData.cargoTableData || []).length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b last:border-0 border-black/40 h-7">
                        <td className="py-1 px-2 border-r border-black/40">&nbsp;</td>
                        <td className="py-1 px-2 border-r border-black/40">&nbsp;</td>
                        <td className="py-1 px-2 border-r border-black/40">&nbsp;</td>
                        <td className="py-1 px-2 border-r border-black/40">&nbsp;</td>
                        <td className="py-1 px-2 border-r border-black/40">&nbsp;</td>
                        <td className="py-1 px-2">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sign-off Blocks */}
              <div className="grid grid-cols-2 border border-black text-left mt-5 text-xs">
                
                {/* PREPARED BY */}
                <div className="border-r border-black flex flex-col justify-between min-h-[140px]">
                  <div className="p-2 bg-slate-50 border-b border-black font-black text-[9px] uppercase tracking-wider text-slate-600">
                    Prepared By:
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-3">
                    {formData.signatureData ? (
                      <img 
                        src={formData.signatureData} 
                        alt="Rep Sign" 
                        className="max-h-16 object-contain block mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide border border-dashed border-slate-300 py-3 px-6 rounded">
                        REPRESENTATIVE SIGNATURE
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-black text-center">
                    <p className="font-extrabold text-black uppercase underline decoration-1 text-[11px]">
                      {formData.nameOfRepresentative || '—'}
                    </p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mt-0.5">
                      Port User / Representative Signature
                    </p>
                  </div>
                </div>

                {/* CHECKED BY */}
                <div className="flex flex-col justify-between min-h-[140px]">
                  <div className="p-2 bg-slate-50 border-b border-black font-black text-[9px] uppercase tracking-wider text-slate-600">
                    Checked By:
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-3">
                    {formData.checkedSignatureData ? (
                      <img 
                        src={formData.checkedSignatureData} 
                        alt="Checker Sign" 
                        className="max-h-16 object-contain block mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wide py-3">
                        {formData.status === 'Approved' || formData.status === 'Pending Approval' ? '✓ VERIFIED ELECTRONICALLY' : 'PENDING PORT CHECKER'}
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-black text-center">
                    <p className="font-extrabold text-black uppercase underline decoration-1 text-[11px]">
                      {formData.checkedByName || (formData.status === 'Approved' || formData.status === 'Pending Approval' ? 'PORT checker official' : '—')}
                    </p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mt-0.5">
                      AFAB Authorized Official & Date
                    </p>
                  </div>
                </div>
              </div>

              {/* APPROVED BY BAR */}
              <div className="border-l border-r border-b border-black text-left text-xs grid grid-cols-1">
                <div className="flex flex-col justify-between min-h-[120px]">
                  <div className="p-2 bg-slate-50 border-b border-black font-black text-[9px] uppercase tracking-wider text-slate-600">
                    Approved By:
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-2">
                    {formData.approvedSignatureData ? (
                      <img 
                        src={formData.approvedSignatureData} 
                        alt="Approver Sign" 
                        className="max-h-14 object-contain block mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wide py-2">
                        {formData.status === 'Approved' ? '✓ SIGNED ELECTRONICALLY' : 'PENDING PORT DIVISION CHIEF'}
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-black text-center">
                    <p className="font-extrabold text-black uppercase underline decoration-1 text-[11px]">
                      {formData.approvedByName || (formData.status === 'Approved' ? 'PORT SERVICES DIVISION CHIEF' : '—')}
                    </p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mt-0.5">
                      AFAB Authorized Approving Chief
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* LOWER Privacy Notice & Reference Codes (Footer) */}
            <div className="mt-8 border-t border-slate-300 pt-3 text-left">
              <div className="text-[8px] text-slate-500 leading-normal space-y-1 font-medium">
                <p>
                  <strong className="text-slate-700">Privacy Notice:</strong> The Authority of the Freeport Area of Bataan (AFAB) ensures that the data gathered in this form are held under strict confidentiality in accordance with the R.A.10173 otherwise known as the Data Privacy Act of 2012.
                </p>
                <p>
                  <strong className="text-slate-700">Note:</strong> Issuance of this form is based on the statements and representation contained in this application. Any false statement or misrepresentation in this application shall be subjected to the penalties imposed under R.A. 9728 or other applicable laws.
                </p>
              </div>
              <div className="flex justify-between items-end mt-4 pt-1.5 border-t border-slate-100 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                <span>PORT SERVICES DIVISION</span>
                <span className="text-right">PSD-FM-019 / Rev.00 / Effective: 20 March 2025</span>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};
