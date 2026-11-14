import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import {
  OsdrDatasetRecord,
  ProvenanceMode,
  TelemetryLogEntry,
  TelemetrySeverity,
} from '../types/telemetry';
import { ProvenanceBadge, StatusPill } from './ProvenanceAndStatus';

export interface OperatorAuditRecord {
  id: string;
  callsign: string;
  actionType: string;
  targetRef: string;
  metFormatted: string;
  summary: string;
}

interface ArchiveScreenProps {
  datasets: OsdrDatasetRecord[];
  logs: TelemetryLogEntry[];
  onExportCsv: () => void;
  activeDatasetId: string;
  onSelectDataset: (accessionId: string) => void;
  operatorActions?: OperatorAuditRecord[];
}

export function ArchiveScreen({
  datasets,
  logs,
  onExportCsv,
  activeDatasetId,
  onSelectDataset,
  operatorActions = [],
}: ArchiveScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [provenanceFilter, setProvenanceFilter] = useState<'ALL' | ProvenanceMode>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | TelemetrySeverity>('ALL');

  const filteredLogs = logs.filter((entry) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      entry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.crewCallsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.parameter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.datasetRef.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProv = provenanceFilter === 'ALL' || entry.provenance === provenanceFilter;
    const matchesSev = severityFilter === 'ALL' || entry.severity === severityFilter;
    return matchesSearch && matchesProv && matchesSev;
  });

  return (
    <div className="space-y-5">
      {/* NASA OSDR Reference Datasets */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#F8FAFC]">
              NASA OSDR Archive &amp; Provenance Log
            </h1>
            <p className="font-mono text-xs text-[#94A3B8] mt-0.5">
              Compare validated historical flight cohorts ([OSDR-FLT]) against live simulated runs ([SIM-RUN]).
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-[#00F0FF] px-4 py-2 font-mono text-xs font-bold text-[#030712] uppercase tracking-wider hover:bg-[#7df4ff] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Export Telemetry CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {datasets.map((ds) => {
            const isSelected = ds.accessionId === activeDatasetId;
            const isUploadedReport = ds.accessionId.startsWith('RPT-');
            return (
              <button
                key={ds.accessionId}
                type="button"
                onClick={() => onSelectDataset(ds.accessionId)}
                className={`flex flex-col justify-between gap-3 rounded-lg p-4 text-left transition-all ${
                  isSelected ? 'hud-panel-tier2' : 'hud-panel-tier1 hover:border-[#00F0FF]/50'
                }`}
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <ProvenanceBadge mode="OSDR-FLT" datasetRef={ds.accessionId} />
                    <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                      {isUploadedReport ? 'UPLOADED REPORT' : `n=${ds.cohortSize} · ${ds.durationHours}h`}
                    </span>
                  </div>
                  <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                    {ds.missionName}
                  </h2>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{ds.notes}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-[#00F0FF]/15 pt-3 font-mono text-xs w-full tabular-nums">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">MEAN SpO2</span>
                    <span className="text-[#00FF66] font-semibold">{ds.meanSpo2.toFixed(1)} %</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">MEAN HR</span>
                    <span className="text-[#F8FAFC] font-semibold">{ds.meanHr.toFixed(1)} BPM</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">MEAN RAD</span>
                    <span className="text-[#00F0FF] font-semibold">{ds.meanRadiationMsvH.toFixed(2)} mSv/h</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">CORE TEMP</span>
                    <span className="text-[#F8FAFC] font-semibold">{ds.meanCoreTemp.toFixed(1)} °C</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filterable Telemetry Event Log */}
      <section className="hud-panel-tier1 rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[#00F0FF]/15 pb-3">
          <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
            Mission Telemetry Event Stream
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter parameter, crew, or ref..."
                aria-label="Search telemetry logs"
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] pl-9 pr-3 font-mono text-xs text-[#F8FAFC] placeholder:text-[#94A3B8] focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            {/* Provenance Filter */}
            <div className="flex items-center rounded border border-[#00F0FF]/25 bg-[#030712] p-0.5 font-mono text-xs">
              {(['ALL', 'OSDR-FLT', 'SIM-RUN'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setProvenanceFilter(mode)}
                  className={`min-h-[34px] rounded-sm px-2.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    provenanceFilter === mode
                      ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Severity Filter */}
            <div className="flex items-center rounded border border-[#00F0FF]/25 bg-[#030712] p-0.5 font-mono text-xs">
              {(['ALL', 'nominal', 'advisory', 'critical'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`min-h-[34px] rounded-sm px-2.5 py-1 uppercase transition-colors whitespace-nowrap shrink-0 ${
                    severityFilter === sev
                      ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#00F0FF]/20 font-mono text-[11px] uppercase text-[#94A3B8]">
                <th className="py-2.5 pr-4">MET / UTC</th>
                <th className="py-2.5 pr-4">Provenance</th>
                <th className="py-2.5 pr-4">Crew</th>
                <th className="py-2.5 pr-4">Parameter</th>
                <th className="py-2.5 pr-4">Severity</th>
                <th className="py-2.5">Telemetry Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#00F0FF]/10 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-[#94A3B8]">
                    No telemetry records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0B132B]/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-[#F8FAFC] whitespace-nowrap tabular-nums">
                      <div>{log.met}</div>
                      <div className="text-[10px] text-[#94A3B8]">{log.timestampUtc}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <ProvenanceBadge mode={log.provenance} datasetRef={log.datasetRef} />
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-[#00F0FF] whitespace-nowrap">
                      {log.crewCallsign}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[#F8FAFC] whitespace-nowrap tabular-nums">
                      <span className="text-[#94A3B8]">{log.parameter}:</span>{' '}
                      <span className="font-semibold">{log.reading}</span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <StatusPill severity={log.severity} compact />
                    </td>
                    <td className="py-3 text-[#dce2f9] min-w-[260px]">{log.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Persisted Firestore Operator Command Audit */}
      <section className="hud-panel-tier1 rounded-lg p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00F0FF]/15 pb-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
              Operator Command Audit Trail
            </h2>
            <p className="font-mono text-xs text-[#94A3B8]">
              Authenticated actions persisted to Firestore across mission sessions.
            </p>
          </div>
          <span className="font-mono text-xs text-[#00F0FF] tabular-nums">
            {operatorActions.length} RECORDS
          </span>
        </div>

        {operatorActions.length === 0 ? (
          <p className="py-4 text-center font-mono text-xs text-[#94A3B8]">
            No operator commands recorded in this account yet. Trigger a contingency, seal a hatch, or verify a checklist step to log an entry.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#00F0FF]/20 font-mono text-[11px] uppercase text-[#94A3B8]">
                  <th className="py-2 pr-4">MET</th>
                  <th className="py-2 pr-4">Callsign</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#00F0FF]/10 text-xs">
                {operatorActions.map((act) => (
                  <tr key={act.id} className="hover:bg-[#0B132B]/50">
                    <td className="py-2.5 pr-4 font-mono text-[#F8FAFC] whitespace-nowrap tabular-nums">
                      {act.metFormatted}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-semibold text-[#00F0FF] whitespace-nowrap">
                      {act.callsign}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[#00FF66] whitespace-nowrap">
                      {act.actionType}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[#dce2f9] whitespace-nowrap">
                      {act.targetRef}
                    </td>
                    <td className="py-2.5 text-[#dce2f9]">{act.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
