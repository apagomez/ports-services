import React, { useState } from 'react';
import { FileText, CheckSquare, LogOut, Ship, User, LayoutGrid, ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VesselEntryForm } from './VesselEntryForm';
import { PASForm } from './PASForm';

import { VesselApplication } from '../types';

import { formatSystemDate } from '../utils/dateFormatter';

const formatUserDate = (dateVal?: string | number | null): string => {
  return formatSystemDate(dateVal);
};

interface UserDashboardProps {
  applications?: VesselApplication[];
  userEmail?: string | null;
  onLogout: () => void;
  onSubmitApp?: (app: Omit<VesselApplication, 'id' | 'createdAt' | 'status'>) => void;
  onDeleteApp?: (id: string) => Promise<void> | void;
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

const services = [
  {
    id: 'vep',
    title: 'Vessel Entry Permit',
    description: 'Apply for entry permit for incoming vessels.',
    icon: Ship,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  {
    id: 'vc',
    title: 'Vessel Clearance',
    description: 'Process outbound clearance for departing vessels.',
    icon: CheckSquare,
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200'
  },
  {
    id: 'pgp',
    title: 'Port Gate Pass',
    description: 'Request access gate pass for port facilities.',
    icon: FileText,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  {
    id: 'ancillary',
    title: 'Ancillary Services',
    description: 'Request for additional port services and assistance.',
    icon: LayoutGrid,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  }
];

export const UserDashboard: React.FC<UserDashboardProps> = ({ 
  applications = [], 
  userEmail, 
  onLogout, 
  onSubmitApp, 
  onDeleteApp,
  options 
}) => {
  const [activeService, setActiveService] = useState<string | null>(null);
  const [editingApplication, setEditingApplication] = useState<VesselApplication | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmitAndReset = async (app: any) => {
    if (onSubmitApp) {
      await onSubmitApp(app);
    }
    // Return to dashboard after a small delay so they can read/be guided
    setTimeout(() => {
      setActiveService(null);
      setEditingApplication(null);
    }, 1500);
  };

  const handleBackToDashboard = () => {
    setActiveService(null);
    setEditingApplication(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-fab-blue p-2 rounded-lg">
              <Ship className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">Port Services Division</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">User Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <User className="w-4 h-4 text-fab-blue" />
              <span className="font-semibold text-slate-700 truncate max-w-[180px]" title={userEmail || 'Applicant'}>
                {userEmail || 'Applicant'}
              </span>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors font-bold uppercase tracking-wider cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {!activeService ? (
            <motion.div
              key="services-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Services Offered</h2>
                <p className="text-slate-600 mt-1">Select a service below to proceed with your application or request.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map((service, index) => {
                  const Icon = service.icon;
                  return (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setActiveService(service.id)}
                      className={`bg-white rounded-xl shadow-sm border ${service.border} p-6 hover:shadow-md transition-all cursor-pointer group`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-xl ${service.bg} group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-8 h-8 ${service.color}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-fab-blue transition-colors">{service.title}</h3>
                          <p className="text-slate-600 mt-1 text-sm">{service.description}</p>
                          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-fab-blue opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Access Service</span>
                            <span className="transition-transform group-hover:translate-x-1">→</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Track applicant's submitted applications */}
              <div className="mt-12">
                <div className="border-t border-slate-200 pt-8 mb-6">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-fab-blue" />
                    My Submitted Applications ({applications.length})
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">Track the multi-stage approval status of your vessel entry permits in real-time.</p>
                </div>

                {applications.length === 0 ? (
                  <div className="bg-white border text-center py-10 rounded-xl border-dashed border-slate-300 text-slate-500">
                    <Ship className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No applications placed yet</p>
                    <p className="text-xs text-slate-400 mt-1">Ready to apply? Click the 'Vessel Entry Permit' card above!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {applications.map((app) => (
                      <div key={app.id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <div>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase inline-block mb-1 ${
                                app.applicationType === 'PAS' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {app.applicationType === 'PAS' ? 'Port Ancillary Service' : 'Vessel Entry Permit'}
                              </span>
                              <h3 className="font-bold text-slate-800 uppercase text-sm truncate max-w-[150px]">
                                {app.applicationType === 'PAS' ? (app.vesselName || 'Ancillary Service') : (app.vesselName || 'Unnamed Vessel')}
                              </h3>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">Ref: {app.id}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 border ${
                              app.status === 'Pending Check' || app.status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              app.status === 'Pending Approval' ? 'bg-purple-50 border-purple-200 text-purple-700 animate-pulse' :
                              app.status === 'Approved' ? 'bg-green-50 border-green-200 text-green-700' :
                              'bg-red-50 border-red-200 text-red-700'
                            }`}>
                              {app.status === 'Pending Check' || app.status === 'Pending' ? '1. Checker Review' :
                               app.status === 'Pending Approval' ? '2. Approver Review' :
                               app.status}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-600 mt-2">
                            {app.applicationType === 'PAS' ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Provider:</span>
                                  <span className="font-semibold text-slate-700 uppercase truncate max-w-[150px]">{app.serviceProviderName || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Terminal:</span>
                                  <span className="font-semibold text-slate-700 uppercase">{app.terminal || '-'}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Agent:</span>
                                  <span className="font-semibold text-slate-700 uppercase">{app.agent || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Voyage:</span>
                                  <span className="font-semibold text-slate-700">{app.voyageNo || '-'}</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-400">Submitted:</span>
                              <span className="font-semibold text-slate-700">{formatUserDate(app.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Line */}
                        <div className="mt-4 pt-3 border-t border-slate-100 font-sans">
                          <div className="flex justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                            <span className="text-green-600">Submitted</span>
                            <span className={app.status !== 'Pending Check' && app.status !== 'Pending' ? 'text-green-600 font-bold' : 'text-amber-500 animate-pulse'}>Checked</span>
                            <span className={app.status === 'Approved' ? 'text-green-600 font-bold' : app.status === 'Pending Approval' ? 'text-purple-500 animate-pulse' : ''}>Approved Permit</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full w-full relative overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${
                              app.status === 'Pending Check' || app.status === 'Pending' ? 'w-1/3 bg-amber-500' :
                              app.status === 'Pending Approval' ? 'w-2/3 bg-purple-500' :
                              app.status === 'Approved' ? 'w-full bg-green-500' :
                              app.status === 'Rejected' ? 'w-full bg-red-500' : 'w-1/3 bg-slate-300'
                            }`} />
                          </div>
                        </div>

                        {/* Edit and Withdraw Action Buttons */}
                        {(app.status === 'Pending Check' || app.status === 'Pending') && (
                          <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-between items-center gap-2">
                            {deletingId === app.id ? (
                              <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-md border border-red-200">
                                <span className="text-[9px] font-bold text-red-600 uppercase px-1">Withdraw?</span>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (onDeleteApp) {
                                      await onDeleteApp(app.id);
                                    }
                                    setDeletingId(null);
                                  }}
                                  className="bg-red-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors hover:bg-red-700"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(null);
                                  }}
                                  className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors hover:bg-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(app.id);
                                }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer group/btn"
                              >
                                <Trash2 className="w-3.5 h-3.5 transition-all group-hover/btn:scale-110" />
                                Withdraw
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingApplication(app);
                                if (app.applicationType === 'PAS') {
                                  setActiveService('ancillary');
                                } else {
                                  setActiveService('vep');
                                }
                              }}
                              className="text-xs font-bold text-fab-blue hover:text-blue-800 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer group/btn"
                            >
                              <Edit3 className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" />
                              EDIT
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeService === 'vep' ? (
            <motion.div
              key="vep-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VesselEntryForm 
                onBack={handleBackToDashboard} 
                options={options} 
                onSubmitApp={handleSubmitAndReset} 
                initialData={editingApplication || undefined}
                isEditMode={!!editingApplication}
              />
            </motion.div>
          ) : activeService === 'ancillary' ? (
            <motion.div
              key="pas-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PASForm 
                onBack={handleBackToDashboard} 
                options={options} 
                onSubmitApp={handleSubmitAndReset} 
                initialData={editingApplication || undefined}
                isEditMode={!!editingApplication}
              />
            </motion.div>
          ) : (
            <motion.div
              key="other-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mb-6">
                <button 
                  onClick={() => setActiveService(null)}
                  className="flex items-center gap-2 text-slate-600 hover:text-fab-blue transition-colors font-bold uppercase text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
              </div>
              <div className="bg-white border rounded-xl p-8 text-center shadow-sm">
                <Ship className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700">Service Under Construction</h3>
                <p className="text-slate-500 mt-2">This service application module is currently being developed.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
