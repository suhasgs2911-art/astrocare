import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  FileCheck2,
  LogOut,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CONTINGENCY_SCENARIOS,
  INITIAL_CREW,
  INITIAL_LOGS,
  INITIAL_SECTORS,
  OSDR_ARCHIVE_DATASETS,
} from './data/telemetryData';
import {
  ClearanceStatus,
  ContingencyScenario,
  ContingencyScenarioId,
  CrewMember,
  HabitatSector,
  MedicalRecordCategory,
  MedicalRecordItem,
  OsdrDatasetRecord,
  ProvenanceMode,
  ScreenId,
  TelemetryLogEntry,
  TelemetrySeverity,
  VitalMetric,
} from './types/telemetry';
import { TopNav } from './components/TopNav';
import { EmergencyBanner } from './components/EmergencyBanner';
import { TelemetryCard } from './components/TelemetryCard';
import { LiveWaveformChart } from './components/LiveWaveformChart';
import { OrbitalMatrixScreen } from './components/OrbitalMatrixScreen';
import { ContingencyScreen } from './components/ContingencyScreen';
import { ArchiveScreen, type OperatorAuditRecord } from './components/ArchiveScreen';
import {
  extractSubjectFromSummary,
  MedicalRecordsScreen,
  type MedicalUploadPayload,
} from './components/MedicalRecordsScreen';
import { SignInScreen } from './components/SignInScreen';
import { IntroSplashScreen } from './components/IntroSplashScreen';
import { ProvenanceBadge, StatusPill } from './components/ProvenanceAndStatus';
import { playCriticalBeep } from './utils/audioAlert';
import { authorizedFetch } from './utils/authorizedFetch';

type VitalKey = keyof CrewMember['vitals'];

