import { Router } from 'express';
import { telemetryEngine } from '../store/telemetryEngine.ts';
import type {
  ContingencyScenarioId,
  ProvenanceMode,
  TelemetrySeverity,
  VitalKey,
} from '../types.ts';

export const telemetryRouter = Router();

telemetryRouter.get('/health', (_req, res) => {
  const snap = telemetryEngine.getSnapshot();
  res.json({
    status: 'ok',
    service: 'orbital-telemetry-backend',
    metSeconds: snap.metSeconds,
    metFormatted: snap.metFormatted,
    overallSeverity: snap.overallSeverity,
    isStreaming: snap.isStreaming,
  });
});

telemetryRouter.get('/telemetry/state', (_req, res) => {
  res.json(telemetryEngine.getSnapshot());
});

telemetryRouter.post('/telemetry/stream', (req, res) => {
  const { isStreaming } = req.body as { isStreaming?: boolean };
  if (typeof isStreaming !== 'boolean') {
    res.status(400).json({ error: 'isStreaming boolean is required' });
    return;
  }
  res.json(telemetryEngine.setStreaming(isStreaming));
});

telemetryRouter.post('/telemetry/provenance', (req, res) => {
  const { provenanceMode, activeDatasetId } = req.body as {
    provenanceMode?: ProvenanceMode;
    activeDatasetId?: string;
  };
  if (provenanceMode !== 'OSDR-FLT' && provenanceMode !== 'SIM-RUN') {
    res.status(400).json({ error: 'provenanceMode must be OSDR-FLT or SIM-RUN' });
    return;
  }
  res.json(telemetryEngine.setProvenance(provenanceMode, activeDatasetId));
});

telemetryRouter.post('/telemetry/ingest', (req, res) => {
  const { crewId, parameter, value, provenance, datasetRef } = req.body as {
    crewId?: string;
    parameter?: VitalKey;
    value?: number;
    provenance?: ProvenanceMode;
    datasetRef?: string;
  };
  if (!crewId || !parameter || typeof value !== 'number' || Number.isNaN(value)) {
    res.status(400).json({ error: 'crewId, parameter, and numeric value are required' });
    return;
  }
  res.json(
    telemetryEngine.ingestTelemetry({
      crewId,
      parameter,
      value,
      provenance,
      datasetRef,
    })
  );
});

telemetryRouter.post('/contingency/scenario', (req, res) => {
  const { scenarioId, crewId } = req.body as {
    scenarioId?: ContingencyScenarioId;
    crewId?: string;
  };
  const validIds: ContingencyScenarioId[] = [
    'nominal-eva',
    'suit-decompression',
    'solar-particle-event',
    'co2-scrubber-drift',
  ];
  if (!scenarioId || !validIds.includes(scenarioId)) {
    res.status(400).json({ error: 'Invalid scenarioId' });
    return;
  }
  res.json(telemetryEngine.selectScenario(scenarioId, crewId));
});

telemetryRouter.post('/contingency/acknowledge', (req, res) => {
  const { crewId } = req.body as { crewId?: string };
  res.json(telemetryEngine.acknowledgeAlert(crewId ?? 'eva-01'));
});

telemetryRouter.patch('/contingency/steps/:scenarioId/:stepId', (req, res) => {
  const { scenarioId, stepId } = req.params as {
    scenarioId: ContingencyScenarioId;
    stepId: string;
  };
  res.json(telemetryEngine.toggleProtocolStep(scenarioId, stepId));
});

telemetryRouter.patch('/sectors/:sectorId/hatch', (req, res) => {
  const { sectorId } = req.params;
  res.json(telemetryEngine.toggleHatch(sectorId));
});

telemetryRouter.get('/osdr/datasets', (_req, res) => {
  res.json({ datasets: telemetryEngine.getSnapshot().datasets });
});

telemetryRouter.get('/logs', (req, res) => {
  const provenance = req.query.provenance as ProvenanceMode | undefined;
  const severity = req.query.severity as TelemetrySeverity | undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const logs = telemetryEngine.getSnapshot().logs.filter((entry) => {
    if (provenance && entry.provenance !== provenance) return false;
    if (severity && entry.severity !== severity) return false;
    if (
      q &&
      !entry.message.toLowerCase().includes(q) &&
      !entry.crewCallsign.toLowerCase().includes(q) &&
      !entry.parameter.toLowerCase().includes(q) &&
      !entry.datasetRef.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  res.json({ logs });
});

telemetryRouter.get('/logs/export.csv', (_req, res) => {
  const snap = telemetryEngine.getSnapshot();
  const csv = telemetryEngine.exportCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orbital-telemetry-${snap.metFormatted.replace(/[:+]/g, '-')}.csv"`
  );
  res.send(csv);
});
