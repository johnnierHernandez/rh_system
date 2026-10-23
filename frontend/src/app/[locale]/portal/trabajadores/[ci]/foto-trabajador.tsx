"use client";

import { useState } from "react";

/**
 * Foto del trabajador desde `/api/trabajadores/{ci}/foto` (jpegPhoto del AD).
 * Mientras carga muestra las iniciales; si no tiene foto (404), las conserva.
 */
export default function FotoTrabajador({
  ci,
  iniciales,
  className = "",
  textClassName = "text-xl",
}: {
  ci: string;
  iniciales: string;
  className?: string;
  textClassName?: string;
}) {
  const [estado, setEstado] = useState<"cargando" | "ok" | "fallo">("cargando");

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 ${className}`}
    >
      <span className={`font-bold ${textClassName}`}>{iniciales}</span>
      {estado !== "fallo" && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/api/trabajadores/${encodeURIComponent(ci)}/foto`}
          alt=""
          onLoad={() => setEstado("ok")}
          onError={() => setEstado("fallo")}
          className={
            estado === "ok" ? "h-full w-full object-cover" : "hidden"
          }
        />
      )}
    </div>
  );
}