export type ProvenanceMode = 'OSDR-FLT' | 'SIM-RUN';

export type TelemetrySeverity = 'nominal' | 'advisory' | 'critical';

export type ContingencyScenarioId =
  | 'nominal-eva'
  | 'suit-decompression'
  | 'solar-particle-event'
  | 'co2-scrubber-drift';

export interface VitalMetric {
  id: string;
  label: string;
  shortLabel: string;
  value: number;
  unit: string;
  decimals: number;
  minBound: number;
  maxBound: number;
  baselineValue: number;
  severity: TelemetrySeverity;
  deltaPerMin: number;
  history: number[];
  osdrBaselineHistory: number[];
}

export interface CrewMember {
  id: string;
  callsign: string;
  name: string;
  role: string;
  stationLocation: string;
  suitId: string;
  evaElapsedSec: number;
  o2ReservePct: number;
  batteryPct: number;
  status: TelemetrySeverity;
  vitals: {
    spo2: VitalMetric;
    heartRate: VitalMetric;
    hrv: VitalMetric;
    radiationFlux: VitalMetric;
    coreTemp: VitalMetric;
    suitPressure: VitalMetric;
    ppCO2: VitalMetric;
  };
}

export type VitalKey = keyof CrewMember['vitals'];

export interface HabitatSector {
  id: string;
  code: string;
  name: string;
  deckPosition: { x: number; y: number; width: number; height: number };
  pressureKpa: number;
  ppO2Kpa: number;
  ppCO2Kpa: number;
  tempC: number;
  radiationMsvH: number;
  crewIds: string[];
  status: TelemetrySeverity;
  hatchSealed: boolean;
}

export interface ProtocolStep {
  id: string;
  code: string;
  title: string;
  instruction: string;
  targetSystem: string;
  durationSec: number;
  completed: boolean;
  critical: boolean;
}

export interface ContingencyScenario {
  id: ContingencyScenarioId;
  name: string;
  code: string;
  severity: TelemetrySeverity;
  summary: string;
  triggerAlertTitle: string;
  countdownSec: number;
  steps: ProtocolStep[];
}

export interface TelemetryLogEntry {
  id: string;
  timestampUtc: string;
  met: string;
  crewId: string;
  crewCallsign: string;
  provenance: ProvenanceMode;
  datasetRef: string;
  severity: TelemetrySeverity;
  parameter: string;
  reading: string;
  message: string;
}

export interface OsdrDatasetRecord {
  accessionId: string;
  missionName: string;
  cohortSize: number;
  durationHours: number;
  meanSpo2: number;
  meanHr: number;
  meanRadiationMsvH: number;
  meanCoreTemp: number;
  notes: string;
}

export interface TelemetrySnapshot {
  metSeconds: number;
  metFormatted: string;
  provenanceMode: ProvenanceMode;
  activeDatasetId: string;
  activeScenarioId: ContingencyScenarioId;
  isStreaming: boolean;
  countdownSec: number;
  alertAcknowledged: boolean;
  overallSeverity: TelemetrySeverity;
  crew: CrewMember[];
  sectors: HabitatSector[];
  scenarios: ContingencyScenario[];
  logs: TelemetryLogEntry[];
  datasets: OsdrDatasetRecord[];
}
