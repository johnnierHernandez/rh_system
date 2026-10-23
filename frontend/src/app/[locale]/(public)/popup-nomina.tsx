"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Aviso de la home pública: invita a iniciar sesión para ver la nómina
 * personal. No pide datos ni promete nada que no exista: el destino es
 * `/portal/mi-nomina`, que exige sesión.
 *
 * Se muestra una vez por sesión y, si la persona lo pide, se silencia durante
 * 30 días. El disparo es el primero de estos dos: 10 segundos en la página o
 * 45 % de scroll. Entra deslizándose desde el borde derecho y se detiene en el
 * centro, para que el aviso se sienta como un panel y no como un bloque que
 * aparece de golpe.
 */

const CLAVE_SESION = "rh_popup_nomina_visto";
const CLAVE_SILENCIO = "rh_popup_nomina_silencio";
const ESPERA_MS = 10_000;
const SCROLL = 0.45;
const SILENCIO_MS = 30 * 24 * 60 * 60 * 1000;
const SALIDA_MS = 500;

const DESTINO = "/login?next=%2Fportal%2Fmi-nomina";

function Candado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7a4 4 0 1 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Calendario() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3v4M16 3v4M3 10h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PopupNomina() {
  const [abierto, setAbierto] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const origenRef = useRef<HTMLElement | null>(null);
  const cierreRef = useRef<number | null>(null);

  // Programa el aviso: 10 s o 45 % de scroll, lo que ocurra primero.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const silencioHasta = Number(
        window.localStorage.getItem(CLAVE_SILENCIO) ?? "0",
      );
      if (Number.isFinite(silencioHasta) && silencioHasta > Date.now()) return;
      if (window.sessionStorage.getItem(CLAVE_SESION)) return;
    } catch {
      // Con el almacenamiento bloqueado se muestra igual: el aviso es
      // informativo y no depende de la cookie de sesión.
    }

    let mostrado = false;
    const abrir = () => {
      if (mostrado) return;
      mostrado = true;
      try {
        window.sessionStorage.setItem(CLAVE_SESION, "1");
      } catch {
        // Sin sessionStorage se mostrará otra vez en la próxima visita.
      }
      origenRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setAbierto(true);
    };

    const temporizador = window.setTimeout(abrir, ESPERA_MS);
    const alDesplazar = () => {
      const recorrido = window.scrollY + window.innerHeight;
      const alto = document.documentElement.scrollHeight;
      if (alto > 0 && recorrido / alto >= SCROLL) abrir();
    };

    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("scroll", alDesplazar);
    };
  }, []);

  // Bloquea el scroll de fondo, anima la entrada y lleva el foco al diálogo.
  useEffect(() => {
    if (!abierto) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let raf2 = 0;
    const raf = window.requestAnimationFrame(() => {
      // Dos frames: el primero pinta el estado inicial (fuera de pantalla) y
      // el segundo dispara la transición hacia el centro.
      raf2 = window.requestAnimationFrame(() => setVisible(true));
    });
    const foco = window.setTimeout(() => panelRef.current?.focus(), 80);

    return () => {
      document.body.style.overflow = overflowPrevio;
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(foco);
    };
  }, [abierto]);

  const cerrar = useCallback((silenciar = false) => {
    if (silenciar) {
      try {
        window.localStorage.setItem(
          CLAVE_SILENCIO,
          String(Date.now() + SILENCIO_MS),
        );
      } catch {
        // Si no se puede guardar, al menos se cierra en esta visita.
      }
    }
    setVisible(false);

    // Se deja montado mientras dura la salida hacia la derecha; después se
    // desmonta y se devuelve el foco a donde estaba.
    if (cierreRef.current !== null) window.clearTimeout(cierreRef.current);
    cierreRef.current = window.setTimeout(() => {
      setAbierto(false);
      cierreRef.current = null;
      origenRef.current?.focus?.();
    }, SALIDA_MS);
  }, []);

  useEffect(
    () => () => {
      if (cierreRef.current !== null) window.clearTimeout(cierreRef.current);
    },
    [],
  );

  // Esc cierra y Tab queda atrapado dentro del diálogo.
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focos = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focos.length === 0) return;

      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      const activo = document.activeElement;

      if (e.shiftKey && (activo === primero || activo === panel)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto, cerrar]);

  if (!abierto) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none sm:p-4 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-nomina-titulo"
        aria-describedby="popup-nomina-descripcion"
        tabIndex={-1}
        className={`relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5 outline-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none dark:bg-gray-900 dark:ring-white/10 ${
          visible
            ? "translate-x-0 scale-100 opacity-100"
            : "translate-x-[calc(50vw_+_50%_+_2rem)] scale-[0.97] opacity-0 motion-reduce:translate-x-0"
        }`}
      >
        <button
          type="button"
          onClick={() => cerrar()}
          aria-label="Cerrar aviso"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="bg-gradient-to-br from-[#00331a] via-[#006633] to-[#005529] px-6 pb-7 pt-8 text-white sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#c9e9da] uppercase ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Nómina personal
          </span>
          <h2
            id="popup-nomina-titulo"
            className="mt-3 max-w-sm text-2xl leading-tight font-bold"
          >
            ¿Sabes cuánto has cobrado este mes?
          </h2>
          <p
            id="popup-nomina-descripcion"
            className="mt-2 max-w-md text-sm leading-relaxed text-[#c9e9da]"
          >
            Si eres trabajador de la CUJAE, inicia sesión para ver tus salarios,
            tus vacaciones y los días que te han pagado. Es tu información y
            solo tú puedes verla.
          </p>
        </div>

        <div className="px-6 pt-5 pb-6 sm:px-8">
          <div className="grid grid-cols-3 gap-2">
            {[
              { etiqueta: "Último salario", valor: "•••• CUP" },
              { etiqueta: "Vacaciones", valor: "•• días" },
              { etiqueta: "Días pagados", valor: "•• días" },
            ].map((dato) => (
              <div
                key={dato.etiqueta}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-white/5"
              >
                <span className="flex items-center gap-1 text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                  <Candado />
                  {dato.etiqueta}
                </span>
                <p className="mt-1 text-sm font-semibold text-gray-700 tabular-nums dark:text-gray-200">
                  {dato.valor}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            <Calendario />
            <p>
              <strong className="font-semibold">
                El pago se efectúa al mes siguiente
              </strong>{" "}
              del período que trabajaste.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={DESTINO}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#006633] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005529] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006633] focus-visible:ring-offset-2"
            >
              Iniciar sesión
            </Link>
            <button
              type="button"
              onClick={() => cerrar()}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006633] focus-visible:ring-offset-2 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Ahora no
            </button>
          </div>

          <button
            type="button"
            onClick={() => cerrar(true)}
            className="mt-3 w-full text-center text-xs text-gray-500 underline-offset-2 transition hover:text-[#006633] hover:underline dark:text-gray-400 dark:hover:text-brand-400"
          >
            No volver a mostrar en 30 días
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
