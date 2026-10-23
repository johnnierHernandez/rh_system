"""
Errores de negocio del portal RH.

Viven en su propio módulo para que los servicios de dominio los importen sin
depender del servicio que los expone por HTTP.
"""

from __future__ import annotations


class TarifaHorariaError(Exception):
    """Error de negocio al gestionar las horas de tarifa horaria."""


class TrabajadorTarifaNoEncontrado(TarifaHorariaError):
    """El número de cumplidor no existe en la ficha del trabajador."""


class AreaTarifaNoCoincide(TarifaHorariaError):
    """El trabajador no pertenece al área seleccionada."""


class TarifaHorariaNoEncontrada(TarifaHorariaError):
    """La fila o el área de tarifa horaria no existen."""


class PeriodoCerrado(TarifaHorariaError):
    """El período ya fue cerrado y no admite cambios."""
