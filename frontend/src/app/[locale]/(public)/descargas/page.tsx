import DownloadIcon from "@/icons/download.svg";
import type { Metadata } from "next";
import DescargasExplorerPublic from "./descargas-explorer";

export const metadata: Metadata = {
  title: "Descargas | DRHnet",
  description:
    "Modelos, planillas y normativas de la Dirección de Recursos Humanos",
};

type Documento = {
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

export const dynamic = "force-dynamic";

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
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#006633]">
          Centro de descargas
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#c9e9da] px-4 py-1.5 text-sm font-semibold text-[#005529]">
          <DownloadIcon className="h-5 w-5" />
          {catalogo?.total ?? 0} documentos
        </span>
      </div>
      <p className="mt-1 text-[#52525b]">
        {catalogo?.descripcion ?? "Documentos de la DRH"}
      </p>

      <DescargasExplorerPublic items={items} porTipo={por_tipo} />

      {!catalogo && (
        <p className="mt-4 rounded-xl border border-[#e5e7eb] bg-white p-6 text-sm text-[#52525b]">
          No se pudo cargar el catálogo de descargas.
        </p>
      )}
    </section>
  );
}