import type { Metadata } from "next";
import PlantillaExplorer from "./plantilla-explorer";

export const metadata: Metadata = {
  title: "Plantilla | DRHnet",
  description:
    "Plazas de la plantilla de la CUJAE por unidad organizativa: cuántas están cubiertas, cuántas no, y quién ocupa cada plaza",
};

export const dynamic = "force-dynamic";

export default async function PlantillaPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">Plantilla</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Plazas cubiertas y no cubiertas
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione una unidad organizativa para ver sus plazas y la persona que
        ocupa cada una.
      </p>

      <PlantillaExplorer />
    </section>
  );
}
