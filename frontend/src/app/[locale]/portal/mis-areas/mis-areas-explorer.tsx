"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";

/** Área de reporte asignada a la persona autenticada. */
type Area = {
  area_id: number;
  nombre: string | null;
  es_jefe: boolean;
};

/** Persona que el jefe ha designado en una de sus áreas. */
type Delegado = {
  carnet_identidad: string;
  nombre: string | null;
  apellidos: string | null;
  usuario_internet: string | null;
  area_id: number;
  area_nombre: string | null;
  creado: string | null;
};

/**
 * Panel del jefe de área: designa delegados y gestiona su ámbito.
 *
 * El jefe ve sus áreas y, desde aquí, autoriza a otras personas de esa área
 * (aunque no sean cuadros) a consultar los mismos reportes. El backend valida
 * con la regla del sistema "viajes" que la persona designada pertenezca al
 * área o a un área dependiente antes de autorizarla.
 */
export default function MisAreasExplorer() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [delegados, setDelegados] = useState<Delegado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [identificador, setIdentificador] = useState("");
  const [areaSel, setAreaSel] = useState<string>("");
  const [delegando, setDelegando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [rAreas, rDeleg] = await Promise.all([
        fetch("/api/mi/areas", { cache: "no-store" }),
        fetch("/api/mi/delegados", { cache: "no-store" }),
      ]);
      if (!rAreas.ok) throw new Error("No se pudieron cargar tus áreas.");
      const listaAreas = (await rAreas.json()) as Area[];
      setAreas(listaAreas);
      setDelegados(rDeleg.ok ? ((await rDeleg.json()) as Delegado[]) : []);
      // Preseleccionar la primera área de la que es jefe titular.
      const primera = listaAreas.find((a) => a.es_jefe);
      if (primera) setAreaSel(String(primera.area_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const delegar = async () => {
    const id = identificador.trim();
    if (!id || !areaSel || delegando) return;
    setDelegando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/jefe/delegar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: id, area_id: Number(areaSel) }),
        cache: "no-store",
      });
      const cuerpo = (await res.json().catch(() => ({}))) as { detail?: string };
      if (res.ok) {
        setMensaje(`Se autorizó a ${id} para consultar esta área.`);
        setIdentificador("");
        await cargar();
      } else {
        setError(cuerpo?.detail ?? "No se pudo designar a esa persona.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDelegando(false);
    }
  };

  const revocar = async (d: Delegado) => {
    const nombre = `${d.nombre ?? ""} ${d.apellidos ?? ""}`.trim() || d.carnet_identidad;
    if (!confirm(`¿Revocar el acceso de ${nombre} a esta área?`)) return;
    setOcupado(d.carnet_identidad);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/mi/delegados/${encodeURIComponent(d.carnet_identidad)}/${d.area_id}`,
        { method: "DELETE", cache: "no-store" },
      );
      if (res.ok) {
        setMensaje("Acceso revocado.");
        await cargar();
      } else {
        const cuerpo = await res.json().catch(() => ({}));
        setError((cuerpo as { detail?: string })?.detail ?? "No se pudo revocar.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setOcupado(null);
    }
  };

  const misJefaturas = areas.filter((a) => a.es_jefe);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Mis áreas y delegados
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Como jefe de área puedes autorizar a otras personas de tu misma área
          (aunque no sean cuadros) para que consulten la plantilla, nóminas, tarifa
          horaria, recién graduados y S.C.D. de esa área. Solo se aceptan personas
          que pertenezcan al área o a un área dependiente.
        </p>

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

        {cargando ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
        ) : misJefaturas.length === 0 ? (
          <p className="mt-4 rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-800">
            No eres jefe de ningún área todavía.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="sm:w-64">
              <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                Área
              </span>
              <select
                value={areaSel}
                onChange={(e) => setAreaSel(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">Seleccione un área</option>
                {misJefaturas.map((a) => (
                  <option key={a.area_id} value={a.area_id}>
                    {a.nombre ?? `Área ${a.area_id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                Persona a autorizar (carné o usuario)
              </span>
              <input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && delegar()}
                placeholder="ej. 84052425840 o jperez"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </label>
            <button
              type="button"
              onClick={delegar}
              disabled={delegando || !identificador.trim() || !areaSel}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {delegando ? "Autorizando…" : "Designar"}
            </button>
          </div>
        )}
      </div>

      {/* Delegados actuales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Personas autorizadas
        </h2>
        {cargando ? null : delegados.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            Aún no has autorizado a nadie en tus áreas.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Persona
                  </th>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Área
                  </th>
                  <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-white/3">
                {delegados.map((d) => (
                  <tr key={`${d.carnet_identidad}-${d.area_id}`}>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {d.nombre} {d.apellidos}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {d.carnet_identidad}
                        {d.usuario_internet ? ` · @${d.usuario_internet}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      <Badge color="primary">{d.area_nombre ?? `Área ${d.area_id}`}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => revocar(d)}
                        disabled={ocupado === d.carnet_identidad}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        {ocupado === d.carnet_identidad ? "…" : "Revocar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
