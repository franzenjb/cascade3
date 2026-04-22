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
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import { STORM_REPORTS } from "@/lib/storm-reports";

const ARC_PORTAL = "https://arc-nhq-gis.maps.arcgis.com";
const ARC_APP_ID = process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";

// Warning polygon coordinates (same as cascade2)
const WARNING_POLYGON = [
  [-82.8714, 27.8383],
  [-82.6124, 27.8383],
  [-82.5524, 28.0183],
  [-82.8114, 28.0183],
  [-82.8714, 27.8383],
];

/**
 * Extract OAuth token from URL hash (after redirect back from ArcGIS).
 * Returns the token string or null.
 */
function extractTokenFromHash(): string | null {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params: Record<string, string> = {};
  hash.split("&").forEach((part) => {
    const [k, v] = part.split("=");
    params[k] = decodeURIComponent(v || "");
  });
  if (params.access_token) {
    // Clean the hash so it doesn't linger in the URL
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return params.access_token;
  }
  return null;
}

/**
 * Redirect to ArcGIS OAuth authorize endpoint.
 * Uses the already-registered redirect URI (the app's own URL).
 */
function redirectToLogin() {
  const redirectUri = window.location.origin;
  const authUrl =
    ARC_PORTAL +
    "/sharing/rest/oauth2/authorize?" +
    "client_id=" + ARC_APP_ID +
    "&response_type=token" +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&expiration=120";
  window.location.href = authUrl;
}

interface Props {
  stormReportCount: number;
  active: boolean;
}

export default function ArcGISMap({ stormReportCount, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const polygonLayerRef = useRef<GraphicsLayer | null>(null);
  const stormLayerRef = useRef<GraphicsLayer | null>(null);
  const stormGlowLayerRef = useRef<GraphicsLayer | null>(null);
  const labelLayerRef = useRef<GraphicsLayer | null>(null);
  const animFrameRef = useRef<number>(0);

  // OAuth: check for token in hash, or redirect to login
  useEffect(() => {
    const token = extractTokenFromHash();
    if (token) {
      IdentityManager.registerToken({
        server: ARC_PORTAL + "/sharing",
        token: token,
      });
    } else {
      // Check if we already have a credential
      IdentityManager.checkSignInStatus(ARC_PORTAL + "/sharing").catch(() => {
        redirectToLogin();
      });
    }
  }, []);

  // Initialize map once authenticated
  useEffect(() => {
    if (!containerRef.current) return;

    let view: MapView | null = null;
    let cancelled = false;

    IdentityManager.checkSignInStatus(ARC_PORTAL + "/sharing")
      .then(() => {
        if (cancelled || !containerRef.current) return;
        initMap();
      })
      .catch(() => {
        // Not signed in yet — login redirect will handle it
      });

    function initMap() {
      if (!containerRef.current) return;

      const map = new Map({
        basemap: "dark-gray-vector",
      });

      view = new MapView({
        container: containerRef.current,
        map,
        center: [-82.75, 27.93],
        zoom: 11,
        ui: { components: ["zoom"] },
        constraints: { minZoom: 9, maxZoom: 18 },
      });

      // Create layers in order (bottom to top)
      const polygonLayer = new GraphicsLayer({ title: "Warning Polygon" });
      const stormGlowLayer = new GraphicsLayer({ title: "Storm Glow" });
      const stormLayer = new GraphicsLayer({ title: "Storm Track" });
      const labelLayer = new GraphicsLayer({ title: "Storm Labels" });

      map.addMany([polygonLayer, stormGlowLayer, stormLayer, labelLayer]);

      polygonLayerRef.current = polygonLayer;
      stormLayerRef.current = stormLayer;
      stormGlowLayerRef.current = stormGlowLayer;
      labelLayerRef.current = labelLayer;
      viewRef.current = view;

      // Pulse animation
      let growing = true;
      let glowSize = 30;
      const animate = () => {
        if (stormGlowLayerRef.current) {
          const graphics = stormGlowLayerRef.current.graphics;
          graphics.forEach((g) => {
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

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (view) view.destroy();
    };
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
          outline: new SimpleLineSymbol({
            color: [237, 27, 46, 1],
            width: 2,
          }),
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

    // Connecting line
    if (visible.length >= 2) {
      const paths = visible.map((r) => [r.lon, r.lat]);

      stormLayer.add(
        new Graphic({
          geometry: new Polyline({
            paths: [paths],
            spatialReference: { wkid: 4326 },
          }),
          symbol: new SimpleLineSymbol({
            color: [251, 191, 36, 0.6],
            width: 18,
          }),
        }),
      );

      stormLayer.add(
        new Graphic({
          geometry: new Polyline({
            paths: [paths],
            spatialReference: { wkid: 4326 },
          }),
          symbol: new SimpleLineSymbol({
            color: [220, 38, 38, 1],
            width: 5,
          }),
        }),
      );
    }

    // Points
    for (const r of visible) {
      const pt = new Point({
        longitude: r.lon,
        latitude: r.lat,
        spatialReference: { wkid: 4326 },
      });

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
