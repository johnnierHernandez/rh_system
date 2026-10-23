"use client";

import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Trabajador = {
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Fecha_Contratacion: string | null;
  Fecha_Baja: string | null;
};

type TrabajadorLista = { total: number; items: Trabajador[] };

const POR_PAGINA = 50;

const nf = new Intl.NumberFormat("es-CU");

function fecha(v: string | null): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function nombre(p: Trabajador): string {
  return [p.Nombre, p.Apellido_1, p.Apellido_2].filter(Boolean).join(" ") || "—";
}

function area(p: Trabajador): string {
  return p.Desc_Direccion?.trim() || p.Id_Direccion?.trim() || "Sin área";
}

export default function TrabajadoresExplorer() {
  const [estado, setEstado] = useState<"activos" | "baja">("activos");
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<TrabajadorLista | null>(null);
  const [conteos, setConteos] = useState({ activos: 0, baja: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    (async () => {
      const valores: Record<string, number> = {};
      const estados: ("activos" | "baja")[] = ["activos", "baja"];
      for (const e of estados) {
        try {
          const r = await fetch(
            `/api/trabajadores/lista?estado=${e}&limit=1&offset=0`,
            { cache: "no-store" },
          );
          if (r.ok) {
            const d = (await r.json()) as TrabajadorLista;
            valores[e] = d.total;
          }
        } catch {
          valores[e] = 0;
        }
      }
      if (vivo.current) setConteos({ activos: valores.activos, baja: valores.baja });
    })();
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(busqueda.trim());
      setPagina(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    const token = new AbortController();
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({
          estado,
          limit: String(POR_PAGINA),
          offset: String((pagina - 1) * POR_PAGINA),
        });
        if (q) params.set("q", q);
        const r = await fetch(`/api/trabajadores/lista?${params}`, {
          cache: "no-store",
          signal: token.signal,
        });
        if (!r.ok) throw new Error("fallo");
        setDatos((await r.json()) as TrabajadorLista);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("No se pudo cargar el listado de trabajadores. Inténtelo de nuevo.");
        }
      } finally {
        if (!token.signal.aborted) setCargando(false);
      }
    })();
    return () => token.abort();
  }, [estado, q, pagina]);

  const filas = useMemo(() => datos?.items ?? [], [datos]);
  const total = datos?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const seleccionarEstado = (e: "activos" | "baja") => {
    if (e !== estado) {
      setEstado(e);
      setPagina(1);
    }
  };

  const limpiaBusqueda = () => {
    setBusqueda("");
    setQ("");
    setPagina(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/3">
          <button
            type="button"
            onClick={() => seleccionarEstado("activos")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              estado === "activos"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            Activos
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                estado === "activos"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
              }`}
            >
              {nf.format(conteos.activos)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => seleccionarEstado("baja")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              estado === "baja"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            De baja
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                estado === "baja"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              }`}
            >
              {nf.format(conteos.baja)}
            </span>
          </button>
        </div>

        <div className="flex min-w-60 grow items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:min-w-80 dark:border-gray-800 dark:bg-white/3">
          <svg
            className="h-5 w-5 shrink-0 text-gray-400"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
              fill="currentColor"
            />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, apellidos o carné de identidad…"
            className="h-7 w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={limpiaBusqueda}
              aria-label="Limpiar búsqueda"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 6.21967C6.51256 5.92678 6.98744 5.92678 7.28033 6.21967L12 10.9393L16.7197 6.21967C17.0126 5.92678 17.4874 5.92678 17.7803 6.21967C18.0732 6.51256 18.0732 6.98744 17.7803 7.28033L13.0607 12L17.7803 16.7197C18.0732 17.0126 18.0732 17.4874 17.7803 17.7803C17.4874 18.0732 17.0126 18.0732 16.7197 17.7803L12 13.0607L7.28033 17.7803C6.98744 18.0732 6.51256 18.0732 6.21967 17.7803C5.92678 17.4874 5.92678 17.0126 6.21967 16.7197L10.9393 12L6.21967 7.28033C5.92678 6.98744 5.92678 6.51256 6.21967 6.21967Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Trabajador
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Carné de identidad
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Área
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Contratación
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Fecha de baja
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filas.map((t) => (
                <tr key={t.Id_Expediente} className="hover:bg-gray-50 dark:hover:bg-white/2">
                  <td className="px-4 py-3">
                    {t.No_CI ? (
                      <Link
                        href={`/portal/trabajadores/${t.No_CI}`}
                        title={`Ver perfil de ${nombre(t)}`}
                        className="group block max-w-72"
                      >
                        <span className="block truncate font-medium text-gray-800 transition group-hover:text-emerald-600 dark:text-white/90 dark:group-hover:text-emerald-400">
                          {nombre(t)}
                        </span>
                        <span className="block truncate text-xs text-gray-500 transition group-hover:text-emerald-700 dark:text-gray-400 dark:group-hover:text-emerald-500">
                          Expediente {t.Id_Expediente ?? "—"}
                        </span>
                      </Link>
                    ) : (
                      <div className="max-w-72">
                        <p className="truncate font-medium text-gray-800 dark:text-white/90">
                          {nombre(t)}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          Expediente {t.Id_Expediente ?? "—"}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {t.No_CI ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-96 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-2" title={area(t)}>
                      {area(t)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {fecha(t.Fecha_Contratacion)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {estado === "baja" ? fecha(t.Fecha_Baja) : "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {estado === "baja" ? (
                      <Badge variant="solid" color="warning">
                        De baja
                      </Badge>
                    ) : (
                      <Badge variant="solid" color="success">
                        Activo
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    {q
                      ? "Sin resultados para la búsqueda. Pruebe con otro nombre, apellido o carné."
                      : "No hay trabajadores para mostrar."}
                  </td>
                </tr>
              )}
              {cargando && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    Cargando trabajadores…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <p>
          {total === 0
            ? "Sin resultados"
            : `Mostrando ${nf.format((pagina - 1) * POR_PAGINA + 1)}–${nf.format(
                Math.min(pagina * POR_PAGINA, total),
              )} de ${nf.format(total)}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPagina((n) => Math.max(1, n - 1))}
            disabled={pagina <= 1 || cargando}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition hover:border-emerald-400 disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600"
          >
            Anterior
          </button>
          <span className="px-1 tabular-nums">
            {pagina} / {paginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((n) => Math.min(paginas, n + 1))}
            disabled={pagina >= paginas || cargando}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition hover:border-emerald-400 disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}