"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Traduce el fallo del servidor a un mensaje que sirva para algo.
 *
 * Ojo con `401` y `404`: el backend responde distinto cuando el usuario no
 * existe en el directorio y cuando la clave está mal. Se muestran igual a
 * propósito, porque distinguirlos dejaría un formulario donde se pueden ir
 * probando usuarios hasta dar con uno válido.
 */
function mensajeDeError(status: number, detalle?: string): string {
  switch (status) {
    case 400:
      return "Revisa lo que escribiste: faltan el usuario o la contraseña.";
    case 401:
    case 404:
      return "Usuario de internet o contraseña incorrectos.";
    case 403:
      return (
        detalle?.trim() ||
        "Tu cuenta está desactivada. Comunícate con la Dirección de Recursos Humanos."
      );
    case 429:
      return "Demasiados intentos seguidos. Espera un momento antes de volver a probar.";
    case 503:
      return "El directorio de la universidad no responde en este momento. Inténtalo más tarde.";
    default:
      return detalle?.trim()
        ? detalle
        : "No se pudo iniciar sesión. Inténtalo otra vez.";
  }
}

export default function LoginForm({ destino }: { destino: string }) {
    const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refUsuario = useRef<HTMLInputElement>(null);

  // Si el servidor devuelve un error de validación, el foco vuelve al campo
  // para que quien escribe no tenga que buscar dónde está el problema.
  useEffect(() => {
    if (error) refUsuario.current?.focus();
  }, [error]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const usuarioLimpio = usuario.trim();

    // Comprobación local para no gastar un viaje al servidor: el campo vacío
    // casi siempre es un despiste, no un problema de credenciales.
    if (!usuarioLimpio || !clave) {
      setError("Escribe tu usuario de internet y tu contraseña.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: usuarioLimpio, clave }),
      });
      const cuerpo = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(mensajeDeError(res.status, cuerpo?.error ?? cuerpo?.detail));
        // La clave se borra siempre tras un intento: si falló, casi siempre
        // estaba mal, y no conviene dejarla escrita a la vista.
        setClave("");
        return;
      }

      // Recarga completa, no navegación del router de Next.
      //
      // La cookie de sesión es httpOnly: la pone la respuesta de
      // `/api/auth/login` y el navegador ya la tiene guardada. El problema es
      // que `router.replace` + `router.refresh` se pisan entre sí: el
      // `refresh` se aplica a la ruta anterior (el login) y no invalida la
      // entrada cacheada de `/portal`, que en el primer intento era una
      // redirección a `/login`. El resultado es quedarse en el formulario
      // hasta que el usuario recarga a mano.
      //
      // Con `window.location.replace` el servidor evalúa el middleware con la
      // cookie nueva y entra directo al panel. Además, `replace` no deja el
      // login en el historial: el botón "atrás" no vuelve al formulario.
      window.location.replace(destino);
      return;
    } catch {
      setError("No se pudo contactar al servidor. Revisa tu conexión.");
      setClave("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={entrar} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[#374151]">
        Usuario de internet
        <input
          ref={refUsuario}
          type="text"
          name="identificador"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ej. jperez"
          required
          autoFocus
          disabled={enviando}
          className="rounded-xl border border-gray-300 bg-white/70 px-4 py-2.5 text-[#1a1a1a] transition placeholder:text-gray-400 focus:border-[#006633] focus:ring-4 focus:ring-[#006633]/15 focus:outline-none disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-[#374151]">
        Contraseña
        <span className="relative">
          <input
            type={mostrarClave ? "text" : "password"}
            name="clave"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={enviando}
            className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-2.5 pr-12 text-[#1a1a1a] transition placeholder:text-gray-400 focus:border-[#006633] focus:ring-4 focus:ring-[#006633]/15 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setMostrarClave((v) => !v)}
            aria-label={mostrarClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={mostrarClave}
            disabled={enviando}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition hover:text-[#006633] focus:outline-none disabled:opacity-60"
          >
            {mostrarClave ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2.75 12S7 4.75 12 4.75 21.25 12 21.25 12 17 19.25 12 19.25 2.75 12 2.75 12Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.75 12a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m4 4 16 16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2.75 12S7 4.75 12 4.75 21.25 12 21.25 12 17 19.25 12 19.25 2.75 12 2.75 12Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.25"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            )}
          </button>
        </span>
      </label>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="mt-0.5 shrink-0"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 8v4.5M12 16h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#006633] px-4 py-3 font-semibold text-white shadow-lg shadow-[#006633]/25 transition hover:bg-[#005529] hover:shadow-[#005529]/30 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Iniciando sesión…
          </>
        ) : (
          "Iniciar sesión"
        )}
      </button>
    </form>
  );
}
