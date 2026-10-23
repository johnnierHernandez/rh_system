"use client";

import { useState, type FormEvent } from "react";

import Badge from "@/components/ui/badge/Badge";

type Componentes = {
  Tarifa: number | null;
  Tarifa_Diaria: number | null;
  Salario_Basico: number | null;
  Salario_por_Cargo: number | null;
  Plus: number | null;
  Antiguedad: number | null;
  Estimulo: number | null;
  Porciento_Estimulo: number | null;
  Otros: number | null;
  Retribucion_Complementaria: number | null;
  IETerritorial: number | null;
  ETSector: number | null;
  Idoneidad_Fijo: number | null;
  Idoneidad_Movil: number | null;
  Estimulacion: number | null;
  HorarioIrregular: number | null;
  Otras_CLA: number | null;
  Horas_Extra: number | null;
  Condiciones: number | null;
  Dias_Acumulado: number | null;
  Salario_Acumulado: number | null;
  Id_Tipo_Participacion: string | null;
};

type Historico = {
  Ano: number | null;
  Mes: number | null;
  Salario_Basico: number | null;
  Salario_por_Cargo: number | null;
  Plus: number | null;
  Antiguedad: number | null;
  Estimulo: number | null;
  Otros: number | null;
  Dias_Trabajados: number | null;
  Devengado: number | null;
};

type Cobro = {
  Ano: number | null;
  Mes: number | null;
  Salario: number | null;
  Dias_Trabajados: number | null;
  Vacaciones: number | null;
  Dias_Vacaciones: number | null;
  Salario_para_Subsidio: number | null;
  Dias_Trabajados_para_Subsidio: number | null;
  Subsidio: number | null;
  Maternidad: number | null;
};

type Nominilla = {
  Clasificacion: number | null;
  Desc_Clasif_Nominilla: string | null;
  Salario_Basico: number | null;
  Plus: number | null;
  Antiguedad: number | null;
  Otros: number | null;
  Dias_a_Pagar: number | null;
  Devengado: number | null;
  Acobrar: number | null;
  Deducciones: number | null;
  Devengado_Tarjeta: number | null;
};

type Persona = {
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Cargo: string | null;
  Desc_Cargo: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Desc_Categoria: string | null;
  Desc_Subcategoria: string | null;
  Desc_Grado_Cientifico: string | null;
  Plaza: number | null;
  Baja: number | null;
  actual: Componentes | null;
  historico: Historico[];
  cobros: Cobro[];
  nominilla_periodo: string | null;
  nominilla: Nominilla[];
};

type Total = {
  expedientes: number;
  periodo: string | null;
  Salario_Basico: number;
  Devengado: number;
  Seguridad_Social: number;
  Impuesto_Ingresos: number;
  Otras_Deducciones: number;
  Total_Descuentos: number;
  Neto: number;
};

type Respuesta = {
  consulta: string;
  encontrado: boolean;
  metodo: string | null;
  personas: Persona[];
  total: Total | null;
};

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const nf = new Intl.NumberFormat("es-CU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dinero(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : nf.format(v);
}

function dias(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : nf.format(v);
}

function periodo(ano: number | null, mes: number | null): string {
  if (!ano || !mes) return "—";
  return `${MESES[mes - 1] ?? mes} ${ano}`;
}

function nombreCompleto(p: Persona): string {
  return [p.Nombre, p.Apellido_1, p.Apellido_2].filter(Boolean).join(" ") || "—";
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

function area(p: Persona): string {
  return p.Desc_Direccion?.trim() || p.Id_Direccion?.trim() || "Sin área";
}

function catalogos(p: Persona): string {
  const partes = [p.Desc_Categoria, p.Desc_Subcategoria, p.Desc_Grado_Cientifico]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));
  return partes.join(" · ") || "—";
}

/** Componentes monetarios, en el orden en que se suelen leer. */
const MONTOS: { clave: keyof Componentes; etiqueta: string }[] = [
  { clave: "Salario_Basico", etiqueta: "Salario básico" },
  { clave: "Salario_por_Cargo", etiqueta: "Salario por cargo" },
  { clave: "Plus", etiqueta: "Plus" },
  { clave: "Antiguedad", etiqueta: "Antigüedad" },
  { clave: "Estimulo", etiqueta: "Estímulo" },
  { clave: "Estimulacion", etiqueta: "Estimulación" },
  { clave: "Retribucion_Complementaria", etiqueta: "Retribución complementaria" },
  { clave: "Idoneidad_Fijo", etiqueta: "Idoneidad (fijo)" },
  { clave: "Idoneidad_Movil", etiqueta: "Idoneidad (móvil)" },
  { clave: "Condiciones", etiqueta: "Condiciones" },
  { clave: "HorarioIrregular", etiqueta: "Horario irregular" },
  { clave: "Otras_CLA", etiqueta: "Otras CLA" },
  { clave: "Horas_Extra", etiqueta: "Horas extra" },
  { clave: "Otros", etiqueta: "Otros" },
];

