# Orbital Telemetry & Critical Response

Full-stack TypeScript web application combining a **React + Vite + Tailwind CSS** operational flight-deck HUD with an **Express + Node.js** telemetry simulation and ingestion backend.

## Project Structure

```text
├── server.ts                        # Express server (Vite middleware in dev, dist/ static in prod)
├── server/
│   ├── types.ts                     # Shared backend telemetry types
│   ├── store/
│   │   └── telemetryEngine.ts       # Authoritative 1.2s physiological & habitat simulation engine
│   └── routes/
│       └── telemetryRoutes.ts       # REST API endpoints (/api/*)
├── src/
│   ├── App.tsx                      # Main client state & API synchronization
│   ├── components/                  # HUD screens, waveform chart, sector schematic, emergency banner
│   ├── data/telemetryData.ts        # Baseline NASA OSDR reference cohorts & initial values
│   └── utils/audioAlert.ts          # Web Audio API critical alert synthesizer
├── index.html
├── package.json
└── .env.example
```

## Quick Start (After Cloning)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   ```

3. **Run in development (Express API + Vite HMR/middleware on port 3000):**
   ```bash
   npm run dev
   ```

4. **Build and run in production:**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

5. **Type-check:**
   ```bash
   npm run lint
   ```

## Backend API Endpoints

- `GET /api/health` — Backend health, Mission Elapsed Time (MET), and severity status
- `GET /api/telemetry/state` — Full live telemetry snapshot (crew vitals, habitat sectors, scenarios, logs, OSDR datasets)
- `POST /api/telemetry/stream` — Pause or resume telemetry stream (`{ "isStreaming": boolean }`)
- `POST /api/telemetry/provenance` — Switch between `[OSDR-FLT]` archive mode and `[SIM-RUN]` mode
- `POST /api/telemetry/ingest` — Ingest external sensor readings (`{ "crewId", "parameter", "value" }`)
- `POST /api/contingency/scenario` — Inject or restore contingency scenarios (`nominal-eva`, `suit-decompression`, `solar-particle-event`, `co2-scrubber-drift`)
- `POST /api/contingency/acknowledge` — Acknowledge active emergency alert banner
- `PATCH /api/contingency/steps/:scenarioId/:stepId` — Toggle emergency protocol checklist steps
- `PATCH /api/sectors/:sectorId/hatch` — Seal or unseal station bulkhead hatches
- `GET /api/osdr/datasets` — Retrieve validated NASA OSDR baseline datasets
- `GET /api/logs` — Query mission event logs (`?provenance=`, `?severity=`, `?q=`)
- `GET /api/logs/export.csv` — Download CSV telemetry snapshot
