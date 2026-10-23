import type { Metadata } from "next";

import TrabajadoresExplorer from "./trabajadores-explorer";

export const metadata: Metadata = { title: "Trabajadores | DRHnet" };

export const dynamic = "force-dynamic";

export default function TrabajadoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Trabajadores
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Trabajadores activos y de baja de la CUJAE. Este listado contiene
          carné de identidad y está reservado al perfil autorizado.
        </p>
      </div>

      <TrabajadoresExplorer />
    </div>
  );
}