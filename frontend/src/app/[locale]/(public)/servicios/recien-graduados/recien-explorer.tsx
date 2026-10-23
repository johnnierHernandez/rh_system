"use client";

import { useEffect, useState } from "react";

type Area = { id: number; nombre: string };
type Recien = {
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Desc_Cargo: string | null;
  Desc_UnidadOrganizativa: string | null;
  Fecha_Contratacion: string | null;
};

const ORDEN_AREAS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 35, 118, 14, 38, 16, 17, 18, 19, 20,
  21, 22, 23, 26, 28, 29, 30, 31, 32, 33, 34, 41, 42, 43, 107, 106, 47, 51,
  52, 53, 54, 55, 57, 58, 90, 103, 104, 102, 105, 109, 117, 111, 112, 113,
  114, 115, 116, 119, 120,
];

export default function RecienGraduadosExplorer() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargandoAreas, setCargandoAreas] = useState(true);
  const [areaId, setAreaId] = useState("");
  const [rows, setRows] = useState<Recien[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reportes/areas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const mapa = new Map<number, Area>(
          ((d.areas ?? []) as Area[]).map((a) => [a.id, a]),
        );
        const ordenadas = ORDEN_AREAS.map((id) => mapa.get(id)).filter(
          (a): a is Area => Boolean(a),
        );
        setAreas(ordenadas);
      })
      .catch(() => setError("No se pudieron cargar las áreas de reportes."))
      .finally(() => setCargandoAreas(false));
  }, []);

  useEffect(() => {
    if (!areaId) {
      setRows([]);
      return;
    }
    let alive = true;
    setCargando(true);
    setError(null);
    setRows([]);
    fetch(`/api/recien_graduados?area=${areaId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (alive) setRows(d);
      })
      .catch(() => {
        if (alive) setError("No se pudo cargar la lista de recién graduados.");
      })
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [areaId]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label
          htmlFor="recien-area"
          className="mb-1.5 block text-sm font-medium text-[#52525b]"
        >
          Área
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-md">
            {cargandoAreas ? (
              <p className="text-sm text-[#52525b]">Cargando áreas…</p>
            ) : (
              <select
                id="recien-area"
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
          {areaId && !cargando && (
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
              {rows.length} {rows.length === 1 ? "adiestrado" : "adiestrados"}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
        {cargando ? (
          <p className="p-6 text-sm text-[#52525b]">Cargando…</p>
        ) : !areaId ? (
          <p className="p-6 text-sm text-[#52525b]">
            Seleccione un área para ver la lista de adiestrados (recién
            graduados).
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-[#52525b]">
            No hay adiestrados (recién graduados) en el área seleccionada.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f4faf6] text-[#006633]">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Carné de identidad</th>
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Área</th>
                <th className="px-4 py-3 font-semibold">Contratación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {rows.map((r, i) => (
                <tr key={r.Id_Expediente ?? i} className="hover:bg-[#f4faf6]">
                  <td className="px-4 py-3 font-medium text-[#1a1a1a]">
                    {r.Nombre}
                  </td>
                  <td className="px-4 py-3 text-[#52525b]">{r.No_CI}</td>
                  <td className="px-4 py-3 text-[#52525b]">{r.Desc_Cargo}</td>
                  <td className="px-4 py-3 text-[#52525b]">
                    {r.Desc_UnidadOrganizativa}
                  </td>
                  <td className="px-4 py-3 text-[#52525b]">
                    {r.Fecha_Contratacion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}