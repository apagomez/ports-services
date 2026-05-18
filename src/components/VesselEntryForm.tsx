import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2, ArrowLeft, Download } from 'lucide-react';
import Papa from 'papaparse';
import { VesselData, VesselApplication } from '../types';
import fabLogo from '../assets/images/fab-logo.png';

interface VesselEntryFormProps {
  onBack: () => void;
  onSubmitApp?: (app: Omit<VesselApplication, 'id' | 'createdAt' | 'status'>) => void;
  initialData?: Partial<VesselApplication>;
  isEditMode?: boolean;
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

export const VesselEntryForm: React.FC<VesselEntryFormProps> = ({ onBack, onSubmitApp, options, initialData, isEditMode }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [controlNumber, setControlNumber] = useState<string>(initialData?.id || '');
  const [isLoadingControlNum, setIsLoadingControlNum] = useState(false);

  const [formData, setFormData] = useState<Partial<VesselApplication>>({
    vesselName: initialData?.vesselName || '',
    agent: initialData?.agent || '',
    voyageType: initialData?.voyageType || '',
    vesselType: initialData?.vesselType || '',
    voyageNo: initialData?.voyageNo || '',
    shippingLine: initialData?.shippingLine || '',
    masterName: initialData?.masterName || '',
    registry: initialData?.registry || '',
    grossTonnage: initialData?.grossTonnage || '',
    loa: initialData?.loa || '',
    terminal: initialData?.terminal || '',
    cargoDescription: initialData?.cargoDescription || '',
    arrivalDate: initialData?.arrivalDate || new Date().toISOString().split('T')[0],
    departureDate: initialData?.departureDate || '',
    purpose: initialData?.purpose || '',
    origin: initialData?.origin || '',
    nextPort: initialData?.nextPort || '',
    vesselOperations: initialData?.vesselOperations || '',
  });

  const fullControlNumber = React.useMemo(() => {
    if (isEditMode) return controlNumber;
    if (!controlNumber || controlNumber.startsWith('N/A') || controlNumber === 'ERROR') return controlNumber;
    
    const baseMatch = controlNumber.match(/^(PSD-\d{2}-\d{3})/);
    const base = baseMatch ? baseMatch[1] : controlNumber;
    
    const voyageType = (formData.voyageType || '').toUpperCase();
    const isPassenger = (formData.vesselType || '').toUpperCase() === 'PASSENGER';

    if (voyageType === 'FOREIGN') return `${base}-F`;
    if (voyageType === 'DOMESTIC') {
      return isPassenger ? `${base}-P` : `${base}-D`;
    }
    return base;
  }, [controlNumber, formData.voyageType, formData.vesselType, isEditMode]);

  useEffect(() => {
    if (!initialData?.id) {
      setIsLoadingControlNum(true);
      fetch('https://docs.google.com/spreadsheets/d/1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA/export?format=csv&gid=960645385')
        .then(res => res.text())
        .then(csv => {
          Papa.parse(csv, {
            header: false,
            complete: (result) => {
              const rows = result.data as string[][];
              let found = false;
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // Form Control No is col 0, Name of Vessel is col 5
                if (row && row[0] && row[0].startsWith('PSD-') && (!row[5] || row[5].trim() === '')) {
                  const baseMatch = row[0].trim().match(/^(PSD-\d{2}-\d{3})/);
                  const parsedControlNo = baseMatch ? baseMatch[1] : row[0].trim();
                  
                  if (options?.usedControlNumbers?.includes(parsedControlNo)) {
                    continue; // Skip this one, it's used in a pending application
                  }
                  
                  setControlNumber(parsedControlNo);
                  found = true;
                  break;
                }
              }
              if (!found) {
                setControlNumber('N/A (No available numbers)');
              }
            }
          });
        })
        .catch(err => {
          console.error('Error fetching sheet', err);
          setControlNumber('ERROR');
        })
        .finally(() => {
          setIsLoadingControlNum(false);
        });
    }
  }, [initialData?.id]);

  const handleGeneratePDF = async () => {
    const element = document.getElementById('printable-permit');
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print this permit.');
        return;
      }
      
