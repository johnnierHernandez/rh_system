import { DownloadIcon, FolderIcon } from "@/icons";
import type { Metadata } from "next";
import DescargasExplorer from "./descargas-explorer";

export const metadata: Metadata = {
  title: "Descargas | DRHnet",
  description: "Modelos, planillas y normativas de la Dirección de Recursos Humanos",
};

export const dynamic = "force-dynamic";

export type Documento = {
  id: number;
  ext: string;
  nombre: string;
  archivo: string;
  url: string;
  tam: number;
};

type Catalogo = {
  categoria: string;
  descripcion: string;
  total: number;
  por_tipo: Record<string, number>;
  items: Documento[];
};

async function getCatalogo() {
  const res = await fetch("http://127.0.0.1:8000/api/descargas", {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Catalogo;
}

export default async function DescargasPage() {
  const catalogo = await getCatalogo();
  const items = catalogo?.items ?? [];
  const por_tipo = catalogo?.por_tipo ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Centro de descargas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {catalogo?.descripcion ?? "Documentos de la DRH"}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <FolderIcon className="size-5" />
          {catalogo?.total ?? 0} documentos
        </div>
      </div>

      <DescargasExplorer items={items} porTipo={por_tipo} />

      {!catalogo && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-400 dark:border-gray-800 dark:bg-white/3">
          No se pudo cargar el catálogo de descargas.
        </div>
      )}
    </div>
  );
}