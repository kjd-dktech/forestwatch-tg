"use client";

import React, { useMemo } from 'react';
import Map, { NavigationControl, ScaleControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { useTheme } from 'next-themes';
import DeckGL from '@deck.gl/react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export default function BaseMap() {
  const { viewState, setViewState } = useMapStore();
  const { resolvedTheme } = useTheme();

  // Définition conditionnelle du style basé sur le thème (clair ou sombre)
  const mapStyle = useMemo(() => {
    const styleId = resolvedTheme === 'dark' ? 'dataviz-dark' : 'dataviz-light';
    return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
  }, [resolvedTheme]);

  // Les calques deck.gl plus tard
  const layers: any[] = [];

  return (
    <div className="absolute inset-0 h-screen w-screen overflow-hidden">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
      >
        <Map
          mapStyle={mapStyle}
          reuseMaps
          attributionControl={false} // Rajout de façon personnalisée
        >
          <NavigationControl position="bottom-right" />
          <ScaleControl position="bottom-left" />
        </Map>
      </DeckGL>
    </div>
  );
}
