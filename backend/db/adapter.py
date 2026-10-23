"""
Patrón Adapter: adapta filas crudas de MSSQL (columnas char con trailing
spaces, nombres con espacios) al modelo limpio que esperan los repositorios.
"""

from __future__ import annotations

from typing import Any, Mapping


def clean_row(row: Mapping[str, Any]) -> dict:
    """Normaliza una fila cruda de pymssql (as_dict) a un dict limpio."""
    out: dict = {}
    for key, value in row.items():
        k = key.strip() if isinstance(key, str) else key
        if isinstance(value, str):
            value = value.strip()
        out[k] = value
    return out


def clean_rows(rows) -> list[dict]:
    """Normaliza una lista de filas crudas."""
    return [clean_row(r) for r in rows]