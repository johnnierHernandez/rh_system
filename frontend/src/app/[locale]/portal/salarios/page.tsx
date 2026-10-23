import type { Metadata } from "next";

import SalariosExplorer from "./salarios-explorer";

export const metadata: Metadata = { title: "Salarios | DRHnet" };

export const dynamic = "force-dynamic";

export default function SalariosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Salarios
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Nómina de un trabajador a partir de su carné de identidad o de su
          usuario de internet. Es información nominal y reservada: solo la ve el
          perfil autorizado.
        </p>
      </div>

      <SalariosExplorer />
    </div>
  );
}
