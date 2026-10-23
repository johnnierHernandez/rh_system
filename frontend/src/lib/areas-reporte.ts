export type AreaReporte = {
  id: number;
  nombre: string;
};

/**
 * Orden en que el DRH quiere ver las áreas en los selectores de reportes.
 * Las que no estén en la lista se añaden al final, por si el backend
 * incorpora alguna nueva.
 */
export const ORDEN_AREAS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 35, 118, 14, 38, 16, 17, 18, 19, 20,
  21, 22, 23, 26, 28, 29, 30, 31, 32, 33, 34, 41, 42, 43, 107, 106, 47, 51,
  52, 53, 54, 55, 57, 58, 90, 103, 104, 102, 105, 109, 117, 111, 112, 113,
  114, 115, 116, 119, 120,
];

export function ordenarAreas(areas: AreaReporte[]): AreaReporte[] {
  const mapa = new Map(areas.map((a) => [a.id, a]));
  const ordenadas = ORDEN_AREAS.map((id) => mapa.get(id)).filter(
    (a): a is AreaReporte => Boolean(a),
  );
  const resto = areas
    .filter((a) => !ORDEN_AREAS.includes(a.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return [...ordenadas, ...resto];
}
