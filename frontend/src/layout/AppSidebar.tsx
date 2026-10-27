"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "../context/SidebarContext";
import {
  CalenderIcon,
  ChevronDownIcon,
  DollarLineIcon,
  GridIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";


type NavItem = {
  key: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  target?: string;
  /** Quién puede ver la entrada; si hace falta un permiso concreto. */
  permiso?: string;
  subItems?: {
    key: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    target?: string;
  }[];
};

// Cualquier sesión ve el panel, «Mi nómina», cumpleaños y números CUJAE: son
// datos propios o públicos. El resto exige permiso: así el menú no enseña
// enlaces que el proxy va a negar.
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    key: "dashboard",
    path: "/portal",
  },
  {
    icon: <DollarLineIcon />,
    key: "miNomina",
    path: "/portal/mi-nomina",
  },
  {
    icon: <CalenderIcon />,
    key: "calendar",
    path: "/portal/cumpleanos",
  },
  {
    icon: <PageIcon />,
    key: "numeros",
    path: "/portal/numeros",
  },
  {
    icon: <UserCircleIcon />,
    key: "userProfile",
    path: "/portal/trabajadores",
    permiso: "trabajadores.ver",
  },
  {
    icon: <GroupIcon />,
    key: "cuadros",
    path: "/portal/cuadros",
    permiso: "trabajadores.ver",
  },
  {
    icon: <DollarLineIcon />,
    key: "salarios",
    path: "/portal/salarios",
    permiso: "salarios.ver",
  },
  {
    icon: <TableIcon />,
    key: "tarifaHoraria",
    path: "/portal/tarifa-horaria",
    permiso: "tarifa_horaria.gestionar",
  },
  {
    icon: <GroupIcon />,
    key: "misAreas",
    path: "/portal/mis-areas",
    permiso: "area.autorizar",
  },
  {
    key: "forms",
    icon: <ListIcon />,
    permiso: "negocio.ver",
    subItems: [{ key: "formElements", path: "/portal/areas", pro: false }],
  },
  {
    key: "tables",
    icon: <TableIcon />,
    permiso: "negocio.ver",
    subItems: [{ key: "basicTables", path: "/portal/plantilla", pro: false }],
  },
  {
    key: "pages",
    icon: <PageIcon />,
    path: "/portal/descargas",
    permiso: "negocio.ver",
  },
  {
    icon: <UserCircleIcon />,
    key: "usuarios",
    path: "/portal/usuarios",
    permiso: "usuarios.administrar",
  },
];

const AppSidebar: React.FC<{ permisos: string[] }> = ({ permisos }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  const visible = (items: NavItem[]) =>
    items.filter((it) => !it.permiso || (permisos ?? []).includes(it.permiso));

  const menuVisible = visible(navItems);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "support" | "others",
  ) => (
    <ul className="flex flex-col gap-1">
      {navItems.map((nav, index) => (
        <li key={nav.key}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={cn(
                "group menu-item cursor-pointer",
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive",
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start",
              )}
            >
              <span
                className={cn(
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive",
                )}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{t(`items.${nav.key}`)}</span>
              )}
              {nav.new && (isExpanded || isHovered || isMobileOpen) && (
                <span
                  className={cn(
                    "inset-e-10 absolute ms-auto",
                    openSubmenu?.type === menuType &&
                      openSubmenu?.index === index
                      ? "menu-dropdown-badge-active"
                      : "menu-dropdown-badge-inactive",
                    "menu-dropdown-badge",
                  )}
                >
                  {t("badges.new")}
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={cn(
                    "ms-auto h-5 w-5 transition-transform duration-200",
                    openSubmenu?.type === menuType &&
                      openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : "",
                  )}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                target={nav.target}
                className={cn(
                  "group menu-item",
                  isActive(nav.path)
                    ? "menu-item-active"
                    : "menu-item-inactive",
                )}
              >
                <span
                  className={cn(
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive",
                  )}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">
                    {t(`items.${nav.key}`)}
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="ms-9 mt-2 space-y-1">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.key}>
                    <Link
                      href={subItem.path}
                      target={subItem.target}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {t(`items.${subItem.key}`)}
                      <span className="ms-auto flex items-center gap-1">
                        {subItem.new && (
                          <span
                            className={`ms-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            {t("badges.new")}
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ms-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-pro-active"
                                : "menu-dropdown-badge-pro-inactive"
                            } menu-dropdown-badge-pro`}
                          >
                            {t("badges.pro")}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "support" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main"].forEach((menuType) => {
      const items = menuType === "main" ? menuVisible : [];
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "support" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive, menuVisible]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "support" | "others",
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-full flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out xl:mt-0 rtl:right-0 rtl:left-auto rtl:border-r-0 rtl:border-l dark:border-gray-800 dark:bg-gray-900 ${
        isExpanded || isMobileOpen ? "w-72.5" : isHovered ? "w-72.5" : "w-22.5"
      } ${
        isMobileOpen
          ? "translate-x-0"
          : "-translate-x-full rtl:translate-x-full"
      } xl:translate-x-0 xl:rtl:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${
          !isExpanded && !isHovered ? "xl:justify-center" : "justify-start"
        }`}
      >
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:ring-white/10">
            <Image
              src="/favicon.png"
              alt="Universidad Tecnológica de La Habana, Cujae"
              width={100}
              height={115}
              className="h-8 w-auto"
              priority
            />
          </span>
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold text-gray-800 dark:text-white/90">
                Universidad Tecnológica de La Habana, Cujae
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Dirección de Recursos Humanos
              </span>
            </span>
          )}
        </Link>
      </div>
      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 flex text-xs leading-5 text-gray-400 uppercase ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  t("groups.menu")
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(menuVisible, "main")}
            </div>
          </div>
        </nav>

      </div>
    </aside>
  );
};

export default AppSidebar;
