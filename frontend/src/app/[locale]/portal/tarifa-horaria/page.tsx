import type { Metadata } from "next";

import TarifaHorariaAdmin from "./tarifa-horaria-admin";

export const metadata: Metadata = { title: "Tarifa horaria | DRHnet" };

export const dynamic = "force-dynamic";

export default function TarifaHorariaAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Tarifa horaria
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Inserte las horas del próximo pago por número de cumplidor. Solo se
          listan los trabajadores con horas insertadas en el área seleccionada.
        </p>
      </div>

      <TarifaHorariaAdmin />
    </div>
  );
}
