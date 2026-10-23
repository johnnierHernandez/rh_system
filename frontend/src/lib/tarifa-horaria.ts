export type PeriodoTarifa = {
  ano: number;
  mes: number;
  trabajadores: number;
  horas: number;
  cerrado: boolean;
  cerrado_por: string | null;
  cerrado_en: string | null;
};

export const MESES_TARIFA = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function periodoTexto(ano: number, mes: number): string {
  return `${MESES_TARIFA[mes - 1] ?? mes} ${ano}`;
}

export function periodoActual(): { ano: number; mes: number } {
  const hoy = new Date();
  return { ano: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

export function clavePeriodo(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function esPeriodoActual(ano: number, mes: number): boolean {
  const actual = periodoActual();
  return ano === actual.ano && mes === actual.mes;
}

export function periodoVacio(ano: number, mes: number): PeriodoTarifa {
  return {
    ano,
    mes,
    trabajadores: 0,
    horas: 0,
    cerrado: false,
    cerrado_por: null,
    cerrado_en: null,
  };
}

/** Agrega el mes en curso si el histórico todavía no lo trae. */
export function conPeriodoActual(periodos: PeriodoTarifa[]): PeriodoTarifa[] {
  const actual = periodoActual();
  if (periodos.some((p) => p.ano === actual.ano && p.mes === actual.mes)) {
    return periodos;
  }
  return [periodoVacio(actual.ano, actual.mes), ...periodos];
}

/**
 * Período que se muestra al abrir la vista: el mes en curso, aunque todavía
 * no tenga horas. Los períodos anteriores quedan en el histórico de solo
 * lectura.
 */
export function periodoInicial(periodos: PeriodoTarifa[]): PeriodoTarifa | null {
  const actual = periodoActual();
  const enCurso = periodos.find(
    (p) => p.ano === actual.ano && p.mes === actual.mes,
  );
  return enCurso ?? periodoVacio(actual.ano, actual.mes);
}

export function fechaCierre(iso: string | null): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-CU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
