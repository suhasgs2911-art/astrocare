import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Award,
  Trash2,
  Eye,
  Download,
  Activity,
  CheckCircle2,
  X,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  ClearanceStatus,
  MedicalRecordCategory,
  MedicalRecordItem,
} from '../types/telemetry';
import { authorizedFetch } from '../utils/authorizedFetch';

export interface MedicalUploadPayload {
  crewCallsign: string;
  subjectName: string;
  subjectRole: string;
  recordCategory: MedicalRecordCategory;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  serverFileId: string;
  issuer: string;
  clearanceStatus: ClearanceStatus;
  parsedSummary: string;
  baselineSpo2: number;
  baselineHr: number;
  baselineCoreTemp: number;
  baselineRadFlux: number;
  baselineHrv: number;
  baselineSuitPressure: number;
  baselinePpCO2: number;
  baselineO2Reserve: number;
}

interface MedicalRecordsScreenProps {
  operatorDisplayName: string;
  records: MedicalRecordItem[];
  activeRecordId: string | null;
  onUploadRecord: (payload: MedicalUploadPayload) => Promise<void>;
  onDeleteRecord: (record: MedicalRecordItem) => Promise<void>;
  onApplyBaseline: (record: MedicalRecordItem) => Promise<void>;
  onProceedToFlightDeck: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function deriveCallsign(name: string, indexHint = 1): string {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (letters.length === 0) return `MED-${String(indexHint).padStart(2, '0')}`;
  const prefix =
    letters.length >= 2
      ? `${letters[0].slice(0, 2)}${letters[1].slice(0, 2)}`
      : letters[0].slice(0, 4);
  return `${prefix}-${String(indexHint).padStart(2, '0')}`.slice(0, 24);
}

function sanitizeCallsignInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  return cleaned.length >= 2 ? cleaned : 'SUBJ-01';
}

interface ParsedMedicalData {
  subjectName?: string;
  callsign?: string;
  subjectRole?: string;
  issuer?: string;
  clearanceStatus?: ClearanceStatus;
  spo2?: number;
  hr?: number;
  coreTemp?: number;
  radFlux?: number;
  hrv?: number;
  suitPressure?: number;
  ppCO2?: number;
  o2Reserve?: number;
  summary: string;
}

