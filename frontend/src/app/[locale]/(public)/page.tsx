import Link from "next/link";
import NumerosCujae, { type Numeros } from "./numeros-cujae";
import PopupNomina from "./popup-nomina";
import PostalCumpleanos from "@/components/cumpleanos/postal-cumpleanos";
import { sesionActual } from "@/lib/sesion";
import {
  CalenderIcon,
  DocsIcon,
  DollarLineIcon,
  DownloadIcon,
  FileIcon,
  GroupIcon,
  UserIcon,
} from "@/icons/index";

type Cumple = {
  Nombre: string;
  Apellido_1: string;
  Apellido_2: string;
  Id_Direccion: string;
  Desc_Direccion: string | null;
  Fecha_Nacimiento: string;
};

export const dynamic = "force-dynamic";

async function getData() {
  const [cRes, nRes] = await Promise.all([
    fetch("http://127.0.0.1:8000/api/cumpleanos_hoy", { cache: "no-store" }),
    fetch("http://127.0.0.1:8000/api/numeros", { cache: "no-store" }),
  ]);
  const c: Cumple[] = cRes.ok ? await cRes.json() : [];
  const n: Partial<Numeros> | null = nRes.ok ? await nRes.json() : null;
  return { c, n };
}

const quickLinks = [
  {
    icon: CalenderIcon,
    title: "Cronograma de Pago",
    desc: "Consulta el calendario de pagos del mes",
    href: "/portal",
  },
  {
    icon: DownloadIcon,
    title: "Descargas",
    desc: "Legislaciones, reglamentos y modelos del DRH",
    href: "/descargas",
  },
  {
    icon: DollarLineIcon,
    title: "Nóminas y Reportes",
    desc: "Prenómina, tarifa horaria y más",
    href: "/reportes",
  },
  {
    icon: UserIcon,
    title: "Plantilla",
    desc: "Plazas cubiertas y vacantes por unidad organizativa",
    href: "/plantilla",
  },
] as const;

const servicios = [
  {
    icon: FileIcon,
    title: "Generar Tarifa Horaria",
    desc: "Reporte de la tarifa horaria por unidad organizativa",
    href: "/servicios/tarifa-horaria",
  },
  {
    icon: GroupIcon,
    title: "Lista de recién graduados",
    desc: "Adiestrados y recién graduados por área",
    href: "/servicios/recien-graduados",
  },
  {
    icon: DocsIcon,
    title: "Generar S.C.D.",
    desc: "Sobrecarga del trabajo docente y cuadros",
    href: "/servicios/scd",
  },
] as const;

function CakeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M7 3h4v2H7zM13 3h4v2h-4z" fill="currentColor" />
      <path d="M12 3c-1.1 0-2 .9-2 2 0 .7.4 1.4 1 1.7V8H8.5C7.7 8 7 8.7 7 9.5V11h10V9.5c0-.8-.7-1.5-1.5-1.5H13V6.7c.6-.3 1-1 1-1.7 0-1.1-.9-2-2-2z" fill="currentColor" opacity="0.2" />
      <path d="M5 12.5c.8.5 1.7.75 2.5.5.9-.28 1.7-.15 2.5.25v1.2c0 .55.45 1 1 1s1-.45 1-1v-1.2c.8-.4 1.6-.53 2.5-.25.8.25 1.7 0 2.5-.5V16c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-3.5z" fill="currentColor" />
      <path d="M4 14.5c0-.4.3-.6.6-.6.3 0 .4.3.4.5v1.6h14v-1.6c0-.2.1-.5.4-.5.3 0 .6.2.6.6V20h-16v-5.5z" fill="currentColor" />
    </svg>
  );
}

export default async function HomePage() {
  const [{ c, n }, identidad] = await Promise.all([getData(), sesionActual()]);
  return (
    <>
      <section className="space-y-10">
        {/* Hero institucional */}
        <div className="rounded-2xl bg-gradient-to-br from-[#00331a] via-[#006633] to-[#005529] p-6 md:p-8 text-white shadow-lg shadow-[#006633]/25">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Sistema de Recursos Humanos
          </h1>
          <p className="mt-2 max-w-2xl text-[#c9e9da]">
            Información institucional de capital humano, plantilla y estadísticas
            de la comunidad universitaria de la CUJAE.
          </p>
        </div>

        {/* Accesos rápidos y servicios */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#006633]">Accesos rápidos</h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
              Portal DRHnet
            </span>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...quickLinks, ...servicios].map((item) => (
              <Link key={item.title} href={item.href}
                    className="group flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 transition-all hover:border-[#006633] hover:shadow-md hover:shadow-[#006633]/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c9e9da] text-[#006633] transition-colors group-hover:bg-[#006633] group-hover:text-white">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-[#006633]">{item.title}</h3>
                <p className="mt-1 text-sm text-[#52525b]">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Números CUJAE */}
        <NumerosCujae n={n} />

        {/* Cumpleaños de hoy */}
        {c.length === 0 ? (
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-[#006633]">
              <CakeIcon className="h-6 w-6 text-[#d97706]" />
              Cumpleaños de hoy
            </h2>
            <p className="mt-4 text-[#52525b]">
              Hoy nadie cumple años. ¡Felicitamos a todos los demás!
            </p>
          </div>
        ) : (
          <PostalCumpleanos cumple={c} />
        )}

      </section>
      {!identidad && <PopupNomina />}
    </>
  );
}
