from __future__ import annotations

from areas_reportes import AREA_BY_ID, AREAS_REPORTE
from db.adapter import clean_rows
from repositories.base import BaseRepository


class PlantillaRepository(BaseRepository):
    def unidades_de_area(self, area_id: str | int) -> list[str]:
        try:
            aid = int(area_id)
        except (TypeError, ValueError):
            return []
        area = AREA_BY_ID.get(aid)
        return list(area["unidades"]) if area else []

    def listar(self, limit: int = 500, offset: int = 0, area_id: str | int | None = None) -> list[dict]:
        """Plantilla con la persona que ocupa cada plaza, resuelta con OUTER APPLY
        igual que el plantilla.php del sistema viejo. De aquel módulo no se
        recuperan el CI ni el salario: solo nombre y fechas."""
        limit = max(1, min(limit, 1000))
        offset = max(0, offset)
        where, params = "", ()
        if area_id is not None and str(area_id).strip() != "":
            unidades = self.unidades_de_area(area_id)
            if not unidades:
                return []
            where = "WHERE LTRIM(RTRIM(p.Id_Direccion)) IN (" + ",".join(["%s"] * len(unidades)) + ")"
            params = tuple(unidades)
        return clean_rows(
            self._fetchall(
                f"""
                SELECT p.Id_Direccion, u.Desc_Direccion, p.Id_Cargo,
                       c.Desc_Cargo, p.Vacante,
                       e.Nombre, e.Apellido_1, e.Apellido_2,
                       e.Fecha_Contratacion, e.Fecha_Cargo
                FROM RH_Plantilla_Plazas p
                LEFT JOIN RH_Unidades_Organizativas u ON u.Id_Direccion = p.Id_Direccion
                LEFT JOIN RH_Cargos c ON c.Id_Cargo = p.Id_Cargo
                OUTER APPLY (
                    SELECT TOP 1 g.Nombre, g.Apellido_1, g.Apellido_2,
                           CONVERT(varchar(10), g.Fecha_Contratacion, 23) AS Fecha_Contratacion,
                           CONVERT(varchar(10), g.Fecha_Cargo, 23) AS Fecha_Cargo
                    FROM Empleados_Gral g
                    WHERE g.Plaza = p.Plaza
                      AND LTRIM(RTRIM(g.Id_Cargo)) = LTRIM(RTRIM(p.Id_Cargo))
                      AND LTRIM(RTRIM(g.Id_Direccion)) = LTRIM(RTRIM(p.Id_Direccion))
                      AND g.Baja = 0 AND g.Alta = 1
                    ORDER BY g.Id_Expediente
                ) e
                {where}
                ORDER BY u.Desc_Direccion, p.Orden
                OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
                """,
                params + (offset, limit),
            )
        )

    def areas_con_plazas(self) -> dict:
        """Áreas del árbol del sistema viejo que tienen al menos una plaza, con
        su total y sus vacantes, para el selector de /plantilla."""
        filas = self._fetchall(
            """
            SELECT LTRIM(RTRIM(Id_Direccion)) AS unidad, COUNT(*) AS n,
                   SUM(CASE WHEN Vacante = 1 THEN 1 ELSE 0 END) AS v
            FROM RH_Plantilla_Plazas
            GROUP BY LTRIM(RTRIM(Id_Direccion))
            """
        )
        por_unidad = {f["unidad"]: (f["n"], f["v"]) for f in filas}
        total = sum(n for n, _ in por_unidad.values())
        vacantes = sum(v for _, v in por_unidad.values())
        areas = []
        for a in AREAS_REPORTE:
            n = v = 0
            for unidad in a["unidades"]:
                if unidad in por_unidad:
                    un, uv = por_unidad[unidad]
                    n += un
                    v += uv
            if n:
                areas.append(
                    {"id": a["id"], "nombre": a["nombre"], "total": n, "vacantes": v}
                )
        return {
            "total": total,
            "cubiertas": total - vacantes,
            "vacantes": vacantes,
            "areas": areas,
        }

    def vacantes_por_area(self, area_id: str | int) -> list[dict]:
        """Espejo de plazas.php (sistema viejo): solo plazas vacantes del área,
        agrupadas por unidad, con categoría e importes (Básico/Plus/Estímulo/Otros)."""
        unidades = self.unidades_de_area(area_id)
        if not unidades:
            return []
        ph = ",".join(["%s"] * len(unidades))
        return clean_rows(
            self._fetchall(
                f"""
                SELECT p.Plaza, p.Nivel, p.Id_Direccion, u.Desc_Direccion,
                       p.Id_Cargo, c.Desc_Cargo, c.Id_Categoria, c.Desc_Categoria,
                       c.Salario_Basico, c.Plus, c.Estimulo, c.Otros
                FROM RH_Plantilla_Plazas p
                LEFT JOIN RH_Unidades_Organizativas u ON u.Id_Direccion = p.Id_Direccion
                LEFT JOIN RH_Cargos c ON c.Id_Cargo = p.Id_Cargo
                WHERE p.Vacante = 1 AND p.Id_Direccion IN ({ph})
                ORDER BY u.Desc_Direccion, p.Orden
                """,
                tuple(unidades),
            )
        )

    def total_vacantes_area(self, area_id: str | int) -> int:
        return len(self.vacantes_por_area(area_id))

    def plazas_vacantes(self, limit: int = 20) -> dict:
        limit = max(1, min(limit, 100))
        total = self._count(
            "SELECT COUNT(*) AS n FROM RH_Plantilla_Plazas WHERE Vacante=1"
        )
        plazas = clean_rows(
            self._fetchall(
                """
                SELECT p.Id_Direccion, u.Desc_Direccion, p.Id_Cargo, c.Desc_Cargo
                FROM RH_Plantilla_Plazas p
                LEFT JOIN RH_Unidades_Organizativas u ON u.Id_Direccion = p.Id_Direccion
                LEFT JOIN RH_Cargos c ON c.Id_Cargo = p.Id_Cargo
                WHERE p.Vacante = 1
                ORDER BY u.Desc_Direccion
                OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
                """,
                (0, limit),
            )
        )
        return {"total": total, "plazas": plazas}
