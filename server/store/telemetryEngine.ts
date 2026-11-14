import type {
  ContingencyScenario,
  ContingencyScenarioId,
  CrewMember,
  HabitatSector,
  OsdrDatasetRecord,
  ProvenanceMode,
  TelemetryLogEntry,
  TelemetrySeverity,
  TelemetrySnapshot,
  VitalKey,
  VitalMetric,
} from '../types.ts';

export interface MedicalCalibrationInput {
  crewCallsign: string;
  subjectName?: string;
  subjectRole?: string;
  fileName: string;
  issuer?: string;
  recordCategory?: 'MEDICAL_STATS' | 'CERTIFICATE';
  clearanceStatus: 'CLEARED_EVA' | 'HAB_ONLY' | 'REVIEW_REQUIRED';
  baselineSpo2: number;
  baselineHr: number;
  baselineCoreTemp?: number;
  baselineRadFlux?: number;
  baselineHrv?: number;
  baselineSuitPressure?: number;
  baselinePpCO2?: number;
  baselineO2Reserve?: number;
  parsedSummary?: string;
}

function formatMet(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `T+${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatUtcNow(): string {
  const d = new Date();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(
    d.getUTCSeconds()
  ).padStart(2, '0')} UTC`;
}

function evaluateVitalSeverity(
  key: VitalKey,
  val: number,
  isHabMode: boolean
): TelemetrySeverity {
  if (key === 'spo2') {
    if (val < 92.0) return 'critical';
    if (val < 95.0) return 'advisory';
    return 'nominal';
  }
  if (key === 'heartRate') {
    if (val > 145 || val < 45) return 'critical';
    if (val > 125 || val < 52) return 'advisory';
    return 'nominal';
  }
  if (key === 'hrv') {
    if (val < 20) return 'critical';
    if (val < 28) return 'advisory';
    return 'nominal';
  }
  if (key === 'radiationFlux') {
    if (val >= 1.8) return 'critical';
    if (val >= 0.9) return 'advisory';
    return 'nominal';
  }
  if (key === 'coreTemp') {
    if (val >= 38.5 || val <= 35.5) return 'critical';
    if (val >= 37.9 || val <= 36.1) return 'advisory';
    return 'nominal';
  }
  if (key === 'suitPressure') {
    if (isHabMode) {
      if (val < 92.0) return 'critical';
      if (val < 97.0) return 'advisory';
      return 'nominal';
    }
    if (val < 25.0) return 'critical';
    if (val < 27.5) return 'advisory';
    return 'nominal';
  }
  if (key === 'ppCO2') {
    if (val >= 0.85) return 'critical';
    if (val >= 0.6) return 'advisory';
    return 'nominal';
  }
  return 'nominal';
}

function createVitalMetric(params: {
  id: VitalKey;
  label: string;
  shortLabel: string;
  value: number;
  unit: string;
  decimals: number;
  minBound: number;
  maxBound: number;
  isHabMode: boolean;
}): VitalMetric {
  const factor = Math.pow(10, params.decimals);
  const rounded = Math.round(params.value * factor) / factor;
  const severity = evaluateVitalSeverity(params.id, rounded, params.isHabMode);
  const history = Array.from({ length: 12 }, (_, idx) => {
    const wave = idx === 11 ? 0 : Math.sin(idx * 0.7) * (params.decimals === 0 ? 1 : 0.08);
    return Math.round((rounded + wave) * factor) / factor;
  });

  return {
    id: params.id,
    label: params.label,
    shortLabel: params.shortLabel,
    value: rounded,
    unit: params.unit,
    decimals: params.decimals,
    minBound: params.minBound,
    maxBound: params.maxBound,
    baselineValue: rounded,
    severity,
    deltaPerMin: 0.0,
    history,
    osdrBaselineHistory: Array.from({ length: 12 }, () => rounded),
  };
}

