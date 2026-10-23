import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.DRH_API ?? "http://127.0.0.1:8000";
const COOKIE = "rh_sesion";
/** Token del administrador original, aparcado para poder volver. */
const COOKIE_ADMIN = "rh_sesion_admin";

/**
 * Abre el panel como otra persona.
 *
 * El token devuelto por el backend se guarda en la misma cookie de sesión, así
 * que a partir de aquí el navegador trabaja con los permisos de la persona
 * suplantada. El token nuevo lleva dentro el carné del administrador que
 * empezó la sesión, y `impersonando` viaja en el cuerpo para que la interfaz
 * pueda avisar.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ carnet: string }> },
) {
  const { carnet } = await params;

  const c = await cookies();
  const actual = c.get(COOKIE)?.value;
  if (!actual) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  // Una sesión ya suplantada no puede suplantar: el backend lo rechaza, pero no
  // se llega siquiera a intentarlo para no dejar un token aparcado inútil.
  const resp = await fetch(`${BACKEND}/api/auth/yo`, {
    headers: { Authorization: `Bearer ${actual}` },
    cache: "no-store",
  }).catch(() => null);
  const enCurso = resp && resp.ok ? ((await resp.json()) as { impersonando: string | null }) : null;
  if (enCurso?.impersonando) {
    return NextResponse.json(
      { error: "Ya estás dentro de una sesión suplantada." },
      { status: 403 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/auth/impersonar/${encodeURIComponent(carnet)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${actual}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "El servidor no responde. Inténtalo en un momento." },
      { status: 503 },
    );
  }

  const cuerpo = await res.json().catch(() => ({}));
  const token = res.headers.get("X-Sesion");

  if (!res.ok || !token) {
    return NextResponse.json(
      { error: cuerpo?.detail ?? "No se pudo suplantar." },
      { status: res.status || 403 },
    );
  }

  // La sesión de trabajo pasa a ser la de la persona suplantada, pero el
  // token del administrador queda aparcado para que pueda volver con un clic.
  c.set(COOKIE_ADMIN, actual, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // el sitio todavía no sirve HTTPS
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // el sitio todavía no sirve HTTPS
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  return NextResponse.json({ identidad: cuerpo });
}
