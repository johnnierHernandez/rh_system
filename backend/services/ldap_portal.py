"""Conexión y consultas al Active Directory de la CUJAE (LDAP).

Adaptado del sistema "viajes" (CT 7022), pero usando `ldap3` (puro Python)
en lugar de `python-ldap`. Sirve para el módulo de administración: importar
usuarios por carné de identidad (cn) o por usuario de internet
(sAMAccountName / mail / userPrincipalName).
"""

from __future__ import annotations

import ssl as _ssl
from typing import Any

from ldap3 import SUBTREE, Connection, Server, Tls
from ldap3.core.exceptions import (
    LDAPBindError,
    LDAPException,
    LDAPInvalidCredentialsResult,
    LDAPSocketOpenError,
)

from config import settings


class LDAPNoDisponible(Exception):
    """El servidor LDAP no respondió o las credenciales de servicio fallaron."""


class PersonaNoEncontrada(Exception):
    """No existe ninguna cuenta con ese identificador."""


class CredencialesInvalidas(Exception):
    """El AD rechazó el bind con las credenciales de la persona."""


class CuentaDesactivada(Exception):
    """La cuenta existe y la clave es correcta, pero está suspendida."""


def _atributos() -> list[str]:
    return [
        "cn",
        "sAMAccountName",
        "givenName",
        "sn",
        "mail",
        "department",
        "userPrincipalName",
        "cUJAEDataProvider",
        "jpegPhoto",
    ]


def _buscar(conn: Connection, q: str):
    """Devuelve la entrada de la persona, o None si no hay ninguna."""
    if not conn.search(
        settings.ldap_base_dn,
        _filtro_busqueda(q),
        SUBTREE,
        attributes=_atributos(),
        size_limit=10,
    ):
        return None
    return conn.entries[0] if conn.entries else None


def verificar_credenciales(identificador: str, clave: str) -> dict:
    """Valida la contraseña haciendo bind al AD *como la persona*.

    Se hace en dos pasos, igual que el sistema "viajes": primero se entra con
    la cuenta de servicio para *buscar* a la persona y obtener su DN real, y
    después se entra con ese DN y la clave que escribió. Así no hay que
    adivinar el formato del nombre de cuenta ni el dominio.

    La contraseña no se guarda ni se registra en ningún sitio. El mensaje de
    error es el mismo si la cuenta no existe y si la clave está mal, para no
    confirmar qué cuentas hay en el directorio.

    Devuelve los datos de la persona, para no tener que buscarla otra vez.
    """
    q = (identificador or "").strip()
    if not clave:
        raise CredencialesInvalidas("La contraseña no puede ir vacía")

    # Paso 1: cuenta de servicio, solo para localizar la cuenta.
    conn = _conectar()
    try:
        entrada = _buscar(conn, q)
    finally:
        try:
            conn.unbind()
        except LDAPException:
            pass
    if entrada is None:
        raise CredencialesInvalidas("Usuario o contraseña incorrectos")

    # Paso 2: bind como la persona, que es el que valida la clave.
    tls = Tls(validate=_ssl.CERT_NONE)
    server = Server(
        settings.ldap_server,
        use_ssl=True,
        tls=tls,
        connect_timeout=settings.ldap_timeout,
    )
    propia: Connection | None = None
    try:
        propia = Connection(
            server,
            user=str(entrada.entry_dn),
            password=clave,
            auto_bind=True,
            raise_exceptions=True,
            receive_timeout=settings.ldap_timeout,
        )
    except LDAPInvalidCredentialsResult as exc:
        raise CredencialesInvalidas(
            "Usuario o contraseña incorrectos"
        ) from exc
    except LDAPBindError as exc:
        # El DN existe pero no se puede usar para ese bind: clave inválida o
        # cuenta bloqueada. Mismo mensaje, por el mismo motivo.
        raise CredencialesInvalidas("Usuario o contraseña incorrectos") from exc
    except LDAPSocketOpenError as exc:
        raise LDAPNoDisponible("No se pudo conectar al servidor LDAP") from exc
    except LDAPException as exc:
        raise CredencialesInvalidas("Usuario o contraseña incorrectos") from exc
    finally:
        if propia is not None:
            try:
                propia.unbind()
            except LDAPException:
                pass

    return _persona_desde_result(entrada)


def _conectar() -> Connection:
    try:
        tls = Tls(validate=_ssl.CERT_NONE)
        server = Server(
            settings.ldap_server,
            use_ssl=True,
            tls=tls,
            connect_timeout=settings.ldap_timeout,
        )
        conn = Connection(
            server,
            user=settings.ldap_user_dn,
            password=settings.ldap_password,
            auto_bind=True,
            raise_exceptions=True,
            receive_timeout=settings.ldap_timeout,
        )
        return conn
    except LDAPSocketOpenError as exc:
        raise LDAPNoDisponible("No se pudo conectar al servidor LDAP") from exc
    except LDAPBindError as exc:
        raise LDAPNoDisponible(
            "No se pudo autenticar la cuenta de servicio del LDAP"
        ) from exc