function buildCrewMemberFromMedical(input: MedicalCalibrationInput): CrewMember {
  const callsign = input.crewCallsign.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || 'SUBJ-01';
  const id = `subj-${callsign.toLowerCase()}`;
  const isHabMode = input.clearanceStatus !== 'CLEARED_EVA';

  const spo2 = Math.min(100, Math.max(70, Number(input.baselineSpo2) || 98.4));
  const hr = Math.min(220, Math.max(35, Math.round(Number(input.baselineHr) || 72)));
  const coreTemp =
    typeof input.baselineCoreTemp === 'number' &&
    input.baselineCoreTemp >= 33 &&
    input.baselineCoreTemp <= 42
      ? input.baselineCoreTemp
      : 37.0;
  const radFlux =
    typeof input.baselineRadFlux === 'number' &&
    input.baselineRadFlux >= 0 &&
    input.baselineRadFlux <= 10
      ? input.baselineRadFlux
      : isHabMode
      ? 0.21
      : 0.38;
  const hrv =
    typeof input.baselineHrv === 'number' &&
    input.baselineHrv >= 5 &&
    input.baselineHrv <= 150
      ? input.baselineHrv
      : 48.0;
  const suitPressure =
    typeof input.baselineSuitPressure === 'number' &&
    input.baselineSuitPressure >= 15 &&
    input.baselineSuitPressure <= 110
      ? input.baselineSuitPressure
      : isHabMode
      ? 101.3
      : 29.6;
  const ppCO2 =
    typeof input.baselinePpCO2 === 'number' &&
    input.baselinePpCO2 >= 0 &&
    input.baselinePpCO2 <= 3
      ? input.baselinePpCO2
      : isHabMode
      ? 0.28
      : 0.34;
  const o2Reserve =
    typeof input.baselineO2Reserve === 'number' &&
    input.baselineO2Reserve >= 5 &&
    input.baselineO2Reserve <= 100
      ? input.baselineO2Reserve
      : isHabMode
      ? 96.0
      : 82.0;

  const vitals: CrewMember['vitals'] = {
    spo2: createVitalMetric({
      id: 'spo2',
      label: 'Arterial Oxygen Saturation (SpO2)',
      shortLabel: 'SpO2',
      value: spo2,
      unit: '%',
      decimals: 1,
      minBound: 94.0,
      maxBound: 100.0,
      isHabMode,
    }),
    heartRate: createVitalMetric({
      id: 'heartRate',
      label: 'Cardiac Rate',
      shortLabel: 'HEART RATE',
      value: hr,
      unit: 'BPM',
      decimals: 0,
      minBound: 50,
      maxBound: 135,
      isHabMode,
    }),
    hrv: createVitalMetric({
      id: 'hrv',
      label: 'Heart Rate Variability (RMSSD)',
      shortLabel: 'HRV RMSSD',
      value: hrv,
      unit: 'ms',
      decimals: 1,
      minBound: 22.0,
      maxBound: 85.0,
      isHabMode,
    }),
    radiationFlux: createVitalMetric({
      id: 'radiationFlux',
      label: 'Dosimetry Radiation Flux',
      shortLabel: 'RAD FLUX',
      value: radFlux,
      unit: 'mSv/h',
      decimals: 2,
      minBound: 0.0,
      maxBound: 2.5,
      isHabMode,
    }),
    coreTemp: createVitalMetric({
      id: 'coreTemp',
      label: 'Core Body Temperature',
      shortLabel: 'CORE TEMP',
      value: coreTemp,
      unit: '°C',
      decimals: 1,
      minBound: 35.8,
      maxBound: 38.4,
      isHabMode,
    }),
    suitPressure: createVitalMetric({
      id: 'suitPressure',
      label: isHabMode ? 'Module Cabin Pressure' : 'EMU Suit Loop Pressure',
      shortLabel: isHabMode ? 'CABIN PRESS' : 'SUIT PRESS',
      value: suitPressure,
      unit: 'kPa',
      decimals: 1,
      minBound: isHabMode ? 95.0 : 26.5,
      maxBound: isHabMode ? 103.5 : 31.5,
      isHabMode,
    }),
    ppCO2: createVitalMetric({
      id: 'ppCO2',
      label: isHabMode ? 'Module Partial Pressure CO2' : 'Inspired Partial Pressure CO2',
      shortLabel: 'ppCO2',
      value: ppCO2,
      unit: 'kPa',
      decimals: 2,
      minBound: 0.0,
      maxBound: 0.85,
      isHabMode,
    }),
  };

  const vitalSeverities = Object.values(vitals).map((v) => v.severity);
  const status: TelemetrySeverity = vitalSeverities.includes('critical')
    ? 'critical'
    : vitalSeverities.includes('advisory') || input.clearanceStatus === 'REVIEW_REQUIRED'
    ? 'advisory'
    : 'nominal';

  const stationLocation =
    input.clearanceStatus === 'HAB_ONLY'
      ? 'Columbus BioLab (Hab-Restricted)'
      : input.clearanceStatus === 'REVIEW_REQUIRED'
      ? 'Columbus Med Bay (Hold)'
      : 'Quest Airlock Exterior';

  return {
    id,
    callsign,
    name: input.subjectName?.trim() || callsign,
    role: input.subjectRole?.trim() || (isHabMode ? 'Habitat Crew Subject' : 'EVA Crew Subject'),
    stationLocation,
    suitId: isHabMode ? `IVA-${callsign}` : `EMU-${callsign}`,
    evaElapsedSec: isHabMode ? 0 : 1240,
    o2ReservePct: o2Reserve,
    batteryPct: isHabMode ? 98.0 : 88.0,
    status,
    medicalReport: {
      fileName: input.fileName,
      issuer: input.issuer?.trim() || 'Flight Medical Clinic',
      clearanceStatus: input.clearanceStatus,
      category: input.recordCategory ?? 'MEDICAL_STATS',
      summary: input.parsedSummary?.trim() || `Calibrated from ${input.fileName}`,
    },
    vitals,
  };
}

