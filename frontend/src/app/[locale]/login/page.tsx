import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import LoginForm from "./login-form";
import { sesionActual } from "@/lib/sesion";

export const metadata: Metadata = { title: "Iniciar sesión | DRHnet" };

export const dynamic = "force-dynamic";

/** Solo se admiten rutas internas del portal, para no abrir redirecciones abiertas. */
function destinoSeguro(next: string | undefined): string {
  if (!next) return "/portal";
  if (!next.startsWith("/portal")) return "/portal";
  if (next.includes("//") || next.includes("\\")) return "/portal";
  return next;
}

const APUNTES = [
  "Tu clave se valida en el directorio",
  "No se guarda ninguna credencial",
  "Acceso solo para personal habilitado",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Con sesión activa no tiene sentido quedarse aquí.
  if (await sesionActual()) redirect("/portal");

  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Fondo: degradado verde de la institución con trama de puntos. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1.1px), linear-gradient(135deg, #002b15, #004421 45%, #006633)",
          backgroundSize: "24px 24px, auto",
        }}
      >
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#002b15]/55 via-transparent to-[#002b15]/70"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
            Universidad Tecnológica de La Habana
          </span>
        </div>

        <div className="rounded-3xl border border-white/50 bg-white/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/favicon.png"
              alt="Universidad Tecnológica de La Habana, CUJAE"
              width={100}
              height={115}
              priority
              className="mb-4 h-20 w-auto rounded-2xl bg-white p-2 shadow-lg ring-1 ring-gray-200 sm:h-24"
            />
            <h1 className="text-xl font-bold leading-snug text-gray-800 sm:text-2xl">
              Dirección de Recursos Humanos
            </h1>
            <p className="mt-1.5 text-sm font-medium text-[#006633]">
              Universidad Tecnológica de La Habana
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Entra con tu usuario de internet. Lo que hagas aquí depende del
              perfil que tengas asignado.
            </p>
          </div>

          <LoginForm destino={destinoSeguro(next)} />

          <ul className="mt-7 grid grid-cols-1 gap-2 border-t border-gray-200 pt-5 text-xs text-gray-500 sm:grid-cols-3 sm:gap-3">
            {APUNTES.map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[#006633]"
                >
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/70">
          Universidad Tecnológica de La Habana «José Antonio Echeverría», CUJAE
          <br />
          Si tu cuenta no funciona, comunícate con la Dirección de Recursos Humanos.
        </p>
      </div>
    </div>
  );
}
