import { CalenderIcon } from "@/icons";
import type { Metadata } from "next";
import PostalCumpleanos from "@/components/cumpleanos/postal-cumpleanos";

export const metadata: Metadata = { title: "Cumpleaños | DRHnet" };

type Cumple = {
  Nombre: string | null;
  Apellido_1: string | null;
  Apellido_2: string | null;
  Id_Direccion: string | null;
  Desc_Direccion: string | null;
  Fecha_Nacimiento: string | null;
};

export const dynamic = "force-dynamic";

async function getCumpleanos() {
  const res = await fetch("http://127.0.0.1:8000/api/cumpleanos_hoy", {
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as Cumple[]) : [];
}

export default async function CumpleanosPage() {
  const cumple = await getCumpleanos();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Cumpleaños de hoy
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Cumpleañeros del día en la CUJAE
        </p>
      </div>

      <PostalCumpleanos cumple={cumple} />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {cumple.map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                  <CalenderIcon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white/90">
                    {p.Apellido_1} {p.Apellido_2}, {p.Nombre}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(p.Desc_Direccion ?? p.Id_Direccion ?? "").replace(/\s+/g, " ").trim()}
                  </p>
                </div>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {p.Fecha_Nacimiento}
              </span>
            </li>
          ))}
          {cumple.length === 0 && (
            <li className="py-8 text-center text-sm text-gray-400">
              No hay cumpleaños hoy.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}