import { ListIcon } from "@/icons";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Áreas | DRHnet" };

type Area = {
  Id_Direccion: string;
  Desc_Direccion: string;
  Id_DireccionPadre: string | null;
  trabajadores: number;
};

export const dynamic = "force-dynamic";

async function getAreas() {
  const res = await fetch("http://127.0.0.1:8000/api/areas", {
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as Area[]) : [];
}

export default async function AreasPage() {
  const areas = await getAreas();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Áreas y Direcciones
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Unidades organizativas de la CUJAE
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Código
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Descripción
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Trabajadores
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {areas.map((a) => (
                <tr key={a.Id_Direccion}>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {a.Id_Direccion}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/areas/${a.Id_Direccion}`}
                      className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90"
                    >
                      {a.Desc_Direccion}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                      <ListIcon className="size-4 text-gray-400" />
                      {a.trabajadores}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}