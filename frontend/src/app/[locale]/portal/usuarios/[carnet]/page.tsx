"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AvatarUsuario from "@/components/usuarios/avatar-usuario";
import Badge from "@/components/ui/badge/Badge";

type Usuario = {
  carnet_identidad: string | null;
  usuario_internet: string | null;
  nombre: string | null;
  apellidos: string | null;
  email_institucional: string | null;
  area: string | null;
  departamento: string | null;
  es_estudiante: boolean;
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
  prioridad: number;
  activo: boolean;
};

type Trabajador = {
  Id_Expediente: string | null;
  No_CI: string | null;
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Direccion: string | null;
  Id_Cargo: string | null;
  Sexo: string | null;
  Docente: boolean | null;
  Investigador: boolean | null;
  Fecha_Contratacion: string | null;
  Fecha_Baja: string | null;
};

type Area = {
  Id_Direccion: string;
  Desc_Direccion: string;
};

const PERMISO_LABEL: Record<string, string> = {
  "usuarios.administrar": "Gestionar usuarios y perfiles",
  "sesiones.impersonar": "Entrar como otro usuario",
  "negocio.ver": "Consultar datos de negocio",
  "negocio.gestionar": "Crear y modificar datos de negocio",
};

function fechaCorta(fecha?: string | null) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

// Carné cubano: los 6 primeros dígitos = YYMMDD (año, mes, día de nacimiento).
function fechaDesdeCarnet(carnet?: string | null): string | null {
  const solo = (carnet ?? "").replace(/[^\d]/g, "");
  const m = solo.match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const anio = Number(yy) <= new Date().getFullYear() % 100 ? 2000 + Number(yy) : 1900 + Number(yy);
  return `${anio}-${mm}-${dd}`;
}

function edadDesdeFecha(fecha?: string | null): number | null {
  if (!fecha) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  if ([y, m, d].some(Number.isNaN)) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad >= 0 && edad <= 120 ? edad : null;
}

function Icono({
  children,
  className = "h-4 w-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor?: unknown }) {
  const texto = typeof valor === "string" && valor.trim() ? valor : undefined;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-gray-700 dark:text-gray-300">
        {texto ?? "—"}
      </dd>
    </div>
  );
}

