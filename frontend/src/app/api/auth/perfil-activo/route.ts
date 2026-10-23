import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
const COOKIE = "rh_sesion";

/**
 * Cambia el perfil con el que se opera.
 *
 * No hace falta emitir un token nuevo: los permisos se leen de la base en cada
 * petición, así que guardar la preferencia y recargar la página es suficiente.
 */
export async function POST(req: Request) {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let perfil: string | null = null;
  try {
    const cuerpo = await req.json();
    perfil = cuerpo?.perfil === null ? null : String(cuerpo?.perfil ?? "");
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/auth/perfil-activo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ perfil: perfil || null }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "El servidor no responde. Inténtalo en un momento." },
      { status: 503 },
    );
  }

  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: cuerpo?.detail ?? "No se pudo cambiar el perfil." },
      { status: res.status || 400 },
    );
  }
  return NextResponse.json({ identidad: cuerpo });
}
