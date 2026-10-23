"""
Tarifa horaria: horas por trabajador y período, y su cierre.

Parte de la división de `DRHService`. Es el dominio con más reglas: el
período cerrado es inmutable, el área se toma de la ficha del trabajador y
las inserciones se hacen por `(año, mes, trabajador)`.
"""

from __future__ import annotations

from datetime import date

from repositories import RepositoryFactory
from schemas import (
    CierreTarifa,
    PeriodoTarifa,
    PeriodosTarifa,
    TarifaHorariaEntrada,
    TarifaHorariaGuardada,
    TarifaHorariaItem,
    TarifaHorariaItemAdmin,
    TarifaHorariaRespuesta,
    TarifaHorariaRespuestaAdmin,
    TrabajadorTarifa,
)
from services.dominios.errores import (
    AreaTarifaNoCoincide,
    PeriodoCerrado,
    TarifaHorariaNoEncontrada,
    TrabajadorTarifaNoEncontrado,
)
from services.tarifa_horaria import TarifaHorariaRepository

_MESES_TARIFA = (
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
)


class TarifaService:
    """Horas de tarifa horaria: consulta, inserción y cierre de períodos."""

    def __init__(
        self,
        factory: RepositoryFactory,
        tarifa: TarifaHorariaRepository | None = None,
    ) -> None:
        self._fact = factory
        self._tarifa = tarifa or TarifaHorariaRepository()

    @staticmethod
    def _periodo_tarifa() -> tuple[int, int]:
        """Período de trabajo del próximo pago: el mes en curso.

        El pago de un mes se efectúa al mes siguiente; por eso las horas que
        se insertan ahora son las del mes actual.
        """
        hoy = date.today()
        return hoy.year, hoy.month

    @staticmethod
    def _texto_periodo(ano: int, mes: int) -> str:
        """Etiqueta legible del período (``octubre 2026``)."""
        nombre = _MESES_TARIFA[mes - 1] if 1 <= mes <= 12 else str(mes)
        return f"{nombre} {ano}"

    def asegurar_tarifa(self) -> None:
        """Crea la tabla de horas de tarifa horaria en PostgreSQL si no existe."""
        self._tarifa.crear_tabla()

    def tarifa_horaria_portal(
        self,
        area_id: str | int,
        ano: int | None = None,
        mes: int | None = None,
    ) -> TarifaHorariaRespuesta:
        """Horas de tarifa horaria de un área para el período indicado.

        Sin período se usa el mes en curso, que es el que se paga al mes
        siguiente. Solo se listan los trabajadores que tienen horas insertadas:
        un área sin filas devuelve la lista vacía (la vista muestra el aviso).
        """
        repo = self._fact.reportes()
        meta = repo.area(area_id)
        if not meta:
            raise TarifaHorariaNoEncontrada("Área de reporte no encontrada")
        periodo = (int(ano), int(mes)) if ano and mes else self._periodo_tarifa()
        filas = self._tarifa.listar(periodo[0], periodo[1], area_id)
        items = [TarifaHorariaItem(**f) for f in filas]
        cierre = self._tarifa.esta_cerrado(periodo[0], periodo[1])
        return TarifaHorariaRespuesta(
            ano=periodo[0],
            mes=periodo[1],
            area=int(meta["id"]),
            area_nombre=meta["nombre"],
            items=items,
            total_horas=round(sum(i.Horas for i in items), 2),
            total_trabajadores=len(items),
            cerrado=bool(cierre),
            cerrado_por=cierre["cerrado_por"] if cierre else None,
            cerrado_en=cierre["cerrado_en"] if cierre else None,
        )

    def tarifa_horaria_admin(
        self,
        ano: int | None = None,
        mes: int | None = None,
        area: str | int | None = None,
    ) -> TarifaHorariaRespuestaAdmin:
        """Listado de gestión: todos los trabajadores con horas en el período.

        A diferencia de la consulta pública por área, este listado incluye el
        área real de cada fila para que la técnica pueda editar o eliminar sin
        cambiar de pestaña. El filtro de área es opcional.
        """
        repo = self._fact.reportes()
        periodo = (int(ano), int(mes)) if ano and mes else self._periodo_tarifa()
        meta = None
        area_filtro: int | None = None
        if area is not None and str(area).strip() != "":
            meta = repo.area(area)
            if not meta:
                raise TarifaHorariaNoEncontrada("Área de reporte no encontrada")
            area_filtro = int(meta["id"])
        filas = self._tarifa.listar_periodo(periodo[0], periodo[1], area_filtro)
        nombres_area: dict[int, str] = {}
        items: list[TarifaHorariaItemAdmin] = []
        for fila in filas:
            area_id = int(fila["Id_Area"])
            if area_id not in nombres_area:
                meta_area = repo.area(area_id)
                nombres_area[area_id] = (
                    meta_area["nombre"] if meta_area else f"Área {area_id}"
                )
            fila["area_nombre"] = nombres_area[area_id]
            items.append(TarifaHorariaItemAdmin(**fila))
        cierre = self._tarifa.esta_cerrado(periodo[0], periodo[1])
        return TarifaHorariaRespuestaAdmin(
            ano=periodo[0],
            mes=periodo[1],
            area=area_filtro,
            area_nombre=meta["nombre"] if meta else None,
            items=items,
            total_horas=round(sum(i.Horas for i in items), 2),
            total_trabajadores=len(items),
            cerrado=bool(cierre),
            cerrado_por=cierre["cerrado_por"] if cierre else None,
            cerrado_en=cierre["cerrado_en"] if cierre else None,
        )

    def buscar_tarifa(
        self,
        nro: str,
        ano: int | None = None,
        mes: int | None = None,
    ) -> TrabajadorTarifa:
        """Resuelve un número de cumplidor y devuelve su ficha y sus horas."""
        repo = self._fact.reportes()
        fila = repo.buscar_trabajador_tarifa(nro)
        if not fila:
            return TrabajadorTarifa(
                encontrado=False,
                mensaje=f"No existe un trabajador con el número {nro}.",
            )
        area = repo.area_de_unidad(fila.get("Id_Direccion"))
        meta = repo.area(area) if area else None
        periodo = (int(ano), int(mes)) if ano and mes else self._periodo_tarifa()
        horas = self._tarifa.horas(periodo[0], periodo[1], fila["Id_Empleado"])
        return TrabajadorTarifa(
            encontrado=True,
            Id_Empleado=fila.get("Id_Empleado"),
            Id_Expediente=fila.get("Id_Expediente"),
            No_CI=fila.get("No_CI"),
            Nombre=fila.get("Nombre"),
            Baja=bool(fila.get("Baja")),
            Id_Area=area,
            area_nombre=meta["nombre"] if meta else None,
            Horas=horas,
            mensaje=(
                None
                if meta
                else "La unidad de este trabajador no está en el listado de áreas."
            ),
        )

    def guardar_tarifa(
        self,
        body: TarifaHorariaEntrada,
        usuario: str | None = None,
    ) -> TarifaHorariaGuardada:
        """Inserta o actualiza las horas de un trabajador para el período.

        El área se toma de la ficha del trabajador; si la técnica seleccionó
        otra, se rechaza para que las horas no caigan en el reporte equivocado.
        """
        repo = self._fact.reportes()
        fila = repo.buscar_trabajador_tarifa(body.Id_Empleado)
        if not fila:
            raise TrabajadorTarifaNoEncontrado(
                f"No existe un trabajador con el número {body.Id_Empleado}."
            )
        area_trabajador = repo.area_de_unidad(fila.get("Id_Direccion"))
        if body.area and area_trabajador and body.area != area_trabajador:
            meta = repo.area(area_trabajador)
            nombre_area = meta["nombre"] if meta else str(area_trabajador)
            raise AreaTarifaNoCoincide(
                f"El trabajador pertenece al área «{nombre_area}», "
                "no al área seleccionada."
            )
        area = body.area or area_trabajador
        if not area:
            raise AreaTarifaNoCoincide(
                "No se pudo determinar el área del trabajador. "
                "Seleccione un área antes de insertar las horas."
            )
        meta = repo.area(area)
        if not meta:
            raise TarifaHorariaNoEncontrada("Área de reporte no encontrada")
        periodo = (
            (int(body.ano), int(body.mes))
            if body.ano and body.mes
            else self._periodo_tarifa()
        )
        if self._tarifa.esta_cerrado(periodo[0], periodo[1]):
            raise PeriodoCerrado(
                f"El período {self._texto_periodo(periodo[0], periodo[1])} está "
                "cerrado: no se pueden insertar, modificar ni eliminar horas."
            )
        row_id, creado = self._tarifa.guardar(
            ano=periodo[0],
            mes=periodo[1],
            area_id=area,
            id_empleado=fila["Id_Empleado"],
            id_expediente=fila.get("Id_Expediente"),
            no_ci=fila.get("No_CI"),
            nombre=fila.get("Nombre") or "",
            unidad=fila.get("Id_Direccion"),
            horas=body.Horas,
            baja=bool(fila.get("Baja")),
            usuario=usuario,
        )
        return TarifaHorariaGuardada(
            creado=creado,
            item=TarifaHorariaItem(
                Id=row_id,
                Id_Empleado=fila["Id_Empleado"],
                Nombre=fila.get("Nombre") or "",
                Horas=body.Horas,
                Baja=bool(fila.get("Baja")),
            ),
        )

    def actualizar_tarifa(
        self,
        row_id: int,
        horas: float,
        usuario: str | None = None,
    ) -> TarifaHorariaGuardada:
        """Actualiza las horas de una fila existente sin tocar identidad ni área."""
        fila = self._tarifa.obtener(row_id)
        if not fila:
            raise TarifaHorariaNoEncontrada("La fila ya no existe.")
        ano, mes = int(fila["ano"]), int(fila["mes"])
        if self._tarifa.esta_cerrado(ano, mes):
            raise PeriodoCerrado(
                f"El período {self._texto_periodo(ano, mes)} está cerrado: "
                "no se pueden insertar, modificar ni eliminar horas."
            )
        actualizada = self._tarifa.actualizar(row_id, horas, usuario)
        if not actualizada:
            raise TarifaHorariaNoEncontrada("La fila ya no existe.")
        return TarifaHorariaGuardada(
            creado=False,
            item=TarifaHorariaItem(**actualizada),
        )

    def eliminar_tarifa(self, row_id: int) -> None:
        """Elimina una fila de horas insertada por error (si el período está abierto)."""
        fila = self._tarifa.obtener(row_id)
        if not fila:
            raise TarifaHorariaNoEncontrada("La fila ya no existe.")
        ano, mes = int(fila["ano"]), int(fila["mes"])
        if self._tarifa.esta_cerrado(ano, mes):
            raise PeriodoCerrado(
                f"El período {self._texto_periodo(ano, mes)} está cerrado: "
                "no se pueden insertar, modificar ni eliminar horas."
            )
        if not self._tarifa.eliminar(row_id):
            raise TarifaHorariaNoEncontrada("La fila ya no existe.")

    def cerrar_tarifa(
        self,
        ano: int,
        mes: int,
        usuario: str | None = None,
    ) -> CierreTarifa:
        """Cierra el período: sus horas pasan al histórico y quedan bloqueadas."""
        cierre = self._tarifa.cerrar(int(ano), int(mes), usuario)
        return CierreTarifa(
            ano=int(cierre["ano"]),
            mes=int(cierre["mes"]),
            cerrado=True,
            cerrado_por=cierre.get("cerrado_por"),
            cerrado_en=cierre.get("cerrado_en"),
        )

    def periodos_tarifa(self) -> PeriodosTarifa:
        """Histórico de períodos con horas, del más reciente al más antiguo."""
        return PeriodosTarifa(
            periodos=[PeriodoTarifa(**f) for f in self._tarifa.listar_periodos()]
        )
