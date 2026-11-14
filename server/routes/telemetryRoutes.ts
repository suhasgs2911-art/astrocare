import { Router } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { telemetryEngine } from '../store/telemetryEngine.ts';
import { requireFirebaseAuth } from '../middleware/authMiddleware.ts';
import type {
  ContingencyScenarioId,
  ProvenanceMode,
  TelemetrySeverity,
  VitalKey,
} from '../types.ts';

export const telemetryRouter = Router();

const UPLOAD_DIR = path.join(os.tmpdir(), 'orbital-medical-uploads');

interface StoredFileMeta {
  fileId: string;
  ownerUid: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  diskPath: string;
}

const uploadedFilesIndex = new Map<string, StoredFileMeta>();

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

// Require verified Firebase ID token for every /api route except GET /api/health
telemetryRouter.use(requireFirebaseAuth);

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

telemetryRouter.post('/telemetry/calibrate', (req, res) => {
  const {
    crewCallsign,
    subjectName,
    subjectRole,
    fileName,
    issuer,
    recordCategory,
    clearanceStatus,
    baselineSpo2,
    baselineHr,
    baselineCoreTemp,
    baselineRadFlux,
    baselineHrv,
    baselineSuitPressure,
    baselinePpCO2,
    baselineO2Reserve,
    parsedSummary,
  } = req.body as {
    crewCallsign?: string;
    subjectName?: string;
    subjectRole?: string;
    fileName?: string;
    issuer?: string;
    recordCategory?: 'MEDICAL_STATS' | 'CERTIFICATE';
    clearanceStatus?: 'CLEARED_EVA' | 'HAB_ONLY' | 'REVIEW_REQUIRED';
    baselineSpo2?: number;
    baselineHr?: number;
    baselineCoreTemp?: number;
    baselineRadFlux?: number;
    baselineHrv?: number;
    baselineSuitPressure?: number;
    baselinePpCO2?: number;
    baselineO2Reserve?: number;
    parsedSummary?: string;
  };

  if (
    !crewCallsign ||
    !fileName ||
    typeof baselineSpo2 !== 'number' ||
    typeof baselineHr !== 'number'
  ) {
    res.status(400).json({
      error: 'crewCallsign, fileName, baselineSpo2, and baselineHr are required',
    });
    return;
  }

  res.json(
    telemetryEngine.calibrateFromMedicalRecord({
      crewCallsign,
      subjectName,
      subjectRole,
      fileName,
      issuer,
      recordCategory,
      clearanceStatus: clearanceStatus ?? 'CLEARED_EVA',
      baselineSpo2,
      baselineHr,
      baselineCoreTemp,
      baselineRadFlux,
      baselineHrv,
      baselineSuitPressure,
      baselinePpCO2,
      baselineO2Reserve,
      parsedSummary,
    })
  );
});

telemetryRouter.post('/telemetry/sync', (req, res) => {
  const { records } = req.body as {
    records?: Array<{
      crewCallsign: string;
      subjectName?: string;
      subjectRole?: string;
      fileName: string;
      issuer?: string;
      recordCategory?: 'MEDICAL_STATS' | 'CERTIFICATE';
      clearanceStatus: 'CLEARED_EVA' | 'HAB_ONLY' | 'REVIEW_REQUIRED';
      baselineSpo2: number;
      baselineHr: number;
      baselineCoreTemp?: number;
      baselineRadFlux?: number;
      baselineHrv?: number;
      baselineSuitPressure?: number;
      baselinePpCO2?: number;
      baselineO2Reserve?: number;
      parsedSummary?: string;
    }>;
  };

  if (!Array.isArray(records)) {
    res.status(400).json({ error: 'records array is required' });
    return;
  }

  res.json(telemetryEngine.syncMedicalRecords(records));
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
  res.json(telemetryEngine.acknowledgeAlert(crewId));
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

// Upload previous medical stats or clearance certificate binary/text file
telemetryRouter.post('/medical/files', async (req, res) => {
  const { fileName, mimeType, base64Content } = req.body as {
    fileName?: string;
    mimeType?: string;
    base64Content?: string;
  };

  if (!fileName || !mimeType || !base64Content) {
    res.status(400).json({ error: 'fileName, mimeType, and base64Content are required' });
    return;
  }

  const buffer = Buffer.from(base64Content, 'base64');
  if (buffer.byteLength > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'File exceeds 10 MB maximum upload limit' });
    return;
  }

  const fileId = `med-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const safeBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const diskPath = path.join(UPLOAD_DIR, `${fileId}-${safeBaseName}`);
  await fs.writeFile(diskPath, buffer);

  uploadedFilesIndex.set(fileId, {
    fileId,
    ownerUid: req.uid!,
    fileName: safeBaseName,
    mimeType,
    sizeBytes: buffer.byteLength,
    diskPath,
  });

  res.status(201).json({
    fileId,
    fileName: safeBaseName,
    mimeType,
    sizeBytes: buffer.byteLength,
  });
});

telemetryRouter.get('/medical/files/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const meta = uploadedFilesIndex.get(fileId);
  if (!meta) {
    res.status(404).json({ error: 'Uploaded file not found in active server cache' });
    return;
  }
  if (meta.ownerUid !== req.uid) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this medical file' });
    return;
  }

  try {
    const content = await fs.readFile(meta.diskPath);
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${meta.fileName}"`);
    res.send(content);
  } catch {
    res.status(404).json({ error: 'Uploaded file unavailable on disk' });
  }
});

telemetryRouter.delete('/medical/files/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const meta = uploadedFilesIndex.get(fileId);
  if (meta) {
    if (meta.ownerUid !== req.uid) {
      res.status(403).json({ error: 'Forbidden: You do not own this medical file' });
      return;
    }
    uploadedFilesIndex.delete(fileId);
    try {
      await fs.unlink(meta.diskPath);
    } catch {
      // Ignore missing temp file
    }
  }
  res.json({ deleted: true });
});
