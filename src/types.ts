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
  departureDate: string;
  cargoDescription: string;
  cargoVolumeMT: number;
  cargoVolumeCBM: number;
  atBerthDays: number;
  berthProductivity?: number;
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
  flaggedCount?: number;
  criticalCount?: number;
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
  voyageNo?: string;
  amount: number;
  vat: number;
  total: number;
  date: string;
  monthApplied: string;
}

export interface VesselApplication {
  id: string;
  createdAt: string;
  submittedAt?: string;
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
  status: 'Pending' | 'Pending Check' | 'Pending Approval' | 'Approved' | 'Rejected';
  applicationType?: 'VEP' | 'PAS' | 'PGP';
  company?: string;
  companyAddress?: string;
  nameOfRepresentative?: string;
  contactNumber?: string;
  dateOfOperationFrom?: string;
  dateOfOperationTo?: string;
  operationLoading?: boolean;
  operationUnloading?: boolean;
  cargoDeclaredBL?: boolean;
  articlesNotSubjectImport?: boolean;
  typeOfTransport?: 'Land' | 'Sea' | 'Air';
  typeOfCargoByOrigin?: 'Import' | 'Export' | 'Coastwise';
  classificationOfCargo?: 'Bulk Cargo' | 'General Cargo' | 'Containerized Cargo' | 'Others';
  classificationSpecify?: string;
  cargoTableData?: CargoRow[];
  serviceProviderName?: string;
  serviceBusinessAddress?: string;
  serviceContactNo?: string;
  selectedServices?: string[];
  otherServiceSpecify?: string;
  detailsOfService?: string;
  validity?: string;
  userEmail?: string;
  submitterName?: string;
  signatureType?: 'upload' | 'draw';
  signatureData?: string;
  checkedByName?: string;
  checkedAt?: string;
  checkedSignatureData?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvedSignatureData?: string;
}

export interface VoyagePaymentRecord {
  controlNo: string;
  month: string;
  vesselName: string;
  shippingAgency: string;
  portDues: number;
  dockage: number;
  anchorage: number;
  pilotage: number;
  usageFee: number;
  serviceFee: number;
  vatVessel: number;
  consignee: string;
  importWharfage: number;
  domesticWharfage: number;
  vatCargo: number;
  actualPayment: number;
  vesselTotal: number;
  cargoTotal: number;
}

export interface PaymentDashboardData {
  monthlyRevenue: MonthlyRevenue[];
  feeBreakdown: FeeBreakdown[];
  vmfMonthly: { month: string; value: number }[];
  tugboatMonthly: { month: string; value: number }[];
  ancillaryMonthly: { month: string; value: number }[];
  ancillaryRecords: AncillaryRecord[];
  voyagePayments?: VoyagePaymentRecord[];
  annualTotal: number;
  vmfTotal: number;
  tugboatTotal: number;
  ancillaryTotal: number;
  pgpControlNumbers?: string[];
}

export interface CargoRow {
  blNo: string;
  description: string;
  quantity: number;
  unit: string;
  weightVolume: number;
  total: number;
}
