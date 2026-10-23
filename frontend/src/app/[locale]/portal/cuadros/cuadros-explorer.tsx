"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Cuadro = {
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Cargo: string | null;
  Desc_Cargo: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
};

type CuadroLista = { total: number; items: Cuadro[] };

const POR_PAGINA = 50;

const nf = new Intl.NumberFormat("es-CU");

function nombre(c: Cuadro): string {
  return [c.Nombre, c.Apellido_1, c.Apellido_2].filter(Boolean).join(" ") || "—";
}

function cargo(c: Cuadro): string {
  return c.Desc_Cargo?.trim() || "—";
}

function area(c: Cuadro): string {
  return c.Desc_Direccion?.trim() || c.Id_Direccion?.trim() || "Sin área";
}

function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Retrato del cuadro, con las iniciales como respaldo.
 *
 * La foto la sirve `/api/trabajadores/{ci}/foto`, que ya la tenía en
 * `Empleados_Gral.Foto` y devuelve el tipo MIME real (la columna mezcla PNG y
 * JPEG). `loading="lazy"` evita pedir las 50 de la página de golpe; cuando no
 * hay retrato —10 de los 103 cuadros no lo tienen en la BD— el `<img>` falla
 * con 404 y se muestra el círculo con iniciales, en vez de un ícono roto.
 */
function Avatar({ ci, nombre }: { ci: string | null; nombre: string }) {
  const [fallo, setFallo] = useState(false);

  if (!ci || fallo) {
    return (
      <div
        title={fallo ? "Sin fotografía" : undefined}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300"
      >
        {iniciales(nombre)}
      </div>
    );
  }

  return (
    <img
      src={`/api/trabajadores/${encodeURIComponent(ci)}/foto`}
      alt={`Fotografía de ${nombre}`}
      title={nombre}
      loading="lazy"
      decoding="async"
      width={44}
      height={44}
      onError={() => setFallo(true)}
      className="h-11 w-11 shrink-0 rounded-full border border-gray-200 bg-gray-50 object-cover object-top dark:border-gray-700 dark:bg-white/5"
    />
  );
}

export default function CuadrosExplorer() {
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<CuadroLista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // La búsqueda espera a que el usuario pare de escribir antes de pegarle a la
  // base: sin esto cada tecla sería una consulta contra `Empleados_Gral`.
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
          limite: String(POR_PAGINA),
          offset: String((pagina - 1) * POR_PAGINA),
        });
        if (q) params.set("q", q);
        const r = await fetch(`/api/cuadros?${params}`, {
          cache: "no-store",
          signal: token.signal,
        });
        if (!r.ok) throw new Error("fallo");
        setDatos((await r.json()) as CuadroLista);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("No se pudo cargar el listado de cuadros. Inténtelo de nuevo.");
        }
      } finally {
        if (!token.signal.aborted) setCargando(false);
      }
    })();
    return () => token.abort();
  }, [q, pagina]);

  const filas = useMemo(() => datos?.items ?? [], [datos]);
  const total = datos?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const limpiaBusqueda = () => {
    setBusqueda("");
    setQ("");
    setPagina(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {cargando && total === 0
            ? "Consultando la plantilla…"
            : `${nf.format(total)} cuadro${total === 1 ? "" : "s"} activo${total === 1 ? "" : "s"}`}
        </p>

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
            placeholder="Nombre, apellidos, carné, cargo o área…"
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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <a
            href="/api/cuadros/exportar/pdf"
            download="cuadros.pdf"
            title="Descargar el listado completo de cuadros en PDF"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exportar PDF
          </a>
          <a
            href="/api/cuadros/exportar/excel"
            download="cuadros.xlsx"
            title="Descargar el listado completo de cuadros en Excel"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M14 3v5h5M9 13h6M9 17h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exportar Excel
          </a>
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
                  Cuadro
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Carné de identidad
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Cargo
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Área
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filas.map((c) => (
                <tr
                  key={c.No_CI ?? `${c.Id_Direccion}-${nombre(c)}`}
                  className="hover:bg-gray-50 dark:hover:bg-white/2"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar ci={c.No_CI} nombre={nombre(c)} />
                      <div className="min-w-0">
                        {c.No_CI ? (
                          <Link
                            href={`/portal/trabajadores/${c.No_CI}`}
                            title={`Ver perfil de ${nombre(c)}`}
                            className="group block max-w-56"
                          >
                            <span className="block truncate font-medium text-gray-800 transition group-hover:text-emerald-600 dark:text-white/90 dark:group-hover:text-emerald-400">
                              {nombre(c)}
                            </span>
                          </Link>
                        ) : (
                          <span className="block max-w-56 truncate font-medium text-gray-800 dark:text-white/90">
                            {nombre(c)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {c.No_CI ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-80 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-2" title={cargo(c)}>
                      {cargo(c)}
                    </span>
                  </td>
                  <td className="max-w-96 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-2" title={area(c)}>
                      {area(c)}
                    </span>
                  </td>
                </tr>
              ))}
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                    {q
                      ? "Sin resultados para la búsqueda. Pruebe con otro nombre, apellido, carné, cargo o área."
                      : "No hay cuadros para mostrar."}
                  </td>
                </tr>
              )}
              {cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                    Cargando cuadros…
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