import type { Metadata } from "next";
import NumerosCujae, { type Numeros } from "../../(public)/numeros-cujae";

export const metadata: Metadata = {
  title: "Números CUJAE | DRHnet",
  description: "Indicadores del personal activo de la Universidad CUJAE",
};

export const dynamic = "force-dynamic";

async function getNumeros(): Promise<Partial<Numeros> | null> {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/numeros", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Partial<Numeros>;
  } catch {
    return null;
  }
}

export default async function PortalNumerosPage() {
  const n = await getNumeros();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Números CUJAE
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Indicadores del personal activo de la Universidad
          </p>
        </div>
      </div>

      {n?.total_activos ? (
        <NumerosCujae n={n} />
      ) : (
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/3">
          No se pudieron leer las cifras en este momento. Inténtalo en un rato.
        </p>
      )}
    </div>
  );
}