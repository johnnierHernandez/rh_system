"""
Salarios: nómina de un trabajador y retenciones legales.

Parte de la división de `DRHService` que se ocupa del dinero: la escala de
retenciones y el armado del expediente viven aquí, no mezclados con la
plantilla ni con los reportes.
"""

from __future__ import annotations

from repositories import RepositoryFactory
from schemas import (
    MiNomina,
    MiNominaMes,
    SalarioComponentes,
    SalarioCobro,
    SalarioExpediente,
    SalarioHistorico,
    SalarioNominilla,
    SalarioRespuesta,
    SalarioTotal,
)
from services.ldap_portal import PersonaNoEncontrada, buscar_persona

# Retenciones legales del salario (GOC-2023-271-EX20, Resolución 41/2023 del
# Ministerio de Finanzas y Precios). Las escalas son progresivas por tramos:
# cada porción de la base se grava al tipo de su tramo, no todo el importe al
# tipo del tramo en que cae. El primer tramo del impuesto personal es exento.
_CESS_TRAMOS = ((0.0, 15000.0, 0.05), (15000.0, float("inf"), 0.10))
_IIP_TRAMOS = (
    (3260.0, 9510.0, 0.03),
    (9510.0, 15000.0, 0.05),
    (15000.0, 20000.0, 0.075),
    (20000.0, 25000.0, 0.10),
    (25000.0, 30000.0, 0.15),
    (30000.0, float("inf"), 0.20),
)


