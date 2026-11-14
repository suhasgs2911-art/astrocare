import { VitalMetric } from '../types/telemetry';
import { StatusPill } from './ProvenanceAndStatus';

interface TelemetryCardProps {
  metric: VitalMetric;
  selected: boolean;
  onSelect: () => void;
  showOsdrOverlay: boolean;
}

function buildSparklinePoints(
  values: number[],
  minVal: number,
  maxVal: number,
  width: number,
  height: number
): string {
  if (values.length === 0) return '';
  const span = Math.max(0.0001, maxVal - minVal);
  return values
    .map((val, idx) => {
      const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
      const normalized = Math.min(1, Math.max(0, (val - minVal) / span));
      const y = height - normalized * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function TelemetryCard({
  metric,
  selected,
  onSelect,
  showOsdrOverlay,
}: TelemetryCardProps) {
  const tierClass =
    metric.severity === 'critical'
      ? 'hud-panel-critical'
      : metric.severity === 'advisory'
      ? 'hud-panel-advisory'
      : selected
      ? 'hud-panel-tier2'
      : 'hud-panel-tier1 hover:border-[#00F0FF]/50';

  const strokeColor =
    metric.severity === 'critical'
      ? '#FF2A55'
      : metric.severity === 'advisory'
      ? '#FFB703'
      : '#00F0FF';

  const allValues = [...metric.history, ...metric.osdrBaselineHistory, metric.minBound, metric.maxBound];
  const minDomain = Math.min(...allValues);
  const maxDomain = Math.max(...allValues);
  const livePoints = buildSparklinePoints(metric.history, minDomain, maxDomain, 220, 44);
  const osdrPoints = buildSparklinePoints(metric.osdrBaselineHistory, minDomain, maxDomain, 220, 44);

  const histMin = Math.min(...metric.history);
  const histMax = Math.max(...metric.history);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full flex-col justify-between gap-3 rounded-lg p-4 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF] ${tierClass}`}
    >
      {/* Zone 1: Micro Header */}
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="font-mono text-xs font-semibold tracking-wider text-[#94A3B8] uppercase truncate">
          {metric.shortLabel}
        </span>
        <StatusPill severity={metric.severity} compact />
      </div>

      {/* Zone 2: Value Anchor */}
      <div className="flex items-baseline justify-between gap-2 w-full">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-bold tracking-tight text-[#F8FAFC] tabular-nums">
            {metric.value.toFixed(metric.decimals)}
          </span>
          <span className="font-mono text-xs font-medium text-[#94A3B8] uppercase">
            {metric.unit}
          </span>
        </div>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            metric.severity === 'critical'
              ? 'text-[#FF2A55]'
              : metric.severity === 'advisory'
              ? 'text-[#FFB703]'
              : 'text-[#00FF66]'
          }`}
        >
          {metric.deltaPerMin >= 0 ? '+' : ''}
          {metric.deltaPerMin.toFixed(metric.decimals === 0 ? 1 : metric.decimals)}/m
        </span>
      </div>

      {/* Zone 3: Sparkline & Trajectory Bounds */}
      <div className="w-full space-y-1.5">
        <svg
          viewBox="0 0 220 44"
          className="h-11 w-full overflow-visible"
          aria-hidden="true"
        >
          {showOsdrOverlay && (
            <polyline
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              strokeOpacity="0.6"
              points={osdrPoints}
            />
          )}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={livePoints}
          />
        </svg>
        <div className="flex items-center justify-between font-mono text-[10px] text-[#94A3B8] tabular-nums">
          <span>
            MIN {histMin.toFixed(metric.decimals)} · MAX {histMax.toFixed(metric.decimals)}
          </span>
          <span>
            ENV [{metric.minBound.toFixed(metric.decimals)}–{metric.maxBound.toFixed(metric.decimals)}]
          </span>
        </div>
      </div>
    </button>
  );
}
