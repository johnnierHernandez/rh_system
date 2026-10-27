/**
 * Cliente de la tarifa horaria del panel de administración.
 *
 * Todas las llamadas al backend de tarifa horaria pasan por aquí: el
 * componente de la pantalla queda con el estado y el render, y este módulo
 * se ocupa de las rutas, los parámetros y el formato de la respuesta.
 */

import type { AreaReporte } from "@/lib/areas-reporte";
import type { PeriodoTarifa } from "@/lib/tarifa-horaria";

export type ItemTarifa = {
  Id: number;
  Id_Empleado: string;
  Nombre: string;
  Horas: number;
  Baja: boolean;
  Id_Area: number;
  area_nombre: string;
};

export type RespuestaAdmin = {
  ano: number;
  mes: number;
  area: number | null;
  area_nombre: string | null;
  items: ItemTarifa[];
  total_horas: number;
  total_trabajadores: number;
  cerrado: boolean;
  cerrado_por: string | null;
  cerrado_en: string | null;
};

export type TrabajadorTarifa = {
  encontrado: boolean;
  Id_Empleado: string | null;
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Baja: boolean;
  Id_Area: number;
  area_nombre: string | null;
  Horas: number | null;
  mensaje: string | null;
};

/** Error de la API con el código HTTP, para poder reacted según el caso. */
export class ErrorApi extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorApi";
    this.status = status;
  }
}

/** Extrae el mensaje de error del backend, con un texto por defecto. */
export function mensajeDeError(
  cuerpo: unknown,
  porDefecto: string,
): string {
  if (cuerpo && typeof cuerpo === "object" && "detail" in cuerpo) {
    const detalle = (cuerpo as { detail?: unknown }).detail;
    if (typeof detalle === "string" && detalle.trim()) return detalle;
  }
  return porDefecto;
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => ({}));
    throw new ErrorApi(r.status, mensajeDeError(cuerpo, "Error del servidor."));
  }
  return (await r.json()) as T;
}

/**
 * Áreas con las que se puede filtrar el reporte de tarifa horaria.
 *
 * Usa el catálogo de gestión (completo): esta pantalla no se limita por
 * ámbito, a diferencia de `/api/reportes/areas`, que sí se acota al visitante.
 */
export async function areasReporte(): Promise<AreaReporte[]> {
  const d =
    (await pedir<{ areas?: AreaReporte[] }>("/api/tarifa-horaria/areas")) ?? {};
  return d.areas ?? [];
}

/** Histórico de períodos con horas insertadas. */
export async function periodos(): Promise<PeriodoTarifa[]> {
  const d = (await pedir<{ periodos?: PeriodoTarifa[] }>(
    "/api/tarifa-horaria/periodos",
  )) ?? {};
  return d.periodos ?? [];
}

/** Listado de gestión: trabajadores con horas en el período. */
export async function listarAdmin(params: {
  ano: number;
  mes: number;
  area?: string | null;
}): Promise<RespuestaAdmin> {
  const query = new URLSearchParams({
    ano: String(params.ano),
    mes: String(params.mes),
  });
  if (params.area) query.set("area", params.area);
  return pedir<RespuestaAdmin>(`/api/tarifa-horaria/admin?${query.toString()}`);
}

/** Ficha del trabajador por número de cumplidor, con sus horas del período. */
export async function buscar(
  nro: string,
  params: { ano: number; mes: number },
  signal?: AbortSignal,
): Promise<TrabajadorTarifa> {
  const query = new URLSearchParams({
    nro,
    ano: String(params.ano),
    mes: String(params.mes),
  });
  return pedir<TrabajadorTarifa>(
    `/api/tarifa-horaria/buscar?${query.toString()}`,
    { signal },
  );
}

/** Inserta o actualiza las horas de un trabajador en el período. */
export async function guardar(params: {
  area: number;
  Id_Empleado: string;
  Horas: number;
  ano: number;
  mes: number;
}): Promise<{ creado?: boolean }> {
  return pedir<{ creado?: boolean }>("/api/tarifa-horaria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

/** Actualiza las horas de una fila existente. */
export async function actualizar(
  id: number,
  horas: number,
): Promise<{ creado?: boolean }> {
  return pedir<{ creado?: boolean }>(`/api/tarifa-horaria/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Horas: horas }),
  });
}

/** Elimina una fila de horas. */
export async function eliminar(id: number): Promise<void> {
  await pedir<unknown>(`/api/tarifa-horaria/${id}`, { method: "DELETE" });
}

/** Cierra el período: sus horas pasan al histórico y quedan bloqueadas. */
export async function cerrar(ano: number, mes: number): Promise<void> {
  await pedir<unknown>("/api/tarifa-horaria/cerrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ano, mes }),
  });
}
