import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
const COOKIE = "rh_sesion";

/**
 * Inicia sesión contra el AD. La contraseña viaja solo al backend (que hace el
 * bind); aquí no se toca. El token vuelve en la cabecera `X-Sesion` y se
 * guarda en una cookie httpOnly, de modo que el JavaScript del navegador no
 * puede leerlo ni escribirlo.
 */
export async function POST(req: Request) {
  let identificador = "";
  let clave = "";
  try {
    const cuerpo = await req.json();
    identificador = String(cuerpo?.identificador ?? "").trim();
    clave = String(cuerpo?.clave ?? "");
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (!identificador || !clave) {
    return NextResponse.json(
      { error: "Escribe tu usuario de internet y tu clave." },
      { status: 400 },
    );
  }

  // El backend distingue "no existe" (404) de "clave mala" (401). Aquí se
  // igualan a propósito: si no, el formulario sirve para averiguar qué usuarios
  // de la universidad existen probando uno detrás de otro.
  const SIN_DISTINCION = new Set([401, 404]);

  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador, clave }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "El servidor no responde. Inténtalo en un momento." },
      { status: 503 },
    );
  }

  const token = res.headers.get("X-Sesion");
  const cuerpo = await res.json().catch(() => ({}));

  if (!res.ok || !token) {
    const status = res.status || 401;
    if (SIN_DISTINCION.has(status)) {
      return NextResponse.json(
        { error: "Usuario de internet o contraseña incorrectos." },
        { status: 401 },
      );
    }
    // 503 (directorio caído) y 403 (cuenta desactivada) sí se distinguen: son
    // problemas de la cuenta o del servidor, no de la clave escrita.
    return NextResponse.json(
      { error: cuerpo?.detail ?? "No se pudo iniciar sesión." },
      { status },
    );
  }

  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // el sitio todavía no sirve HTTPS
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  // Un ingreso nuevo descarta cualquier suplantación anterior.
  c.delete("rh_sesion_admin");

  return NextResponse.json({ identidad: cuerpo });
}
