"""Repositorio de usuarios del portal en PostgreSQL (BD local rh_portal).

Una fila por persona con cuenta en el AD de la CUJAE. La fila se crea sola la
primera vez que alguien entra al panel (con perfil `invitado`) y después el
administrador la importa y le asigna el perfil que le corresponde, siguiendo el
mismo esquema de perfiles que usa el sistema "viajes" (CT 7022).
"""

from __future__ import annotations

import psycopg2
import psycopg2.extras

from config import settings


class UsuariosRepository:
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
                    CREATE TABLE IF NOT EXISTS usuarios (
                        carnet_identidad  VARCHAR(24)  PRIMARY KEY,
                        usuario_internet  VARCHAR(64),
                        nombre            VARCHAR(128),
                        apellidos         VARCHAR(128),
                        email_institucional VARCHAR(190),
                        area              VARCHAR(255),
                        departamento      VARCHAR(255),
                        es_estudiante     BOOLEAN  NOT NULL DEFAULT FALSE,
                        activo            BOOLEAN  NOT NULL DEFAULT TRUE,
                        foto              BYTEA,
                        perfiles          TEXT[]   NOT NULL DEFAULT '{}',
                        perfiles_inactivos TEXT[]  NOT NULL DEFAULT '{}',
                        perfil_activo     VARCHAR(50),
                        creado            TIMESTAMPTZ NOT NULL DEFAULT now(),
                        actualizado       TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_usuarios_usuario_internet "
                    "ON usuarios (usuario_internet)"
                )
                # La tabla ya existía en instalaciones previas al modelo de
                # perfiles: se agrega lo que falte sin perder datos.
                for columna in (
                    "perfiles_inactivos TEXT[] NOT NULL DEFAULT '{}'",
                    "perfil_activo VARCHAR(50)",
                ):
                    nombre = columna.split()[0]
                    cur.execute(
                        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "
                        f"{columna}"
                    )
                    _ = nombre

    def importar(self, persona: dict) -> dict:
        """Inserta (o actualiza) un usuario a partir de los datos del AD."""
        foto = persona.get("foto_bytes")
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO usuarios (
                        carnet_identidad, usuario_internet, nombre, apellidos,
                        email_institucional, area, departamento, es_estudiante,
                        foto, actualizado
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (carnet_identidad) DO UPDATE SET
                        usuario_internet = EXCLUDED.usuario_internet,
                        nombre          = EXCLUDED.nombre,
                        apellidos       = EXCLUDED.apellidos,
                        email_institucional = EXCLUDED.email_institucional,
                        area            = EXCLUDED.area,
                        departamento    = EXCLUDED.departamento,
                        es_estudiante   = EXCLUDED.es_estudiante,
                        foto            = EXCLUDED.foto,
                        actualizado     = now()
                    RETURNING carnet_identidad, usuario_internet, nombre,
                              apellidos, email_institucional, area,
                              departamento, es_estudiante, activo,
                              perfiles, perfiles_inactivos, perfil_activo,
                              creado, actualizado,
                              (foto IS NOT NULL) AS tiene_foto
                    """,
                    (
                        persona["carnet_identidad"],
                        persona.get("usuario_internet"),
                        persona.get("nombre"),
                        persona.get("apellidos"),
                        persona.get("email_institucional"),
                        persona.get("area"),
                        persona.get("departamento"),
                        persona.get("es_estudiante", False),
                        psycopg2.Binary(foto) if foto else None,
                    ),
                )
                row = cur.fetchone()
                return dict(row)

    def importar_varias(
        self, personas: list[dict], perfil: str | None = None
    ) -> list[dict]:
        """Inserta o actualiza varias personas en una sola transacción.

        Una sola conexión y un `INSERT` por persona del lote, con la misma
        semántica de `importar` (upsert por carné). Si se pasa `perfil`, se
        asigna a cada una al final de la transacción, como haría
        `aplicar_perfil` — sin tocar perfiles que ya tuvieran asignados.

        Devuelve las filas finales ya con el perfil aplicado.
        """
        filas: list[dict] = []
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                for persona in personas:
                    foto = persona.get("foto_bytes")
                    cur.execute(
                        """
                        INSERT INTO usuarios (
                            carnet_identidad, usuario_internet, nombre, apellidos,
                            email_institucional, area, departamento, es_estudiante,
                            foto, actualizado
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                        ON CONFLICT (carnet_identidad) DO UPDATE SET
                            usuario_internet = EXCLUDED.usuario_internet,
                            nombre          = EXCLUDED.nombre,
                            apellidos       = EXCLUDED.apellidos,
                            email_institucional = EXCLUDED.email_institucional,
                            area            = EXCLUDED.area,
                            departamento    = EXCLUDED.departamento,
                            es_estudiante   = EXCLUDED.es_estudiante,
                            foto            = EXCLUDED.foto,
                            actualizado     = now()
                        RETURNING carnet_identidad, usuario_internet, nombre,
                                  apellidos, email_institucional, area,
                                  departamento, es_estudiante, activo,
                                  perfiles, perfiles_inactivos, perfil_activo,
                                  creado, actualizado,
                                  (foto IS NOT NULL) AS tiene_foto
                        """,
                        (
                            persona["carnet_identidad"],
                            persona.get("usuario_internet"),
                            persona.get("nombre"),
                            persona.get("apellidos"),
                            persona.get("email_institucional"),
                            persona.get("area"),
                            persona.get("departamento"),
                            persona.get("es_estudiante", False),
                            psycopg2.Binary(foto) if foto else None,
                        ),
                    )
                    filas.append(dict(cur.fetchone()))

                if not perfil:
                    return filas
                for fila in filas:
                    cur.execute(
                        "UPDATE usuarios SET "
                        "  perfiles = ARRAY(SELECT DISTINCT "
                        "    unnest(perfiles || %s::text[])),"
                        "  perfiles_inactivos = ARRAY("
                        "    SELECT unnest(perfiles_inactivos) "
                        "    EXCEPT SELECT unnest(%s::text[])),"
                        "  actualizado = now() "
                        "WHERE carnet_identidad = %s",
                        ([perfil], [perfil], fila["carnet_identidad"]),
                    )
                # Los perfiles acabaron de cambiar en el último bloque: se
                # releen todos con la misma proyección que suelta el API.
                carnets = [f["carnet_identidad"] for f in filas]
                finales: list[dict] = []
                for c in carnets:
                    cur.execute(
                        "SELECT carnet_identidad, usuario_internet, nombre, "
                        "       apellidos, email_institucional, area, "
                        "       departamento, es_estudiante, activo, "
                        "       perfiles, perfiles_inactivos, perfil_activo, "
                        "       creado, actualizado, "
                        "       (foto IS NOT NULL) AS tiene_foto "
                        "FROM usuarios WHERE carnet_identidad = %s",
                        (c,),
                    )
                    row = cur.fetchone()
                    if row:
                        finales.append(dict(row))
                return finales

    # --- Perfiles ---------------------------------------------------------
    # Estas operaciones replican la semántica de `services/auth.py` del
    # sistema "viajes": un perfil asignado puede estar activo o desactivado
    # sin perder la asignación, y `perfil_activo` elige con qué rol se opera.

    def _perfiles(self, cur, carnet: str) -> dict | None:
        cur.execute(
            """
            SELECT carnet_identidad, usuario_internet, nombre, apellidos,
                   email_institucional, area, departamento, es_estudiante,
                   activo, perfiles, perfiles_inactivos, perfil_activo,
                   creado, actualizado,
                   (foto IS NOT NULL) AS tiene_foto
            FROM usuarios WHERE carnet_identidad = %s
            """,
            (carnet,),
        )
        row = cur.fetchone()
        return dict(row) if row else None

    def aplicar_perfil(self, carnet: str, perfil: str) -> dict:
        """Asigna un perfil y lo reactiva si estaba desactivado."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "UPDATE usuarios SET "
                    "  perfiles = ARRAY(SELECT DISTINCT unnest(perfiles || %s::text[])),"
                    "  perfiles_inactivos = ARRAY("
                    "    SELECT unnest(perfiles_inactivos) "
                    "    EXCEPT SELECT unnest(%s::text[])),"
                    "  actualizado = now() "
                    "WHERE carnet_identidad = %s",
                    ([perfil], [perfil], carnet),
                )
                fila = self._perfiles(cur, carnet)
        if fila is None:
            raise ValueError(f"No existe el usuario {carnet}")
        return fila

    def quitar_perfil(self, carnet: str, perfil: str) -> dict:
        """Quita un perfil asignado del usuario."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "UPDATE usuarios SET "
                    "  perfiles = ARRAY(SELECT unnest(perfiles) "
                    "                    EXCEPT SELECT unnest(%s::text[])),"
                    "  perfil_activo = CASE WHEN perfil_activo = %s "
                    "                       THEN NULL ELSE perfil_activo END, "
                    "  perfiles_inactivos = ARRAY(SELECT unnest(perfiles_inactivos) "
                    "                       EXCEPT SELECT unnest(%s::text[])), "
                    "  actualizado = now() "
                    "WHERE carnet_identidad = %s",
                    ([perfil], perfil, [perfil], carnet),
                )
                fila = self._perfiles(cur, carnet)
        if fila is None:
            raise ValueError(f"No existe el usuario {carnet}")
        return fila

    def activar_perfil(self, carnet: str, perfil: str, activo: bool) -> dict:
        """Activa o desactiva un perfil ya asignado, sin perderlo."""
        actual = self.obtener(carnet)
        if actual is None:
            raise ValueError(f"No existe el usuario {carnet}")
        if perfil not in (actual.get("perfiles") or []):
            raise ValueError(f"{perfil} no está asignado a {carnet}")
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if activo:
                    cur.execute(
                        "UPDATE usuarios SET perfiles_inactivos = ARRAY("
                        "  SELECT unnest(perfiles_inactivos) "
                        "  EXCEPT SELECT unnest(%s::text[])), actualizado = now() "
                        "WHERE carnet_identidad = %s",
                        ([perfil], carnet),
                    )
                else:
                    cur.execute(
                        "UPDATE usuarios SET perfiles_inactivos = "
                        "  ARRAY(SELECT DISTINCT unnest(perfiles_inactivos || %s::text[])),"
                        "  perfil_activo = CASE WHEN perfil_activo = %s "
                        "                       THEN NULL ELSE perfil_activo END,"
                        "  actualizado = now() "
                        "WHERE carnet_identidad = %s",
                        ([perfil], perfil, carnet),
                    )
                fila = self._perfiles(cur, carnet)
        if fila is None:
            raise ValueError(f"No existe el usuario {carnet}")
        return fila

    def establecer_perfil_activo(self, carnet: str, perfil: str | None) -> dict:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "UPDATE usuarios SET perfil_activo = %s, actualizado = now() "
                    "WHERE carnet_identidad = %s",
                    (perfil, carnet),
                )
                fila = self._perfiles(cur, carnet)
        if fila is None:
            raise ValueError(f"No existe el usuario {carnet}")
        return fila

    def establecer_activo(self, carnet: str, activo: bool) -> dict:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "UPDATE usuarios SET activo = %s, actualizado = now() "
                    "WHERE carnet_identidad = %s",
                    (activo, carnet),
                )
                fila = self._perfiles(cur, carnet)
        if fila is None:
            raise ValueError(f"No existe el usuario {carnet}")
        return fila

    def sincronizar(self, persona: dict) -> dict:
        """Crea o actualiza la fila de una persona a partir de los datos del AD.

        A diferencia de `importar`, no toca los perfiles: quien entra por
        primera vez conserva los que ya tenga y, si no tiene ninguno, se le
        asigna el de invitado.
        """
        return self.importar(persona)

    def listar(self, q: str = "", limit: int = 50, offset: int = 0) -> list[dict]:
        where = ""
        params: list = []
        if q:
            where = (
                " WHERE carnet_identidad ILIKE %s OR usuario_internet ILIKE %s "
                " OR nombre ILIKE %s OR apellidos ILIKE %s "
                " OR email_institucional ILIKE %s"
            )
            like = f"%{q}%"
            params = [like, like, like, like, like]
        sql = f"""
            SELECT carnet_identidad, usuario_internet, nombre, apellidos,
                   email_institucional, area, departamento, es_estudiante,
                   activo, perfiles, perfiles_inactivos, perfil_activo,
                   creado, actualizado,
                   (foto IS NOT NULL) AS tiene_foto
            FROM usuarios
            {where}
            ORDER BY nombre NULLS LAST, apellidos
            LIMIT %s OFFSET %s
        """
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (*params, limit, offset))
                return [dict(r) for r in cur.fetchall()]

    def contar(self, q: str = "") -> int:
        where = ""
        params: list = []
        if q:
            where = (
                " WHERE carnet_identidad ILIKE %s OR usuario_internet ILIKE %s "
                " OR nombre ILIKE %s OR apellidos ILIKE %s "
                " OR email_institucional ILIKE %s"
            )
            like = f"%{q}%"
            params = [like, like, like, like, like]
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM usuarios {where}", params)
                return int(cur.fetchone()[0])

    def carnets_existentes(self, carnets: list[str]) -> set[str]:
        """Subconjunto de carnés que ya tienen fila en `usuarios`.

        Para pintar, de una sola consulta, qué cuadros ya están dados de alta
        en el portal sin hacer una consulta por persona.
        """
        limpios = [c for c in carnets if c]
        if not limpios:
            return set()
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT carnet_identidad FROM usuarios "
                    "WHERE carnet_identidad = ANY(%s)",
                    (limpios,),
                )
                return {str(r[0]) for r in cur.fetchall()}

    def obtener(self, carnet: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT carnet_identidad, usuario_internet, nombre, apellidos,
                           email_institucional, area, departamento, es_estudiante,
                           activo, perfiles, perfiles_inactivos, perfil_activo,
                           creado, actualizado,
                           (foto IS NOT NULL) AS tiene_foto
                    FROM usuarios WHERE carnet_identidad = %s
                    """,
                    (carnet,),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    def establecer_perfiles(self, carnet: str, perfiles: list[str]) -> dict:
        """Reemplaza el conjunto de perfiles de un usuario.

        Se recalcula la coherencia: se olvidan los perfiles desactivados que ya
        no estén asignados y se olvida el perfil activo si dejó de estarlo.
        """
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "UPDATE usuarios SET "
                    "  perfiles = %s::text[], "
                    "  perfiles_inactivos = ARRAY(SELECT unnest(perfiles_inactivos) "
                    "                       INTERSECT SELECT unnest(%s::text[])), "
                    "  perfil_activo = CASE WHEN perfil_activo = ANY(%s::text[]) "
                    "                       THEN perfil_activo ELSE NULL END, "
                    "  actualizado = now() "
                    "WHERE carnet_identidad = %s",
                    (perfiles, perfiles, perfiles, carnet),
                )
                if cur.rowcount == 0:
                    raise ValueError(f"No existe el usuario {carnet}")
                fila = self._perfiles(cur, carnet)
        return fila

    def obtener_foto(self, carnet: str) -> bytes | None:
        """Devuelve los bytes de la foto guardada (JPEG del AD) o None."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT foto FROM usuarios WHERE carnet_identidad = %s",
                    (carnet,),
                )
                row = cur.fetchone()
                if row is None or row[0] is None:
                    return None
                return bytes(row[0])

    def eliminar(self, carnet: str) -> bool:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM usuarios WHERE carnet_identidad = %s", (carnet,)
                )
                return cur.rowcount > 0