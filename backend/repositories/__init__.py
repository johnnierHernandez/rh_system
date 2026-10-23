from __future__ import annotations

from repositories.areas import AreasRepository
from repositories.empleados import EmpleadosRepository
from repositories.nomina import NominaRepository
from repositories.plantilla import PlantillaRepository
from repositories.reportes import ReportesRepository


class RepositoryFactory:
    """
    Patrón Factory Method: fábrica central que decide qué repositorio concreto
    instanciar según la entidad solicitada. El pool de conexiones se inyecta.
    Instancias singleton por repositorio.
    """

    def __init__(self, pool) -> None:
        self._pool = pool
        self._empleados: EmpleadosRepository | None = None
        self._areas: AreasRepository | None = None
        self._nomina: NominaRepository | None = None
        self._plantilla: PlantillaRepository | None = None
        self._reportes: ReportesRepository | None = None

    def empleados(self) -> EmpleadosRepository:
        if self._empleados is None:
            self._empleados = EmpleadosRepository(self._pool)
        return self._empleados

    def areas(self) -> AreasRepository:
        if self._areas is None:
            self._areas = AreasRepository(self._pool)
        return self._areas

    def nomina(self) -> NominaRepository:
        if self._nomina is None:
            self._nomina = NominaRepository(self._pool)
        return self._nomina

    def plantilla(self) -> PlantillaRepository:
        if self._plantilla is None:
            self._plantilla = PlantillaRepository(self._pool)
        return self._plantilla

    def reportes(self) -> ReportesRepository:
        if self._reportes is None:
            self._reportes = ReportesRepository(self._pool)
        return self._reportes