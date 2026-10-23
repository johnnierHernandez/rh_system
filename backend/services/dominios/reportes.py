"""
Reportes: nóminas, sobrecarga y vacantes por área.

Parte de la división de `DRHService` que agrupa las consultas de reporte.
"""

from __future__ import annotations

from repositories import RepositoryFactory
from schemas import PlazasVacantesArea, PlazaVacante, RecienGraduado


class ReportesService:
    """Datos agregados por área para los reportes del portal."""

    def __init__(self, factory: RepositoryFactory) -> None:
        self._fact = factory

    def areas_reporte(self) -> list[dict]:
        return self._fact.reportes().areas()

    def area_reporte(self, area_id: str | int) -> dict | None:
        return self._fact.reportes().area(area_id)

    def prenomina(self, area_id: str | int) -> list[dict]:
        return self._fact.reportes().prenomina(area_id)

    def sobrecarga(self, area_id: str | int) -> list[dict]:
        return self._fact.reportes().sobrecarga(area_id)

    def recien_graduados(self, area_id: str | int) -> list[RecienGraduado]:
        return [
            RecienGraduado(**r) for r in self._fact.reportes().recien_graduados(area_id)
        ]

    def plazas_vacantes_area(self, area_id: str | int) -> PlazasVacantesArea:
        meta = self._fact.reportes().area(area_id)
        if not meta:
            return PlazasVacantesArea.empty(str(area_id))
        filas = self._fact.plantilla().vacantes_por_area(area_id)
        return PlazasVacantesArea(
            area=str(area_id),
            area_nombre=meta["nombre"],
            total=len(filas),
            unidades=list(meta["unidades"]),
            plazas=[PlazaVacante(**r) for r in filas],
        )
