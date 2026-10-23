import Link from "next/link";

type Area = { Id_Direccion: string; Desc_Direccion: string; trabajadores: number };

export const dynamic = "force-dynamic";

async function getAreas(): Promise<Area[]> {
  const res = await fetch("http://127.0.0.1:8000/api/areas", { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function AreasPage() {
  const areas = await getAreas();
  return (
    <section>
      <h1 className="text-2xl font-bold text-[#006633]">Áreas y Direcciones</h1>
      <p className="mt-1 text-[#52525b]">{areas.length} áreas con plantilla activa en la CUJAE.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <Link key={a.Id_Direccion} href={`/areas/${a.Id_Direccion}`}
                className="rounded-xl border border-[#e5e7eb] bg-white p-5 transition hover:border-[#006633] hover:shadow-md">
            <h2 className="font-semibold text-[#006633]">{a.Desc_Direccion}</h2>
            <p className="mt-2 text-sm text-[#52525b]">
              {a.trabajadores} trabajador{a.trabajadores === 1 ? "" : "es"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
