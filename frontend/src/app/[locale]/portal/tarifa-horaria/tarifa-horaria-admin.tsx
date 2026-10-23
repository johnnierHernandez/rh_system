"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { ordenarAreas, type AreaReporte } from "@/lib/areas-reporte";
import {
  clavePeriodo,
  conPeriodoActual,
  fechaCierre,
  periodoActual,
  periodoTexto,
  type PeriodoTarifa,
} from "@/lib/tarifa-horaria";
import * as api from "@/lib/tarifa-horaria-api";
import { ErrorApi } from "@/lib/tarifa-horaria-api";

type Item = api.ItemTarifa;
type Respuesta = api.RespuestaAdmin;
type Trabajador = api.TrabajadorTarifa;

const nf = new Intl.NumberFormat("es-CU", { maximumFractionDigits: 2 });

export default function TarifaHorariaAdmin() {
  const [areas, setAreas] = useState<AreaReporte[]>([]);
  const [areaId, setAreaId] = useState("todas");
  const [filtro, setFiltro] = useState("");
  const [periodos, setPeriodos] = useState<PeriodoTarifa[]>([]);
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );

  const [nro, setNro] = useState("");
  const [horas, setHoras] = useState("");
  const [preview, setPreview] = useState<Trabajador | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editHoras, setEditHoras] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const busquedaRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .areasReporte()
      .then((lista) => setAreas(ordenarAreas(lista)))
      .catch(() => setError("No se pudieron cargar las áreas de reportes."));
  }, []);

  // La entrada de datos abre siempre en el mes en curso.
  useEffect(() => {
    const actual = periodoActual();
    setAno(actual.ano);
    setMes(actual.mes);
  }, []);

  const cargarPeriodos = useCallback(async () => {
    try {
      const lista = await api.periodos();
      setPeriodos(conPeriodoActual(lista));
    } catch {
      setPeriodos((previos) => (previos.length ? previos : conPeriodoActual([])));
    }
  }, []);

  useEffect(() => {
    void cargarPeriodos();
  }, [cargarPeriodos]);

  const recargar = useCallback(async () => {
    if (ano === null || mes === null) {
      setDatos(null);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.listarAdmin({
        ano,
        mes,
        area: areaId && areaId !== "todas" ? areaId : null,
      });
      setDatos(respuesta);
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.status === 401) {
          setError("La sesión expiró. Vuelva a entrar.");
          return;
        }
        if (err.status === 403) {
          setError(
            "Su perfil no tiene permiso para gestionar la tarifa horaria.",
          );
          return;
        }
      }
      setError(
        "No se pudieron cargar los trabajadores con tarifa horaria. Inténtelo de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }, [areaId, ano, mes]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Busca la ficha por número de cumplidor y selecciona automáticamente el
  // área del trabajador. Cancela la consulta anterior para que una respuesta
  // vieja no sobrescriba a la nueva.
  const buscarTrabajador = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || ano === null || mes === null) {
        busquedaRef.current?.abort();
        setPreview(null);
        setBuscando(false);
        return;
      }
      busquedaRef.current?.abort();
      const controller = new AbortController();
      busquedaRef.current = controller;
      setBuscando(true);
      try {
        const data = await api.buscar(
          limpio,
          { ano, mes },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setPreview(data);
        if (data.encontrado && data.Id_Area > 0) {
          setDatos(null);
          setAreaId(String(data.Id_Area));
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        if (err instanceof ErrorApi && (err.status === 401 || err.status === 403)) {
          setPreview(null);
          setError("Su perfil no tiene permiso para insertar horas.");
          return;
        }
        setPreview(null);
      } finally {
        if (!controller.signal.aborted) setBuscando(false);
      }
    },
    [ano, mes],
  );

  useEffect(() => {
    const texto = nro.trim();
    busquedaRef.current?.abort();
    setPreview(null);
    if (!texto || ano === null || mes === null) {
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = window.setTimeout(() => {
      void buscarTrabajador(texto);
    }, 350);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [nro, ano, mes, buscarTrabajador]);

  useEffect(() => {
    return () => {
      busquedaRef.current?.abort();
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const horasValidas = useMemo(() => {
    const valor = Number(horas.replace(",", "."));
    return Number.isFinite(valor) && valor > 0;
  }, [horas]);

  function buscarAhora() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void buscarTrabajador(nro);
  }

  function limpiarBusqueda() {
    busquedaRef.current?.abort();
    setNro("");
    setHoras("");
    setPreview(null);
    setBuscando(false);
    setAviso(null);
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (cerradoPeriodo) {
      setAviso({
        tipo: "error",
        texto: "El período está cerrado y no admite cambios.",
      });
      return;
    }
    if (!preview?.encontrado) {
      setAviso({
        tipo: "error",
        texto: "Busque un trabajador por su número de cumplidor antes de insertar.",
      });
      return;
    }
    if (preview.Id_Area <= 0) {
      setAviso({
        tipo: "error",
        texto:
          "No se pudo determinar el área del trabajador. Revise su unidad en la nómina.",
      });
      return;
    }
    const idEmpleado = preview.Id_Empleado;
    if (!idEmpleado) {
      setAviso({
        tipo: "error",
        texto: "No se pudo identificar al trabajador. Vuelva a buscarlo.",
      });
      return;
    }
    if (ano === null || mes === null) {
      setAviso({ tipo: "error", texto: "Seleccione un período antes de insertar." });
      return;
    }
    const valor = Number(horas.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setAviso({ tipo: "error", texto: "Escriba una cantidad de horas mayor que cero." });
      return;
    }
    const nombre = preview.Nombre ?? `el trabajador ${idEmpleado}`;
    cancelarEdicion();
    setGuardando(true);
    setAviso(null);
    try {
      let d: { creado?: boolean };
      try {
        d = await api.guardar({
          area: preview.Id_Area,
          Id_Empleado: idEmpleado,
          Horas: valor,
          ano,
          mes,
        });
      } catch (err) {
        const status = err instanceof ErrorApi ? err.status : 0;
        setAviso({
          tipo: "error",
          texto:
            err instanceof ErrorApi
              ? err.message
              : "No se pudieron guardar las horas.",
        });
        if (status === 409) {
          await recargar();
          await cargarPeriodos();
        }
        return;
      }
      setAviso({
        tipo: "ok",
        texto: d.creado
          ? `Horas insertadas a ${nombre}.`
          : `Horas actualizadas a ${nombre}.`,
      });
      setNro("");
      setHoras("");
      setPreview(null);
      await recargar();
      await cargarPeriodos();
    } catch {
      setAviso({
        tipo: "error",
        texto: "No se pudieron guardar las horas. Inténtelo de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(item: Item) {
    if (cerradoPeriodo) {
      setAviso({
        tipo: "error",
        texto: "El período está cerrado y no admite cambios.",
      });
      return;
    }
    if (
      !window.confirm(
        `¿Eliminar las ${nf.format(item.Horas)} h de ${item.Nombre}?`,
      )
    ) {
      return;
    }
    setAviso(null);
    try {
      try {
        await api.eliminar(item.Id);
      } catch (err) {
        const status = err instanceof ErrorApi ? err.status : 0;
        setAviso({
          tipo: "error",
          texto:
            err instanceof ErrorApi
              ? err.message
              : "No se pudo eliminar la fila.",
        });
        if (status === 409 || status === 404) {
          await recargar();
          await cargarPeriodos();
        }
        return;
      }
      setAviso({ tipo: "ok", texto: "Fila eliminada." });
      if (editandoId === item.Id) cancelarEdicion();
      if (preview?.Id_Empleado === item.Id_Empleado) {
        setNro("");
        setHoras("");
        setPreview(null);
      }
      await recargar();
      await cargarPeriodos();
    } catch {
      setAviso({
        tipo: "error",
        texto: "No se pudo eliminar la fila. Inténtelo de nuevo.",
      });
    }
  }

  function iniciarEdicion(item: Item) {
    if (cerradoPeriodo) {
      setAviso({
        tipo: "error",
        texto: "El período está cerrado y no admite cambios.",
      });
      return;
    }
    setEditandoId(item.Id);
    setEditHoras(String(item.Horas));
    setAviso(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditHoras("");
  }

  async function guardarEdicion(item: Item) {
    if (cerradoPeriodo) {
      setAviso({
        tipo: "error",
        texto: "El período está cerrado y no admite cambios.",
      });
      return;
    }
    const valor = Number(editHoras.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setAviso({
        tipo: "error",
        texto: "Escriba una cantidad de horas mayor que cero.",
      });
      return;
    }
    setGuardandoEdicion(true);
    setAviso(null);
    try {
      try {
        await api.actualizar(item.Id, valor);
      } catch (err) {
        const status = err instanceof ErrorApi ? err.status : 0;
        setAviso({
          tipo: "error",
          texto:
            err instanceof ErrorApi
              ? err.message
              : "No se pudieron actualizar las horas.",
        });
        if (status === 409 || status === 404) {
          cancelarEdicion();
          await recargar();
          await cargarPeriodos();
        }
        return;
      }
      setAviso({
        tipo: "ok",
        texto: `Horas actualizadas a ${item.Nombre}.`,
      });
      if (preview?.Id_Empleado === item.Id_Empleado) {
        setNro("");
        setHoras("");
        setPreview(null);
      }
      cancelarEdicion();
      await recargar();
      await cargarPeriodos();
    } catch {
      setAviso({
        tipo: "error",
        texto: "No se pudieron actualizar las horas. Inténtelo de nuevo.",
      });
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function cerrarPeriodo() {
    if (ano === null || mes === null) return;
    const resumen = periodoSeleccionado
      ? ` (${periodoSeleccionado.trabajadores} trabajadores, ${nf.format(
          periodoSeleccionado.horas,
        )} h)`
      : "";
    if (
      !window.confirm(
        `¿Cerrar la inserción de tarifa horaria de ${periodoTexto(
          ano,
          mes,
        )}${resumen}? ` +
          "Se bloqueará la inserción, modificación y eliminación para todos " +
          "los trabajadores de ese mes. El PDF y el histórico quedarán " +
          "disponibles como solo lectura.",
      )
    ) {
      return;
    }
    cancelarEdicion();
    setCerrando(true);
    setAviso(null);
    try {
      try {
        await api.cerrar(ano, mes);
      } catch (err) {
        const status = err instanceof ErrorApi ? err.status : 0;
        setAviso({
          tipo: "error",
          texto:
            err instanceof ErrorApi
              ? err.message
              : "No se pudo cerrar el período.",
        });
        if (status === 409) await recargar();
        return;
      }
      setAviso({
        tipo: "ok",
        texto: `Inserción de ${periodoTexto(
          ano,
          mes,
        )} cerrada. Las horas quedaron en el histórico y el PDF sigue disponible.`,
      });
      await recargar();
      await cargarPeriodos();
    } catch {
      setAviso({
        tipo: "error",
        texto: "No se pudo cerrar el período. Inténtelo de nuevo.",
      });
    } finally {
      setCerrando(false);
    }
  }

  const items = useMemo(() => datos?.items ?? [], [datos]);
  const itemsFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.Id_Empleado.toLowerCase().includes(q) ||
        i.Nombre.toLowerCase().includes(q) ||
        i.area_nombre.toLowerCase().includes(q),
    );
  }, [items, filtro]);
  const totalHorasFiltradas = useMemo(
    () => itemsFiltrados.reduce((total, i) => total + i.Horas, 0),
    [itemsFiltrados],
  );
  const area = useMemo(
    () => areas.find((a) => a.id === Number(areaId)) ?? null,
    [areas, areaId],
  );
  const periodoSeleccionado = useMemo(
    () =>
      ano !== null && mes !== null
        ? (periodos.find((p) => p.ano === ano && p.mes === mes) ?? null)
        : null,
    [periodos, ano, mes],
  );
  const periodosAbiertos = useMemo(
    () => periodos.filter((p) => !p.cerrado),
    [periodos],
  );
  const periodosCerrados = useMemo(
    () => periodos.filter((p) => p.cerrado),
    [periodos],
  );
  const totalPeriodo = periodoSeleccionado?.trabajadores ?? 0;
  const cerradoPeriodo = Boolean(
    datos?.cerrado || periodoSeleccionado?.cerrado,
  );
  const cierreInfo = datos?.cerrado
    ? datos
    : periodoSeleccionado?.cerrado
      ? periodoSeleccionado
      : null;
  const puedeCerrar =
    !cerradoPeriodo &&
    (totalPeriodo > 0 || (datos?.total_trabajadores ?? 0) > 0);
  const pdfUrl =
    areaId && areaId !== "todas" && ano !== null && mes !== null
      ? `/api/reportes/tarifa_horaria?area=${areaId}&ano=${ano}&mes=${mes}`
      : null;
  const puedeInsertar =
    !cerradoPeriodo &&
    preview !== null &&
    preview.encontrado &&
    preview.Id_Area > 0 &&
    horasValidas &&
    !buscando &&
    !guardando;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end dark:border-gray-800 dark:bg-white/3">
        <div className="w-full sm:max-w-md">
          <label
            htmlFor="admin-tarifa-area"
            className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Filtrar por área
          </label>
          <select
            id="admin-tarifa-area"
            value={areaId}
            onChange={(e) => {
              setDatos(null);
              setAreaId(e.target.value);
              cancelarEdicion();
              setAviso(null);
            }}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="todas">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:max-w-[14rem]">
          <label
            htmlFor="admin-tarifa-periodo"
            className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Período
          </label>
          <select
            id="admin-tarifa-periodo"
            value={ano !== null && mes !== null ? clavePeriodo(ano, mes) : ""}
            onChange={(e) => {
              const [nuevoAno, nuevoMes] = e.target.value.split("-").map(Number);
              setDatos(null);
              setAno(nuevoAno);
              setMes(nuevoMes);
              setNro("");
              setHoras("");
              setPreview(null);
              setFiltro("");
              cancelarEdicion();
              setAviso(null);
            }}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!pdfUrl}
            title={
              pdfUrl
                ? undefined
                : "Seleccione un área para generar el PDF del reporte."
            }
            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600"
          >
            Ver PDF
          </button>
          {cerradoPeriodo ? (
            <span className="inline-flex h-11 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              Inserción cerrada
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void cerrarPeriodo()}
              disabled={!puedeCerrar || cerrando}
              title={
                !puedeCerrar
                  ? "Registre horas antes de cerrar la inserción."
                  : "Cierra la inserción para todos los trabajadores de este período."
              }
              className="h-11 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
            >
              {cerrando ? "Cerrando…" : "Cerrar inserción"}
            </button>
          )}
        </div>
      </div>

      {!cerradoPeriodo && !puedeCerrar && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          El botón «Cerrar inserción» se habilita cuando hay horas registradas
          en el período.
        </p>
      )}

      {cerradoPeriodo && cierreInfo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Período cerrado: solo lectura</p>
          <p className="mt-1">
            {periodoTexto(cierreInfo.ano, cierreInfo.mes)} quedó registrado en el
            histórico
            {cierreInfo.cerrado_en
              ? ` el ${fechaCierre(cierreInfo.cerrado_en)}`
              : ""}
            {cierreInfo.cerrado_por
              ? ` por ${cierreInfo.cerrado_por}`
              : ""}. La inserción está deshabilitada para todos los
            trabajadores de este período; no se pueden insertar, modificar ni
            eliminar horas. El PDF y el histórico siguen disponibles.
          </p>
        </div>
      )}

      {!cerradoPeriodo && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
              Insertar o actualizar trabajador
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Escriba el número de cumplidor. Aparecen sus datos, el área real y
              las horas que ya tiene en el período. Si ya existe, se actualiza.
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full">
              <label htmlFor="admin-tarifa-nro" className="sr-only">
                Número de cumplidor
              </label>
              <input
                id="admin-tarifa-nro"
                value={nro}
                onChange={(e) => {
                  setNro(e.target.value);
                  setHoras("");
                  setPreview(null);
                  cancelarEdicion();
                  setAviso(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarAhora();
                  }
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Número de cumplidor (ej. 58404)"
                aria-describedby="admin-tarifa-buscar-ayuda"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              />
              {buscando && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"
                >
                  …
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={buscarAhora}
                disabled={!nro.trim() || buscando}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? "Buscando…" : "Buscar"}
              </button>
              {(nro || preview || horas) && (
                <button
                  type="button"
                  onClick={limpiarBusqueda}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-emerald-400 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:border-emerald-600"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <p
            id="admin-tarifa-buscar-ayuda"
            className="mt-1 text-xs text-gray-400 dark:text-gray-500"
          >
            El área se selecciona automáticamente según la nómina del trabajador.
          </p>

          <div aria-live="polite">
            {preview && !preview.encontrado && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                {preview.mensaje ?? "No se encontró el trabajador."}
              </p>
            )}

            {preview?.encontrado && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Trabajador encontrado
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white/90">
                      {preview.Nombre}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                      Nro {preview.Id_Empleado}
                      {preview.Id_Expediente && (
                        <> · Exp. {preview.Id_Expediente}</>
                      )}
                      {preview.No_CI && <> · CI {preview.No_CI}</>}
                    </p>
                  </div>
                  {preview.Baja ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                      De baja
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Activo
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Área
                    </dt>
                    <dd className="font-medium text-gray-800 dark:text-white/90">
                      {preview.area_nombre ?? "Sin área"}
                      {preview.Id_Area > 0 && (
                        <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                          (#{preview.Id_Area})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Horas en el período
                    </dt>
                    <dd className="font-medium text-gray-800 dark:text-white/90">
                      {preview.Horas !== null
                        ? `${nf.format(preview.Horas)} h`
                        : "Sin horas registradas"}
                    </dd>
                  </div>
                </dl>

                {preview.Baja && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Este trabajador está de baja. Verifique que corresponda
                    pagarle horas extras.
                  </p>
                )}
                {preview.Id_Area === 0 && (
                  <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-400">
                    No se pudo determinar el área de este trabajador. Revise su
                    unidad en la nómina.
                  </p>
                )}
              </div>
            )}
          </div>

          {preview?.encontrado && preview.Id_Area > 0 && (
              <form
                onSubmit={agregar}
                className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor="admin-tarifa-horas"
                      className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      Horas extras
                    </label>
                    <input
                      id="admin-tarifa-horas"
                      type="number"
                      min={0.01}
                      max={744}
                      step={0.01}
                      value={horas}
                      onChange={(e) => {
                        setHoras(e.target.value);
                        setAviso(null);
                      }}
                      placeholder="Ej. 96"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!puedeInsertar}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando…"
                      : preview.Horas !== null
                        ? "Actualizar horas"
                        : "Insertar horas"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Se guardarán en <strong>{preview.area_nombre}</strong>. El
                  filtro de área de arriba solo cambia el listado.
                  {preview.Horas !== null && (
                    <>
                      {" "}
                      Ya tiene {nf.format(preview.Horas)} h en este período; si
                      guarda, se actualizarán.
                    </>
                  )}
                </p>
              </form>
            )}
        </div>
      )}

      {aviso && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {areaId && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {areaId === "todas"
                  ? "Todas las áreas"
                  : (area?.nombre ?? datos?.area_nombre ?? "Área")}
              </h2>
              {datos && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {nf.format(itemsFiltrados.length)} trabajador
                  {itemsFiltrados.length === 1 ? "" : "es"} ·{" "}
                  {nf.format(totalHorasFiltradas)} h
                  {filtro.trim() &&
                    items.length !== itemsFiltrados.length && (
                      <> de {nf.format(items.length)} en total</>
                    )}
                </p>
              )}
            </div>
            <div className="w-full sm:max-w-xs">
              <label
                htmlFor="admin-tarifa-filtro"
                className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                Filtrar por número, nombre o área
              </label>
              <input
                id="admin-tarifa-filtro"
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  cancelarEdicion();
                }}
                placeholder="Ej. 58404 o Servicios TIC"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Nro
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Nombre y apellidos
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Área
                  </th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Horas
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Estado
                  </th>
                  {!cerradoPeriodo && (
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {itemsFiltrados.map((i) => (
                  <tr
                    key={i.Id}
                    className="hover:bg-gray-50 dark:hover:bg-white/2"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-300">
                      {i.Id_Empleado}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white/90">
                      {i.Nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {i.area_nombre}
                      <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
                        #{i.Id_Area}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-sm tabular-nums text-gray-800 dark:text-white/90">
                      {editandoId === i.Id ? (
                        <input
                          type="number"
                          min={0.01}
                          max={744}
                          step={0.01}
                          value={editHoras}
                          onChange={(e) => setEditHoras(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void guardarEdicion(i);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelarEdicion();
                            }
                          }}
                          autoFocus
                          aria-label={`Horas de ${i.Nombre}`}
                          className="h-9 w-24 rounded-lg border border-gray-200 bg-white px-2 text-end text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        />
                      ) : (
                        nf.format(i.Horas)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {i.Baja ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                          De baja
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                          Activo
                        </span>
                      )}
                    </td>
                    {!cerradoPeriodo && (
                      <td className="px-4 py-3 text-end">
                        {editandoId === i.Id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void guardarEdicion(i)}
                              disabled={guardandoEdicion}
                              className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                            >
                              {guardandoEdicion ? "Guardando…" : "Guardar"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelarEdicion}
                              disabled={guardandoEdicion}
                              className="text-sm font-medium text-gray-500 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(i)}
                              className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void eliminar(i)}
                              className="text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!cargando && datos && itemsFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={cerradoPeriodo ? 5 : 6}
                      className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500"
                    >
                      {filtro.trim()
                        ? "No hay trabajadores que coincidan con el filtro."
                        : areaId === "todas"
                          ? "No hay trabajadores con tarifa horaria insertada en este período."
                          : "Esta área no tiene trabajadores con horas extras insertadas para este período."}
                    </td>
                  </tr>
                )}
                {cargando && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={cerradoPeriodo ? 5 : 6}
                      className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500"
                    >
                      Cargando trabajadores…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
