import type { Metadata } from "next";
import PlazasVacantesExplorer from "./plazas-vacantes-explorer";

export const metadata: Metadata = {
  title: "Plazas vacantes | DRHnet",
  description: "Plazas vacantes por unidad organizativa, con categoría e importes",
};

export const dynamic = "force-dynamic";

export default function PlazasVacantesPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">Plazas vacantes</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Plantilla autorizada
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione el área para consultar las plazas vacantes de sus unidades,
        con el cargo, la categoría y los importes de Básico, Plus, Estímulo y
        Otros.
      </p>

      <div className="mt-6">
        <PlazasVacantesExplorer />
      </div>
    </section>
  );
}
