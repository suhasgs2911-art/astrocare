import { ProvenanceMode, TelemetrySeverity } from '../types/telemetry';

export function ProvenanceBadge({
  mode,
  datasetRef,
}: {
  mode: ProvenanceMode;
  datasetRef?: string;
}) {
  if (mode === 'OSDR-FLT') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap shrink-0"
        style={{
          backgroundColor: 'rgba(0, 240, 255, 0.12)',
          color: '#00F0FF',
          border: '1px solid #00F0FF',
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <polygon points="5,1 9,5 5,9 1,5" stroke="#00F0FF" strokeWidth="1.2" />
          <circle cx="5" cy="5" r="1.4" fill="#00F0FF" />
        </svg>
        <span>[OSDR-FLT]{datasetRef ? ` ${datasetRef}` : ''}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap shrink-0"
      style={{
        backgroundColor: 'rgba(255, 183, 3, 0.12)',
        color: '#FFB703',
        border: '1px dashed #FFB703',
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M5 1.5L9 8.5H1L5 1.5Z" stroke="#FFB703" strokeWidth="1.2" />
      </svg>
      <span>[SIM-RUN]{datasetRef ? ` ${datasetRef}` : ''}</span>
    </span>
  );
}

export function StatusPill({
  severity,
  compact = false,
}: {
  severity: TelemetrySeverity;
  compact?: boolean;
}) {
  if (severity === 'nominal') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap shrink-0"
        style={{
          backgroundColor: '#022413',
          color: '#00FF66',
          border: '1px solid rgba(0, 255, 102, 0.35)',
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            backgroundColor: '#00FF66',
            boxShadow: '0 0 6px #00FF66',
          }}
          aria-hidden="true"
        />
        <span>{compact ? 'NOM' : 'NOMINAL'}</span>
      </span>
    );
  }

  if (severity === 'advisory') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap shrink-0"
        style={{
          backgroundColor: '#261A02',
          color: '#FFB703',
          border: '1px solid rgba(255, 183, 3, 0.45)',
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
          style={{
            backgroundColor: '#FFB703',
            boxShadow: '0 0 6px #FFB703',
          }}
          aria-hidden="true"
        />
        <span>{compact ? 'ADV' : 'ADVISORY'}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap shrink-0"
      style={{
        backgroundColor: '#2B050E',
        color: '#FF2A55',
        border: '1px solid rgba(255, 42, 85, 0.55)',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full animate-ping shrink-0"
        style={{
          backgroundColor: '#FF2A55',
          boxShadow: '0 0 8px #FF2A55',
        }}
        aria-hidden="true"
      />
      <span>{compact ? 'CRIT' : 'CRITICAL'}</span>
    </span>
  );
}
