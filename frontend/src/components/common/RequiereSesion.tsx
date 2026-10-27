import { Link } from "@/i18n/navigation";

interface RequiereSesionProps {
  /** Texto principal; si se omite se usa un mensaje genérico. */
  titulo?: string;
  /** Descripción bajo el título. */
  mensaje?: string;
  /** Ruta de vuelta al portal (por ejemplo, el de dónde venían). */
  volver?: string;
}

/**
 * Aviso mostrado cuando una sección del sitio (plantilla, nóminas, tarifa
 * horaria, recién graduados, S.C.D.) requiere autenticarse.
 *
 * Estos reportes son de acceso restringido: solo se consultan con sesión
 * iniciada y dentro del área de la persona. Cuando el backend responde 401,
 * esta pieza ofrece el enlace a la página de acceso en lugar de dejar la
 * tabla o el PDF en blanco.
 */
export default function RequiereSesion({
  titulo = "Inicia sesión para consultar",
  mensaje = "Estos datos son de acceso restringido. Inicia sesión con tu usuario institucional para verlos.",
  volver,
}: RequiereSesionProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-white/3">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        {titulo}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {mensaje}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Iniciar sesión
        </Link>
        {volver && (
          <Link
            href={volver}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300"
          >
            Volver
          </Link>
        )}
      </div>
    </div>
  );
}