/** Recargos que la base guarda como porcentaje, no como importe. */
const PORCIENTOS: { clave: keyof Componentes; etiqueta: string }[] = [
  { clave: "Porciento_Estimulo", etiqueta: "Estímulo" },
  { clave: "IETerritorial", etiqueta: "IE territorial" },
  { clave: "ETSector", etiqueta: "ET sector" },
];

function Kpi({
  etiqueta,
  valor,
  sufijo,
  nota,
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">
        {valor}
        {sufijo && (
          <span className="ms-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            {sufijo}
          </span>
        )}
      </p>
      {nota && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{nota}</p>}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{etiqueta}</dt>
      <dd className="text-right text-sm text-gray-800 dark:text-white/90">{valor}</dd>
    </div>
  );
}

function Avatar({ ci, nombre }: { ci: string | null; nombre: string }) {
  const [fallo, setFallo] = useState(false);

  if (!ci || fallo) {
    return (
      <div
        title={fallo ? "Sin fotografía" : undefined}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300"
      >
        {iniciales(nombre)}
      </div>
    );
  }

  return (
    <img
      src={`/api/trabajadores/${encodeURIComponent(ci)}/foto`}
      alt={`Fotografía de ${nombre}`}
      decoding="async"
      width={64}
      height={64}
      onError={() => setFallo(true)}
      className="h-16 w-16 shrink-0 rounded-full border border-gray-200 bg-gray-50 object-cover object-top dark:border-gray-700 dark:bg-white/5"
    />
  );
}