class SalarioService:
    """Nómina y retenciones de un trabajador."""

    def __init__(self, factory: RepositoryFactory) -> None:
        self._fact = factory

    def salario(self, identificador: str) -> SalarioRespuesta:
        """Nómina de un trabajador por carné de identidad o usuario de internet.

        El identificador se resuelve en dos pasos: primero contra la ficha de
        personal (si ya es un carné), y solo si no aparece y no parece un carné
        se pregunta al AD por el usuario de internet. Cuando el AD no está
        disponible lanza `LDAPNoDisponible`; cuando la persona no existe en
        ninguno de los dos devuelve una respuesta vacía, no un error: la vista
        distingue "no encontrado" de "fallo del directorio".

        Una misma persona puede tener varios expedientes (plaza y docencia);
        se devuelven todos, con los activos primero.
        """
        q = (identificador or "").strip()
        if not q:
            return SalarioRespuesta.vacio(q)

        personas = self._fact.nomina().personas_por_carnet(q)
        metodo = "carnet" if personas else None
        carnet = q

        if not personas and not q.isdigit():
            carnet = self._carnet_desde_ad(q)
            if carnet:
                personas = self._fact.nomina().personas_por_carnet(carnet)
                metodo = "usuario_internet"

        if not personas:
            return SalarioRespuesta.vacio(q, metodo)

        return SalarioRespuesta(
            consulta=q,
            encontrado=True,
            metodo=metodo,
            personas=[self._detalle_salario(p) for p in personas],
            total=self._total_salario(personas, carnet),
        )

    def mi_nomina(self, carnet: str) -> MiNomina:
        """Nómina de la propia persona para el autoservicio del portal.

        Reutiliza `salario()` (misma resolución y mismos cálculos) y reduce la
        respuesta a lo que necesita el trabajador: identificación, totales del
        período de referencia, vacaciones acumuladas y los últimos 12 meses de
        cobros sumando todos sus expedientes.
        """
        datos = self.salario(carnet)
        if not datos.encontrado or not datos.personas:
            return MiNomina(
                carnet=(carnet or "").strip(),
                mensaje=(
                    "No apareces en la nómina de la CUJAE. Si eres trabajador y "
                    "crees que es un error, comunícate con la Dirección de "
                    "Recursos Humanos."
                ),
            )

        principal = datos.personas[0]
        activos = [p for p in datos.personas if p.Baja != 1]
        con_salario = [p for p in activos if p.actual is not None]

        # Los cobros se agrupan por mes sumando los expedientes: en pluriempleo
        # lo que cobra la persona es la suma de sus plazas, no una sola.
        por_mes: dict[tuple[int, int], dict] = {}
        for persona in datos.personas:
            for cobro in persona.cobros:
                if cobro.Ano is None or cobro.Mes is None:
                    continue
                # Las tablas de nómina traen meses en cero que no son cobros;
                # se omiten para no llenar la tabla de filas vacías.
                if not any(
                    float(valor or 0.0)
                    for valor in (
                        cobro.Salario,
                        cobro.Dias_Trabajados,
                        cobro.Vacaciones,
                        cobro.Dias_Vacaciones,
                        cobro.Subsidio,
                        cobro.Maternidad,
                    )
                ):
                    continue
                clave = (cobro.Ano, cobro.Mes)
                mes = por_mes.setdefault(
                    clave,
                    {
                        "Ano": cobro.Ano,
                        "Mes": cobro.Mes,
                        "Salario": 0.0,
                        "Dias_Trabajados": 0.0,
                        "Vacaciones": 0.0,
                        "Dias_Vacaciones": 0.0,
                    },
                )
                mes["Salario"] += float(cobro.Salario or 0.0)
                mes["Dias_Trabajados"] += float(cobro.Dias_Trabajados or 0.0)
                mes["Vacaciones"] += float(cobro.Vacaciones or 0.0)
                mes["Dias_Vacaciones"] += float(cobro.Dias_Vacaciones or 0.0)

        meses = [
            MiNominaMes(
                Ano=por_mes[clave]["Ano"],
                Mes=por_mes[clave]["Mes"],
                Salario=round(por_mes[clave]["Salario"], 2),
                Dias_Trabajados=por_mes[clave]["Dias_Trabajados"],
                Vacaciones=round(por_mes[clave]["Vacaciones"], 2),
                Dias_Vacaciones=por_mes[clave]["Dias_Vacaciones"],
            )
            for clave in sorted(por_mes, reverse=True)[:12]
        ]

        nombre = " ".join(
            parte
            for parte in (
                principal.Nombre,
                principal.Apellido_1,
                principal.Apellido_2,
            )
            if parte
        )

        # Días trabajados: se toma el mayor de los expedientes para el mes de
        # referencia. Sumarlos daría más de 31 cuando hay pluriempleo, y el
        # `Dias_Trabajados` de `RH_Resumen_de_Cobros` suele venir en cero; el
        # dato bueno está en el histórico del sueldo fijo.
        dias_por_mes: dict[tuple[int, int], float] = {}
        for persona in datos.personas:
            for historico in persona.historico:
                if (
                    historico.Ano is None
                    or historico.Mes is None
                    or historico.Dias_Trabajados is None
                ):
                    continue
                clave = (historico.Ano, historico.Mes)
                dias_por_mes[clave] = max(
                    dias_por_mes.get(clave, 0.0),
                    float(historico.Dias_Trabajados),
                )

        referencia: tuple[int, int] | None = None
        if datos.total and datos.total.periodo:
            ano_ref, mes_ref = (int(x) for x in datos.total.periodo.split("-"))
            referencia = (ano_ref, mes_ref)
        if referencia not in dias_por_mes and dias_por_mes:
            referencia = max(dias_por_mes)

        return MiNomina(
            encontrado=True,
            carnet=principal.No_CI or (carnet or "").strip(),
            nombre=nombre or None,
            area=principal.Desc_Direccion,
            cargo=principal.Desc_Cargo,
            expedientes=datos.total.expedientes if datos.total else len(activos),
            periodo=datos.total.periodo if datos.total else None,
            total=datos.total,
            dias_acumulados=round(
                sum(float(p.actual.Dias_Acumulado or 0.0) for p in con_salario),
                2,
            ),
            salario_acumulado=round(
                sum(float(p.actual.Salario_Acumulado or 0.0) for p in con_salario),
                2,
            ),
            dias_trabajados=round(dias_por_mes.get(referencia, 0.0), 2)
            if referencia
            else 0.0,
            periodo_dias=(
                f"{referencia[0]:04d}-{referencia[1]:02d}" if referencia else None
            ),
            ultimos_cobros=meses,
        )

    @staticmethod
    def _por_tramos(
        base: float, tramos: tuple[tuple[float, float, float], ...]
    ) -> float:
        """Retención de una escala progresiva: cada tramo al tipo que le toca."""
        if base <= 0:
            return 0.0
        total = 0.0
        for piso, techo, tipo in tramos:
            if base > piso:
                total += (min(base, techo) - piso) * tipo
        return round(total, 2)

    def retenciones_goc(self, bruto: float) -> tuple[float, float]:
        """Seguridad Social e Impuesto sobre Ingresos que gravan un bruto.

        Escalas de la Resolución 41/2023 (GOC-2023-271-EX20), apartados PRIMERO
        y TERCERO. Se aplican sobre el total de las remuneraciones gravadas; en
        pluriempleo ese total es la suma de todos los expedientes.
        """
        return (
            self._por_tramos(bruto, _CESS_TRAMOS),
            self._por_tramos(bruto, _IIP_TRAMOS),
        )

    def _total_salario(self, personas: list[dict], no_ci: str) -> SalarioTotal:
        """Totales de nómina de la persona, sumando todos sus expedientes.

        El salario básico suma solo los expedientes activos (los de baja no
        cuentan al haber vigente); la base gravable, en cambio, suma lo
        devengado por todos los expedientes en el período de referencia, que es
        como la ley exige tratar el pluriempleo dentro de una misma entidad.
        """
        repo = self._fact.nomina()
        activos = [p for p in personas if p.get("Baja") != 1]
        basico = sum(float(p.get("Salario_Basico") or 0.0) for p in activos)

        periodo = repo.periodo_referencia(no_ci)
        if not periodo:
            return SalarioTotal(
                expedientes=len(activos),
                Salario_Basico=round(basico, 2),
            )

        ano, mes = periodo
        datos = repo.total_periodo(no_ci, ano, mes)
        bruto = float(datos.get("Devengado") or 0.0)
        otras = float(datos.get("Deducciones") or 0.0)
        css, iip = self.retenciones_goc(bruto)
        return SalarioTotal(
            expedientes=len(activos),
            periodo=f"{ano:04d}-{mes:02d}",
            Salario_Basico=round(basico, 2),
            Devengado=round(bruto, 2),
            Seguridad_Social=css,
            Impuesto_Ingresos=iip,
            Otras_Deducciones=round(otras, 2),
            Total_Descuentos=round(css + iip + otras, 2),
            Neto=round(bruto - css - iip - otras, 2),
        )

    @staticmethod
    def _carnet_desde_ad(identificador: str) -> str | None:
        """Carné del AD para un usuario de internet, o `None` si no existe."""
        try:
            persona = buscar_persona(identificador)
        except PersonaNoEncontrada:
            return None
        return persona.get("carnet_identidad") or None

    def _detalle_salario(self, fila: dict) -> SalarioExpediente:
        """Completa los datos de un expediente con su nómina."""
        repo = self._fact.nomina()
        expediente = fila.get("Id_Expediente")
        actual = repo.salario_actual(expediente)
        periodo, nominilla = repo.nominilla(expediente)
        return SalarioExpediente(
            **fila,
            actual=SalarioComponentes(**actual) if actual else None,
            historico=[SalarioHistorico(**r) for r in repo.historico(expediente)],
            cobros=[SalarioCobro(**r) for r in repo.cobros(expediente)],
            nominilla_periodo=periodo,
            nominilla=[SalarioNominilla(**r) for r in nominilla],
        )
