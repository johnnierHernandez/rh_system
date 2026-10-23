import Link from "next/link";
import { sesionActual } from "@/lib/sesion";
import { nombreCompleto, tienePermiso } from "@/lib/identidad";

export default async function PaginaDenegada({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  const [params, identidad] = await Promise.all([searchParams, sesionActual()]);
  const destino = params.de ?? "";

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">
          !
        </div>
        <h1 className="mt-4 text-lg font-semibold text-[#1a1a1a]">
          No tienes acceso a esta sección
        </h1>
        <p className="mt-2 text-sm text-[#4b5563]">
          Tu perfil actual{" "}
          <span className="font-medium text-[#1a1a1a]">
            {identidad?.perfil_activo_nombre || "sin perfil asignado"}
          </span>{" "}
          no incluye este permiso.
        </p>

        {!tienePermiso(identidad, "negocio.ver") &&
          !tienePermiso(identidad, "usuarios.administrar") && (
            <p className="mt-4 rounded-lg bg-[#f9fafb] px-3 py-2 text-sm text-[#4b5563]">
              Si necesitas esta información, pide a Recursos Humanos que ajuste tu
              perfil.
            </p>
          )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/portal"
            className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005529]"
          >
            Volver al panel
          </Link>
          {identidad && identidad.perfiles_detalle.some((p) => p.asignado && !p.inactivo) && (
            <p className="self-center text-xs text-[#6b7280] sm:self-auto">
              Si tienes más de un perfil, puedes cambiarlo arriba a la derecha.
            </p>
          )}
        </div>

        {destino && (
          <p className="mt-6 break-all text-xs text-[#9ca3af]">Se intentó abrir: {destino}</p>
        )}
        {identidad && (
          <p className="mt-2 text-xs text-[#9ca3af]">Sesión: {nombreCompleto(identidad)}</p>
        )}
      </div>
    </div>
  );
}