      let styles = '';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
         styles += node.outerHTML;
      });

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Vessel Entry Permit</title>
            ${styles}
            <style>
              body { background: white !important; font-family: sans-serif; }
              @media print {
                .print\\:hidden { display: none !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body class="bg-white m-4">
            ${element.outerHTML}
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error('Error opening print window', error);
      alert('Failed to open print window.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numericValue = value.replace(/[^\d.]/g, '');
    const parts = numericValue.split('.');
    if (parts.length > 2) numericValue = parts[0] + '.' + parts.slice(1).join('');
    const finalParts = numericValue.split('.');
    if (finalParts[0]) {
      finalParts[0] = finalParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    const formattedValue = finalParts.join('.');
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API request/Spreadsheet update
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      if (onSubmitApp) {
        onSubmitApp({ ...formData, id: fullControlNumber } as any);
      }
      
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          vesselName: '',
          agent: '',
          voyageType: '',
          vesselType: '',
          voyageNo: '',
          shippingLine: '',
          masterName: '',
          registry: '',
          grossTonnage: '',
          loa: '',
          terminal: '',
          cargoDescription: '',
          arrivalDate: new Date().toISOString().split('T')[0],
          departureDate: '',
          purpose: '',
          origin: '',
          nextPort: '',
          vesselOperations: '',
        });
        onBack();
      }, 3000);
    }, 1000);
  };

  return (
    <div id="printable-permit" className="max-w-4xl mx-auto font-sans text-sm pb-12 print:pb-0 print:m-0 print:w-full print:max-w-none print:absolute print:top-0 print:left-0 bg-white">
      {!isEditMode && (
        <div className="mb-6 print:hidden">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-fab-blue transition-colors font-bold uppercase text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      )}

      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">Form successfully submitted!</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border-2 border-slate-800 p-4 sm:p-8 shadow-sm">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 border-b-2 border-slate-800 pb-4 gap-4">
          <div className="flex gap-4 items-center">
            <img src={fabLogo} alt="FAB Logo" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
            <div>
              <h1 className="font-bold whitespace-nowrap text-xs sm:text-base">REPUBLIC OF THE PHILIPPINES</h1>
              <h2 className="font-bold whitespace-nowrap text-[10px] sm:text-[13px]">AUTHORITY OF THE FREEPORT AREA OF BATAAN</h2>
              <p className="text-[9px] sm:text-[11px]">Freeport Area of Bataan, Mariveles Bataan</p>
              <h3 className="font-black text-sm sm:text-lg mt-2 tracking-wide uppercase">PORT SERVICES DIVISION</h3>
              <h4 className="font-bold text-base sm:text-xl mt-1 border-b-[3px] inline-block border-slate-800 pb-0.5">Vessel Entry Permit (VEP)</h4>
            </div>
          </div>
          
          <div className="w-full sm:w-64 sm:-mt-2 flex flex-col justify-between">
             <p className="text-[9px] italic leading-tight text-gray-700">
               Privacy Notice:<br/>
               "The Authority of the Freeport Area of Bataan (AFAB) ensures that the data gathered in this form are held under strict confidentiality in accordance with the R.A.10173 otherwise known as the Data Privacy Act of 2012."
             </p>
             <div className="mt-8 sm:mt-auto space-y-2 pt-4">
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold whitespace-nowrap text-black uppercase tracking-wider">Control No:</span>
                 {isLoadingControlNum ? (
                   <span className="animate-pulse font-mono font-bold text-sm text-black">LOADING...</span>
                 ) : isEditMode ? (
                   <input 
                     type="text" 
                     className="font-mono font-bold text-sm text-black bg-transparent border-b border-dashed border-black outline-none px-1 uppercase w-full" 
                     value={controlNumber} 
                     onChange={(e) => setControlNumber(e.target.value.toUpperCase())} 
                   />
                 ) : fullControlNumber ? (
                   <span className="font-mono font-bold text-sm text-black">{fullControlNumber}</span>
                 ) : null}
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold whitespace-nowrap">Berthing Meeting Schedule:</span>
                 <input type="text" className="border-b border-black w-full outline-none px-1 text-xs bg-transparent" />
               </div>
             </div>
          </div>
        </div>

        {/* SHIP PARTICULARS */}
        <div className="bg-gray-200 border-2 border-slate-800 text-center font-bold uppercase tracking-widest py-1 mb-0 border-b-0">
          SHIP PARTICULARS
        </div>

        <div className="border-2 border-slate-800 grid grid-cols-12 gap-0 text-[11px]">
          {/* Row 1 */}
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
             <label className="font-bold mb-1">1. Vessel Name:</label>
             <input type="text" name="vesselName" value={formData.vesselName} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
             <label className="font-bold mb-1">2. Shipping Agency:</label>
             <input type="text" name="agent" value={formData.agent || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-6 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">3. Class/Type:</label>
             <select name="vesselType" value={formData.vesselType} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer" required>
               <option value="">-Select-</option>
               {options?.types.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <div className="col-span-3 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">3b. Voy Type:</label>
             <select name="voyageType" value={formData.voyageType} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer" required>
               <option value="">-Select-</option>
               {options?.voyages.map(v => <option key={v} value={v}>{v}</option>)}
             </select>
          </div>
          <div className="col-span-3 md:col-span-1 border-b border-slate-800 p-2 flex flex-col">
             <label className="font-bold mb-1">4. Voy No.</label>
             <input type="text" name="voyageNo" value={formData.voyageNo} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>

          {/* Row 2 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
             <label className="font-bold mb-1">5. Shipping Line Company / Owner:</label>
             <input type="text" name="shippingLine" value={formData.shippingLine || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
             <label className="font-bold mb-1">6. Vessel Master's Name:</label>
             <input type="text" name="masterName" value={formData.masterName || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col">
             <label className="font-bold mb-1">7. Vessel Flag:</label>
             <input type="text" name="registry" value={formData.registry || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>

          {/* Row 3 */}
          <div className="col-span-6 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">8. Gross Tonnage:</label>
             <input type="text" name="grossTonnage" value={formData.grossTonnage || ''} onChange={handleNumberChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-6 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">9. Length Over-All:</label>
             <input type="text" name="loa" value={formData.loa || ''} onChange={handleNumberChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
             <label className="font-bold mb-1">10. Estimated Time of Arrival (ETA):</label>
             <div className="flex mt-1 items-center gap-2">
               <span className="text-[9px]">Date and Time:</span>
               <input type="datetime-local" name="arrivalDate" value={formData.arrivalDate || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-[10px] text-black" required />
             </div>
          </div>
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col">
             <label className="font-bold mb-1">11. Estimated Time of Departure (ETD):</label>
             <div className="flex mt-1 items-center gap-2">
               <span className="text-[9px]">Date and Time:</span>
               <input type="datetime-local" name="departureDate" value={formData.departureDate || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-[10px] text-black" required />
             </div>
          </div>

          {/* Row 4 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 md:border-r border-r-0">
             <label className="font-bold mb-1">12. Purpose of Call:</label>
             <select name="purpose" value={formData.purpose || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1" required>
               <option value="">-Select-</option>
               <option value="Discharging of Cargo">Discharging of Cargo</option>
               <option value="Loading of Cargo">Loading of Cargo</option>
               <option value="Towing">Towing</option>
               <option value="Others">Others</option>
             </select>
          </div>
          <div className="col-span-6 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">13. Last Port of Call:</label>
             <input type="text" name="origin" value={formData.origin || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>
          <div className="col-span-6 md:col-span-4 border-b border-slate-800 p-2 flex flex-col">
             <label className="font-bold mb-1">14. Next Port of Call:</label>
             <input type="text" name="nextPort" value={formData.nextPort || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black" required />
          </div>

          {/* Row 5 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 md:border-r border-r-0">
             <label className="font-bold mb-1">15. Vessel Operations:</label>
             <select name="vesselOperations" value={formData.vesselOperations || ''} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1" required>
               <option value="">-Select-</option>
               <option value="Direct Docking">Direct Docking</option>
               <option value="Ship-to-ship">Ship-to-ship</option>
               <option value="at Anchorage for Docking">at Anchorage for Docking</option>
               <option value="Others">Others</option>
             </select>
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
             <label className="font-bold mb-1">16. Port Terminal:</label>
             <select name="terminal" value={formData.terminal} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer" required>
               <option value="">-Select-</option>
               {options?.terminals.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col">
             <label className="font-bold mb-1">17. Cargo Description:</label>
             <textarea name="cargoDescription" value={formData.cargoDescription} onChange={handleChange} className="w-full bg-transparent outline-none uppercase font-bold text-black resize-none h-16 text-[10px] sm:text-xs" required />
          </div>

          {/* Undertaking & Signatures */}
          <div className="col-span-12 p-3 pb-6 border-b border-slate-800">
             <p className="font-bold text-[11px] mb-1">Undertaking :</p>
             <p className="text-[10px] mb-2 leading-tight">The undersigned Ship's Owner Representative / Ship's Agent of the Vessel submits this berth application at FAB in accordance to the following conditions :</p>
             <ol className="list-decimal list-outside text-[10px] space-y-0.5 ml-4 leading-tight text-slate-700">
               <li>Complete all Arrival documents as required in the Citizen's charter or the AFAB. Failure to submit the same on or before application for vessel exit, the said application shall not be processed.</li>
               <li>Any false statement or misrepresentation in this application shall be subjected to the penalties imposed under R.A. 9728 or other applicable laws.</li>
               <li>This form should be submitted at least 24 hours (foreign vessel) prior to its arrival.</li>
               <li>Authorized Ship's Agent warrants that the cargoes for discharging/loading are properly documented & assumes full responsibility.</li>
               <li>The shipping lines or agent or authorized representative agrees the non-settlement of previous dues shall be ground for refusal to berth its vessel.</li>
             </ol>
          </div>

          {/* Signature Row */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 h-auto md:h-24">
             <div className="flex flex-col justify-end p-2 pb-1 bg-white">
               <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0">
                 <p className="font-bold text-[10px] text-center">Ship's Owner Representative / Ship's Agent</p>
               </div>
               <div className="flex justify-between text-[9px] italic text-slate-600">
                 <span>(Printed Name and Signature)</span>
                 <span>Date/Time:</span>
               </div>
             </div>
             
             <div className="flex flex-col justify-end p-2 pb-1 relative bg-white">
               <span className="absolute top-1 left-2 text-[9px] italic text-slate-600">Checked by:</span>
               <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0">
                 <p className="font-bold text-[10px] text-center">AFAB Authorized Official</p>
               </div>
               <div className="flex justify-between text-[9px] italic text-slate-600">
                 <span>(Printed Name and Signature)</span>
                 <span>Date/Time:</span>
               </div>
             </div>

             <div className="flex flex-col justify-end p-2 pb-1 relative bg-white">
               <span className="absolute top-1 left-2 text-[9px] italic text-slate-600">Approved by:</span>
               <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0">
                 <p className="font-bold text-[10px] text-center">AFAB Authorized Official</p>
               </div>
               <div className="flex justify-between text-[9px] italic text-slate-600">
                 <span>(Printed Name and Signature)</span>
                 <span>Date/Time:</span>
               </div>
             </div>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <p className="text-[9px] text-right italic text-slate-600 leading-tight">PSD-FM-001<br/>Rev.02 Date Effective 1 January 2023</p>
        </div>

        <div className="mt-8 flex flex-col items-end gap-2 print:hidden">
          <div className="flex justify-end gap-4">
            {isEditMode && (
               <button
                type="button"
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                className="bg-slate-800 text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-70 group relative"
              >
                {isGeneratingPDF ? (
                   <span className="animate-pulse">Loading...</span>
                ) : (
                   <>
                     <Download className="w-5 h-5" />
                     Print Permit
                   </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-fab-blue text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-70 w-full sm:w-auto justify-center"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? 'Save Changes' : 'Submit Entry Permit'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
