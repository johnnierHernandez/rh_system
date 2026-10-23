import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
const COOKIE = "rh_sesion";
/**
 * Token del administrador original, aparcado mientras dura la suplantación.
 *
 * Va en una cookie aparte y httpOnly: al suplantar, la sesión de trabajo pasa
 * a ser la de la persona suplantada, y sin este rescoldo el administrador se
 * quedaría encerrado en el panel sin poder volver a su propia cuenta.
 */
const COOKIE_ADMIN = "rh_sesion_admin";

const OPCIONES = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // el sitio todavía no sirve HTTPS
  path: "/",
  maxAge: 8 * 60 * 60,
} as const;

/** Devuelve la sesión a la cuenta que la abrió. */
export async function POST() {
  const c = await cookies();
  const tokenAdmin = c.get(COOKIE_ADMIN)?.value;
  if (!tokenAdmin) {
    return NextResponse.json(
      { error: "No hay ninguna sesión de administrador aparcada." },
      { status: 400 },
    );
  }

  // Se valida contra el backend antes de restaurarla: si el administrador fue
  // desactivado o su sesión expiró mientras suplantaba, no se restaura nada.
  let identidad: unknown = null;
  try {
    const res = await fetch(`${BACKEND}/api/auth/yo`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      cache: "no-store",
    });
    if (!res.ok) {
      c.delete(COOKIE_ADMIN);
      return NextResponse.json(
        { error: "La sesión del administrador ya no es válida." },
        { status: 401 },
      );
    }
    identidad = await res.json();
  } catch {
    return NextResponse.json(
      { error: "El servidor no responde. Inténtalo en un momento." },
      { status: 503 },
    );
  }

  c.set(COOKIE, tokenAdmin, OPCIONES);
  c.delete(COOKIE_ADMIN);

  return NextResponse.json({ identidad });
}
