import { useState } from 'react';
import { CheckSquare, Square, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  ContingencyScenario,
  ContingencyScenarioId,
  CrewMember,
} from '../types/telemetry';
import { ProvenanceBadge, StatusPill } from './ProvenanceAndStatus';

interface ContingencyScreenProps {
  scenarios: ContingencyScenario[];
  activeScenarioId: ContingencyScenarioId;
  onSelectScenario: (id: ContingencyScenarioId) => void;
  onToggleStep: (scenarioId: ContingencyScenarioId, stepId: string) => void;
  onResetNominal: () => void;
  selectedCrew: CrewMember;
}

export function ContingencyScreen({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onToggleStep,
  onResetNominal,
  selectedCrew,
}: ContingencyScreenProps) {
  const [metabolicRateLpm, setMetabolicRateLpm] = useState<number>(1.2);
  const [leakRateKpaMin, setLeakRateKpaMin] = useState<number>(
    activeScenarioId === 'suit-decompression' ? 0.9 : 0.0
  );

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  const completedCount = activeScenario.steps.filter((s) => s.completed).length;
  const totalSteps = activeScenario.steps.length;

  // Survival O2 reserve calculation in minutes
  const effectiveDrain = metabolicRateLpm * 0.45 + leakRateKpaMin * 3.8;
  const estimatedMinutesRemaining = Math.max(
    4,
    Math.round((selectedCrew.o2ReservePct / Math.max(0.25, effectiveDrain)) * 2.1)
  );

  return (
    <div className="space-y-5">
      {/* Top Scenario Selector Grid */}
      <section aria-label="Contingency scenario injector" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#F8FAFC]">
              Critical Response &amp; Contingency Protocols
            </h1>
            <p className="font-mono text-xs text-[#94A3B8] mt-0.5">
              Inject simulated failure modes to validate emergency response timelines and gloved checklist ergonomics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ProvenanceBadge mode={activeScenarioId === 'nominal-eva' ? 'OSDR-FLT' : 'SIM-RUN'} datasetRef={activeScenario.code} />
            {activeScenarioId !== 'nominal-eva' && (
              <button
                type="button"
                onClick={onResetNominal}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded border border-[#00F0FF]/45 bg-[#070D1D] px-3.5 py-2 font-mono text-xs font-semibold text-[#00F0FF] uppercase hover:border-[#00F0FF] transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Nominal</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {scenarios.map((scn) => {
            const isSelected = scn.id === activeScenarioId;
            const panelClass =
              scn.severity === 'critical' && isSelected
                ? 'hud-panel-critical'
                : scn.severity === 'advisory' && isSelected
                ? 'hud-panel-advisory'
                : isSelected
                ? 'hud-panel-tier2'
                : 'hud-panel-tier1 hover:border-[#00F0FF]/50';

            return (
              <button
                key={scn.id}
                type="button"
                onClick={() => {
                  onSelectScenario(scn.id);
                  setLeakRateKpaMin(scn.id === 'suit-decompression' ? 0.9 : 0.0);
                }}
                className={`relative flex min-h-[120px] flex-col justify-between rounded-lg p-4 text-left transition-all ${panelClass}`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-mono text-xs font-semibold text-[#94A3B8]">
                    {scn.code}
                  </span>
                  <StatusPill severity={scn.severity} compact />
                </div>
                <div className="mt-2">
                  <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                    {scn.name}
                  </h2>
                  <p className="mt-1 text-xs text-[#94A3B8] line-clamp-2">
                    {scn.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Split: Gloved Checklist (7 cols) + O2 Reserve Survival Calculator (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section
          className={`lg:col-span-7 rounded-lg overflow-hidden ${
            activeScenario.severity === 'critical'
              ? 'hud-panel-critical'
              : activeScenario.severity === 'advisory'
              ? 'hud-panel-advisory'
              : 'hud-panel-tier1'
          }`}
        >
          <div className="flex">
            {activeScenario.severity === 'critical' && (
              <div className="w-2 shrink-0 hazard-edge-left" aria-hidden="true" />
            )}
            <div className="flex-1 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00F0FF]/15 pb-3">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
                    Active Procedure · {activeScenario.code}
                  </span>
                  <h3 className="font-display text-lg font-bold text-[#F8FAFC]">
                    {activeScenario.name}
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-[#00F0FF] tabular-nums">
                  {completedCount} / {totalSteps} STEPS VERIFIED
                </span>
              </div>

              <div className="space-y-3">
                {activeScenario.steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onToggleStep(activeScenario.id, step.id)}
                    className={`flex w-full min-h-[64px] items-start gap-3.5 rounded-lg border p-3.5 text-left transition-colors ${
                      step.completed
                        ? 'border-[#00FF66]/45 bg-[#022413]/55'
                        : step.critical
                        ? 'border-[#FF2A55]/50 bg-[#18040A]/75 hover:border-[#FF2A55]'
                        : 'border-[#00F0FF]/20 bg-[#070D1D]/80 hover:border-[#00F0FF]/60'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {step.completed ? (
                        <CheckSquare className="h-6 w-6 text-[#00FF66]" />
                      ) : (
                        <Square
                          className={`h-6 w-6 ${
                            step.critical ? 'text-[#FF2A55]' : 'text-[#00F0FF]'
                          }`}
                        />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#F8FAFC]">
                          {step.code} · {step.title}
                        </span>
                        <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                          {step.targetSystem} · ~{step.durationSec}s
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-[#b9cacb]">
                        {step.instruction}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Oxygen Reserve & Survival Margin Calculator */}
        <section className="lg:col-span-5 hud-panel-tier1 rounded-lg p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1 border-b border-[#00F0FF]/15 pb-3">
            <h3 className="font-display text-lg font-bold text-[#F8FAFC]">
              Suit O2 Depletion &amp; Return Margin
            </h3>
            <p className="font-mono text-xs text-[#94A3B8]">
              Subject: {selectedCrew.name} ({selectedCrew.callsign} · {selectedCrew.suitId}) · Reserve{' '}
              {selectedCrew.o2ReservePct.toFixed(1)}%
            </p>
            {selectedCrew.medicalReport && (
              <p className="font-mono text-[11px] text-[#00F0FF]">
                Report: {selectedCrew.medicalReport.fileName} ·{' '}
                {selectedCrew.medicalReport.clearanceStatus.replace('_', ' ')}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[#00F0FF]/25 bg-[#030712]/80 p-4 text-center">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
              Projected Breathable Reserve
            </span>
            <div
              className={`mt-1 font-mono text-4xl font-bold tabular-nums ${
                estimatedMinutesRemaining < 35
                  ? 'text-[#FF2A55]'
                  : estimatedMinutesRemaining < 90
                  ? 'text-[#FFB703]'
                  : 'text-[#00FF66]'
              }`}
            >
              {Math.floor(estimatedMinutesRemaining / 60)}h{' '}
              {String(estimatedMinutesRemaining % 60).padStart(2, '0')}m
            </div>
            <p className="mt-1 font-mono text-xs text-[#94A3B8]">
              Quest Airlock Ingress Margin: 18 min required
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                <label htmlFor="metabolic-slider" className="text-[#dce2f9]">
                  METABOLIC O2 BURN RATE
                </label>
                <span className="text-[#00F0FF] font-semibold tabular-nums">
                  {metabolicRateLpm.toFixed(1)} L/min
                </span>
              </div>
              <input
                id="metabolic-slider"
                type="range"
                min="0.6"
                max="2.8"
                step="0.1"
                value={metabolicRateLpm}
                onChange={(e) => setMetabolicRateLpm(parseFloat(e.target.value))}
                className="w-full accent-[#00F0FF] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                <label htmlFor="leak-slider" className="text-[#dce2f9]">
                  EMU SEAL LEAKAGE RATE
                </label>
                <span
                  className={`font-semibold tabular-nums ${
                    leakRateKpaMin > 0.3 ? 'text-[#FF2A55]' : 'text-[#00FF66]'
                  }`}
                >
                  {leakRateKpaMin.toFixed(1)} kPa/min
                </span>
              </div>
              <input
                id="leak-slider"
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={leakRateKpaMin}
                onChange={(e) => setLeakRateKpaMin(parseFloat(e.target.value))}
                className="w-full accent-[#FF2A55] cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded border border-[#FFB703]/40 bg-[#261A02]/70 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-[#FFB703] shrink-0 mt-0.5" />
            <p className="text-xs text-[#ffdea9]">
              Flight-director threshold: Abort exterior translation whenever projected breathable reserve drops below 35 minutes or suit pressure falls under 24.5 kPa.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
