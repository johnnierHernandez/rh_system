"use client";

import { useEffect, useState } from "react";

import RequiereSesion from "@/components/common/RequiereSesion";
import { ORDEN_AREAS, type AreaReporte } from "@/lib/areas-reporte";

type Area = AreaReporte;

type Props = {
  pdfBase: "tarifa_horaria" | "sobrecarga";
  tituloPdf: string;
  mensajeVacio: string;
};

export default function ReportePdfExplorer({
  pdfBase,
  tituloPdf,
  mensajeVacio,
}: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    // /api/reportes/areas exige sesión: responde 401 a un anónimo (el PDF de
    // S.C.D. es de acceso restringido) y, con sesión, solo devuelve las áreas
    // que el usuario puede ver.
    fetch("/api/reportes/areas", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          setSinSesion(true);
          return null;
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        const mapa = new Map<number, Area>(
          ((d.areas ?? []) as Area[]).map((a) => [a.id, a]),
        );
        const ordenadas = ORDEN_AREAS.map((id) => mapa.get(id)).filter(
          (a): a is Area => Boolean(a),
        );
        setAreas(ordenadas);
        // El catálogo ya viene acotado al visitante: para un jefe de área
        // contiene solo su área, que queda preseleccionada por defecto.
        if (ordenadas.length > 0) setAreaId(String(ordenadas[0].id));
      })
      .catch(() => setError("No se pudieron cargar las áreas de reportes."))
      .finally(() => setCargando(false));
  }, []);

  const pdfUrl = areaId ? `/api/reportes/${pdfBase}?area=${areaId}` : null;

  if (sinSesion) {
    return (
      <RequiereSesion mensaje="Este reporte PDF es de acceso restringido. Inicia sesión con tu usuario institucional para consultarlo." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-md">
          <label
            htmlFor={`reporte-${pdfBase}-area`}
            className="mb-1.5 block text-sm font-medium text-[#52525b]"
          >
            Área
          </label>
          {cargando ? (
            <p className="text-sm text-[#52525b]">Cargando áreas…</p>
          ) : (
            <select
              id={`reporte-${pdfBase}-area`}
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 pr-8 text-sm text-[#1a1a1a] outline-none transition focus:border-[#006633]"
            >
              <option value="">Seleccione un área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
          }}
          disabled={!pdfUrl}
          className="h-11 shrink-0 rounded-xl border border-[#006633] bg-[#006633] px-4 text-sm font-medium text-white outline-none transition hover:bg-[#005226] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Imprimir
        </button>
      </div>

      {error && (
        <p className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="min-w-0">
        {pdfUrl ? (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title={tituloPdf}
            className="h-[85vh] w-full rounded-xl border border-[#e5e7eb] bg-white"
          />
        ) : (
          <div className="flex h-[70vh] w-full items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 text-center text-sm text-[#52525b]">
            {mensajeVacio}
          </div>
        )}
      </div>
    </div>
  );
}