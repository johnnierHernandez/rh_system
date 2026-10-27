"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AvatarUsuario from "@/components/usuarios/avatar-usuario";
import Badge from "@/components/ui/badge/Badge";
import CuadrosImportador from "./cuadros-importador";

/** Persona tal como la devuelve la búsqueda en el AD (aún sin importar). */
type Persona = {
  carnet_identidad: string | null;
  usuario_internet: string | null;
  nombre: string | null;
  apellidos: string | null;
  email_institucional: string | null;
  area: string | null;
  departamento: string | null;
  es_estudiante: boolean;
  tiene_foto: boolean;
};

/** Fila de la tabla de usuarios del portal, con sus perfiles. */
type Usuario = Persona & {
  activo: boolean;
  perfiles: string[];
  perfiles_inactivos: string[] | null;
  perfil_activo: string | null;
  creado: string | null;
  actualizado: string | null;
};

type PerfilCatalogo = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  activo: boolean;
};

const PERFIL_INVITADO = "invitado";
const POR_PAGINA = 12;

function _normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Editor de perfiles de un usuario, en el propio card y con un clic.
 *
 * Replica el que usa el sistema "viajes": cada perfil asignado es una píldora
 * que se activa/desactiva pulsándola (la asignación no se pierde) y que se
 * quita con la ✕; los perfiles disponibles se agregan desde el selector.
 * Agregar y quitar se resuelven con el mismo endpoint de "reemplazar perfiles"
 * del backend, que ya se encarga de la coherencia y de las salvaguardas del
 * superadministrador.
 */
