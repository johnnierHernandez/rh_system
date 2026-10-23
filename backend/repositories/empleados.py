from __future__ import annotations

from dataclasses import dataclass

from db.adapter import clean_row, clean_rows
from repositories.base import BaseRepository


@dataclass
class Trabajador:
    Id_Expediente: str | None = None
    No_CI: str | None = None
    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Id_Direccion: str | None = None
    Id_Cargo: str | None = None
    Sexo: str | None = None
    Docente: bool | None = None
    Investigador: bool | None = None
    Fecha_Contratacion: str | None = None
    Fecha_Baja: str | None = None


class EmpleadosRepository(BaseRepository):
    def resumen(self) -> dict:
        activos = self._count(
            "SELECT COUNT(*) AS n FROM Empleados_Gral WHERE Baja=0 AND Alta=1"
        )
        baja = self._count("SELECT COUNT(*) AS n FROM Empleados_Gral WHERE Baja=1")
        total = self._count("SELECT COUNT(*) AS n FROM Empleados_Gral")
        areas = self._count("SELECT COUNT(*) AS n FROM RH_Unidades_Organizativas")
        cargos = self._count("SELECT COUNT(*) AS n FROM RH_Cargos")
        return {
            "empleados_activos": activos,
            "empleados_baja": baja,
            "total_empleados": total,
            "areas": areas,
            "cargos": cargos,
        }

    def listar(self, limit: int = 50, offset: int = 0, q: str = "") -> list[dict]:
        where = "Baja=0 AND Alta=1"
        params: list = []
        if q:
            where += " AND (Nombre LIKE %s OR Apellido_1 LIKE %s OR No_CI LIKE %s)"
            like = f"%{q}%"
            params = [like, like, like]
        sql = f"""
            SELECT Id_Expediente, No_CI, Nombre, Apellido_1, Apellido_2,
                   Id_Direccion, Id_Cargo, Sexo, Docente, Investigador,
                   CONVERT(varchar(23), Fecha_Contratacion, 121) AS Fecha_Contratacion,
                   CONVERT(varchar(23), Fecha_Baja, 121) AS Fecha_Baja
            FROM Empleados_Gral
            WHERE {where}
            ORDER BY Nombre, Apellido_1
            OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
        """
        return clean_rows(self._fetchall(sql, (*params, offset, limit)))

    def listar_por_estado(
        self,
        estado: str = "activos",
        q: str = "",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Trabajadores de un estado con búsqueda por nombre/apellidos/CI.

        `estado` acepta "activos" (Baja=0 y Alta=1) o cualquier otro valor
        como "baja"/"inactivos" (Baja=1). La búsqueda `q` se separa en
        términos: cada término debe aparecer (contiene) en nombre, alguno de
        los dos apellidos o el carné de identidad. Devuelve el total y la
        página pedida para poder paginar.
        """
        activos = estado and str(estado).strip().lower() in {"activos", "activo"}
        where = "e.Baja = 0 AND e.Alta = 1" if activos else "e.Baja = 1"
        params: list = []
        terminos = [t for t in (q or "").split() if t]
        if terminos:
            condiciones = []
            for termino in terminos:
                like = f"%{termino}%"
                params.append(like)
                condiciones.append(
                    "(e.Nombre LIKE %s OR e.Apellido_1 LIKE %s "
                    "OR e.Apellido_2 LIKE %s OR e.No_CI LIKE %s)"
                )
                params.extend([like, like, like])
            where += " AND (" + " AND ".join(condiciones) + ")"

        base = """
            FROM Empleados_Gral e
            LEFT JOIN RH_Unidades_Organizativas u
              ON u.Id_Direccion = e.Id_Direccion
            WHERE {where}
        """
        total = self._count(f"SELECT COUNT(*) AS n {base.format(where=where)}", params)
        items = self._fetchall(
            f"""
            SELECT e.Id_Expediente, e.No_CI, e.Nombre, e.Apellido_1,
                   e.Apellido_2, e.Id_Direccion, u.Desc_Direccion, e.Id_Cargo,
                   e.Sexo, e.Docente, e.Investigador,
                   CONVERT(varchar(23), e.Fecha_Contratacion, 121)
                       AS Fecha_Contratacion,
                   CONVERT(varchar(23), e.Fecha_Baja, 121) AS Fecha_Baja
            {base.format(where=where)}
            ORDER BY e.Nombre, e.Apellido_1, e.Apellido_2
            OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
            """,
            (*params, offset, limit),
        )
        return {"total": total, "items": clean_rows(items)}

    def por_carnet(self, no_ci: str) -> dict | None:
        """Un trabajador por carné, sea activo o de baja, con su cargo y área."""
        if not no_ci or not no_ci.strip():
            return None
        fila = self._fetchone(
            """
            SELECT TOP 1 e.Id_Expediente, e.No_CI, e.Nombre, e.Apellido_1,
                   e.Apellido_2, e.Id_Direccion, u.Desc_Direccion, e.Id_Cargo,
                   c.Desc_Cargo, e.Sexo, e.Docente, e.Investigador,
                   CONVERT(varchar(23), e.Fecha_Contratacion, 121)
                       AS Fecha_Contratacion,
                   CONVERT(varchar(23), e.Fecha_Baja, 121) AS Fecha_Baja,
                   e.Baja
            FROM Empleados_Gral e
            LEFT JOIN RH_Unidades_Organizativas u
              ON u.Id_Direccion = e.Id_Direccion
            LEFT JOIN RH_Cargos c ON c.Id_Cargo = e.Id_Cargo
            WHERE e.No_CI = %s
            ORDER BY e.Baja, CAST(e.Id_Expediente AS int)
            """,
            (no_ci,),
        )
        return clean_row(fila) if fila else None

    def es_trabajador_activo(self, no_ci: str) -> bool:
        """True si el carné tiene una ficha activa en la plantilla.

        Es el criterio de acceso al portal: la nómina es la fuente de verdad
        de quién trabaja aquí, no el indicador `es_estudiante` del AD (hay
        trabajadores que también estudian y lo tienen activo).
        """
        if not no_ci or not no_ci.strip():
            return False
        fila = self._fetchone(
            """
            SELECT COUNT(*) AS n FROM Empleados_Gral
            WHERE RTRIM(No_CI) = %s AND Baja = 0 AND Alta = 1
            """,
            (no_ci.strip(),),
        )
        return bool(fila and int(fila["n"]) > 0)

    def foto_por_carnet(self, no_ci: str) -> bytes | None:
        """Fotografía almacenada en `Empleados_Gral.Foto` para ese carné."""
        if not no_ci or not no_ci.strip():
            return None
        fila = self._fetchone(
            """
            SELECT TOP 1 Foto FROM Empleados_Gral
            WHERE RTRIM(No_CI) = %s AND Foto IS NOT NULL
            """,
            (no_ci,),
        )
        if not fila:
            return None
        foto = fila.get("Foto")
        return bytes(foto) if foto else None

    def por_area(self, area_id: str) -> list[dict]:
        return clean_rows(
            self._fetchall(
                """
                SELECT Id_Expediente, No_CI, Nombre, Apellido_1, Apellido_2,
                       Id_Direccion, Id_Cargo, Sexo, Docente, Investigador,
                       CONVERT(varchar(23), Fecha_Contratacion, 121) AS Fecha_Contratacion,
                       CONVERT(varchar(23), Fecha_Baja, 121) AS Fecha_Baja
                FROM Empleados_Gral
                WHERE Baja=0 AND Alta=1 AND Id_Direccion=%s
                ORDER BY Nombre, Apellido_1
                """,
                (area_id,),
            )
        )

    def cumpleanos_hoy(self) -> list[dict]:
        """Cumpleañeros del día, una fila por persona.

        Hay empleados con dos registros activos (plaza doble): 26 CI aparecen
        dos veces entre los 1.088 activos. Se deduplica por No_CI quedándose con
        el Id_Expediente menor, que es la plaza original de la persona. En los
        26 casos el expediente menor coincide con el contrato más antiguo, así
        que la regla no depende de Fecha_Contratacion, que es más frágil.
        Se exige No_CI informado para que un NULL no colapse personas distintas.
        """
        return clean_rows(
            self._fetchall(
                """
                WITH hoy AS (
                    SELECT e.No_CI, e.Nombre, e.Apellido_1, e.Apellido_2,
                           e.Id_Direccion, u.Desc_Direccion,
                           e.Id_Expediente, e.Fecha_Nacimiento
                    FROM Empleados_Gral e
                    LEFT JOIN RH_Unidades_Organizativas u
                           ON u.Id_Direccion = e.Id_Direccion
                    WHERE e.Baja = 0 AND e.Alta = 1
                      AND e.No_CI IS NOT NULL
                      AND LTRIM(RTRIM(e.No_CI)) <> ''
                      AND MONTH(e.Fecha_Nacimiento) = MONTH(GETDATE())
                      AND DAY(e.Fecha_Nacimiento) = DAY(GETDATE())
                ), uno_por_persona AS (
                    SELECT *, ROW_NUMBER() OVER (
                        PARTITION BY No_CI
                        ORDER BY CAST(Id_Expediente AS int)
                    ) AS rn
                    FROM hoy
                )
                SELECT Nombre, Apellido_1, Apellido_2, Id_Direccion,
                       Desc_Direccion,
                       CONVERT(varchar(10), Fecha_Nacimiento, 23) AS Fecha_Nacimiento
                FROM uno_por_persona
                WHERE rn = 1
                ORDER BY Nombre, Apellido_1, Apellido_2
                """
            )
        )

    _ACTIVOS = "e.Baja=0 AND e.Alta=1"  # alias obligatorio: RH_Unidades_Organizativas también tiene "Baja"
    _SEXO = {"F": "Mujeres", "M": "Hombres"}

    @staticmethod
    def _pct(valor: int, total: int) -> float:
        return round(valor * 100.0 / total, 1) if total else 0.0

    def _items(self, sql: str) -> list[dict]:
        """Convierte filas (etiqueta, n) en items con porcentaje sobre el total."""
        total = self._count(f"SELECT COUNT(*) AS n FROM Empleados_Gral e WHERE {self._ACTIVOS}")
        return [
            {
                "etiqueta": row["etiqueta"],
                "valor": int(row["n"]),
                "porcentaje": self._pct(int(row["n"]), total),
            }
            for row in clean_rows(self._fetchall(sql))
            if row["etiqueta"]
        ]

    def numeros(self) -> dict:
        """Cifras de la plantilla activa: sexo, contratos, categorías y top de unidades."""
        activos = self._ACTIVOS
        total = self._count(f"SELECT COUNT(*) AS n FROM Empleados_Gral e WHERE {activos}")
        docentes = self._count(
            f"SELECT COUNT(*) AS n FROM Empleados_Gral e WHERE {activos} AND e.Docente=1"
        )
        unidades = self._count(
            f"SELECT COUNT(DISTINCT e.Id_Direccion) AS n FROM Empleados_Gral e WHERE {activos}"
        )
        corte = self._fetchone("SELECT CONVERT(varchar(10), GETDATE(), 120) AS f")

        sexo = [
            {
                "etiqueta": self._SEXO.get(str(row["k"]).strip(), str(row["k"])),
                "valor": int(row["n"]),
                "porcentaje": self._pct(int(row["n"]), total),
            }
            for row in clean_rows(
                self._fetchall(
                    f"""
                    SELECT e.Sexo AS k, COUNT(*) AS n
                    FROM Empleados_Gral e
                    WHERE {activos} AND e.Sexo IS NOT NULL
                    GROUP BY e.Sexo
                    """
                )
            )
        ]
        sexo.sort(key=lambda i: i["valor"], reverse=True)

        return {
            "total_activos": total,
            "docentes": docentes,
            "no_docentes": total - docentes,
            "unidades": unidades,
            "fecha_corte": (corte or {}).get("f"),
            "sexo": sexo,
            "contratos": self._items(
                f"""
                SELECT c.Desc_Tipo_Contrato AS etiqueta, COUNT(*) AS n
                FROM Empleados_Gral e
                JOIN RH_Contratos_Tipos c ON c.Id_Tipo_Contrato = e.Id_Tipo_Contrato
                WHERE {activos}
                GROUP BY c.Desc_Tipo_Contrato
                ORDER BY n DESC
                """
            ),
            "categorias_docentes": self._items(
                f"""
                SELECT c.Desc_Categoria_DI AS etiqueta, COUNT(*) AS n
                FROM Empleados_Gral e
                JOIN RH_Categorias_Docente_Invest c ON c.Id_Categoria_DI = e.Id_Categoria_DI
                WHERE {activos}
                GROUP BY c.Desc_Categoria_DI
                ORDER BY n DESC
                """
            ),
            "ocupacional": self._items(
                f"""
                SELECT c.Desc_Categoria AS etiqueta, COUNT(*) AS n
                FROM Empleados_Gral e
                JOIN RH_Categorias_Ocupacionales c ON c.Id_Categoria = e.Id_Categoria
                WHERE {activos}
                GROUP BY c.Desc_Categoria
                ORDER BY n DESC
                """
            ),
            "top_unidades": [
                {
                    "id_direccion": str(row["id_direccion"]),
                    "etiqueta": row["etiqueta"],
                    "valor": int(row["n"]),
                }
                for row in clean_rows(
                    self._fetchall(
                        f"""
                        SELECT TOP 8 e.Id_Direccion AS id_direccion,
                               u.Desc_Direccion AS etiqueta, COUNT(*) AS n
                        FROM Empleados_Gral e
                        JOIN RH_Unidades_Organizativas u
                          ON u.Id_Direccion = e.Id_Direccion
                        WHERE {activos}
                        GROUP BY e.Id_Direccion, u.Desc_Direccion
                        ORDER BY n DESC, etiqueta
                        """
                    )
                )
            ],
        }

    # Categoría ocupacional que identifica a un cuadro. El catálogo
    # `RH_Categorias_Ocupacionales` tiene DOS filas con
    # `Desc_Categoria = 'Cuadro'` (códigos 5 y 7), así que se filtra siempre por
    # código y nunca por descripción: agrupar por el texto fusionaría ambos
    # códigos y el día que se asigne alguien al 7 se sumaría al total sin que
    # nadie lo note. El código 7 no tiene ningún registro en toda la tabla, y su
    # `CUCPromIndex` es 0, o sea quedaría fuera de la escala de estimulación.
    CATEGORIA_CUADRO = "5"

    def cuadros(
        self,
        q: str = "",
        id_direccion: str = "",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Cuadros activos con cargo y área, más el total para poder paginar.

        Una persona puede tener dos plazas (dirección + docencia, por ejemplo),
        así que se deduplica por `No_CI` quedándose con el `Id_Expediente`
        menor, igual que `cumpleanos_hoy`: el listado es de personas, no de
        plazas. Se exige `No_CI` informado para que un NULL no colapse a
        personas distintas. `RH_Cargos` y `RH_Unidades_Organizativas` entran
        como LEFT JOIN para que un cargo o área que falte en el catálogo no
        esconda al cuadro de la lista.

        La búsqueda `q` separa términos y cada uno debe aparecer en el nombre,
        en cualquiera de los dos apellidos, en el carné, en el cargo o en el
        área.
        """
        where = [self._ACTIVOS, f"e.Id_Categoria = '{self.CATEGORIA_CUADRO}'"]
        params: list = []

        if id_direccion and id_direccion.strip():
            where.append("e.Id_Direccion = %s")
            params.append(id_direccion.strip())

        terminos = [t for t in (q or "").split() if t]
        if terminos:
            condiciones = []
            for termino in terminos:
                like = f"%{termino}%"
                condiciones.append(
                    "(e.Nombre LIKE %s OR e.Apellido_1 LIKE %s "
                    "OR e.Apellido_2 LIKE %s OR e.No_CI LIKE %s "
                    "OR c.Desc_Cargo LIKE %s OR u.Desc_Direccion LIKE %s)"
                )
                params.extend([like] * 6)
            where.append("(" + " AND ".join(condiciones) + ")")

        base = f"""
            FROM Empleados_Gral e
            LEFT JOIN RH_Cargos c ON c.Id_Cargo = e.Id_Cargo
            LEFT JOIN RH_Unidades_Organizativas u
              ON u.Id_Direccion = e.Id_Direccion
            WHERE {" AND ".join(where)}
              AND e.No_CI IS NOT NULL
              AND LTRIM(RTRIM(e.No_CI)) <> ''
        """

        total = self._count(
            f"""
            WITH uno_por_persona AS (
                SELECT e.No_CI,
                       ROW_NUMBER() OVER (
                           PARTITION BY e.No_CI
                           ORDER BY CAST(e.Id_Expediente AS int)
                       ) AS rn
                {base}
            )
            SELECT COUNT(*) AS n FROM uno_por_persona WHERE rn = 1
            """,
            params,
        )

        items = self._fetchall(
            f"""
            WITH uno_por_persona AS (
                SELECT e.No_CI, e.Nombre, e.Apellido_1, e.Apellido_2,
                       e.Id_Cargo, c.Desc_Cargo,
                       e.Id_Direccion, u.Desc_Direccion,
                       ROW_NUMBER() OVER (
                           PARTITION BY e.No_CI
                           ORDER BY CAST(e.Id_Expediente AS int)
                       ) AS rn
                {base}
            )
            SELECT No_CI, Nombre, Apellido_1, Apellido_2,
                   Id_Cargo, Desc_Cargo, Id_Direccion, Desc_Direccion
            FROM uno_por_persona
            WHERE rn = 1
            ORDER BY Desc_Direccion, Apellido_1, Apellido_2, Nombre
            OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
            """,
            (*params, offset, limit),
        )
        return {"total": total, "items": clean_rows(items)}