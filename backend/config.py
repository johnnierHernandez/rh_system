"""
Configuración global de la aplicación.

Las credenciales NO tienen valores por defecto: si falta una variable de
entorno, el arranque falla con un mensaje claro en vez de seguir con una
contraseña de ejemplo clavada en el código.
"""

from __future__ import annotations

import os


def _getenv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def _require(name: str) -> str:
    value = _getenv(name)
    if value is None:
        raise RuntimeError(f"Falta variable de entorno {name}")
    return value


class Settings:
    _instance: "Settings | None" = None

    def __new__(cls) -> "Settings":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        self.mssql_host: str = _getenv("MSSQL_HOST", "10.8.1.59") or "10.8.1.59"
        self.mssql_user: str = _getenv("MSSQL_USER", "SA") or "SA"
        self.mssql_pass: str = _require("MSSQL_PASS")
        self.mssql_db: str = _getenv("MSSQL_DB", "ASSETS_RH") or "ASSETS_RH"
        self.mssql_port: int = int(_getenv("MSSQL_PORT", "1433") or "1433")
        self.pool_size: int = int(_getenv("DB_POOL_SIZE", "8") or "8")
        self.pool_prewarm: int = int(_getenv("DB_POOL_PREWARM", "2") or "2")

        # LDAP / Active Directory CUJAE
        self.ldap_server: str = (
            _getenv("LDAP_SERVER", "ldaps://10.8.1.124:636") or "ldaps://10.8.1.124:636"
        )
        self.ldap_base_dn: str = (
            _getenv("LDAP_BASE_DN", "dc=cujae,dc=edu,dc=cu") or "dc=cujae,dc=edu,dc=cu"
        )
        self.ldap_user_dn: str = (
            _getenv("LDAP_USER_DN", "ldaptramites@cujae.edu.cu") or "ldaptramites@cujae.edu.cu"
        )
        self.ldap_password: str = _require("LDAP_PASSWORD")
        self.ldap_timeout: int = int(_getenv("LDAP_TIMEOUT", "10") or "10")
        # Filtro base para cuentas habilitadas del AD (igual que el sistema viajes)
        self.ldap_user_filter: str = (
            _getenv(
                "LDAP_USER_FILTER",
                "(&(|(objectclass=person)(objectclass=user))"
                "(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
            )
            or "(&(|(objectclass=person)(objectclass=user))"
            "(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
        )

        # PostgreSQL del portal (usuarios)
        self.pg_host: str = _getenv("PG_HOST", "127.0.0.1") or "127.0.0.1"
        self.pg_port: int = int(_getenv("PG_PORT", "5432") or "5432")
        self.pg_db: str = _getenv("PG_DB", "rh_portal") or "rh_portal"
        self.pg_user: str = _getenv("PG_USER", "rh_portal") or "rh_portal"
        self.pg_pass: str = _require("PG_PASS")

        # Sesión del portal (firma HMAC-SHA256 de los tokens)
        self.ldap_dominio: str = _getenv("LDAP_DOMINIO", "cujae.edu.cu") or "cujae.edu.cu"
        self.session_secret: str = _getenv("SESSION_SECRET", "") or ""
        self.session_ttl_hours: int = int(_getenv("SESSION_TTL_HOURS", "8") or "8")
        # Carnés que conservan siempre el perfil de administrador, separados
        # por comas. Es la vía de arranque: si el perfil se pierde, estos lo
        # recuperan sin intervención manual.
        self.admin_carnets: str = _getenv("ADMIN_CARNETS", "") or ""
        # Carnés que pueden entrar al portal aunque no tengan ficha activa en
        # la nómina. Es para cuentas de servicio que no son trabajadores pero
        # sí necesitan una sesión (por ejemplo, una cuenta compartida).
        self.acceso_sin_nomina: frozenset[str] = frozenset(
            carnet.strip()
            for carnet in (_getenv("ACCESO_SIN_NOMINA", "") or "").split(",")
            if carnet.strip()
        )


settings = Settings()
