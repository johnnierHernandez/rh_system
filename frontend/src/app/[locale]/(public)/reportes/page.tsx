import type { Metadata } from "next";
import ReportesExplorer from "./reportes-explorer";

export const metadata: Metadata = {
  title: "Nóminas y Reportes | DRHnet",
  description:
    "Prenómina PC-10, reporte de tarifa horaria y sobrecarga del trabajo docente (S.C.D.) por unidad organizativa",
};

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">
          Nóminas y Reportes
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Reportes oficiales del DRH
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione la unidad organizativa y el reporte que desea ver o
        descargar. Los documentos se generan en el formato oficial del DRH.
      </p>

      <ReportesExplorer />
    </section>
  );
}