import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesion";

/** Identidad en curso, para los componentes cliente del portal. */
export async function GET() {
  const identidad = await sesionActual();
  if (!identidad) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  return NextResponse.json({ identidad });
}
