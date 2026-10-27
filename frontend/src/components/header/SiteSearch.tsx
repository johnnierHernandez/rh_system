"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pagina = {
  label: string;
  keywords: string[];
  href: string;
  permiso?: string;
};

const PAGINAS: Pagina[] = [
  {
    label: "Trabajadores",
    keywords: ["trabajadores", "empleados", "carnet", "nómina", "plantilla nominal", "expediente"],
    href: "/portal/trabajadores",
    permiso: "trabajadores.ver",
  },
  {
    label: "Usuarios",
    keywords: ["usuarios", "importar", "ldap", "accesos", "cuentas", "perfiles"],
    href: "/portal/usuarios",
    permiso: "usuarios.administrar",
  },
  {
    label: "Áreas",
    keywords: ["áreas", "unidades organizativas", "direcciones", "estructura", "departamentos"],
    href: "/portal/areas",
    permiso: "negocio.ver",
  },
  {
    label: "Cumpleaños",
    keywords: ["cumpleaños", "aniversarios", "festejos", "natalicios"],
    href: "/portal/cumpleanos",
  },
  {
    label: "Plantilla",
    keywords: ["plantilla", "plazas", "cargos", "presupuesto"],
    href: "/portal/plantilla",
    permiso: "negocio.ver",
  },
  {
    label: "Descargas",
    keywords: ["descargas", "modelos", "planillas", "documentos", "formularios", "condecoraciones"],
    href: "/portal/descargas",
    permiso: "negocio.ver",
  },
  {
    label: "Plazas vacantes",
    keywords: ["plazas vacantes", "vacantes", "convocatoria", "empleo"],
    href: "/servicios/plazas-vacantes",
  },
  {
    label: "Recién graduados",
    keywords: ["recién graduados", "graduados", "adiestrados"],
    href: "/servicios/recien-graduados",
  },
  {
    label: "Sobrecarga docente (S.C.D.)",
    keywords: ["scd", "sobrecarga", "docente", "cuadros"],
    href: "/servicios/scd",
  },
  {
    label: "Tarifa horaria",
    keywords: ["tarifa horaria", "tarifa", "horaria", "clases"],
    href: "/servicios/tarifa-horaria",
  },
];

type Trabajador = {
  No_CI?: string | null;
  Nombre?: string | null;
  Apellido_1?: string | null;
  Apellido_2?: string | null;
  Desc_Direccion?: string | null;
  Desc_Cargo?: string | null;
};
type Usuario = {
  carnet_identidad: string;
  nombre?: string | null;
  apellidos?: string | null;
  area?: string | null;
  perfil_activo?: string | null;
};
type Area = { Id_Direccion: string; Desc_Direccion: string };
type Descarga = { id: number; ext: string; nombre: string; url: string };
type Vacante = {
  Id_Direccion?: string | null;
  Desc_Direccion?: string | null;
  Id_Cargo?: string | null;
  Desc_Cargo?: string | null;
  Desc_Categoria?: string | null;
};
type BusquedaResp = {
  q: string;
  trabajadores: Trabajador[];
  usuarios: Usuario[];
  areas: Area[];
  descargas: Descarga[];
  vacantes: Vacante[];
};

const normaliza = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const palabras = (s: string) =>
  normaliza(s).split(/\s+/).map((p) => p.trim()).filter(Boolean);

const coincide = (texto: string, terminos: string[]) => {
  const pool = palabras(texto);
  return terminos.some((tq) => pool.some((tp) => tp.includes(tq)));
};

function iniciales(nombre?: string | null, apellido?: string | null) {
  const n = (nombre ?? "").split(/\s+/)[0] || "";
  const a = (apellido ?? "").split(/\s+/)[0] || "";
  return (n[0] ?? "") + (a[0] ?? "");
}

const Avatar: React.FC<{ nombre?: string | null }> = ({ nombre }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-medium text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
    {iniciales(nombre, "") || "?"}
  </span>
);

type Resultado = {
  href: string;
  titulo: string;
  detalle?: string;
  externo?: boolean;
};

const VACIA: BusquedaResp = {
  q: "",
  trabajadores: [],
  usuarios: [],
  areas: [],
  descargas: [],
  vacantes: [],
};

