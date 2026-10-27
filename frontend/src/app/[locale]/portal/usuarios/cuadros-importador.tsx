"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";

/**
 * Cuadro activo (categoría 5) con su estado en el portal.
 *
 * `area_id`, `en_portal` y `es_jefe` los rellena el backend solo en la vista
 * de administración: son los tres datos que necesita esta tabla para poder
 * importar los cuadros y marcar quién es jefe de área.
 */
type Cuadro = {
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Desc_Cargo: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  area_id: number | null;
  en_portal: boolean;
  es_jefe: boolean;
};

type ImportResumen = {
  total_cuadros: number;
  importados: number;
  ya_existian: number;
  errores: { identificador: string; motivo: string }[];
  resumen: string;
};

const POR_PAGINA = 25;

function _normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Importación de cuadros al portal y marcado de jefes de área.
 *
 * Los cuadros no son una entidad propia: son las personas con categoría
 * ocupacional 5 en RRHH. Aquí se dan de alta en el portal (cuentas LDAP) y se
 * marca con un checkbox quién es jefe de área. Al marcarlo, el backend toma el
 * área del cuadro (su `Id_Direccion` traducida a área de reporte) y lo vincula,
 * dándole el perfil `jefe_area` para que pueda consultar esos reportes y
 * designar delegados.
 */
export default function CuadrosImportador() {
  const [cuadros, setCuadros] = useState<Cuadro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<ImportResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cuadros?limit=500", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar los cuadros");
      const cuerpo = (await res.json()) as { items: Cuadro[] };
      setCuadros(cuerpo.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los cuadros");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const importar = async () => {
    if (importando) return;
    setImportando(true);
    setError(null);
    setResumen(null);
    try {
      const res = await fetch("/api/admin/cuadros/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solo_faltantes: true }),
        cache: "no-store",
      });
      const cuerpo = (await res.json().catch(() => ({}))) as ImportResumen & {
        detail?: string;
      };
      if (res.ok) {
        setResumen(cuerpo);
        await cargar();
      } else {
        setError(cuerpo?.detail ?? "No se pudieron importar los cuadros.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setImportando(false);
    }
  };

  /** Marca (o desmarca) a un cuadro como jefe de su área de reporte. */
  const alternarJefe = async (c: Cuadro) => {
    const carnet = (c.No_CI ?? "").trim();
    if (!carnet || c.area_id == null) return;
    setOcupado(carnet);
    setError(null);
    setMensaje(null);
    try {
      const url = `/api/admin/usuarios/${encodeURIComponent(carnet)}/areas`;
      const res = c.es_jefe
        ? await fetch(`${url}/${c.area_id}`, { method: "DELETE", cache: "no-store" })
        : await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area_id: c.area_id, es_jefe: true }),
            cache: "no-store",
          });
      if (res.ok) {
        setMensaje(
          c.es_jefe
            ? "Se quitó la jefatura de área."
            : "Marcado como jefe de área; ya puede consultar y delegar en su área.",
        );
        setCuadros((prev) =>
          prev.map((x) => (x.No_CI === c.No_CI ? { ...x, es_jefe: !c.es_jefe, en_portal: true } : x)),
        );
      } else {
        const cuerpo = await res.json().catch(() => ({}));
        setError((cuerpo as { detail?: string })?.detail ?? "No se pudo guardar la jefatura.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setOcupado(null);
    }
  };

  const visibles = (() => {
    const s = _normalizar(busqueda);
    const lista = s
      ? cuadros.filter((c) =>
          [c.No_CI, c.Nombre, c.Apellido_1, c.Apellido_2, c.Desc_Cargo, c.Desc_Direccion]
            .filter(Boolean)
            .some((campo) => _normalizar(campo as string).includes(s)),
        )
      : cuadros;
    return lista;
  })();

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const enPortal = cuadros.filter((c) => c.en_portal).length;
  const jefes = cuadros.filter((c) => c.es_jefe).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Cuadros
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Los cuadros (categoría ocupacional 5) se dan de alta aquí con su usuario
            y clave institucionales. Marca con el checkbox quién es jefe de área: al
            hacerlo se le autoriza a consultar la plantilla, nóminas, tarifa horaria,
            recién graduados y S.C.D. de su propia área, y a designar delegados en ella.
          </p>
        </div>
        <button
          type="button"
          onClick={importar}
          disabled={importando}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importando ? "Importando…" : "Importar cuadros al portal"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          {mensaje}
        </p>
      )}
      {resumen && (
        <div className="mt-3 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <p className="font-medium">{resumen.resumen}</p>
          <p className="mt-0.5 text-brand-600/90 dark:text-brand-300/80">
            {resumen.total_cuadros} cuadros · {resumen.ya_existian} ya estaban ·{" "}
            {resumen.importados} importados
          </p>
          {resumen.errores.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {resumen.errores.slice(0, 8).map((e, i) => (
                <li key={i} className="text-xs">
                  <span className="font-mono">{e.identificador}</span> — {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar cuadro por nombre, carné, cargo o área…"
          className="w-full max-w-md rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
        {!cargando && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {enPortal} de {cuadros.length} en el portal · {jefes} jefes de área
          </p>
        )}
      </div>

      {cargando ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"
            />
          ))}
        </div>
      ) : enPagina.length === 0 ? (
        <p className="mt-4 rounded-xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-800">
          {busqueda ? `Sin resultados para «${busqueda}».` : "No hay cuadros."}
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cuadro
                  </th>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Área
                  </th>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Portal
                  </th>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    ¿Jefe de área?
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-white/3">
                {enPagina.map((c) => {
                  const carnet = (c.No_CI ?? "").trim();
                  const sinArea = c.area_id == null;
                  const deshabilitado = sinArea || !c.en_portal || ocupado === carnet;
                  return (
                    <tr key={carnet || c.Desc_Cargo} className="align-top">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {c.Nombre} {c.Apellido_1} {c.Apellido_2}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {c.No_CI} · {c.Desc_Cargo ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                        <p className="max-w-48 truncate" title={c.Desc_Direccion ?? ""}>
                          {c.Desc_Direccion ?? "—"}
                        </p>
                        {sinArea && (
                          <p className="text-xs text-warning-600 dark:text-warning-400">
                            Sin área de reporte asignada
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.en_portal ? (
                          <Badge color="success">Importado</Badge>
                        ) : (
                          <Badge color="warning">Pendiente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <label
                          className={`flex items-center gap-2 text-sm ${
                            deshabilitado ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                          title={
                            sinArea
                              ? "Este cuadro no tiene un área de reporte asociada"
                              : !c.en_portal
                                ? "Primero impórtalo al portal"
                                : c.es_jefe
                                  ? "Quitar la jefatura de área"
                                  : "Marcar como jefe de su área"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={c.es_jefe}
                            disabled={deshabilitado}
                            onChange={() => alternarJefe(c)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            {c.es_jefe ? "Sí" : "No"}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {paginaActual} de {totalPaginas}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
