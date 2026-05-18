export interface VesselData {
  controlNo: string;
  aveNumber: string;
  month: string;
  terminal: string;
  voyageType: string;
  vesselName: string;
  voyageNo: string;
  status: string;
  remarks: string;
  purpose: string;
  operation: string;
  vesselType: string;
  orientation: 'Foreign' | 'Domestic';
  agent: string;
  shippingLine: string;
  consignee: string;
  origin: string;
  nextPort: string;
  shipmentKind: string;
  passengers: number;
  registry: string;
  gt: number;
  motorized: string;
  arrivalDate: string;
  cargoDescription: string;
  cargoVolumeMT: number;
  atBerthDays: number;
}

export interface SummaryStats {
  total: number;
  departed: number;
  atPort: number;
  atAnchorage: number;
  berthed: number;
  arriving: number;
  vesselTypes: Record<string, number>;
  registries: Record<string, number>;
}

export interface MonthlyRevenue {
  month: string;
  foreignVessel: number;
  domesticVessel: number;
  foreignCargo: number;
  domesticCargo: number;
  total: number;
  totalWithVat: number;
}

export interface FeeBreakdown {
  month: string;
  portDues: number;
  dockage: number;
  anchorage: number;
  pilotage: number;
  usageFee: number;
  wharfage: number;
  // Specific splits for filtering
  foreignTotal: number;
  domesticTotal: number;
  total: number;
  totalWithVat: number;
}

export interface AncillaryRecord {
  controlNo: string;
  provider: string;
  terminal: string;
  serviceType: string;
  vesselName: string;
  amount: number;
  vat: number;
  total: number;
  date: string;
  monthApplied: string;
}

export interface VesselApplication {
  id: string;
  createdAt: string;
  vesselName: string;
  agent?: string;
  vesselType?: string;
  voyageType?: string;
  voyageNo?: string;
  shippingLine?: string;
  masterName?: string;
  registry?: string;
  grossTonnage?: string;
  loa?: string;
  arrivalDate?: string;
  departureDate?: string;
  purpose?: string;
  origin?: string;
  nextPort?: string;
  vesselOperations?: string;
  terminal?: string;
  cargoDescription?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  userEmail?: string;
}

export interface PaymentDashboardData {
  monthlyRevenue: MonthlyRevenue[];
  feeBreakdown: FeeBreakdown[];
  vmfMonthly: { month: string; value: number }[];
  tugboatMonthly: { month: string; value: number }[];
  ancillaryMonthly: { month: string; value: number }[];
  ancillaryRecords: AncillaryRecord[];
  annualTotal: number;
  vmfTotal: number;
  tugboatTotal: number;
  ancillaryTotal: number;
}
