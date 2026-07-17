import React, { useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  Layers, 
  Activity, 
  Sliders, 
  FileCheck,
  Ship,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';
import { motion } from 'motion/react';

export function SampleDashboard() {
  const [selectedFeature, setSelectedFeature] = useState<string>('introduction');
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Verify Port Authority Blue signature requirements', completed: true },
    { id: 2, text: 'Validate custom vessel voyage types (Domestic/Foreign)', completed: true },
    { id: 3, text: 'Confirm Google Sheets integration payload structure', completed: false },
    { id: 4, text: 'Test user/checker/approver approval workflow rules', completed: false },
    { id: 5, text: 'Examine layout responsivity on small screen devices', completed: false },
  ]);

  const toggleCheck = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  return (
    <div className="space-y-6" id="sample-dashboard-root">
      {/* Top Banner section */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-md border border-indigo-950/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-indigo-400" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Developer Sandbox &amp; Resources</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-sans text-white uppercase">
            Bataan Freeport Port Control Playground
          </h1>
          <p className="text-slate-300 text-xs md:text-sm font-medium mt-2 leading-relaxed">
            Welcome to the experimental hub of the Port Authority platform. Use this dedicated space to explore active system architectures, view port-related regulatory guidelines, or conduct a workflow verification checklist.
          </p>
        </div>
      </div>

      {/* Main Grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Navigation Menu Card */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">Playground Topics</h3>
          </div>
          
          <div className="space-y-1">
            {[
              { id: 'introduction', label: 'Sandbox Introduction', icon: Layers, desc: 'Overview of the play area.' },
              { id: 'regulations', label: 'Port Regulations Guide', icon: BookOpen, desc: 'Required documentation rules.' },
              { id: 'vessel-classes', label: 'Vessel Classification', icon: Ship, desc: 'Ancillary and cargo indicators.' },
              { id: 'workflow', label: 'Authority Guardrails', icon: ShieldCheck, desc: 'Checker to Approver flow rules.' }
            ].map((item) => {
              const isSel = selectedFeature === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedFeature(item.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border cursor-pointer ${
                    isSel 
                      ? 'bg-indigo-50/50 border-indigo-100 text-indigo-950 shadow-2xs' 
                      : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSel ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-normal font-semibold">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle/Right: Interactive Panel Display */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Topic Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 min-h-[280px] flex flex-col justify-between">
            <div>
              {selectedFeature === 'introduction' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">Interactive Sandbox Overview</h2>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    This sample dashboard demonstrates modular React component design integrated directly alongside our live Firebase Firestore schema.
                  </p>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    This platform serves vessel arrivals and cargo handling registries in real-time. In this sandbox, you can review operational logic, design mock checkups, and view authority control configurations safely.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-start gap-2.5">
                    <HelpCircle className="w-4.5 h-4.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Quick Sandbox Tip</div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Switch between tabs in the sidebar navigation to test rendering speeds, layout consistency, and responsive component grids.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedFeature === 'regulations' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">Port Regulations Checklist</h2>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Vessels entering the Freeport Area of Bataan (FAB) must comply with strict registration protocols. The system enforces validation gates to guarantee proper submission of:
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <li className="flex items-center gap-2 text-slate-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      Vessel Entry Permits (VEP)
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      Port Ancillary Services (PAS)
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      Authorized Gate Passes (PGP)
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      Unique Control Identification
                    </li>
                  </ul>
                  <p className="text-slate-500 text-[10px] italic leading-relaxed mt-2">
                    Note: Registered agents must declare precise Gross Tonnage (GT) and Length Overall (LOA) measurements matching Lloyd's Register.
                  </p>
                </div>
              )}

              {selectedFeature === 'vessel-classes' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Ship className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">Vessel Classification Definitions</h2>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Incoming container carriers, liquid bulk, and bulk dry vessels are routed into specific loading docks based on their operation type:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Liquid Bulk</div>
                      <div className="text-xs font-black text-slate-800 mt-1 uppercase">Dredgers &amp; Tankers</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dry Cargo</div>
                      <div className="text-xs font-black text-slate-800 mt-1 uppercase">Bulk Carriers</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ancillary</div>
                      <div className="text-xs font-black text-slate-800 mt-1 uppercase">Tugs &amp; Barges</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedFeature === 'workflow' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">System Workflow Guardrails</h2>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Applications undergo a verified two-phase clearance loop:
                  </p>
                  <div className="relative border-l border-indigo-100 ml-3 pl-4 space-y-3 py-1">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-0.5 bg-indigo-600 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">1</div>
                      <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">Verification Stage (Port Checker)</div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Checker audits control numbers, verifies measurements, and appends a secure verification signature.
                      </p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[21px] top-0.5 bg-indigo-600 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">2</div>
                      <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">Approval Stage (Port Approver)</div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Approver checks physical cargo manifests, issues a digital signature, and triggers live Google Sheets ledger synchronization.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-right mt-4">
              <span className="text-[9px] font-mono font-bold text-indigo-500 uppercase tracking-wider">
                Topic Code: {selectedFeature.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Interactive Checklist section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">Interactive Sandbox Checklist</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                {checklist.filter(c => c.completed).length} / {checklist.length} Done
              </span>
            </div>

            <p className="text-slate-600 text-xs">
              Complete these manual validation checks to test component reactivity. Your selection state resides locally.
            </p>

            <div className="space-y-2 mt-2">
              {checklist.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => toggleCheck(item.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    item.completed 
                      ? 'bg-slate-50/50 border-slate-100 text-slate-400 line-through' 
                      : 'bg-white border-slate-250 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/10'
                  }`}
                >
                  <button className="mt-0.5 flex-shrink-0 cursor-pointer focus:outline-none">
                    {item.completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 fill-emerald-50" />
                    ) : (
                      <div className="w-4.5 h-4.5 rounded-full border border-slate-350 hover:border-indigo-500 transition-colors" />
                    )}
                  </button>
                  <span className="text-xs font-semibold select-none leading-relaxed">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
