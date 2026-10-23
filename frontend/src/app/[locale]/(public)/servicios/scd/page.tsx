import type { Metadata } from "next";
import ReportePdfExplorer from "../reporte-pdf-explorer";

export const metadata: Metadata = {
  title: "Sobre Carga Docente (S.C.D.) | DRHnet",
  description:
    "Generación del reporte de sobrecarga del trabajo docente (S.C.D.) por unidad organizativa",
};

export const dynamic = "force-dynamic";

export default function ScdPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">
          Generar S.C.D.
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          Docentes y cuadros
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        Seleccione la unidad organizativa para generar el reporte de
        sobrecarga del trabajo docente (S.C.D.) en el formato oficial del DRH.
      </p>

      <div className="mt-6">
        <ReportePdfExplorer
          pdfBase="sobrecarga"
          tituloPdf="Sobrecarga del Trabajo Docente (S.C.D.)"
          mensajeVacio="Seleccione un área para generar y mostrar su sobrecarga (S.C.D.)."
        />
      </div>
    </section>
  );
}