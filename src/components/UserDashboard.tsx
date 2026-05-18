import React, { useState } from 'react';
import { FileText, CheckSquare, LogOut, Ship, User, LayoutGrid, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VesselEntryForm } from './VesselEntryForm';

import { VesselApplication } from '../types';

interface UserDashboardProps {
  applications?: VesselApplication[];
  onLogout: () => void;
  onSubmitApp?: (app: Omit<VesselApplication, 'id' | 'createdAt' | 'status'>) => void;
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

export const UserDashboard: React.FC<UserDashboardProps> = ({ applications = [], onLogout, onSubmitApp, options }) => {
  const [activeService, setActiveService] = useState<string | null>(null);

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
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4" />
              <span>User</span>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors font-bold uppercase tracking-wider"
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
            </motion.div>
          ) : activeService === 'vep' ? (
            <motion.div
              key="vep-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VesselEntryForm onBack={() => setActiveService(null)} options={options} onSubmitApp={onSubmitApp} />
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
