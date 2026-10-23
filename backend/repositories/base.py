"""
Repositorio base: abstracción de acceso a datos.
Cada repositorio concreto encapsula las consultas SQL de su entidad.
"""

from __future__ import annotations

from typing import Any

from db.pool import ConnectionPool


class BaseRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def _fetchall(self, sql: str, params: tuple | None = None) -> list[dict]:
        with self._pool.connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params or ())
            return cur.fetchall()

    def _fetchone(self, sql: str, params: tuple | None = None) -> dict | None:
        with self._pool.connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params or ())
            return cur.fetchone()

    def _count(self, sql: str, params: tuple | None = None) -> int:
        row = self._fetchone(sql, params)
        return int(row["n"]) if row else 0

    def _execute(self, sql: str, params: tuple | None = None) -> int:
        """Ejecuta una sentencia de escritura y devuelve las filas afectadas.

        Las conexiones del pool se crean con `autocommit=True`, así que el
        cambio queda confirmado al terminar `execute`; el `commit()` explícito
        es inocuo y mantiene el método correcto si algún día se cambia el pool.
        """
        with self._pool.connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params or ())
            conn.commit()
            return int(cur.rowcount)