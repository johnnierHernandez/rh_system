"""Autorización por área para los reportes del portal.

Replica la lógica del sistema "viajes" (CT 7022, `servicios_acceso.py` y
`services/rh.py`) adaptada a este backend:

- El **área** de una persona se resuelve desde su `Id_Direccion` en
  `Empleados_Gral` y se traduce al `area_id` de `AREAS_REPORTE` (la misma
  correspondencia unidad -> área que ya usan los reportes).
- Un jefe de área accede a **su área de reporte completa** (decisión tomada
  con el usuario), no solo a su unidad suelta.
- Para **designar delegados** se usa la regla híbrida de subárea de viajes
  (`es_subarea_por_plantilla`): el jefe solo puede autorizar a alguien que
  pertenezca a su área o a un área dependiente.

La comprobación de acceso es deliberadamente laxa en lo que no es suyo: si la
persona no tiene `Id_Direccion` resoluble o el área no mapea a `AREAS_REPORTE`,
se devuelve `None` (indeterminado) y el llamador decide. Solo se deniega de
forma explícita cuando hay dos áreas resueltas y son distintas.
"""

from __future__ import annotations

from areas_reportes import AREAS_REPORTE

# unidad (Id_Direccion en mayúsculas) -> area_id de AREAS_REPORTE
_UNIDAD_A_AREA: dict[str, int] = {}
for _a in AREAS_REPORTE:
    for _u in _a["unidades"]:
        _UNIDAD_A_AREA[str(_u).strip().upper()] = int(_a["id"])


def area_de_unidad(id_direccion: str | None) -> int | None:
    """Traduce un `Id_Direccion` a su `area_id` de reporte, si corresponde."""
    if not id_direccion:
        return None
    return _UNIDAD_A_AREA.get(str(id_direccion).strip().upper())


def normalizar_nombre(nombre: str | None) -> str:
    """Minúsculas sin acentos, para comparar nombres de área como en viajes."""
    import unicodedata

    texto = (nombre or "").strip().lower()
    texto = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    return " ".join(texto.split())


def _significativo(codigo: str) -> str:
    """Código sin los ceros finales (ej. 'AB000' -> 'AB')."""
    return (codigo or "").rstrip("0")


def _es_subarea_por_codigo(padre: str, hijo: str) -> bool:
    """Regla de código de viajes: el hijo cuelga del prefijo del padre."""
    if not padre or not hijo:
        return False
    if padre == hijo:
        return True
    prefijo = _significativo(padre) + "0"
    return len(hijo) > len(prefijo) and hijo.startswith(prefijo)


class AreasRH:
    """Resuelve y compara áreas contra la base de RRHH (MSSQL).

    Todo pasa por `por_carnet`, que ya devuelve `Id_Direccion` y
    `Desc_Direccion` en una sola consulta: con eso basta para la regla
    híbrida de viajes (código o nombre), sin tocar el catálogo de unidades.
    """

    def __init__(self, empleados_repo) -> None:
        self._empleados = empleados_repo

    def ficha(self, carnet: str | None) -> dict:
        """Ficha del trabajador (con `Id_Direccion` y `Desc_Direccion`)."""
        if not carnet:
            return {}
        return self._empleados.por_carnet(carnet) or {}

    def unidad_por_carnet(self, carnet: str | None) -> str | None:
        """`Id_Direccion` vigente de una persona en `Empleados_Gral`."""
        unidad = (self.ficha(carnet).get("Id_Direccion") or "").strip()
        return unidad or None

    def es_misma_area_o_subarea(self, unidad_padre: str | None, desc_padre: str | None,
                                unidad_hijo: str | None, desc_hijo: str | None) -> bool:
        """Regla híbrida de viajes: mismo código O nombreprefijo.

        Las descripciones vienen resueltas en la ficha de cada persona, así
        que no hace falta volver a consultar el catálogo.
        """
        if not unidad_padre or not unidad_hijo:
            return False
        padre = unidad_padre.strip().upper()
        hijo = unidad_hijo.strip().upper()
        if padre == hijo:
            return True
        if _es_subarea_por_codigo(padre, hijo):
            return True
        np = normalizar_nombre(desc_padre)
        nh = normalizar_nombre(desc_hijo)
        if not np or not nh:
            return False
        return len(np) >= 10 and nh.startswith(np)


def puede_acceder_area(
    sesion: dict,
    area_id: int,
    usuario_areas_ids: set[int],
) -> bool:
    """¿La sesión puede consultar el `area_id` indicado?

    - `negocio.ver` (alta dirección, especialista RH) ve todo: es su trabajo.
    - `superadmin` (cuentas de arranque) ve todo por supervisión; es el único
      rol que no toca datos de negocio pero sí puede auditarlos.
    - `area.ver` (jefes y delegados) ve solo las áreas en `usuario_areas_ids`.
    - Cualquier otro permiso no da acceso a estos reportes.
    """
    permisos = set(sesion.get("permisos") or [])
    if "negocio.ver" in permisos or "superadmin" in (sesion.get("perfiles") or []):
        return True
    if "area.ver" in permisos:
        return int(area_id) in usuario_areas_ids
    return False
