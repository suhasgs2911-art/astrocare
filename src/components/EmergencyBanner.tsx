import React, { useRef, useState } from 'react';
import { Volume2, VolumeX, ChevronsRight, ShieldAlert } from 'lucide-react';
import { TelemetrySeverity } from '../types/telemetry';

interface EmergencyBannerProps {
  severity: TelemetrySeverity;
  title: string;
  countdownSec: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onAcknowledge: () => void;
  acknowledged: boolean;
}

function formatCountdown(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function EmergencyBanner({
  severity,
  title,
  countdownSec,
  isMuted,
  onToggleMute,
  onAcknowledge,
  acknowledged,
}: EmergencyBannerProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragPct, setDragPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (severity === 'nominal' || acknowledged) {
    return null;
  }

  const isCritical = severity === 'critical';
  const bgColor = isCritical ? '#FF2A55' : '#FFB703';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const usableWidth = Math.max(1, rect.width - 48);
    const offset = Math.min(Math.max(0, e.clientX - rect.left - 24), usableWidth);
    const pct = (offset / usableWidth) * 100;
    setDragPct(pct);
    if (pct >= 86) {
      setIsDragging(false);
      setDragPct(0);
      onAcknowledge();
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragPct >= 86) {
      onAcknowledge();
    }
    setDragPct(0);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-[65px] md:top-[61px] z-20 w-full border-b-2 border-[#030712]"
      style={{ backgroundColor: bgColor, color: '#030712' }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#030712] text-[#F8FAFC]">
            <ShieldAlert className="h-5 w-5" style={{ color: bgColor }} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-widest uppercase">
                {isCritical ? 'EMERGENCY MISSION ALERT' : 'ADVISORY TELEMETRY ALERT'}
              </span>
              <span className="font-mono text-xs font-bold bg-[#030712] text-[#F8FAFC] px-2 py-0.5 rounded tabular-nums">
                T-MINUS {formatCountdown(countdownSec)}
              </span>
            </div>
            <p className="font-display text-sm sm:text-base font-bold leading-tight truncate">
              {title}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute alert audio' : 'Mute alert audio'}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded bg-[#030712]/90 px-3 py-2 font-mono text-xs font-semibold text-[#F8FAFC] hover:bg-[#030712] transition-colors whitespace-nowrap shrink-0"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-[#94A3B8]" /> : <Volume2 className="h-4 w-4 text-[#00FF66]" />}
            <span>{isMuted ? 'Audio Muted' : 'Audio Active'}</span>
          </button>

          {/* Tactile Swipe-to-Acknowledge Slider + Accessible Click/Key Fallback */}
          <div
            ref={trackRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative flex h-[44px] w-full sm:w-[248px] select-none items-center rounded bg-[#030712] p-1 touch-none"
          >
            <div
              className="absolute inset-y-1 left-1 rounded-sm transition-opacity"
              style={{
                width: `calc(${Math.max(18, dragPct)}% + 36px)`,
                backgroundColor: `${bgColor}33`,
              }}
            />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Swipe or press Enter to acknowledge emergency alert"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(dragPct)}
              onPointerDown={handlePointerDown}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAcknowledge();
                }
              }}
              style={{
                transform: `translateX(${(dragPct / 100) * 196}px)`,
                backgroundColor: bgColor,
              }}
              className="relative z-10 flex h-9 w-11 cursor-grab active:cursor-grabbing items-center justify-center rounded-sm text-[#030712] shadow-sm transition-transform duration-75"
            >
              <ChevronsRight className="h-5 w-5" />
            </div>
            <button
              type="button"
              onClick={onAcknowledge}
              className="relative z-0 flex-1 text-center font-mono text-[11px] font-bold tracking-wider text-[#F8FAFC] uppercase pl-6 pr-2 whitespace-nowrap"
            >
              Swipe / Tap Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
