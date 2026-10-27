"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequiereSesion from "@/components/common/RequiereSesion";

type Area = { id: number; nombre: string; total: number; vacantes: number };
type Resumen = { total: number; cubiertas: number; vacantes: number; areas: Area[] };
type Plaza = {
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Desc_Cargo: string | null;
  Vacante: boolean | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Fecha_Contratacion: string | null;
  Fecha_Cargo: string | null;
};

const POR_PAGINA = 100;

const nf = new Intl.NumberFormat("es-CU");

function nombre(p: Plaza): string | null {
  const partes = [p.Nombre, p.Apellido_1, p.Apellido_2].filter(Boolean);
  return partes.length ? partes.join(" ") : null;
}

function unidad(p: Plaza): string {
  const crudo = p.Desc_Direccion?.trim() || p.Id_Direccion?.trim() || "";
  return crudo.replace(/\s+/g, " ") || "Sin unidad";
}

type Grupo = {
  key: string;
  nombre: string;
  filas: Plaza[];
};

function fecha(v: string | null): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export default function PlantillaExplorer() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [area, setArea] = useState("");
  const [pagina, setPagina] = useState(1);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // La sesión se sondea antes de pintar nada: hasta saber si hay sesión no se
  // muestra el selector ni los conteos de plazas (que salen de un endpoint
  // público y no deben verse sin autenticarse).
  const [sesionVerificada, setSesionVerificada] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/mi/areas", { cache: "no-store" })
      .then((r) => {
        if (!vivo) return;
        if (r.status === 401) setSinSesion(true);
        setSesionVerificada(true);
      })
      .catch(() => {
        if (vivo) setSesionVerificada(true);
      });
    (async () => {
      try {
        const r = await fetch("/api/plantilla/areas", { cache: "no-store" });
        if (!r.ok) throw new Error("no se pudo leer el conteo de plazas");
        const d = (await r.json()) as Resumen;
        if (vivo) {
          setResumen(d);
          if (d.areas.length) setArea(String(d.areas[0].id));
        }
      } catch {
        if (vivo) setError("No se pudo cargar el resumen de la plantilla.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    if (!area) return;
    setCargando(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        limit: String(POR_PAGINA),
        offset: String((pagina - 1) * POR_PAGINA),
        area,
      });
      const r = await fetch(`/api/plantilla?${q}`, { cache: "no-store" });
      if (r.status === 401) {
        setSinSesion(true);
        return;
      }
      if (!r.ok) throw new Error("fallo");
      setPlazas((await r.json()) as Plaza[]);
      setTotal(resumen?.areas.find((a) => String(a.id) === area)?.total ?? 0);
    } catch {
      setError("No se pudo cargar la plantilla. Inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [area, pagina, resumen]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const grupos = useMemo<Grupo[]>(() => {
    const mapa = new Map<string, Plaza[]>();
    for (const p of plazas) {
      const key = p.Id_Direccion?.trim() || "";
      const actual = mapa.get(key);
      if (actual) actual.push(p);
      else mapa.set(key, [p]);
    }
    return [...mapa.entries()].map(([key, filas]) => ({
      key,
      nombre: unidad(filas[0]),
      filas,
    }));
  }, [plazas]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const sel = resumen?.areas.find((a) => String(a.id) === area);
  const cubiertasSel = sel ? sel.total - sel.vacantes : 0;
  const vacantesSel = sel ? sel.vacantes : 0;

  // Sin sesión verificada aún: no se pinta nada (evita que se vea el
  // selector o los conteos un instante antes de saber que no hay acceso).
  if (!sesionVerificada) {
    return (
      <p className="mt-6 text-sm text-[#52525b]">Cargando…</p>
    );
  }

  // Sin sesión: solo el aviso de acceso, nunca el selector ni los conteos.
  if (sinSesion) {
    return (
      <RequiereSesion mensaje="La plantilla es de acceso restringido. Inicia sesión con tu usuario institucional para consultarla." />
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3.5 text-red-800">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 1.5a.75.75 0 0 1 .585.283l2.236 2.682 3.213-.78c.585-.14 1.272.14 1.547.848l2.575 6.587-2.575 6.587c-.275.708-.962.988-1.547.848l-3.213-.78-2.236 2.682a.75.75 0 0 1-1.17 0L11.42 18.775l-3.213.78c-.585.14-1.272-.14-1.546-.848l-2.575-6.587 2.575-6.586c.274-.708.961-.988 1.546-.848l3.213.78L11.415 1.783A.75.75 0 0 1 12 1.5Zm0 2.85L10.2 6.53a.75.75 0 0 1-.638.309l-3.028-.735-2.304 5.896 2.304 5.897 3.028-.736a.75.75 0 0 1 .638.31l1.8 2.18 1.8-2.18a.75.75 0 0 1 .638-.31l3.028.736 2.304-5.897-2.304-5.896-3.028.735a.75.75 0 0 1-.638-.309L12 4.35Zm-2.25 7.15a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Zm2.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
            fill="currentColor"
          />
        </svg>
        <div>
          <p className="font-semibold">Protección de datos personales</p>
          <p className="mt-0.5 leading-relaxed">
            De conformidad con la legislación vigente sobre protección de datos
            personales, el carné de identidad y los números de teléfono del
            personal no se publican en esta vista. La consulta de dichos datos
            está reservada exclusivamente al personal que cuente con el perfil
            autorizado para tal fin.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="plantilla-area" className="block text-sm font-medium text-[#1a1a1a]">
              Área
            </label>
            {cargando && !resumen ? (
              <p className="mt-2 text-sm text-[#52525b]">Cargando áreas…</p>
            ) : (
              <select
                id="plantilla-area"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setPagina(1);
                }}
                className="mt-1 h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 pr-8 text-sm text-[#1a1a1a] outline-none transition focus:border-[#006633]"
              >
                {(resumen?.areas ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.total})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-end">
            <p className="h-11 w-full rounded-xl bg-[#f4f6f4] px-3 py-2 text-sm text-[#52525b]">
              <span className="font-semibold text-[#006633]">{nf.format(sel?.total ?? 0)}</span>{" "}
              plazas en el área
            </p>
          </div>
          <div className="flex items-end">
            <p className="h-11 w-full rounded-xl bg-[#f4f6f4] px-3 py-2 text-sm text-[#52525b]">
              <span className="font-semibold text-emerald-700">
                {nf.format(cubiertasSel)}
              </span>{" "}
              cubiertas
            </p>
          </div>
          <div className="flex items-end">
            <p className="h-11 w-full rounded-xl bg-[#f4f6f4] px-3 py-2 text-sm text-[#52525b]">
              <span className="font-semibold text-amber-700">
                {nf.format(vacantesSel)}
              </span>{" "}
              no cubiertas
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f4f6f4] text-left text-[#1a1a1a]">
            <tr>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Persona</th>
              <th className="px-4 py-2">Contratación</th>
              <th className="px-4 py-2">Desde el cargo</th>
            </tr>
          </thead>
          {grupos.map((g) => {
            const cub = g.filas.filter((p) => !p.Vacante).length;
            const vac = g.filas.length - cub;
            return (
              <tbody key={g.key} className="border-t border-[#c9e9da]">
                <tr>
                  <th colSpan={5} scope="colgroup" className="bg-[#e8f3ec] px-4 py-2 text-left">
                    <span className="font-semibold text-[#006633]">{g.nombre}</span>
                    {g.key && (
                      <span className="ml-2 font-mono text-xs text-[#52525b]">{g.key}</span>
                    )}
                    <span className="ml-3 text-xs text-[#52525b]">
                      {g.filas.length} plazas · {cub} cubiertas · {vac} no cubiertas
                    </span>
                  </th>
                </tr>
                {g.filas.map((p, i) => (
                  <tr key={i} className="divide-y divide-[#e5e7eb] hover:bg-gray-50">
                    <td className="px-4 py-2">{p.Desc_Cargo ?? "—"}</td>
                    <td className="px-4 py-2">
                      {p.Vacante ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          No cubierta
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Cubierta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{nombre(p) ?? "—"}</td>
                    <td className="px-4 py-2 text-[#52525b]">{fecha(p.Fecha_Contratacion)}</td>
                    <td className="px-4 py-2 text-[#52525b]">{fecha(p.Fecha_Cargo)}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          {!cargando && plazas.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#52525b]">
                  Sin plazas para este área.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#52525b]">
        <p>
          {total === 0
            ? "Sin plazas"
            : `Mostrando ${nf.format((pagina - 1) * POR_PAGINA + 1)}–${nf.format(
                Math.min(pagina * POR_PAGINA, total),
              )} de ${nf.format(total)}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPagina((n) => Math.max(1, n - 1))}
            disabled={pagina <= 1 || cargando}
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#1a1a1a] transition hover:border-[#006633] disabled:opacity-40"
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
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#1a1a1a] transition hover:border-[#006633] disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
