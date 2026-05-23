import BaseMap from "@/components/map/BaseMap";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <BaseMap />

      {/* Interface Superposée (Z-index supérieur) viendra ici : 
          Sidebar, Topbar, Contrôles filtrants, etc. */}
      <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-md p-4 rounded-xl border shadow-lg max-w-sm pointer-events-auto">
        <h1 className="text-xl font-bold mb-2">ForestWatch Togo</h1>
        <p className="text-sm text-muted-foreground">
          Surveillance et prédiction de la déforestation propulsée par l'Intelligence Artificielle.
        </p>
      </div>

      <div className="absolute top-4 right-4 z-10 pointer-events-auto">
        <ThemeToggle />
      </div>
    </main>
  );
}
