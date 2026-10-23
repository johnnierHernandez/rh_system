"use client";

import { DownloadIcon } from "@/icons";
import { useMemo, useState } from "react";
import type { Documento } from "./page";

type TipoInfo = {
  label: string;
  bg: string;
  text: string;
};

const TIPOS: Record<string, TipoInfo> = {
  pdf: { label: "PDF", bg: "bg-error-50 dark:bg-error-500/15", text: "text-error-600 dark:text-error-500" },
  doc: { label: "Word", bg: "bg-blue-light-50 dark:bg-blue-light-500/15", text: "text-blue-light-500" },
  docx: { label: "Word", bg: "bg-blue-light-50 dark:bg-blue-light-500/15", text: "text-blue-light-500" },
  xls: { label: "Excel", bg: "bg-success-50 dark:bg-success-500/15", text: "text-success-600 dark:text-success-500" },
  xlsx: { label: "Excel", bg: "bg-success-50 dark:bg-success-500/15", text: "text-success-600 dark:text-success-500" },
  ppt: { label: "PowerPoint", bg: "bg-warning-50 dark:bg-warning-500/15", text: "text-warning-600 dark:text-warning-500" },
  pptx: { label: "PowerPoint", bg: "bg-warning-50 dark:bg-warning-500/15", text: "text-warning-600 dark:text-warning-500" },
  rar: { label: "RAR", bg: "bg-gray-100 dark:bg-white/5", text: "text-gray-600 dark:text-gray-300" },
};

type Filtro = "todos" | "pdf" | "word" | "excel" | "powerpoint" | "rar";

const GRUPO: Record<string, Filtro> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  ppt: "powerpoint",
  pptx: "powerpoint",
  rar: "rar",
};

function formatoTam(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DescargasExplorer({
  items,
  porTipo,
}: {
  items: Documento[];
  porTipo: Record<string, number>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((d) => {
      if (filtro !== "todos" && GRUPO[d.ext] !== filtro) return false;
      if (q && !d.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, busqueda, filtro]);

  const ordenados = [...visibles].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <svg
            className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar documento…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-12 pe-4 text-sm text-gray-800 outline-none transition focus:border-brand-300 dark:border-gray-800 dark:bg-white/3 dark:text-white/90 dark:focus:border-brand-700"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "todos" as Filtro, label: `Todos (${items.length})` },
            { key: "pdf" as Filtro, label: `PDF (${porTipo.pdf ?? 0})` },
            { key: "word" as Filtro, label: `Word (${(porTipo.doc ?? 0) + (porTipo.docx ?? 0)})` },
            { key: "excel" as Filtro, label: `Excel (${(porTipo.xls ?? 0) + (porTipo.xlsx ?? 0)})` },
            { key: "powerpoint" as Filtro, label: `PowerPoint (${(porTipo.ppt ?? 0) + (porTipo.pptx ?? 0)})` },
            { key: "rar" as Filtro, label: `RAR (${porTipo.rar ?? 0})` },
          ]
            .filter((f) => f.key === "todos" || /\(([1-9]\d*)\)/.test(f.label))
            .map((f) => {
              const activo = filtro === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    activo
                      ? "bg-brand-500 text-white shadow-theme-xs"
                      : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:bg-white/3 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/10"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {ordenados.length} de {items.length} documentos
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordenados.map((d) => {
          const tipo = TIPOS[d.ext] ?? {
            label: d.ext.toUpperCase(),
            bg: "bg-gray-100 dark:bg-white/5",
            text: "text-gray-600 dark:text-gray-300",
          };
          return (
            <div
              key={d.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-800"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold uppercase ${tipo.bg} ${tipo.text}`}>
                  {d.ext}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium leading-snug text-gray-800 dark:text-white/90">
                    {d.nombre}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {tipo.label} · {formatoTam(d.tam)}
                  </p>
                </div>
              </div>
              <a
                href={d.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                <DownloadIcon className="size-4" />
                Descargar
              </a>
            </div>
          );
        })}
      </div>

      {ordenados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-white/3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No se encontraron documentos para &quot;{busqueda}&quot;.
          </p>
        </div>
      )}
    </div>
  );
}