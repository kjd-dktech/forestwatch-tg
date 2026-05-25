"use client";

import React, { useMemo, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl, Popup, useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useTheme } from 'next-themes';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
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
  const { pixelInteraction, setPixelInteraction, clearPixelInteraction, batchPredictions } = useAnalysisStore();
  const { resolvedTheme } = useTheme();
  const [isDragging, setIsDragging] = React.useState(false);

  // Définition conditionnelle du style basé sur le thème (clair ou sombre)
  const mapStyle = useMemo(() => {
    const styleId = resolvedTheme === 'dark' ? 'dataviz-dark' : 'dataviz-light';
    return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
  }, [resolvedTheme]);

  // Clic natif sur la Map
  const handleMapClick = useCallback(async (e: any) => {
    // Si nous ne sommes pas sur la définition des coordonnées (ex: click control)
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
      // --- simulation d'une requête API ---
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

  // Color mapping standardisé pour occupation du sol (6 classes)
  const getLabelColor = (label: string): [number, number, number, number] => {
    // Adapter selon vos vraies classes de modèle
    if (label.toLowerCase().includes('forêt') || label === '1') return [34, 197, 94, 200]; // green-500
    if (label.toLowerCase().includes('savane') || label === '2') return [234, 179, 8, 200]; // yellow-500
    if (label.toLowerCase().includes('culture') || label === '3') return [249, 115, 22, 200]; // orange-500
    if (label.toLowerCase().includes('urbain') || label === '4') return [239, 68, 68, 200]; // red-500
    if (label.toLowerCase().includes('eau') || label === '5') return [59, 130, 246, 200]; // blue-500
    return [156, 163, 175, 200]; // gray-400 (déforestation ou sol nu)
  };

  // Les calques deck.gl
  const layers = useMemo(() => {
    return [
      batchPredictions.length > 0 && new ScatterplotLayer({
        id: 'batch-predictions-layer',
        data: batchPredictions,
        pickable: true,
        opacity: 0.8,
        stroked: false,
        filled: true,
        radiusScale: 10, // Agrandir selon le zoom pour que le pixel soit visible
        radiusMinPixels: 3,
        radiusMaxPixels: 100,
        getPosition: (d: any) => [d.longitude, d.latitude],
        getFillColor: (d: any) => getLabelColor(d.prediction_label || String(d.prediction) || ''),
      })
    ].filter(Boolean); // Enlève false si batch vide
  }, [batchPredictions]);

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
                       <div className="text-xs flex items-center gap-1 mt-1 font-semibold dark:text-white text-black">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          Confiance: {(pixelInteraction.data.confidence * 100).toFixed(1)}%
                       </div>
                     )}
                     <div className="mt-2 text-[10px] text-gray-500 text-right italic">
                        via RandomForest (6 classes)
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

