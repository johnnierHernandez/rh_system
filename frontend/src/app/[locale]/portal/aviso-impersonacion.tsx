"use client";

import { useState } from "react";

/**
 * Aviso de que la sesión está suplantada.
 *
 * Va fijo en pantalla y no se puede cerrar: si alguien abre el panel como otra
 * persona, quien esté mirando tiene que ver en todo momento que no es su
 * sesión, y ver siempre a quién pertenece la original.
 */
export default function AvisoImpersonacion({
  carnetOriginal,
}: {
  carnetOriginal: string;
}) {
  const [volviendo, setVolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const volver = async () => {
    setVolviendo(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/detener-impersonacion", { method: "POST" });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(cuerpo?.error ?? "No se pudo volver a la sesión original.");
        setVolviendo(false);
        return;
      }
      // Recarga completa: la cookie de sesión acaba de cambiar y el router
      // de Next puede servir la versión cacheada del panel, que corresponde
      // a la sesión suplantada.
      window.location.replace("/portal");
    } catch {
      setError("No se pudo contactar al servidor.");
      setVolviendo(false);
    }
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <span className="inline-flex items-center gap-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0"
        >
          <path
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Sesión suplantada —CS {carnetOriginal}—
      </span>

      <button
        type="button"
        onClick={volver}
        disabled={volviendo}
        className="rounded-md bg-amber-950 px-2.5 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-900 disabled:opacity-60"
      >
        {volviendo ? "Volviendo…" : "Volver a mi sesión"}
      </button>

      {error && <span className="text-xs font-semibold text-red-900">{error}</span>}
    </div>
  );
}
