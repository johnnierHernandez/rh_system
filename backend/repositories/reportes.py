from __future__ import annotations

from areas_reportes import AREA_BY_ID, AREAS_REPORTE
from db.adapter import clean_rows
from repositories.base import BaseRepository


# Unidades organizativas -> área de reporte. Se arma una sola vez a partir del
# listado de `areas_reportes.py`; las dos unidades heredadas que ya no figuran
# allí se mapean por su descripción (siguen apareciendo en fichas antiguas).
_UNIDAD_AREA: dict[str, dict] = {}
for _area in AREAS_REPORTE:
    for _unidad in _area["unidades"]:
        _UNIDAD_AREA[str(_unidad).strip().upper()] = _area
for _codigo, _area_id in (("D0000", 35), ("V0000", 31)):
    _UNIDAD_AREA.setdefault(
        _codigo, next(a for a in AREAS_REPORTE if a["id"] == _area_id)
    )


CO_CATEGORIA = {
    "1": "T",  # Técnicos
    "2": "A",  # Administrativos
    "3": "S",  # Servicios
    "4": "O",  # Operarios
    "5": "D",  # Cuadro
    "7": "D",  # Cuadro
}


class ReportesRepository(BaseRepository):
    """Repositorio de Nóminas y Reportes (prenómina, tarifa horaria, sobrecarga)."""

    def areas(self) -> list[dict]:
        """Lista de áreas de reporte con su conteo de trabajadores y docentes."""
        sql_units = []
        params: list = []
        for area in AREAS_REPORTE:
            for _unidad in area["unidades"]:
                sql_units.append("%s")
                params.append(area["unidades"].index(_unidad) if False else _unidad)
        if not sql_units:
            sql_units.append("%s")
            params.append("__NADA__")
        placeholders = ",".join(sql_units)
        rows = clean_rows(
            self._fetchall(
                f"""
                SELECT UnidadOrganizativa,
                       COUNT(*) AS trabajadores,
                       SUM(CASE WHEN Docente=1 THEN 1 ELSE 0 END) AS docentes
                FROM RSUMA14B
                WHERE UnidadOrganizativa IN ({placeholders})
                GROUP BY UnidadOrganizativa
                """,
                tuple(params),
            )
        )
        por_unidad = {}
        for r in rows:
            u = str(r["UnidadOrganizativa"]).strip()
            por_unidad[u] = {
                "trabajadores": int(r["trabajadores"]),
                "docentes": int(r["docentes"] or 0),
            }
        result = []
        for area in AREAS_REPORTE:
            total = sum(por_unidad.get(u, {}).get("trabajadores", 0) for u in area["unidades"])
            doc = sum(por_unidad.get(u, {}).get("docentes", 0) for u in area["unidades"])
            result.append(
                {
                    "id": area["id"],
                    "nombre": area["nombre"],
                    "trabajadores": total,
                    "docentes": doc,
                }
            )
        return result

    def area(self, area_id: str | int) -> dict | None:
        try:
            aid = int(area_id)
        except (TypeError, ValueError):
            return None
        return AREA_BY_ID.get(aid)

    def _unidades(self, area_id: str | int) -> list[str]:
        area = self.area(area_id)
        return list(area["unidades"]) if area else []

    def prenomina(self, area_id: str | int) -> list[dict]:
        """Prenómina PC-10: trabajadores del área que no son tarifa horaria."""
        unidades = self._unidades(area_id)
        if not unidades:
            return []
        ph = ",".join(["%s"] * len(unidades))
        return clean_rows(
            self._fetchall(
                f"""
                SELECT Id_Empleado,
                       LTRIM(RTRIM(Nombre)) AS Nombre,
                       LTRIM(RTRIM(Apellido_1)) AS Apellido_1,
                       LTRIM(RTRIM(Apellido_2)) AS Apellido_2,
                       Id_Categoria,
                       Docente
                FROM RSUMA14B
                WHERE UnidadOrganizativa IN ({ph})
                  AND Tarifa_Horaria_con_Reporte = 0
                ORDER BY Nombre, Apellido_1
                """,
                tuple(unidades),
            )
        )

    # --- Tarifa horaria: ficha del trabajador (identidad, no horas) -------

    def area_de_unidad(self, unidad: str | None) -> int:
        """Área de reporte a la que pertenece una unidad organizativa (0 si no)."""
        area = _UNIDAD_AREA.get(str(unidad or "").strip().upper())
        return int(area["id"]) if area else 0

    def buscar_trabajador_tarifa(self, nro: str) -> dict | None:
        """Resuelve el número de cumplidor (`Id_Empleado`) y su área actual.

        La unidad se toma de `RSUMA14B` (nómina vigente) porque es la misma que
        usa el reporte de prenómina; si el trabajador no está allí (por ejemplo,
        una baja), se usa la unidad de su ficha en `Empleados_Gral`. Así las
        horas no caen en un área antigua si el trabajador se trasladó.

        El Excel trae los números sin los ceros a la izquierda (7426 por
        07426), así que se prueban las dos formas. Solo se usa para identificar
        al trabajador; las horas viven en PostgreSQL.
        """
        nro = str(nro or "").strip()
        if not nro:
            return None
        candidatos = [nro]
        if nro.isdigit():
            relleno = nro.zfill(5)
            if relleno != nro:
                candidatos.append(relleno)
        sql = """
            SELECT TOP 1
                   RTRIM(e.Id_Empleado) AS Id_Empleado,
                   RTRIM(e.Id_Expediente) AS Id_Expediente,
                   RTRIM(e.No_CI) AS No_CI,
                   LTRIM(RTRIM(CONCAT(e.Nombre, ' ', e.Apellido_1, ' ', e.Apellido_2))) AS Nombre,
                   COALESCE(
                       NULLIF(RTRIM(r.UnidadOrganizativa), ''),
                       RTRIM(e.Id_Direccion)
                   ) AS Id_Direccion,
                   e.Baja
            FROM Empleados_Gral AS e
            LEFT JOIN RSUMA14B AS r
                   ON RTRIM(r.Id_Empleado) = RTRIM(e.Id_Empleado)
            WHERE RTRIM(e.Id_Empleado) = %s
        """
        for candidato in candidatos:
            fila = self._fetchone(sql, (candidato,))
            if fila:
                return clean_rows([fila])[0]
        return None

    def sobrecarga(self, area_id: str | int) -> list[dict]:
        """Sobrecarga (S.C.D.): docentes del área con categoría docente (DI)."""
        unidades = self._unidades(area_id)
        if not unidades:
            return []
        ph = ",".join(["%s"] * len(unidades))
        return clean_rows(
            self._fetchall(
                f"""
                SELECT Id_Empleado,
                       LTRIM(RTRIM(CONCAT(Nombre, ' ', Apellido_1, ' ', Apellido_2))) AS Nombre,
                       Id_Categoria,
                       LTRIM(RTRIM(Desc_Categoria_DI)) AS Categoria_Docente
                FROM RSUMA14B
                WHERE UnidadOrganizativa IN ({ph})
                  AND Docente = 1
                ORDER BY Nombre, Apellido_1
                """,
                tuple(unidades),
            )
        )

    def recien_graduados(self, area_id: str | int) -> list[dict]:
        """Adiestrados (recién graduados): tipo de contrato = Adiestramiento."""
        unidades = self._unidades(area_id)
        if not unidades:
            return []
        ph = ",".join(["%s"] * len(unidades))
        return clean_rows(
            self._fetchall(
                f"""
                SELECT Id_Empleado,
                       Id_Expediente,
                       LTRIM(RTRIM(No_CI)) AS No_CI,
                       LTRIM(RTRIM(CONCAT(Nombre, ' ', Apellido_1, ' ', Apellido_2))) AS Nombre,
                       LTRIM(RTRIM(Desc_Cargo)) AS Desc_Cargo,
                       LTRIM(RTRIM(Desc_UnidadOrganizativa)) AS Desc_UnidadOrganizativa,
                       CONVERT(varchar(10), Fecha_Contratacion, 103) AS Fecha_Contratacion
                FROM RSUMA14B
                WHERE UnidadOrganizativa IN ({ph})
                  AND Id_Tipo_Contrato = '3'
                ORDER BY Nombre, Apellido_1
                """,
                tuple(unidades),
            )
        )