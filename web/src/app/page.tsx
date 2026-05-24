import BaseMap from "@/components/map/BaseMap";
import { ThemeToggle } from "@/components/ThemeToggle";
import Sidebar from "@/components/layout/Sidebar";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <BaseMap />
      <Sidebar />
      <div className="absolute top-4 right-4 z-10 pointer-events-auto">
        <ThemeToggle />
      </div>
    </main>
  );
}