const INITIAL_SECTORS: HabitatSector[] = [
  {
    id: 'quest-airlock',
    code: 'SEC-01',
    name: 'Quest Airlock',
    deckPosition: { x: 42, y: 120, width: 132, height: 84 },
    pressureKpa: 70.4,
    ppO2Kpa: 21.1,
    ppCO2Kpa: 0.31,
    tempC: 20.6,
    radiationMsvH: 0.38,
    crewIds: [],
    status: 'nominal',
    hatchSealed: true,
  },
  {
    id: 'node-2',
    code: 'SEC-02',
    name: 'Node 2 Harmony',
    deckPosition: { x: 196, y: 108, width: 164, height: 108 },
    pressureKpa: 101.3,
    ppO2Kpa: 21.4,
    ppCO2Kpa: 0.29,
    tempC: 21.8,
    radiationMsvH: 0.24,
    crewIds: [],
    status: 'nominal',
    hatchSealed: false,
  },
  {
    id: 'columbus-lab',
    code: 'SEC-03',
    name: 'Columbus BioLab',
    deckPosition: { x: 382, y: 108, width: 178, height: 108 },
    pressureKpa: 101.2,
    ppO2Kpa: 21.3,
    ppCO2Kpa: 0.28,
    tempC: 21.4,
    radiationMsvH: 0.21,
    crewIds: [],
    status: 'nominal',
    hatchSealed: false,
  },
  {
    id: 'truss-s4',
    code: 'SEC-04',
    name: 'Truss S4 Exterior',
    deckPosition: { x: 196, y: 24, width: 164, height: 64 },
    pressureKpa: 0.0,
    ppO2Kpa: 0.0,
    ppCO2Kpa: 0.0,
    tempC: -42.5,
    radiationMsvH: 0.45,
    crewIds: [],
    status: 'nominal',
    hatchSealed: true,
  },
  {
    id: 'cupola-obs',
    code: 'SEC-05',
    name: 'Cupola & Storm Shelter',
    deckPosition: { x: 214, y: 238, width: 128, height: 66 },
    pressureKpa: 101.3,
    ppO2Kpa: 21.5,
    ppCO2Kpa: 0.26,
    tempC: 20.9,
    radiationMsvH: 0.14,
    crewIds: [],
    status: 'nominal',
    hatchSealed: false,
  },
];