export default function PerfilUsuarioPage() {
  const { carnet } = useParams<{ carnet: string }>();
  const carnetLimpio = decodeURIComponent(carnet);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilesCat, setPerfilesCat] = useState<PerfilCatalogo[]>([]);
  const [vinculos, setVinculos] = useState<Trabajador[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!carnetLimpio) return;
    setCargando(true);
    setError(null);
    try {
      const [uRes, pRes, tRes, aRes] = await Promise.all([
        fetch(`/api/admin/usuarios/${encodeURIComponent(carnetLimpio)}`, {
          cache: "no-store",
        }),
        fetch("/api/admin/perfiles", { cache: "no-store" }),
        fetch(`/api/trabajadores?q=${encodeURIComponent(carnetLimpio)}&limit=500`, {
          cache: "no-store",
        }),
        fetch("/api/areas", { cache: "no-store" }),
      ]);
      if (!uRes.ok) throw new Error("Usuario no encontrado en el portal");
      setUsuario((await uRes.json()) as Usuario);
      setPerfilesCat(pRes.ok ? ((await pRes.json()) as PerfilCatalogo[]) : []);
      const trabajadores: Trabajador[] = tRes.ok ? await tRes.json() : [];
      setVinculos(
        trabajadores.filter(
          (t) => t.No_CI?.trim() === carnetLimpio.trim() || t.No_CI === carnetLimpio,
        ),
      );
      setAreas(aRes.ok ? ((await aRes.json()) as Area[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil");
    } finally {
      setCargando(false);
    }
  }, [carnetLimpio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombrePerfil = useCallback(
    (codigo: string) => perfilesCat.find((p) => p.codigo === codigo)?.nombre ?? codigo,
    [perfilesCat],
  );

  const nombreArea = useCallback(
    (codigo: string | null) =>
      areas.find((a) => a.Id_Direccion === codigo)?.Desc_Direccion ?? codigo ?? "—",
    [areas],
  );

  const perfilesDetalle = useMemo(() => {
    const det = (usuario?.perfiles ?? []).map((codigo) => {
      const cat = perfilesCat.find((p) => p.codigo === codigo);
      return {
        codigo,
        nombre: cat?.nombre ?? codigo,
        descripcion: cat?.descripcion ?? null,
        permisos: cat?.permisos ?? [],
      };
    });
    return det.sort((a, b) => {
      const pa = perfilesCat.find((p) => p.codigo === a.codigo)?.prioridad ?? 0;
      const pb = perfilesCat.find((p) => p.codigo === b.codigo)?.prioridad ?? 0;
      return pb - pa;
    });
  }, [usuario, perfilesCat]);

  if (cargando && !usuario) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-28 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3" />
        <div className="h-64 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3" />
      </div>
    );
  }

  if (error && !usuario) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
        <Link
          href="/portal/usuarios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline"
        >
          <Icono className="h-3.5 w-3.5">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </Icono>{" "}
        Usuarios
        </Link>
      </div>
    );
  }

  if (!usuario) return null;

  const nombreCompleto = [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ");
  const edad = edadDesdeFecha(fechaDesdeCarnet(usuario.carnet_identidad));
  const inactivo = (p: string) => (usuario.perfiles_inactivos ?? []).includes(p);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/portal/usuarios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-gray-400"
        >
          <Icono className="h-3.5 w-3.5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </Icono>{" "}
          Usuarios
        </Link>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400">
          Vista de solo lectura
        </span>
      </div>

      <header className="flex flex-wrap items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/3">
        <AvatarUsuario
          carnet={usuario.carnet_identidad}
          nombre={usuario.nombre}
          apellidos={usuario.apellidos}
          className="h-20 w-20"
          textClassName="text-3xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {nombreCompleto}
            </h1>
            {usuario.activo ? (
              <Badge color="success">Activo</Badge>
            ) : (
              <Badge color="error">Suspendido</Badge>
            )}
            {usuario.es_estudiante ? (
              <Badge color="primary">Estudiante</Badge>
            ) : (
              <Badge color="success">Trabajador</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {usuario.area || "<sin área en el AD>"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium dark:bg-white/5">
              Carné {usuario.carnet_identidad}
            </span>
            {edad != null && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium dark:bg-white/5">
                {edad} años
              </span>
            )}
            {usuario.usuario_internet && (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium dark:bg-white/5">
                <Icono className="h-3.5 w-3.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </Icono>{" "}
                {usuario.usuario_internet}
              </span>
            )}
            {usuario.email_institucional && (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium dark:bg-white/5">
                <Icono className="h-3.5 w-3.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </Icono>{" "}
                {usuario.email_institucional}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-2 border-b border-gray-100 pb-2 font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">
              Cuenta del portal
            </h2>
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <Campo etiqueta="Estado" valor={usuario.activo ? "Activo" : "Suspendido"} />
              <Campo
                etiqueta="Perfil activo"
                valor={usuario.perfil_activo ? nombrePerfil(usuario.perfil_activo) : "—"}
              />
              <Campo etiqueta="Registrado" valor={fechaCorta(usuario.creado)} />
              <Campo etiqueta="Actualizado" valor={fechaCorta(usuario.actualizado)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-2 border-b border-gray-100 pb-2 font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <Icono className="h-4 w-4 text-brand-500">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </Icono>
                Perfiles asignados
              </span>
            </h2>
            {perfilesDetalle.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin perfiles.</p>
            ) : (
              <ul className="space-y-2">
                {perfilesDetalle.map((p) => {
                  const desactivado = inactivo(p.codigo);
                  return (
                    <li key={p.codigo}>
                      <div
                        className={`rounded-xl px-3 py-2 ${
                          desactivado
                            ? "bg-gray-100/60 opacity-60 dark:bg-white/5"
                            : "bg-brand-50/60 dark:bg-brand-500/10"
                        }`}
                      >
                        <p
                          className={`flex items-center justify-between gap-2 text-sm font-medium ${
                            desactivado
                              ? "text-gray-400 line-through"
                              : "text-gray-800 dark:text-white/90"
                          }`}
                        >
                          {p.nombre}
                          {usuario.perfil_activo === p.codigo && (
                            <Badge size="sm" color="primary">
                              activo
                            </Badge>
                          )}
                        </p>
                        {p.descripcion && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {p.descripcion}
                          </p>
                        )}
                        {p.permisos.length > 0 && (
                          <ul className="mt-1 flex flex-wrap gap-1">
                            {p.permisos.map((perm) => (
                              <li
                                key={perm}
                                className="rounded-md bg-white px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-white/5 dark:text-gray-400"
                              >
                                {PERMISO_LABEL[perm] ?? perm}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-1 font-semibold text-gray-800 dark:text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <Icono className="h-4 w-4 text-brand-500">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </Icono>
                Datos institucionales (RH)
              </span>
            </h2>
            {vinculos === null ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
            ) : vinculos.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sin registro de trabajador con este carné en Recursos Humanos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-2 min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5">Expediente</th>
                      <th className="px-4 py-2.5">Área</th>
                      <th className="px-4 py-2.5">Cargo</th>
                      <th className="px-4 py-2.5">Sexo</th>
                      <th className="px-4 py-2.5">Docente</th>
                      <th className="px-4 py-2.5">Investigador</th>
                      <th className="px-4 py-2.5">Contratación</th>
                      <th className="px-4 py-2.5">Baja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {vinculos.map((v, i) => (
                      <tr key={`${v.Id_Expediente}-${i}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-white/90">
                          {v.Id_Expediente ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {nombreArea(v.Id_Direccion)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {v.Id_Cargo ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {v.Sexo === "F"
                            ? "Femenino"
                            : v.Sexo === "M"
                              ? "Masculino"
                              : v.Sexo ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {v.Docente ? (
                            <Badge size="sm" color="primary">
                              Docente
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {v.Investigador ? (
                            <Badge size="sm" color="info">
                              Investigador
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {fechaCorta(v.Fecha_Contratacion)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {fechaCorta(v.Fecha_Baja)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}