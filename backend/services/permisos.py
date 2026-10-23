"""Perfiles y permisos del portal administrativo.

Se replica el modelo del sistema "viajes" (CT 7022, `app/services/perfiles.py`),
adaptado al acceso a PostgreSQL con `psycopg2` de este backend.

Dos ideas importantes del diseño original:

1. Las comprobaciones de autorización se hacen **por permiso**, nunca por el
   nombre del perfil. Añadir un perfil nuevo no obliga a tocar los endpoints.
2. Los permisos efectivos son los del **perfil activo** solamente, no la unión
   de todos los perfiles asignados. Si un usuario acumula roles a lo largo del
   tiempo, no va ganando privilegios porumulados sin que nadie lo note.
"""

from __future__ import annotations

import psycopg2
import psycopg2.extras

from config import settings

# --- Permisos del sistema -------------------------------------------------
# Se separan en dos familias: administración del portal y negocio. El
# administrador del portal gestiona usuarios pero no ve datos de negocio; el
# especialista de RRHH trabaja con el negocio pero no gestiona cuentas.
PERMISOS_VALIDOS: dict[str, str] = {
    # Administración del portal
    "usuarios.administrar": "Gestionar usuarios, importaciones y perfiles",
    "sesiones.impersonar": "Entrar al panel como otro usuario",
    # Negocio (se va ampliando segun se abra cada funcionalidad)
    "negocio.ver": "Consultar los datos de negocio",
    "negocio.gestionar": "Crear y modificar los datos de negocio",
    "trabajadores.ver": (
        "Consultar el listado de trabajadores (activos y de baja) con "
        "búsqueda por nombre, apellidos o carné de identidad"
    ),
    "salarios.ver": (
        "Consultar el salario y la nómina de un trabajador, por carné de "
        "identidad o usuario de internet"
    ),
    "tarifa_horaria.gestionar": (
        "Insertar y modificar las horas de tarifa horaria de los trabajadores"
    ),
}

# Perfiles base del portal. `activo` permite desactivar un perfil sin borrar
# los usuarios que lo tienen asignado (pasa a `perfiles_inactivos`).
PERFILES_BASE: list[dict] = [
    {
        "codigo": "superadmin",
        "nombre": "Superadministrador",
        "descripcion": (
            "Control total del portal: crea, edita y elimina administradores y "
            "gestiona cualquier cuenta. Consulta el listado de trabajadores, "
            "activos y de baja. No modifica los datos de negocio, que "
            "corresponden al area de recursos humanos."
        ),
        "permisos": [
            "usuarios.administrar",
            "sesiones.impersonar",
            "trabajadores.ver",
            "salarios.ver",
            "tarifa_horaria.gestionar",
        ],
        "prioridad": 50,
    },
    {
        "codigo": "administrador",
        "nombre": "Administrador",
        "descripcion": (
            "Administra el portal: importa usuarios del AD y asigna sus "
            "perfiles. No accede a los datos de negocio."
        ),
        "permisos": ["usuarios.administrar", "sesiones.impersonar"],
        "prioridad": 40,
    },
    {
        "codigo": "especialista_rh",
        "nombre": "Especialista de Recursos Humanos",
        "descripcion": (
            "Trabaja con los datos de recursos humanos: consulta y modifica "
            "plantilla, trabajadores y reportes."
        ),
        "permisos": [
            "negocio.ver",
            "negocio.gestionar",
            "salarios.ver",
            "tarifa_horaria.gestionar",
        ],
        "prioridad": 30,
    },
    {
        "codigo": "alta_direccion",
        "nombre": "Alta Dirección",
        "descripcion": (
            "Consulta todos los datos de negocio en modo de solo lectura. "
            "No modifica información ni gestiona usuarios."
        ),
        "permisos": ["negocio.ver"],
        "prioridad": 20,
    },
    {
        "codigo": "invitado",
        "nombre": "Invitado",
        "descripcion": (
            "Perfil inicial de quien entra con su cuenta del AD y todavía no "
            "ha sido dado de alta en el portal. Solo ve el panel."
        ),
        "permisos": [],
        "prioridad": 10,
    },
]

# Registro en memoria: código -> {"nombre", "permisos", "activo", "prioridad"}
_CATALOGO: dict[str, dict] = {}

PERFIL_INVITADO = "invitado"


class PerfilInvalido(Exception):
    """El código de perfil no existe en el catálogo."""


class PerfilesRepository:
    """Persistencia del catálogo de perfiles en PostgreSQL."""

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
                    CREATE TABLE IF NOT EXISTS perfiles (
                        codigo      VARCHAR(50) PRIMARY KEY,
                        nombre      VARCHAR(100) NOT NULL,
                        descripcion VARCHAR(255),
                        permisos    TEXT[]  NOT NULL DEFAULT '{}',
                        prioridad   INTEGER NOT NULL DEFAULT 0,
                        activo      BOOLEAN NOT NULL DEFAULT TRUE,
                        creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
                        actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
                # Inserta los perfiles base que falten, sin pisar los que un
                # administrador ya haya editado.
                for p in PERFILES_BASE:
                    cur.execute(
                        """
                        INSERT INTO perfiles
                            (codigo, nombre, descripcion, permisos, prioridad)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (codigo) DO NOTHING
                        """,
                        (
                            p["codigo"],
                            p["nombre"],
                            p["descripcion"],
                            p["permisos"],
                            p["prioridad"],
                        ),
                    )

    def listar(self, solo_activos: bool = False) -> list[dict]:
        sql = """
            SELECT codigo, nombre, descripcion, permisos, prioridad, activo
            FROM perfiles
        """
        if solo_activos:
            sql += " WHERE activo"
        sql += " ORDER BY prioridad DESC, nombre"
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql)
                return [dict(r) for r in cur.fetchall()]

    def obtener(self, codigo: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT codigo, nombre, descripcion, permisos, prioridad, "
                    "activo FROM perfiles WHERE codigo = %s",
                    (codigo,),
                )
                row = cur.fetchone()
                return dict(row) if row else None


