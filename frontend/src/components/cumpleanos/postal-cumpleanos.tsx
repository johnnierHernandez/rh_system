"use client";

import { useMemo } from "react";

type Cumple = {
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Fecha_Nacimiento: string | null;
};

const COLORES_CONFETI = [
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#facc15",
  "#ffffff",
];

/**
 * Pone en mayúscula inicial el texto que la base guarda en MAYÚSCULAS, sin
 * convertirlo todo a minúsculas: se respetan siglas como "DG de ICI".
 */
function nombreBonito(bruto?: string | null): string {
  if (!bruto) return "";
  return bruto
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p.length > 1 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Nombre de la unidad organizativa: se conserva como viene de la base y solo
 * se colapsan los espacios dobles (los campos `char` los traen de fábrica).
 */
function unidad(bruto?: string | null): string {
  return (bruto ?? "").replace(/\s+/g, " ").trim();
}

function iniciales(p: Cumple): string {
  const n = (p.Nombre ?? "").trim().charAt(0);
  const a = (p.Apellido_1 ?? "").trim().charAt(0);
  return (n + a).toUpperCase() || "•";
}

/** Confeti en JS puro: posiciones fijas por índice para no cambiar al re-render. */
function Confeti({ conteo = 36 }: { conteo?: number }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: conteo }, (_, i) => ({
        left: (i * 37 + 13) % 100,
        retraso: (i * 0.35) % 2.4,
        duracion: 3.2 + ((i * 0.71) % 1.8),
        color: COLORES_CONFETI[i % COLORES_CONFETI.length],
        rotacion: (i * 47) % 360,
        giro: ((i % 2) === 0 ? 1 : -1) * (180 + (i * 13) % 180),
        ancho: 6 + (i % 3) * 2,
      })),
    [conteo],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {piezas.map((p, i) => (
        <span
          key={i}
          className="postal-confeti-pieza absolute top-[-12px]"
          style={{
            left: `${p.left}%`,
            width: p.ancho,
            height: p.ancho * 1.6,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotacion}deg)`,
            animationDelay: `${p.retraso}s`,
            animationDuration: `${p.duracion}s`,
            ["--giro" as string]: `${p.giro}deg`,
          }}
        />
      ))}
    </div>
  );
}

function Vela({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="18" width="4" height="12" rx="1" fill={color} />
      <rect x="7" y="28" width="6" height="3" rx="1.5" fill="#f8fafc" />
      <path
        d="M10 4c2 2.2 2 3.6 0 5-2-1.4-2-2.8 0-5Z"
        fill="#fbbf24"
        className="postal-llama"
      />
    </g>
  );
}

function Torta() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-28 w-28 shrink-0 drop-shadow-lg"
      role="img"
      aria-label="Tarta de cumpleaños con velas"
    >
      <rect x="10" y="36" width="44" height="14" rx="3" className="fill-[#8a5a3b]" />
      <rect x="16" y="32" width="32" height="6" rx="2" className="fill-[#f472b6]" />
      <rect x="10" y="28" width="44" height="6" rx="2" className="fill-[#fbbf24]" />
      {[16, 28, 40].map((x) => (
        <g key={x} transform={`translate(${x} -8)`}>
          <Vela color="#facc15" />
        </g>
      ))}
      <circle cx="22" cy="52" r="2" className="fill-[#22c55e]" />
      <circle cx="44" cy="52" r="2" className="fill-[#ef4444]" />
    </svg>
  );
}

export default function PostalCumpleanos({ cumple }: { cumple: Cumple[] }) {
  if (cumple.length === 0) return null;

  return (
    <section
      aria-labelledby="postal-cumpleanos-titulo"
      className="relative overflow-hidden rounded-3xl border border-white/20 shadow-2xl"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.1px), linear-gradient(135deg, #002b15, #004421 45%, #006633)",
        backgroundSize: "22px 22px, auto",
      }}
    >
      <Confeti />
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/15 blur-3xl" />

      <div className="relative px-6 py-10 text-center sm:px-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          Dirección de Recursos Humanos · CUJAE
        </span>

        <h2
          id="postal-cumpleanos-titulo"
          className="mt-6 text-3xl font-extrabold leading-tight text-white sm:text-4xl"
        >
          ¡Feliz cumpleaños!
        </h2>
        <p className="mt-2 text-sm text-emerald-100/90">
          Celebra con nosotros a quienes hoy suman un año de vida
        </p>

        <div className="mt-8 flex items-center justify-center gap-6">
          <Torta />
          <div className="text-start">
            {cumple.map((p, i) => (
              <div key={i} className={i > 0 ? "mt-3" : undefined}>
                <p className="text-base font-bold text-white">
                  {nombreBonito(p.Apellido_1)} {nombreBonito(p.Apellido_2)},{" "}
                  {nombreBonito(p.Nombre)}
                </p>
                <p className="mt-1 text-sm text-emerald-100/85">
                  {unidad(p.Desc_Direccion) || nombreBonito(p.Id_Direccion) || "CUJAE"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs tracking-wide text-emerald-100/70">
          Les deseamos un año lleno de éxitos, salud y alegrías
        </p>
      </div>

      <style>{`
        .postal-confeti-pieza {
          opacity: 0;
          animation-name: postal-confeti-caida;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes postal-confeti-caida {
          0% {
            transform: translateY(-16px) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translateY(460px) rotate(var(--giro));
            opacity: 0;
          }
        }
        @keyframes postal-llama-parpadeo {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(1.3) translateY(-1px); }
        }
        .postal-llama {
          transform-origin: 50% 100%;
          animation: postal-llama-parpadeo 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .postal-confeti-pieza,
          .postal-llama {
            animation: none !important;
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}