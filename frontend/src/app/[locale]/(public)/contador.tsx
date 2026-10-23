"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Número que cuenta desde 0 cuando entra en pantalla.
 * Respeta prefers-reduced-motion y siempre renderiza el valor final
 * en el HTML del servidor (sin JS y antes del scroll se ve correcto).
 */
export default function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(valor);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const animar = () => {
      const duracion = 900;
      const inicio = performance.now();
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / duracion);
        setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(paso);
      };
      setN(0);
      frame = requestAnimationFrame(paso);
    };

    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          obs.disconnect();
          animar();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [valor]);

  return (
    <span ref={ref} className={className}>
      {fmt(n)}
    </span>
  );
}
