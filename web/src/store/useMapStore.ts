import { create } from 'zustand';

interface MapState {
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  setViewState: (viewState: MapState['viewState']) => void;
  // Autres états plus tard (dates, couches, etc.)
}

export const useMapStore = create<MapState>((set) => ({
  viewState: {
    longitude: 1.1,
    latitude: 8.6,
    zoom: 6.5,
    pitch: 0,
    bearing: 0,
  },
  setViewState: (viewState) => set({ viewState }),
}));
