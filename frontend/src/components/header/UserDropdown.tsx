"use client";

import { useClickOutside } from "@/hooks/useClickOutside";
import { getLanguage, languages } from "@/i18n/languages";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ChevronDownIcon } from "@/icons";
import { cn } from "@/utils";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import type { Identidad } from "@/lib/identidad";
import { iniciales, perfilesSeleccionables } from "@/lib/identidad";

export default function UserDropdown() {
  const t = useTranslations("userDropdown");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const subDropdownRef = useRef<HTMLLIElement>(null);
  const [identidad, setIdentidad] = useState<Identidad | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/auth/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.identidad) setIdentidad(d.identidad);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const nombre = [identidad?.nombre, identidad?.apellidos]
    .filter(Boolean)
    .join(" ");
  const seleccionables = perfilesSeleccionables(identidad);

  const cambiarPerfil = async (codigo: string) => {
    if (codigo === identidad?.perfil_activo) {
      closeDropdown();
      return;
    }
    setCambiando(true);
    setErrorPerfil(null);
    try {
      const res = await fetch("/api/auth/perfil-activo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: codigo }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorPerfil(cuerpo?.error ?? "No se pudo cambiar el perfil.");
        return;
      }
      // Los permisos se releen en cada petición, pero el proxy ya decidió con
      // el perfil anterior: hay que volver a pasar por él.
      router.refresh();
    } catch {
      setErrorPerfil("No se pudo contactar al servidor.");
    } finally {
      setCambiando(false);
      closeDropdown();
    }
  };

  const salir = async () => {
    closeDropdown();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Recarga completa: la cookie se acaba de borrar y la página cacheada de
    // `/login` puede ser la redirección a `/portal` que se guardó cuando
    // todavía había sesión.
    window.location.replace("/login");
  };

  const currentLang = getLanguage(locale);
  const CurrentFlagIcon = currentLang.FlagIcon;

  useClickOutside(subDropdownRef, () => {
    setIsSubDropdownOpen(false);
  });

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setIsSubDropdownOpen(false);
    }
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setIsSubDropdownOpen(false);
  };

  const handleSelectLanguage = (id: Locale) => {
    router.replace(pathname, { locale: id });
    setIsSubDropdownOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="me-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#006633]/10 text-sm font-semibold text-[#006633] dark:bg-white/10 dark:text-white">
          {iniciales(identidad)}
        </span>

        <span className="me-1 block text-start">
          <span className="block max-w-40 truncate text-theme-sm font-medium">
            {nombre || "Mi cuenta"}
          </span>
          {identidad?.perfil_activo_nombre && (
            <span className="block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              {identidad.perfil_activo_nombre}
            </span>
          )}
        </span>

        <ChevronDownIcon
          className={`size-5 text-gray-500 transition-transform duration-200 dark:text-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute mt-4.25 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg ltr:right-0 rtl:right-auto rtl:left-0 dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
            {nombre || "Sin sesión"}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {identidad?.email_institucional || "—"}
          </span>
          {identidad?.usuario_internet && (
            <span className="block text-theme-xs text-gray-400 dark:text-gray-500">
              {identidad.usuario_internet}
            </span>
          )}
        </div>

        {seleccionables.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-gray-200 pt-3 dark:border-gray-800">
            <li className="px-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Perfil con el que trabajas
            </li>
            {seleccionables.map((p) => (
              <li key={p.codigo}>
                <button
                  type="button"
                  disabled={cambiando}
                  onClick={() => cambiarPerfil(p.codigo)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-start transition-colors disabled:opacity-60",
                    identidad?.perfil_activo === p.codigo
                      ? "bg-[#006633]/10 text-[#006633] dark:bg-white/5"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
                  )}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {identidad?.perfil_activo === p.codigo && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-theme-sm font-medium">{p.nombre}</span>
                    {p.descripcion && (
                      <span className="mt-0.5 block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                        {p.descripcion}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {errorPerfil && (
              <li role="alert" className="px-3 text-theme-xs text-red-600 dark:text-red-400">
                {errorPerfil}
              </li>
            )}
          </ul>
        )}

        <ul className="mt-1 flex flex-col gap-1 border-b border-gray-200 pt-3 pb-3 dark:border-gray-800">          <li className="relative" ref={subDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSubDropdownOpen((prev) => !prev)}
              className={cn(
                "group flex max-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors",
                isSubDropdownOpen
                  ? "bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300",
              )}
            >
              <span className="flex items-center gap-3 text-theme-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12.001 2.75C17.1091 2.75 21.2501 6.89178 21.2501 11.9999C21.2501 17.108 17.1091 21.2498 12.001 21.2498M12.001 2.75C6.89289 2.75 2.75195 6.89178 2.75195 11.9999C2.75195 17.108 6.8929 21.2498 12.001 21.2498M12.001 2.75C14.2097 2.75 16.0005 6.8914 16.0005 11.9993C16.0005 17.1073 14.2098 21.2498 12.001 21.2498M12.001 2.75C9.79226 2.75 8.00195 6.89141 8.00195 11.9994C8.00195 17.1073 9.79226 21.2498 12.001 21.2498M3.24561 8.99976H20.7544M3.24561 14.9998H20.7544"
                    stroke="#667085"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <span>{t("language")}</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300">
                <span>{currentLang.shortName}</span>
                <CurrentFlagIcon className="size-3.5 shrink-0 overflow-hidden rounded-full" />
              </span>
            </button>

            {isSubDropdownOpen && (
              <div className="absolute top-11 w-62.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:top-0 ltr:-left-2 ltr:md:right-[calc(100%+14px)] ltr:md:left-auto rtl:-right-2 rtl:md:right-auto rtl:md:left-[calc(100%+14px)] dark:border-gray-800 dark:bg-gray-dark">
                <ul className="flex flex-col gap-1">
                  {languages.map((language) => {
                    const isSelected = locale === language.id;
                    const FlagIcon = language.FlagIcon;

                    return (
                      <li key={language.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectLanguage(language.id);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                            isSelected
                              ? "bg-brand-50 dark:bg-brand-500/15"
                              : "hover:bg-gray-100 dark:hover:bg-white/5",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full transition-opacity",
                                isSelected
                                  ? "bg-brand-500 opacity-100 dark:bg-brand-400"
                                  : "opacity-0",
                              )}
                            />
                            <FlagIcon className="size-5 shrink-0 overflow-hidden rounded-full" />
                            <span className="truncate">{language.name}</span>
                          </span>

                          {language.badge && (
                            <span className="rounded bg-warning-50 px-1.5 py-0.5 text-theme-xs font-semibold text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
                              {language.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        </ul>
        <button
          type="button"
          onClick={salir}
          className="group mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          {t("signOut")}
        </button>
      </Dropdown>
    </div>
  );
}
