"use client";

import { STORM_REPORTS } from "@/lib/storm-reports";

interface Props {
  stormReportCount: number;
  countdown: string | null;
  stormComplete: boolean;
  onRestart: () => void;
  active: boolean;
}

export default function BriefingCard({
  stormReportCount,
  countdown,
  stormComplete,
  onRestart,
  active,
}: Props) {
  if (!active) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-[#737373] font-data text-sm text-center">
          Press Continue to start the simulation.
        </p>
      </div>
    );
  }

  const visibleReports = STORM_REPORTS.slice(0, stormReportCount).reverse();

  return (
    <div className="flex flex-col h-full">
      {/* KPI bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#4a4a4a] bg-[#1a1a1a]/40 flex-shrink-0">
        <KPI value="316,364" label="At Risk" highlight />
        <Sep />
        <KPI value="86" label="Tracts" />
        <Sep />
        <KPI value="8" label="High Vuln" />
        <Sep />
        <KPI value="25%" label="ALICE" sublabel="(79,724)" />
      </div>

      {/* Storm reports header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[#ED1B2E]/20 bg-[#ED1B2E]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#ED1B2E] rounded-full animate-pulse" />
          <span className="text-[10px] font-data font-bold uppercase tracking-widest text-[#ED1B2E]">
            Storm Reports
          </span>
          <span className="text-[10px] font-data text-white/60">
            {stormReportCount} of {STORM_REPORTS.length}
          </span>
        </div>
        {countdown && (
          <span className="font-data font-bold text-xs text-[#ED1B2E] tabular-nums">
            {countdown}
          </span>
        )}
      </div>

      {/* Reports feed */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b border-[#4a4a4a]">
        {visibleReports.map((r, i) => (
          <div
            key={r.id}
            className={`flex gap-3 px-4 py-2.5 border-b border-[#4a4a4a]/50 last:border-b-0 ${
              i === 0 ? "bg-[#ED1B2E]/10" : ""
            }`}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-600 border-2 border-yellow-400 flex items-center justify-center mt-0.5">
              <span className="text-white font-data font-bold text-xs">
                {r.letter}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`font-data font-bold text-[10px] tabular-nums ${
                    i === 0 ? "text-[#ED1B2E]" : "text-white/60"
                  }`}
                >
                  {r.time}
                </span>
                <span
                  className={`font-data font-bold text-[10px] uppercase ${
                    i === 0 ? "text-[#ED1B2E]" : "text-white/80"
                  }`}
                >
                  {r.source}
                </span>
                {i === 0 && (
                  <span className="text-[9px] font-data font-bold uppercase tracking-wider bg-[#ED1B2E] text-white px-1.5 py-0.5 rounded">
                    Latest
                  </span>
                )}
              </div>
              <p
                className={`font-data text-[11px] leading-snug ${
                  i === 0
                    ? "text-white font-semibold"
                    : "text-white/70"
                }`}
              >
                <span className="text-[#ED1B2E] font-bold">{r.label}</span> —{" "}
                {r.location}
              </p>
            </div>
          </div>
        ))}
        {stormReportCount === 0 && (
          <div className="px-4 py-6 text-center text-[11px] font-data text-white/50 uppercase tracking-wider">
            Awaiting first report...
          </div>
        )}
        {stormComplete && (
          <div className="px-4 py-4 text-center">
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2 bg-[#ED1B2E] text-white font-data font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors"
            >
              Restart Simulation
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-2.5 flex-shrink-0">
        <div className="text-[10px] font-data uppercase tracking-widest text-white/60 mb-1">
          Powered by
        </div>
        <p className="text-[11px] font-data text-white/80 leading-snug">
          ArcGIS Maps SDK for JavaScript · Esri Dark Gray Vector Basemap
        </p>
      </div>
    </div>
  );
}

function KPI({
  value,
  label,
  highlight,
  sublabel,
}: {
  value: string;
  label: string;
  highlight?: boolean;
  sublabel?: string;
}) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap flex-shrink-0">
      <span
        className={`font-data font-bold text-sm tabular-nums ${
          highlight ? "text-[#ED1B2E]" : "text-[#f7f5f2]"
        }`}
      >
        {value}
      </span>
      <span className="text-[9px] font-data uppercase tracking-widest text-white/70">
        {label}
      </span>
      {sublabel && (
        <span className="text-[9px] font-data text-white/50 tabular-nums">
          {sublabel}
        </span>
      )}
    </div>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-[#4a4a4a] flex-shrink-0" />;
}
