"""Horas de tarifa horaria en PostgreSQL (BD local `rh_portal`).

Esta tabla es la **única fuente** de las horas que se publican en el reporte.
No se leen de las tablas del sistema anterior (`RH_Detalles_Reporte_Tarifa_Horaria`
ni `RSUMA14B`): las inserta la técnica desde el portal, o se cargan una sola
vez desde el Excel del pago.

La ficha del trabajador (nombre, área, baja) se resuelve en MSSQL solo para
identificarlo; las horas y el período viven aquí.
"""

from __future__ import annotations

import psycopg2
import psycopg2.extras

from config import settings


class TarifaHorariaRepository:
    """Persistencia de las horas de tarifa horaria en PostgreSQL."""

    def __init__(self) -> None:
        self.dsn = (
            f"host={settings.pg_host} port={settings.pg_port} "
            f"dbname={settings.pg_db} user={settings.pg_user} "
            f"password={settings.pg_pass} connect_timeout=5"
        )

    def _conn(self):
        conn = psycopg2.connect(self.dsn)
        conn.set_client_encoding("UTF8")
        return conn

    def crear_tabla(self) -> None:
        """Crea la tabla de horas si no existe (idempotente)."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tarifa_horaria_horas (
                        id              BIGSERIAL PRIMARY KEY,
                        ano             SMALLINT NOT NULL,
                        mes             SMALLINT NOT NULL,
                        area_id         INTEGER NOT NULL,
                        id_empleado     VARCHAR(15) NOT NULL,
                        id_expediente   VARCHAR(15),
                        no_ci           VARCHAR(15),
                        nombre          VARCHAR(200) NOT NULL,
                        unidad          VARCHAR(15),
                        horas           NUMERIC(8,2) NOT NULL CHECK (horas > 0),
                        baja            BOOLEAN NOT NULL DEFAULT FALSE,
                        creado_por      VARCHAR(100),
                        creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
                        actualizado_por VARCHAR(100),
                        actualizado_en  TIMESTAMPTZ,
                        CONSTRAINT uq_tarifa_horaria_periodo_empleado
                            UNIQUE (ano, mes, id_empleado)
                    )
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_tarifa_horaria_periodo_area "
                    "ON tarifa_horaria_horas (ano, mes, area_id)"
                )
                # Un período cerrado queda en el histórico y no admite cambios.
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tarifa_horaria_cierres (
                        ano         SMALLINT NOT NULL,
                        mes         SMALLINT NOT NULL,
                        cerrado_por VARCHAR(100),
                        cerrado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
                        PRIMARY KEY (ano, mes)
                    )
                    """
                )

    def listar(self, ano: int, mes: int, area_id: str | int) -> list[dict]:
        """Filas de horas de un área y período, con los activos delante.

        Devuelve las claves que espera `TarifaHorariaItem` (`Id`, `Id_Empleado`,
        `Nombre`, `Horas`, `Baja`).
        """
        try:
            aid = int(area_id)
        except (TypeError, ValueError):
            return []
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id          AS "Id",
                           id_empleado AS "Id_Empleado",
                           nombre      AS "Nombre",
                           horas       AS "Horas",
                           baja        AS "Baja"
                    FROM tarifa_horaria_horas
                    WHERE ano = %s AND mes = %s AND area_id = %s
                    ORDER BY baja, nombre
                    """,
                    (ano, mes, aid),
                )
                return [dict(f) for f in cur.fetchall()]

    def listar_periodo(
        self,
        ano: int,
        mes: int,
        area_id: str | int | None = None,
    ) -> list[dict]:
        """Todas las filas de un período, opcionalmente filtradas por área.

        Es el listado de gestión: incluye ``Id_Area`` para que la vista pueda
        mostrar el área real de cada trabajador y editar/eliminar por fila.
        """
        sql = """
            SELECT id          AS "Id",
                   id_empleado AS "Id_Empleado",
                   nombre      AS "Nombre",
                   horas       AS "Horas",
                   baja        AS "Baja",
                   area_id     AS "Id_Area"
            FROM tarifa_horaria_horas
            WHERE ano = %s AND mes = %s
        """
        params: list[object] = [ano, mes]
        if area_id is not None and str(area_id).strip() != "":
            try:
                aid = int(area_id)
            except (TypeError, ValueError):
                return []
            sql += " AND area_id = %s"
            params.append(aid)
        sql += " ORDER BY area_id, baja, nombre"
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, tuple(params))
                return [dict(f) for f in cur.fetchall()]

    def horas(self, ano: int, mes: int, id_empleado: str) -> float | None:
        """Horas que ya tiene el trabajador en el período (None si no hay fila)."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT horas
                    FROM tarifa_horaria_horas
                    WHERE ano = %s AND mes = %s AND id_empleado = %s
                    """,
                    (ano, mes, id_empleado),
                )
                fila = cur.fetchone()
                return float(fila[0]) if fila else None

    def esta_cerrado(self, ano: int, mes: int) -> dict | None:
        """Datos del cierre del período, o None si sigue abierto."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT ano, mes, cerrado_por, cerrado_en
                    FROM tarifa_horaria_cierres
                    WHERE ano = %s AND mes = %s
                    """,
                    (ano, mes),
                )
                fila = cur.fetchone()
                return dict(fila) if fila else None

    def cerrar(self, ano: int, mes: int, usuario: str | None) -> dict:
        """Cierra el período (idempotente) y devuelve sus datos de cierre."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO tarifa_horaria_cierres (ano, mes, cerrado_por)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (ano, mes) DO NOTHING
                    """,
                    (ano, mes, usuario),
                )
                cur.execute(
                    """
                    SELECT ano, mes, cerrado_por, cerrado_en
                    FROM tarifa_horaria_cierres
                    WHERE ano = %s AND mes = %s
                    """,
                    (ano, mes),
                )
                return dict(cur.fetchone())

    def obtener(self, row_id: int) -> dict | None:
        """Fila de horas por id (para saber su período antes de borrar)."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, ano, mes FROM tarifa_horaria_horas WHERE id = %s",
                    (int(row_id),),
                )
                fila = cur.fetchone()
                return dict(fila) if fila else None

    def listar_periodos(self) -> list[dict]:
        """Histórico de períodos con horas, del más reciente al más antiguo."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT h.ano,
                           h.mes,
                           COUNT(*)              AS trabajadores,
                           SUM(h.horas)          AS horas,
                           (c.ano IS NOT NULL)   AS cerrado,
                           c.cerrado_por,
                           c.cerrado_en
                    FROM tarifa_horaria_horas h
                    LEFT JOIN tarifa_horaria_cierres c
                           ON c.ano = h.ano AND c.mes = h.mes
                    GROUP BY h.ano, h.mes, c.ano, c.cerrado_por, c.cerrado_en
                    ORDER BY h.ano DESC, h.mes DESC
                    """
                )
                return [dict(f) for f in cur.fetchall()]

    def guardar(
        self,
        *,
        ano: int,
        mes: int,
        area_id: int,
        id_empleado: str,
        id_expediente: str | None,
        no_ci: str | None,
        nombre: str,
        unidad: str | None,
        horas: float,
        baja: bool,
        usuario: str | None,
    ) -> tuple[int, bool]:
        """Inserta o actualiza las horas de un trabajador. Devuelve (id, creado)."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id
                    FROM tarifa_horaria_horas
                    WHERE ano = %s AND mes = %s AND id_empleado = %s
                    """,
                    (ano, mes, id_empleado),
                )
                creado = cur.fetchone() is None
                cur.execute(
                    """
                    INSERT INTO tarifa_horaria_horas
                        (ano, mes, area_id, id_empleado, id_expediente, no_ci,
                         nombre, unidad, horas, baja, creado_por)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ano, mes, id_empleado) DO UPDATE SET
                        area_id         = EXCLUDED.area_id,
                        id_expediente   = EXCLUDED.id_expediente,
                        no_ci           = EXCLUDED.no_ci,
                        nombre          = EXCLUDED.nombre,
                        unidad          = EXCLUDED.unidad,
                        horas           = EXCLUDED.horas,
                        baja            = EXCLUDED.baja,
                        actualizado_por = EXCLUDED.creado_por,
                        actualizado_en  = now()
                    RETURNING id
                    """,
                    (
                        ano, mes, area_id, id_empleado, id_expediente, no_ci,
                        nombre, unidad, float(horas), bool(baja), usuario,
                    ),
                )
                fila = cur.fetchone()
                return int(fila["id"]), creado

    def actualizar(
        self,
        row_id: int,
        horas: float,
        usuario: str | None,
    ) -> dict | None:
        """Actualiza solo las horas de una fila y devuelve la fila editada."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    UPDATE tarifa_horaria_horas
                    SET horas = %s,
                        actualizado_por = %s,
                        actualizado_en = now()
                    WHERE id = %s
                    RETURNING id          AS "Id",
                              id_empleado AS "Id_Empleado",
                              nombre      AS "Nombre",
                              horas       AS "Horas",
                              baja        AS "Baja"
                    """,
                    (float(horas), usuario, int(row_id)),
                )
                fila = cur.fetchone()
                return dict(fila) if fila else None

    def eliminar(self, row_id: int) -> int:
        """Elimina una fila por su id. Devuelve las filas borradas."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM tarifa_horaria_horas WHERE id = %s",
                    (int(row_id),),
                )
                return int(cur.rowcount)
