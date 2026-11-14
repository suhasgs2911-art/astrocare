import { useEffect, useId, useState } from 'react';
import { motion } from 'motion/react';

interface IntroSplashScreenProps {
  onComplete: () => void;
}

const BOOT_PHASES = [
  'INITIALIZING KU-BAND TELEMETRY BUS',
  'MOUNTING BIOMEDICAL CALIBRATION ENGINE',
  'SYNCING ORBITAL MATRIX & CONTINGENCY DECK',
  'ENGAGING OPERATOR AUTHENTICATION GATE',
];

export function AetherLogoMark({ size = 112 }: { size?: number }) {
  const uid = useId();
  const glowId = `aetherCoreGlow-${uid}`;
  const strokeId = `aetherStrokeGrad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.32" />
          <stop offset="65%" stopColor="#00F0FF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#030712" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={strokeId} x1="18" y1="18" x2="102" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#00FF66" />
        </linearGradient>
      </defs>

      {/* Ambient core glow */}
      <circle cx="60" cy="60" r="54" fill={`url(#${glowId})`} />

      {/* Outer orbital dashed ring */}
      <motion.circle
        cx="60"
        cy="60"
        r="52"
        stroke="#00F0FF"
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeDasharray="6 6"
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 360, opacity: 1 }}
        transition={{
          rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
          opacity: { duration: 0.6 },
        }}
        style={{ transformOrigin: '60px 60px' }}
      />

      {/* Inner precision vector arc */}
      <motion.circle
        cx="60"
        cy="60"
        r="41"
        stroke={`url(#${strokeId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="88 38 42 38"
        initial={{ rotate: 0, pathLength: 0, opacity: 0 }}
        animate={{ rotate: -360, pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 1.2, ease: 'easeOut' },
          opacity: { duration: 0.5 },
          rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
        }}
        style={{ transformOrigin: '60px 60px' }}
      />

      {/* Orbital aerospace delta chevron */}
      <motion.path
        d="M60 22L88 86L60 73L32 86L60 22Z"
        stroke="#F8FAFC"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="#0B132B"
        fillOpacity="0.82"
        initial={{ pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 0.82 }}
        transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }}
      />

      {/* Biomedical telemetry pulse waveform cutting across emblem */}
      <motion.path
        d="M23 62H43L49 49L56 75L64 41L71 67L76 62H97"
        stroke="#00FF66"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.75, ease: 'easeInOut' }}
      />

      {/* Cardinal node ticks */}
      <circle cx="60" cy="8" r="2.5" fill="#00F0FF" />
      <circle cx="112" cy="60" r="2.5" fill="#00F0FF" />
      <circle cx="60" cy="112" r="2.5" fill="#00F0FF" />
      <circle cx="8" cy="60" r="2.5" fill="#00F0FF" />
    </svg>
  );
}

export function IntroSplashScreen({ onComplete }: IntroSplashScreenProps) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhaseIdx(1), 950);
    const t2 = window.setTimeout(() => setPhaseIdx(2), 1950);
    const t3 = window.setTimeout(() => setPhaseIdx(3), 2900);
    const tExit = window.setTimeout(() => setExiting(true), 3650);
    const tDone = window.setTimeout(() => onComplete(), 4000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tExit);
      window.clearTimeout(tDone);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.02 : 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative min-h-screen bg-[#030712] text-[#dce2f9] hud-grid-bg flex flex-col items-center justify-center overflow-hidden px-6"
    >
      {/* Subtle radial vignette & horizon scanline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(0, 240, 255, 0.10) 0%, rgba(3, 7, 18, 0.92) 62%, #030712 100%)',
        }}
      />

      {/* Corner HUD registration brackets */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-6 sm:inset-10">
        <div className="absolute top-0 left-0 h-7 w-7 border-t-2 border-l-2 border-[#00F0FF]/50" />
        <div className="absolute top-0 right-0 h-7 w-7 border-t-2 border-r-2 border-[#00F0FF]/50" />
        <div className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-[#00F0FF]/50" />
        <div className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-[#00F0FF]/50" />
      </div>

      {/* Main Centered Logo & Title Sequence */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center p-4"
        >
          {/* Expanding pulse halo */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[#00F0FF]/35"
            initial={{ scale: 0.75, opacity: 0.7 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
          <AetherLogoMark size={124} />
        </motion.div>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.65, delay: 0.55, ease: 'easeOut' }}
          className="mt-4 space-y-2"
        >
          <div className="inline-flex items-center gap-2 rounded border border-[#00F0FF]/35 bg-[#070D1D]/90 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-[#00F0FF] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF66] animate-pulse" />
            <span>AEROSPACE BIOMEDICAL TELEMETRY</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-[0.14em] text-[#F8FAFC] uppercase">
            AETHER FLIGHT DECK
          </h1>

          <p className="font-mono text-xs sm:text-sm tracking-[0.12em] text-[#94A3B8] uppercase">
            Orbital Telemetry &amp; Critical Response Console
          </p>
        </motion.div>

        {/* 4-Second Calibration Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-8 w-full max-w-md space-y-2.5"
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0B132B] border border-[#00F0FF]/25">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00F0FF] to-[#00FF66]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 3.55, delay: 0.1, ease: 'easeInOut' }}
            />
          </div>

          <div className="flex items-center justify-between font-mono text-[11px] text-[#94A3B8]">
            <span className="text-[#00F0FF] tracking-wider truncate">
              {BOOT_PHASES[phaseIdx]}
            </span>
            <span className="tabular-nums text-[#F8FAFC] shrink-0 ml-3">
              {Math.min(100, (phaseIdx + 1) * 25)}%
            </span>
          </div>
        </motion.div>
      </div>

      {/* Skip Option */}
      <button
        type="button"
        onClick={onComplete}
        className="relative z-10 mt-10 min-h-[36px] rounded border border-[#475569]/60 bg-[#070D1D]/80 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#94A3B8] hover:border-[#00F0FF] hover:text-[#F8FAFC] transition-colors"
      >
        Skip Intro →
      </button>
    </motion.div>
  );
}
