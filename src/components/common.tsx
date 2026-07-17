import { cn } from '../lib/utils';
import { TrendingUp } from 'lucide-react';

export function StatCard({ label, value, icon: Icon, trend, onClick, className }: { label: string, value: string | number, icon: any, trend?: string, onClick?: () => void, className?: string }) {
  return (
    <div 
      className={cn(
        "border border-slate-200/80 rounded-xl p-3.5 bg-white hover:border-fab-blue/40 hover:shadow-md transition-all group cursor-pointer shadow-2xs",
        onClick && "active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="bg-fab-blue/5 p-1.5 rounded-lg group-hover:bg-fab-blue transition-colors">
          <Icon className="w-4 h-4 text-fab-blue group-hover:text-white" />
        </div>
        {trend && <span className="text-[8px] font-extrabold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">{trend}</span>}
      </div>
      <div className="space-y-0.5">
        <h3 className="text-[9px] font-bold uppercase text-slate-400 tracking-wider truncate" title={label}>{label}</h3>
        <p className="text-xl md:text-2xl font-black tracking-tight text-fab-blue leading-none">{value}</p>
      </div>
    </div>
  );
}

export function DetailItem({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) {
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

export const TRENDING_UP = TrendingUp;
