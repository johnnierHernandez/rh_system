"""
Personal: ficha de trabajadores, cuadros, áreas y plantilla.

Primera parte de la división de `DRHService`, que había crecido hasta los 38
métodos y mezclaba dominios distintos. Aquí vive todo lo que responde
"quién está en la plantilla".
"""

from __future__ import annotations

from repositories import RepositoryFactory
from schemas import (
    Area,
    Cuadro,
    CuadroLista,
    Cumpleanos,
    Numeros,
    Plaza,
    PlantillaAreas,
    PlazasVacantes,
    Resumen,
    Trabajador,
    TrabajadorLista,
)


class PersonalService:
    """Consultas sobre la plantilla de personal: trabajadores y cuadros."""

    def __init__(self, factory: RepositoryFactory) -> None:
        self._fact = factory

    def resumen(self) -> Resumen:
        data = self._fact.empleados().resumen()
        return Resumen(**data) if data else Resumen.empty()

    def trabajadores(
        self, limit: int = 50, offset: int = 0, q: str = ""
    ) -> list[Trabajador]:
        return [
            Trabajador(**r) for r in self._fact.empleados().listar(limit, offset, q)
        ]

    def trabajadores_por_estado(
        self, estado: str = "activos", q: str = "", limit: int = 50, offset: int = 0
    ) -> TrabajadorLista:
        datos = self._fact.empleados().listar_por_estado(estado, q, limit, offset)
        return TrabajadorLista(
            total=int(datos["total"]),
            items=[Trabajador(**r) for r in datos["items"]],
        )

    def trabajador_por_carnet(self, no_ci: str) -> Trabajador | None:
        fila = self._fact.empleados().por_carnet(no_ci)
        return Trabajador(**fila) if fila else None

    def es_trabajador_activo(self, no_ci: str) -> bool:
        """Indica si el carné pertenece a un trabajador activo de la plantilla."""
        return self._fact.empleados().es_trabajador_activo(no_ci)

    def cuadros(
        self, q: str = "", id_direccion: str = "", limit: int = 50, offset: int = 0
    ) -> CuadroLista:
        """Cuadros activos (categoría ocupacional 5) con cargo y área.

        Devuelve el total y la página pedida para que la vista pueda paginar
        sin conocer el tamaño de la plantilla.
        """
        datos = self._fact.empleados().cuadros(q, id_direccion, limit, offset)
        return CuadroLista(
            total=int(datos["total"]),
            items=[Cuadro(**r) for r in datos["items"]],
        )

    def cuadros_exportables(self) -> list[dict]:
        """Todos los cuadros activos, sin paginar, para exportar.

        La exportación es siempre del listado completo: la vista filtra y
        pagina, pero el archivo que se descarga lleva la plantilla entera.
        """
        datos = self._fact.empleados().cuadros(limit=100000, offset=0)
        return list(datos["items"])

    def foto_por_carnet(self, no_ci: str) -> bytes | None:
        return self._fact.empleados().foto_por_carnet(no_ci)

    def numeros(self) -> Numeros:
        data = self._fact.empleados().numeros()
        return Numeros(**data) if data else Numeros.empty()

    def areas(self) -> list[Area]:
        return [Area(**r) for r in self._fact.areas().listar()]

    def area(self, area_id: str) -> Area | None:
        """Área por identificador, o `None` si no existe.

        Devuelve `None` en vez de un área vacía: la ausencia es un error real
        y la vista decide qué mostrar (404), no un dato sin contenido.
        """
        row = self._fact.areas().detalle(area_id)
        if not row:
            return None
        return Area(**row)

    def trabajadores_por_area(self, area_id: str) -> list[Trabajador]:
        return [Trabajador(**r) for r in self._fact.empleados().por_area(area_id)]

    def cumpleanos_hoy(self) -> list[Cumpleanos]:
        return [Cumpleanos(**r) for r in self._fact.empleados().cumpleanos_hoy()]


class PlantillaService:
    """Puestos y plazas: la estructura de la plantilla organizativa."""

    def __init__(self, factory: RepositoryFactory) -> None:
        self._fact = factory

    def plantilla(
        self, limit: int = 500, offset: int = 0, area: str | None = None
    ) -> list[Plaza]:
        return [
            Plaza(**r) for r in self._fact.plantilla().listar(limit, offset, area)
        ]

    def plantilla_areas(self) -> PlantillaAreas:
        return PlantillaAreas(**self._fact.plantilla().areas_con_plazas())

    def plazas_vacantes(self, limit: int = 20) -> PlazasVacantes:
        data = self._fact.plantilla().plazas_vacantes(limit)
        return PlazasVacantes(**data)