const SiteSearch: React.FC<{ permisos: string[] }> = ({ permisos }) => {
  const t = useTranslations("header");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const abiertoRef = useRef(false);

  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [datos, setDatos] = useState<BusquedaResp>(VACIA);

  const buscar = useCallback(async (q: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const señal = abortRef.current.signal;
    setBuscando(true);
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}&limite=6`, {
        credentials: "same-origin",
        signal: señal,
      });
      if (!señal.aborted && res.ok) {
        const json = (await res.json()) as BusquedaResp;
        setDatos(json);
      }
    } catch {
      // Aborto o red caída: se queda con lo que había.
    } finally {
      if (!señal.aborted) setBuscando(false);
    }
  }, []);

  const onChange = (valor: string) => {
    setQuery(valor);
    if (!abiertoRef.current) {
      abiertoRef.current = true;
      setAbierto(true);
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (valor.trim().length >= 2) {
      setBuscando(true);
      timerRef.current = window.setTimeout(() => {
        void buscar(valor.trim());
      }, 220);
    } else {
      setDatos(VACIA);
      setBuscando(false);
    }
  };

  const cerrar = () => {
    setAbierto(false);
    abiertoRef.current = false;
    abortRef.current?.abort();
    setBuscando(false);
  };

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") cerrar();
    };
    const alClic = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("keydown", alTecla);
    document.addEventListener("mousedown", alClic);
    return () => {
      document.removeEventListener("keydown", alTecla);
      document.removeEventListener("mousedown", alClic);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const terminos = useMemo(() => palabras(query), [query]);

  const secciones = useMemo(() => {
    const grupos: { seccion: string; items: Resultado[] }[] = [];

    const paginas = PAGINAS.filter((p) => !p.permiso || permisos.includes(p.permiso))
      .filter((p) => coincide(`${p.label} ${p.keywords.join(" ")}`, terminos));
    if (paginas.length)
      grupos.push({
        seccion: "Páginas del sitio",
        items: paginas.map((p) => ({ href: p.href, titulo: p.label, detalle: "Abrir sección" })),
      });

    if (datos.trabajadores.length)
      grupos.push({
        seccion: "Trabajadores",
        items: datos.trabajadores.map((x) => ({
          href: x.No_CI ? `/portal/trabajadores/${encodeURIComponent(x.No_CI)}` : "",
          titulo: [x.Nombre, x.Apellido_1, x.Apellido_2].filter(Boolean).join(" "),
          detalle: x.Desc_Cargo || x.Desc_Direccion || "Ver perfil",
        })),
      });

    if (datos.usuarios.length)
      grupos.push({
        seccion: "Usuarios",
        items: datos.usuarios.map((u) => ({
          href: `/portal/usuarios/${encodeURIComponent(u.carnet_identidad)}`,
          titulo: [u.nombre, u.apellidos].filter(Boolean).join(" "),
          detalle: u.perfil_activo || u.area || "Ver ficha",
        })),
      });

    if (datos.areas.length)
      grupos.push({
        seccion: "Áreas",
        items: datos.areas.map((a) => ({
          href: `/portal/areas/${encodeURIComponent(a.Id_Direccion)}`,
          titulo: a.Desc_Direccion,
          detalle: `Código ${a.Id_Direccion}`,
        })),
      });

    if (datos.descargas.length)
      grupos.push({
        seccion: "Descargas",
        items: datos.descargas.map((d) => ({
          href: d.url,
          titulo: d.nombre,
          detalle: `${d.ext.toUpperCase()} · Descargar`,
          externo: true,
        })),
      });

    if (datos.vacantes.length)
      grupos.push({
        seccion: "Plazas vacantes",
        items: datos.vacantes.map((v) => ({
          href: "/servicios/plazas-vacantes",
          titulo: v.Desc_Cargo || v.Id_Cargo || "Plaza vacante",
          detalle: v.Desc_Direccion || v.Desc_Categoria || "Consultar convocatoria",
        })),
      });

    return grupos;
  }, [terminos, permisos, datos]);

  const sinResultados =
    !buscando && terminos.length >= 2 && secciones.length === 0;

  return (
    <div ref={contenedorRef} className="relative hidden xl:block">
      <div className="relative">
        <span className="inset-s-4 pointer-events-none absolute top-1/2 -translate-y-1/2">
          <svg
            className="fill-gray-500 dark:fill-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            abiertoRef.current = true;
            setAbierto(true);
          }}
          placeholder={t("searchPlaceholder")}
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 ps-12 pe-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden xl:w-107.5 dark:border-gray-800 dark:bg-white/3 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="inset-e-2.5 absolute top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-1.75 py-[4.5px] text-xs tracking-[-0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400"
        >
          <span>⌘</span>
          <span>K</span>
        </button>
      </div>

      {abierto && (
        <div className="absolute start-0 end-0 top-full z-99999 mt-2 max-h-125 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-theme-xl dark:border-gray-700 dark:bg-gray-900">
          {query.trim().length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Escribe para buscar en todo el sitio…
            </p>
          )}

          {terminos.length >= 2 &&
            secciones.map((grupo) => (
              <Fragment key={grupo.seccion}>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  {grupo.seccion}
                </p>
                <ul>
                  {grupo.items.map((it, idx) => {
                    const cl = "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/5";
                    const cuerpo = (
                      <>
                        <Avatar nombre={it.titulo} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {it.titulo}
                          </span>
                          {it.detalle && (
                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                              {it.detalle}
                            </span>
                          )}
                        </span>
                      </>
                    );
                    return (
                      <li key={`${grupo.seccion}-${idx}`}>
                        {it.externo ? (
                          <a href={it.href} onClick={cerrar} className={cl}>
                            {cuerpo}
                          </a>
                        ) : (
                          <Link href={it.href || "#"} onClick={cerrar} className={cl}>
                            {cuerpo}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            ))}

          {buscando && terminos.length >= 2 && (
            <p className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Buscando…
            </p>
          )}

          {sinResultados && (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No se encontraron resultados para “{query}”.
            </p>
          )}

          <div className="mt-1 flex items-center gap-2 border-t border-gray-100 px-3 pt-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <span
              className={cn(
                "inline-flex items-center rounded border border-gray-200 px-1 py-px",
                "dark:border-gray-700",
              )}
            >
              Esc
            </span>
            <span>para cerrar · Busca por nombre, carné, área o documento</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteSearch;