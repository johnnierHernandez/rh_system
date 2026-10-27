"use client";

import { useEffect, useMemo, useState } from "react";

import RequiereSesion from "@/components/common/RequiereSesion";

type Area = { id: number; nombre: string };
type Plaza = {
  Plaza: number | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Id_Cargo: string | null;
  Desc_Cargo: string | null;
  Id_Categoria: string | null;
  Desc_Categoria: string | null;
  Salario_Basico: number | null;
  Plus: number | null;
  Estimulo: number | null;
  Otros: number | null;
};
type Respuesta = {
  area: string;
  area_nombre: string;
  total: number;
  plazas: Plaza[];
};

type Grupo = { unidad: string; filas: Plaza[] };

const ORDEN_AREAS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 35, 118, 14, 38, 16, 17, 18, 19, 20,
  21, 22, 23, 26, 28, 29, 30, 31, 32, 33, 34, 41, 42, 43, 107, 106, 47, 51,
  52, 53, 54, 55, 57, 58, 90, 103, 104, 102, 105, 109, 117, 111, 112, 113,
  114, 115, 116, 119, 120,
];

const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("es-CU", { minimumFractionDigits: 2 });

export default function PlazasVacantesExplorer() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargandoAreas, setCargandoAreas] = useState(true);
  const [areaId, setAreaId] = useState("");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    // /api/reportes/areas exige sesión: responde 401 a un anónimo (las plazas
    // vacantes son de acceso restringido) y, con sesión, solo devuelve las
    // áreas que el usuario puede ver.
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
      .finally(() => setCargandoAreas(false));
  }, []);

  useEffect(() => {
    if (!areaId) {
      setDatos(null);
      return;
    }
    let alive = true;
    setCargando(true);
    setError(null);
    setDatos(null);
    fetch(`/api/reportes/plazas_vacantes?area=${areaId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Respuesta) => {
        if (alive) setDatos(d);
      })
      .catch(() => {
        if (alive) setError("No se pudo cargar el reporte de plazas vacantes.");
      })
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [areaId]);

  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    for (const p of datos?.plazas ?? []) {
      const unidad = p.Desc_Direccion ?? p.Id_Direccion ?? "Sin unidad";
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.unidad === unidad) ultimo.filas.push(p);
      else out.push({ unidad, filas: [p] });
    }
    return out;
  }, [datos]);

  const totales = useMemo(() => {
    const filas = datos?.plazas ?? [];
    const suma = (k: keyof Plaza) =>
      filas.reduce((acc, p) => acc + Number(p[k] ?? 0), 0);
    return {
      basico: suma("Salario_Basico"),
      plus: suma("Plus"),
      estimulo: suma("Estimulo"),
      otros: suma("Otros"),
    };
  }, [datos]);

  if (sinSesion) {
    return (
      <RequiereSesion mensaje="Las plazas vacantes son de acceso restringido. Inicia sesión con tu usuario institucional para consultarlas." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="pv-area" className="mb-1.5 block text-sm font-medium text-[#52525b]">
          Área
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-md">
            {cargandoAreas ? (
              <p className="text-sm text-[#52525b]">Cargando áreas…</p>
            ) : (
              <select
                id="pv-area"
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
          {datos && !cargando && (
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
              {datos.total} {datos.total === 1 ? "plaza vacante" : "plazas vacantes"}
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
            Seleccione un área para ver sus plazas vacantes.
          </p>
        ) : (datos?.plazas.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-[#52525b]">
            No hay plazas vacantes en el área seleccionada.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f4faf6] text-[#006633]">
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 text-right font-semibold">Básico</th>
                <th className="px-4 py-3 text-right font-semibold">Plus</th>
                <th className="px-4 py-3 text-right font-semibold">Estímulo</th>
                <th className="px-4 py-3 text-right font-semibold">Otros</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Group key={g.unidad} grupo={g} money={money} />
              ))}
              <tr className="border-t-2 border-[#006633] bg-[#f4faf6] font-semibold text-[#1a1a1a]">
                <td className="px-4 py-3" colSpan={2}>
                  Total ({datos?.total})
                </td>
                <td className="px-4 py-3 text-right">{money(totales.basico)}</td>
                <td className="px-4 py-3 text-right">{money(totales.plus)}</td>
                <td className="px-4 py-3 text-right">{money(totales.estimulo)}</td>
                <td className="px-4 py-3 text-right">{money(totales.otros)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Group({
  grupo,
  money,
}: {
  grupo: Grupo;
  money: (v: number | null | undefined) => string;
}) {
  return (
    <>
      <tr className="bg-[#eef4ef]">
        <td
          className="px-4 py-2 font-semibold uppercase tracking-wide text-[#006633]"
          colSpan={6}
        >
          {grupo.unidad}
          <span className="ml-2 text-xs font-normal text-[#52525b]">
            ({grupo.filas.length})
          </span>
        </td>
      </tr>
      {grupo.filas.map((p, i) => (
        <tr key={`${p.Plaza ?? i}`} className="border-b border-[#f0f0f0] hover:bg-[#f4faf6]">
          <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">
            {p.Desc_Cargo ?? p.Id_Cargo}
          </td>
          <td className="px-4 py-2.5 text-[#52525b]">{p.Desc_Categoria ?? "—"}</td>
          <td className="px-4 py-2.5 text-right tabular-nums text-[#1a1a1a]">
            {money(p.Salario_Basico)}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums text-[#52525b]">
            {money(p.Plus)}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums text-[#52525b]">
            {money(p.Estimulo)}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums text-[#52525b]">
            {money(p.Otros)}
          </td>
        </tr>
      ))}
    </>
  );
}
