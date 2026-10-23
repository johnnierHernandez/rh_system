"use client";

import { useEffect, useState } from "react";

/**
 * Avatar de un usuario del portal: intenta cargar la foto guardada en el
 * backend (JPEG del AD) y si no hay (o falla) se dibujan sus iniciales con un
 * gradiente derivado del nombre, como hace el sistema "viajes".
 *
 * La foto se obtiene del propio backend a través del proxy (misma cookie de
 * sesión), así que este componente solo funciona dentro del portal protegido.
 */
const CACHE_FOTOS = new Map<string, string>();

const COLORES_AVATAR = [
  "from-brand-500 to-brand-700",
  "from-blue-light-500 to-blue-light-700",
  "from-success-500 to-success-700",
  "from-orange-500 to-orange-700",
  "from-error-500 to-error-700",
  "from-gray-500 to-gray-700",
];

function colorPorHash(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) | 0;
  }
  return COLORES_AVATAR[Math.abs(h) % COLORES_AVATAR.length];
}

type Props = {
  carnet?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  className?: string;
  textClassName?: string;
};

export default function AvatarUsuario({
  carnet,
  nombre,
  apellidos,
  className = "h-10 w-10",
  textClassName = "text-sm",
}: Props) {
  const carnetLimpio = carnet?.trim();
  const clave = carnetLimpio ? `carnet:${carnetLimpio}` : "sin-carnet";
  const [foto, setFoto] = useState<string | undefined>(CACHE_FOTOS.get(clave));
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const cacheado = CACHE_FOTOS.get(clave);
    if (cacheado) {
      setFoto(cacheado);
      return;
    }
    let cancelado = false;
    setFallo(false);
    if (carnetLimpio) {
      (async () => {
        try {
          const res = await fetch(
            `/api/admin/usuarios/${encodeURIComponent(carnetLimpio)}/foto`,
            { cache: "no-store" },
          );
          if (!res.ok) throw new Error("sin foto");
          const blob = await res.blob();
          if (cancelado) return;
          const lector = new FileReader();
          lector.onload = () => {
            if (cancelado) return;
            const url = lector.result as string;
            CACHE_FOTOS.set(clave, url);
            setFoto(url);
          };
          lector.readAsDataURL(blob);
        } catch {
          if (!cancelado) setFallo(true);
        }
      })();
    } else {
      setFallo(true);
    }
    return () => {
      cancelado = true;
    };
  }, [clave, carnetLimpio]);

  const inicial = (
    nombre?.trim()?.[0] ?? apellidos?.trim()?.[0] ?? carnetLimpio?.[0] ?? "?"
  ).toUpperCase();
  const color = colorPorHash(nombre?.trim() || carnetLimpio || "?");

  if (foto && !fallo) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm ring-2 ring-white/20 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto}
          alt={`Foto de ${nombre ?? "usuario"}`}
          className="h-full w-full object-cover"
          onError={() => setFallo(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} font-semibold text-white shadow-sm ring-2 ring-white/20 ${className} ${textClassName}`}
    >
      {inicial}
    </span>
  );
}