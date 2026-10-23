"""Autenticación y autorización del portal administrativo.

Flujo de un inicio de sesión:

1. Se hace bind con la **cuenta de servicio** del AD y se busca a la persona
   por su usuario de internet, carné o correo. Esto confirma que la cuenta
   existe y da su DN real.
2. Se hace bind **como la persona** con su clave. Solo el AD valida la
   contraseña; aquí no se guarda ninguna.
3. La fila de la persona se crea sola la primera vez con perfil `invitado`.
   Quien administer el portal después la importa y le asigna su perfil real.

Las decisiones de autorización se toman por **permiso** (`require_permiso`),
nunca por el nombre del perfil, y los permisos efectivos son los del perfil
activo. Mismo criterio que el sistema "viajes" (CT 7022).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable

from fastapi import Depends, Header, HTTPException

from config import settings
from services import permisos as P
from services.ldap_portal import (
    CredencialesInvalidas,
    CuentaDesactivada,
    LDAPNoDisponible,
    PersonaNoEncontrada,
    buscar_persona,
    verificar_credenciales,
)

__all__ = [
    "CredencialesInvalidas",
    "CuentaDesactivada",
    "identidad_de",
    "LDAPNoDisponible",
    "NoEsTrabajador",
    "PersonaNoEncontrada",
    "SesionInvalida",
    "autenticar",
    "exigir_admin",
    "exigir_permiso",
    "exigir_sesion",
    "impersonar",
    "sesion_actual",
    "verificar_token",
]

SESSION_COOKIE = "rh_sesion"


class SesionInvalida(Exception):
    """El token no es válido, expiró o el usuario ya no existe."""


class NoEsTrabajador(Exception):
    """La cuenta del AD no tiene ficha activa en la plantilla de la CUJAE."""


# ---------------------------------------------------------------------------
# Token firmado
# ---------------------------------------------------------------------------


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).decode("ascii").rstrip("=")


def _desb64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def _clave() -> bytes:
    secreto = settings.session_secret
    if not secreto:
        raise RuntimeError("SESSION_SECRET no está definido")
    return secreto.encode("utf-8")


def _firmar(payload: dict) -> str:
    cuerpo = _b64(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    firma = hmac.new(_clave(), cuerpo.encode("ascii"), hashlib.sha256).digest()
    return f"{cuerpo}.{_b64(firma)}"


def verificar_token(token: str | None) -> dict | None:
    """Devuelve el contenido del token, o None si no es válido o expiró."""
    if not token or "." not in token:
        return None
    cuerpo, _, firma = token.rpartition(".")
    try:
        esperada = hmac.new(_clave(), cuerpo.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_desb64(firma), esperada):
            return None
        payload = json.loads(_desb64(cuerpo))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def emitir_token(carnet: str, impersonador: str | None = None) -> str:
    """Token de sesión. `impersonador` guarda quién entró como suplantando."""
    payload: dict = {
        "sub": carnet,
        "exp": int(time.time()) + settings.session_ttl_hours * 3600,
    }
    if impersonador:
        payload["imp"] = impersonador
    return _firmar(payload)


# ---------------------------------------------------------------------------
# Resolución de la sesión
# ---------------------------------------------------------------------------


def _token_de(authorization: str | None, cookie: str | None) -> str | None:
    if authorization:
        partes = authorization.split(None, 1)
        if len(partes) == 2 and partes[0].lower() == "bearer":
            return partes[1].strip() or None
    if cookie:
        for parte in cookie.split(";"):
            nombre, _, valor = parte.strip().partition("=")
            if nombre == SESSION_COOKIE and valor:
                return valor
    return None


def sesion_actual(
    authorization: str | None = Header(default=None),
    cookie: str | None = Header(default=None, alias="Cookie"),
) -> dict:
    """Devuelve la identidad viva del token: la fila se relee en cada petición.

    Releer la BD en cada request es lo que hace que quitarle un perfil a
    alguien surta efecto de inmediato, sin esperar a que expire su token.
    """
    from services.usuarios import UsuariosRepository

    payload = verificar_token(_token_de(authorization, cookie))
    if payload is None:
        raise SesionInvalida("Sesión no válida o expirada")

    carnet = str(payload.get("sub") or "")
    usuario = UsuariosRepository().obtener(carnet) if carnet else None
    if usuario is None:
        raise SesionInvalida("El usuario de esta sesión ya no existe")
    if not usuario.get("activo", False):
        raise SesionInvalida("Tu usuario está desactivado")

    return identidad_de(usuario, payload.get("imp"))


def identidad_de(usuario: dict, impersonador: str | None = None) -> dict:
    """Arma la identidad pública de la sesión a partir de la fila del usuario."""
    return {
        "carnet_identidad": usuario["carnet_identidad"],
        "usuario_internet": usuario.get("usuario_internet"),
        "nombre": usuario.get("nombre"),
        "apellidos": usuario.get("apellidos"),
        "email_institucional": usuario.get("email_institucional"),
        "area": usuario.get("area"),
        "departamento": usuario.get("departamento"),
        "perfiles": P.perfiles_asignados(usuario),
        "perfil_activo": P.perfil_activo_de(usuario),
        "perfil_activo_nombre": P.nombre_perfil(P.perfil_activo_de(usuario)),
        "permisos": P.permisos_de(usuario),
        "perfiles_detalle": P.detalle_perfiles(usuario),
        "impersonando": impersonador,
    }


# --- Dependencias de FastAPI ----------------------------------------------


def exigir_sesion(
    authorization: str | None = Header(default=None),
    cookie: str | None = Header(default=None, alias="Cookie"),
) -> dict:
    """Sesión válida. Responde 401 si falta, expiró o el usuario ya no existe."""
    try:
        return sesion_actual(authorization, cookie)
    except SesionInvalida as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def exigir_permiso(permiso: str):
    """Dependencia que exige un permiso concreto del perfil activo."""

    def _dependencia(sesion: dict = Depends(exigir_sesion)) -> dict:
        if permiso not in (sesion.get("permisos") or []):
            raise HTTPException(
                status_code=403,
                detail=f"Necesitas el permiso {permiso!r} para esta operación.",
            )
        return sesion

    return _dependencia


def exigir_admin(sesion: dict = Depends(exigir_sesion)) -> dict:
    """Abrevia `exigir_permiso("usuarios.administrar")`."""
    return exigir_permiso("usuarios.administrar")(sesion)


# ---------------------------------------------------------------------------
# Inicio de sesión
# ---------------------------------------------------------------------------


def _asegurar_perfiles(usuario: dict) -> dict:
    """Invitado por defecto; las cuentas de arranque, superadmin, siempre.

    El perfil se reaplica en cada ingreso: si alguien le quitara el
    `superadmin` a una cuenta de arranque por la vía que sea, al siguiente
    login se le devuelve.
    """
    cambios = []
    if usuario["carnet_identidad"] in P.superadmines_por_carnet():
        if "superadmin" not in (usuario.get("perfiles") or []):
            cambios.append("superadmin")
    elif not [c for c in usuario.get("perfiles") or [] if P.perfil_existe(c)]:
        cambios.append(P.PERFIL_INVITADO)

    repo = None
    for perfil in cambios:
        from services.usuarios import UsuariosRepository

        repo = repo or UsuariosRepository()
        usuario = repo.aplicar_perfil(usuario["carnet_identidad"], perfil)
    return usuario


def autenticar(
    usuario: str,
    clave: str,
    es_trabajador: Callable[[str], bool] | None = None,
) -> dict:
    """Valida las credenciales en el AD y devuelve la identidad de la sesión.

    Lanza `CredencialesInvalidas` si el AD rechaza el bind, `LDAPNoDisponible`
    si el directorio no responde, `PersonaNoEncontrada` si la cuenta existe
    pero no trae carné de identidad y `NoEsTrabajador` si el carné no tiene
    ficha activa en la plantilla.

    `es_trabajador` es la consulta a la nómina (se inyecta para no acoplar
    este módulo a MSSQL). Cuando se omite no se comprueba la plantilla, cosa
    que solo usan las pruebas.
    """
    from services.usuarios import UsuariosRepository

    identificador = (usuario or "").strip()
    if not identificador or not clave:
        raise CredencialesInvalidas("Escribe tu usuario y tu clave")

    # El propio bind devuelve la persona, así que no hace falta buscarla dos
    # veces. Si la cuenta no existe o la clave está mal, el mismo mensaje:
    # no se le dice a nadie si un usuario existe o no.
    persona = verificar_credenciales(identificador, clave)

    ci = (persona.get("carnet_identidad") or "").strip()
    if not ci:
        raise PersonaNoEncontrada("Tu cuenta del AD no tiene carné de identidad")

    # Solo los trabajadores activos de la plantilla entran al portal. Los
    # estudiantes no tienen ficha en `Empleados_Gral` y quedan fuera. El
    # indicador `es_estudiante` del AD no sirve para esto: hay trabajadores
    # que también estudian y lo tienen activo.
    if es_trabajador is not None and not es_trabajador(ci):
        if ci not in settings.acceso_sin_nomina:
            raise NoEsTrabajador(
                "El portal es solo para trabajadores activos de la CUJAE. "
                "Si eres trabajador y no apareces en la plantilla, comunícate "
                "con la Dirección de Recursos Humanos."
            )

    repo = UsuariosRepository()
    fila = repo.sincronizar(persona)

    # Una cuenta suspendida puede seguir existiendo en el AD, así que el bind
    # es correcto. Lo que se corta es el acceso al portal, y se dice
    # explícitamente para que quien entra sepa que debe hablar con RRHH en vez
    # de pensar que escribió mal su clave.
    if not fila.get("activo", False):
        raise CuentaDesactivada(
            "Tu usuario está suspendido del portal. Comunícate con la "
            "Dirección de Recursos Humanos."
        )

    fila = _asegurar_perfiles(fila)

    return {
        "identidad": identidad_de(fila),
        "token": emitir_token(ci),
    }


def impersonar(ci: str, sesion_admin: dict) -> dict:
    """Emite una sesión como otra persona, dejando rastro de quién la abre.

    Solo quien tenga `sesiones.impersonar` puede hacerlo, y una sesión ya
    suplantada no puede suplantar a un tercero: sin eso, un administrador
    suplantado podría escalar a quien ella quiera.
    """
    from services.usuarios import UsuariosRepository

    if sesion_admin.get("impersonando"):
        raise HTTPException(
            status_code=403,
            detail="No se puede suplantar desde una sesión suplantada",
        )
    if "sesiones.impersonar" not in (sesion_admin.get("permisos") or []):
        raise HTTPException(
            status_code=403, detail="Necesitas el permiso sesiones.impersonar"
        )

    objetivo = UsuariosRepository().obtener(ci)
    if objetivo is None:
        raise PersonaNoEncontrada(f"El usuario {ci} no está en el portal")
    if not objetivo.get("activo", False):
        raise HTTPException(
            status_code=400, detail="No se puede suplantar a un usuario desactivado"
        )

    return {
        "identidad": identidad_de(objetivo, sesion_admin["carnet_identidad"]),
        "token": emitir_token(ci, impersonador=sesion_admin["carnet_identidad"]),
    }
