"use client";

import DownloadIcon from "@/icons/download.svg";
import { useMemo, useState } from "react";

type Documento = {
  id: number;
  ext: string;
  nombre: string;
  archivo: string;
  url: string;
  tam: number;
};

type TipoInfo = {
  label: string;
  bg: string;
  text: string;
};

const TIPOS: Record<string, TipoInfo> = {
  pdf: {
    label: "PDF",
    bg: "bg-red-50 text-red-600",
    text: "",
  },
  doc: { label: "Word", bg: "bg-blue-50 text-blue-600", text: "" },
  docx: { label: "Word", bg: "bg-blue-50 text-blue-600", text: "" },
  xls: { label: "Excel", bg: "bg-emerald-50 text-emerald-700", text: "" },
  xlsx: { label: "Excel", bg: "bg-emerald-50 text-emerald-700", text: "" },
  ppt: { label: "PowerPoint", bg: "bg-orange-50 text-orange-600", text: "" },
  pptx: { label: "PowerPoint", bg: "bg-orange-50 text-orange-600", text: "" },
  rar: { label: "RAR", bg: "bg-gray-100 text-gray-600", text: "" },
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

export default function DescargasExplorerPublic({
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

  const chipsBase: { key: Filtro; label: string }[] = [
    { key: "todos", label: `Todos (${items.length})` },
    { key: "pdf", label: `PDF (${porTipo.pdf ?? 0})` },
    {
      key: "word",
      label: `Word (${(porTipo.doc ?? 0) + (porTipo.docx ?? 0)})`,
    },
    {
      key: "excel",
      label: `Excel (${(porTipo.xls ?? 0) + (porTipo.xlsx ?? 0)})`,
    },
    {
      key: "powerpoint",
      label: `PowerPoint (${(porTipo.ppt ?? 0) + (porTipo.pptx ?? 0)})`,
    },
    { key: "rar", label: `RAR (${porTipo.rar ?? 0})` },
  ];
  const chips = chipsBase.filter(
    (c) => c.key === "todos" || /\(([1-9]\d*)\)/.test(c.label),
  );

  return (
    <div>
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar documento…"
            className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white py-2.5 pl-11 pr-4 text-sm text-[#1a1a1a] outline-none transition focus:border-[#006633]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const activo = filtro === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFiltro(c.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  activo
                    ? "bg-[#006633] text-white"
                    : "bg-white text-[#52525b] ring-1 ring-inset ring-[#e5e7eb] hover:bg-[#f4f6f4]"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-sm text-[#52525b]">
        {ordenados.length} de {items.length} documentos
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordenados.map((d) => {
          const tipo = TIPOS[d.ext] ?? {
            label: d.ext.toUpperCase(),
            bg: "bg-gray-100 text-gray-600",
          };
          return (
            <div
              key={d.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-[#e5e7eb] bg-white p-5 transition hover:border-[#006633] hover:shadow-md hover:shadow-[#006633]/15"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold uppercase ${tipo.bg}`}
                >
                  {d.ext}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium leading-snug text-[#1a1a1a]">
                    {d.nombre}
                  </p>
                  <p className="mt-1 text-xs text-[#52525b]">
                    {tipo.label} · {formatoTam(d.tam)}
                  </p>
                </div>
              </div>
              <a
                href={d.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#006633] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#005529]"
              >
                <DownloadIcon className="h-4 w-4" />
                Descargar
              </a>
            </div>
          );
        })}
      </div>

      {ordenados.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-[#d1d5db] bg-white px-6 py-10 text-center">
          <p className="text-sm text-[#52525b]">
            No se encontraron documentos para &quot;{busqueda}&quot;.
          </p>
        </div>
      )}
    </div>
  );
}