import type { Metadata } from "next";
import Link from "next/link";

import { backendConSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi nómina | DRHnet" };

export const dynamic = "force-dynamic";

type Cobro = {
  Ano: number | null;
  Mes: number | null;
  Salario: number;
  Dias_Trabajados: number;
  Vacaciones: number;
  Dias_Vacaciones: number;
};

type Total = {
  periodo: string | null;
  Salario_Basico: number;
  Devengado: number;
  Seguridad_Social: number;
  Impuesto_Ingresos: number;
  Otras_Deducciones: number;
  Total_Descuentos: number;
  Neto: number;
};

type MiNomina = {
  encontrado: boolean;
  carnet: string;
  nombre: string | null;
  area: string | null;
  cargo: string | null;
  expedientes: number;
  periodo: string | null;
  total: Total | null;
  dias_acumulados: number;
  salario_acumulado: number;
  dias_trabajados: number;
  periodo_dias: string | null;
  ultimos_cobros: Cobro[];
  mensaje: string | null;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const nf = new Intl.NumberFormat("es-CU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dinero(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${nf.format(v)} CUP`;
}

function dias(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : nf.format(v);
}

/** "2026-09" -> "septiembre de 2026". */
function periodoTexto(p: string | null): string {
  if (!p) return "sin período";
  const [ano, mes] = p.split("-").map(Number);
  if (!ano || !mes) return p;
  return `${MESES[mes - 1] ?? mes} de ${ano}`;
}

function mesTexto(ano: number | null, mes: number | null): string {
  if (!ano || !mes) return "—";
  return `${MESES_CORTOS[mes - 1] ?? mes} ${ano}`;
}

async function getNomina(): Promise<MiNomina | null> {
  try {
    const res = await backendConSesion("/api/mi-nomina");
    if (!res.ok) return null;
    return (await res.json()) as MiNomina;
  } catch {
    return null;
  }
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  destacada = false,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        destacada
          ? "border-[#c9e9da] bg-[#f3faf6] dark:border-brand-500/30 dark:bg-brand-500/10"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3"
      }`}
    >
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {etiqueta}
      </span>
      <p
        className={`mt-1.5 text-xl font-bold ${
          destacada
            ? "text-[#006633] dark:text-brand-400"
            : "text-gray-800 dark:text-white/90"
        }`}
      >
        {valor}
      </p>
      {nota && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{nota}</p>
      )}
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte = false,
  resta = false,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  resta?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        fuerte
          ? "border-t border-gray-200 pt-3 dark:border-gray-700"
          : ""
      }`}
    >
      <dt
        className={`text-sm ${
          fuerte
            ? "font-semibold text-gray-800 dark:text-white/90"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {etiqueta}
      </dt>
      <dd
        className={`text-right text-sm tabular-nums ${
          fuerte
            ? "font-bold text-[#006633] dark:text-brand-400"
            : "font-medium text-gray-800 dark:text-white/90"
        }`}
      >
        {resta && valor !== "—" ? `− ${valor}` : valor}
      </dd>
    </div>
  );
}

export default async function MiNominaPage() {
  const nomina = await getNomina();

  if (!nomina) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Mi nómina
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tus datos personales de nómina. Solo tú puedes ver esta información.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          No pudimos cargar tu nómina en este momento. Inténtalo de nuevo en unos
          minutos.
        </div>
      </div>
    );
  }

  if (!nomina.encontrado) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Mi nómina
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tus datos personales de nómina. Solo tú puedes ver esta información.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
            No apareces en la nómina
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {nomina.mensaje ??
              "No encontramos una ficha de nómina asociada a tu carné. Si eres trabajador de la CUJAE, comunícate con la Dirección de Recursos Humanos."}
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Carné consultado: {nomina.carnet || "—"}
          </p>
        </div>
      </div>
    );
  }

  const t = nomina.total;
  const hayCobros = nomina.ultimos_cobros.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Mi nómina
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tus datos personales de nómina. Solo tú puedes ver esta información.
          </p>
        </div>
        {nomina.expedientes > 1 && (
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            {nomina.expedientes} expedientes
          </span>
        )}
      </div>

      {/* Identificación */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
              {nomina.nombre ?? "Trabajador"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {[nomina.cargo, nomina.area].filter(Boolean).join(" · ") ||
                "Sin cargo registrado"}
            </p>
          </div>
          <span className="font-mono text-xs text-gray-400">
            CI {nomina.carnet}
          </span>
        </div>
      </div>

      {/* Cifras del período */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta
          etiqueta={`Devengado · ${periodoTexto(nomina.periodo)}`}
          valor={dinero(t?.Devengado)}
          nota="Antes de descuentos"
        />
        <Tarjeta
          etiqueta="Neto a cobrar"
          valor={dinero(t?.Neto)}
          nota="Después de descuentos"
          destacada
        />
        <Tarjeta
          etiqueta="Vacaciones acumuladas"
          valor={`${dias(nomina.dias_acumulados)} días`}
          nota={dinero(nomina.salario_acumulado)}
        />
        <Tarjeta
          etiqueta="Días trabajados"
          valor={`${dias(nomina.dias_trabajados)} días`}
          nota={
            nomina.periodo_dias
              ? `Sueldo fijo de ${periodoTexto(nomina.periodo_dias)}`
              : "Sin sueldo fijo registrado"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resumen del período */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
            Resumen del período
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Período de referencia: {periodoTexto(nomina.periodo)}. El pago se
            efectúa al mes siguiente.
          </p>
          <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            <Fila
              etiqueta="Salario básico vigente"
              valor={dinero(t?.Salario_Basico)}
            />
            <Fila etiqueta="Devengado" valor={dinero(t?.Devengado)} />
            <Fila
              etiqueta="Seguridad Social"
              valor={dinero(t?.Seguridad_Social)}
              resta
            />
            <Fila
              etiqueta="Impuesto sobre ingresos"
              valor={dinero(t?.Impuesto_Ingresos)}
              resta
            />
            <Fila
              etiqueta="Otras deducciones"
              valor={dinero(t?.Otras_Deducciones)}
              resta
            />
            <Fila
              etiqueta="Neto a cobrar"
              valor={dinero(t?.Neto)}
              fuerte
            />
          </dl>
        </section>

        {/* Últimos cobros */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
            Últimos 12 cobros
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {nomina.expedientes > 1
              ? "Suma de todos tus expedientes. El más reciente aparece primero."
              : "El más reciente aparece primero."}
          </p>

          {hayCobros ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-700">
                    <th className="py-2 pr-3 font-semibold">Mes</th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Cobrado
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Días
                    </th>
                    <th className="py-2 text-right font-semibold">
                      Días vac.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {nomina.ultimos_cobros.map((c) => (
                    <tr
                      key={`${c.Ano}-${c.Mes}`}
                      className="text-gray-700 dark:text-gray-300"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {mesTexto(c.Ano, c.Mes)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {dinero(c.Salario)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {dias(c.Dias_Trabajados)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {dias(c.Dias_Vacaciones)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay cobros registrados.
            </p>
          )}
        </section>
      </div>

      <p className="text-xs leading-relaxed text-gray-400">
        Los importes están en pesos cubanos (CUP). Si algún dato no coincide con
        tu nómina, comunícate con la Dirección de Recursos Humanos.{" "}
        <Link
          href="/portal"
          className="font-medium text-[#006633] hover:underline dark:text-brand-400"
        >
          Volver al panel
        </Link>
      </p>
    </div>
  );
}
