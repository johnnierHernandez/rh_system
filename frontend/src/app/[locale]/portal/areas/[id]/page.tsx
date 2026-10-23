import Badge from "@/components/ui/badge/Badge";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Área | DRHnet" };

type Area = {
  Id_Direccion: string;
  Desc_Direccion: string;
  Id_DireccionPadre: string | null;
  trabajadores: number;
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
};

export const dynamic = "force-dynamic";

async function getArea(areaId: string) {
  const [areaRes, trabRes] = await Promise.all([
    fetch(`http://127.0.0.1:8000/api/areas/${areaId}`, { cache: "no-store" }),
    fetch(`http://127.0.0.1:8000/api/areas/${areaId}/trabajadores`, {
      cache: "no-store",
    }),
  ]);
  const area: Area | null = areaRes.ok ? await areaRes.json() : null;
  const trabajadores: Trabajador[] = trabRes.ok ? await trabRes.json() : [];
  return { area, trabajadores };
}

export default async function AreaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { area, trabajadores } = await getArea(id);

  if (!area) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Área no encontrada.</p>
        <Link
          href="/portal/areas"
          className="text-sm font-medium text-brand-500 hover:underline"
        >
          ← Volver a áreas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/portal/areas"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:underline"
      >
        ← Volver a áreas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            {area.Desc_Direccion}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Código {area.Id_Direccion}
          </p>
        </div>
        <Badge variant="solid" color="primary">
          {area.trabajadores} trabajadores
        </Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Nombre
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  No. CI
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Sexo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {trabajadores.map((t) => (
                <tr key={t.Id_Expediente}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                    {t.Nombre} {t.Apellido_1} {t.Apellido_2}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {t.No_CI}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {t.Sexo}
                  </td>
                </tr>
              ))}
              {trabajadores.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="flex h-20 items-center justify-center text-sm text-gray-400"
                  >
                    Sin trabajadores en esta área.
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