"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { STORM_REPORTS } from "@/lib/storm-reports";
import BriefingCard from "@/components/BriefingCard";

const ArcGISMap = dynamic(() => import("@/components/ArcGISMap"), {
  ssr: false,
});

export default function Page() {
  const [active, setActive] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [stormReportCount, setStormReportCount] = useState(0);
  const [stormComplete, setStormComplete] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresRef = useRef<Date | null>(null);

  const startSimulation = () => {
    setShowModal(false);
    setActive(true);
    setStormComplete(false);
    setStormReportCount(0);

    const exp = new Date(Date.now() + 30 * 60 * 1000);
    expiresRef.current = exp;

    const dripMs =
      new URLSearchParams(window.location.search).get("speed") === "fast"
        ? 5000
        : 15000;

    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(() => {
      setStormReportCount(1);
      intervalRef.current = setInterval(() => {
        setStormReportCount((prev) => {
          if (prev >= STORM_REPORTS.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setTimeout(() => setStormComplete(true), 30000);
            return prev;
          }
          return prev + 1;
        });
      }, dripMs);
    }, 3000);
  };

  const restartStormTrack = () => {
    setStormComplete(false);
    setStormReportCount(0);
    const dripMs =
      new URLSearchParams(window.location.search).get("speed") === "fast"
        ? 5000
        : 15000;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(() => {
      setStormReportCount(1);
      intervalRef.current = setInterval(() => {
        setStormReportCount((prev) => {
          if (prev >= STORM_REPORTS.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setTimeout(() => setStormComplete(true), 30000);
            return prev;
          }
          return prev + 1;
        });
      }, dripMs);
    }, 500);
  };

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!expiresRef.current) return;
      const diffMs = expiresRef.current.getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdown("EXPIRED");
        return;
      }
      const m = Math.floor(diffMs / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return (
    <main className="h-screen flex flex-col">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[#2d2d2d] border-2 border-[#ED1B2E] max-w-lg w-full p-6 shadow-xl">
            <div className="text-[10px] font-data uppercase tracking-widest text-[#ED1B2E] mb-2">
              Cascade V3 · ArcGIS SDK · Simulation
            </div>
            <h3 className="font-headline text-xl font-bold text-[#f7f5f2] mb-3 leading-tight">
              Simulate NWS Tornado Alert — Pinellas County
            </h3>
            <p className="text-sm text-[#a3a3a3] leading-relaxed mb-4">
              This demonstrates what occurs when a National Weather Service
              tornado warning is issued for central Pinellas County. Built with
              the ArcGIS Maps SDK for JavaScript — the warning polygon, storm
              track, and briefing all generate automatically.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={startSimulation}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-2 border-[#ED1B2E] bg-[#ED1B2E] text-white hover:bg-[#ED1B2E]/90 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#4a0f15] text-white shadow-md flex-shrink-0">
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-[#ED1B2E]" />
            <div>
              <h1 className="font-headline text-lg leading-tight">
                Cascade{" "}
                <span className="text-white/60 text-xs font-data uppercase tracking-widest">
                  v3 · ArcGIS
                </span>
              </h1>
              <p className="text-[10px] font-data uppercase tracking-widest text-white/70">
                Pinellas County · FL
              </p>
            </div>
          </div>
          {active && countdown && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#ED1B2E]/20 border border-[#ED1B2E] animate-pulse">
              <span className="w-2 h-2 bg-[#ED1B2E] rounded-full" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-data uppercase tracking-widest text-white/80">
                  Active Warning
                </span>
                <span className="text-[11px] font-data font-semibold">
                  DEMO-TOR-FL-2026-0001 · {countdown}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="h-[2px] bg-[#ED1B2E]" />
      </header>

      {active && (
        <div className="flex-shrink-0 bg-[#ED1B2E] text-white overflow-hidden h-7 flex items-center">
          <div className="flex items-center gap-3 px-3 flex-shrink-0 bg-[#4a0f15] h-full z-10">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-data font-bold uppercase tracking-widest whitespace-nowrap">
              Tornado Warning {countdown}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="animate-crawl whitespace-nowrap font-data text-xs">
              <span className="inline-block px-8">
                The National Weather Service has issued a TORNADO WARNING for
                central Pinellas County. A severe thunderstorm capable of
                producing a tornado was located near Seminole, moving NE at 35
                mph. Path tracks NE across the peninsula from Seminole through
                Largo toward Old Tampa Bay.
              </span>
              <span className="inline-block px-8">
                The National Weather Service has issued a TORNADO WARNING for
                central Pinellas County. A severe thunderstorm capable of
                producing a tornado was located near Seminole, moving NE at 35
                mph. Path tracks NE across the peninsula from Seminole through
                Largo toward Old Tampa Bay.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="min-h-[50vh] lg:min-h-0 relative">
          <ArcGISMap stormReportCount={stormReportCount} active={active} />
        </div>
        <div className="border-l border-[#4a4a4a] flex flex-col min-h-0 bg-[#2d2d2d]">
          <BriefingCard
            stormReportCount={stormReportCount}
            countdown={countdown}
            stormComplete={stormComplete}
            onRestart={restartStormTrack}
            active={active}
          />
        </div>
      </div>

      <footer className="border-t border-[#4a4a4a] px-4 py-2 text-[10px] text-[#737373] font-data uppercase tracking-wider flex items-center justify-between flex-shrink-0">
        <span>ArcGIS Maps SDK · CDC SVI · FEMA NRI · ALICE · Pinellas Assets</span>
        <span>
          Sibling of{" "}
          <a href="https://cascade2.jbf.com" className="underline hover:text-[#ED1B2E]">
            cascade2
          </a>
        </span>
      </footer>
    </main>
  );
}