def _filtro_busqueda(q: str) -> str:
    from ldap3.utils.conv import escape_filter_chars

    q = escape_filter_chars(q)
    return (
        f"(&{settings.ldap_user_filter}"
        f"(|(cn={q})(sAMAccountName={q})(mail={q})(userPrincipalName={q})))"
    )


def _area_de_dn(dn: str | None) -> str | None:
    """Devuelve la OU más interna (más específica) del DN de un usuario."""
    if not dn:
        return None
    for part in dn.split(","):
        part = part.strip()
        if part.lower().startswith("ou="):
            return part[3:]
    return None


def _valor(entry: Any, attr: str) -> str | None:
    if not entry:
        return None
    try:
        v = entry[attr].value if attr in entry else None
    except Exception:  # noqa: BLE001
        v = None
    if isinstance(v, bytes):
        v = v.decode("utf-8", errors="replace")
    if v is None:
        return None
    return " ".join(str(v).split())


def _valor_bytes(entry: Any, attr: str) -> bytes | None:
    if not entry:
        return None
    try:
        v = entry[attr].value if attr in entry else None
    except Exception:  # noqa: BLE001
        v = None
    if isinstance(v, (bytes, bytearray, memoryview)) and v:
        return bytes(v)
    return None


def _es_estudiante(entry: Any) -> bool:
    proveedor = _valor(entry, "cUJAEDataProvider")
    return bool(proveedor) and proveedor.upper() == "SIGENU"


def _persona_desde_result(result: Any) -> dict:
    """Convierte un resultado de `ldap3` en un diccionario de persona."""
    dn = result.entry_dn
    cn = _valor(result, "cn")
    if cn and cn.isdigit() and len(cn) == 11:
        carnet = cn
    else:
        carnet = _valor(result, "sAMAccountName") or cn or ""
    foto = _valor_bytes(result, "jpegPhoto")
    return {
        "carnet_identidad": carnet,
        "usuario_internet": _valor(result, "sAMAccountName"),
        "nombre": _valor(result, "givenName"),
        "apellidos": _valor(result, "sn"),
        "email_institucional": _valor(result, "mail"),
        "area": _area_de_dn(dn),
        "departamento": _valor(result, "department"),
        "es_estudiante": _es_estudiante(result),
        "foto_bytes": foto,
    }


def buscar_persona(identificador: str) -> dict:
    """Busca una persona en el AD por carné (cn) o usuario/mail/cuenta.

    Devuelve el diccionario de persona (con `foto_bytes`) o lanza
    `PersonaNoEncontrada`. Lanza `LDAPNoDisponible` si el AD falla.
    """
    q = (identificador or "").strip()
    if not q:
        raise PersonaNoEncontrada("Debe proporcionar carné o usuario de internet")

    conn: Connection | None = None
    try:
        conn = _conectar()
        entry = _buscar(conn, q)
        if entry is None:
            raise PersonaNoEncontrada(f"No se encontró ninguna persona con {q!r}")
        return _persona_desde_result(entry)
    except LDAPException as exc:
        raise LDAPNoDisponible("Error consultando el LDAP") from exc
    finally:
        if conn is not None:
            try:
                conn.unbind()
            except LDAPException:
                pass


def buscar_varias_personas(identificadores: list[str]) -> tuple[list[dict], list[dict]]:
    """Busca muchas personas en el AD con una sola conexión.

    Devuelve `(personas, errores)`:
      - `personas`: los diccionarios de persona encontrados y con carné.
      - `errores`: lista de `{"identificador": ..., "motivo": ...}` para los
        que no existen, no tienen carné o fallaron en la consulta.

    Si el directorio no responde o la cuenta de servicio falla, lanza
    `LDAPNoDisponible` (es un fallo de infraestructura, no de una persona).
    """
    personas: list[dict] = []
    errores: list[dict] = []

    conn: Connection | None = None
    try:
        conn = _conectar()
        for identificador in identificadores:
            q = (identificador or "").strip()
            if not q:
                errores.append({"identificador": identificador, "motivo": "Identificador vacío"})
                continue
            try:
                entry = _buscar(conn, q)
                if entry is None:
                    errores.append(
                        {"identificador": q, "motivo": "No se encontró ninguna persona"}
                    )
                    continue
                persona = _persona_desde_result(entry)
                if not persona.get("carnet_identidad"):
                    errores.append(
                        {"identificador": q, "motivo": "La cuenta no tiene carné de identidad"}
                    )
                    continue
                personas.append(persona)
            except LDAPException as exc:
                errores.append(
                    {"identificador": q, "motivo": "Error consultando el directorio"}
                )
    except LDAPException as exc:
        raise LDAPNoDisponible("No se pudo conectar al servidor LDAP") from exc
    finally:
        if conn is not None:
            try:
                conn.unbind()
            except LDAPException:
                pass

    return personas, errores