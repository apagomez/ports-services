import { VesselData } from '../types';

export interface Anomaly {
  id: string;
  level: 'error' | 'warning' | 'info';
  category: 'Operational' | 'Efficiency' | 'Safety' | 'Data Integrity';
  title: string;
  message: string;
}

export function detectVesselAnomalies(v: VesselData): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const vType = (v.vesselType || '').trim().toUpperCase();
  const isTugboat = vType.includes('TUG') || vType.includes('TUGBOAT');
  const isPassenger = vType.includes('PASSENGER');
  const isTrainingShip = vType.includes('TRAINING');

  const cargoDescUpper = (v.cargoDescription || '').trim().toUpperCase();
  const isCargoNA = cargoDescUpper === 'N/A' || cargoDescUpper === 'NA' || cargoDescUpper === 'NONE' || cargoDescUpper === '-' || cargoDescUpper === 'NOT APPLICABLE';

  // Trigger alert if the vessel is neither a Tugboat, Passenger, nor Training ship, the cargo is not N/A, and has missing cargo volume or description
  if (!isTugboat && !isPassenger && !isTrainingShip && !isCargoNA) {
    const hasVolume = (v.cargoVolumeMT && v.cargoVolumeMT > 0) || (v.cargoVolumeCBM && v.cargoVolumeCBM > 0);
    const hasDesc = v.cargoDescription && v.cargoDescription.trim() !== '';
    
    if (!hasVolume || !hasDesc) {
      anomalies.push({
        id: 'missing-cargo',
        level: 'warning',
        category: 'Data Integrity',
        title: 'Missing Cargo Alert',
        message: 'Vessel is registered without specified cargo description or has zero cargo volume (MT and CBM), but is not classified as a Tugboat, Passenger vessel, or Training ship.'
      });
    }
  }

  // Check if departure date is before arrival date
  if (v.arrivalDate && v.departureDate) {
    const arrDate = new Date(v.arrivalDate);
    const depDate = new Date(v.departureDate);
    if (!isNaN(arrDate.getTime()) && !isNaN(depDate.getTime()) && depDate.getTime() < arrDate.getTime()) {
      anomalies.push({
        id: 'invalid-timeline',
        level: 'error',
        category: 'Data Integrity',
        title: 'Timeline Inconsistency',
        message: `Departure date (${v.departureDate}) cannot be before the arrival date (${v.arrivalDate}).`
      });
    }
  }

  return anomalies;
}
