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
import esriConfig from "@arcgis/core/config";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import { STORM_REPORTS } from "@/lib/storm-reports";

// Warning polygon coordinates (same as cascade2)
const WARNING_POLYGON = [
  [-82.8714, 27.8383],
  [-82.6124, 27.8383],
  [-82.5524, 28.0183],
  [-82.8114, 28.0183],
  [-82.8714, 27.8383],
];

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

  // Initialize map with OAuth
  useEffect(() => {
    if (!containerRef.current) return;

    const clientId = process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";

    // Register OAuth app for ArcGIS authentication
    const portalUrl = "https://arc-nhq-gis.maps.arcgis.com";
    const oauthInfo = new OAuthInfo({
      appId: clientId,
      portalUrl,
      popup: true,
    });
    IdentityManager.registerOAuthInfos([oauthInfo]);

    // Check if already signed in, if not trigger sign-in
    IdentityManager.checkSignInStatus(portalUrl + "/sharing")
      .then(() => initMap())
      .catch(() => {
        IdentityManager.getCredential(portalUrl + "/sharing")
          .then(() => initMap())
          .catch((err) => console.error("ArcGIS auth failed:", err));
      });

    let view: MapView | null = null;

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
    } // end initMap

    return () => {
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

    // Zoom to polygon
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

      // Line glow
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

      // Line core
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

      // Glow circle
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

      // Dot
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

      // Letter label
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
