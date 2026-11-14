import React, { useState } from 'react';
import { ProvenanceMode, VitalMetric } from '../types/telemetry';
import { ProvenanceBadge, StatusPill } from './ProvenanceAndStatus';

interface LiveWaveformChartProps {
  metric: VitalMetric;
  provenance: ProvenanceMode;
  datasetRef: string;
  crewCallsign: string;
  isStreaming: boolean;
}

export function LiveWaveformChart({
  metric,
  provenance,
  datasetRef,
  crewCallsign,
  isStreaming,
}: LiveWaveformChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 760;
  const height = 240;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const combined = [
    ...metric.history,
    ...metric.osdrBaselineHistory,
    metric.minBound,
    metric.maxBound,
  ];
  const rawMin = Math.min(...combined);
  const rawMax = Math.max(...combined);
  const paddingRange = Math.max(0.1, (rawMax - rawMin) * 0.15);
  const yMin = rawMin - paddingRange;
  const yMax = rawMax + paddingRange;
  const ySpan = Math.max(0.001, yMax - yMin);

  const toX = (i: number, len: number) =>
    padLeft + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
  const toY = (v: number) => padTop + innerH - ((v - yMin) / ySpan) * innerH;

  const liveCoords = metric.history.map((v, i) => ({
    x: toX(i, metric.history.length),
    y: toY(v),
    v,
  }));

  const osdrCoords = metric.osdrBaselineHistory.map((v, i) => ({
    x: toX(i, metric.osdrBaselineHistory.length),
    y: toY(v),
    v,
  }));

  const livePath = liveCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const osdrPath = osdrCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const areaPath =
    liveCoords.length > 1
      ? `M ${liveCoords[0].x.toFixed(1)},${(padTop + innerH).toFixed(1)} ` +
        liveCoords.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L ${liveCoords[liveCoords.length - 1].x.toFixed(1)},${(padTop + innerH).toFixed(1)} Z`
      : '';

  const activeColor =
    metric.severity === 'critical'
      ? '#FF2A55'
      : metric.severity === 'advisory'
      ? '#FFB703'
      : '#00F0FF';

  const bandTopY = toY(metric.maxBound);
  const bandBottomY = toY(metric.minBound);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const clamped = Math.min(Math.max(relX - padLeft, 0), innerW);
    const idx = Math.round((clamped / innerW) * (metric.history.length - 1));
    setHoverIdx(Math.min(Math.max(0, idx), metric.history.length - 1));
  };

  const inspectedIdx = hoverIdx !== null ? hoverIdx : metric.history.length - 1;
  const inspectedLive = metric.history[inspectedIdx] ?? metric.value;
  const inspectedOsdr = metric.osdrBaselineHistory[inspectedIdx] ?? metric.baselineValue;
  const deltaFromOsdr = inspectedLive - inspectedOsdr;

  return (
    <section
      aria-label={`${metric.label} telemetry waveform`}
      className={`rounded-lg p-4 sm:p-5 ${
        metric.severity === 'critical'
          ? 'hud-panel-critical'
          : metric.severity === 'advisory'
          ? 'hud-panel-advisory'
          : 'hud-panel-tier1'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#00F0FF]/15 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#F8FAFC] tracking-wide">
              {metric.label}
            </h2>
            <StatusPill severity={metric.severity} />
          </div>
          <p className="font-mono text-xs text-[#94A3B8]">
            CHANNEL: {crewCallsign} · {isStreaming ? '1.0 Hz LIVE STREAM' : 'STREAM PAUSED'} · ENVELOPE{' '}
            {metric.minBound.toFixed(metric.decimals)}–{metric.maxBound.toFixed(metric.decimals)} {metric.unit}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceBadge mode={provenance} datasetRef={datasetRef} />
        </div>
      </div>

      {/* Crosshair Readout Strip */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded bg-[#030712]/60 border border-[#00F0FF]/12 px-3 py-2 font-mono text-xs">
        <div>
          <span className="text-[#94A3B8] block text-[10px] uppercase">Sample Offset</span>
          <span className="text-[#F8FAFC] font-semibold tabular-nums">
            T-{(metric.history.length - 1 - inspectedIdx) * 5}s
          </span>
        </div>
        <div>
          <span className="text-[#94A3B8] block text-[10px] uppercase">Live Stream</span>
          <span className="font-semibold tabular-nums" style={{ color: activeColor }}>
            {inspectedLive.toFixed(metric.decimals)} {metric.unit}
          </span>
        </div>
        <div>
          <span className="text-[#94A3B8] block text-[10px] uppercase">OSDR Reference</span>
          <span className="text-[#dce2f9] font-semibold tabular-nums">
            {inspectedOsdr.toFixed(metric.decimals)} {metric.unit}
          </span>
        </div>
        <div>
          <span className="text-[#94A3B8] block text-[10px] uppercase">Baseline Delta</span>
          <span
            className={`font-semibold tabular-nums ${
              Math.abs(deltaFromOsdr) > (metric.maxBound - metric.minBound) * 0.25
                ? 'text-[#FFB703]'
                : 'text-[#00FF66]'
            }`}
          >
            {deltaFromOsdr >= 0 ? '+' : ''}
            {deltaFromOsdr.toFixed(metric.decimals === 0 ? 1 : metric.decimals)} {metric.unit}
          </span>
        </div>
      </div>

      {/* SVG Telemetry Plot */}
      <div className="mt-3 relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={`Time-series telemetry chart for ${metric.label}`}
        >
          <defs>
            <linearGradient id={`area-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.24" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Safe Physiological Envelope Band */}
          <rect
            x={padLeft}
            y={Math.min(bandTopY, bandBottomY)}
            width={innerW}
            height={Math.max(4, Math.abs(bandBottomY - bandTopY))}
            fill="#00FF66"
            fillOpacity="0.05"
          />

          {/* Horizontal Gridlines & Y-Axis Ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = yMin + t * ySpan;
            const y = toY(val);
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + innerW}
                  y2={y}
                  stroke="#3b494b"
                  strokeOpacity="0.35"
                  strokeDasharray="2 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val.toFixed(metric.decimals === 0 ? 0 : metric.decimals)}
                </text>
              </g>
            );
          })}

          {/* Upper / Lower Safety Limit Lines */}
          <line
            x1={padLeft}
            y1={bandTopY}
            x2={padLeft + innerW}
            y2={bandTopY}
            stroke="#00FF66"
            strokeOpacity="0.35"
            strokeDasharray="5 4"
          />
          <line
            x1={padLeft}
            y1={bandBottomY}
            x2={padLeft + innerW}
            y2={bandBottomY}
            stroke="#FFB703"
            strokeOpacity="0.45"
            strokeDasharray="5 4"
          />

          {/* Area Fill under Live Stream */}
          {areaPath && <path d={areaPath} fill={`url(#area-${metric.id})`} />}

          {/* Theoretical / OSDR Baseline (Dashed) */}
          <polyline
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.6"
            strokeDasharray="5 4"
            points={osdrPath}
          />

          {/* Live Stream Curve (Solid) */}
          <polyline
            fill="none"
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={livePath}
          />

          {/* X-Axis Time Labels */}
          {liveCoords.map((pt, i) => {
            if (i % 3 !== 0 && i !== liveCoords.length - 1) return null;
            const secAgo = (liveCoords.length - 1 - i) * 5;
            return (
              <text
                key={i}
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {secAgo === 0 ? 'NOW' : `-${secAgo}s`}
              </text>
            );
          })}

          {/* Crosshair Hover Line & Point Marker */}
          {liveCoords[inspectedIdx] && (
            <g>
              <line
                x1={liveCoords[inspectedIdx].x}
                y1={padTop}
                x2={liveCoords[inspectedIdx].x}
                y2={padTop + innerH}
                stroke="#00F0FF"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <circle
                cx={osdrCoords[inspectedIdx].x}
                cy={osdrCoords[inspectedIdx].y}
                r="3.5"
                fill="#030712"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <circle
                cx={liveCoords[inspectedIdx].x}
                cy={liveCoords[inspectedIdx].y}
                r="4.5"
                fill={activeColor}
                stroke="#030712"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[11px] text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: activeColor }} />
            <span>Live Telemetry Stream</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-[#94A3B8]" />
            <span>OSDR Archival Baseline</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#00FF66]/15 border border-[#00FF66]/40" />
            <span>Nominal Envelope</span>
          </span>
        </div>
      </div>
    </section>
  );
}
