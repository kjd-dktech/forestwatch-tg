import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PixelData {
  lat: number;
  lng: number;
  label?: string;
  confidence?: number;
  prediction_label?: string;
}

interface AnalysisState {
  isSidebarOpen: boolean;
  layers: {
    landCover: boolean;
    deforestationRisk: boolean;
  };
  date: string;
  stats: {
    forestHa: number | null;
    lostHa: number | null;
  };
  // États pour l'interaction utilisateur (clic sur la carte)
  pixelInteraction: {
    isLoading: boolean;
    error: string | null;
    data: PixelData | null;
    lat: number | null;
    lng: number | null;
  };

  // État pour le batch upload
  batchPredictions: any[];
  batchJobId: string | null;
  batchIsMappable: boolean;
  datavizMode: 'scatterplot' | 'hexagon' | 'mvt';
  isBatchLoading: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleLayer: (layer: keyof AnalysisState['layers']) => void;
  setDate: (date: string) => void;
  setStats: (stats: AnalysisState['stats']) => void;
  
  // Actions pour l'interaction utilisateur
  setPixelInteraction: (data: Partial<AnalysisState['pixelInteraction']>) => void;
  clearPixelInteraction: () => void;

  setBatchPredictions: (predictions: any[], jobId?: string, isMappable?: boolean) => void;
  setDatavizMode: (mode: 'scatterplot' | 'hexagon' | 'mvt') => void;
  setIsBatchLoading: (isLoading: boolean) => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      layers: {
        landCover: true,
        deforestationRisk: false,
      },
      date: '2025-01', // Date par défaut
      stats: {
        forestHa: 125430,
        lostHa: 4320,
      },
      pixelInteraction: {
        isLoading: false,
        error: null,
        data: null,
        lat: null,
        lng: null,
      },
      batchPredictions: [],
      batchJobId: null,
      batchIsMappable: false,
      datavizMode: 'scatterplot',
      isBatchLoading: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
      toggleLayer: (layer) =>
        set((state) => ({
          layers: { ...state.layers, [layer]: !state.layers[layer] },
        })),
      setDate: (date) => set({ date }),
      setStats: (stats) => set({ stats }),
      setPixelInteraction: (update) => 
        set((state) => ({ pixelInteraction: { ...state.pixelInteraction, ...update } })),
      clearPixelInteraction: () =>
        set((state) => ({
          pixelInteraction: { isLoading: false, error: null, data: null, lat: null, lng: null },
        })),
      setBatchPredictions: (predictions, jobId, isMappable = false) => set({ batchPredictions: predictions, batchJobId: jobId || null, batchIsMappable: isMappable }),
      setDatavizMode: (mode) => set({ datavizMode: mode }),
      setIsBatchLoading: (isLoading) => set({ isBatchLoading: isLoading }),
    }),
    {
      name: 'forestwatch-ui-storage',
      partialize: (state) => ({ 
        isSidebarOpen: state.isSidebarOpen, 
        datavizMode: state.datavizMode,
        batchJobId: state.batchJobId,
        batchIsMappable: state.batchIsMappable
      }),
    }
  )
);