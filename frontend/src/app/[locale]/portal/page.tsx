import Badge from "@/components/ui/badge/Badge";
import {
  BoxCubeIcon,
  CalenderIcon,
  DollarLineIcon,
  GroupIcon,
  TableIcon,
} from "@/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { sesionActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Panel RH | DRHnet",
  description: "Panel administrativo de la Dirección de Recursos Humanos CUJAE",
};

type Resumen = {
  empleados_activos: number;
  empleados_baja: number;
  total_empleados: number;
  areas: number;
  cargos: number;
};

type Plaza = {
  Id_Direccion: string;
  Desc_Direccion: string | null;
  Id_Cargo: string;
  Desc_Cargo: string | null;
};

type Cumple = {
  Apellido_1: string | null;
  Apellido_2: string | null;
  Nombre: string | null;
};

export const dynamic = "force-dynamic";

async function getData() {
  const [rRes, vRes, cRes] = await Promise.all([
    fetch("http://127.0.0.1:8000/api/resumen", { cache: "no-store" }),
    fetch("http://127.0.0.1:8000/api/plazas_vacantes?limit=8", {
      cache: "no-store",
    }),
    fetch("http://127.0.0.1:8000/api/cumpleanos_hoy", { cache: "no-store" }),
  ]);
  const r: Resumen = rRes.ok ? await rRes.json() : ({} as Resumen);
  const v = vRes.ok
    ? await vRes.json()
    : { total: 0, plazas: [] as Plaza[] };
  const c: Cumple[] = cRes.ok ? await cRes.json() : [];
  return { r, v, c };
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </div>
      <div className="mt-5">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <h4 className="mt-1 text-title-sm font-bold text-gray-800 dark:text-white/90">
          {value}
        </h4>
      </div>
    </div>
  );
}

export default async function PortalHome() {
  // Para ocultar los accesos de negocio cuando el perfil no los tiene
  // (invitado): la home enseña mosaicos que llevan a /portal/trabajadores y
  // /portal/plantilla, y mejor no ofrecer enlaces que el proxy va a negar.
  const identidad = await sesionActual();
  const puedeVerNegocio = identidad?.permisos?.includes("negocio.ver") ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Panel de Recursos Humanos
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Indicadores en vivo de la Dirección de Recursos Humanos CUJAE
          </p>
        </div>
        {puedeVerNegocio && (
          <Link
            href="/portal/trabajadores"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Ver trabajadores
          </Link>
        )}
      </div>

      <PortalMetrics />

      <Link
        href="/portal/mi-nomina"
        className="group flex flex-col gap-3 rounded-2xl border border-[#c9e9da] bg-[#f3faf6] p-5 transition-colors hover:border-[#006633] sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:bg-brand-500/10"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c9e9da] text-[#006633] dark:bg-brand-500/20 dark:text-brand-400">
            <DollarLineIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-[#006633] dark:text-brand-400">
              Mi nómina
            </h2>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Consulta tus salarios, tus vacaciones acumuladas y los días que te
              han pagado. Solo tú puedes ver esta información.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#006633] group-hover:underline dark:text-brand-400">
          Ver mi nómina <span aria-hidden>→</span>
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        {puedeVerNegocio && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-white/90">
                <BoxCubeIcon className="size-5 text-brand-500" />
                Plazas vacantes
              </h2>
              <Link
                href="/portal/plantilla"
                className="text-sm text-brand-500 hover:underline"
              >
                Ver más
              </Link>
            </div>
            <PlazasVacantes />
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-white/90">
            <CalenderIcon className="size-5 text-brand-500" />
            Cumpleaños de hoy
          </h2>
          <CumpleanosHoy />
        </div>
      </div>
    </div>
  );
}

async function PortalMetrics() {
  const { r } = await getData();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
      <MetricCard
        icon={<GroupIcon className="size-6 text-brand-500" />}
        label="Trabajadores activos"
        value={r.empleados_activos ?? "—"}
        accent="bg-brand-50 dark:bg-brand-500/15"
      />
      <MetricCard
        icon={<TableIcon className="size-6 text-success-600" />}
        label="Áreas"
        value={r.areas ?? "—"}
        accent="bg-success-50 dark:bg-success-500/15"
      />
      <MetricCard
        icon={<BoxCubeIcon className="size-6 text-warning-600" />}
        label="Cargos"
        value={r.cargos ?? "—"}
        accent="bg-warning-50 dark:bg-warning-500/15"
      />
      <MetricCard
        icon={<GroupIcon className="size-6 text-error-600" />}
        label="Con baja laboral"
        value={r.empleados_baja ?? "—"}
        accent="bg-error-50 dark:bg-error-500/15"
      />
    </div>
  );
}

async function PlazasVacantes() {
  const { v } = await getData();
  return (
    <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
      {v.plazas.map((p: Plaza, i: number) => (
        <li
          key={i}
          className="flex items-start justify-between gap-3 py-3"
        >
          <div>
            <p className="font-semibold text-gray-800 dark:text-white/90">
              {p.Desc_Cargo ?? p.Id_Cargo}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {p.Desc_Direccion ?? p.Id_Direccion}
            </p>
          </div>
          <Badge variant="solid" color="success">
            Vacante
          </Badge>
        </li>
      ))}
      {v.plazas.length === 0 && (
        <li className="py-3 text-sm text-gray-400">
          Sin plazas vacantes.
        </li>
      )}
    </ul>
  );
}

async function CumpleanosHoy() {
  const { c } = await getData();
  return (
    <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
      {c.map((p: Cumple, i: number) => (
        <li key={i} className="py-3">
          <p className="font-semibold text-gray-800 dark:text-white/90">
            {p.Apellido_1} {p.Apellido_2}, {p.Nombre}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ¡Feliz cumpleaños!
          </p>
        </li>
      ))}
      {c.length === 0 && (
        <li className="py-3 text-sm text-gray-400">
          No hay cumpleaños hoy.
        </li>
      )}
    </ul>
  );
}