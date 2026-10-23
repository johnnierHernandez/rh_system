"use client";

import { useEffect, useRef, useState } from "react";
import Contador from "./contador";

/** Cada cuánto se releen las cifras con la pestaña abierta. */
const INTERVALO_MS = 5 * 60 * 1000;
/** No se refresca más de una vez por minuto al volver de otra pestaña. */
const MINIMO_MS = 60 * 1000;

export type NumItem = { etiqueta: string; valor: number; porcentaje: number };
export type NumUnidad = { id_direccion: string; etiqueta: string; valor: number };

export type Numeros = {
  total_activos: number;
  docentes: number;
  no_docentes: number;
  unidades: number;
  fecha_corte: string | null;
  sexo: NumItem[];
  contratos: NumItem[];
  categorias_docentes: NumItem[];
  ocupacional: NumItem[];
  top_unidades: NumUnidad[];
};

const VACIO: Numeros = {
  total_activos: 0,
  docentes: 0,
  no_docentes: 0,
  unidades: 0,
  fecha_corte: null,
  sexo: [],
  contratos: [],
  categorias_docentes: [],
  ocupacional: [],
  top_unidades: [],
};

const VERDE = "#006633";
const AMBAR = "#d97706";
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** Los rótulos del catálogo traen MAYÚSCULAS y espacios dobles. */
const txt = (s: string) => s.replace(/\s+/g, " ").trim();
const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} %`;

function fechaLarga(iso: string | null) {
  if (!iso) return "s/f";
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

function Barra({ valor, maximo, color }: { valor: number; maximo: number; color: string }) {
  const ancho = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f0]">
      <div className="h-1.5 rounded-full" style={{ width: `${ancho}%`, background: color }} />
    </div>
  );
}

/** Anillo de dos segmentos (SVG puro, sin librería de gráficos). */
function Anillo({ items }: { items: NumItem[] }) {
  const R = 60;
  const G = 17;
  const C = 2 * Math.PI * R;
  const colores = [VERDE, AMBAR, "#64748b"];
  const largo = (i: NumItem) => (i.porcentaje / 100) * C;
  // desfase de cada segmento: longitud acumulada de los anteriores
  const segmentos = items.map((it, i) => ({
    it,
    color: colores[i % colores.length],
    trazo: Math.max(0, largo(it) - 2),
    nodo: -items.slice(0, i).reduce((acc, prev) => acc + largo(prev), 0),
  }));

  return (
    <svg
      viewBox="0 0 160 160"
      className="h-36 w-36 shrink-0 sm:h-40 sm:w-40"
      role="img"
      aria-label={`Distribución por sexo: ${items.map((i) => `${i.etiqueta} ${pct(i.porcentaje)}`).join(", ")}`}
    >
      <circle cx="80" cy="80" r={R} fill="none" stroke="#eef2f0" strokeWidth={G} />
      {segmentos.map((s) => (
        <circle
          key={s.it.etiqueta}
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke={s.color}
          strokeWidth={G}
          strokeDasharray={`${s.trazo} ${C - s.trazo}`}
          strokeDashoffset={s.nodo}
          transform="rotate(-90 80 80)"
        />
      ))}
    </svg>
  );
}

export default function NumerosCujae({ n }: { n: Partial<Numeros> | null | undefined }) {
  const [d, setD] = useState<Numeros>({ ...VACIO, ...(n ?? {}) });
  const [lectura, setLectura] = useState<Date | null>(null);
  const [verTodosDocentes, setVerTodosDocentes] = useState(false);
  const ultima = useRef(0);

  // Las cifras llegan del servidor en el HTML y se releen solas: la sección no
  // depende de que el visitante recargue la página.
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/numeros", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        setD((await r.json()) as Numeros);
        setLectura(new Date());
      } catch {
        // si la red falla se conserva el último dato bueno
      }
      ultima.current = Date.now();
    };
    const refrescar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultima.current > MINIMO_MS) {
        void cargar();
      }
    };
    const timer = setInterval(refrescar, INTERVALO_MS);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, []);

  if (!d.total_activos) return null;

  const kpis = [
    { etiqueta: "trabajadores activos", valor: d.total_activos, pie: "con Baja = 0 y Alta = 1" },
    { etiqueta: "docentes", valor: d.docentes, pie: pct((d.docentes / d.total_activos) * 100) + " del total" },
    { etiqueta: "mujeres", valor: d.sexo.find((s) => s.etiqueta === "Mujeres")?.valor ?? 0, pie: pct(d.sexo.find((s) => s.etiqueta === "Mujeres")?.porcentaje ?? 0) + " del total" },
    { etiqueta: "unidades organizativas", valor: d.unidades, pie: "con personal activo" },
  ];

  const maxDocente = Math.max(...d.categorias_docentes.map((c) => c.valor), 1);
  const docentesVisibles = verTodosDocentes
    ? d.categorias_docentes
    : d.categorias_docentes.slice(0, 5);
  const maxOcup = Math.max(...d.ocupacional.map((c) => c.valor), 1);

  return (
    <section
      id="numeros-cujae"
      aria-labelledby="numeros-cujae-titulo"
      className="scroll-mt-24 rounded-2xl border border-[#e5e7eb] bg-white p-6 md:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="numeros-cujae-titulo" className="text-xl font-bold text-[#006633]">
            Números CUJAE
          </h2>
          <p className="mt-1 text-[#52525b]">
            <span className="font-semibold text-[#1a1a1a]">{fmt(d.total_activos)}</span>{" "}
            trabajadores activos en{" "}
            <span className="font-semibold text-[#1a1a1a]">{fmt(d.unidades)}</span> unidades
            organizativas
          </p>
        </div>
        <p className="text-xs text-[#52525b]">
          Corte: {fechaLarga(d.fecha_corte)} · Fuente: base ASSETS_RH
        </p>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.etiqueta} className={i > 0 ? "lg:border-l lg:border-[#e5e7eb] lg:pl-6" : ""}>
            <Contador
              valor={k.valor}
              className="block text-4xl font-bold leading-none text-[#006633] md:text-5xl"
            />
            <p className="mt-2 font-semibold text-[#1a1a1a]">{k.etiqueta}</p>
            <p className="mt-0.5 text-sm text-[#52525b]">{k.pie}</p>
          </div>
        ))}
      </div>

      {/* Sexo + contratos */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#52525b]">
            Mujeres y hombres
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="relative">
              <Anillo items={d.sexo} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#1a1a1a]">{fmt(d.total_activos)}</span>
                <span className="text-xs text-[#52525b]">activos</span>
              </div>
            </div>
            <ul className="flex-1 space-y-3">
              {d.sexo.map((s, i) => (
                <li key={s.etiqueta} className="flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: [VERDE, AMBAR, "#64748b"][i % 3] }}
                  />
                  <span className="flex-1 text-sm text-[#1a1a1a]">
                    {s.etiqueta} <span className="text-[#52525b]">· {pct(s.porcentaje)}</span>
                  </span>
                  <span className="font-semibold text-[#1a1a1a]">{fmt(s.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#52525b]">
            Tipos de contrato
          </h3>
          <ul className="mt-4 space-y-3">
            {d.contratos.map((c) => (
              <li key={c.etiqueta}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[#1a1a1a]">{txt(c.etiqueta)}</span>
                  <span className="shrink-0 text-[#52525b]">
                    {fmt(c.valor)} <span className="text-[#8b8b93]">· {pct(c.porcentaje)}</span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <Barra valor={c.valor} maximo={d.contratos[0]?.valor ?? 1} color={VERDE} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Categorías docentes */}
      <div className="mt-10 border-t border-[#e5e7eb] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#52525b]">
            Categorías docentes
          </h3>
          <p className="text-xs text-[#52525b]">
            {fmt(d.docentes)} docentes · {fmt(d.no_docentes)} no docentes
          </p>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
          {docentesVisibles.map((c) => (
            <div key={c.etiqueta}>
              <p className="text-2xl font-bold leading-none text-[#006633]">{fmt(c.valor)}</p>
              <p className="mt-1.5 min-h-[2.5rem] text-sm text-[#1a1a1a]">{txt(c.etiqueta)}</p>
              <div className="mt-1.5">
                <Barra valor={c.valor} maximo={maxDocente} color={VERDE} />
              </div>
              <p className="mt-1 text-xs text-[#52525b]">{pct(c.porcentaje)} del total</p>
            </div>
          ))}
        </div>
        {d.categorias_docentes.length > 5 && (
          <button
            type="button"
            onClick={() => setVerTodosDocentes((v) => !v)}
            aria-expanded={verTodosDocentes}
            className="mt-5 text-sm font-medium text-[#006633] underline underline-offset-4 hover:text-[#004d24]"
          >
            {verTodosDocentes
              ? "Ver solo las 5 principales"
              : `Ver las ${d.categorias_docentes.length} categorías`}
          </button>
        )}
      </div>

      {/* Categoría ocupacional */}
      <div className="mt-10 border-t border-[#e5e7eb] pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#52525b]">
          Categoría ocupacional
        </h3>
        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {d.ocupacional.map((o) => (
            <div key={o.etiqueta}>
              <p className="text-2xl font-bold leading-none text-[#006633]">{fmt(o.valor)}</p>
              <p className="mt-1.5 text-sm text-[#1a1a1a]">{txt(o.etiqueta)}</p>
              <div className="mt-1.5">
                <Barra valor={o.valor} maximo={maxOcup} color={VERDE} />
              </div>
              <p className="mt-1 text-xs text-[#52525b]">{pct(o.porcentaje)} del total</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 border-t border-[#e5e7eb] pt-4 text-xs text-[#52525b]">
        Cifras del personal con Baja = 0 y Alta = 1 en la base ASSETS_RH, consultadas el{" "}
        {fechaLarga(d.fecha_corte)}. Esta sección se relee sola cada 5 minutos mientras la
        página está abierta
        {lectura ? (
          <>
            {" "}
            · última lectura a las{" "}
            <span className="font-semibold text-[#1a1a1a]">
              {String(lectura.getHours()).padStart(2, "0")}:
              {String(lectura.getMinutes()).padStart(2, "0")}:
              {String(lectura.getSeconds()).padStart(2, "0")}
            </span>
          </>
        ) : null}
        .
      </p>
    </section>
  );
}