function Tabla({
  titulo,
  nota,
  cabeceras,
  filas,
}: {
  titulo: string;
  nota?: string;
  cabeceras: string[];
  filas: (string | number)[][];
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
          {titulo}
        </h3>
        {nota && <span className="text-xs text-gray-400 dark:text-gray-500">{nota}</span>}
      </div>
      {filas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          Sin datos.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <tr>
                {cabeceras.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-4 py-2 text-left font-medium first:pl-4 last:pr-4"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  {fila.map((celda, j) => (
                    <td
                      key={j}
                      className={`whitespace-nowrap px-4 py-2 ${
                        j === 0
                          ? "text-gray-600 dark:text-gray-300"
                          : "text-right tabular-nums text-gray-800 dark:text-white/90"
                      }`}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FichaSalario({ p }: { p: Persona }) {
  const nombre = nombreCompleto(p);
  const deBaja = p.Baja === 1;
  const a = p.actual;

  const ultimoHist = p.historico[p.historico.length - 1];
  const ultimoCobro = p.cobros[p.cobros.length - 1];

  const montos = MONTOS.map((m) => ({ ...m, valor: (a?.[m.clave] as number | null) ?? 0 })).filter(
    (m) => m.valor !== 0,
  );
  const porcientos = PORCIENTOS.map((m) => ({
    ...m,
    valor: (a?.[m.clave] as number | null) ?? 0,
  })).filter((m) => m.valor !== 0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
          <Avatar ci={p.No_CI} nombre={nombre} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-gray-800 dark:text-white/90">
                {nombre}
              </h2>
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
            {p.Desc_Cargo?.trim() && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {p.Desc_Cargo.trim()}
              </p>
            )}
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" title={area(p)}>
              <span className="line-clamp-2">{area(p)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{catalogos(p)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Kpi
            etiqueta="Salario básico"
            valor={dinero(a?.Salario_Basico)}
            sufijo="CUP"
            nota="Mensual, nómina vigente"
          />
          <Kpi
            etiqueta="Devengado"
            valor={dinero(ultimoHist?.Devengado)}
            sufijo="CUP"
            nota={ultimoHist ? periodo(ultimoHist.Ano, ultimoHist.Mes) : "Sin histórico"}
          />
          <Kpi
            etiqueta="Cobrado"
            valor={dinero(ultimoCobro?.Salario)}
            sufijo="CUP"
            nota={ultimoCobro ? periodo(ultimoCobro.Ano, ultimoCobro.Mes) : "Sin cobros"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Componentes del salario
          </h3>
          {!a ? (
            <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
              Este expediente no tiene fila en la nómina de empleados.
            </p>
          ) : (
            <>
              <dl className="mt-2">
                {montos.length === 0 ? (
                  <p className="py-3 text-sm text-gray-400 dark:text-gray-500">
                    Sin componentes con importe.
                  </p>
                ) : (
                  montos.map((m) => (
                    <Dato key={m.clave} etiqueta={m.etiqueta} valor={dinero(m.valor)} />
                  ))
                )}
              </dl>
              {porcientos.length > 0 && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Recargos:{" "}
                  {porcientos.map((m, i) => (
                    <span key={m.clave}>
                      {i > 0 ? " · " : ""}
                      {m.etiqueta} {nf.format(m.valor)} %
                    </span>
                  ))}
                </p>
              )}
              {!!a.Dias_Acumulado && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Vacaciones acumuladas: {dias(a.Dias_Acumulado)} días ·{" "}
                  {dinero(a.Salario_Acumulado)} CUP
                </p>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Datos del expediente
          </h3>
          <dl className="mt-2">
            <Dato etiqueta="Carné de identidad" valor={p.No_CI ?? "—"} />
            <Dato etiqueta="Expediente" valor={p.Id_Expediente ?? "—"} />
            <Dato
              etiqueta="Plaza"
              valor={p.Plaza && p.Plaza > 0 ? String(p.Plaza) : "—"}
            />
            <Dato etiqueta="Cargo" valor={p.Desc_Cargo?.trim() || "—"} />
            <Dato etiqueta="Área" valor={area(p)} />
            <Dato etiqueta="Tarifa horaria" valor={dinero(a?.Tarifa)} />
            <Dato etiqueta="Tarifa diaria" valor={dinero(a?.Tarifa_Diaria)} />
          </dl>
        </section>
      </div>

      <Tabla
        titulo="Evolución del sueldo fijo"
        nota={`${p.historico.length} mes${p.historico.length === 1 ? "" : "es"}`}
        cabeceras={["Período", "Básico", "Cargo", "Plus", "Antig.", "Estím.", "Días", "Devengado"]}
        filas={[...p.historico].reverse().map((h) => [
          periodo(h.Ano, h.Mes),
          dinero(h.Salario_Basico),
          dinero(h.Salario_por_Cargo),
          dinero(h.Plus),
          dinero(h.Antiguedad),
          dinero(h.Estimulo),
          dias(h.Dias_Trabajados),
          dinero(h.Devengado),
        ])}
      />

      <Tabla
        titulo="Cobros por mes"
        nota={`${p.cobros.length} mes${p.cobros.length === 1 ? "" : "es"}`}
        cabeceras={["Período", "Cobrado", "Días", "Vacaciones", "Días vac.", "Sal. subsidio"]}
        filas={[...p.cobros].reverse().map((c) => [
          periodo(c.Ano, c.Mes),
          dinero(c.Salario),
          dias(c.Dias_Trabajados),
          dinero(c.Vacaciones),
          dias(c.Dias_Vacaciones),
          dinero(c.Salario_para_Subsidio),
        ])}
      />

      <Tabla
        titulo={`Nominilla${p.nominilla_periodo ? ` · ${p.nominilla_periodo}` : ""}`}
        nota="Último período con datos"
        cabeceras={["Concepto", "Devengado", "A cobrar", "Deducciones", "Tarjeta"]}
        filas={p.nominilla.map((n) => [
          n.Desc_Clasif_Nominilla?.trim() || (n.Clasificacion != null ? String(n.Clasificacion) : "—"),
          dinero(n.Devengado),
          dinero(n.Acobrar),
          dinero(n.Deducciones),
          dinero(n.Devengado_Tarjeta),
        ])}
      />
    </div>
  );
}

/** Período en texto a partir de un `AAAA-MM`. */
function periodoTexto(p: string | null): string {
  if (!p) return "Sin período";
  const [ano, mes] = p.split("-");
  const m = Number(mes);
  return `${MESES[m - 1] ?? mes} ${ano}`;
}

/** Resumen del conjunto de expedientes de la persona (pluriempleo incluido).

 *  Cuando la persona tiene más de un expediente, la ley obliga a sumar todas
 *  sus remuneraciones y retener sobre el total (GOC-2023-271-EX20); este
 *  resumen muestra ese salario total, sus descuentos y el neto.
 */
function ResumenTotal({ t }: { t: Total }) {
  const pluri = t.expedientes > 1;
  const sinDatos = t.Devengado === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-emerald-100 px-5 py-3 dark:border-emerald-500/20">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
          {pluri ? "Salario total (pluriempleo)" : "Total del salario"}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {pluri && (
            <>
              {t.expedientes} expedientes · {dinero(t.Salario_Basico)} CUP de básico ·{" "}
            </>
          )}
          {periodoTexto(t.periodo)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <Kpi
          etiqueta="Salario básico"
          valor={dinero(t.Salario_Basico)}
          sufijo="CUP"
          nota={pluri ? "Suma de los básicos activos" : "Básico vigente"}
        />
        <Kpi
          etiqueta="Devengado"
          valor={dinero(t.Devengado)}
          sufijo="CUP"
          nota="Base del período"
        />
        <Kpi
          etiqueta="Descuentos"
          valor={dinero(t.Total_Descuentos)}
          sufijo="CUP"
          nota="GOC-2023-EX20"
        />
        <Kpi
          etiqueta="Neto a cobrar"
          valor={dinero(t.Neto)}
          sufijo="CUP"
          nota="Devengado − descuentos"
        />
      </div>

      {!sinDatos && (
        <div className="border-t border-emerald-100 px-5 py-4 dark:border-emerald-500/20">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Descuentos aplicados
          </h4>
          <dl className="mt-2">
            <Dato
              etiqueta="Seguridad Social · 5 % hasta 15 000, 10 % del exceso"
              valor={dinero(t.Seguridad_Social)}
            />
            <Dato
              etiqueta="Impuesto sobre ingresos · escala progresiva desde 3 260"
              valor={dinero(t.Impuesto_Ingresos)}
            />
            {t.Otras_Deducciones > 0 && (
              <Dato etiqueta="Otras deducciones de la nómina" valor={dinero(t.Otras_Deducciones)} />
            )}
            <Dato etiqueta="Total de descuentos" valor={dinero(t.Total_Descuentos)} />
          </dl>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Retenciones según la Resolución 41/2023 del MFP (GOC-2023-271-EX20).
          </p>
        </div>
      )}
    </section>
  );
}

export default function SalariosExplorer() {
  const [texto, setTexto] = useState("");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState(0);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    if (!q) return;

    setCargando(true);
    setError(null);
    setDatos(null);
    setElegido(0);

    try {
      const r = await fetch(`/api/salarios?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (r.status === 403) {
        setError("Su perfil no tiene permiso para consultar salarios.");
        return;
      }
      if (r.status === 503) {
        setError(
          "El directorio del AD no está disponible ahora mismo. Inténtelo de nuevo en unos minutos.",
        );
        return;
      }
      if (!r.ok) throw new Error("fallo");
      setDatos((await r.json()) as Respuesta);
    } catch {
      setError("No se pudo completar la consulta. Inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const personas = datos?.personas ?? [];
  const persona = personas[elegido] ?? personas[0] ?? null;

  return (
    <div className="space-y-5">
      <form
        onSubmit={buscar}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/3"
      >
        <svg
          className="ms-1 h-5 w-5 shrink-0 text-gray-400"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
            fill="currentColor"
          />
        </svg>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Carné de identidad o usuario de internet…"
          autoComplete="off"
          className="h-8 min-w-52 grow bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && !datos && !cargando && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Escriba un carné de identidad o un usuario de internet y pulse
          «Consultar».
        </p>
      )}

      {!error && datos && !datos.encontrado && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
          No se encontró nómina para <span className="font-medium">{datos.consulta}</span>.
          {datos.metodo === "usuario_internet" && (
            <> La cuenta existe en el directorio, pero no tiene expediente de nómina.</>
          )}
        </div>
      )}

      {!error && persona && (
        <>
          {personas.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Esta persona tiene {personas.length} expedientes:
              </span>
              {personas.map((p, i) => (
                <button
                  key={p.Id_Expediente ?? i}
                  type="button"
                  onClick={() => setElegido(i)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                    i === elegido
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="font-medium">{p.Desc_Cargo?.trim() || "Sin cargo"}</span>
                  <span className="text-xs text-gray-400">#{p.Id_Expediente}</span>
                  {p.Baja === 1 && <span className="text-xs text-amber-600">Baja</span>}
                </button>
              ))}
            </div>
          )}
          {datos?.total && datos.total.expedientes > 0 && <ResumenTotal t={datos.total} />}
          <FichaSalario p={persona} />
        </>
      )}
    </div>
  );
}
