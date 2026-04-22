"use client";

import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Polygon from "@arcgis/core/geometry/Polygon";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import { STORM_REPORTS } from "@/lib/storm-reports";
import assetsJson from "@/data/pinellas_assets.json";

const ARC_PORTAL = "https://arc-nhq-gis.maps.arcgis.com";
const ARC_APP_ID = process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";

const WARNING_POLYGON = [
  [-82.8714, 27.8383],
  [-82.6124, 27.8383],
  [-82.5524, 28.0183],
  [-82.8114, 28.0183],
  [-82.8714, 27.8383],
];

// Asset type → color mapping (matches cascade2)
const ASSET_COLORS: Record<string, string> = {
  red_cross: "#ED1B2E",
  school: "#3b82f6",
  fire_station: "#ef4444",
  police_station: "#6366f1",
  mobile_home_park: "#b45309",
  hospital: "#10b981",
};

interface RawAsset {
  id: string;
  type: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  city: string;
  attrs: Record<string, unknown>;
}

const ASSETS = (assetsJson as { assets: RawAsset[] }).assets;

interface Props {
  stormReportCount: number;
  active: boolean;
}

export default function ArcGISMap({ stormReportCount, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const mapReadyRef = useRef(false);
  const polygonLayerRef = useRef<GraphicsLayer | null>(null);
  const stormLayerRef = useRef<GraphicsLayer | null>(null);
  const stormGlowLayerRef = useRef<GraphicsLayer | null>(null);
  const labelLayerRef = useRef<GraphicsLayer | null>(null);
  const animFrameRef = useRef<number>(0);

  // Single useEffect: handle OAuth then init map
  useEffect(() => {
    if (!containerRef.current) return;

    let view: MapView | null = null;

    // 1. Check for OAuth token in URL hash (redirect return)
    const hash = window.location.hash.substring(1);
    if (hash.includes("access_token=")) {
      const params = new URLSearchParams(hash);
      const token = params.get("access_token");
      const expiresIn = parseInt(params.get("expires_in") || "7200");
      if (token) {
        sessionStorage.setItem("agol-token", token);
        sessionStorage.setItem("agol-token-exp", String(Date.now() + expiresIn * 1000));
        history.replaceState(null, "", window.location.pathname + window.location.search);
        IdentityManager.registerToken({
          server: ARC_PORTAL + "/sharing",
          token,
        });
        initMap();
        return cleanup;
      }
    }

    // 2. Check sessionStorage for existing token
    const savedToken = sessionStorage.getItem("agol-token");
    const savedExp = parseInt(sessionStorage.getItem("agol-token-exp") || "0");
    if (savedToken && Date.now() < savedExp) {
      IdentityManager.registerToken({
        server: ARC_PORTAL + "/sharing",
        token: savedToken,
      });
      initMap();
      return cleanup;
    }

    // 3. No valid token — redirect to ArcGIS OAuth
    const redirectUri = window.location.origin;
    const authUrl =
      ARC_PORTAL +
      "/sharing/rest/oauth2/authorize?" +
      "client_id=" + ARC_APP_ID +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&expiration=120";
    window.location.href = authUrl;

    function initMap() {
      if (!containerRef.current) return;

      const map = new Map({ basemap: "dark-gray-vector" });

      view = new MapView({
        container: containerRef.current,
        map,
        center: [-82.75, 27.93],
        zoom: 11,
        ui: { components: ["zoom"] },
        constraints: { minZoom: 9, maxZoom: 18 },
      });

      // Asset layer (bottom)
      const assetLayer = new GraphicsLayer({ title: "Assets" });
      // Warning polygon
      const polygonLayer = new GraphicsLayer({ title: "Warning Polygon" });
      // Storm layers (top)
      const stormGlowLayer = new GraphicsLayer({ title: "Storm Glow" });
      const stormLayer = new GraphicsLayer({ title: "Storm Track" });
      const labelLayer = new GraphicsLayer({ title: "Storm Labels" });

      map.addMany([assetLayer, polygonLayer, stormGlowLayer, stormLayer, labelLayer]);

      polygonLayerRef.current = polygonLayer;
      stormLayerRef.current = stormLayer;
      stormGlowLayerRef.current = stormGlowLayer;
      labelLayerRef.current = labelLayer;
      viewRef.current = view;
      mapReadyRef.current = true;

      // Add asset points
      for (const a of ASSETS) {
        const color = ASSET_COLORS[a.type] || "#999";
        assetLayer.add(
          new Graphic({
            geometry: new Point({ longitude: a.lon, latitude: a.lat }),
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              color,
              size: 8,
              outline: { color: [255, 255, 255, 0.8], width: 1 },
            }),
            attributes: { name: a.name, type: a.type, address: a.address, city: a.city },
            popupTemplate: {
              title: "{name}",
              content: "{type} — {address}, {city}",
            },
          }),
        );
      }

      // Pulse animation for storm glow
      let growing = true;
      let glowSize = 30;
      const animate = () => {
        if (stormGlowLayerRef.current) {
          stormGlowLayerRef.current.graphics.forEach((g) => {
            if (g.symbol?.type === "simple-marker") {
              const sym = (g.symbol as SimpleMarkerSymbol).clone();
              sym.size = glowSize;
              sym.color.a = 0.3 + 0.3 * Math.sin(performance.now() / 300);
              g.symbol = sym;
            }
          });
        }
        glowSize += growing ? 0.3 : -0.3;
        if (glowSize > 45) growing = false;
        if (glowSize < 25) growing = true;
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
    }

    function cleanup() {
      cancelAnimationFrame(animFrameRef.current);
      if (view) view.destroy();
    }

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw warning polygon when activated
  useEffect(() => {
    const layer = polygonLayerRef.current;
    if (!layer) return;
    layer.removeAll();
    if (!active) return;

    const polygon = new Polygon({
      rings: [WARNING_POLYGON],
      spatialReference: { wkid: 4326 },
    });

    layer.add(
      new Graphic({
        geometry: polygon,
        symbol: new SimpleFillSymbol({
          color: [237, 27, 46, 0.14],
          outline: new SimpleLineSymbol({ color: [237, 27, 46, 1], width: 2 }),
        }),
      }),
    );

    if (polygon.extent) {
      viewRef.current?.goTo(polygon.extent.expand(1.3), { duration: 1500 });
    }
  }, [active]);

  // Update storm track
  useEffect(() => {
    const stormLayer = stormLayerRef.current;
    const glowLayer = stormGlowLayerRef.current;
    const lblLayer = labelLayerRef.current;
    if (!stormLayer || !glowLayer || !lblLayer) return;

    stormLayer.removeAll();
    glowLayer.removeAll();
    lblLayer.removeAll();

    const visible = STORM_REPORTS.slice(0, stormReportCount);
    if (visible.length === 0) return;

    if (visible.length >= 2) {
      const paths = visible.map((r) => [r.lon, r.lat]);
      stormLayer.add(
        new Graphic({
          geometry: new Polyline({ paths: [paths], spatialReference: { wkid: 4326 } }),
          symbol: new SimpleLineSymbol({ color: [251, 191, 36, 0.6], width: 18 }),
        }),
      );
      stormLayer.add(
        new Graphic({
          geometry: new Polyline({ paths: [paths], spatialReference: { wkid: 4326 } }),
          symbol: new SimpleLineSymbol({ color: [220, 38, 38, 1], width: 5 }),
        }),
      );
    }

    for (const r of visible) {
      const pt = new Point({ longitude: r.lon, latitude: r.lat });
      glowLayer.add(
        new Graphic({
          geometry: pt,
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [251, 191, 36, 0.5],
            size: 35,
            outline: { color: [251, 191, 36, 0], width: 0 },
          }),
        }),
      );
      stormLayer.add(
        new Graphic({
          geometry: pt,
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [220, 38, 38, 1],
            size: 18,
            outline: { color: [251, 191, 36, 1], width: 3 },
          }),
        }),
      );
      lblLayer.add(
        new Graphic({
          geometry: pt,
          symbol: new TextSymbol({
            text: r.letter,
            color: "white",
            haloColor: "black",
            haloSize: 2,
            font: { size: 11, weight: "bold", family: "IBM Plex Mono" },
            yoffset: 0,
          }),
        }),
      );
    }
  }, [stormReportCount]);

  return <div ref={containerRef} className="w-full h-full" />;
}
