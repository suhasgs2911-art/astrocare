import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CONTINGENCY_SCENARIOS,
  INITIAL_CREW,
  INITIAL_LOGS,
  INITIAL_SECTORS,
  OSDR_ARCHIVE_DATASETS,
} from './data/telemetryData';
import {
  ContingencyScenario,
  ContingencyScenarioId,
  CrewMember,
  HabitatSector,
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
import { ArchiveScreen } from './components/ArchiveScreen';
import { ProvenanceBadge, StatusPill } from './components/ProvenanceAndStatus';
import { playCriticalBeep } from './utils/audioAlert';

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

function formatMet(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `T+${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('flight-deck');
  const [provenanceMode, setProvenanceMode] = useState<ProvenanceMode>('OSDR-FLT');
  const [activeDatasetId, setActiveDatasetId] = useState<string>('OSD-318');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('eva-01');
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
    try {
      const res = await fetch('/api/telemetry/state');
      if (!res.ok) return;
      const snap = (await res.json()) as TelemetrySnapshotResponse;
      applySnapshot(snap);
    } catch {
      // Retain last valid telemetry frame if transient network drop occurs
    }
  }, [applySnapshot]);

  useEffect(() => {
    void fetchState();
    const poll = window.setInterval(() => {
      void fetchState();
    }, 1200);
    return () => window.clearInterval(poll);
  }, [fetchState]);

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0],
    [scenarios, activeScenarioId]
  );

  const selectedCrew = useMemo(
    () => crew.find((c) => c.id === selectedCrewId) ?? crew[0],
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
        const res = await fetch('/api/contingency/scenario', {
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
        }
      } catch {
        // Ignore transient failure; next poll reconciles state
      }
    },
    [selectedCrewId, applySnapshot, isAudioMuted]
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
      const res = await fetch('/api/telemetry/stream', {
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
      const res = await fetch(`/api/contingency/steps/${scenarioId}/${stepId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleToggleHatch = async (sectorId: string) => {
    try {
      const res = await fetch(`/api/sectors/${sectorId}/hatch`, {
        method: 'PATCH',
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleAcknowledgeAlert = async () => {
    setAlertAcknowledged(true);
    try {
      const res = await fetch('/api/contingency/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewId: selectedCrewId }),
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleSelectProvenanceDataset = async (datasetId: string) => {
    try {
      const res = await fetch('/api/telemetry/provenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provenanceMode: 'OSDR-FLT', activeDatasetId: datasetId }),
      });
      if (res.ok) {
        applySnapshot((await res.json()) as TelemetrySnapshotResponse);
      }
    } catch {
      // Reconciled on next poll
    }
  };

  const handleExportCsv = () => {
    const a = document.createElement('a');
    a.href = '/api/logs/export.csv';
    a.download = `orbital-telemetry-${formatMet(metSeconds).replace(/[:+]/g, '-')}.csv`;
    a.click();
  };

  // Trigger audio pulse periodically when critical & unmuted & unacknowledged
  useEffect(() => {
    if (overallSeverity === 'nominal' || alertAcknowledged || isAudioMuted) return;
    const beepTimer = window.setInterval(() => {
      playCriticalBeep(overallSeverity === 'critical');
    }, 3200);
    return () => window.clearInterval(beepTimer);
  }, [overallSeverity, alertAcknowledged, isAudioMuted]);

  const selectedMetric: VitalMetric = selectedCrew.vitals[selectedVitalKey];
  const datasetRef =
    provenanceMode === 'OSDR-FLT' ? activeDatasetId : activeScenario.code;

  return (
    <div className="min-h-screen bg-[#030712] text-[#dce2f9] hud-grid-bg flex flex-col">
      <TopNav
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
        overallSeverity={overallSeverity}
        onTriggerContingency={handleTriggerContingencyFromHeader}
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
          </div>
        </div>
      </div>

      {/* Main Screen Content */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 pb-10 sm:px-6 lg:px-8">
        {activeScreen === 'flight-deck' && (
          <div className="space-y-5">
            {/* Crew Unit Selector & Suit Envelope Header */}
            <section aria-label="Crew member telemetry selector" className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#00F0FF]">
                            {member.callsign}
                          </span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">
                            {member.suitId}
                          </span>
                        </div>
                        <h2 className="font-display text-base font-bold text-[#F8FAFC] mt-0.5">
                          {member.name}
                        </h2>
                        <p className="text-xs text-[#94A3B8]">
                          {member.role} · {member.stationLocation}
                        </p>
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

            {/* Primary Survival Vitals Grid (4 columns desktop, 2 tablet, 1-2 mobile) */}
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

              {/* Quick Contingency Injector & Survival Actions (4 cols) */}
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

        {activeScreen === 'orbital-matrix' && (
          <OrbitalMatrixScreen
            sectors={sectors}
            crew={crew}
            onToggleHatch={(sectorId) => void handleToggleHatch(sectorId)}
            metSeconds={metSeconds}
          />
        )}

        {activeScreen === 'contingency' && (
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

        {activeScreen === 'archive' && (
          <ArchiveScreen
            datasets={datasets}
            logs={logs}
            onExportCsv={handleExportCsv}
            activeDatasetId={activeDatasetId}
            onSelectDataset={(id) => void handleSelectProvenanceDataset(id)}
          />
        )}
      </main>
    </div>
  );
}
