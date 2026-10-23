import { cookies } from "next/headers";

import type { Identidad } from "./identidad";

export * from "./identidad";

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
export const COOKIE_SESION = "rh_sesion";

export async function pedirToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_SESION)?.value ?? null;
}

/**
 * Valida la sesión contra el backend. Devuelve null si no hay cookie, si
 * expiró o si el backend no la reconoce. Nunca lanza: el backend local puede
 * estar reiniciándose y eso no debe romper las páginas públicas.
 */
export async function sesionActual(): Promise<Identidad | null> {
  const token = await pedirToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/auth/yo`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Identidad;
  } catch {
    return null;
  }
}

/** Llama al backend reenviando el token de la cookie. */
export async function backendConSesion(
  ruta: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await pedirToken();
  const cabeceras = new Headers(init.headers);
  if (token) cabeceras.set("Authorization", `Bearer ${token}`);
  return fetch(`${BACKEND}${ruta}`, { ...init, headers: cabeceras, cache: "no-store" });
}
