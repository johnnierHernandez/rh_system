"use client";

import { useEffect, useMemo, useState } from "react";

import RequiereSesion from "@/components/common/RequiereSesion";
import { ordenarAreas, type AreaReporte } from "@/lib/areas-reporte";
import {
  clavePeriodo,
  conPeriodoActual,
  esPeriodoActual,
  fechaCierre,
  periodoActual,
  periodoInicial,
  periodoTexto,
  type PeriodoTarifa,
} from "@/lib/tarifa-horaria";

type Item = {
  Id: number;
  Id_Empleado: string;
  Nombre: string;
  Horas: number;
  Baja: boolean;
};

type Respuesta = {
  ano: number;
  mes: number;
  area: number;
  area_nombre: string;
  items: Item[];
  total_horas: number;
  total_trabajadores: number;
  cerrado: boolean;
  cerrado_por: string | null;
  cerrado_en: string | null;
};

const nf = new Intl.NumberFormat("es-CU", {
  maximumFractionDigits: 2,
});

function horas(v: number): string {
  return nf.format(v);
}

export default function TarifaHorariaExplorer() {
  const [areas, setAreas] = useState<AreaReporte[]>([]);
  const [cargandoAreas, setCargandoAreas] = useState(true);
  const [areaId, setAreaId] = useState("");
  const [periodos, setPeriodos] = useState<PeriodoTarifa[]>([]);
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    // /api/reportes/areas exige sesión: responde 401 a un anónimo (la tarifa
    // horaria es de acceso restringido) y, con sesión, solo devuelve las áreas
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
        const ordenadas = ordenarAreas((d.areas ?? []) as AreaReporte[]);
        setAreas(ordenadas);
        // El catálogo ya viene acotado al visitante: para un jefe de área
        // contiene solo su área, que queda preseleccionada por defecto.
        if (ordenadas.length > 0) setAreaId(String(ordenadas[0].id));
      })
      .catch(() => setError("No se pudieron cargar las áreas de reportes."))
      .finally(() => setCargandoAreas(false));
  }, []);

  // Histórico de períodos. El público abre siempre en el mes en curso; los
  // períodos anteriores quedan disponibles en el histórico de solo lectura.
  useEffect(() => {
    fetch("/api/tarifa-horaria/periodos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const lista = conPeriodoActual(
          (d.periodos ?? []) as PeriodoTarifa[],
        );
        setPeriodos(lista);
        const inicial = periodoInicial(lista);
        if (inicial) {
          setAno(inicial.ano);
          setMes(inicial.mes);
        }
      })
      .catch(() => {
        const actual = periodoActual();
        setPeriodos(conPeriodoActual([]));
        setAno(actual.ano);
        setMes(actual.mes);
      });
  }, []);

  useEffect(() => {
    if (!areaId || ano === null || mes === null) {
      setDatos(null);
      return;
    }
    const ctrl = new AbortController();
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({
          area: areaId,
          ano: String(ano),
          mes: String(mes),
        });
        const r = await fetch(`/api/tarifa-horaria?${params.toString()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error("fallo");
        setDatos((await r.json()) as Respuesta);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("No se pudieron cargar las horas del área. Inténtelo de nuevo.");
        }
      } finally {
        if (!ctrl.signal.aborted) setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [areaId, ano, mes]);

  const items = datos?.items ?? [];
  const area = useMemo(
    () => areas.find((a) => a.id === Number(areaId)) ?? null,
    [areas, areaId],
  );
  const periodosAbiertos = useMemo(
    () => periodos.filter((p) => !p.cerrado),
    [periodos],
  );
  const periodosCerrados = useMemo(
    () => periodos.filter((p) => p.cerrado),
    [periodos],
  );
  const pdfUrl =
    areaId && ano !== null && mes !== null
      ? `/api/reportes/tarifa_horaria?area=${areaId}&ano=${ano}&mes=${mes}`
      : null;

  if (sinSesion) {
    return (
      <RequiereSesion mensaje="La tarifa horaria es de acceso restringido. Inicia sesión con tu usuario institucional para consultarla." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-md">
          <label
            htmlFor="tarifa-horaria-area"
            className="mb-1.5 block text-sm font-medium text-[#52525b]"
          >
            Área
          </label>
          {cargandoAreas ? (
            <p className="text-sm text-[#52525b]">Cargando áreas…</p>
          ) : (
            <select
              id="tarifa-horaria-area"
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
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="tarifa-horaria-periodo"
            className="mb-1.5 block text-sm font-medium text-[#52525b]"
          >
            Período
          </label>
          <select
            id="tarifa-horaria-periodo"
            value={
              ano !== null && mes !== null ? clavePeriodo(ano, mes) : ""
            }
            onChange={(e) => {
              const [nuevoAno, nuevoMes] = e.target.value.split("-").map(Number);
              setDatos(null);
              setAno(nuevoAno);
              setMes(nuevoMes);
            }}
            className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 pr-8 text-sm text-[#1a1a1a] outline-none transition focus:border-[#006633]"
          >
            {ano !== null &&
              mes !== null &&
              !periodos.some((p) => p.ano === ano && p.mes === mes) && (
                <option value={clavePeriodo(ano, mes)}>
                  {periodoTexto(ano, mes)}
                </option>
              )}
            {periodosAbiertos.length > 0 && (
              <optgroup label="Períodos abiertos">
                {periodosAbiertos.map((p) => (
                  <option
                    key={clavePeriodo(p.ano, p.mes)}
                    value={clavePeriodo(p.ano, p.mes)}
                  >
                    {periodoTexto(p.ano, p.mes)}
                  </option>
                ))}
              </optgroup>
            )}
            {periodosCerrados.length > 0 && (
              <optgroup label="Histórico (solo lectura)">
                {periodosCerrados.map((p) => (
                  <option
                    key={clavePeriodo(p.ano, p.mes)}
                    value={clavePeriodo(p.ano, p.mes)}
                  >
                    {periodoTexto(p.ano, p.mes)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
          }}
          disabled={!pdfUrl}
          className="h-11 shrink-0 rounded-xl border border-[#006633] bg-[#006633] px-4 text-sm font-medium text-white outline-none transition hover:bg-[#005226] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Imprimir PDF
        </button>
      </div>

      {error && (
        <p className="max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {!areaId && !error && (
        <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 text-center text-sm text-[#52525b]">
          Seleccione un área para ver los trabajadores con horas insertadas
          para el próximo pago.
        </div>
      )}

      {areaId && (
        <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e5e7eb] px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">
                  {datos?.area_nombre ?? area?.nombre ?? "Área"}
                </h2>
                {datos?.cerrado && (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Período cerrado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[#52525b]">
                Período:{" "}
                <span className="font-medium">
                  {datos
                    ? periodoTexto(datos.ano, datos.mes)
                    : ano !== null && mes !== null
                      ? periodoTexto(ano, mes)
                      : "—"}
                </span>
              </p>
              {datos?.cerrado && (
                <p className="mt-0.5 text-xs text-[#52525b]">
                  Cerrado
                  {datos.cerrado_en
                    ? ` el ${fechaCierre(datos.cerrado_en)}`
                    : ""}
                  {datos.cerrado_por ? ` por ${datos.cerrado_por}` : ""}. Forma
                  parte del histórico y es de solo lectura.
                </p>
              )}
            </div>
            {datos && (
              <p className="text-sm text-[#52525b]">
                <span className="font-semibold text-[#1a1a1a]">
                  {nf.format(datos.total_trabajadores)}
                </span>{" "}
                trabajador{datos.total_trabajadores === 1 ? "" : "es"} ·{" "}
                <span className="font-semibold text-[#1a1a1a]">
                  {horas(datos.total_horas)}
                </span>{" "}
                h
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e5e7eb]">
              <thead className="bg-[#f8faf9]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#52525b]">
                    Nro
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#52525b]">
                    Nombre y apellidos
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#52525b]">
                    Horas
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#52525b]">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2f1]">
                {items.map((i) => (
                  <tr key={i.Id} className="hover:bg-[#f8faf9]">
                    <td className="px-5 py-3 font-mono text-sm text-[#52525b]">
                      {i.Id_Empleado}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-[#1a1a1a]">
                      {i.Nombre}
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-[#1a1a1a]">
                      {horas(i.Horas)}
                    </td>
                    <td className="px-5 py-3">
                      {i.Baja ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          De baja
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Activo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!cargando && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-[#52525b]"
                    >
                      {datos &&
                      esPeriodoActual(datos.ano, datos.mes) &&
                      !datos.cerrado
                        ? "Esta área no tiene trabajadores con horas extras insertadas para el próximo pago."
                        : "Esta área no tiene trabajadores con horas extras insertadas para este período."}
                    </td>
                  </tr>
                )}
                {cargando && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-[#52525b]"
                    >
                      Cargando horas del área…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pdfUrl && (
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-[#52525b]">
            Reporte oficial del período seleccionado
          </p>
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title="Reporte de Tarifa Horaria"
            className="h-[75vh] w-full rounded-xl border border-[#e5e7eb] bg-white"
          />
        </div>
      )}
    </div>
  );
}
