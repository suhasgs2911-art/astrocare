import { useState } from 'react';
import { CrewMember, HabitatSector } from '../types/telemetry';
import { StatusPill } from './ProvenanceAndStatus';

interface OrbitalMatrixScreenProps {
  sectors: HabitatSector[];
  crew: CrewMember[];
  onToggleHatch: (sectorId: string) => void;
  metSeconds: number;
}

export function OrbitalMatrixScreen({
  sectors,
  crew,
  onToggleHatch,
  metSeconds,
}: OrbitalMatrixScreenProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<string>(sectors[0]?.id ?? 'quest-airlock');
  const selectedSector = sectors.find((s) => s.id === selectedSectorId) ?? sectors[0];

  // Calculate 6-axis subsystem radar scores from live telemetry
  const avgO2 = crew.reduce((acc, c) => acc + c.o2ReservePct, 0) / Math.max(1, crew.length);
  const avgBat = crew.reduce((acc, c) => acc + c.batteryPct, 0) / Math.max(1, crew.length);
  const maxRad = Math.max(...sectors.map((s) => s.radiationMsvH));
  const minPressRatio = Math.min(
    ...sectors
      .filter((s) => s.id !== 'truss-s4')
      .map((s) => (s.id === 'quest-airlock' ? s.pressureKpa / 70.4 : s.pressureKpa / 101.3))
  );
  const maxCo2 = Math.max(...sectors.map((s) => s.ppCO2Kpa));

  const radarAxes = [
    { label: 'O2 RESERVE', value: Math.min(100, Math.max(10, avgO2)) },
    { label: 'CABIN PRESS', value: Math.min(100, Math.max(15, minPressRatio * 100)) },
    { label: 'RAD SHIELD', value: Math.min(100, Math.max(18, 100 - maxRad * 32)) },
    { label: 'CO2 SCRUB', value: Math.min(100, Math.max(20, 100 - (maxCo2 / 0.9) * 80)) },
    { label: 'POWER BUS', value: Math.min(100, Math.max(10, avgBat)) },
    { label: 'COMMS LOCK', value: 96 },
  ];

  // Radar geometry
  const cx = 150;
  const cy = 140;
  const radius = 88;
  const polygonPoints = radarAxes
    .map((axis, idx) => {
      const angle = (Math.PI * 2 * idx) / radarAxes.length - Math.PI / 2;
      const r = (axis.value / 100) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');

  const orbitProgress = ((metSeconds % 5560) / 5560) * 100;
  const isEclipse = orbitProgress > 62;
  const nextEventSec = isEclipse
    ? Math.round(((100 - orbitProgress) / 100) * 5560)
    : Math.round(((62 - orbitProgress) / 100) * 5560);

  return (
    <div className="space-y-5">
      {/* Orbital Pass Telemetry Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hud-panel-tier1 rounded-lg p-4">
          <span className="font-mono text-[11px] text-[#94A3B8] uppercase">Orbital Altitude</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">418.4</span>
            <span className="font-mono text-xs text-[#94A3B8]">km</span>
          </div>
          <span className="font-mono text-[11px] text-[#00FF66]">INC 51.64° · LEO</span>
        </div>

        <div className="hud-panel-tier1 rounded-lg p-4">
          <span className="font-mono text-[11px] text-[#94A3B8] uppercase">Ground Velocity</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">7.66</span>
            <span className="font-mono text-xs text-[#94A3B8]">km/s</span>
          </div>
          <span className="font-mono text-[11px] text-[#00F0FF]">TDRS KU-BAND LOCK</span>
        </div>

        <div className="hud-panel-tier1 rounded-lg p-4">
          <span className="font-mono text-[11px] text-[#94A3B8] uppercase">Solar Illumination</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">
              {isEclipse ? 'ECLIPSE' : 'INSOLATED'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#FFB703] tabular-nums">
            {isEclipse ? 'SUNRISE' : 'ECLIPSE'} IN {Math.floor(nextEventSec / 60)}m {nextEventSec % 60}s
          </span>
        </div>

        <div className="hud-panel-tier1 rounded-lg p-4">
          <span className="font-mono text-[11px] text-[#94A3B8] uppercase">Orbit Cycle Progress</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">
              {orbitProgress.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-[#94A3B8]">%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded bg-[#030712] overflow-hidden">
            <div
              className="h-full bg-[#00F0FF] transition-all duration-300"
              style={{ width: `${orbitProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Asymmetric Split: Habitat Schematic + Calibration Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Habitat Schematic Canvas (7 cols) */}
        <section className="lg:col-span-7 hud-panel-tier1 rounded-lg p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00F0FF]/15 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                Station Sector Pressure &amp; Dosimetry Schematic
              </h2>
              <p className="font-mono text-xs text-[#94A3B8]">
                Select any module to inspect atmospheric partial pressures and crew occupancy.
              </p>
            </div>
            <span className="font-mono text-xs text-[#00F0FF] tabular-nums">
              5 ACTIVE NODES
            </span>
          </div>

          <div className="my-4 rounded-lg border border-[#00F0FF]/15 bg-[#030712]/80 p-3">
            <svg
              viewBox="0 0 600 326"
              className="w-full h-auto"
              role="img"
              aria-label="Interactive orbital station schematic"
            >
              {/* Structural Coordinate Crosshairs */}
              <line x1="20" y1="162" x2="580" y2="162" stroke="#00F0FF" strokeOpacity="0.12" strokeDasharray="4 4" />
              <line x1="278" y1="10" x2="278" y2="316" stroke="#00F0FF" strokeOpacity="0.12" strokeDasharray="4 4" />

              {/* Module Connectors */}
              <rect x="174" y="150" width="22" height="24" fill="#191f30" stroke="#00F0FF" strokeOpacity="0.35" />
              <rect x="360" y="150" width="22" height="24" fill="#191f30" stroke="#00F0FF" strokeOpacity="0.35" />
              <rect x="266" y="88" width="24" height="20" fill="#191f30" stroke="#00F0FF" strokeOpacity="0.35" />
              <rect x="266" y="216" width="24" height="22" fill="#191f30" stroke="#00F0FF" strokeOpacity="0.35" />

              {sectors.map((sec) => {
                const isSelected = sec.id === selectedSector.id;
                const borderColor =
                  sec.status === 'critical'
                    ? '#FF2A55'
                    : sec.status === 'advisory'
                    ? '#FFB703'
                    : isSelected
                    ? '#00F0FF'
                    : '#3b494b';
                const fillColor =
                  sec.status === 'critical'
                    ? 'rgba(255, 42, 85, 0.16)'
                    : sec.status === 'advisory'
                    ? 'rgba(255, 183, 3, 0.14)'
                    : isSelected
                    ? 'rgba(0, 240, 255, 0.14)'
                    : 'rgba(11, 19, 43, 0.85)';

                const assignedCrew = crew.filter((c) => sec.crewIds.includes(c.id));

                return (
                  <g
                    key={sec.id}
                    onClick={() => setSelectedSectorId(sec.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={sec.deckPosition.x}
                      y={sec.deckPosition.y}
                      width={sec.deckPosition.width}
                      height={sec.deckPosition.height}
                      rx="6"
                      fill={fillColor}
                      stroke={borderColor}
                      strokeWidth={isSelected ? '2' : '1.2'}
                    />
                    <text
                      x={sec.deckPosition.x + 10}
                      y={sec.deckPosition.y + 18}
                      fill="#94A3B8"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {sec.code} {sec.hatchSealed ? '· SEALED' : '· OPEN'}
                    </text>
                    <text
                      x={sec.deckPosition.x + 10}
                      y={sec.deckPosition.y + 34}
                      fill="#F8FAFC"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="Space Grotesk, sans-serif"
                    >
                      {sec.name}
                    </text>
                    <text
                      x={sec.deckPosition.x + 10}
                      y={sec.deckPosition.y + 52}
                      fill={sec.status === 'critical' ? '#FF2A55' : '#00F0FF'}
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {sec.pressureKpa.toFixed(1)} kPa · {sec.radiationMsvH.toFixed(2)} mSv/h
                    </text>
                    {assignedCrew.length > 0 && (
                      <text
                        x={sec.deckPosition.x + 10}
                        y={sec.deckPosition.y + sec.deckPosition.height - 10}
                        fill="#00FF66"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        CREW: {assignedCrew.map((c) => c.callsign).join(', ')}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Sector Inspector Bar */}
          <div className="rounded-lg border border-[#00F0FF]/25 bg-[#0B132B]/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#00F0FF]">{selectedSector.code}</span>
                  <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                    {selectedSector.name}
                  </h3>
                  <StatusPill severity={selectedSector.status} compact />
                </div>
                <p className="mt-1 font-mono text-xs text-[#94A3B8] tabular-nums">
                  ppO2 {selectedSector.ppO2Kpa.toFixed(1)} kPa · ppCO2 {selectedSector.ppCO2Kpa.toFixed(2)} kPa ·
                  TEMP {selectedSector.tempC.toFixed(1)} °C
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleHatch(selectedSector.id)}
                className={`min-h-[42px] rounded px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                  selectedSector.hatchSealed
                    ? 'border border-[#FFB703]/60 bg-[#261A02] text-[#FFB703] hover:bg-[#FFB703]/20'
                    : 'border border-[#00F0FF]/40 bg-[#070D1D] text-[#00F0FF] hover:border-[#00F0FF]'
                }`}
              >
                {selectedSector.hatchSealed ? 'Unseal Bulkhead Hatch' : 'Seal Bulkhead Hatch'}
              </button>
            </div>
          </div>
        </section>

        {/* 6-Axis Subsystem Calibration Radar (5 cols) */}
        <section className="lg:col-span-5 hud-panel-tier1 rounded-lg p-4 sm:p-5 flex flex-col justify-between">
          <div className="border-b border-[#00F0FF]/15 pb-3">
            <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
              Subsystem Envelope Calibration
            </h2>
            <p className="font-mono text-xs text-[#94A3B8]">
              Normalized 0–100% survivability margin across six orbital vectors.
            </p>
          </div>

          <div className="my-2 flex items-center justify-center">
            <svg viewBox="0 0 300 280" className="w-full max-w-[320px] h-auto" role="img" aria-label="Subsystem calibration spider chart">
              {/* Concentric Grid Polygons */}
              {[0.25, 0.5, 0.75, 1].map((scale) => {
                const pts = radarAxes
                  .map((_, idx) => {
                    const angle = (Math.PI * 2 * idx) / radarAxes.length - Math.PI / 2;
                    const r = radius * scale;
                    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={scale}
                    points={pts}
                    fill="none"
                    stroke="#3b494b"
                    strokeOpacity="0.6"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Radial Axis Spokes & Labels */}
              {radarAxes.map((axis, idx) => {
                const angle = (Math.PI * 2 * idx) / radarAxes.length - Math.PI / 2;
                const x2 = cx + radius * Math.cos(angle);
                const y2 = cy + radius * Math.sin(angle);
                const lx = cx + (radius + 24) * Math.cos(angle);
                const ly = cy + (radius + 18) * Math.sin(angle);
                return (
                  <g key={axis.label}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={x2}
                      y2={y2}
                      stroke="#3b494b"
                      strokeOpacity="0.55"
                      strokeWidth="1"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#94A3B8"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}

              {/* Active Telemetry Polygon */}
              <polygon
                points={polygonPoints}
                fill="rgba(0, 240, 255, 0.2)"
                stroke="#00F0FF"
                strokeWidth="2"
              />

              {/* Axis Vertex Nodes */}
              {radarAxes.map((axis, idx) => {
                const angle = (Math.PI * 2 * idx) / radarAxes.length - Math.PI / 2;
                const r = (axis.value / 100) * radius;
                return (
                  <circle
                    key={axis.label}
                    cx={cx + r * Math.cos(angle)}
                    cy={cy + r * Math.sin(angle)}
                    r="3.5"
                    fill="#00F0FF"
                    stroke="#030712"
                    strokeWidth="1.2"
                  />
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            {radarAxes.map((axis) => (
              <div
                key={axis.label}
                className="flex items-center justify-between rounded bg-[#030712]/70 border border-[#00F0FF]/12 px-2.5 py-1.5"
              >
                <span className="text-[#94A3B8] text-[11px]">{axis.label}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    axis.value < 55
                      ? 'text-[#FF2A55]'
                      : axis.value < 75
                      ? 'text-[#FFB703]'
                      : 'text-[#00FF66]'
                  }`}
                >
                  {axis.value.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