function parseMedicalText(text: string, fileName: string): ParsedMedicalData {
  const result: ParsedMedicalData = {
    summary: '',
  };

  if (fileName.toLowerCase().endsWith('.json')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const rawName = parsed.subjectName ?? parsed.patientName ?? parsed.patient ?? parsed.name ?? parsed.full_name;
      if (typeof rawName === 'string' && rawName.trim()) result.subjectName = rawName.trim().slice(0, 60);

      const rawId = parsed.callsign ?? parsed.crewCallsign ?? parsed.patientId ?? parsed.id;
      if (typeof rawId === 'string' && rawId.trim()) result.callsign = sanitizeCallsignInput(rawId);

      const rawRole = parsed.role ?? parsed.subjectRole ?? parsed.assignment;
      if (typeof rawRole === 'string' && rawRole.trim()) result.subjectRole = rawRole.trim().slice(0, 50);

      const rawIssuer = parsed.issuer ?? parsed.clinic ?? parsed.hospital ?? parsed.lab;
      if (typeof rawIssuer === 'string' && rawIssuer.trim()) result.issuer = rawIssuer.trim().slice(0, 100);

      const rawClearance = String(parsed.clearanceStatus ?? parsed.clearance ?? '').toUpperCase();
      if (rawClearance.includes('HAB')) result.clearanceStatus = 'HAB_ONLY';
      else if (rawClearance.includes('REVIEW') || rawClearance.includes('HOLD')) result.clearanceStatus = 'REVIEW_REQUIRED';
      else if (rawClearance.includes('CLEARED') || rawClearance.includes('EVA')) result.clearanceStatus = 'CLEARED_EVA';

      const nSpo2 = Number(parsed.spo2 ?? parsed.SpO2 ?? parsed.meanSpo2);
      const nHr = Number(parsed.heartRate ?? parsed.hr ?? parsed.bpm ?? parsed.meanHr);
      const nTemp = Number(parsed.coreTemp ?? parsed.core_temp_c ?? parsed.temp);
      const nRad = Number(parsed.radiationFlux ?? parsed.rad_flux_msv_h ?? parsed.radiation);
      const nHrv = Number(parsed.hrv ?? parsed.rmssd);
      const nPress = Number(parsed.suitPressure ?? parsed.pressure ?? parsed.pressureKpa);
      const nCo2 = Number(parsed.ppCO2 ?? parsed.co2);
      const nO2 = Number(parsed.o2Reserve ?? parsed.o2ReservePct);

      if (!Number.isNaN(nSpo2) && nSpo2 >= 50 && nSpo2 <= 100) result.spo2 = nSpo2;
      if (!Number.isNaN(nHr) && nHr >= 30 && nHr <= 240) result.hr = Math.round(nHr);
      if (!Number.isNaN(nTemp) && nTemp >= 33 && nTemp <= 42) result.coreTemp = nTemp;
      if (!Number.isNaN(nRad) && nRad >= 0 && nRad <= 10) result.radFlux = nRad;
      if (!Number.isNaN(nHrv) && nHrv >= 5 && nHrv <= 150) result.hrv = nHrv;
      if (!Number.isNaN(nPress) && nPress >= 15 && nPress <= 110) result.suitPressure = nPress;
      if (!Number.isNaN(nCo2) && nCo2 >= 0 && nCo2 <= 3) result.ppCO2 = nCo2;
      if (!Number.isNaN(nO2) && nO2 >= 5 && nO2 <= 100) result.o2Reserve = nO2;
    } catch {
      // Fallback to text extraction below
    }
  }

  // CSV header + first/last data row extraction
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length >= 2 && lines[0].includes(',')) {
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const lastRow = lines[lines.length - 1].split(',').map((v) => v.trim());
    headers.forEach((h, idx) => {
      const val = lastRow[idx];
      if (!val) return;
      if ((h.includes('name') || h.includes('patient') || h.includes('subject')) && !result.subjectName) {
        result.subjectName = val.slice(0, 60);
      } else if ((h.includes('callsign') || h === 'id' || h.includes('patient_id')) && !result.callsign) {
        result.callsign = sanitizeCallsignInput(val);
      } else if ((h.includes('issuer') || h.includes('clinic') || h.includes('hospital') || h.includes('lab')) && !result.issuer) {
        result.issuer = val.slice(0, 100);
      } else if (h.includes('role') && !result.subjectRole) {
        result.subjectRole = val.slice(0, 50);
      } else if (h.includes('spo2') || h.includes('oxygen_sat')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 50 && n <= 100) result.spo2 = n;
      } else if (h.includes('heart') || h === 'hr' || h.includes('bpm')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 30 && n <= 240) result.hr = Math.round(n);
      } else if (h.includes('temp')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 33 && n <= 42) result.coreTemp = n;
      } else if (h.includes('rad')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 0 && n <= 10) result.radFlux = n;
      } else if (h.includes('hrv') || h.includes('rmssd')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 5 && n <= 150) result.hrv = n;
      } else if (h.includes('press')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 15 && n <= 110) result.suitPressure = n;
      } else if (h.includes('co2')) {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 0 && n <= 3) result.ppCO2 = n;
      }
    });
  }

  // Regex key-value fallback for TXT/PDF/receipt text
  const nameMatch = text.match(/(?:patient|subject|name)\s*[:=]\s*([A-Za-z][A-Za-z .'-]{1,50})/i);
  if (nameMatch && !result.subjectName) result.subjectName = nameMatch[1].trim();

  const issuerMatch = text.match(/(?:clinic|hospital|lab|issuer|physician|facility)\s*[:=]\s*([A-Za-z0-9 .,'&-]{2,80})/i);
  if (issuerMatch && !result.issuer) result.issuer = issuerMatch[1].trim();

  const lower = text.toLowerCase();
  if (result.spo2 === undefined) {
    const m = lower.match(/(?:spo2|o2_sat|oxygen\s*sat)[^0-9]{0,14}(\d{2,3}(?:\.\d+)?)/);
    if (m && Number(m[1]) >= 50 && Number(m[1]) <= 100) result.spo2 = Number(m[1]);
  }
  if (result.hr === undefined) {
    const m = lower.match(/(?:heart_?rate|pulse|\bhr\b|\bbpm\b)[^0-9]{0,14}(\d{2,3}(?:\.\d+)?)/);
    if (m && Number(m[1]) >= 30 && Number(m[1]) <= 240) result.hr = Math.round(Number(m[1]));
  }
  if (result.coreTemp === undefined) {
    const m = lower.match(/(?:core_?temp|body\s*temp|temp(?:erature)?)[^0-9]{0,14}(\d{2}(?:\.\d+)?)/);
    if (m && Number(m[1]) >= 33 && Number(m[1]) <= 42) result.coreTemp = Number(m[1]);
  }
  if (result.radFlux === undefined) {
    const m = lower.match(/(?:rad_?flux|radiation|dosimetry)[^0-9]{0,14}(\d+(?:\.\d+)?)/);
    if (m && Number(m[1]) >= 0 && Number(m[1]) <= 10) result.radFlux = Number(m[1]);
  }
  if (result.hrv === undefined) {
    const m = lower.match(/(?:hrv|rmssd)[^0-9]{0,14}(\d{1,3}(?:\.\d+)?)/);
    if (m && Number(m[1]) >= 5 && Number(m[1]) <= 150) result.hrv = Number(m[1]);
  }

  result.summary = `Extracted report details from ${fileName} (${lines.length} lines).`;
  return result;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

export function extractSubjectFromSummary(summary: string, fallbackCallsign: string): {
  subjectName: string;
  subjectRole: string;
} {
  const nameMatch = summary.match(/Subject:\s*([^|·\n]+)/i);
  const roleMatch = summary.match(/Role:\s*([^|·\n]+)/i);
  return {
    subjectName: nameMatch ? nameMatch[1].trim() : fallbackCallsign,
    subjectRole: roleMatch ? roleMatch[1].trim() : 'Medical Report Subject',
  };
}

export function MedicalRecordsScreen({
  operatorDisplayName,
  records,
  activeRecordId,
  onUploadRecord,
  onDeleteRecord,
  onApplyBaseline,
  onProceedToFlightDeck,
}: MedicalRecordsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialName = operatorDisplayName.trim() || 'Flight Operator';
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [subjectName, setSubjectName] = useState(initialName);
  const [crewCallsign, setCrewCallsign] = useState(deriveCallsign(initialName, records.length + 1));
  const [subjectRole, setSubjectRole] = useState('Medical Report Subject');
  const [recordCategory, setRecordCategory] = useState<MedicalRecordCategory>('MEDICAL_STATS');
  const [issuer, setIssuer] = useState('Aeromedical Clinic / Diagnostic Lab');
  const [clearanceStatus, setClearanceStatus] = useState<ClearanceStatus>('CLEARED_EVA');

  const [baselineSpo2, setBaselineSpo2] = useState<number>(98.4);
  const [baselineHr, setBaselineHr] = useState<number>(72);
  const [baselineCoreTemp, setBaselineCoreTemp] = useState<number>(37.0);
  const [baselineRadFlux, setBaselineRadFlux] = useState<number>(0.36);
  const [baselineHrv, setBaselineHrv] = useState<number>(48.0);
  const [baselineSuitPressure, setBaselineSuitPressure] = useState<number>(29.6);
  const [baselinePpCO2, setBaselinePpCO2] = useState<number>(0.34);
  const [baselineO2Reserve, setBaselineO2Reserve] = useState<number>(84.0);
  const [notes, setNotes] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<MedicalRecordItem | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewRecord?.serverFileId) {
      setPreviewBlobUrl(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewBlobUrl(null);

    void authorizedFetch(`/api/medical/files/${previewRecord.serverFileId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || 'Unable to load protected medical file.');
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPreviewBlobUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error ? err.message : 'Unable to preview medical file.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewRecord]);

  const handlePickedFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds 10 MB maximum allowed size.');
      return;
    }

    setSelectedFile(file);
    const lowerName = file.name.toLowerCase();
    const isTextLike =
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.pdf');

    setRecordCategory(
      lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.webp')
        ? 'CERTIFICATE'
        : 'MEDICAL_STATS'
    );

    if (isTextLike) {
      try {
        const text = await file.text();
        const parsed = parseMedicalText(text, file.name);
        if (parsed.subjectName) {
          setSubjectName(parsed.subjectName);
          if (!parsed.callsign) {
            setCrewCallsign(deriveCallsign(parsed.subjectName, records.length + 1));
          }
        }
        if (parsed.callsign) setCrewCallsign(parsed.callsign);
        if (parsed.subjectRole) setSubjectRole(parsed.subjectRole);
        if (parsed.issuer) setIssuer(parsed.issuer);
        if (parsed.clearanceStatus) setClearanceStatus(parsed.clearanceStatus);
        if (parsed.spo2 !== undefined) setBaselineSpo2(parsed.spo2);
        if (parsed.hr !== undefined) setBaselineHr(parsed.hr);
        if (parsed.coreTemp !== undefined) setBaselineCoreTemp(parsed.coreTemp);
        if (parsed.radFlux !== undefined) setBaselineRadFlux(parsed.radFlux);
        if (parsed.hrv !== undefined) setBaselineHrv(parsed.hrv);
        if (parsed.suitPressure !== undefined) setBaselineSuitPressure(parsed.suitPressure);
        if (parsed.ppCO2 !== undefined) setBaselinePpCO2(parsed.ppCO2);
        if (parsed.o2Reserve !== undefined) setBaselineO2Reserve(parsed.o2Reserve);
        setNotes(parsed.summary);
      } catch {
        setNotes(`Attached medical receipt / report: ${file.name}`);
      }
    } else {
      setNotes(`Attached medical receipt / certificate image: ${file.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Select a medical report or receipt file before uploading.');
      return;
    }

    const safeName = subjectName.trim() || initialName;
    const safeCallsign = sanitizeCallsignInput(
      crewCallsign || deriveCallsign(safeName, records.length + 1)
    );
    const safeRole = subjectRole.trim() || 'Medical Report Subject';
    const safeIssuer = issuer.trim() || 'Aeromedical Clinic';

    // Encode structured report details cleanly within Firestore's 400-char parsedSummary limit
    const detailHeader = `Subject: ${safeName.slice(0, 40)} | Role: ${safeRole.slice(0, 32)} | Core Temp ${baselineCoreTemp.toFixed(1)}°C · Rad Flux ${baselineRadFlux.toFixed(2)} mSv/h · HRV ${baselineHrv.toFixed(1)} ms · Press ${baselineSuitPressure.toFixed(1)} kPa · ppCO2 ${baselinePpCO2.toFixed(2)} kPa · O2 ${baselineO2Reserve.toFixed(0)}%`;
    const combinedSummary = (notes.trim() ? `${detailHeader} | ${notes.trim()}` : detailHeader).slice(0, 395);

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const base64Content = await fileToBase64(selectedFile);
      const res = await authorizedFetch('/api/medical/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          base64Content,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Backend file upload failed.');
      }

      const uploaded = (await res.json()) as {
        fileId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      };

      await onUploadRecord({
        crewCallsign: safeCallsign,
        subjectName: safeName,
        subjectRole: safeRole,
        recordCategory,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        fileSizeBytes: uploaded.sizeBytes,
        serverFileId: uploaded.fileId,
        issuer: safeIssuer,
        clearanceStatus,
        parsedSummary: combinedSummary,
        baselineSpo2: Number.isFinite(baselineSpo2) ? Math.min(100, Math.max(0, baselineSpo2)) : 98.4,
        baselineHr: Number.isFinite(baselineHr) ? Math.min(260, Math.max(0, baselineHr)) : 72,
        baselineCoreTemp,
        baselineRadFlux,
        baselineHrv,
        baselineSuitPressure,
        baselinePpCO2,
        baselineO2Reserve,
      });

      setUploadSuccess(
        `Uploaded ${uploaded.fileName} for ${safeName} (${safeCallsign}). Flight Deck, Orbital Matrix, Contingency & OSDR Archive are now live.`
      );
      setSelectedFile(null);
      setNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload medical report.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const cleanName = subjectName.trim() || initialName;
    const cleanId = sanitizeCallsignInput(crewCallsign || deriveCallsign(cleanName, 1));
    const sample = [
      'timestamp,subject_name,callsign,role,issuer,spo2,heart_rate_bpm,core_temp_c,rad_flux_msv_h,hrv_rmssd,suit_pressure_kpa,ppco2_kpa',
      `2026-11-14T08:00:00Z,${cleanName},${cleanId},Medical Report Subject,Flight Medicine Clinic,98.6,70,37.0,0.34,49.5,29.6,0.32`,
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical-report-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Gate / Calibration Status Banner */}
      {records.length === 0 ? (
        <div className="hud-panel-advisory rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-[#FFB703] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-[#F8FAFC]">
                Upload Your Medical Report or Receipt to Begin Tracking
              </h2>
              <p className="text-xs text-[#ffdea9] mt-0.5">
                No preset or example crew are loaded. Upload your medical stats or certificate receipt below to generate your live Flight Deck, Orbital Matrix, Contingency, and OSDR Archive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="inline-flex min-h-[40px] items-center gap-2 rounded border border-[#FFB703] bg-[#030712] px-3.5 py-2 font-mono text-xs font-semibold text-[#FFB703] hover:bg-[#FFB703]/15 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>
      ) : (
        <div className="hud-panel-tier2 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#00FF66] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-[#F8FAFC]">
                Telemetry Populated From Your Uploaded Medical Report
              </h2>
              <p className="font-mono text-xs text-[#94A3B8] mt-0.5">
                Flight Deck, Orbital Matrix, Contingency, and OSDR Archive are displaying live telemetry exclusively from your uploaded medical record(s).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onProceedToFlightDeck}
            className="inline-flex min-h-[42px] items-center gap-2 rounded bg-[#00F0FF] px-4 py-2 font-mono text-xs font-bold text-[#030712] uppercase hover:bg-[#7df4ff] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Flight Deck</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#F8FAFC]">
            Medical Report &amp; Receipt Upload
          </h1>
          <p className="font-mono text-xs text-[#94A3B8] mt-0.5">
            Upload your medical report (CSV/JSON/TXT) or hospital/clinic clearance receipt (PDF/Image) to populate all mission screens.
          </p>
        </div>

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="inline-flex min-h-[40px] items-center gap-2 rounded border border-[#00F0FF]/45 bg-[#070D1D] px-3.5 py-2 font-mono text-xs font-semibold text-[#00F0FF] hover:border-[#00F0FF] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV Template</span>
          </button>
        )}
      </div>

      {/* Main Split: Upload Form (5 cols) + Saved Records (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Upload Console */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="lg:col-span-5 hud-panel-tier1 rounded-lg p-4 sm:p-5 space-y-4"
        >
          <div className="border-b border-[#00F0FF]/15 pb-3">
            <h2 className="font-display text-base font-bold text-[#F8FAFC]">
              Upload Medical Report / Receipt
            </h2>
            <p className="font-mono text-[11px] text-[#94A3B8] mt-0.5">
              Accepted: .csv, .json, .txt, .pdf, .png, .jpg (Max 10 MB)
            </p>
          </div>

          {/* Drag & Drop Picker */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) void handlePickedFile(dropped);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center transition-colors ${
              isDragging
                ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                : 'border-[#475569] bg-[#030712]/70 hover:border-[#00F0FF]/60'
            }`}
          >
            <Upload className="h-7 w-7 text-[#00F0FF]" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-[#F8FAFC]">
                {selectedFile ? selectedFile.name : 'Drop medical report or receipt here'}
              </p>
              <p className="font-mono text-[11px] text-[#94A3B8]">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} · ${selectedFile.type || 'document'}`
                  : 'Auto-extracts subject details & vitals from CSV/JSON/TXT/PDF'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.txt,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) void handlePickedFile(picked);
              }}
              className="sr-only"
              id="medical-file-upload"
            />
            <label
              htmlFor="medical-file-upload"
              className="mt-1 inline-flex min-h-[40px] cursor-pointer items-center rounded border border-[#38BDF8]/50 bg-[#0B132B] px-4 py-1.5 font-mono text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/15 transition-colors"
            >
              Browse Local File
            </label>
          </div>

          {/* Subject Details from Report */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <label htmlFor="med-subject-name" className="block text-[11px] text-[#94A3B8] mb-1">
                SUBJECT / PATIENT NAME
              </label>
              <input
                id="med-subject-name"
                type="text"
                maxLength={60}
                value={subjectName}
                onChange={(e) => {
                  setSubjectName(e.target.value);
                }}
                placeholder="Full name from report"
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-callsign" className="block text-[11px] text-[#94A3B8] mb-1">
                REPORT ID / CALLSIGN
              </label>
              <input
                id="med-callsign"
                type="text"
                maxLength={24}
                value={crewCallsign}
                onChange={(e) => setCrewCallsign(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="e.g. SUBJ-01"
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] uppercase focus:border-[#00F0FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <label htmlFor="med-category" className="block text-[11px] text-[#94A3B8] mb-1">
                DOCUMENT TYPE
              </label>
              <select
                id="med-category"
                value={recordCategory}
                onChange={(e) => setRecordCategory(e.target.value as MedicalRecordCategory)}
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] focus:border-[#00F0FF] focus:outline-none"
              >
                <option value="MEDICAL_STATS">Medical Report / Stats</option>
                <option value="CERTIFICATE">Medical Receipt / Certificate</option>
              </select>
            </div>

            <div>
              <label htmlFor="med-role" className="block text-[11px] text-[#94A3B8] mb-1">
                ASSIGNMENT / ROLE
              </label>
              <input
                id="med-role"
                type="text"
                maxLength={50}
                value={subjectRole}
                onChange={(e) => setSubjectRole(e.target.value)}
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] focus:border-[#00F0FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <label htmlFor="med-clearance" className="block text-[11px] text-[#94A3B8] mb-1">
                CLEARANCE STATUS
              </label>
              <select
                id="med-clearance"
                value={clearanceStatus}
                onChange={(e) => {
                  const next = e.target.value as ClearanceStatus;
                  setClearanceStatus(next);
                  setBaselineSuitPressure(next === 'CLEARED_EVA' ? 29.6 : 101.3);
                }}
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] focus:border-[#00F0FF] focus:outline-none"
              >
                <option value="CLEARED_EVA">Cleared for EVA</option>
                <option value="HAB_ONLY">Restricted / Hab-Only</option>
                <option value="REVIEW_REQUIRED">Flight Surgeon Review</option>
              </select>
            </div>

            <div>
              <label htmlFor="med-issuer" className="block text-[11px] text-[#94A3B8] mb-1">
                ISSUING CLINIC / LAB
              </label>
              <input
                id="med-issuer"
                type="text"
                maxLength={120}
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="min-h-[40px] w-full rounded border border-[#475569] bg-[#070D1D] px-3 text-[#F8FAFC] focus:border-[#00F0FF] focus:outline-none"
              />
            </div>
          </div>

          {/* Physiological Values from Report */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
            <div>
              <label htmlFor="med-spo2" className="block text-[10px] text-[#94A3B8] mb-1">
                SpO2 (%)
              </label>
              <input
                id="med-spo2"
                type="number"
                min={50}
                max={100}
                step={0.1}
                value={baselineSpo2}
                onChange={(e) => setBaselineSpo2(parseFloat(e.target.value) || 0)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-hr" className="block text-[10px] text-[#94A3B8] mb-1">
                HEART RATE (BPM)
              </label>
              <input
                id="med-hr"
                type="number"
                min={30}
                max={240}
                step={1}
                value={baselineHr}
                onChange={(e) => setBaselineHr(parseInt(e.target.value, 10) || 0)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-temp" className="block text-[10px] text-[#94A3B8] mb-1">
                CORE TEMP (°C)
              </label>
              <input
                id="med-temp"
                type="number"
                min={33}
                max={42}
                step={0.1}
                value={baselineCoreTemp}
                onChange={(e) => setBaselineCoreTemp(parseFloat(e.target.value) || 37.0)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-hrv" className="block text-[10px] text-[#94A3B8] mb-1">
                HRV RMSSD (ms)
              </label>
              <input
                id="med-hrv"
                type="number"
                min={5}
                max={150}
                step={0.1}
                value={baselineHrv}
                onChange={(e) => setBaselineHrv(parseFloat(e.target.value) || 48.0)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-rad" className="block text-[10px] text-[#94A3B8] mb-1">
                RAD FLUX (mSv/h)
              </label>
              <input
                id="med-rad"
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={baselineRadFlux}
                onChange={(e) => setBaselineRadFlux(parseFloat(e.target.value) || 0.36)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="med-press" className="block text-[10px] text-[#94A3B8] mb-1">
                PRESSURE (kPa)
              </label>
              <input
                id="med-press"
                type="number"
                min={15}
                max={110}
                step={0.1}
                value={baselineSuitPressure}
                onChange={(e) => setBaselineSuitPressure(parseFloat(e.target.value) || 29.6)}
                className="min-h-[38px] w-full rounded border border-[#475569] bg-[#070D1D] px-2.5 text-[#F8FAFC] tabular-nums focus:border-[#00F0FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="font-mono text-xs">
            <label htmlFor="med-notes" className="block text-[11px] text-[#94A3B8] mb-1">
              REPORT / RECEIPT OBSERVATIONS
            </label>
            <textarea
              id="med-notes"
              rows={2}
              maxLength={180}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Receipt number, physician remarks, or diagnostic summary..."
              className="w-full rounded border border-[#475569] bg-[#070D1D] p-2.5 text-[#F8FAFC] placeholder:text-[#475569] focus:border-[#00F0FF] focus:outline-none"
            />
          </div>

          {uploadError && (
            <p role="alert" className="rounded border border-[#FF2A55] bg-[#18040A] p-2.5 font-mono text-xs text-[#ffb4ab]">
              {uploadError}
            </p>
          )}

          {uploadSuccess && (
            <p className="rounded border border-[#00FF66]/50 bg-[#022413] p-2.5 font-mono text-xs text-[#00FF66] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{uploadSuccess}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="min-h-[48px] w-full rounded bg-[#00F0FF] px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-[#030712] uppercase hover:bg-[#7df4ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading & Building Telemetry...' : 'Upload Report & Load Telemetry'}
          </button>
        </form>

        {/* Persisted Records & Certificates Vault */}
        <section className="lg:col-span-7 hud-panel-tier1 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00F0FF]/15 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                Uploaded Medical Reports &amp; Receipts
              </h2>
              <p className="font-mono text-[11px] text-[#94A3B8]">
                Each uploaded report creates the live subject profile across Flight Deck, Orbital Matrix, Contingency &amp; OSDR Archive.
              </p>
            </div>
            <span className="font-mono text-xs text-[#00F0FF] tabular-nums">
              {records.length} REPORTS
            </span>
          </div>

          {records.length === 0 ? (
            <div className="rounded-lg border border-[#00F0FF]/15 bg-[#030712]/60 p-8 text-center space-y-2">
              <FileText className="mx-auto h-8 w-8 text-[#475569]" />
              <p className="font-display text-sm font-semibold text-[#F8FAFC]">
                No medical reports uploaded yet
              </p>
              <p className="font-mono text-xs text-[#94A3B8]">
                Upload your medical stats file or clearance receipt on the left to generate your personalized telemetry screens.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => {
                const isCert = rec.recordCategory === 'CERTIFICATE';
                const isActive = rec.id === activeRecordId;
                const { subjectName: parsedName, subjectRole: parsedRole } = extractSubjectFromSummary(
                  rec.parsedSummary,
                  rec.crewCallsign
                );
                const statusColor =
                  rec.clearanceStatus === 'CLEARED_EVA'
                    ? 'text-[#00FF66] bg-[#022413] border-[#00FF66]/40'
                    : rec.clearanceStatus === 'HAB_ONLY'
                    ? 'text-[#FFB703] bg-[#261A02] border-[#FFB703]/45'
                    : 'text-[#FF2A55] bg-[#2B050E] border-[#FF2A55]/50';

                return (
                  <article
                    key={rec.id}
                    className={`rounded-lg border p-4 space-y-3 transition-colors ${
                      isActive
                        ? 'border-[#00F0FF] bg-[#0B132B]/90'
                        : 'border-[#00F0FF]/20 bg-[#070D1D]/90'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#00F0FF]/35 bg-[#030712]">
                          {isCert ? (
                            <Award className="h-5 w-5 text-[#FFB703]" />
                          ) : (
                            <FileText className="h-5 w-5 text-[#00F0FF]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#00F0FF]">
                              {parsedName} ({rec.crewCallsign})
                            </span>
                            <span className="font-mono text-[11px] text-[#94A3B8]">
                              {isCert ? 'RECEIPT / CERT' : 'MED REPORT'} · {formatBytes(rec.fileSizeBytes)}
                            </span>
                            {isActive && (
                              <span className="font-mono text-[10px] font-bold text-[#00FF66] uppercase">
                                · ACTIVE TRACKING
                              </span>
                            )}
                          </div>
                          <h3 className="font-display text-sm sm:text-base font-bold text-[#F8FAFC] truncate">
                            {rec.fileName}
                          </h3>
                          <p className="font-mono text-[11px] text-[#94A3B8]">
                            {parsedRole} · {rec.issuer} · {rec.createdAtLabel}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase whitespace-nowrap shrink-0 ${statusColor}`}
                      >
                        {rec.clearanceStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-[#dce2f9] leading-relaxed">{rec.parsedSummary}</p>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#00F0FF]/12 pt-3">
                      <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
                        <span>
                          <span className="text-[#94A3B8]">SpO2: </span>
                          <span className="text-[#00FF66] font-semibold">
                            {rec.baselineSpo2.toFixed(1)}%
                          </span>
                        </span>
                        <span>
                          <span className="text-[#94A3B8]">HR: </span>
                          <span className="text-[#F8FAFC] font-semibold">
                            {rec.baselineHr} BPM
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {rec.serverFileId && (
                          <button
                            type="button"
                            onClick={() => setPreviewRecord(rec)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#38BDF8]/40 bg-[#030712] px-2.5 py-1 font-mono text-[11px] text-[#F8FAFC] hover:border-[#00F0FF] transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#00F0FF]" />
                            <span>Preview</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onApplyBaseline(rec)}
                          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                            isActive
                              ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]'
                              : 'border-[#00FF66]/45 bg-[#022413]/70 text-[#00FF66] hover:bg-[#00FF66]/15'
                          }`}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          <span>{isActive ? 'Tracking Active' : 'Track This Report'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteRecord(rec)}
                          aria-label={`Delete ${rec.fileName}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#FF2A55]/40 bg-[#18040A] px-2.5 py-1 font-mono text-[11px] text-[#ffb4ab] hover:border-[#FF2A55] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Inline File Preview Modal */}
      {previewRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewRecord.fileName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/85 backdrop-blur-sm p-4"
        >
          <div className="hud-panel-tier2 w-full max-w-3xl rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#00F0FF]/20 pb-3">
              <div className="min-w-0">
                <span className="font-mono text-[11px] text-[#00F0FF]">
                  {previewRecord.crewCallsign} · {previewRecord.recordCategory}
                </span>
                <h3 className="font-display text-base font-bold text-[#F8FAFC] truncate">
                  {previewRecord.fileName}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewBlobUrl && (
                  <a
                    href={previewBlobUrl}
                    download={previewRecord.fileName}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[#00F0FF] px-3 py-1.5 font-mono text-xs font-bold text-[#030712]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewRecord(null)}
                  aria-label="Close preview"
                  className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded border border-[#475569] bg-[#070D1D] text-[#F8FAFC] hover:border-[#00F0FF]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded border border-[#00F0FF]/20 bg-[#030712] p-2">
              {previewLoading ? (
                <div className="py-12 text-center font-mono text-xs text-[#94A3B8]">
                  Verifying Firebase session &amp; loading protected file...
                </div>
              ) : previewError ? (
                <div role="alert" className="py-8 text-center font-mono text-xs text-[#ffb4ab]">
                  {previewError}
                </div>
              ) : previewBlobUrl ? (
                previewRecord.mimeType.startsWith('image/') ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewRecord.fileName}
                    className="mx-auto max-h-[58vh] w-auto rounded object-contain"
                  />
                ) : (
                  <iframe
                    title={previewRecord.fileName}
                    src={previewBlobUrl}
                    className="h-[55vh] w-full rounded bg-white"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
