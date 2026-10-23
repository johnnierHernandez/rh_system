import { redirect } from "next/navigation";
import PortalShell from "./portal-shell";
import { sesionActual } from "@/lib/sesion";
import AvisoImpersonacion from "./aviso-impersonacion";

/**
 * Guarda de acceso del portal. Se ejecuta en el servidor antes de renderizar
 * cualquier página de /portal: si la cookie no es válida, el usuario nunca ve
 * el contenido y se le manda a /login.
 *
 * La segunda barrera (permisos por ruta) vive en `src/proxy.ts`: aquí no se
 * puede, porque el layout y la página se renderizan en paralelo y la página
 * pediría sus datos antes de que este componente decida algo.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identidad = await sesionActual();
  if (!identidad) redirect("/login");

  return (
    <>
      {identidad.impersonando && (
        <AvisoImpersonacion carnetOriginal={identidad.impersonando} />
      )}
      <PortalShell permisos={identidad.permisos}>{children}</PortalShell>
    </>
  );
}