interface TelemetrySnapshotResponse {
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

interface OperatorProfile {
  callsign: string;
  roleTitle: string;
  displayName: string;
}

function formatMet(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `T+${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function sanitizeCallsign(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  return cleaned.length >= 2 ? cleaned : 'FD-01';
}

function recordToCalibrationInput(rec: MedicalRecordItem) {
  const { subjectName, subjectRole } = extractSubjectFromSummary(
    rec.parsedSummary,
    rec.crewCallsign
  );
  const tempMatch = rec.parsedSummary.match(/(?:Core Temp|Temp)\s+(\d{2}(?:\.\d+)?)/i);
  const radMatch = rec.parsedSummary.match(/(?:Rad Flux|Rad)\s+(\d+(?:\.\d+)?)/i);
  const hrvMatch = rec.parsedSummary.match(/HRV\s+(\d{1,3}(?:\.\d+)?)/i);
  const pressMatch = rec.parsedSummary.match(/Press\s+(\d{2,3}(?:\.\d+)?)/i);
  const co2Match = rec.parsedSummary.match(/ppCO2\s+(\d+(?:\.\d+)?)/i);
  const o2Match = rec.parsedSummary.match(/O2\s+(\d{2,3}(?:\.\d+)?)/i);

  return {
    crewCallsign: rec.crewCallsign,
    subjectName,
    subjectRole,
    fileName: rec.fileName,
    issuer: rec.issuer,
    recordCategory: rec.recordCategory,
    clearanceStatus: rec.clearanceStatus,
    baselineSpo2: rec.baselineSpo2,
    baselineHr: rec.baselineHr,
    baselineCoreTemp: tempMatch ? Number(tempMatch[1]) : undefined,
    baselineRadFlux: radMatch ? Number(radMatch[1]) : undefined,
    baselineHrv: hrvMatch ? Number(hrvMatch[1]) : undefined,
    baselineSuitPressure: pressMatch ? Number(pressMatch[1]) : undefined,
    baselinePpCO2: co2Match ? Number(co2Match[1]) : undefined,
    baselineO2Reserve: o2Match ? Number(o2Match[1]) : undefined,
    parsedSummary: rec.parsedSummary,
  };
}

export default function App() {
  // 4-second intro logo animation state prior to login process
  const [introComplete, setIntroComplete] = useState(false);
  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

  // Firebase Authentication & Operator Profile state
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>({
    callsign: 'FD-01',
    roleTitle: 'Flight Director',
    displayName: 'Flight Operator',
  });
  const [operatorActions, setOperatorActions] = useState<OperatorAuditRecord[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecordItem[]>([]);
  const [activeMedicalRecordId, setActiveMedicalRecordId] = useState<string | null>(null);
  const calibratedOnceRef = useRef(false);
  const pendingRoleRef = useRef<{ role: string; callsign: string }>({
    role: 'Flight Director',
    callsign: 'FD-01',
  });

  // Telemetry HUD state (Med Records is placed first after sign-in)
  const [activeScreen, setActiveScreen] = useState<ScreenId>('med-records');
  const [provenanceMode, setProvenanceMode] = useState<ProvenanceMode>('OSDR-FLT');
  const [activeDatasetId, setActiveDatasetId] = useState<string>('OSD-542');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');
  const [selectedVitalKey, setSelectedVitalKey] = useState<VitalKey>('spo2');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [showOsdrOverlay, setShowOsdrOverlay] = useState<boolean>(true);
  const [metSeconds, setMetSeconds] = useState<number>(15195);

  const [crew, setCrew] = useState<CrewMember[]>(INITIAL_CREW);
  const [sectors, setSectors] = useState<HabitatSector[]>(INITIAL_SECTORS);
  const [scenarios, setScenarios] = useState<ContingencyScenario[]>(CONTINGENCY_SCENARIOS);
  const [datasets, setDatasets] = useState<OsdrDatasetRecord[]>(OSDR_ARCHIVE_DATASETS);
  const [activeScenarioId, setActiveScenarioId] = useState<ContingencyScenarioId>('nominal-eva');
  const [logs, setLogs] = useState<TelemetryLogEntry[]>(INITIAL_LOGS);

  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [alertAcknowledged, setAlertAcknowledged] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);

  const applySnapshot = useCallback((snap: TelemetrySnapshotResponse) => {
    setMetSeconds(snap.metSeconds);
    setProvenanceMode(snap.provenanceMode);
    setActiveDatasetId(snap.activeDatasetId);
    setActiveScenarioId(snap.activeScenarioId);
    setIsStreaming(snap.isStreaming);
    setCountdownSec(snap.countdownSec);
    setAlertAcknowledged(snap.alertAcknowledged);
    setCrew(snap.crew);
    setSectors(snap.sectors);
    setScenarios(snap.scenarios);
    setLogs(snap.logs);
    if (snap.datasets) {
      setDatasets(snap.datasets);
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const res = await authorizedFetch('/api/telemetry/state');
      if (!res.ok) return;
      const snap = (await res.json()) as TelemetrySnapshotResponse;
      applySnapshot(snap);
    } catch {
      // Retain last valid telemetry frame if transient network drop occurs
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    void fetchState();
    const poll = window.setInterval(() => {
      void fetchState();
    }, 1200);
    return () => window.clearInterval(poll);
  }, [authReady, currentUser, fetchState]);

  // Listen to Firebase Auth state & hydrate split public/private operator records
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);

      if (!user) {
        setOperatorActions([]);
        setMedicalRecords([]);
        setActiveMedicalRecordId(null);
        setSelectedCrewId('');
        setCrew(INITIAL_CREW);
        setSectors(INITIAL_SECTORS);
        setScenarios(CONTINGENCY_SCENARIOS);
        setLogs(INITIAL_LOGS);
        setDatasets(OSDR_ARCHIVE_DATASETS);
        calibratedOnceRef.current = false;
        setActiveScreen('med-records');
        return;
      }

      const publicPath = `users/${user.uid}/public/profile`;
      const privatePath = `users/${user.uid}/private/info`;

      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'public', 'profile'));
        const safeDisplay = (user.displayName || 'Flight Operator').trim().slice(0, 80) || 'Flight Operator';
        const safeCallsign = sanitizeCallsign(pendingRoleRef.current.callsign);
        const safeRole = pendingRoleRef.current.role.trim().slice(0, 64) || 'Flight Director';

        if (snap.exists()) {
          const data = snap.data();
          setOperatorProfile({
            callsign: String(data.callsign || safeCallsign),
            roleTitle: String(data.roleTitle || safeRole),
            displayName: String(data.displayName || safeDisplay),
          });
        } else {
          await setDoc(doc(db, 'users', user.uid, 'public', 'profile'), {
            uid: user.uid,
            displayName: safeDisplay,
            callsign: safeCallsign,
            roleTitle: safeRole,
            updatedAt: serverTimestamp(),
          });
          setOperatorProfile({
            callsign: safeCallsign,
            roleTitle: safeRole,
            displayName: safeDisplay,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, publicPath);
      }

      if (user.email && user.emailVerified) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
            uid: user.uid,
            email: user.email.slice(0, 160),
            clearedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, privatePath);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach Firestore real-time listener ONLY when authenticated
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const actionsPath = `users/${currentUser.uid}/telemetryActions`;
    const q = query(
      collection(db, 'users', currentUser.uid, 'telemetryActions'),
      where('ownerUid', '==', currentUser.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsWithTs = snapshot.docs.map((d) => {
          const data = d.data();
          const ts = (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
          return {
            ts,
            item: {
              id: String(data.id || d.id),
              callsign: String(data.callsign || operatorProfile.callsign),
              actionType: String(data.actionType || 'SCENARIO'),
              targetRef: String(data.targetRef || '-'),
              metFormatted: String(data.metFormatted || formatMet(metSeconds)),
              summary: String(data.summary || ''),
            } satisfies OperatorAuditRecord,
          };
        });
        docsWithTs.sort((a, b) => b.ts - a.ts);
        setOperatorActions(docsWithTs.slice(0, 25).map((entry) => entry.item));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, actionsPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser, operatorProfile.callsign]);

  // Attach Firestore real-time listener for uploaded Medical Records & Certificates
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const medPath = `users/${currentUser.uid}/medicalRecords`;
    const q = query(
      collection(db, 'users', currentUser.uid, 'medicalRecords'),
      where('ownerUid', '==', currentUser.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsWithTs = snapshot.docs.map((d) => {
          const data = d.data();
          const createdTs = data.createdAt as { toDate?: () => Date; toMillis?: () => number } | undefined;
          const ts = createdTs?.toMillis?.() ?? 0;
          const createdLabel = createdTs?.toDate
            ? createdTs.toDate().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
            : 'Just now';

          return {
            ts,
            item: {
              id: String(data.id || d.id),
              ownerUid: String(data.ownerUid || currentUser.uid),
              crewCallsign: String(data.crewCallsign || 'SUBJ-01'),
              recordCategory: (data.recordCategory === 'CERTIFICATE'
                ? 'CERTIFICATE'
                : 'MEDICAL_STATS') as MedicalRecordCategory,
              fileName: String(data.fileName || 'record'),
              mimeType: String(data.mimeType || 'application/octet-stream'),
              fileSizeBytes: Number(data.fileSizeBytes || 0),
              serverFileId: String(data.serverFileId || ''),
              issuer: String(data.issuer || 'Flight Medical'),
              clearanceStatus: (data.clearanceStatus || 'CLEARED_EVA') as ClearanceStatus,
              parsedSummary: String(data.parsedSummary || ''),
              baselineSpo2: Number(data.baselineSpo2 ?? 98.4),
              baselineHr: Number(data.baselineHr ?? 72),
              createdAtLabel: createdLabel,
            } satisfies MedicalRecordItem,
          };
        });
        docsWithTs.sort((a, b) => b.ts - a.ts);
        const items = docsWithTs.map((entry) => entry.item);
        setMedicalRecords(items);

        if (items.length === 0) {
          setActiveMedicalRecordId(null);
          setSelectedCrewId('');
          calibratedOnceRef.current = false;
          setActiveScreen('med-records');
          void authorizedFetch('/api/telemetry/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [] }),
          })
            .then(async (res) => {
              if (res.ok) applySnapshot((await res.json()) as TelemetrySnapshotResponse);
            })
            .catch(() => {});
        } else {
          const syncInputs = items.map(recordToCalibrationInput);
          const shouldAutoSelect = !calibratedOnceRef.current;
          calibratedOnceRef.current = true;
          if (shouldAutoSelect) {
            setActiveMedicalRecordId(items[0].id);
          }

          void authorizedFetch('/api/telemetry/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: syncInputs }),
          })
            .then(async (res) => {
              if (!res.ok) return;
              const snap = (await res.json()) as TelemetrySnapshotResponse;
              applySnapshot(snap);
              if (shouldAutoSelect && snap.crew[0]) {
                setSelectedCrewId(snap.crew[0].id);
              }
            })
            .catch(() => {
              // Next poll reconciles state
            });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, medPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser, applySnapshot]);

  const recordOperatorAction = useCallback(
    async (
      actionType: 'SCENARIO' | 'ALERT_ACK' | 'BULKHEAD' | 'PROTOCOL_STEP' | 'PROVENANCE',
      targetRef: string,
      summary: string
    ) => {
      if (!currentUser || !currentUser.emailVerified) return;
      const actionId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const actionPath = `users/${currentUser.uid}/telemetryActions/${actionId}`;
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'telemetryActions', actionId), {
          id: actionId,
          ownerUid: currentUser.uid,
          callsign: sanitizeCallsign(operatorProfile.callsign),
          actionType,
          targetRef: targetRef.slice(0, 64),
          metFormatted: formatMet(metSeconds),
          summary: summary.slice(0, 240),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, actionPath);
      }
    },
    [currentUser, operatorProfile.callsign, metSeconds]
  );

  const handleGoogleSignIn = async (selectedRole: string, selectedCallsign: string) => {
    setAuthError(null);
    pendingRoleRef.current = {
      role: selectedRole,
      callsign: selectedCallsign,
    };
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to complete Google sign-in popup.';
      setAuthError(message);
    }
  };

  const handleSignOut = async () => {
    try {
      if (auth.currentUser) {
        await authorizedFetch('/api/telemetry/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: [] }),
        }).catch(() => {});
      }
      await signOut(auth);
      setActiveMedicalRecordId(null);
      calibratedOnceRef.current = false;
      setActiveScreen('med-records');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-out failed.');
    }
  };

  const calibrateTelemetryFromRecord = useCallback(
    async (params: {
      recordId: string;
      crewCallsign: string;
      subjectName?: string;
      subjectRole?: string;
      fileName: string;
      issuer?: string;
      recordCategory?: MedicalRecordCategory;
      clearanceStatus: ClearanceStatus;
      baselineSpo2: number;
      baselineHr: number;
      baselineCoreTemp?: number;
      baselineRadFlux?: number;
      baselineHrv?: number;
      baselineSuitPressure?: number;
      baselinePpCO2?: number;
      baselineO2Reserve?: number;
      parsedSummary?: string;
    }) => {
      try {
        const res = await authorizedFetch('/api/telemetry/calibrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const snap = (await res.json()) as TelemetrySnapshotResponse;
          applySnapshot(snap);
          const matched = snap.crew.find((c) => c.callsign === params.crewCallsign);
          if (matched) {
            setSelectedCrewId(matched.id);
          }
          setActiveMedicalRecordId(params.recordId);
        }
      } catch {
        // Next poll reconciles state
      }
    },
    [applySnapshot]
  );

  const handleUploadMedicalRecord = async (payload: MedicalUploadPayload) => {
    if (!currentUser || !currentUser.emailVerified) {
      throw new Error('Verified Google operator clearance is required to persist medical records.');
    }
    const recordId = `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const recordPath = `users/${currentUser.uid}/medicalRecords/${recordId}`;
    const safeCallsign = sanitizeCallsign(payload.crewCallsign);
    const safeSpo2 = Math.max(0, Math.min(100, Number(payload.baselineSpo2) || 98.4));
    const safeHr = Math.max(0, Math.min(260, Number(payload.baselineHr) || 72));
    const safeFileName = payload.fileName.trim().slice(0, 160) || 'medical-record';
    const safeIssuer = payload.issuer.trim().slice(0, 120) || 'Aeromedical Clinic';
    const safeSummary = payload.parsedSummary.trim().slice(0, 400) || 'Medical report uploaded.';

    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'medicalRecords', recordId), {
        id: recordId,
        ownerUid: currentUser.uid,
        crewCallsign: safeCallsign,
        recordCategory: payload.recordCategory,
        fileName: safeFileName,
        mimeType: payload.mimeType.trim().slice(0, 100) || 'application/octet-stream',
        fileSizeBytes: Math.max(0, Math.min(10485760, Math.round(payload.fileSizeBytes))),
        serverFileId: payload.serverFileId.slice(0, 128),
        issuer: safeIssuer,
        clearanceStatus: payload.clearanceStatus,
        parsedSummary: safeSummary,
        baselineSpo2: safeSpo2,
        baselineHr: safeHr,
        createdAt: serverTimestamp(),
      });

      calibratedOnceRef.current = true;
      await calibrateTelemetryFromRecord({
        recordId,
        crewCallsign: safeCallsign,
        subjectName: payload.subjectName,
        subjectRole: payload.subjectRole,
        fileName: safeFileName,
        issuer: safeIssuer,
        recordCategory: payload.recordCategory,
        clearanceStatus: payload.clearanceStatus,
        baselineSpo2: safeSpo2,
        baselineHr: safeHr,
        baselineCoreTemp: payload.baselineCoreTemp,
        baselineRadFlux: payload.baselineRadFlux,
        baselineHrv: payload.baselineHrv,
        baselineSuitPressure: payload.baselineSuitPressure,
        baselinePpCO2: payload.baselinePpCO2,
        baselineO2Reserve: payload.baselineO2Reserve,
        parsedSummary: safeSummary,
      });

      void recordOperatorAction(
        'PROVENANCE',
        safeCallsign,
        `Uploaded ${safeFileName} for ${payload.subjectName} and calibrated Flight Deck, Orbital Matrix, Contingency & Archive.`
      );
      setActiveScreen('flight-deck');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, recordPath);
    }
  };

  const handleDeleteMedicalRecord = async (record: MedicalRecordItem) => {
    if (!currentUser || !currentUser.emailVerified) return;
    const recordPath = `users/${currentUser.uid}/medicalRecords/${record.id}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'medicalRecords', record.id));
      if (record.serverFileId) {
        void authorizedFetch(`/api/medical/files/${record.serverFileId}`, {
          method: 'DELETE',
        });
      }
      const remaining = medicalRecords.filter((r) => r.id !== record.id);
      const res = await authorizedFetch('/api/telemetry/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: remaining.map(recordToCalibrationInput) }),
      });
      if (res.ok) {
        const snap = (await res.json()) as TelemetrySnapshotResponse;
        applySnapshot(snap);
        if (remaining.length > 0 && snap.crew[0]) {
          setActiveMedicalRecordId(remaining[0].id);
          setSelectedCrewId(snap.crew[0].id);
        } else {
          setActiveMedicalRecordId(null);
          setSelectedCrewId('');
          calibratedOnceRef.current = false;
          setActiveScreen('med-records');
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, recordPath);
    }
  };

  const handleApplyMedicalBaseline = async (record: MedicalRecordItem) => {
    const input = recordToCalibrationInput(record);
    await calibrateTelemetryFromRecord({
      recordId: record.id,
      ...input,
    });

    void recordOperatorAction(
      'PROVENANCE',
      record.crewCallsign,
      `Switched active medical report baseline to ${record.fileName} (${record.clearanceStatus}).`
    );
    setActiveScreen('flight-deck');
  };

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0],
    [scenarios, activeScenarioId]
  );

  const selectedCrew = useMemo(
    () => crew.find((c) => c.id === selectedCrewId) ?? crew[0] ?? null,
    [crew, selectedCrewId]
  );

  const overallSeverity: TelemetrySeverity = useMemo(() => {
    if (crew.some((c) => c.status === 'critical') || activeScenario.severity === 'critical') {
      return 'critical';
    }
    if (crew.some((c) => c.status === 'advisory') || activeScenario.severity === 'advisory') {
      return 'advisory';
    }
    return 'nominal';
  }, [crew, activeScenario]);

  const handleSelectScenario = useCallback(
    async (id: ContingencyScenarioId) => {
      try {
        const res = await authorizedFetch('/api/contingency/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId: id, crewId: selectedCrewId }),
        });
        if (res.ok) {
          const snap = (await res.json()) as TelemetrySnapshotResponse;
          applySnapshot(snap);
          if (id !== 'nominal-eva' && !isAudioMuted) {
            playCriticalBeep(snap.overallSeverity === 'critical');
          }
          void recordOperatorAction(
            'SCENARIO',
            id,
            `Switched flight-deck mode to ${id}.`
          );
        }
      } catch {
        // Ignore transient failure; next poll reconciles state
      }
    },
    [selectedCrewId, applySnapshot, isAudioMuted, recordOperatorAction]
  );

  const handleTriggerContingencyFromHeader = () => {
    if (overallSeverity === 'critical') {
      setActiveScreen('contingency');
      return;
    }
    void handleSelectScenario('suit-decompression');
    setActiveScreen('flight-deck');
  };

  const handleToggleStream = async () => {
    const next = !isStreaming;
    setIsStreaming(next);
    try {
      const res = await authorizedFetch('/api/telemetry/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStreaming: next }),
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleToggleProtocolStep = async (
    scenarioId: ContingencyScenarioId,
    stepId: string
  ) => {
    try {
      const res = await authorizedFetch(`/api/contingency/steps/${scenarioId}/${stepId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
        void recordOperatorAction(
          'PROTOCOL_STEP',
          stepId,
          `Toggled verification status for checklist step ${stepId} (${scenarioId}).`
        );
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleToggleHatch = async (sectorId: string) => {
    try {
      const res = await authorizedFetch(`/api/sectors/${sectorId}/hatch`, {
        method: 'PATCH',
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
        void recordOperatorAction(
          'BULKHEAD',
          sectorId,
          `Toggled bulkhead pressure hatch state on ${sectorId}.`
        );
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleAcknowledgeAlert = async () => {
    setAlertAcknowledged(true);
    try {
      const res = await authorizedFetch('/api/contingency/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewId: selectedCrewId }),
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
        void recordOperatorAction(
          'ALERT_ACK',
          activeScenario.code,
          `Acknowledged emergency banner for ${activeScenario.name}.`
        );
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleSelectProvenanceDataset = async (datasetId: string) => {
    try {
      const res = await authorizedFetch('/api/telemetry/provenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provenanceMode: 'OSDR-FLT', activeDatasetId: datasetId }),
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
        void recordOperatorAction(
          'PROVENANCE',
          datasetId,
          `Selected NASA OSDR reference cohort ${datasetId}.`
        );
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await authorizedFetch('/api/logs/export.csv');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbital-telemetry-${formatMet(metSeconds).replace(/[:+]/g, '-')}.csv`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Ignore transient export failure
    }
  };

  // Trigger audio pulse periodically when critical & unmuted & unacknowledged
  useEffect(() => {
    if (!currentUser || overallSeverity === 'nominal' || alertAcknowledged || isAudioMuted) return;
    const beepTimer = window.setInterval(() => {
      playCriticalBeep(overallSeverity === 'critical');
    }, 3200);
    return () => window.clearInterval(beepTimer);
  }, [currentUser, overallSeverity, alertAcknowledged, isAudioMuted]);

  const activeMedicalRecord = useMemo(
    () =>
      medicalRecords.find((r) => r.id === activeMedicalRecordId) ??
      medicalRecords[0] ??
      null,
    [medicalRecords, activeMedicalRecordId]
  );

  if (!introComplete) {
    return <IntroSplashScreen onComplete={handleIntroComplete} />;
  }

  if (!authReady || !currentUser) {
    return (
      <SignInScreen
        metFormatted={formatMet(metSeconds)}
        overallSeverity={overallSeverity}
        authLoading={!authReady}
        authError={authError}
        onGoogleSignIn={handleGoogleSignIn}
      />
    );
  }

  const hasMedicalRecord = medicalRecords.length > 0;
  const effectiveScreen: ScreenId = hasMedicalRecord ? activeScreen : 'med-records';

  const selectedMetric: VitalMetric | null = selectedCrew
    ? selectedCrew.vitals[selectedVitalKey]
    : null;
  const datasetRef =
    provenanceMode === 'OSDR-FLT' ? activeDatasetId : activeScenario.code;

  return (
    <div className="min-h-screen bg-[#030712] text-[#dce2f9] hud-grid-bg flex flex-col">
      <TopNav
        activeScreen={effectiveScreen}
        onSelectScreen={(screen) => {
          if (screen === 'med-records' || hasMedicalRecord) {
            setActiveScreen(screen);
          }
        }}
        overallSeverity={overallSeverity}
        onTriggerContingency={handleTriggerContingencyFromHeader}
        hasMedicalRecord={hasMedicalRecord}
      />

      <EmergencyBanner
        severity={overallSeverity}
        title={activeScenario.triggerAlertTitle}
        countdownSec={countdownSec}
        isMuted={isAudioMuted}
        onToggleMute={() => setIsAudioMuted((m) => !m)}
        onAcknowledge={() => void handleAcknowledgeAlert()}
        acknowledged={alertAcknowledged}
      />

      {/* Global Operational Telemetry Strip */}
      <div className="border-b border-[#00F0FF]/15 bg-[#070D1D]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="font-semibold text-[#F8FAFC] tabular-nums">
              MET {formatMet(metSeconds)}
            </span>
            <span className="text-[#475569]" aria-hidden="true">/</span>
            <StatusPill severity={overallSeverity} />
            <span className="text-[#475569] hidden sm:inline" aria-hidden="true">/</span>
            <ProvenanceBadge mode={provenanceMode} datasetRef={datasetRef} />
            <span className="text-[#475569] hidden md:inline" aria-hidden="true">/</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[#dce2f9]">
              <UserCheck className="h-3.5 w-3.5 text-[#00F0FF]" />
              <span>
                {operatorProfile.callsign} ({operatorProfile.displayName})
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Data Provenance Switcher */}
            <div
              role="group"
              aria-label="Data provenance mode"
              className="flex items-center rounded border border-[#00F0FF]/25 bg-[#030712] p-0.5 font-mono text-[11px]"
            >
              <button
                type="button"
                onClick={() => void handleSelectScenario('nominal-eva')}
                className={`min-h-[34px] rounded-sm px-2.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  provenanceMode === 'OSDR-FLT'
                    ? 'bg-[#00F0FF]/18 text-[#00F0FF] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                OSDR Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeScenarioId === 'nominal-eva') {
                    void handleSelectScenario('suit-decompression');
                  } else {
                    setProvenanceMode('SIM-RUN');
                  }
                }}
                className={`min-h-[34px] rounded-sm px-2.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  provenanceMode === 'SIM-RUN'
                    ? 'bg-[#FFB703]/20 text-[#FFB703] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Simulated Run
              </button>
            </div>

            {/* Stream Play/Pause */}
            <button
              type="button"
              onClick={() => void handleToggleStream()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#38BDF8]/40 bg-[#070D1D] px-3 py-1.5 font-mono text-xs text-[#F8FAFC] hover:border-[#00F0FF] transition-colors whitespace-nowrap shrink-0"
            >
              {isStreaming ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-[#00F0FF]" />
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-[#00FF66]" />
                  <span>Resume Stream</span>
                </>
              )}
            </button>

            {/* Sign Out */}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#475569] bg-[#030712] px-3 py-1.5 font-mono text-xs text-[#94A3B8] hover:border-[#FF2A55] hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Screen Content */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 pb-10 sm:px-6 lg:px-8">
        {effectiveScreen !== 'med-records' && activeMedicalRecord && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#00F0FF]/30 bg-[#070D1D]/90 px-4 py-2.5 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <FileCheck2 className="h-4 w-4 text-[#00FF66] shrink-0" />
              <span className="text-[#94A3B8]">REPORT SOURCE:</span>
              <span className="font-semibold text-[#F8FAFC]">{activeMedicalRecord.fileName}</span>
              <span className="text-[#475569]">·</span>
              <span className="text-[#00F0FF] font-semibold">
                {extractSubjectFromSummary(activeMedicalRecord.parsedSummary, activeMedicalRecord.crewCallsign).subjectName} ({activeMedicalRecord.crewCallsign})
              </span>
              <span className="text-[#475569]">·</span>
              <span className="text-[#00FF66] tabular-nums">
                SpO2 {activeMedicalRecord.baselineSpo2.toFixed(1)}% / HR {activeMedicalRecord.baselineHr} BPM
              </span>
              <span className="rounded border border-[#00F0FF]/30 bg-[#030712] px-2 py-0.5 text-[10px] text-[#dce2f9]">
                {activeMedicalRecord.clearanceStatus.replace('_', ' ')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('med-records')}
              className="rounded border border-[#00F0FF]/45 bg-[#0B132B] px-3 py-1 text-[11px] font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/15 transition-colors whitespace-nowrap"
            >
              Upload / Switch Report
            </button>
          </div>
        )}

        {effectiveScreen === 'flight-deck' && selectedCrew && selectedMetric && (
          <div className="space-y-5">
            {/* Uploaded Subject Card(s) & Report Envelope */}
            <section aria-label="Uploaded medical subject telemetry selector" className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {crew.map((member) => {
                const isSelected = member.id === selectedCrew.id;
                const cardClass =
                  member.status === 'critical'
                    ? 'hud-panel-critical'
                    : member.status === 'advisory'
                    ? 'hud-panel-advisory'
                    : isSelected
                    ? 'hud-panel-tier2'
                    : 'hud-panel-tier1 hover:border-[#00F0FF]/50';

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedCrewId(member.id)}
                    className={`flex flex-col justify-between gap-3 rounded-lg p-4 text-left transition-all ${cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#00F0FF]">
                            {member.callsign}
                          </span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">
                            {member.suitId}
                          </span>
                        </div>
                        <h2 className="font-display text-base font-bold text-[#F8FAFC] mt-0.5 truncate">
                          {member.name}
                        </h2>
                        <p className="text-xs text-[#94A3B8] truncate">
                          {member.role} · {member.stationLocation}
                        </p>
                        {member.medicalReport && (
                          <p className="font-mono text-[10px] text-[#00F0FF]/85 mt-1 truncate">
                            Report: {member.medicalReport.fileName} · {member.medicalReport.issuer}
                          </p>
                        )}
                      </div>
                      <StatusPill severity={member.status} compact />
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-[#00F0FF]/15 pt-2.5 font-mono text-[11px] w-full tabular-nums">
                      <div>
                        <span className="text-[#94A3B8] block text-[10px]">SpO2</span>
                        <span className="text-[#F8FAFC] font-semibold">
                          {member.vitals.spo2.value.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px]">O2 RES</span>
                        <span
                          className={`font-semibold ${
                            member.o2ReservePct < 35 ? 'text-[#FF2A55]' : 'text-[#00FF66]'
                          }`}
                        >
                          {member.o2ReservePct.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px]">BATTERY</span>
                        <span className="text-[#00F0FF] font-semibold">
                          {member.batteryPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>

            {/* Primary Survival Vitals Grid */}
            <section aria-label="Primary physiological vitals" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="font-display text-lg sm:text-xl font-bold text-[#F8FAFC] tracking-wide">
                  Physiological Survival Envelope · {selectedCrew.callsign}
                </h1>
                <button
                  type="button"
                  onClick={() => setShowOsdrOverlay((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#00F0FF]/30 bg-[#070D1D] px-3 py-1 font-mono text-[11px] text-[#dce2f9] hover:border-[#00F0FF] transition-colors whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#00F0FF]" />
                  <span>{showOsdrOverlay ? 'Hide OSDR Sparkline' : 'Show OSDR Sparkline'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(['spo2', 'heartRate', 'radiationFlux', 'coreTemp'] as VitalKey[]).map((key) => (
                  <TelemetryCard
                    key={key}
                    metric={selectedCrew.vitals[key]}
                    selected={selectedVitalKey === key}
                    onSelect={() => setSelectedVitalKey(key)}
                    showOsdrOverlay={showOsdrOverlay}
                  />
                ))}
              </div>

              {/* Secondary Partial Pressure & HRV Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['suitPressure', 'ppCO2', 'hrv'] as VitalKey[]).map((key) => (
                  <TelemetryCard
                    key={key}
                    metric={selectedCrew.vitals[key]}
                    selected={selectedVitalKey === key}
                    onSelect={() => setSelectedVitalKey(key)}
                    showOsdrOverlay={showOsdrOverlay}
                  />
                ))}
              </div>
            </section>

            {/* Waveform Detail + Quick Contingency Control Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-8">
                <LiveWaveformChart
                  metric={selectedMetric}
                  provenance={provenanceMode}
                  datasetRef={datasetRef}
                  crewCallsign={selectedCrew.callsign}
                  isStreaming={isStreaming}
                />
              </div>

              <aside className="lg:col-span-4 hud-panel-tier1 rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4">
                <div className="space-y-1 border-b border-[#00F0FF]/15 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                      Contingency &amp; Link Deck
                    </h2>
                    <Radio className="h-4 w-4 text-[#00F0FF]" />
                  </div>
                  <p className="font-mono text-xs text-[#94A3B8]">
                    Trigger real-time anomaly simulations or inspect emergency procedures.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {scenarios.map((scn) => {
                    const isActive = scn.id === activeScenarioId;
                    return (
                      <button
                        key={scn.id}
                        type="button"
                        onClick={() => void handleSelectScenario(scn.id)}
                        className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded px-3.5 py-2.5 text-left transition-all ${
                          isActive && scn.severity === 'critical'
                            ? 'bg-[#FF2A55] text-[#030712] font-bold hazard-stripes'
                            : isActive && scn.severity === 'advisory'
                            ? 'bg-[#FFB703] text-[#030712] font-bold'
                            : isActive
                            ? 'bg-[#00F0FF] text-[#030712] font-bold'
                            : 'border border-[#38BDF8]/35 bg-[#030712]/70 text-[#F8FAFC] hover:border-[#00F0FF]'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] uppercase block opacity-80">
                            {scn.code}
                          </span>
                          <span className="font-display text-xs sm:text-sm truncate block">
                            {scn.name}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] uppercase shrink-0">
                          {isActive ? 'ACTIVE' : 'RUN'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#00F0FF]/15">
                  <button
                    type="button"
                    onClick={() => setActiveScreen('contingency')}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded border border-[#00F0FF]/50 bg-[#0B132B] px-3 py-2 font-mono text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/15 transition-colors whitespace-nowrap"
                  >
                    <Activity className="h-4 w-4" />
                    <span>Open Protocols</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScreen('orbital-matrix')}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded border border-[#38BDF8]/40 bg-transparent px-3 py-2 font-mono text-xs font-semibold text-[#F8FAFC] hover:border-[#00F0FF] transition-colors whitespace-nowrap"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#00FF66]" />
                    <span>Sector Map</span>
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {effectiveScreen === 'orbital-matrix' && (
          <OrbitalMatrixScreen
            sectors={sectors}
            crew={crew}
            onToggleHatch={(sectorId) => void handleToggleHatch(sectorId)}
            metSeconds={metSeconds}
          />
        )}

        {effectiveScreen === 'contingency' && selectedCrew && (
          <ContingencyScreen
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelectScenario={(id) => void handleSelectScenario(id)}
            onToggleStep={(scenarioId, stepId) =>
              void handleToggleProtocolStep(scenarioId, stepId)
            }
            onResetNominal={() => void handleSelectScenario('nominal-eva')}
            selectedCrew={selectedCrew}
          />
        )}

        {effectiveScreen === 'archive' && (
          <ArchiveScreen
            datasets={datasets}
            logs={logs}
            onExportCsv={handleExportCsv}
            activeDatasetId={activeDatasetId}
            onSelectDataset={(id) => void handleSelectProvenanceDataset(id)}
            operatorActions={operatorActions}
          />
        )}

        {effectiveScreen === 'med-records' && (
          <MedicalRecordsScreen
            operatorDisplayName={operatorProfile.displayName}
            records={medicalRecords}
            activeRecordId={activeMedicalRecord?.id ?? null}
            onUploadRecord={handleUploadMedicalRecord}
            onDeleteRecord={handleDeleteMedicalRecord}
            onApplyBaseline={handleApplyMedicalBaseline}
            onProceedToFlightDeck={() => setActiveScreen('flight-deck')}
          />
        )}
      </main>
    </div>
  );
}
