import type { Metadata } from "next";
import RecienGraduadosExplorer from "./recien-explorer";

export const metadata: Metadata = {
  title: "Lista de recién graduados | DRHnet",
  description:
    "Adiestrados y recién graduados por unidad organizativa",
};

export const dynamic = "force-dynamic";

export default function RecienGraduadosPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">
          Lista de recién graduados
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Recién graduados
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione la unidad organizativa para consultar la lista de adiestrados
        (recién graduados) con su cargo y fecha de contratación.
      </p>

      <div className="mt-6">
        <RecienGraduadosExplorer />
      </div>
    </section>
  );
}