def recargar_catalogo() -> None:
    """Carga el catálogo desde la BD a memoria."""
    global _CATALOGO
    _CATALOGO = {}
    for p in PerfilesRepository().listar():
        # Un permiso que ya no exista en el catálogo se ignora en vez de
        # grantearlo: si el código desaparece, el permiso deja de valer.
        permisos = {x for x in (p.get("permisos") or []) if x in PERMISOS_VALIDOS}
        _CATALOGO[p["codigo"]] = {
            "codigo": p["codigo"],
            "nombre": p["nombre"],
            "descripcion": p.get("descripcion"),
            "permisos": permisos,
            "prioridad": int(p.get("prioridad") or 0),
            "activo": bool(p.get("activo")),
        }


def asegurar_catalogo() -> None:
    """Crea la tabla y carga el catálogo si aún no está en memoria."""
    if _CATALOGO:
        return
    repo = PerfilesRepository()
    repo.crear_tabla()
    recargar_catalogo()


def catalogo() -> dict[str, dict]:
    asegurar_catalogo()
    return _CATALOGO


def listar() -> list[dict]:
    """Catálogo completo, ordenado por prioridad (de mayor a menor)."""
    return sorted(
        catalogo().values(),
        key=lambda d: (-d["prioridad"], d["codigo"]),
    )


def codigos_perfiles() -> set[str]:
    return set(catalogo().keys())


def codigos_activos() -> set[str]:
    return {c for c, d in catalogo().items() if d["activo"]}


def perfil_existe(codigo: str) -> bool:
    return codigo in catalogo()


def nombre_perfil(codigo: str) -> str:
    d = catalogo().get(codigo)
    return d["nombre"] if d else codigo


def _prioridad(codigo: str) -> int:
    d = catalogo().get(codigo)
    return int(d["prioridad"]) if d else 0


def perfiles_asignados(usuario: dict) -> list[str]:
    return sorted(usuario.get("perfiles") or [])


def perfiles_activos_de(usuario: dict) -> list[str]:
    """Perfiles del usuario que están en el catálogo y no se han desactivado.

    Un perfil "inactivo" es el que el administrador le quitó a la persona
    (queda en `perfiles_inactivos` para poder reactivalo después). Un perfil
    desactivado en el catálogo tampoco cuenta, aunque siga asignado.
    """
    inactivos = set(usuario.get("perfiles_inactivos") or [])
    asignados = set(usuario.get("perfiles") or [])
    return sorted((asignados - inactivos) & codigos_activos())


def perfil_activo_de(usuario: dict) -> str:
    """Perfil activo: el que el usuario eligió, o el de mayor jerarquía.

    Cadena vacía si no tiene ningún perfil activo.
    """
    activos = perfiles_activos_de(usuario)
    if not activos:
        return ""
    elegido = usuario.get("perfil_activo")
    if elegido in activos:
        return elegido
    return max(activos, key=_prioridad)


def permisos_de(usuario: dict) -> list[str]:
    """Permisos del perfil activo. Nunca la unión de todos los perfiles."""
    codigo = perfil_activo_de(usuario)
    if not codigo:
        return []
    return sorted(catalogo().get(codigo, {}).get("permisos") or [])


def tiene_permiso(usuario: dict, permiso: str) -> bool:
    return permiso in permisos_de(usuario)


def detalle_perfiles(usuario: dict) -> list[dict]:
    """Cada perfil activo del usuario con su nombre y sus permisos."""
    cat = catalogo()
    return [
        {
            "codigo": c,
            "nombre": cat.get(c, {}).get("nombre", c),
            "permisos": sorted(cat.get(c, {}).get("permisos") or []),
            "activo": c == perfil_activo_de(usuario),
        }
        for c in perfiles_activos_de(usuario)
    ]


def admines_por_carnet() -> set[str]:
    """Carnés que conservan siempre el perfil de administrador.

    Es la vía de arranque: si nadie tuviera `usuarios.administrar` no habría
    forma de darlo, y si se pierde, nadie podría devolverlo.
    """
    return {c.strip() for c in settings.admin_carnets.split(",") if c.strip()}


def superadmines_por_carnet() -> set[str]:
    """Cuentas de arranque: se pelean el perfil de superadministrador.

    Estas cuentas no se pueden borrar ni desactivar, ni perder el perfil, por
    mucho que se les pida desde la aplicacion. Son el seguro contra quedarse sin
    administracion; cualquier otra cuenta, superadministrador incluida, si queda
    protegida.
    """
    return {c.strip() for c in settings.admin_carnets.split(",") if c.strip()}


def es_superadmin(usuario: dict) -> bool:
    """¿La fila tiene el perfil de superadministrador activo?"""
    return "superadmin" in perfiles_activos_de(usuario)
