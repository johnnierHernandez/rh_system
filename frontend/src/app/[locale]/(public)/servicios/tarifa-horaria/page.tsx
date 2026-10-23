import type { Metadata } from "next";

import TarifaHorariaExplorer from "./tarifa-horaria-explorer";

export const metadata: Metadata = {
  title: "Tarifa Horaria | DRHnet",
  description:
    "Generación del reporte de tarifa horaria por unidad organizativa",
};

export const dynamic = "force-dynamic";

export default function TarifaHorariaPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">
          Generar tarifa horaria
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Reporte del DRH
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione el área para ver los trabajadores con horas insertadas para
        el próximo pago y generar el reporte oficial del DRH.
      </p>

      <div className="mt-6">
        <TarifaHorariaExplorer />
      </div>
    </section>
  );
}