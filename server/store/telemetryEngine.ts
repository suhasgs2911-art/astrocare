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
} from '../types.ts';

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

function evaluateVitalSeverity(key: VitalKey, val: number, crewId: string): TelemetrySeverity {
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
    if (crewId === 'hab-03') {
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

const INITIAL_CREW: CrewMember[] = [
  {
    id: 'eva-01',
    callsign: 'EVA-01',
    name: 'Elena Vance',
    role: 'Flight Commander',
    stationLocation: 'Quest Airlock Exterior',
    suitId: 'EMU-409',
    evaElapsedSec: 15129,
    o2ReservePct: 78.4,
    batteryPct: 84.0,
    status: 'nominal',
    vitals: {
      spo2: {
        id: 'spo2',
        label: 'Arterial Oxygen Saturation (SpO2)',
        shortLabel: 'SpO2',
        value: 98.4,
        unit: '%',
        decimals: 1,
        minBound: 94.0,
        maxBound: 100.0,
        baselineValue: 98.5,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [98.6, 98.5, 98.7, 98.4, 98.3, 98.5, 98.4, 98.6, 98.5, 98.4, 98.3, 98.4],
        osdrBaselineHistory: [98.5, 98.5, 98.6, 98.5, 98.4, 98.5, 98.6, 98.5, 98.5, 98.4, 98.5, 98.5],
      },
      heartRate: {
        id: 'heartRate',
        label: 'Cardiac Rate',
        shortLabel: 'HEART RATE',
        value: 74,
        unit: 'BPM',
        decimals: 0,
        minBound: 50,
        maxBound: 135,
        baselineValue: 72,
        severity: 'nominal',
        deltaPerMin: 0.5,
        history: [71, 72, 74, 73, 75, 76, 74, 73, 72, 74, 75, 74],
        osdrBaselineHistory: [70, 71, 72, 72, 71, 72, 73, 72, 71, 72, 72, 72],
      },
      hrv: {
        id: 'hrv',
        label: 'Heart Rate Variability (RMSSD)',
        shortLabel: 'HRV RMSSD',
        value: 46.2,
        unit: 'ms',
        decimals: 1,
        minBound: 22.0,
        maxBound: 85.0,
        baselineValue: 48.0,
        severity: 'nominal',
        deltaPerMin: -0.2,
        history: [48.1, 47.5, 46.9, 47.2, 46.4, 45.8, 46.1, 46.7, 46.3, 46.0, 46.5, 46.2],
        osdrBaselineHistory: [48.0, 48.2, 47.9, 48.1, 48.0, 47.8, 48.1, 48.0, 47.9, 48.1, 48.0, 48.0],
      },
      radiationFlux: {
        id: 'radiationFlux',
        label: 'Dosimetry Radiation Flux',
        shortLabel: 'RAD FLUX',
        value: 0.42,
        unit: 'mSv/h',
        decimals: 2,
        minBound: 0.0,
        maxBound: 2.5,
        baselineValue: 0.39,
        severity: 'nominal',
        deltaPerMin: 0.01,
        history: [0.38, 0.39, 0.4, 0.41, 0.39, 0.41, 0.42, 0.43, 0.41, 0.42, 0.42, 0.42],
        osdrBaselineHistory: [0.38, 0.38, 0.39, 0.39, 0.4, 0.39, 0.39, 0.38, 0.39, 0.39, 0.39, 0.39],
      },
      coreTemp: {
        id: 'coreTemp',
        label: 'Core Body Temperature',
        shortLabel: 'CORE TEMP',
        value: 37.1,
        unit: '°C',
        decimals: 1,
        minBound: 35.8,
        maxBound: 38.4,
        baselineValue: 37.0,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [37.0, 37.0, 37.1, 37.1, 37.1, 37.2, 37.1, 37.1, 37.1, 37.1, 37.1, 37.1],
        osdrBaselineHistory: [37.0, 37.0, 37.0, 37.0, 37.0, 37.1, 37.0, 37.0, 37.0, 37.0, 37.0, 37.0],
      },
      suitPressure: {
        id: 'suitPressure',
        label: 'EMU Suit Loop Pressure',
        shortLabel: 'SUIT PRESS',
        value: 29.6,
        unit: 'kPa',
        decimals: 1,
        minBound: 26.5,
        maxBound: 31.5,
        baselineValue: 29.6,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [29.6, 29.6, 29.7, 29.6, 29.6, 29.5, 29.6, 29.6, 29.6, 29.7, 29.6, 29.6],
        osdrBaselineHistory: [29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6],
      },
      ppCO2: {
        id: 'ppCO2',
        label: 'Inspired Partial Pressure CO2',
        shortLabel: 'ppCO2',
        value: 0.34,
        unit: 'kPa',
        decimals: 2,
        minBound: 0.0,
        maxBound: 0.85,
        baselineValue: 0.32,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [0.31, 0.32, 0.33, 0.32, 0.33, 0.34, 0.34, 0.33, 0.34, 0.35, 0.34, 0.34],
        osdrBaselineHistory: [0.31, 0.32, 0.32, 0.32, 0.32, 0.32, 0.32, 0.33, 0.32, 0.32, 0.32, 0.32],
      },
    },
  },
  {
    id: 'eva-02',
    callsign: 'EVA-02',
    name: 'Marcus Chen',
    role: 'Flight Engineer',
    stationLocation: 'Truss Segment S4',
    suitId: 'EMU-412',
    evaElapsedSec: 15129,
    o2ReservePct: 74.1,
    batteryPct: 79.5,
    status: 'nominal',
    vitals: {
      spo2: {
        id: 'spo2',
        label: 'Arterial Oxygen Saturation (SpO2)',
        shortLabel: 'SpO2',
        value: 97.9,
        unit: '%',
        decimals: 1,
        minBound: 94.0,
        maxBound: 100.0,
        baselineValue: 98.1,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [98.1, 98.0, 97.9, 98.0, 97.8, 97.9, 98.0, 97.9, 97.8, 97.9, 98.0, 97.9],
        osdrBaselineHistory: [98.2, 98.1, 98.1, 98.2, 98.1, 98.0, 98.1, 98.1, 98.1, 98.1, 98.1, 98.1],
      },
      heartRate: {
        id: 'heartRate',
        label: 'Cardiac Rate',
        shortLabel: 'HEART RATE',
        value: 88,
        unit: 'BPM',
        decimals: 0,
        minBound: 50,
        maxBound: 135,
        baselineValue: 84,
        severity: 'nominal',
        deltaPerMin: 1.0,
        history: [82, 84, 85, 87, 86, 89, 90, 88, 87, 88, 89, 88],
        osdrBaselineHistory: [80, 82, 83, 84, 83, 84, 85, 84, 83, 84, 84, 84],
      },
      hrv: {
        id: 'hrv',
        label: 'Heart Rate Variability (RMSSD)',
        shortLabel: 'HRV RMSSD',
        value: 39.4,
        unit: 'ms',
        decimals: 1,
        minBound: 22.0,
        maxBound: 85.0,
        baselineValue: 41.0,
        severity: 'nominal',
        deltaPerMin: -0.3,
        history: [41.5, 41.0, 40.2, 39.8, 40.1, 39.5, 39.2, 39.7, 39.6, 39.3, 39.5, 39.4],
        osdrBaselineHistory: [41.2, 41.0, 41.1, 40.9, 41.0, 41.2, 41.0, 40.9, 41.1, 41.0, 41.0, 41.0],
      },
      radiationFlux: {
        id: 'radiationFlux',
        label: 'Dosimetry Radiation Flux',
        shortLabel: 'RAD FLUX',
        value: 0.45,
        unit: 'mSv/h',
        decimals: 2,
        minBound: 0.0,
        maxBound: 2.5,
        baselineValue: 0.41,
        severity: 'nominal',
        deltaPerMin: 0.01,
        history: [0.4, 0.41, 0.42, 0.43, 0.44, 0.43, 0.44, 0.45, 0.44, 0.45, 0.46, 0.45],
        osdrBaselineHistory: [0.4, 0.41, 0.41, 0.41, 0.42, 0.41, 0.41, 0.41, 0.41, 0.41, 0.41, 0.41],
      },
      coreTemp: {
        id: 'coreTemp',
        label: 'Core Body Temperature',
        shortLabel: 'CORE TEMP',
        value: 37.4,
        unit: '°C',
        decimals: 1,
        minBound: 35.8,
        maxBound: 38.4,
        baselineValue: 37.2,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [37.2, 37.2, 37.3, 37.3, 37.3, 37.4, 37.4, 37.4, 37.4, 37.4, 37.4, 37.4],
        osdrBaselineHistory: [37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2],
      },
      suitPressure: {
        id: 'suitPressure',
        label: 'EMU Suit Loop Pressure',
        shortLabel: 'SUIT PRESS',
        value: 29.5,
        unit: 'kPa',
        decimals: 1,
        minBound: 26.5,
        maxBound: 31.5,
        baselineValue: 29.6,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [29.6, 29.6, 29.5, 29.5, 29.6, 29.5, 29.5, 29.5, 29.6, 29.5, 29.5, 29.5],
        osdrBaselineHistory: [29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6, 29.6],
      },
      ppCO2: {
        id: 'ppCO2',
        label: 'Inspired Partial Pressure CO2',
        shortLabel: 'ppCO2',
        value: 0.39,
        unit: 'kPa',
        decimals: 2,
        minBound: 0.0,
        maxBound: 0.85,
        baselineValue: 0.36,
        severity: 'nominal',
        deltaPerMin: 0.01,
        history: [0.35, 0.36, 0.37, 0.37, 0.38, 0.38, 0.39, 0.38, 0.39, 0.39, 0.39, 0.39],
        osdrBaselineHistory: [0.35, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36],
      },
    },
  },
  {
    id: 'hab-03',
    callsign: 'HAB-03',
    name: 'Dr. Priya Nair',
    role: 'Medical Officer',
    stationLocation: 'Columbus BioLab',
    suitId: 'IV-IVA-03',
    evaElapsedSec: 0,
    o2ReservePct: 96.2,
    batteryPct: 98.0,
    status: 'nominal',
    vitals: {
      spo2: {
        id: 'spo2',
        label: 'Arterial Oxygen Saturation (SpO2)',
        shortLabel: 'SpO2',
        value: 99.1,
        unit: '%',
        decimals: 1,
        minBound: 94.0,
        maxBound: 100.0,
        baselineValue: 99.0,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [99.0, 99.1, 99.0, 99.2, 99.1, 99.0, 99.1, 99.1, 99.2, 99.1, 99.0, 99.1],
        osdrBaselineHistory: [99.0, 99.0, 99.1, 99.0, 99.0, 99.0, 99.1, 99.0, 99.0, 99.0, 99.0, 99.0],
      },
      heartRate: {
        id: 'heartRate',
        label: 'Cardiac Rate',
        shortLabel: 'HEART RATE',
        value: 64,
        unit: 'BPM',
        decimals: 0,
        minBound: 50,
        maxBound: 135,
        baselineValue: 65,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [65, 64, 65, 63, 64, 65, 64, 63, 64, 64, 65, 64],
        osdrBaselineHistory: [65, 65, 64, 65, 65, 64, 65, 65, 65, 64, 65, 65],
      },
      hrv: {
        id: 'hrv',
        label: 'Heart Rate Variability (RMSSD)',
        shortLabel: 'HRV RMSSD',
        value: 58.6,
        unit: 'ms',
        decimals: 1,
        minBound: 22.0,
        maxBound: 85.0,
        baselineValue: 57.5,
        severity: 'nominal',
        deltaPerMin: 0.1,
        history: [57.2, 57.8, 58.0, 58.3, 58.1, 58.5, 58.7, 58.4, 58.6, 58.8, 58.5, 58.6],
        osdrBaselineHistory: [57.5, 57.6, 57.5, 57.4, 57.5, 57.6, 57.5, 57.5, 57.4, 57.5, 57.6, 57.5],
      },
      radiationFlux: {
        id: 'radiationFlux',
        label: 'Dosimetry Radiation Flux',
        shortLabel: 'RAD FLUX',
        value: 0.21,
        unit: 'mSv/h',
        decimals: 2,
        minBound: 0.0,
        maxBound: 2.5,
        baselineValue: 0.21,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [0.21, 0.2, 0.21, 0.22, 0.21, 0.21, 0.2, 0.21, 0.21, 0.22, 0.21, 0.21],
        osdrBaselineHistory: [0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21],
      },
      coreTemp: {
        id: 'coreTemp',
        label: 'Core Body Temperature',
        shortLabel: 'CORE TEMP',
        value: 36.8,
        unit: '°C',
        decimals: 1,
        minBound: 35.8,
        maxBound: 38.4,
        baselineValue: 36.8,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [36.8, 36.8, 36.8, 36.9, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8],
        osdrBaselineHistory: [36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8, 36.8],
      },
      suitPressure: {
        id: 'suitPressure',
        label: 'Module Cabin Pressure',
        shortLabel: 'CABIN PRESS',
        value: 101.2,
        unit: 'kPa',
        decimals: 1,
        minBound: 95.0,
        maxBound: 103.5,
        baselineValue: 101.3,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [101.3, 101.3, 101.2, 101.3, 101.2, 101.2, 101.3, 101.2, 101.2, 101.2, 101.3, 101.2],
        osdrBaselineHistory: [101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3, 101.3],
      },
      ppCO2: {
        id: 'ppCO2',
        label: 'Module Partial Pressure CO2',
        shortLabel: 'ppCO2',
        value: 0.28,
        unit: 'kPa',
        decimals: 2,
        minBound: 0.0,
        maxBound: 0.85,
        baselineValue: 0.28,
        severity: 'nominal',
        deltaPerMin: 0.0,
        history: [0.27, 0.28, 0.28, 0.29, 0.28, 0.28, 0.28, 0.27, 0.28, 0.28, 0.28, 0.28],
        osdrBaselineHistory: [0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28],
      },
    },
  },
];

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
    crewIds: ['eva-01'],
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
    crewIds: ['hab-03'],
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
    crewIds: ['eva-02'],
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
    summary: 'Standard low-Earth orbit extravehicular activity within physiological envelope.',
    triggerAlertTitle: 'ALL TELEMETRY CHANNELS NOMINAL',
    countdownSec: 0,
    steps: [
      {
        id: 'nom-1',
        code: 'CHK-01',
        title: 'Verify EMU Primary O2 Loop',
        instruction: 'Confirm suit regulator holding steady at 29.6 kPa with zero leak delta.',
        targetSystem: 'EMU-409 / LSS',
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
    summary: 'Rapid EMU pressure decay (-0.9 kPa/min) with secondary arterial SpO2 desaturation.',
    triggerAlertTitle: 'CRITICAL: SUIT PRESSURE DECAY & HYPOXIA WARNING (EVA-01)',
    countdownSec: 180,
    steps: [
      {
        id: 'dec-1',
        code: 'EMG-01',
        title: 'Engage Secondary Oxygen Pack (SOP)',
        instruction: 'Actuate SOP valve on left DCM to arrest suit pressure decay at 23.4 kPa floor.',
        targetSystem: 'EMU-409 SOP',
        durationSec: 15,
        completed: false,
        critical: true,
      },
      {
        id: 'dec-2',
        code: 'EMG-02',
        title: 'Terminate Truss Task & Translate to Quest',
        instruction: 'EVA-02 assists EVA-01 along safety tether vector back to Quest Airlock.',
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
        instruction: 'HAB-03 prepares 100% O2 mask and neurological decompression screen.',
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
        instruction: 'Recall EVA-01 and EVA-02 immediately into shielded habitat volume.',
        targetSystem: 'EVA CREW',
        durationSec: 60,
        completed: false,
        critical: true,
      },
      {
        id: 'spe-2',
        code: 'RAD-02',
        title: 'Relocate Crew to Water-Wall Storm Shelter',
        instruction: 'Move all crew to SEC-05 Cupola/Zvezda high-density polyethylene barrier.',
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
        title: 'Monitor Crew Cognitive & HRV Baseline',
        instruction: 'Log 5-minute RMSSD recovery trend to verify normocapnic stabilization.',
        targetSystem: 'BIO-TELEM',
        durationSec: 60,
        completed: false,
        critical: false,
      },
    ],
  },
];

const OSDR_DATASETS: OsdrDatasetRecord[] = [
  {
    accessionId: 'OSD-542',
    missionName: 'Inspiration4 Orbital Biomedical Baseline',
    cohortSize: 4,
    durationHours: 71.2,
    meanSpo2: 98.4,
    meanHr: 71.8,
    meanRadiationMsvH: 0.36,
    meanCoreTemp: 37.0,
    notes: 'Validated continuous wearable SpO2, ECG HRV, and ambient radiation dosimetry across 3-day orbital flight.',
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
    notes: 'EMU suit pressure stability (29.6 kPa), LCVG thermal loop exchange, and ppCO2 scrubbing kinetics.',
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
    notes: 'Controlled station-board elevated ppCO2 (0.55–0.75 kPa) effects on RMSSD and cerebral perfusion.',
  },
];

const INITIAL_LOGS: TelemetryLogEntry[] = [
  {
    id: 'log-01',
    timestampUtc: '22:48:10 UTC',
    met: 'T+04:11:10',
    crewId: 'eva-01',
    crewCallsign: 'EVA-01',
    provenance: 'OSDR-FLT',
    datasetRef: 'OSD-318',
    severity: 'nominal',
    parameter: 'SUIT PRESS',
    reading: '29.6 kPa',
    message: 'Primary oxygen regulator stabilized within 0.1 kPa of OSD-318 reference band.',
  },
  {
    id: 'log-02',
    timestampUtc: '22:49:04 UTC',
    met: 'T+04:12:04',
    crewId: 'eva-02',
    crewCallsign: 'EVA-02',
    provenance: 'OSDR-FLT',
    datasetRef: 'OSD-318',
    severity: 'nominal',
    parameter: 'HEART RATE',
    reading: '88 BPM',
    message: 'Truss S4 torque task load elevated cardiac output; HRV RMSSD nominal at 39.4 ms.',
  },
  {
    id: 'log-03',
    timestampUtc: '22:49:42 UTC',
    met: 'T+04:12:42',
    crewId: 'hab-03',
    crewCallsign: 'HAB-03',
    provenance: 'OSDR-FLT',
    datasetRef: 'OSD-542',
    severity: 'nominal',
    parameter: 'RAD FLUX',
    reading: '0.21 mSv/h',
    message: 'Columbus BioLab hull attenuation nominal during South Atlantic Anomaly transit.',
  },
  {
    id: 'log-04',
    timestampUtc: '22:50:15 UTC',
    met: 'T+04:13:15',
    crewId: 'eva-01',
    crewCallsign: 'EVA-01',
    provenance: 'OSDR-FLT',
    datasetRef: 'OSD-542',
    severity: 'nominal',
    parameter: 'SpO2',
    reading: '98.4 %',
    message: 'Optical pulse oximetry lock verified; 99.8% packet integrity over Ku-band link.',
  },
];

class TelemetryEngine {
  private metSeconds = 15195;
  private provenanceMode: ProvenanceMode = 'OSDR-FLT';
  private activeDatasetId = 'OSD-318';
  private activeScenarioId: ContingencyScenarioId = 'nominal-eva';
  private isStreaming = true;
  private countdownSec = 0;
  private alertAcknowledged = false;
  private crew: CrewMember[] = structuredClone(INITIAL_CREW);
  private sectors: HabitatSector[] = structuredClone(INITIAL_SECTORS);
  private scenarios: ContingencyScenario[] = structuredClone(INITIAL_SCENARIOS);
  private logs: TelemetryLogEntry[] = structuredClone(INITIAL_LOGS);
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

    this.crew = this.crew.map((member) => {
      const updatedVitals = { ...member.vitals };

      (Object.keys(updatedVitals) as VitalKey[]).forEach((key) => {
        const metric = updatedVitals[key];
        const baseline = metric.baselineValue;
        let target = baseline;
        let jitter = (Math.random() - 0.5) * (key === 'heartRate' ? 2.2 : 0.14);

        if (this.provenanceMode === 'SIM-RUN') {
          if (this.activeScenarioId === 'suit-decompression' && member.id === 'eva-01') {
            if (key === 'suitPressure') target = 23.6;
            if (key === 'spo2') target = 90.4;
            if (key === 'heartRate') target = 148;
            if (key === 'hrv') target = 18.5;
          } else if (this.activeScenarioId === 'solar-particle-event') {
            if (key === 'radiationFlux') {
              target = member.id === 'hab-03' ? 0.68 : 2.24;
              jitter = (Math.random() - 0.5) * 0.18;
            }
            if (key === 'heartRate') target = member.id === 'hab-03' ? 74 : 112;
          } else if (this.activeScenarioId === 'co2-scrubber-drift') {
            if (key === 'ppCO2') target = 0.78;
            if (key === 'heartRate') target = baseline + 18;
            if (key === 'hrv') target = 24.5;
          }
        }

        const stepFactor = this.provenanceMode === 'SIM-RUN' ? 0.22 : 0.35;
        const nextRaw = metric.value + (target - metric.value) * stepFactor + jitter;
        const factor = Math.pow(10, metric.decimals);
        const nextVal = Math.round(nextRaw * factor) / factor;
        const delta = Math.round((nextVal - metric.value) * 6 * factor) / factor;
        const severity = evaluateVitalSeverity(key, nextVal, member.id);

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
        : vitalSeverities.includes('advisory')
        ? 'advisory'
        : 'nominal';

      const o2Burn =
        this.activeScenarioId === 'suit-decompression' &&
        member.id === 'eva-01' &&
        this.provenanceMode === 'SIM-RUN'
          ? 0.14
          : 0.01;

      return {
        ...member,
        evaElapsedSec: member.id === 'hab-03' ? 0 : member.evaElapsedSec + 1,
        o2ReservePct: Math.max(12, member.o2ReservePct - o2Burn),
        status: nextStatus,
        vitals: updatedVitals,
      };
    });

    this.sectors = this.sectors.map((sec) => {
      let targetRad =
        sec.id === 'truss-s4'
          ? 0.45
          : sec.id === 'quest-airlock'
          ? 0.38
          : sec.id === 'cupola-obs'
          ? 0.14
          : 0.22;
      let targetCo2 = sec.id === 'truss-s4' ? 0 : 0.28;
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

      const status: TelemetrySeverity =
        nextRad >= 1.8 || (sec.id === 'quest-airlock' && nextPress < 62)
          ? 'critical'
          : nextRad >= 0.9 || nextCo2 >= 0.6
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
      datasets: OSDR_DATASETS,
    };
  }

  setStreaming(streaming: boolean): TelemetrySnapshot {
    this.isStreaming = streaming;
    return this.getSnapshot();
  }

  setProvenance(mode: ProvenanceMode, datasetId?: string): TelemetrySnapshot {
    if (datasetId && OSDR_DATASETS.some((d) => d.accessionId === datasetId)) {
      this.activeDatasetId = datasetId;
    }
    if (mode === 'OSDR-FLT') {
      return this.selectScenario('nominal-eva', 'eva-01');
    }
    this.provenanceMode = 'SIM-RUN';
    return this.getSnapshot();
  }

  selectScenario(id: ContingencyScenarioId, crewId = 'eva-01'): TelemetrySnapshot {
    const target = this.scenarios.find((s) => s.id === id);
    if (!target) {
      return this.getSnapshot();
    }
    this.activeScenarioId = id;
    this.provenanceMode = id === 'nominal-eva' ? 'OSDR-FLT' : 'SIM-RUN';
    this.countdownSec = target.countdownSec;
    this.alertAcknowledged = false;

    this.appendLog({
      crewId,
      crewCallsign: id === 'solar-particle-event' ? 'ALL CREW' : 'EVA-01',
      provenance: this.provenanceMode,
      datasetRef: target.code,
      severity: target.severity,
      parameter: 'SCENARIO',
      reading: target.code,
      message: `${target.name} ${
        id === 'nominal-eva' ? 'restored to baseline envelope.' : 'contingency simulation injected.'
      }`,
    });

    return this.getSnapshot();
  }

  acknowledgeAlert(crewId: string): TelemetrySnapshot {
    const member = this.crew.find((c) => c.id === crewId) ?? this.crew[0];
    const activeScenario = this.scenarios.find((s) => s.id === this.activeScenarioId) ?? this.scenarios[0];
    this.alertAcknowledged = true;

    this.appendLog({
      crewId: member.id,
      crewCallsign: member.callsign,
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
    const activeScenario = this.scenarios.find((s) => s.id === this.activeScenarioId) ?? this.scenarios[0];
    this.sectors = this.sectors.map((sec) => {
      if (sec.id !== sectorId) return sec;
      const nextSealed = !sec.hatchSealed;
      this.appendLog({
        crewId: 'hab-03',
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

    const factor = Math.pow(10, metric.decimals);
    const rounded = Math.round(payload.value * factor) / factor;
    const severity = evaluateVitalSeverity(payload.parameter, rounded, member.id);

    member.vitals[payload.parameter] = {
      ...metric,
      value: rounded,
      severity,
      history: [...metric.history.slice(1), rounded],
    };

    const vitalSeverities = Object.values(member.vitals).map((v) => v.severity);
    member.status = vitalSeverities.includes('critical')
      ? 'critical'
      : vitalSeverities.includes('advisory')
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
      message: `External telemetry packet ingested for ${member.callsign} (${metric.shortLabel}).`,
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
