import { useState } from 'react';
import { Lock, ShieldAlert, ArrowRight, Radio } from 'lucide-react';
import { TelemetrySeverity } from '../types/telemetry';
import { StatusPill } from './ProvenanceAndStatus';
import { AetherLogoMark } from './IntroSplashScreen';

interface SignInScreenProps {
  metFormatted: string;
  overallSeverity: TelemetrySeverity;
  authLoading: boolean;
  authError: string | null;
  onGoogleSignIn: (selectedRole: string, selectedCallsign: string) => Promise<void>;
}

const STATION_ROLES = [
  { id: 'FD-01', role: 'Flight Director', callsign: 'FD-01' },
  { id: 'SURGEON-02', role: 'Biomedical Flight Surgeon', callsign: 'SURGEON-02' },
  { id: 'EMU-ENG', role: 'EVA Systems Engineer', callsign: 'EMU-ENG' },
];

export function SignInScreen({
  metFormatted,
  overallSeverity,
  authLoading,
  authError,
  onGoogleSignIn,
}: SignInScreenProps) {
  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const chosen = STATION_ROLES[selectedRoleIdx] ?? STATION_ROLES[0];

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      await onGoogleSignIn(chosen.role, chosen.callsign);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-[#dce2f9] hud-grid-bg flex flex-col justify-between">
      {/* Top Minimal Gate Header */}
      <header className="border-b border-[#00F0FF]/20 bg-[#030712]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <AetherLogoMark size={28} />
            <span className="font-display text-base sm:text-lg font-bold tracking-[0.06em] text-[#F8FAFC] uppercase whitespace-nowrap">
              AETHER FLIGHT DECK
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-[#94A3B8] hidden sm:inline tabular-nums">
              MET {metFormatted}
            </span>
            <StatusPill severity={overallSeverity} compact />
          </div>
        </div>
      </header>

      {/* Center Operator Sign-In Console */}
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-4xl grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Briefing Panel (5 cols) */}
          <section className="lg:col-span-5 hud-panel-tier1 rounded-lg p-6 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#00F0FF] uppercase tracking-wider">
                <Lock className="h-3.5 w-3.5" />
                <span>[AUTH-GATE] MISSION CONTROL ACCESS</span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8FAFC] leading-tight">
                Orbital Telemetry &amp; Critical Response
              </h1>

              <p className="text-sm text-[#b9cacb] leading-relaxed">
                Authenticate with your verified Google operator account to unlock live crew survival telemetry, bulkhead isolation controls, and persistent contingency audit logs.
              </p>
            </div>

            <div className="space-y-3 border-t border-[#00F0FF]/15 pt-4 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">DOWNLINK STREAM</span>
                <span className="inline-flex items-center gap-1.5 text-[#00FF66]">
                  <Radio className="h-3.5 w-3.5" />
                  <span>KU-BAND 1.0 Hz</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">MISSION ELAPSED TIME</span>
                <span className="text-[#F8FAFC] font-semibold tabular-nums">{metFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">DATA PROVENANCE</span>
                <span className="text-[#00F0FF]">OSDR-FLT / SIM-RUN</span>
              </div>
            </div>
          </section>

          {/* Right Sign-In Action Panel (7 cols) */}
          <section className="lg:col-span-7 hud-panel-tier2 rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#00F0FF]">
                  Operator Console Clearance
                </span>
                <h2 className="font-display text-xl font-bold text-[#F8FAFC] mt-1">
                  Select Console Role &amp; Sign In
                </h2>
              </div>

              {/* Console Station Selector */}
              <div className="space-y-2">
                <span className="block font-mono text-xs text-[#94A3B8] uppercase">
                  Assigned Console Station
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {STATION_ROLES.map((item, idx) => {
                    const active = idx === selectedRoleIdx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedRoleIdx(idx)}
                        className={`flex min-h-[52px] items-center justify-between rounded border px-4 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[#00F0FF] bg-[#00F0FF]/12 text-[#F8FAFC]'
                            : 'border-[#475569]/60 bg-[#070D1D] text-[#94A3B8] hover:border-[#00F0FF]/50 hover:text-[#F8FAFC]'
                        }`}
                      >
                        <div>
                          <span className="font-display text-sm font-semibold block">
                            {item.role}
                          </span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">
                            Console Callsign: {item.callsign}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold uppercase ${
                            active ? 'text-[#00F0FF]' : 'text-[#475569]'
                          }`}
                        >
                          {active ? 'SELECTED' : 'SELECT'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded border border-[#FF2A55] bg-[#18040A] p-3.5 text-xs text-[#ffdad6]"
                >
                  <ShieldAlert className="h-4 w-4 text-[#FF2A55] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-mono font-bold uppercase block text-[#FF2A55]">
                      Authentication Gate Fault
                    </span>
                    <span>{authError}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-[#00F0FF]/15">
              <button
                type="button"
                disabled={authLoading || submitting}
                onClick={() => void handleSignIn()}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded bg-[#00F0FF] px-5 py-3 font-mono text-sm font-bold tracking-wider text-[#030712] uppercase hover:bg-[#7df4ff] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#030712"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>
                  {authLoading || submitting
                    ? 'Establishing Clearance...'
                    : 'Sign In With Google'}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              <p className="font-mono text-[11px] text-[#94A3B8] text-center">
                Session clearance uses verified Google OAuth via Firebase Auth; PII is isolated from flight-deck telemetry.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
