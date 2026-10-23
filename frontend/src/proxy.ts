import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
const COOKIE = "rh_sesion";

type Identidad = {
  carnet_identidad: string;
  perfil_activo: string | null;
  permisos: string[];
  impersonando: string | null;
};

async function pedirIdentidad(req: NextRequest): Promise<Identidad | null> {
  const token = req.cookies.get(COOKIE)?.value;
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

/**
 * Rutas del portal que muestran datos de negocio, con el permiso que exigen.
 *
 * El orden importa: `proxy` se evalúa de arriba abajo y gana la primera regla
 * que coincide. `/portal/trabajadores` tiene que declararse antes que el
 * comodín `/portal`.
 */
const REGLAS: { patron: RegExp; permiso: string }[] = [
  // Trabajadores y cuadros: ambos listan carné de identidad, así que quedan
  // reservados a quien tenga `trabajadores.ver` (perfil superadministrador).
  { patron: /^\/portal\/(trabajadores|cuadros)(\/|$)/, permiso: "trabajadores.ver" },
  // Salarios: son importes nominales, así que no basta con ver el listado de
  // personal; exigen un permiso propio.
  { patron: /^\/portal\/salarios(\/|$)/, permiso: "salarios.ver" },
  // Tarifa horaria: la consulta pública no exige sesión, pero la vista del
  // portal que inserta horas sí exige el permiso de gestión.
  {
    patron: /^\/portal\/tarifa-horaria(\/|$)/,
    permiso: "tarifa_horaria.gestionar",
  },
  // Datos de negocio: lectura. La escritura se controla en la API, no aquí.
  //
  // `/portal/cumpleanos` y `/portal/numeros` quedan fuera de propósito:
  // cualquier cuenta con sesión válida puede consultarlos, sin importar el
  // perfil (así lo pidió Recursos Humanos para los invitados).
  { patron: /^\/portal\/(areas|plantilla|descargas)(\/|$)/, permiso: "negocio.ver" },
  // Administración del portal: solo quien gestiona usuarios.
  { patron: /^\/portal\/(usuarios|ldap|perfiles)(\/|$)/, permiso: "usuarios.administrar" },
];

/** Cualquier página del panel, sin importar el permiso. */
const ES_PORTAL = /^\/portal(\/|$)/;

function sinPermiso(url: URL, pathname: string): NextResponse {
  url.pathname = "/portal/denegado";
  url.search = `?de=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

/**
 * Guarda de acceso y permisos del portal, antes de que Next empiece a renderizar.
 *
 * Va aquí y no en `portal/layout.tsx` porque layout y página se renderizan en
 * paralelo: la página de trabajadores pide sus datos al backend mientras el
 * layout decide redirigir, así que el body de la redirección ya incluía los
 * carnés. Bloqueando en el proxy, esa petición nunca llega a iniciarse.
 *
 * Lo mismo aplica a los permisos: una página de negocio sin `negocio.ver` no
 * debe llegar a pedir una sola fila de la base de datos.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ES_PORTAL.test(pathname)) {
    // La página de "sin permiso" tiene que seguir siendo alcanzable o el
    // rechazo se convierte en un bucle de redirecciones.
    const identidad = await pedirIdentidad(req);
    if (!identidad) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }

    if (pathname !== "/portal/denegado") {
      for (const regla of REGLAS) {
        if (regla.patron.test(pathname)) {
          if (!identidad.permisos?.includes(regla.permiso!)) {
            return sinPermiso(req.nextUrl.clone(), pathname);
          }
          break;
        }
      }
    }
  }

  return intl(req);
}

export const config = {
  matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"],
};
