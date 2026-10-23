import Link from "next/link";

type Area = { Id_Direccion: string; Desc_Direccion: string; trabajadores: number };
type Trabajador = { Id_Expediente: string; Nombre: string; Apellido_1: string; Apellido_2: string; Id_Cargo: string; Sexo: string };

export const dynamic = "force-dynamic";

async function getData(id: string) {
  const [areaRes, traRes] = await Promise.all([
    fetch(`http://127.0.0.1:8000/api/areas/${id}`, { cache: "no-store" }),
    fetch(`http://127.0.0.1:8000/api/areas/${id}/trabajadores`, { cache: "no-store" }),
  ]);
  const area: Area | null = areaRes.ok ? await areaRes.json() : null;
  const trabajadores: Trabajador[] = traRes.ok ? await traRes.json() : [];
  return { area, trabajadores };
}

export default async function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { area, trabajadores } = await getData(id);
  if (!area) return <p className="text-[#52525b]">Área no encontrada.</p>;
  return (
    <section>
      <Link href="/areas" className="text-sm text-[#006633] hover:underline">← Volver a áreas</Link>
      <h1 className="mt-2 text-2xl font-bold text-[#006633]">{area.Desc_Direccion}</h1>
      <p className="mt-1 text-[#52525b]">
        Código: {area.Id_Direccion} · {area.trabajadores} trabajadores
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-[#e5e7eb]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f4f6f4] text-left text-[#1a1a1a]">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Expediente</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Sexo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {trabajadores.map((t) => (
              <tr key={t.Id_Expediente} className="hover:bg-gray-50">
                <td className="px-4 py-2">{t.Apellido_1} {t.Apellido_2}, {t.Nombre}</td>
                <td className="px-4 py-2">{t.Id_Expediente}</td>
                <td className="px-4 py-2">{t.Id_Cargo}</td>
                <td className="px-4 py-2">{t.Sexo}</td>
              </tr>
            ))}
            {trabajadores.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-3 text-gray-400">Sin trabajadores registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
