/**
 * Tipos y funciones puras de la identidad de sesión.
 *
 * Van aparte de `sesion.ts` porque ese módulo usa `next/headers`, que solo
 * existe en el servidor: si un componente cliente lo importara, el build
 * fallaría al meter `next/headers` en el bundle del navegador. Aquí no hay
 * nada específico del servidor, así que ambos lados pueden usarlo.
 */

/** Un perfil del catálogo, ya cruzado con la asignación de esta persona. */
export type PerfilDetalle = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  activo: boolean;
  asignado: boolean;
  inactivo: boolean;
};

/** Perfil del catálogo tal como lo publica el backend. */
export type PerfilCatalogo = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  prioridad: number;
  activo: boolean;
};

/**
 * Identidad de la sesión. `permisos` es la lista del perfil ACTIVO, nunca la
 * unión de todos los perfiles: con dos perfiles, el que no está seleccionado no
 * concede nada.
 */
export type Identidad = {
  carnet_identidad: string;
  usuario_internet: string | null;
  nombre: string | null;
  apellidos: string | null;
  email_institucional: string | null;
  area: string | null;
  departamento: string | null;
  perfiles: string[];
  perfil_activo: string | null;
  perfil_activo_nombre: string;
  permisos: string[];
  perfiles_detalle: PerfilDetalle[];
  /** Carné de quien abrió esta sesión suplantando, si aplica. */
  impersonando: string | null;
};

/** ¿La sesión en curso tiene este permiso? */
export function tienePermiso(
  identidad: Identidad | null,
  permiso: string,
): boolean {
  return !!identidad?.permisos?.includes(permiso);
}

/** ¿La sesión puede suplantar a alguien? */
export function puedeImpersonar(identidad: Identidad | null): boolean {
  return tienePermiso(identidad, "sesiones.impersonar");
}

/** Perfiles que el usuario tiene asignados y puede seleccionar. */
export function perfilesSeleccionables(
  identidad: Identidad | null,
): PerfilDetalle[] {
  return (identidad?.perfiles_detalle ?? []).filter((p) => p.asignado && !p.inactivo);
}

export function nombreCompleto(identidad: Identidad | null): string {
  if (!identidad) return "";
  return [identidad.nombre, identidad.apellidos].filter(Boolean).join(" ");
}

/**
 * Iniciales para el avatar.
 *
 * No se usa la foto del AD a propósito: son datos personales que no hacen falta
 * para identificar a alguien en el panel.
 */
export function iniciales(identidad: Identidad | null): string {
  if (!identidad) return "?";
  const partes = [identidad.nombre, identidad.apellidos]
    .filter(Boolean)
    .map((p) => p!.trim()[0] ?? "")
    .filter(Boolean);
  if (partes.length > 0) return partes.join("").slice(0, 2).toUpperCase();
  return (identidad.usuario_internet ?? "?").slice(0, 2).toUpperCase();
}
