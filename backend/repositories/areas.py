from __future__ import annotations

from db.adapter import clean_row, clean_rows
from repositories.base import BaseRepository


class AreasRepository(BaseRepository):
    def listar(self) -> list[dict]:
        return clean_rows(
            self._fetchall(
                """
                SELECT u.Id_Direccion, u.Desc_Direccion, u.Id_DireccionPadre,
                       (SELECT COUNT(*) FROM Empleados_Gral e
                        WHERE e.Baja=0 AND e.Alta=1 AND e.Id_Direccion=u.Id_Direccion
                       ) AS trabajadores
                FROM RH_Unidades_Organizativas u
                WHERE LEN(RTRIM(u.Desc_Direccion)) > 0
                ORDER BY u.Desc_Direccion
                """
            )
        )

    def detalle(self, area_id: str) -> dict | None:
        row = self._fetchone(
            """
            SELECT u.Id_Direccion, u.Desc_Direccion, u.Id_DireccionPadre,
                   (SELECT COUNT(*) FROM Empleados_Gral e
                    WHERE e.Baja=0 AND e.Alta=1 AND e.Id_Direccion=u.Id_Direccion
                   ) AS trabajadores
            FROM RH_Unidades_Organizativas u
            WHERE u.Id_Direccion=%s
            """,
            (area_id,),
        )
        return clean_row(row) if row else None