const INITIAL_SCENARIOS: ContingencyScenario[] = [
  {
    id: 'nominal-eva',
    name: 'Nominal Orbital EVA',
    code: 'SCN-00',
    severity: 'nominal',
    summary: 'Standard low-Earth orbit activity within the uploaded medical report baseline envelope.',
    triggerAlertTitle: 'ALL TELEMETRY CHANNELS NOMINAL',
    countdownSec: 0,
    steps: [
      {
        id: 'nom-1',
        code: 'CHK-01',
        title: 'Verify Primary O2 Loop',
        instruction: 'Confirm regulator holding steady within uploaded medical clearance band with zero leak delta.',
        targetSystem: 'PRIMARY / LSS',
        durationSec: 30,
        completed: true,
        critical: false,
      },
      {
        id: 'nom-2',
        code: 'CHK-02',
        title: 'Confirm Ground Telemetry Lock',
        instruction: 'Validate TDRS Ku-band physiological downlink packet parity.',
        targetSystem: 'COMMS-TDRS',
        durationSec: 20,
        completed: true,
        critical: false,
      },
    ],
  },
  {
    id: 'suit-decompression',
    name: 'EMU Suit Micro-Leak / Hypoxia',
    code: 'SCN-01',
    severity: 'critical',
    summary: 'Rapid pressure decay (-0.9 kPa/min) with secondary arterial SpO2 desaturation.',
    triggerAlertTitle: 'CRITICAL: SUIT PRESSURE DECAY & HYPOXIA WARNING',
    countdownSec: 180,
    steps: [
      {
        id: 'dec-1',
        code: 'EMG-01',
        title: 'Engage Secondary Oxygen Pack (SOP)',
        instruction: 'Actuate SOP valve on left DCM to arrest pressure decay at 23.4 kPa floor.',
        targetSystem: 'PRIMARY SOP',
        durationSec: 15,
        completed: false,
        critical: true,
      },
      {
        id: 'dec-2',
        code: 'EMG-02',
        title: 'Terminate Exterior Task & Translate to Quest',
        instruction: 'Translate affected subject along safety tether vector back to Quest Airlock.',
        targetSystem: 'SEC-01 AIRLOCK',
        durationSec: 90,
        completed: false,
        critical: true,
      },
      {
        id: 'dec-3',
        code: 'EMG-03',
        title: 'Seal Crew Lock & Equalize to 70.4 kPa',
        instruction: 'Close thermal cover and outer hatch; initiate emergency repressurization.',
        targetSystem: 'QUEST-ECLSS',
        durationSec: 60,
        completed: false,
        critical: true,
      },
      {
        id: 'dec-4',
        code: 'EMG-04',
        title: 'Initiate Hyperbaric Medical Assessment',
        instruction: 'Prepare 100% O2 mask and neurological decompression screen in Columbus Med Bay.',
        targetSystem: 'COLUMBUS MED',
        durationSec: 45,
        completed: false,
        critical: false,
      },
    ],
  },
  {
    id: 'solar-particle-event',
    name: 'Solar Particle Radiation Flux',
    code: 'SCN-02',
    severity: 'critical',
    summary: 'NOAA S3 proton event increasing external dosimetry flux above 2.10 mSv/h.',
    triggerAlertTitle: 'CRITICAL: SOLAR PARTICLE FLUX EXCEEDS 2.0 mSv/h THRESHOLD',
    countdownSec: 240,
    steps: [
      {
        id: 'spe-1',
        code: 'RAD-01',
        title: 'Abort Exterior EVA Operations',
        instruction: 'Recall active EVA subject immediately into shielded habitat volume.',
        targetSystem: 'EVA CREW',
        durationSec: 60,
        completed: false,
        critical: true,
      },
      {
        id: 'spe-2',
        code: 'RAD-02',
        title: 'Relocate Subject to Water-Wall Storm Shelter',
        instruction: 'Move active subject to SEC-05 Cupola/Zvezda high-density polyethylene barrier.',
        targetSystem: 'SEC-05 SHELTER',
        durationSec: 120,
        completed: false,
        critical: true,
      },
      {
        id: 'spe-3',
        code: 'RAD-03',
        title: 'Switch Attitude to Minimum Cross-Section',
        instruction: 'Command CMG torque profile to orient aft propellant tanks sunward.',
        targetSystem: 'ADCS-CMG',
        durationSec: 45,
        completed: false,
        critical: false,
      },
    ],
  },
  {
    id: 'co2-scrubber-drift',
    name: 'CO2 Scrubber Drift / Hypercapnia',
    code: 'SCN-03',
    severity: 'advisory',
    summary: 'Amine swingbed saturation causing inspired ppCO2 climb toward 0.78 kPa.',
    triggerAlertTitle: 'ADVISORY: INSPIRED ppCO2 DRIFTING ABOVE 0.65 kPa NOMINAL LIMIT',
    countdownSec: 360,
    steps: [
      {
        id: 'co2-1',
        code: 'ECL-01',
        title: 'Switch to Auxiliary LiOH Cartridge',
        instruction: 'Bypass primary CDRA bed and engage standby lithium hydroxide canister.',
        targetSystem: 'ECLSS-CDRA',
        durationSec: 40,
        completed: false,
        critical: false,
      },
      {
        id: 'co2-2',
        code: 'ECL-02',
        title: 'Increase Cabin Inter-Module Ventilation',
        instruction: 'Set Node 2 to Columbus IMV duct fans to 100% flow rate.',
        targetSystem: 'IMV-DUCT-B',
        durationSec: 25,
        completed: false,
        critical: false,
      },
      {
        id: 'co2-3',
        code: 'ECL-03',
        title: 'Monitor Subject Cognitive & HRV Baseline',
        instruction: 'Log 5-minute RMSSD recovery trend to verify normocapnic stabilization.',
        targetSystem: 'BIO-TELEM',
        durationSec: 60,
        completed: false,
        critical: false,
      },
    ],
  },
];

const OSDR_REFERENCE_DATASETS: OsdrDatasetRecord[] = [
  {
    accessionId: 'OSD-542',
    missionName: 'Inspiration4 Orbital Biomedical Baseline',
    cohortSize: 4,
    durationHours: 71.2,
    meanSpo2: 98.4,
    meanHr: 71.8,
    meanRadiationMsvH: 0.36,
    meanCoreTemp: 37.0,
    notes: 'NASA OSDR reference: continuous wearable SpO2, ECG HRV, and ambient radiation dosimetry.',
  },
  {
    accessionId: 'OSD-318',
    missionName: 'ISS Expedition 68 EVA Suit Telemetry',
    cohortSize: 6,
    durationHours: 42.5,
    meanSpo2: 98.1,
    meanHr: 84.2,
    meanRadiationMsvH: 0.41,
    meanCoreTemp: 37.3,
    notes: 'NASA OSDR reference: EMU suit pressure stability (29.6 kPa) and thermal loop exchange.',
  },
  {
    accessionId: 'OSD-611',
    missionName: 'Spaceflight Hypercapnia & HRV Drift Study',
    cohortSize: 12,
    durationHours: 168.0,
    meanSpo2: 97.6,
    meanHr: 76.5,
    meanRadiationMsvH: 0.24,
    meanCoreTemp: 36.9,
    notes: 'NASA OSDR reference: elevated ppCO2 effects on RMSSD and cerebral perfusion.',
  },
];

