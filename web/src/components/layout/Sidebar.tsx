"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Layers, Calendar, BarChart3, Settings2, ChevronLeft, Menu, UploadCloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { api } from '@/lib/api';

export default function Sidebar() {
  const { layers, toggleLayer, stats, isSidebarOpen, toggleSidebar, setBatchPredictions, setIsBatchLoading, isBatchLoading } = useAnalysisStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Utilisation d'un state local monté pour éviter les erreurs d'hydratation (Next.js vs Zustand persist)
  const [isMounted, setIsMounted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsBatchLoading(true);

    try {
      // Appel à l'API FastApi (predictFile attend un CSV uploadé avec les 18 features)
      const data = await api.predictFile(file);

      setBatchPredictions(data.predictions);
      
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors de l'envoi du fichier.");
    } finally {
      setIsBatchLoading(false);
      // reset l'input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <Button
        onClick={toggleSidebar}
        className={`absolute top-4 left-4 z-20 rounded-full shadow-lg bg-background/80 backdrop-blur-md p-3 h-12 w-12 transition-all duration-500 ease-in-out ${
          isSidebarOpen ? 'opacity-0 -translate-x-full pointer-events-none' : 'opacity-100 translate-x-0'
        }`}
        variant="outline"
      >
        <Menu className="w-5 h-5 text-emerald-600" />
      </Button>

      <div 
        className={`absolute top-4 left-4 bottom-4 z-10 w-80 bg-background/85 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden transition-all duration-500 ease-in-out origin-left ${
          isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0 pointer-events-none'
        }`}
      >
            {/* En-tête Sidebar */}
            <div className="p-6 border-b border-border/50 bg-background/40 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black tracking-tight bg-gradient-to-br from-green-600 to-emerald-400 bg-clip-text text-transparent">
                    ForestWatch
                </h1>
                <p className="text-xs text-muted-foreground mt-1 font-medium select-none">
                    PLATEFORME D'ANALYSE
                </p>
            </div>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar}
                className="rounded-full h-8 w-8 hover:bg-muted/50 transition-colors shrink-0"
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            </div>

            {/* Zone de contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                
                {/* Section 1 : Couches Analytiques */}
                <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Layers className="w-5 h-5 text-emerald-500" />
                    <h2>Couches Analytiques</h2>
                </div>
                <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-sm flex items-center justify-between transition-colors">
                        <span className="font-medium">Occupation du sol</span>
                        <Switch 
                            checked={layers.landCover} 
                            onCheckedChange={() => toggleLayer('landCover')} 
                        />
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-sm flex items-center justify-between transition-colors">
                    <span className="font-medium">Risque de déforestation</span>
                    <Switch 
                        checked={layers.deforestationRisk} 
                        onCheckedChange={() => toggleLayer('deforestationRisk')} 
                    />
                    </div>
                </div>
                </section>

                {/* Section Batch Upload */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UploadCloud className="w-5 h-5 text-emerald-500" />
                      <h2>Traitement Spatial (Batch)</h2>
                  </div>
                  <div className="bg-muted/40 border border-dashed border-border/60 hover:border-emerald-500/50 transition-colors rounded-xl p-4 text-center cursor-pointer relative"
                       onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      accept=".csv,.json,.geojson,.xlsx,.xls,.zip,.kml,.gpkg" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                    />
                    
                    {isBatchLoading ? (
                      <div className="flex flex-col items-center gap-2 text-emerald-600 py-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-semibold">Analyse ML en cours...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 py-2">
                         <span className="text-sm font-medium text-foreground">Cliquez ou déposez</span>
                         <span className="text-xs text-muted-foreground">CSV, GeoJSON, Excel, Shapefile (Zip)</span>
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <div className="text-xs text-red-500 text-center font-medium bg-red-500/10 py-1.5 rounded-md">
                      {uploadError}
                    </div>
                  )}
                </section>

                {/* Section 2 : Période Temporelle */}
                <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calendar className="w-5 h-5 text-emerald-500" />
                    <h2>Période (Sentinel-2)</h2>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-sm text-center text-muted-foreground">
                    {/* Placeholder pour le sélecteur de date / mois */}
                    Sélecteur de période à venir...
                </div>
                </section>

                {/* Section 3 : Statistiques Rapides */}
                <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    <h2>Rapport de Zone</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex flex-col items-center justify-center text-center shadow-inner">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.forestHa ? stats.forestHa.toLocaleString('fr-FR') : '---'}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-semibold">Ha Forêt</span>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex flex-col items-center justify-center text-center shadow-inner">
                        <span className="text-2xl font-bold text-red-500 dark:text-red-400">
                            {stats.lostHa ? stats.lostHa.toLocaleString('fr-FR') : '---'}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-semibold">Ha Perdus</span>
                    </div>
                </div>
                </section>

            </div>

            {/* Pied de la Sidebar / Actions */}
            <div className="p-5 border-t border-border/50 bg-background/40">
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-900/20 transition-all font-semibold">
                <Settings2 className="w-4 h-4" />
                Lancer l'Analyse ML
                </Button>
            </div>
        </div>
    </div>
  );
}