function PerfilesEditor({
  u,
  perfiles,
  ocupado,
  onActualizado,
  onError,
}: {
  u: Usuario;
  perfiles: PerfilCatalogo[];
  ocupado: boolean;
  onActualizado: (nuevo: Usuario) => void;
  onError: (msg: string) => void;
}) {
  const [agregar, setAgregar] = useState("");
  const disponibles = perfiles.filter(
    (p) => p.activo && !(u.perfiles ?? []).includes(p.codigo),
  );
  const nombrePerfil = (codigo: string) =>
    perfiles.find((p) => p.codigo === codigo)?.nombre ?? codigo;

  async function reemplazar(nuevos: string[]) {
    const res = await fetch(
      `/api/admin/usuarios/${encodeURIComponent(u.carnet_identidad ?? "")}/perfiles`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfiles: nuevos }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => ({}));
      throw new Error(cuerpo?.detail ?? "No se pudieron guardar los perfiles");
    }
    return (await res.json()) as Usuario;
  }

  async function alternar(codigo: string, activo: boolean) {
    try {
      const res = await fetch(
        `/api/admin/usuarios/${encodeURIComponent(u.carnet_identidad ?? "")}/perfiles/${codigo}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo }),
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new Error(cuerpo?.detail ?? "No se pudo cambiar el perfil");
      }
      onActualizado((await res.json()) as Usuario);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cambiar el perfil");
    }
  }

  async function quitar(codigo: string) {
    if (!confirm(`¿Quitar el perfil «${nombrePerfil(codigo)}»?`)) return;
    try {
      onActualizado(await reemplazar((u.perfiles ?? []).filter((p) => p !== codigo)));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al quitar el perfil");
    }
  }

  async function agregarPerfil(codigo: string) {
    if (!codigo) return;
    try {
      onActualizado(await reemplazar([...new Set([...(u.perfiles ?? []), codigo])]));
      setAgregar("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al agregar el perfil");
    }
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        Perfiles asignados
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {(u.perfiles ?? []).map((p) => {
          const activo = !(u.perfiles_inactivos ?? []).includes(p);
          return (
            <span
              key={p}
              className={`flex items-center gap-1 rounded-full py-1 pl-2 pr-1 text-xs font-medium ${
                activo
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  : "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"
              }`}
            >
              <button
                type="button"
                onClick={() => alternar(p, !activo)}
                disabled={ocupado}
                title={activo ? "Desactivar perfil" : "Activar perfil"}
                className={`flex items-center gap-1.5 transition hover:opacity-70 ${
                  activo ? "" : "line-through"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    activo ? "bg-brand-500 dark:bg-brand-300" : "bg-gray-400"
                  }`}
                />
                {nombrePerfil(p)}
              </button>
              <button
                type="button"
                onClick={() => quitar(p)}
                disabled={ocupado}
                title="Quitar perfil"
                className="rounded-full px-1 font-bold transition hover:bg-white/60 hover:text-red-600 disabled:opacity-40 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </span>
          );
        })}
        {(u.perfiles ?? []).length === 0 && (
          <span className="text-xs text-gray-400">Sin perfiles</span>
        )}
      </div>
      {disponibles.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select
            value={agregar}
            onChange={(e) => setAgregar(e.target.value)}
            disabled={ocupado}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">— Agregar perfil —</option>
            {disponibles.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => agregarPerfil(agregar)}
            disabled={!agregar || ocupado}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

export default function UsuariosExplorer() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilCatalogo[]>([]);
  const [perfilImport, setPerfilImport] = useState<string>(PERFIL_INVITADO);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lote, setLote] = useState("");
  const [importandoLote, setImportandoLote] = useState(false);
  const [perfilLote, setPerfilLote] = useState<string>(PERFIL_INVITADO);
  const [resumenLote, setResumenLote] = useState<string | null>(null);
  const [erroresLote, setErroresLote] = useState<
    { identificador: string; motivo: string }[]
  >([]);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const todos: Usuario[] = [];
      const TAM = 500;
      let offset = 0;
      for (;;) {
        const res = await fetch(`/api/admin/usuarios?limit=${TAM}&offset=${offset}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("No se pudieron cargar los usuarios");
        const pagina = (await res.json()) as Usuario[];
        todos.push(...pagina);
        if (pagina.length < TAM) break;
        offset += TAM;
      }
      setUsuarios(todos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarPerfiles = useCallback(async () => {
    const res = await fetch("/api/admin/perfiles", { cache: "no-store" });
    setPerfiles(res.ok ? ((await res.json()) as PerfilCatalogo[]) : []);
  }, []);

  useEffect(() => {
    cargarUsuarios();
    cargarPerfiles();
  }, [cargarUsuarios, cargarPerfiles]);

  const nombrePerfil = useCallback(
    (codigo: string) => perfiles.find((p) => p.codigo === codigo)?.nombre ?? codigo,
    [perfiles],
  );

  const filtrados = useMemo(() => {
    const s = _normalizar(busqueda);
    if (!s) return usuarios;
    return usuarios.filter((u) =>
      [u.carnet_identidad, u.usuario_internet, u.nombre, u.apellidos, u.email_institucional]
        .filter(Boolean)
        .some((campo) => _normalizar(campo as string).includes(s)),
    );
  }, [usuarios, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  const buscar = async () => {
    const identificador = q.trim();
    if (!identificador) return;
    setBuscando(true);
    setError(null);
    setPersona(null);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/admin/ldap/buscar?q=${encodeURIComponent(identificador)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        setPersona((await res.json()) as Persona);
      } else if (res.status === 404) {
        setError("No se encontró ninguna persona con ese identificador.");
      } else if (res.status === 503) {
        setError("El directorio LDAP no está disponible. Intente más tarde.");
      } else {
        setError("Error de comunicación con el servidor.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBuscando(false);
    }
  };

  const importar = async () => {
    if (!persona) return;
    setImportando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/usuarios/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: q.trim(), perfil: perfilImport }),
        cache: "no-store",
      });
      if (res.ok) {
        setMensaje(
          `${persona.nombre ?? ""} ${persona.apellidos ?? ""} importado con el perfil ` +
            `«${nombrePerfil(perfilImport)}».`,
        );
        await cargarUsuarios();
      } else {
        const detalle = await res.text();
        setError(detalle || "No se pudo importar el usuario.");
      }
    } catch {
      setError("No se pudo importar el usuario.");
    } finally {
      setImportando(false);
    }
  };

  const importarLote = async () => {
    const lista = lote
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lista.length === 0 || importandoLote) return;
    setImportandoLote(true);
    setError(null);
    setResumenLote(null);
    setErroresLote([]);
    try {
      const res = await fetch("/api/admin/usuarios/importar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificadores: lista, perfil: perfilLote }),
        cache: "no-store",
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (res.ok) {
        setResumenLote(cuerpo?.resumen ?? "Importación completada.");
        setErroresLote(cuerpo?.errores ?? []);
        if (cuerpo?.importados > 0) await cargarUsuarios();
        setLote("");
      } else {
        setError(cuerpo?.detail ?? "No se pudo importar la lista.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setImportandoLote(false);
    }
  };

  function reemplazarUsuario(nuevo: Usuario) {
    setUsuarios((prev) =>
      prev.map((x) => (x.carnet_identidad === nuevo.carnet_identidad ? nuevo : x)),
    );
  }

  const cambiarAcceso = async (u: Usuario, activo: boolean) => {
    setOcupado(u.carnet_identidad ?? "");
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/admin/usuarios/${encodeURIComponent(u.carnet_identidad ?? "")}/activo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo }),
          cache: "no-store",
        },
      );
      if (res.ok) {
        setMensaje(activo ? "Acceso restablecido." : "Acceso suspendido.");
        reemplazarUsuario((await res.json()) as Usuario);
      } else {
        const cuerpo = await res.json().catch(() => ({}));
        setError(cuerpo?.detail ?? "No se pudo cambiar el acceso.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setOcupado(null);
    }
  };

  const suplantar = async (carnet: string) => {
    setOcupado(carnet);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/auth/impersonar/${encodeURIComponent(carnet)}`, {
        method: "POST",
        cache: "no-store",
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/portal");
        router.refresh();
        return;
      }
      setError(cuerpo?.error ?? cuerpo?.detail ?? "No se pudo abrir su sesión.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (u: Usuario) => {
    const nombre = `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim() || u.carnet_identidad;
    if (!confirm(`¿Eliminar a ${nombre} del portal?`)) return;
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/admin/usuarios/${encodeURIComponent(u.carnet_identidad ?? "")}`,
        { method: "DELETE", cache: "no-store" },
      );
      if (res.ok) {
        setMensaje("Usuario eliminado.");
        setUsuarios((prev) =>
          prev.filter((x) => x.carnet_identidad !== u.carnet_identidad),
        );
      } else {
        const cuerpo = await res.json().catch(() => ({}));
        setError(cuerpo?.detail ?? "No se pudo eliminar el usuario.");
      }
    } catch {
      setError("No se pudo eliminar el usuario.");
    }
  };

  const perfilUrl = (carnet: string | null, usuario: string | null) =>
    `/portal/usuarios/${encodeURIComponent(carnet ?? usuario ?? "")}`;

  return (
    <div className="space-y-6">
      {/* Búsqueda en LDAP */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Importar desde LDAP
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Busca a la persona en el directorio (por usuario de internet o, si quieres, por
          carné) y decide con qué perfil entra al portal. Puedes repetir la importación
          para corregir sus datos o cambiarle el perfil.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Usuario de internet o carné"
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:max-w-sm"
          />
          <button
            onClick={buscar}
            disabled={buscando || !q.trim()}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buscando ? "Buscando…" : "Buscar en LDAP"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        {mensaje && (
          <p className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
            {mensaje}
          </p>
        )}

        {persona && (
          <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                  {persona.nombre} {persona.apellidos}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {persona.es_estudiante && <Badge color="primary">Estudiante</Badge>}
                  {persona.tiene_foto && <Badge color="success">Con foto</Badge>}
                </div>
                <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <Field label="Carné" value={persona.carnet_identidad} />
                  <Field label="Usuario" value={persona.usuario_internet} />
                  <Field label="Correo" value={persona.email_institucional} />
                  <Field label="Área" value={persona.area} />
                  <Field
                    label="Departamento"
                    value={persona.departamento}
                    full
                  />
                </dl>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:shrink-0">
                <label className="sm:text-right">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                    Perfil
                  </span>
                  <select
                    value={perfilImport}
                    onChange={(e) => setPerfilImport(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:w-56"
                  >
                    {perfiles
                      .filter((p) => p.activo)
                      .map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.nombre}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  onClick={importar}
                  disabled={importando}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  {importando ? "Importando…" : "Importar al portal"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Importación masiva */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Importar en lote
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pega varios carnés de identidad o usuarios de internet separados por
          coma, punto y coma o línea. Se buscan todos en el directorio en una
          sola consulta y se importan de una vez.
        </p>
        <textarea
          value={lote}
          onChange={(e) => setLote(e.target.value)}
          rows={4}
          placeholder={"ej.\n84052425840\njperez\nmrodriguez, anunez"}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="sm:w-56">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              Perfil por defecto
            </span>
            <select
              value={perfilLote}
              onChange={(e) => setPerfilLote(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {perfiles
                .filter((p) => p.activo)
                .map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </label>
          <button
            onClick={importarLote}
            disabled={importandoLote || !lote.trim()}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importandoLote ? "Importando…" : "Importar en lote"}
          </button>
        </div>

        {resumenLote && (
          <p className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
            {resumenLote}
          </p>
        )}
        {erroresLote.length > 0 && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              No se pudieron importar:
            </p>
            <ul className="mt-1.5 space-y-1">
              {erroresLote.map((e, i) => (
                <li key={i} className="text-sm text-red-600 dark:text-red-400">
                  <span className="font-mono">{e.identificador}</span>
                  <span className="text-red-500 dark:text-red-400/70"> — {e.motivo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Importación de cuadros + jefes de área */}
      <CuadrosImportador />

      {/* Usuarios importados */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por carné, usuario, nombre, correo…"
            className="w-full max-w-md rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>
        {!cargando && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtrados.length === usuarios.length
              ? `${usuarios.length} usuarios`
              : `${filtrados.length} de ${usuarios.length} usuarios`}
          </p>
        )}
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3"
            />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-white/3">
          {busqueda
            ? `Sin resultados para «${busqueda}».`
            : "No hay usuarios registrados."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((u) => (
              <div
                key={u.carnet_identidad ?? u.usuario_internet}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-200 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AvatarUsuario
                      carnet={u.carnet_identidad}
                      nombre={u.nombre}
                      apellidos={u.apellidos}
                      className="h-11 w-11"
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-gray-800 dark:text-white/90">
                        <Link
                          href={perfilUrl(u.carnet_identidad, u.usuario_internet)}
                          className="truncate font-medium transition hover:text-brand-600 dark:hover:text-brand-300"
                          title="Ver perfil de este usuario"
                        >
                          {u.nombre} {u.apellidos}
                        </Link>
                      </p>
                      <p className="max-w-44 truncate text-xs text-gray-500 dark:text-gray-400">
                        {u.carnet_identidad}
                      </p>
                      {u.usuario_internet && (
                        <p className="max-w-44 truncate text-xs text-gray-500 dark:text-gray-400">
                          @{u.usuario_internet}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => cambiarAcceso(u, !u.activo)}
                    disabled={ocupado === u.carnet_identidad}
                    title="Cambiar acceso al portal"
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                      u.activo
                        ? "bg-success-50 text-success-600 hover:bg-success-100 dark:bg-success-500/15 dark:text-success-400"
                        : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400"
                    }`}
                  >
                    <span
                      className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                        u.activo ? "bg-success-500" : "bg-red-500"
                      }`}
                    />
                    {u.activo ? "Activo" : "Suspendido"}
                  </button>
                </div>

                <dl className="mt-4 flex flex-col gap-2.5 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Correo</dt>
                    <dd className="min-w-0 break-all text-right text-gray-700 dark:text-gray-300">
                      {u.email_institucional ?? "—"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Área</dt>
                    <dd className="min-w-0 break-all text-right text-gray-700 dark:text-gray-300">
                      {u.area ?? "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Tipo</dt>
                    <dd>
                      {u.es_estudiante ? (
                        <Badge color="primary">Estudiante</Badge>
                      ) : (
                        <Badge color="success">Trabajador</Badge>
                      )}
                    </dd>
                  </div>
                </dl>

                <PerfilesEditor
                  u={u}
                  perfiles={perfiles}
                  ocupado={ocupado === u.carnet_identidad}
                  onActualizado={reemplazarUsuario}
                  onError={setError}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <Link
                    href={perfilUrl(u.carnet_identidad, u.usuario_internet)}
                    title="Ver la ficha del usuario"
                    className="rounded-lg border border-brand-200 px-3 py-2 text-xs font-medium text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    Perfil
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => suplantar(u.carnet_identidad ?? "")}
                      disabled={ocupado === u.carnet_identidad || !u.activo}
                      title="Abrir el panel como esta persona para comprobar su experiencia"
                      className="rounded-lg border border-brand-200 px-3 py-2 text-xs font-medium text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-40 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    >
                      {ocupado === u.carnet_identidad ? "…" : "Impersonar"}
                    </button>
                    <button
                      onClick={() => eliminar(u)}
                      disabled={ocupado === u.carnet_identidad}
                      title="Eliminar usuario del portal"
                      className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {paginaActual} de {totalPaginas}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => setPagina(1)}
                  disabled={paginaActual === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300"
                >
                  « Primera
                </button>
                <button
                  onClick={() => setPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setPagina(totalPaginas)}
                  disabled={paginaActual === totalPaginas}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300"
                >
                  Última »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-700 dark:text-gray-300">{value ?? "—"}</dd>
    </div>
  );
}