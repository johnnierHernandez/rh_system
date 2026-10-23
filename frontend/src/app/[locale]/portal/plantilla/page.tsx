import Badge from "@/components/ui/badge/Badge";
import { TableIcon } from "@/icons";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plantilla | DRHnet" };

type Plaza = {
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Id_Cargo: string | null;
  Desc_Cargo: string | null;
  Vacante: boolean | null;
};

export const dynamic = "force-dynamic";

async function getPlantilla() {
  const res = await fetch(
    "http://127.0.0.1:8000/api/plantilla?limit=100&offset=0",
    { cache: "no-store" },
  );
  return res.ok ? ((await res.json()) as Plaza[]) : [];
}

export default async function PlantillaPage() {
  const plantilla = await getPlantilla();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Plantilla
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Plazas de la plantilla de la CUJAE
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Cargo
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Área
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {plantilla.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-2 font-medium text-gray-800 dark:text-white/90">
                      <TableIcon className="size-4 text-gray-400" />
                      {p.Desc_Cargo ?? p.Id_Cargo}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Código {p.Id_Cargo}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {p.Desc_Direccion ?? p.Id_Direccion}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {p.Vacante ? (
                      <Badge variant="solid" color="success">
                        Vacante
                      </Badge>
                    ) : (
                      <Badge color="light">Ocupada</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {plantilla.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="flex h-20 items-center justify-center text-sm text-gray-400"
                  >
                    Sin plazas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}