class TelemetryEngine {
  private metSeconds = 15195;
  private provenanceMode: ProvenanceMode = 'OSDR-FLT';
  private activeDatasetId = 'OSD-542';
  private activeScenarioId: ContingencyScenarioId = 'nominal-eva';
  private activeCrewId = '';
  private isStreaming = true;
  private countdownSec = 0;
  private alertAcknowledged = false;
  private crew: CrewMember[] = [];
  private sectors: HabitatSector[] = structuredClone(INITIAL_SECTORS);
  private scenarios: ContingencyScenario[] = structuredClone(INITIAL_SCENARIOS);
  private logs: TelemetryLogEntry[] = [];
  private uploadedDatasets: OsdrDatasetRecord[] = [];
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      if (this.isStreaming) {
        this.stepSimulation();
      }
    }, 1200);
  }

  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private stepSimulation(): void {
    this.metSeconds += 1;
    if (this.countdownSec > 0) {
      this.countdownSec -= 1;
    }

    const primaryCrewId = this.activeCrewId || this.crew[0]?.id || '';

    this.crew = this.crew.map((member) => {
      const updatedVitals = { ...member.vitals };
      const isHabMode = member.medicalReport?.clearanceStatus !== 'CLEARED_EVA';

      (Object.keys(updatedVitals) as VitalKey[]).forEach((key) => {
        const metric = updatedVitals[key];
        const baseline = metric.baselineValue;
        let target = baseline;
        let jitter = (Math.random() - 0.5) * (key === 'heartRate' ? 2.0 : 0.12);

        if (this.provenanceMode === 'SIM-RUN') {
          if (this.activeScenarioId === 'suit-decompression' && member.id === primaryCrewId) {
            if (key === 'suitPressure') target = isHabMode ? 90.5 : 23.6;
            if (key === 'spo2') target = 90.4;
            if (key === 'heartRate') target = Math.max(145, baseline + 52);
            if (key === 'hrv') target = 18.5;
          } else if (this.activeScenarioId === 'solar-particle-event') {
            if (key === 'radiationFlux') {
              target = isHabMode ? 0.88 : 2.24;
              jitter = (Math.random() - 0.5) * 0.16;
            }
            if (key === 'heartRate') target = isHabMode ? baseline + 10 : baseline + 34;
          } else if (this.activeScenarioId === 'co2-scrubber-drift') {
            if (key === 'ppCO2') target = 0.78;
            if (key === 'heartRate') target = baseline + 16;
            if (key === 'hrv') target = 24.5;
          }
        }

        const stepFactor = this.provenanceMode === 'SIM-RUN' ? 0.22 : 0.35;
        const nextRaw = metric.value + (target - metric.value) * stepFactor + jitter;
        const factor = Math.pow(10, metric.decimals);
        const nextVal = Math.round(nextRaw * factor) / factor;
        const delta = Math.round((nextVal - metric.value) * 6 * factor) / factor;
        const severity = evaluateVitalSeverity(key, nextVal, isHabMode);

        updatedVitals[key] = {
          ...metric,
          value: nextVal,
          deltaPerMin: delta,
          severity,
          history: [...metric.history.slice(1), nextVal],
        };
      });

      const vitalSeverities = Object.values(updatedVitals).map((v) => v.severity);
      const nextStatus: TelemetrySeverity = vitalSeverities.includes('critical')
        ? 'critical'
        : vitalSeverities.includes('advisory') ||
          member.medicalReport?.clearanceStatus === 'REVIEW_REQUIRED'
        ? 'advisory'
        : 'nominal';

      const o2Burn =
        this.activeScenarioId === 'suit-decompression' &&
        member.id === primaryCrewId &&
        this.provenanceMode === 'SIM-RUN'
          ? 0.14
          : 0.01;

      return {
        ...member,
        evaElapsedSec: isHabMode ? 0 : member.evaElapsedSec + 1,
        o2ReservePct: Math.max(12, member.o2ReservePct - o2Burn),
        status: nextStatus,
        vitals: updatedVitals,
      };
    });

    this.sectors = this.sectors.map((sec) => {
      const occupants = this.crew.filter((c) => sec.crewIds.includes(c.id));
      const baseRad =
        occupants.length > 0
          ? occupants.reduce((sum, c) => sum + c.vitals.radiationFlux.baselineValue, 0) /
            occupants.length
          : sec.id === 'truss-s4'
          ? 0.45
          : sec.id === 'quest-airlock'
          ? 0.38
          : sec.id === 'cupola-obs'
          ? 0.14
          : 0.22;

      let targetRad = baseRad;
      let targetCo2 =
        occupants.length > 0
          ? occupants.reduce((sum, c) => sum + c.vitals.ppCO2.baselineValue, 0) / occupants.length
          : sec.id === 'truss-s4'
          ? 0
          : 0.28;
      let targetPress = sec.id === 'truss-s4' ? 0 : sec.id === 'quest-airlock' ? 70.4 : 101.3;

      if (this.provenanceMode === 'SIM-RUN') {
        if (this.activeScenarioId === 'solar-particle-event') {
          targetRad = sec.id === 'truss-s4' ? 2.24 : sec.id === 'cupola-obs' ? 0.31 : 1.05;
        } else if (this.activeScenarioId === 'co2-scrubber-drift' && sec.id !== 'truss-s4') {
          targetCo2 = 0.78;
        } else if (this.activeScenarioId === 'suit-decompression' && sec.id === 'quest-airlock') {
          targetPress = 58.2;
        }
      }

      const nextRad = sec.radiationMsvH + (targetRad - sec.radiationMsvH) * 0.22;
      const nextCo2 = sec.ppCO2Kpa + (targetCo2 - sec.ppCO2Kpa) * 0.22;
      const nextPress = sec.pressureKpa + (targetPress - sec.pressureKpa) * 0.22;

      const hasReviewHold = occupants.some(
        (c) => c.medicalReport?.clearanceStatus === 'REVIEW_REQUIRED' || c.status === 'advisory'
      );
      const hasCriticalOccupant = occupants.some((c) => c.status === 'critical');

      const status: TelemetrySeverity =
        hasCriticalOccupant || nextRad >= 1.8 || (sec.id === 'quest-airlock' && nextPress < 62)
          ? 'critical'
          : hasReviewHold || nextRad >= 0.9 || nextCo2 >= 0.6
          ? 'advisory'
          : 'nominal';

      return {
        ...sec,
        radiationMsvH: Math.round(nextRad * 100) / 100,
        ppCO2Kpa: Math.round(nextCo2 * 100) / 100,
        pressureKpa: Math.round(nextPress * 10) / 10,
        status,
      };
    });
  }

  getOverallSeverity(): TelemetrySeverity {
    const activeScenario = this.scenarios.find((s) => s.id === this.activeScenarioId);
    if (
      this.crew.some((c) => c.status === 'critical') ||
      activeScenario?.severity === 'critical'
    ) {
      return 'critical';
    }
    if (
      this.crew.some((c) => c.status === 'advisory') ||
      activeScenario?.severity === 'advisory'
    ) {
      return 'advisory';
    }
    return 'nominal';
  }

  getSnapshot(): TelemetrySnapshot {
    return {
      metSeconds: this.metSeconds,
      metFormatted: formatMet(this.metSeconds),
      provenanceMode: this.provenanceMode,
      activeDatasetId: this.activeDatasetId,
      activeScenarioId: this.activeScenarioId,
      isStreaming: this.isStreaming,
      countdownSec: this.countdownSec,
      alertAcknowledged: this.alertAcknowledged,
      overallSeverity: this.getOverallSeverity(),
      crew: this.crew,
      sectors: this.sectors,
      scenarios: this.scenarios,
      logs: this.logs,
      datasets: [...this.uploadedDatasets, ...OSDR_REFERENCE_DATASETS],
    };
  }

  setStreaming(streaming: boolean): TelemetrySnapshot {
    this.isStreaming = streaming;
    return this.getSnapshot();
  }

  setProvenance(mode: ProvenanceMode, datasetId?: string): TelemetrySnapshot {
    const allDatasets = [...this.uploadedDatasets, ...OSDR_REFERENCE_DATASETS];
    if (datasetId && allDatasets.some((d) => d.accessionId === datasetId)) {
      this.activeDatasetId = datasetId;
    }
    if (mode === 'OSDR-FLT') {
      return this.selectScenario('nominal-eva', this.activeCrewId || this.crew[0]?.id);
    }
    this.provenanceMode = 'SIM-RUN';
    return this.getSnapshot();
  }

  selectScenario(id: ContingencyScenarioId, crewId?: string): TelemetrySnapshot {
    const target = this.scenarios.find((s) => s.id === id);
    if (!target) {
      return this.getSnapshot();
    }
    this.activeScenarioId = id;
    this.provenanceMode = id === 'nominal-eva' ? 'OSDR-FLT' : 'SIM-RUN';
    this.countdownSec = target.countdownSec;
    this.alertAcknowledged = false;

    const subject =
      this.crew.find((c) => c.id === crewId) ??
      this.crew.find((c) => c.id === this.activeCrewId) ??
      this.crew[0];
    if (subject) {
      this.activeCrewId = subject.id;
    }

    this.appendLog({
      crewId: subject?.id ?? 'station',
      crewCallsign:
        id === 'solar-particle-event' ? 'ALL CREW' : subject?.callsign ?? 'STATION',
      provenance: this.provenanceMode,
      datasetRef: target.code,
      severity: target.severity,
      parameter: 'SCENARIO',
      reading: target.code,
      message: `${target.name} ${
        id === 'nominal-eva' ? 'restored to medical baseline envelope.' : 'contingency simulation injected.'
      }`,
    });

    return this.getSnapshot();
  }

  acknowledgeAlert(crewId?: string): TelemetrySnapshot {
    const member =
      this.crew.find((c) => c.id === crewId) ??
      this.crew.find((c) => c.id === this.activeCrewId) ??
      this.crew[0];
    const activeScenario =
      this.scenarios.find((s) => s.id === this.activeScenarioId) ?? this.scenarios[0];
    this.alertAcknowledged = true;

    this.appendLog({
      crewId: member?.id ?? 'station',
      crewCallsign: member?.callsign ?? 'STATION',
      provenance: this.provenanceMode,
      datasetRef: this.provenanceMode === 'OSDR-FLT' ? this.activeDatasetId : activeScenario.code,
      severity: this.getOverallSeverity(),
      parameter: 'ALERT ACK',
      reading: 'CLEARED',
      message: `Flight director acknowledged ${activeScenario.code} alert banner.`,
    });

    return this.getSnapshot();
  }

  toggleProtocolStep(scenarioId: ContingencyScenarioId, stepId: string): TelemetrySnapshot {
    this.scenarios = this.scenarios.map((scn) => {
      if (scn.id !== scenarioId) return scn;
      return {
        ...scn,
        steps: scn.steps.map((st) =>
          st.id === stepId ? { ...st, completed: !st.completed } : st
        ),
      };
    });
    return this.getSnapshot();
  }

  toggleHatch(sectorId: string): TelemetrySnapshot {
    const activeScenario =
      this.scenarios.find((s) => s.id === this.activeScenarioId) ?? this.scenarios[0];
    const primary = this.crew.find((c) => c.id === this.activeCrewId) ?? this.crew[0];

    this.sectors = this.sectors.map((sec) => {
      if (sec.id !== sectorId) return sec;
      const nextSealed = !sec.hatchSealed;
      this.appendLog({
        crewId: primary?.id ?? 'station',
        crewCallsign: sec.code,
        provenance: this.provenanceMode,
        datasetRef: this.provenanceMode === 'OSDR-FLT' ? this.activeDatasetId : activeScenario.code,
        severity: nextSealed ? 'advisory' : 'nominal',
        parameter: 'BULKHEAD',
        reading: nextSealed ? 'SEALED' : 'OPEN',
        message: `${sec.name} bulkhead hatch ${
          nextSealed ? 'isolated and pressure-locked' : 'equalized and opened'
        }.`,
      });
      return { ...sec, hatchSealed: nextSealed };
    });
    return this.getSnapshot();
  }

  ingestTelemetry(payload: {
    crewId: string;
    parameter: VitalKey;
    value: number;
    provenance?: ProvenanceMode;
    datasetRef?: string;
  }): TelemetrySnapshot {
    const member = this.crew.find((c) => c.id === payload.crewId);
    if (!member) {
      return this.getSnapshot();
    }
    const metric = member.vitals[payload.parameter];
    if (!metric) {
      return this.getSnapshot();
    }

    const isHabMode = member.medicalReport?.clearanceStatus !== 'CLEARED_EVA';
    const factor = Math.pow(10, metric.decimals);
    const rounded = Math.round(payload.value * factor) / factor;
    const severity = evaluateVitalSeverity(payload.parameter, rounded, isHabMode);

    member.vitals[payload.parameter] = {
      ...metric,
      value: rounded,
      severity,
      history: [...metric.history.slice(1), rounded],
    };

    const vitalSeverities = Object.values(member.vitals).map((v) => v.severity);
    member.status = vitalSeverities.includes('critical')
      ? 'critical'
      : vitalSeverities.includes('advisory') ||
        member.medicalReport?.clearanceStatus === 'REVIEW_REQUIRED'
      ? 'advisory'
      : 'nominal';

    this.appendLog({
      crewId: member.id,
      crewCallsign: member.callsign,
      provenance: payload.provenance ?? this.provenanceMode,
      datasetRef: payload.datasetRef ?? 'LIVE-INGEST',
      severity,
      parameter: metric.shortLabel,
      reading: `${rounded.toFixed(metric.decimals)} ${metric.unit}`,
      message: `Telemetry packet ingested for ${member.name} (${member.callsign}).`,
    });

    return this.getSnapshot();
  }

  private placeCrewInSectors(): void {
    const evaClearedIds = this.crew
      .filter((c) => c.medicalReport?.clearanceStatus === 'CLEARED_EVA')
      .map((c) => c.id);
    const habRestrictedIds = this.crew
      .filter((c) => c.medicalReport?.clearanceStatus !== 'CLEARED_EVA')
      .map((c) => c.id);

    this.sectors = this.sectors.map((sec) => {
      if (sec.id === 'quest-airlock') {
        const hasRestricted = habRestrictedIds.length > 0;
        return {
          ...sec,
          crewIds: evaClearedIds,
          hatchSealed: hasRestricted ? true : sec.hatchSealed,
        };
      }
      if (sec.id === 'columbus-lab') {
        const hasReview = this.crew.some(
          (c) =>
            habRestrictedIds.includes(c.id) &&
            c.medicalReport?.clearanceStatus === 'REVIEW_REQUIRED'
        );
        return {
          ...sec,
          crewIds: habRestrictedIds,
          status: hasReview ? 'advisory' : 'nominal',
        };
      }
      return {
        ...sec,
        crewIds: [],
      };
    });
  }

  private upsertUploadedDataset(member: CrewMember): string {
    const datasetId = `RPT-${member.callsign}`;
    const record: OsdrDatasetRecord = {
      accessionId: datasetId,
      missionName: `${member.name} — ${member.medicalReport?.fileName ?? 'Medical Report'}`,
      cohortSize: 1,
      durationHours: Number((member.evaElapsedSec / 3600 || 1.0).toFixed(1)),
      meanSpo2: member.vitals.spo2.baselineValue,
      meanHr: member.vitals.heartRate.baselineValue,
      meanRadiationMsvH: member.vitals.radiationFlux.baselineValue,
      meanCoreTemp: member.vitals.coreTemp.baselineValue,
      notes: `${member.medicalReport?.issuer ?? 'Flight Medical'} · ${member.medicalReport?.clearanceStatus.replace('_', ' ') ?? 'CLEARED'} · ${member.medicalReport?.summary ?? ''}`,
    };

    const withoutExisting = this.uploadedDatasets.filter((d) => d.accessionId !== datasetId);
    this.uploadedDatasets = [record, ...withoutExisting];
    return datasetId;
  }

  syncMedicalRecords(records: MedicalCalibrationInput[]): TelemetrySnapshot {
    if (records.length === 0) {
      this.crew = [];
      this.activeCrewId = '';
      this.uploadedDatasets = [];
      this.activeDatasetId = 'OSD-542';
      this.sectors = structuredClone(INITIAL_SECTORS);
      this.logs = [];
      return this.getSnapshot();
    }

    const builtMap = new Map<string, CrewMember>();
    records.forEach((rec) => {
      const member = buildCrewMemberFromMedical(rec);
      if (!builtMap.has(member.id)) {
        builtMap.set(member.id, member);
      }
    });

    this.crew = Array.from(builtMap.values());
    this.uploadedDatasets = [];
    // Build datasets in reverse so newest ends up first
    [...this.crew].reverse().forEach((m) => {
      this.upsertUploadedDataset(m);
    });

    const primary = this.crew[0];
    this.activeCrewId = primary.id;
    this.activeDatasetId = `RPT-${primary.callsign}`;
    this.placeCrewInSectors();

    if (this.logs.length === 0) {
      this.appendLog({
        crewId: primary.id,
        crewCallsign: primary.callsign,
        provenance: 'OSDR-FLT',
        datasetRef: this.activeDatasetId,
        severity: primary.status,
        parameter: 'MED REPORT',
        reading: `${primary.vitals.spo2.baselineValue.toFixed(1)}% / ${primary.vitals.heartRate.baselineValue} BPM`,
        message: `Loaded medical report for ${primary.name} (${primary.callsign}) from ${primary.medicalReport?.fileName}.`,
      });
    }

    return this.getSnapshot();
  }

  calibrateFromMedicalRecord(payload: MedicalCalibrationInput): TelemetrySnapshot {
    const member = buildCrewMemberFromMedical(payload);
    const existingIdx = this.crew.findIndex(
      (c) => c.id === member.id || c.callsign === member.callsign
    );
    if (existingIdx >= 0) {
      this.crew[existingIdx] = member;
    } else {
      this.crew = [member, ...this.crew];
    }

    this.activeCrewId = member.id;
    const datasetId = this.upsertUploadedDataset(member);
    this.activeDatasetId = datasetId;
    this.provenanceMode = 'OSDR-FLT';
    this.activeScenarioId = 'nominal-eva';
    this.countdownSec = 0;
    this.placeCrewInSectors();

    this.appendLog({
      crewId: member.id,
      crewCallsign: member.callsign,
      provenance: 'OSDR-FLT',
      datasetRef: datasetId,
      severity: member.status,
      parameter: 'MED CALIB',
      reading: `${member.vitals.spo2.baselineValue.toFixed(1)}% / ${member.vitals.heartRate.baselineValue} BPM`,
      message: `Calibrated Flight Deck, Orbital Matrix, Contingency & Archive for ${member.name} (${member.callsign}) from ${payload.fileName}.`,
    });

    return this.getSnapshot();
  }

  appendLog(entry: Omit<TelemetryLogEntry, 'id' | 'timestampUtc' | 'met'>): void {
    this.logs = [
      {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestampUtc: formatUtcNow(),
        met: formatMet(this.metSeconds),
      },
      ...this.logs.slice(0, 99),
    ];
  }

  exportCsv(): string {
    const headers = [
      'MET',
      'UTC',
      'PROVENANCE',
      'DATASET',
      'CREW',
      'PARAMETER',
      'READING',
      'SEVERITY',
      'MESSAGE',
    ];
    const rows = this.logs.map((l) =>
      [
        l.met,
        l.timestampUtc,
        l.provenance,
        l.datasetRef,
        l.crewCallsign,
        l.parameter,
        l.reading,
        l.severity,
        `"${l.message.replace(/"/g, '""')}"`,
      ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }
}

export const telemetryEngine = new TelemetryEngine();
