"use client";

import React, { useMemo, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useTheme } from 'next-themes';
import DeckGL from '@deck.gl/react';
import { api } from '@/lib/api';
import { Loader2, AlertCircle } from 'lucide-react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export default function BaseMap() {
  const { viewState, setViewState } = useMapStore();
  const { pixelInteraction, setPixelInteraction, clearPixelInteraction } = useAnalysisStore();
  const { resolvedTheme } = useTheme();

  // Définition conditionnelle du style basé sur le thème (clair ou sombre)
  const mapStyle = useMemo(() => {
    const styleId = resolvedTheme === 'dark' ? 'dataviz-dark' : 'dataviz-light';
    return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
  }, [resolvedTheme]);

  // Clic sur la carte par l'utilisateur
  const handleMapClick = useCallback(async (info: any) => {
    // Info contient les coordonnées, on vérifie que l'on a bien cliqué sur un point valide
    if (info.coordinate) {
      const [lng, lat] = info.coordinate;
      
      setPixelInteraction({
        isLoading: true,
        error: null,
        data: null,
        lng,
        lat,
      });

      try {
        // --- simulation temporaire d'une requête API pour l'extraction GEE + prédiction IA ---
        const response = await api.predictPixel({
            latitude: lat,
            longitude: lng,
            // autres clés nécessaires (plus tard)
        } as any);

        setPixelInteraction({
          isLoading: false,
          error: null,
          data: {
            prediction: response.prediction,
            confidence: response.confidence,
            label: response.label || `Classe ${response.prediction}`,
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
    }
  }, [setPixelInteraction]);

  // Les calques deck.gl plus tard
  const layers: any[] = [];

  return (
    <div className="absolute inset-0 h-screen w-screen overflow-hidden">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        onClick={handleMapClick}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <Map
          mapStyle={mapStyle}
          reuseMaps
          attributionControl={false} // Rajout de façon personnalisée
        >
          <NavigationControl position="bottom-right" />
          <ScaleControl position="bottom-left" />

          {/* Popup d'interaction Pixel */}
          {pixelInteraction.lat && pixelInteraction.lng && (
            <Popup
              longitude={pixelInteraction.lng}
              latitude={pixelInteraction.lat}
              closeButton={true}
              closeOnClick={false}
              onClose={clearPixelInteraction}
              anchor="bottom"
              className="z-50"
            >
              <div className="p-3 w-64 text-sm font-sans bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800">
                <div className="border-b border-gray-200 dark:border-gray-800 pb-2 mb-2 font-semibold flex items-center justify-between">
                   <span>{"Analyse IA Ponctuelle "}</span>

                   <span className="text-[10px] text-gray-500 font-mono">
                      {pixelInteraction.lat.toFixed(4)}, {pixelInteraction.lng.toFixed(4)}
                   </span>
                </div>

                {pixelInteraction.isLoading && (
                  <div className="flex flex-col items-center justify-center py-4 text-emerald-600 dark:text-emerald-400 gap-2">
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
      </DeckGL>
    </div>
  );
}
