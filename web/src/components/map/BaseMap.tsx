"use client";

import React, { useMemo, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl, Popup, useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useTheme } from 'next-themes';
import { getLabelColorRgb, getLabelColorHex } from '@/lib/constants';
import Legend from './Legend';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { MVTLayer } from '@deck.gl/geo-layers';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, X } from 'lucide-react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

function DeckGLOverlay(props: any) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export default function BaseMap() {
  const { viewState, setViewState } = useMapStore();
  const { pixelInteraction, setPixelInteraction, clearPixelInteraction, batchPredictions, batchJobId, datavizMode } = useAnalysisStore();
  const { resolvedTheme } = useTheme();
  const [isDragging, setIsDragging] = React.useState(false);

  // Définition conditionnelle du style basé sur le thème (clair ou sombre)
  const mapStyle = useMemo(() => {
    const styleId = resolvedTheme === 'dark' ? 'dataviz-dark' : 'dataviz-light';
    return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
  }, [resolvedTheme]);

  // Clic natif sur la Map
  const handleMapClick = useCallback(async (e: any) => {
    if (!e.lngLat) return;

    const { lng, lat } = e.lngLat;
      
    // Info contient les coordonnées, on vérifie que l'on a bien cliqué sur un point valide
    setPixelInteraction({
      isLoading: true,
      error: null,
      data: null,
      lng,
      lat,
    });

    try {
      // Requête API pour extraction GEE + prédiction IA
      const response = await api.predictPixel({
          latitude: lat,
          longitude: lng,
      } as any);

      setPixelInteraction({
        isLoading: false,
        error: null,
        data: {
          prediction_label: response.prediction_label,
          confidence: response.confidence_score,
          label: response.prediction_label || `Classe Inconnue`,
          lat,
          lng
        },
        lng,
        lat,
      });
    } catch (err: any) {
      setPixelInteraction({
        isLoading: false,
        error: "Erreur lors de l'extraction des données spatiales ou prédiction IA.",
        data: null,
        lng,
        lat,
      });
    }
  }, [setPixelInteraction]);

  // Les calques deck.gl
  const layers = useMemo(() => {
    const list = [];
    
    // Scatterplot ou hexagon si on a un batch
    if (batchPredictions.length > 0) {
      if (datavizMode === 'scatterplot') {
        list.push(
          new ScatterplotLayer({
            id: 'batch-scatterplot-layer',
            data: batchPredictions,
            pickable: true,
            opacity: 0.8,
            stroked: false,
            filled: true,
            radiusScale: 10,
            radiusMinPixels: 3,
            radiusMaxPixels: 100,
            getPosition: (d: any) => [d.longitude, d.latitude],
            getFillColor: (d: any) => getLabelColorRgb(d.prediction_label || String(d.prediction) || ''),
          })
        );
      } else if (datavizMode === 'hexagon') {
        list.push(
          new HexagonLayer({
            id: 'batch-hexagon-layer',
            data: batchPredictions,
            pickable: true,
            extruded: true, // rendu 3D
            radius: 200,    // taille des hexagones en mètres
            elevationScale: 4,
            getPosition: (d: any) => [d.longitude, d.latitude],
            getColorWeight: (point: any) => {
               // Pour simplifier l'assignation de couleur, on peut juste récupérer la couleur du premier point
               // /****TODO****/: changer cette stratégie en majorité, moyennz ou ratio de couleurs (blended) pour les hexagones contenant plusieurs points de classes différentes
               return point.prediction_label ? getLabelColorRgb(point.prediction_label)[0] : 0;
            },
            colorRange: [
              [0, 128, 0],   // Forêt
              [255, 215, 0], // Savane
              [255, 140, 0], // Culture
              [211, 211, 211], // Urbain
              [160, 82, 45], // Sol Nu
              [0, 0, 255]    // Eau
            ],
          })
        );
      }
    }
    
    // Si on a un job_id coté backend, on peut mapper la layer MVT
    if (batchJobId && datavizMode === 'mvt') {
      const MVT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      list.push(
        new MVTLayer({
          id: 'batch-mvt-layer',
          data: `${MVT_URL}/predict/tile/${batchJobId}/{z}/{x}/{y}.pbf`,
          minZoom: 0,
          maxZoom: 23,
          getLineColor: [192, 192, 192, 255],
          getFillColor: (d: any) => getLabelColorRgb(d?.properties?.prediction_label || ''),
          lineWidthMinPixels: 0,
          pickable: true,
        })
      );
    }

    return list;
  }, [batchPredictions, batchJobId, datavizMode]);

  return (
    <div className="absolute inset-0 h-screen w-screen overflow-hidden">
      <Map
        mapStyle={mapStyle}
        reuseMaps
        attributionControl={false}
        initialViewState={viewState}
        onMove={evt => setViewState(evt.viewState as any)}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        interactive={true}
        onClick={handleMapClick}
        cursor={isDragging ? "grabbing" : "crosshair"}
      >
        <DeckGLOverlay layers={layers} />

        <NavigationControl position="bottom-right" />
        <ScaleControl position="bottom-left" />

        {/* Légende de la carte */}
        <Legend />
        
        {/* Popup d'interaction Pixel */}
          {pixelInteraction.lat && pixelInteraction.lng && (
            <Popup
              longitude={pixelInteraction.lng}
              latitude={pixelInteraction.lat}
              closeButton={false}
              closeOnClick={false}
              anchor="bottom"
              className="z-50"
            >
              <div 
                className="p-3 w-[280px] text-sm font-sans bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 pointer-events-auto cursor-default"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="border-b border-gray-200 dark:border-gray-800 pb-3 mb-3 flex items-start justify-between gap-3">
                   <div className="flex flex-col gap-1.5">
                     <span className="font-semibold text-emerald-700 dark:text-emerald-500 leading-tight">Analyse IA Ponctuelle</span>
                     <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded cursor-text select-text w-fit">
                        {pixelInteraction.lat.toFixed(5)}, {pixelInteraction.lng.toFixed(5)}
                     </span>
                   </div>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       clearPixelInteraction();
                     }}
                     className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0 p-1 -mt-1 -mr-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                   </button>
                </div>

                {pixelInteraction.isLoading && (
                  <div className="flex flex-col items-center justify-center py-5 text-emerald-600 dark:text-emerald-400 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs font-medium">Extraction GEE & Inférence...</span>
                  </div>
                )}

                {pixelInteraction.error && (
                  <div className="flex flex-col items-center text-red-500 py-3 gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-xs text-center">{pixelInteraction.error}</span>
                  </div>
                )}

                {!pixelInteraction.isLoading && !pixelInteraction.error && pixelInteraction.data && (
                  <div className="flex flex-col gap-1.5 py-1">
                     <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Prédiction</span>
                     </div>
                     <div className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                        {pixelInteraction.data.label}
                     </div>
                     {pixelInteraction.data.confidence && (
                       <div className="text-xs flex items-center gap-1.5 mt-1 font-semibold dark:text-white text-black">
                          <span 
                            className="inline-block w-2.5 h-2.5 rounded-full shadow-sm"
                            style={{ backgroundColor: getLabelColorHex(pixelInteraction.data.label || "") }}
                          ></span>
                          Confiance: {(pixelInteraction.data.confidence * 100).toFixed(1)}%
                       </div>
                     )}
                     <div className="mt-2 text-[10px] text-gray-500 text-right italic">
                        Powered by GEE & ForestWatch AI
                     </div>
                  </div>
                )}
              </div>
            </Popup>
          )}

      </Map>
    </div>
  );
}

