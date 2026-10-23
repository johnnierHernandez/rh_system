import type { Metadata } from "next";

import CuadrosExplorer from "./cuadros-explorer";

export const metadata: Metadata = { title: "Cuadros | DRHnet" };

export const dynamic = "force-dynamic";

export default function CuadrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Cuadros
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Personal activo con categoría ocupacional Cuadro. Este listado contiene
          carné de identidad y está reservado al perfil autorizado.
        </p>
      </div>

      <CuadrosExplorer />
    </div>
  );
}