"""
Fachada del portal RH.

Expone una API de alto nivel (métodos de dominio) ocultando repositorios,
SQL y modelos internos a los routers HTTP.

Cada dominio vive en su propio servicio (`services.dominios`): personal,
salarios, reportes y tarifa horaria. Esta fachada solo compone y delega, de
modo que los routers no cambian y ningún dominio crece mezclado con otro.
"""

from __future__ import annotations

from repositories import RepositoryFactory
from schemas import (
    Area,
    CierreTarifa,
    CuadroLista,
    Cumpleanos,
    MiNomina,
    Numeros,
    PeriodosTarifa,
    Plaza,
    PlantillaAreas,
    PlazasVacantes,
    PlazasVacantesArea,
    RecienGraduado,
    Resumen,
    SalarioRespuesta,
    TarifaHorariaEntrada,
    TarifaHorariaGuardada,
    TarifaHorariaRespuesta,
    TarifaHorariaRespuestaAdmin,
    Trabajador,
    TrabajadorLista,
    TrabajadorTarifa,
)
from services.dominios.errores import (
    AreaTarifaNoCoincide,
    PeriodoCerrado,
    TarifaHorariaError,
    TarifaHorariaNoEncontrada,
    TrabajadorTarifaNoEncontrado,
)
from services.dominios.personal import PersonalService, PlantillaService
from services.dominios.reportes import ReportesService
from services.dominios.salarios import SalarioService
from services.dominios.tarifa import TarifaService
from services.tarifa_horaria import TarifaHorariaRepository

__all__ = [
    "AreaTarifaNoCoincide",
    "DRHService",
    "PeriodoCerrado",
    "TarifaHorariaError",
    "TarifaHorariaNoEncontrada",
    "TrabajadorTarifaNoEncontrado",
]


class DRHService:
    """
    Patrón Facade: una única puerta de entrada para los routers HTTP.

    Delega en un servicio por dominio. Los routers no cambian al dividir el
    código: siguen llamando a `service.<metodo>()`.
    """

    def __init__(
        self,
        factory: RepositoryFactory,
        tarifa: TarifaHorariaRepository | None = None,
    ) -> None:
        self._fact = factory
        self._personal = PersonalService(factory)
        self._plantilla = PlantillaService(factory)
        self._salarios = SalarioService(factory)
        self._reportes = ReportesService(factory)
        self._tarifa = TarifaService(factory, tarifa)

    # --- Personal ---------------------------------------------------------

    def resumen(self) -> Resumen:
        return self._personal.resumen()

    def trabajadores(
        self, limit: int = 50, offset: int = 0, q: str = ""
    ) -> list[Trabajador]:
        return self._personal.trabajadores(limit, offset, q)

    def trabajadores_por_estado(
        self, estado: str = "activos", q: str = "", limit: int = 50, offset: int = 0
    ) -> TrabajadorLista:
        return self._personal.trabajadores_por_estado(estado, q, limit, offset)

    def trabajador_por_carnet(self, no_ci: str) -> Trabajador | None:
        return self._personal.trabajador_por_carnet(no_ci)

    def es_trabajador_activo(self, no_ci: str) -> bool:
        return self._personal.es_trabajador_activo(no_ci)

    def cuadros(
        self, q: str = "", id_direccion: str = "", limit: int = 50, offset: int = 0
    ) -> CuadroLista:
        return self._personal.cuadros(q, id_direccion, limit, offset)

    def cuadros_exportables(self) -> list[dict]:
        return self._personal.cuadros_exportables()

    def foto_por_carnet(self, no_ci: str) -> bytes | None:
        return self._personal.foto_por_carnet(no_ci)

    def numeros(self) -> Numeros:
        return self._personal.numeros()

    def areas(self) -> list[Area]:
        return self._personal.areas()

    def area(self, area_id: str) -> Area | None:
        return self._personal.area(area_id)

    def trabajadores_por_area(self, area_id: str) -> list[Trabajador]:
        return self._personal.trabajadores_por_area(area_id)

    def cumpleanos_hoy(self) -> list[Cumpleanos]:
        return self._personal.cumpleanos_hoy()

    # --- Plantilla --------------------------------------------------------

    def plantilla(
        self, limit: int = 500, offset: int = 0, area: str | None = None
    ) -> list[Plaza]:
        return self._plantilla.plantilla(limit, offset, area)

    def plantilla_areas(self) -> PlantillaAreas:
        return self._plantilla.plantilla_areas()

    def plazas_vacantes(self, limit: int = 20) -> PlazasVacantes:
        return self._plantilla.plazas_vacantes(limit)

    # --- Salarios ---------------------------------------------------------

    def salario(self, identificador: str) -> SalarioRespuesta:
        return self._salarios.salario(identificador)

    def mi_nomina(self, carnet: str) -> MiNomina:
        return self._salarios.mi_nomina(carnet)

    def retenciones_goc(self, bruto: float) -> tuple[float, float]:
        return self._salarios.retenciones_goc(bruto)

    # --- Reportes ---------------------------------------------------------

    def areas_reporte(self) -> list[dict]:
        return self._reportes.areas_reporte()

    def area_reporte(self, area_id: str | int) -> dict | None:
        return self._reportes.area_reporte(area_id)

    def prenomina(self, area_id: str | int) -> list[dict]:
        return self._reportes.prenomina(area_id)

    def sobrecarga(self, area_id: str | int) -> list[dict]:
        return self._reportes.sobrecarga(area_id)

    def recien_graduados(self, area_id: str | int) -> list[RecienGraduado]:
        return self._reportes.recien_graduados(area_id)

    def plazas_vacantes_area(self, area_id: str | int) -> PlazasVacantesArea:
        return self._reportes.plazas_vacantes_area(area_id)

    # --- Tarifa horaria ---------------------------------------------------

    def asegurar_tarifa(self) -> None:
        return self._tarifa.asegurar_tarifa()

    def tarifa_horaria_portal(
        self,
        area_id: str | int,
        ano: int | None = None,
        mes: int | None = None,
    ) -> TarifaHorariaRespuesta:
        return self._tarifa.tarifa_horaria_portal(area_id, ano, mes)

    def tarifa_horaria_admin(
        self,
        ano: int | None = None,
        mes: int | None = None,
        area: str | int | None = None,
    ) -> TarifaHorariaRespuestaAdmin:
        return self._tarifa.tarifa_horaria_admin(ano, mes, area)

    def buscar_tarifa(
        self,
        nro: str,
        ano: int | None = None,
        mes: int | None = None,
    ) -> TrabajadorTarifa:
        return self._tarifa.buscar_tarifa(nro, ano, mes)

    def guardar_tarifa(
        self,
        body: TarifaHorariaEntrada,
        usuario: str | None = None,
    ) -> TarifaHorariaGuardada:
        return self._tarifa.guardar_tarifa(body, usuario)

    def actualizar_tarifa(
        self,
        row_id: int,
        horas: float,
        usuario: str | None = None,
    ) -> TarifaHorariaGuardada:
        return self._tarifa.actualizar_tarifa(row_id, horas, usuario)

    def eliminar_tarifa(self, row_id: int) -> None:
        return self._tarifa.eliminar_tarifa(row_id)

    def cerrar_tarifa(
        self,
        ano: int,
        mes: int,
        usuario: str | None = None,
    ) -> CierreTarifa:
        return self._tarifa.cerrar_tarifa(ano, mes, usuario)

    def periodos_tarifa(self) -> PeriodosTarifa:
        return self._tarifa.periodos_tarifa()
