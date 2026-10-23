import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import Badge from "@/components/ui/badge/Badge";
import FotoTrabajador from "./foto-trabajador";

import { backendConSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Trabajador | DRHnet" };

export const dynamic = "force-dynamic";

type Trabajador = {
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Id_Cargo: string | null;
  Desc_Cargo: string | null;
  Sexo: string | null;
  Docente: boolean | null;
  Investigador: boolean | null;
  Fecha_Contratacion: string | null;
  Fecha_Baja: string | null;
  Baja: number | null;
};

function nombreCompleto(t: Trabajador): string {
  return [t.Nombre, t.Apellido_1, t.Apellido_2].filter(Boolean).join(" ") || "—";
}

function iniciales(t: Trabajador): string {
  const partes = [t.Nombre, t.Apellido_1, t.Apellido_2].filter((p): p is string => Boolean(p));
  if (partes.length === 0) return "—";
  return partes.slice(0, 2).map((p) => (p[0] ?? "").toUpperCase()).join("");
}

function fechaCorta(v: string | null): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  const [,, anio, mes, dia] = m;
  return `${dia}/${mes}/${anio}`;
}

// Los seis primeros dígitos del carné = YYMMDD de nacimiento.
function edadDesdeCarnet(ci: string | null): number | null {
  const solo = (ci ?? "").replace(/\D/g, "");
  const m = solo.match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const anioBase =
    Number(yy) <= new Date().getFullYear() % 100 ? 2000 + Number(yy) : 1900 + Number(yy);
  const nacimiento = new Date(anioBase, Number(mm) - 1, Number(dd));
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
  ) {
    edad -= 1;
  }
  return edad >= 0 && edad <= 120 ? edad : null;
}

function sexoLabel(sexo: string | null): string {
  if (!sexo) return "—";
  const s = sexo.trim().toUpperCase();
  if (s.startsWith("M")) return "Masculino";
  if (s.startsWith("F")) return "Femenino";
  return sexo;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  const texto = typeof valor === "string" && valor.trim() ? valor : "—";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
      <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-gray-800 dark:text-white/90">
        {texto}
      </dd>
    </div>
  );
}

export default async function TrabajadorPerfilPage({
  params,
}: {
  params: Promise<{ ci: string }>;
}) {
  const { ci } = await params;
  const carnet = ci.trim();

  const res = await backendConSesion(`/api/trabajadores/${encodeURIComponent(carnet)}`);
  if (res.status === 401) {
    return notFound();
  }
  if (!res.ok) {
    return notFound();
  }
  const t = (await res.json()) as Trabajador;

  const deBaja = t.Baja === 1;
  const edad = edadDesdeCarnet(t.No_CI);
  const area = t.Desc_Direccion?.trim() || t.Id_Direccion?.trim() || "Sin área";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <LinkVolver />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
          <FotoTrabajador
            ci={carnet}
            iniciales={iniciales(t)}
            className="h-16 w-16"
            textClassName="text-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-gray-800 dark:text-white/90">
                {nombreCompleto(t)}
              </h1>
              {deBaja ? (
                <Badge variant="solid" color="warning">
                  De baja
                </Badge>
              ) : (
                <Badge variant="solid" color="success">
                  Activo
                </Badge>
              )}
            </div>
            {t.Desc_Cargo?.trim() && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t.Desc_Cargo.trim()}</p>
            )}
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" title={area}>
              <span className="line-clamp-2">{area}</span>
            </p>
          </div>
        </div>

        <dl className="px-6 pb-2 pt-4">
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div>
              <Fila etiqueta="Carné de identidad" valor={t.No_CI ?? undefined} />
              <Fila etiqueta="Expediente" valor={t.Id_Expediente ?? undefined} />
              <Fila etiqueta="Sexo" valor={sexoLabel(t.Sexo)} />
              <Fila
                etiqueta="Edad"
                valor={edad != null ? `${edad} años` : undefined}
              />
            </div>
            <div>
              <Fila etiqueta="Área" valor={area} />
              <Fila etiqueta="Cargo" valor={t.Desc_Cargo?.trim() ?? undefined} />
              <Fila etiqueta="Contratación" valor={fechaCorta(t.Fecha_Contratacion)} />
              <Fila
                etiqueta="Fecha de baja"
                valor={deBaja ? fechaCorta(t.Fecha_Baja) : undefined}
              />
            </div>
          </div>
        </dl>

        {(t.Docente || t.Investigador) && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            {t.Docente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                Docente
              </span>
            )}
            {t.Investigador && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                Investigador
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LinkVolver() {
  return (
    <p>
      <Link
        href="/portal/trabajadores"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12.7803 4.71967C13.0732 5.01256 13.0732 5.48744 12.7803 5.78033L8.56066 10L12.7803 14.2197C13.0732 14.5126 13.0732 14.9874 12.7803 15.2803C12.4874 15.5732 12.0126 15.5732 11.7197 15.2803L6.71967 10.2803C6.42678 9.98744 6.42678 9.51256 6.71967 9.21967L11.7197 4.21967C12.0126 3.92678 12.4874 3.92678 12.7803 4.71967Z"
            fill="currentColor"
          />
        </svg>
        Volver a trabajadores
      </Link>
    </p>
  );
}