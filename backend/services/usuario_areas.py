"""Áreas de reporte autorizadas por usuario del portal (PostgreSQL).

Una fila por (carné, área de reporte). Es lo que permite que un jefe de área
y sus delegados consulten plantilla, nóminas, tarifa horaria, recién
graduados y S.C.D. **solo de su área**, en lugar de ver todas.

El modelo se inspira en el sistema "viajes" (CT 7022): el área no se guarda
como texto libre sino que se resuelve contra `AREAS_REPORTE`, y la pertenencia
de una persona a un área se valida con la misma regla híbrida de subárea
(código o nombre) que usa viajes para autorizar a un jefe sobre su gente.

`es_jefe` distingue al titular del área (lo marca el administrador al
importarlo) de un delegado (lo designa el jefe). Da igual para consultar:
ambos tienen `area.ver`. Importa para quién puede designar a otros.
"""

from __future__ import annotations

import psycopg2
import psycopg2.extras

from config import settings


class UsuarioAreasRepository:
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
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS usuario_areas (
                        carnet_identidad VARCHAR(24) NOT NULL,
                        area_id         INTEGER     NOT NULL,
                        es_jefe         BOOLEAN     NOT NULL DEFAULT FALSE,
                        otorgado_por    VARCHAR(24),
                        creado          TIMESTAMPTZ NOT NULL DEFAULT now(),
                        PRIMARY KEY (carnet_identidad, area_id)
                    )
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_usuario_areas_area "
                    "ON usuario_areas (area_id)"
                )

    def asignar(
        self,
        carnet: str,
        area_id: int,
        es_jefe: bool = False,
        otorgado_por: str | None = None,
    ) -> dict:
        """Vincula un carné a un área. Idempotente: reasigna sin duplicar."""
        with self._conn() as conn:
            with conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cur:
                cur.execute(
                    """
                    INSERT INTO usuario_areas
                        (carnet_identidad, area_id, es_jefe, otorgado_por)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (carnet_identidad, area_id) DO UPDATE SET
                        es_jefe      = EXCLUDED.es_jefe,
                        otorgado_por = EXCLUDED.otorgado_por
                    RETURNING carnet_identidad, area_id, es_jefe,
                              otorgado_por, creado
                    """,
                    (carnet, int(area_id), bool(es_jefe), otorgado_por),
                )
                return dict(cur.fetchone())

    def quitar(self, carnet: str, area_id: int) -> bool:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM usuario_areas "
                    "WHERE carnet_identidad = %s AND area_id = %s",
                    (carnet, int(area_id)),
                )
                return cur.rowcount > 0

    def areas_de(self, carnet: str) -> list[dict]:
        """Áreas asignadas a un carné, con el detalle de cada una."""
        with self._conn() as conn:
            with conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cur:
                cur.execute(
                    """
                    SELECT carnet_identidad, area_id, es_jefe, otorgado_por,
                           creado
                    FROM usuario_areas
                    WHERE carnet_identidad = %s
                    ORDER BY area_id
                    """,
                    (carnet,),
                )
                return [dict(r) for r in cur.fetchall()]

    def ids_de(self, carnet: str) -> set[int]:
        """Solo los `area_id` de un carné, para la comprobación rápida."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT area_id FROM usuario_areas "
                    "WHERE carnet_identidad = %s",
                    (carnet,),
                )
                return {int(r[0]) for r in cur.fetchall()}

    def es_jefe_de(self, carnet: str, area_id: int) -> bool:
        """¿El carné es titular (jefe) del área indicada?"""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM usuario_areas "
                    "WHERE carnet_identidad = %s AND area_id = %s AND es_jefe",
                    (carnet, int(area_id)),
                )
                return cur.fetchone() is not None

    def delegados_de_area(self, area_id: int) -> list[dict]:
        """Personas vinculadas al área que no son el jefe titular."""
        with self._conn() as conn:
            with conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cur:
                cur.execute(
                    """
                    SELECT a.carnet_identidad, a.area_id, a.es_jefe,
                           a.otorgado_por, a.creado,
                           u.nombre, u.apellidos, u.usuario_internet
                    FROM usuario_areas a
                    LEFT JOIN usuarios u
                      ON u.carnet_identidad = a.carnet_identidad
                    WHERE a.area_id = %s AND NOT a.es_jefe
                    ORDER BY a.creado DESC
                    """,
                    (int(area_id),),
                )
                return [dict(r) for r in cur.fetchall()]

    def jefes(self) -> list[dict]:
        """Todas las asignaciones de jefe titular (carné -> área).

        Para la vista de administración: permite pintar de una sola consulta
        quién está marcado como jefe de área, sin hacer una consulta por
        cuadro.
        """
        with self._conn() as conn:
            with conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cur:
                cur.execute(
                    """
                    SELECT carnet_identidad, area_id
                    FROM usuario_areas
                    WHERE es_jefe
                    ORDER BY area_id
                    """
                )
                return [dict(r) for r in cur.fetchall()]

    def resumen(self) -> list[dict]:
        """Áreas con su jefe y sus delegados, para la vista de administración."""
        with self._conn() as conn:
            with conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cur:
                cur.execute(
                    """
                    SELECT a.area_id,
                           MAX(u.nombre) FILTER (WHERE a.es_jefe)     AS nombre,
                           MAX(u.apellidos) FILTER (WHERE a.es_jefe)  AS apellidos,
                           MAX(a.carnet_identidad) FILTER (WHERE a.es_jefe)
                                                                   AS carnet_jefe,
                           COUNT(*) FILTER (WHERE NOT a.es_jefe)     AS delegados
                    FROM usuario_areas a
                    LEFT JOIN usuarios u
                      ON u.carnet_identidad = a.carnet_identidad
                    GROUP BY a.area_id
                    ORDER BY a.area_id
                    """
                )
                return [dict(r) for r in cur.fetchall()]
