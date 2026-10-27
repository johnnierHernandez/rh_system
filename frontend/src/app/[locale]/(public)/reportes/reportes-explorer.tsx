"use client";

import { useEffect, useState } from "react";
import RequiereSesion from "@/components/common/RequiereSesion";

type Area = { id: number; nombre: string };

const ORDEN_AREAS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 35, 118, 14, 38, 16, 17, 18, 19, 20,
  21, 22, 23, 26, 28, 29, 30, 31, 32, 33, 34, 41, 42, 43, 107, 106, 47, 51,
  52, 53, 54, 55, 57, 58, 90, 103, 104, 102, 105, 109, 117, 111, 112, 113,
  114, 115, 116, 119, 120,
];

export default function ReportesExplorer() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    // /api/reportes/areas exige sesión: responde 401 a un visitante anónimo
    // y, con sesión, devuelve solo las áreas que el usuario puede ver. El 401
    // ofrece el acceso en lugar de enseñar el desplegable vacío.
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

  const pdfUrl = areaId ? `/api/reportes/prenomina?area=${areaId}` : null;

  const imprimir = () => {
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  if (sinSesion) {
    return (
      <RequiereSesion mensaje="La prenómina es de acceso restringido. Inicia sesión con tu usuario institucional para consultarla." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-md">
          <label
            htmlFor="reporte-area"
            className="mb-1.5 block text-sm font-medium text-[#52525b]"
          >
            Área
          </label>
          {cargando ? (
            <p className="text-sm text-[#52525b]">Cargando áreas…</p>
          ) : (
            <select
              id="reporte-area"
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
          onClick={imprimir}
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
            title="Prenómina PC-10"
            className="h-[85vh] w-full rounded-xl border border-[#e5e7eb] bg-white"
          />
        ) : (
          <div className="flex h-[70vh] w-full items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 text-center text-sm text-[#52525b]">
            Seleccione un área para generar y mostrar su prenómina.
          </div>
        )}
      </div>
    </div>
  );
}