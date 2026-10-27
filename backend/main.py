"""
API RH CUJAE — FastAPI 3.12
Arquitectura con patrones de diseño:
  Singleton  -> config.Settings
  Object Pool-> db.pool.ConnectionPool (reutiliza conexiones pymssql)
  Factory    -> repositories.RepositoryFactory
  Adapter    -> db.adapter (limpieza de columnas char)
  Facade     -> services.DRHService
  NullObject -> schemas (Resumen.empty, PlazasVacantes.empty...)
"""

from __future__ import annotations

import json
import os
import unicodedata

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import Response, StreamingResponse


from config import settings
from db.pool import ConnectionPool
from repositories import RepositoryFactory

import pymssql

from schemas import (
    Area,
    AreaAsignada,
    AsignarAreaRequest,
    CierreTarifa,
    CierreTarifaEntrada,
    CuadroImportado,
    CuadroLista,
    Cumpleanos,
    DelegarAreaRequest,
    Identidad,
    ActivarPerfilRequest,
    AsignarPerfilesRequest,
    ImportarCuadrosRequest,
    ImportarCuadrosResponse,
    ImportarLoteError,
    ImportarLoteRequest,
    ImportarLoteResponse,
    ImportarUsuarioRequest,
    PerfilCatalogo,
    PerfilSeleccion,
    PeriodosTarifa,
    LoginRequest,
    MiNomina,
    Numeros,
    PersonaLDAP,
    PlantillaAreas,
    Plaza,
    PlazasVacantes,
    RecienGraduado,
    Resumen,
    SalarioRespuesta,
    TarifaHorariaEdicion,
    TarifaHorariaEntrada,
    TarifaHorariaGuardada,
    TarifaHorariaRespuesta,
    TarifaHorariaRespuestaAdmin,
    Trabajador,
    TrabajadorLista,
    TrabajadorTarifa,
    UsuarioPortal,
)
from services.export_cuadros import generar_cuadros_excel, generar_cuadros_pdf
from services.drh_service import (
    AreaTarifaNoCoincide,
    DRHService,
    PeriodoCerrado,
    TarifaHorariaError,
    TarifaHorariaNoEncontrada,
    TrabajadorTarifaNoEncontrado,
)
from services import permisos
from services.auth import (
    CredencialesInvalidas,
    CuentaDesactivada,
    NoEsTrabajador,
    autenticar,
    exigir_admin,
    exigir_permiso,
    exigir_sesion,
    identidad_de,
    impersonar,
)
from services.ldap_portal import (
    LDAPNoDisponible,
    PersonaNoEncontrada,
    buscar_persona,
    buscar_varias_personas,
)
from services.usuarios import UsuariosRepository
from services.usuario_areas import UsuarioAreasRepository
from services.autorizacion_areas import (
    AreasRH,
    area_de_unidad,
    puede_acceder_area,
)


_cache_fotos: dict[str, tuple[bytes, str]] = {}
_FOTO_INTRA = "http://intranet.cujae.edu.cu/Image.aspx?ci="

# Formatos de retrato que aparecen en `Empleados_Gral.Foto`. Se comparan por
# bytes iniciales porque la columna es de tipo `image` y no admite CAST a texto
# ni `LEFT()`.
_MAGIC_PNG = b"\x89PNG"
_MAGIC_JPEG = b"\xff\xd8"
_MAGIC_BMP = b"BM"

_TIPOS_FOTO = {"image/png": _MAGIC_PNG, "image/jpeg": _MAGIC_JPEG}


def _tipo_foto(datos: bytes) -> str | None:
    """Tipo MIME deducido de los bytes iniciales, o `None` si no se reconoce."""
    for tipo, magic in _TIPOS_FOTO.items():
        if datos.startswith(magic):
            return tipo
    return None


def _foto_desde_bd(no_ci: str) -> tuple[bytes, str] | None:
    """Lee `Empleados_Gral.Foto` y devuelve los bytes con su tipo MIME real.

    `Empleados_Gral.Foto` mezcla formatos según cuándo se bajó cada retrato: entre
    los 1.088 activos hay 641 PNG, 153 JPEG y 1 BMP. Antes solo se reconocían JPEG
    y BMP, así que el 80 % de las fotos locales se descartaban sin avisar y el
    endpoint las volvía a pedir a la intranet —mismos bytes, 64 ms— sirviéndolas
    como `image/jpeg` aunque fueran PNG. Ahora se devuelven tal cual.

    El único BMP se convierte a JPEG porque no todos los navegadores lo pintan
    dentro de un `<img>`; para eso hace falta Pillow.
    """
    datos = service.foto_por_carnet(no_ci)
    if not datos:
        return None
    tipo = _tipo_foto(datos)
    if tipo:
        return datos, tipo
    if datos[:2] == _MAGIC_BMP:
        try:
            from io import BytesIO

            from PIL import Image

            im = Image.open(BytesIO(datos)).convert("RGB")
            buf = BytesIO()
            im.save(buf, format="JPEG", quality=90)
            return buf.getvalue(), "image/jpeg"
        except Exception:  # noqa: BLE001
            return None
    return None


def _foto_desde_intranet(ci: str) -> tuple[bytes, str] | None:
    """Descarga la foto del trabajador del portal anterior (intranet)."""
    import urllib.parse
    import urllib.request

    url = f"{_FOTO_INTRA}{urllib.parse.quote(ci)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DRHnet/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            datos = resp.read()
            tipo = resp.headers.get("Content-Type", "")
        # Los retratos reales de la intranet ocupan varios KB; el placeholder
        # de "sin foto" es un JPEG plano ~650B. Se ignora para no mostrar
        # un rectángulo negro.
        if datos and "image" in tipo and len(datos) > 1024:
            return datos, tipo.split(";")[0].strip()
    except Exception:  # noqa: BLE001
        return None
    return None


def _foto_desde_ldap(no_ci: str) -> tuple[bytes, str] | None:
    """Último recurso: la miniatura `jpegPhoto` del AD (16x14)."""
    try:
        persona = buscar_persona(no_ci)
        datos = persona.get("foto_bytes")
    except (PersonaNoEncontrada, LDAPNoDisponible):
        return None
    if not datos:
        return None
    return datos, _tipo_foto(datos) or "image/jpeg"


def _db_factory():
    return pymssql.connect(
        server=settings.mssql_host,
        user=settings.mssql_user,
        password=settings.mssql_pass,
        database=settings.mssql_db,
        port=settings.mssql_port,
        as_dict=True,
        autocommit=True,
    )


def _crear_pool() -> ConnectionPool:
    """Crea el pool con precalentamiento. Si la BD está caída al arrancar,
    degrada a conexiones diferidas en vez de matar el proceso."""
    try:
        return ConnectionPool(
            factory=_db_factory,
            max_size=settings.pool_size,
            prewarm=settings.pool_prewarm,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[backend] MSSQL no disponible al arranque; pool diferido: {exc}")
        return ConnectionPool(
            factory=_db_factory, max_size=settings.pool_size, prewarm=0
        )


pool = _crear_pool()
factory = RepositoryFactory(pool)
service = DRHService(factory)
usuarios_repo = UsuariosRepository()
usuario_areas_repo = UsuarioAreasRepository()

app = FastAPI(title="RH CUJAE API", version="1.0.0")


@app.on_event("shutdown")
def _cerrar_pool() -> None:
    """Cierra las conexiones del pool de MSSQL al apagar el servicio.

    Sin esto, cada reinicio dejaba conexiones abiertas en el servidor de
    base de datos hasta que la red las darÃ­a por caducas.
    """
    try:
        pool.close()
        print("[backend] pool de conexiones cerrado")
    except Exception as exc:  # noqa: BLE001
        print(f"[backend] no se pudo cerrar el pool: {exc}")


@app.on_event("startup")
def _iniciar_portal() -> None:
    """Garantiza la existencia de la tabla de usuarios del portal (PostgreSQL)."""
    try:
        usuarios_repo.crear_tabla()
    except Exception as exc:  # noqa: BLE001
        print(f"[portal] no se pudo inicializar la tabla de usuarios: {exc}")
    try:
        usuario_areas_repo.crear_tabla()
        print("[portal] tabla de áreas por usuario lista")
    except Exception as exc:  # noqa: BLE001
        print(f"[portal] no se pudo inicializar la tabla de áreas: {exc}")
    try:
        service.asegurar_tarifa()
        print("[tarifa] tabla de horas de tarifa horaria lista")
    except Exception as exc:  # noqa: BLE001
        print(f"[tarifa] no se pudo inicializar la tabla de tarifa horaria: {exc}")
    try:
        permisos.asegurar_catalogo()
        print(f"[portal] perfiles disponibles: {', '.join(sorted(permisos.codigos_perfiles()))}")
    except Exception as exc:  # noqa: BLE001
        print(f"[portal] no se pudo inicializar el catálogo de perfiles: {exc}")
    if not settings.session_secret:
        print(
            "[auth] AVISO: SESSION_SECRET no está definido. "
            "La autenticación del portal no puede firmar sesiones."
        )


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Sesión del portal.
#
# El token viaja en `Authorization: Bearer` o en la cookie httpOnly `rh_sesion`
# y lo verifica el backend en cada petición. El frontend nunca lo firma ni lo
# guarda en `localStorage`; solo lo reenvía. Toda la lógica de sesión y
# permisos vive en `services/auth.py`.
# ---------------------------------------------------------------------------


@app.post("/api/auth/login", response_model=Identidad)
def login(body: LoginRequest):
    """Valida las credenciales en el AD y abre la sesión.

    Quien entra por primera vez queda con perfil `invitado` hasta que alguien
    con `usuarios.administrar` lo importa y le asigna su perfil.

    El token se devuelve en la cabecera `X-Sesion` y no en el cuerpo, para que
    no acabe en un log ni en el historial del navegador: el frontend lo
    recoge de ahí y lo guarda en una cookie httpOnly.
    """
    from fastapi.responses import JSONResponse

    try:
        sesion = autenticar(
            body.identificador,
            body.clave,
            es_trabajador=service.es_trabajador_activo,
        )
    except CredencialesInvalidas as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except CuentaDesactivada as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except NoEsTrabajador as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except PersonaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    token = sesion.pop("token")
    return JSONResponse(
        content=Identidad(**sesion["identidad"]).model_dump(),
        headers={"X-Sesion": token},
    )


@app.get("/api/auth/yo", response_model=Identidad)
def ver_sesion(identidad: dict = Depends(exigir_sesion)) -> dict:
    return identidad


@app.post("/api/auth/impersonar/{carnet}", response_model=Identidad)
def impersonar_usuario(carnet: str, admin: dict = Depends(exigir_sesion)) -> dict:
    """Abre el panel como otra persona. Requiere `sesiones.impersonar`.

    No se puede suplantar desde una sesión ya suplantada, y el token devuelto
    lleva dentro quién fue el original, que la interfaz muestra en pantalla.
    """
    from fastapi.responses import JSONResponse

    try:
        suplantacion = impersonar(carnet, admin)
    except PersonaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return JSONResponse(
        content=Identidad(**suplantacion["identidad"]).model_dump(),
        headers={"X-Sesion": suplantacion["token"]},
    )


@app.post("/api/auth/perfil-activo", response_model=Identidad)
def seleccionar_perfil_activo(
    body: PerfilSeleccion, sesion: dict = Depends(exigir_sesion)
) -> dict:
    """Cambia con qué perfil se opera. `perfil: null` vuelve al de mayor jerarquía."""
    repo = usuarios_repo
    usuario = repo.obtener(sesion["carnet_identidad"])
    if usuario is None:
        raise HTTPException(status_code=401, detail="Sesión no válida")

    if body.perfil is not None:
        if body.perfil not in permisos.perfiles_activos_de(usuario):
            raise HTTPException(
                status_code=400,
                detail="El perfil indicado no está asignado ni activo",
            )
    repo.establecer_perfil_activo(sesion["carnet_identidad"], body.perfil)
    return identidad_de(repo.obtener(sesion["carnet_identidad"]), sesion.get("impersonando"))


@app.get("/api/admin/perfiles", response_model=list[PerfilCatalogo])
def listar_perfiles(_admin: dict = Depends(exigir_admin)) -> list[PerfilCatalogo]:
    """Catálogo de perfiles del portal."""
    return [PerfilCatalogo(**p) for p in permisos.listar()]


@app.post("/api/negocio/verificar-escritura")
def verificar_escritura_negocio(
    _sesion: dict = Depends(exigir_permiso("negocio.gestionar")),
) -> dict:
    """Comprueba que la sesión puede escribir datos de negocio.

    Sirve de guarda de las operaciones de alta y edición de trabajadores: el
    proxy solo puede exigir `negocio.ver` porque la lista y el formulario
    comparten ruta, así que la diferencia entre leer y escribir se decide aquí,
    contra el backend.
    """
    return {"ok": True}


@app.get("/api/health")
def health() -> dict:
    try:
        with pool.connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 AS n")
            cur.fetchone()
        return {"status": "ok", "db": "connected"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"DB error: {exc}") from exc


@app.get("/api/resumen", response_model=Resumen)
def get_resumen() -> Resumen:
    return service.resumen()


@app.get("/api/numeros", response_model=Numeros)
def get_numeros() -> Numeros:
    return service.numeros()


@app.get("/api/trabajadores", response_model=list[Trabajador])
def get_trabajadores(
    limit: int = 50,
    offset: int = 0,
    q: str = "",
    _admin: dict = Depends(exigir_permiso("usuarios.administrar")),
) -> list[Trabajador]:
    """Resolución por carné desde la ficha de administración de usuarios.

    Expone carné de identidad, por eso exige `usuarios.administrar`.
    """
    return service.trabajadores(limit, offset, q)


@app.get("/api/trabajadores/lista", response_model=TrabajadorLista)
def get_trabajadores_por_estado(
    estado: str = "activos",
    q: str = "",
    limit: int = 50,
    offset: int = 0,
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> TrabajadorLista:
    """Listado de trabajadores activos o de baja para el superadministrador.

    La búsqueda `q` separa términos: cada término debe estar contenido en el
    nombre, cualquiera de los apellidos o el carné de identidad.
    """
    return service.trabajadores_por_estado(estado, q, limit, offset)


@app.get("/api/trabajadores/{no_ci}", response_model=Trabajador)
def get_trabajador_por_carnet(
    no_ci: str,
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> Trabajador:
    """Perfil de un trabajador por carné, activo o de baja."""
    trabajador = service.trabajador_por_carnet(no_ci)
    if not trabajador:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return trabajador


@app.get("/api/trabajadores/{no_ci}/foto")
def get_trabajador_foto(
    no_ci: str,
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> Response:
    """Fotografía del trabajador, con el tipo MIME que corresponde a los bytes.

    Fuentes, en orden: la copia local en `Empleados_Gral.Foto` (el retrato real,
    129x162, que ya se descargó de la intranet), la intranet como respaldo y por
    último la miniatura `jpegPhoto` del AD (16x14).

    El resultado se cachea en memoria con su tipo, y el `Content-Type` se declara
    según los bytes reales: la columna mezcla PNG y JPEG, así que devolver
    siempre `image/jpeg` mintía sobre 641 de las 795 fotos disponibles.
    """
    trabajador = service.trabajador_por_carnet(no_ci)
    if not trabajador:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    entrada = _cache_fotos.get(no_ci)
    if entrada is None:
        for origen in (_foto_desde_bd, _foto_desde_intranet, _foto_desde_ldap):
            entrada = origen(no_ci)
            if entrada:
                break
        if entrada:
            _cache_fotos[no_ci] = entrada

    if not entrada:
        raise HTTPException(status_code=404, detail="Sin fotografía")
    datos, tipo = entrada
    return Response(
        content=datos,
        media_type=tipo,
        headers={"Cache-Control": "private, max-age=86400"},
    )


@app.get("/api/cuadros", response_model=CuadroLista)
def get_cuadros(
    q: str = "",
    id_direccion: str = "",
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> CuadroLista:
    """Cuadros activos de la CUJAE con su cargo y área.

    Un cuadro no es una tabla propia: es la categoría ocupacional de código 5
    en `RH_Categorias_Ocupacionales`. La búsqueda `q` separa términos y cada
    uno debe aparecer en el nombre, en cualquiera de los dos apellidos, en el
    carné, en el cargo o en el área; `id_direccion` acota a una unidad.

    Expone carné de identidad, así que exige `trabajadores.ver` igual que el
    resto de listados de personal.
    """
    return service.cuadros(q, id_direccion, limit, offset)


@app.get("/api/cuadros/exportar/pdf")
def exportar_cuadros_pdf(
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> Response:
    """Listado completo de cuadros en PDF.

    Sin fotografías: solo nombre y apellidos, carné, cargo y área, que es lo
    que se necesita para el trabajo de oficina.
    """
    datos = service.cuadros_exportables()
    contenido = generar_cuadros_pdf(datos)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="cuadros.pdf"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/cuadros/exportar/excel")
def exportar_cuadros_excel(
    _sesion: dict = Depends(exigir_permiso("trabajadores.ver")),
) -> Response:
    """Listado completo de cuadros en Excel (`.xlsx`)."""
    datos = service.cuadros_exportables()
    contenido = generar_cuadros_excel(datos)
    return Response(
        content=contenido,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="cuadros.xlsx"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/salarios", response_model=SalarioRespuesta)
def get_salarios(
    q: str = Query(..., min_length=1, max_length=128),
    _sesion: dict = Depends(exigir_permiso("salarios.ver")),
) -> SalarioRespuesta:
    """Salario y nómina de un trabajador, por carné de identidad o usuario.

    Es la consulta más sensible del portal —son salarios nominales—, así que
    exige el permiso `salarios.ver` y no el de listados de personal.

    `q` admite las dos formas de identificar a una persona en la CUJAE: el
    carné de identidad (11 dígitos) o el usuario de internet del AD. Si es un
    carné se resuelve contra la base; si no, se traduce en el AD a su carné.

    Cuando la persona no aparece se responde `200` con `encontrado=false`, para
    que la vista pueda decirlo sin tratarlo como error. Un fallo del directorio
    sí es `503`.
    """
    try:
        return service.salario(q)
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/mi-nomina", response_model=MiNomina)
def get_mi_nomina(sesion: dict = Depends(exigir_sesion)) -> MiNomina:
    """Nómina de la persona autenticada, sin aceptar un carné por parámetro.

    Es el autoservicio del portal: cualquier trabajador con sesión puede ver
    sus propios datos, pero el carné se toma siempre de la sesión para que no
    se pueda consultar la nómina de otra persona cambiando la URL.
    """
    return service.mi_nomina(sesion["carnet_identidad"])


def _sin_tildes(texto: object) -> str:
    """Todo a minúsculas y sin diacríticos, para buscar sin importar acentos."""
    return "".join(
        c for c in unicodedata.normalize("NFD", str(texto))
        if unicodedata.category(c) != "Mn"
    ).lower()


def _descargar_metadata() -> list[dict]:
    try:
        with open(DESCARGAS_JSON, encoding="utf-8") as fh:
            items = json.load(fh).get("items", [])
    except OSError:
        items = []
    return items


@app.get("/api/buscar")
def buscar_sitio(
    q: str = "",
    limite: int = Query(6, ge=1, le=25),
    sesion: dict = Depends(exigir_sesion),
) -> dict:
    """Buscador de todo el sitio.

    Agrupa trabajadores, usuarios del portal, áreas, descargas y plazas
    vacantes. Cada grupo solo se consulta si el perfil activo tiene el permiso
    correspondiente (mismos criterios que el proxy del frontend).
    """
    termino = _sin_tildes((q or "").strip())
    vacio = {"trabajadores": [], "usuarios": [], "areas": [], "descargas": [], "vacantes": []}
    if len(termino) < 2:
        return {"q": q, **vacio}

    perm = sesion.get("permisos") or []

    # Trabajadores: requiere `trabajadores.ver`.
    resultado: dict = {"q": q, **vacio}
    if "trabajadores.ver" in perm:
        try:
            lista = service.trabajadores_por_estado("activos", q, limite, 0)
            resultado["trabajadores"] = [r.model_dump() for r in lista.items]
        except Exception:  # noqa: BLE001
            pass

    # Usuarios del portal: requiere `usuarios.administrar`.
    if "usuarios.administrar" in perm:
        try:
            resultado["usuarios"] = [
                UsuarioPortal(**fila).model_dump()
                for fila in usuarios_repo.listar(q, limite, 0)
            ]
        except Exception:  # noqa: BLE001
            pass

    # Áreas: datos de negocio, visibles para cualquier sesión.
    coinciden_areas = []
    for area in service.areas():
        texto = _sin_tildes(f"{area.Desc_Direccion} {area.Id_Direccion}")
        if termino in texto:
            coinciden_areas.append(area.model_dump())
            if len(coinciden_areas) >= limite:
                break
    resultado["areas"] = coinciden_areas

    # Descargas: coincidencia por nombre o extensión.
    coinciden_docs = []
    for doc in _descargar_metadata():
        texto = _sin_tildes(f"{doc.get('nombre', '')} {doc.get('ext', '')}")
        if termino in texto:
            coinciden_docs.append(
                {
                    "id": doc.get("id"),
                    "ext": doc.get("ext", ""),
                    "nombre": doc.get("nombre", ""),
                    "url": doc.get("url", ""),
                }
            )
            if len(coinciden_docs) >= limite:
                break
    resultado["descargas"] = coinciden_docs

    # Plazas vacantes: cargo o dirección.
    coinciden_vacantes = []
    try:
        vacantes = service.plazas_vacantes(limite * 4)
    except Exception:  # noqa: BLE001
        vacantes = None
    if vacantes:
        for plaza in vacantes.plazas:
            texto = _sin_tildes(
                f"{plaza.Desc_Cargo} {plaza.Desc_Direccion} "
                f"{plaza.Id_Cargo} {plaza.Id_Direccion}"
            )
            if termino in texto:
                coinciden_vacantes.append(plaza.model_dump())
                if len(coinciden_vacantes) >= limite:
                    break
    resultado["vacantes"] = coinciden_vacantes

    return resultado


@app.get("/api/areas", response_model=list[Area])
def get_areas() -> list[Area]:
    return service.areas()


@app.get("/api/areas/{area_id}", response_model=Area)
def get_area(area_id: str) -> Area:
    area = service.area(area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return area


@app.get("/api/areas/{area_id}/trabajadores", response_model=list[Trabajador])
def get_trabajadores_por_area(area_id: str) -> list[Trabajador]:
    return service.trabajadores_por_area(area_id)


@app.get("/api/plantilla/areas", response_model=PlantillaAreas)
def get_plantilla_areas() -> PlantillaAreas:
    return service.plantilla_areas()


def _area_o_404(area_id: str) -> dict:
    area = service.area_reporte(area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área de reporte no encontrada")
    return area


def exigir_area_reporte(
    area: str | None = Query(default=None, min_length=1, max_length=16),
    sesion: dict = Depends(exigir_sesion),
) -> dict:
    """Autoriza consultar un área de reporte concreta.

    Los reportes por área dejaron de ser públicos. Ahora exigen sesión y se
    limitan al ámbito del perfil:
    - `negocio.ver` (alta dirección, especialista RH) y `superadmin` ven
      cualquier área, y también pueden omitir `area` (listado global).
    - `area.ver` (jefes de área y sus delegados) ven solo las áreas asignadas
      en `usuario_areas`; si omiten `area` no se les devuelve nada global, para
      evitar una filtración de la plantilla completa.
    """
    carnet = sesion.get("carnet_identidad") or ""
    es_global = puede_acceder_area(
        sesion, -1, usuario_areas_repo.ids_de(carnet)
    )  # -1 no existe: solo True si el perfil ve todo
    if area is None:
        if es_global:
            return sesion
        raise HTTPException(
            status_code=403,
            detail="Debe indicar un área concreta para consultar estos datos.",
        )
    area_obj = _area_o_404(area)
    if not puede_acceder_area(
        sesion, int(area_obj["id"]), usuario_areas_repo.ids_de(carnet)
    ):
        raise HTTPException(
            status_code=403,
            detail="No tiene acceso a esta área de reporte.",
        )
    return sesion


@app.get("/api/plantilla", response_model=list[Plaza])
def get_plantilla(
    limit: int = 500,
    offset: int = 0,
    area: str | None = None,
    _sesion: dict = Depends(exigir_area_reporte),
) -> list[Plaza]:
    return service.plantilla(limit, offset, area)


@app.get("/api/plazas_vacantes", response_model=PlazasVacantes)
def get_plazas_vacantes(limit: int = 20) -> PlazasVacantes:
    return service.plazas_vacantes(limit)


@app.get("/api/cumpleanos_hoy", response_model=list[Cumpleanos])
def get_cumpleanos_hoy() -> list[Cumpleanos]:
    return service.cumpleanos_hoy()


DESCARGAS_JSON = os.path.join(os.path.dirname(__file__), "descargas.json")


@app.get("/api/descargas")
def get_descargas() -> dict:
    try:
        with open(DESCARGAS_JSON, encoding="utf-8") as fh:
            return json.load(fh)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"No metadata: {exc}") from exc


# ---------------------------------------------------------------------------
# Nóminas y Reportes
# ---------------------------------------------------------------------------

REPORTES_JSON = os.path.join(os.path.dirname(__file__), "reportes.json")


def _guardar_reportes_metadata(areas: list[dict]) -> None:
    """Persiste la lista de áreas (id+nombre+conteos) para el frontend."""
    try:
        with open(REPORTES_JSON, "w", encoding="utf-8") as fh:
            json.dump({"areas": areas}, fh, ensure_ascii=False, indent=2)
    except OSError:
        pass


@app.get("/api/reportes/areas")
def get_reportes_areas() -> dict:
    areas = service.areas_reporte()
    areas = [a for a in areas]
    _guardar_reportes_metadata(areas)
    return {"areas": areas}


def _pdf_response(area_id: str, filename: str) -> StreamingResponse:
    try:
        fh = open(filename, "rb")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo generar el PDF: {exc}") from exc

    def iterfile():
        with fh:
            yield from fh

    nombre = f"reporte_{area_id}.pdf"
    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{nombre}"'},
    )


@app.get("/api/reportes/plazas_vacantes")
def get_reporte_plazas_vacantes(area: str, _sesion: dict = Depends(exigir_area_reporte)):
    _area_o_404(area)
    return service.plazas_vacantes_area(area)


@app.get("/api/reportes/prenomina")
def get_prenomina(area: str, _sesion: dict = Depends(exigir_area_reporte)):
    _area_o_404(area)
    from services.pdf_reportes import generar_prenomina
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), f"prenomina_{area}.pdf")
    generar_prenomina(tmp, area, service.prenomina(area))
    return _pdf_response(area, tmp)


@app.get("/api/reportes/tarifa_horaria")
def get_tarifa_horaria(
    area: str,
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    _sesion: dict = Depends(exigir_area_reporte),
):
    _area_o_404(area)
    from services.pdf_reportes import generar_tarifa_horaria
    import tempfile
    datos = service.tarifa_horaria_portal(area, ano, mes)
    tmp = os.path.join(
        tempfile.gettempdir(),
        f"tarifa_horaria_{area}_{datos.ano}_{datos.mes}.pdf",
    )
    generar_tarifa_horaria(
        tmp, area, [i.model_dump() for i in datos.items], datos.ano, datos.mes
    )
    return _pdf_response(area, tmp)


# ---------------------------------------------------------------------------
# Tarifa horaria: horas insertadas por la técnica
# ---------------------------------------------------------------------------


@app.get("/api/tarifa-horaria", response_model=TarifaHorariaRespuesta)
def get_tarifa_horaria_lista(
    area: str,
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    _sesion: dict = Depends(exigir_area_reporte),
) -> TarifaHorariaRespuesta:
    """Horas de tarifa horaria insertadas para un área y un período.

    Es la misma información que muestra el PDF oficial, así que comparte su
    autorización: exige sesión y se limita al área asignada. La escritura sí
    exige permiso de gestión.
    """
    _area_o_404(area)
    return service.tarifa_horaria_portal(area, ano, mes)


@app.get("/api/tarifa-horaria/admin", response_model=TarifaHorariaRespuestaAdmin)
def get_tarifa_horaria_admin(
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    area: str | None = Query(default=None),
    _sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> TarifaHorariaRespuestaAdmin:
    """Listado de gestión: todos los trabajadores con horas en el período.

    Incluye el área real de cada fila para editar/eliminar sin cambiar de
    pestaña. A diferencia de la consulta pública, exige permiso de gestión.
    """
    try:
        return service.tarifa_horaria_admin(ano, mes, area)
    except TarifaHorariaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/tarifa-horaria/periodos", response_model=PeriodosTarifa)
def get_periodos_tarifa() -> PeriodosTarifa:
    """Histórico de períodos con horas, del más reciente al más antiguo."""
    return service.periodos_tarifa()


@app.post("/api/tarifa-horaria/cerrar", response_model=CierreTarifa)
def cerrar_tarifa_horaria(
    body: CierreTarifaEntrada,
    sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> CierreTarifa:
    """Cierra el período: sus horas quedan en el histórico y no se modifican más."""
    usuario = (
        str(sesion.get("nombre") or "").strip()
        or str(sesion.get("carnet_identidad") or "").strip()
        or None
    )
    return service.cerrar_tarifa(body.ano, body.mes, usuario)


@app.get("/api/tarifa-horaria/buscar", response_model=TrabajadorTarifa)
def buscar_tarifa_horaria(
    nro: str = Query(..., min_length=1, max_length=15),
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    _sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> TrabajadorTarifa:
    """Resuelve un número de cumplidor y devuelve la ficha y sus horas."""
    return service.buscar_tarifa(nro, ano, mes)


@app.post("/api/tarifa-horaria", response_model=TarifaHorariaGuardada)
def guardar_tarifa_horaria(
    body: TarifaHorariaEntrada,
    sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> TarifaHorariaGuardada:
    """Inserta o actualiza las horas de un trabajador para el período."""
    try:
        return service.guardar_tarifa(
            body, str(sesion.get("carnet_identidad") or "") or None
        )
    except TrabajadorTarifaNoEncontrado as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PeriodoCerrado as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AreaTarifaNoCoincide as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TarifaHorariaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/tarifa-horaria/{row_id}", response_model=TarifaHorariaGuardada)
def actualizar_tarifa_horaria(
    row_id: int,
    body: TarifaHorariaEdicion,
    sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> TarifaHorariaGuardada:
    """Actualiza solo las horas de una fila existente del período."""
    usuario = str(sesion.get("carnet_identidad") or "") or None
    try:
        return service.actualizar_tarifa(row_id, body.Horas, usuario)
    except PeriodoCerrado as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TarifaHorariaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/tarifa-horaria/{row_id}")
def borrar_tarifa_horaria(
    row_id: int,
    _sesion: dict = Depends(exigir_permiso("tarifa_horaria.gestionar")),
) -> dict:
    """Elimina una fila de horas insertada por error."""
    try:
        service.eliminar_tarifa(row_id)
    except PeriodoCerrado as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TarifaHorariaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"eliminado": True}


@app.get("/api/reportes/sobrecarga")
def get_sobrecarga(area: str, _sesion: dict = Depends(exigir_area_reporte)):
    _area_o_404(area)
    from services.pdf_reportes import generar_sobrecarga
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), f"sobrecarga_{area}.pdf")
    generar_sobrecarga(tmp, area, service.sobrecarga(area))
    return _pdf_response(area, tmp)


@app.get("/api/recien_graduados", response_model=list[RecienGraduado])
def get_recien_graduados(area: str, _sesion: dict = Depends(exigir_area_reporte)):
    """Adiestrados / recién graduados (contrato de adiestramiento) de un área."""
    _area_o_404(area)
    return service.recien_graduados(area)


# ---------------------------------------------------------------------------
# Módulo de administración: usuarios importados del LDAP (AD de la CUJAE)
# ---------------------------------------------------------------------------


def _persona_a_schema(persona: dict) -> PersonaLDAP:
    return PersonaLDAP(
        carnet_identidad=persona.get("carnet_identidad"),
        usuario_internet=persona.get("usuario_internet"),
        nombre=persona.get("nombre"),
        apellidos=persona.get("apellidos"),
        email_institucional=persona.get("email_institucional"),
        area=persona.get("area"),
        departamento=persona.get("departamento"),
        es_estudiante=bool(persona.get("es_estudiante")),
        tiene_foto=bool(persona.get("foto_bytes")),
    )


@app.get("/api/admin/ldap/buscar", response_model=PersonaLDAP)
def buscar_persona_ldap(
    q: str = Query(..., min_length=1, max_length=128, description="CI o usuario de internet"),
    _admin: dict = Depends(exigir_admin),
) -> PersonaLDAP:
    """Busca una persona en el AD (solo lectura, no guarda nada)."""
    try:
        return _persona_a_schema(buscar_persona(q))
    except PersonaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _validar_perfil(codigo: str) -> str:
    if not permisos.perfil_existe(codigo):
        raise HTTPException(status_code=422, detail="Perfil inválido")
    return codigo


@app.post("/api/admin/usuarios/importar", response_model=UsuarioPortal)
def importar_usuario_ldap(
    body: ImportarUsuarioRequest, _admin: dict = Depends(exigir_admin)
) -> UsuarioPortal:
    """Importa una persona del AD y le asigna el perfil indicado.

    Busca por carné o usuario de internet, guarda sus datos en PostgreSQL
    (actualizando si ya estaba) y le asigna el perfil. Se pueden importar
    varias veces para corregir datos o cambiar el perfil.
    """
    _validar_perfil(body.perfil)
    try:
        persona = buscar_persona(body.identificador)
    except PersonaNoEncontrada as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    fila = usuarios_repo.sincronizar(persona)
    fila = usuarios_repo.aplicar_perfil(fila["carnet_identidad"], body.perfil)
    return UsuarioPortal(**fila)


@app.post("/api/admin/usuarios/importar-lote", response_model=ImportarLoteResponse)
def importar_usuarios_lote(
    body: ImportarLoteRequest, _admin: dict = Depends(exigir_admin)
) -> ImportarLoteResponse:
    """Importa varias personas del AD en una sola operación.

    Cada identificador puede ser carné, usuario de internet, correo o UPN. El
    directorio se consulta con una sola conexión y las filas se guardan en una
    sola transacción. El `perfil` es opcional: si viene, se asigna a todas las
    importadas; si no, cada una queda como `invitado`.

    Se responde siempre con un resumen: `importados` cuenta las que entraron y
    `errores` detalla las que no (no existen, sin carné o fallo de consulta),
    de modo que un identificador mal escrito no tire abajo el lote.
    """
    identificadores = [x.strip() for x in body.identificadores if x and x.strip()]
    if not identificadores:
        raise HTTPException(status_code=422, detail="Debe indicar al menos un identificador")
    perfil = None
    if body.perfil:
        perfil = _validar_perfil(body.perfil)

    try:
        personas, errores = buscar_varias_personas(identificadores)
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    importados: list[UsuarioPortal] = []
    if personas:
        filas = usuarios_repo.importar_varias(personas, perfil)
        importados = [UsuarioPortal(**f) for f in filas]

    total = len(importados)
    resumen = f"Se importaron {total} de {len(identificadores)}."
    if errores:
        resumen += f" No se pudieron importar {len(errores)}."
    return ImportarLoteResponse(
        importados=total, errores=errores, resumen=resumen
    )


# ---------------------------------------------------------------------------
# Áreas por usuario (jefes de área y sus delegados)
# ---------------------------------------------------------------------------


def _nombre_area(area_id: int) -> str | None:
    """Nombre visible de un área de reporte por su id."""
    area = service.area_reporte(str(area_id))
    return area.get("nombre") if area else None


@app.get("/api/mi/areas", response_model=list[AreaAsignada])
def get_mis_areas(sesion: dict = Depends(exigir_sesion)) -> list[AreaAsignada]:
    """Áreas de reporte que la persona autenticada puede consultar.

    Es lo que usa el frontend para decidir qué áreas mostrar en el selector
    de reportes de un jefe o su delegado. Quien ve todo (RRHH, alta dirección,
    superadmin) recibe la lista completa de áreas.
    """
    carnet = sesion.get("carnet_identidad") or ""
    if puede_acceder_area(sesion, -1, set()):  # -1 no existe: True si ve todo
        return [
            AreaAsignada(area_id=int(a["id"]), nombre=a.get("nombre"), es_jefe=False)
            for a in service.areas_reporte()
        ]
    filas = usuario_areas_repo.areas_de(carnet)
    return [
        AreaAsignada(
            area_id=int(f["area_id"]),
            nombre=_nombre_area(int(f["area_id"])),
            es_jefe=bool(f.get("es_jefe")),
            otorgado_por=f.get("otorgado_por"),
            creado=f.get("creado"),
        )
        for f in filas
    ]


@app.get("/api/admin/usuarios/{carnet}/areas", response_model=list[AreaAsignada])
def get_areas_usuario(
    carnet: str, _admin: dict = Depends(exigir_admin)
) -> list[AreaAsignada]:
    """Áreas asignadas a un usuario, para la vista de administración."""
    return [
        AreaAsignada(
            area_id=int(f["area_id"]),
            nombre=_nombre_area(int(f["area_id"])),
            es_jefe=bool(f.get("es_jefe")),
            otorgado_por=f.get("otorgado_por"),
            creado=f.get("creado"),
        )
        for f in usuario_areas_repo.areas_de(carnet)
    ]


@app.put("/api/admin/usuarios/{carnet}/areas", response_model=list[AreaAsignada])
def asignar_area_usuario(
    carnet: str,
    body: AsignarAreaRequest,
    _admin: dict = Depends(exigir_admin),
) -> list[AreaAsignada]:
    """Vincula a un usuario con un área de reporte (marcar jefe de área).

    Es lo que hace el checkbox "Jefe de área" al importar un cuadro: el
    administrador marca a la persona y aquí se guarda su vínculo con el área.
    Si además tiene el perfil `jefe_area`, se le asigna para que pueda
    designar delegados.
    """
    _area_o_404(str(body.area_id))
    usuario_areas_repo.asignar(
        carnet, int(body.area_id), es_jefe=bool(body.es_jefe)
    )
    if body.es_jefe and permisos.perfil_existe("jefe_area"):
        usuarios_repo.aplicar_perfil(carnet, "jefe_area")
    return get_areas_usuario(carnet, _admin)


@app.delete("/api/admin/usuarios/{carnet}/areas/{area_id}", response_model=list[AreaAsignada])
def quitar_area_usuario(
    carnet: str,
    area_id: int,
    _admin: dict = Depends(exigir_admin),
) -> list[AreaAsignada]:
    """Quita el vínculo de un usuario con un área."""
    usuario_areas_repo.quitar(carnet, int(area_id))
    return get_areas_usuario(carnet, _admin)


@app.post("/api/jefe/delegar", response_model=list[AreaAsignada])
def delegar_area(
    body: DelegarAreaRequest,
    sesion: dict = Depends(exigir_permiso("area.autorizar")),
) -> list[AreaAsignada]:
    """El jefe designa a una persona de su área como delegado.

    Regla tomada del sistema "viajes": antes de autorizar se comprueba, contra
    la base de RRHH, que la persona designada pertenece al área del jefe o a un
    área dependiente. Si no, se rechaza con 403. El delegado recibe el área sin
    ser jefe (`es_jefe=false`), lo que le da `area.ver` pero no `area.autorizar`.
    """
    jefe_carnet = sesion.get("carnet_identidad") or ""
    area_id = int(body.area_id)

    if not usuario_areas_repo.es_jefe_de(jefe_carnet, area_id):
        raise HTTPException(
            status_code=403,
            detail="Solo el jefe titular del área puede designar delegados.",
        )

    # Resolver la persona designada en el AD.
    try:
        persona, _ = buscar_varias_personas([body.identificador.strip()])
    except LDAPNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not persona:
        raise HTTPException(
            status_code=404,
            detail="No se encontró a la persona designada en el directorio.",
        )
    delegado = persona[0]
    delegado_carnet = str(delegado.get("carnet_identidad") or "").strip()
    if not delegado_carnet:
        raise HTTPException(
            status_code=422,
            detail="La persona designada no tiene carné de identidad en el AD."
        )
    if delegado_carnet == jefe_carnet:
        raise HTTPException(
            status_code=422, detail="No puede designarse a sí mismo."
        )

    # Regla de viajes: el delegado debe ser del área (o subárea) del jefe.
    areas_rh = AreasRH(factory.empleados())
    ficha_jefe = areas_rh.ficha(jefe_carnet)
    ficha_deleg = areas_rh.ficha(delegado_carnet)
    if not areas_rh.es_misma_area_o_subarea(
        ficha_jefe.get("Id_Direccion"), ficha_jefe.get("Desc_Direccion"),
        ficha_deleg.get("Id_Direccion"), ficha_deleg.get("Desc_Direccion"),
    ):
        raise HTTPException(
            status_code=403,
            detail="La persona designada no pertenece a su área.",
        )

    # Guardar el delegado en el portal y vincularle el área.
    usuarios_repo.sincronizar(delegado)
    usuario_areas_repo.asignar(
        delegado_carnet, area_id, es_jefe=False, otorgado_por=jefe_carnet
    )
    if permisos.perfil_existe("delegado_area"):
        usuarios_repo.aplicar_perfil(delegado_carnet, "delegado_area")

    return get_mis_areas(sesion)


@app.get("/api/mi/delegados", response_model=list[dict])
def get_mis_delegados(sesion: dict = Depends(exigir_permiso("area.autorizar"))) -> list[dict]:
    """Personas que el jefe autenticado ha designado en sus áreas."""
    jefe_carnet = sesion.get("carnet_identidad") or ""
    salida: list[dict] = []
    for area in usuario_areas_repo.areas_de(jefe_carnet):
        if not area.get("es_jefe"):
            continue
        for d in usuario_areas_repo.delegados_de_area(int(area["area_id"])):
            salida.append(
                {
                    "carnet_identidad": d.get("carnet_identidad"),
                    "nombre": d.get("nombre"),
                    "apellidos": d.get("apellidos"),
                    "usuario_internet": d.get("usuario_internet"),
                    "area_id": int(d.get("area_id")),
                    "area_nombre": _nombre_area(int(d.get("area_id"))),
                    "creado": d.get("creado"),
                }
            )
    return salida


@app.delete("/api/mi/delegados/{carnet}/{area_id}")
def revocar_delegado(
    carnet: str,
    area_id: int,
    sesion: dict = Depends(exigir_permiso("area.autorizar")),
) -> dict:
    """El jefe revoca la delegación a una persona de su área."""
    jefe_carnet = sesion.get("carnet_identidad") or ""
    if not usuario_areas_repo.es_jefe_de(jefe_carnet, int(area_id)):
        raise HTTPException(
            status_code=403,
            detail="Solo el jefe titular del área puede revocar delegados.",
        )
    if not usuario_areas_repo.quitar(carnet, int(area_id)):
        raise HTTPException(status_code=404, detail="Esa delegación no existe.")
    return {"ok": True}


@app.get("/api/admin/cuadros", response_model=CuadroLista)
def get_cuadros_admin(
    q: str = Query(default="", max_length=128),
    id_direccion: str = Query(default="", max_length=24),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: dict = Depends(exigir_admin),
) -> CuadroLista:
    """Cuadros activos con su estado en el portal (para la importación).

    Además de los datos de RRHH, indica si la persona ya tiene fila en
    `usuarios` y a qué área de reporte mapea su `Id_Direccion`, para que la
    vista pueda marcar quién es jefe de área.
    """
    lista = service.cuadros(q, id_direccion, limit, offset)

    # Cruzar con el portal en dos consultas globales (no una por cuadro):
    # quién es jefe de área y quién ya tiene cuenta importada.
    jefes = {f["carnet_identidad"]: int(f["area_id"]) for f in usuario_areas_repo.jefes()}
    try:
        en_portal = usuarios_repo.carnets_existentes(
            [(c.No_CI or "").strip() for c in lista.items if (c.No_CI or "").strip()]
        )
    except Exception:  # noqa: BLE001 — el portal es PostgreSQL; si cae, no se tumba la lista
        en_portal = set()

    for item in lista.items:
        carnet = (item.No_CI or "").strip()
        unidad = (item.Id_Direccion or "").strip().upper()
        area_id = area_de_unidad(unidad)
        item.area_id = area_id
        item.en_portal = carnet in en_portal
        # Solo es jefe si está marcado justamente para esa área.
        item.es_jefe = bool(area_id is not None and jefes.get(carnet) == area_id)
    return lista


@app.post("/api/admin/cuadros/importar", response_model=ImportarCuadrosResponse)
def importar_cuadros(
    body: ImportarCuadrosRequest, _admin: dict = Depends(exigir_admin)
) -> ImportarCuadrosResponse:
    """Da de alta los cuadros activos en el portal (cuentas LDAP).

    Toma todos los cuadros activos (categoría 5) de RRHH, los busca en el AD
    por carné y los importa a `usuarios` en un solo lote, para que puedan
    autenticarse con su usuario y clave institucionales. `solo_faltantes`
    evita resincronizar a los que ya tienen fila.

    `perfiles` es el perfil que se asigna a los recién importados (opcional).
    El área de cada cuadro no se guarda aquí: se asigna después, al marcarlo
    como jefe de área desde la vista.
    """
    cuadros = service.cuadros_exportables()
    carnets = [
        (c.get("No_CI") or "").strip()
        for c in cuadros
        if (c.get("No_CI") or "").strip()
    ]
    # Quitar duplicados conservando el orden.
    vistos: set[str] = set()
    carnets_unicos = [c for c in carnets if not (c in vistos or vistos.add(c))]

    if body.solo_faltantes:
        existentes = {
            c for c in carnets_unicos if usuarios_repo.obtener(c) is not None
        }
        a_buscar = [c for c in carnets_unicos if c not in existentes]
    else:
        a_buscar = carnets_unicos

    perfil = None
    if body.perfiles:
        perfil = _validar_perfil(body.perfiles[0])

    errores: list[ImportarLoteError] = []
    importados = 0
    if a_buscar:
        try:
            personas, errs = buscar_varias_personas(a_buscar)
        except LDAPNoDisponible as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        errores = [
            ImportarLoteError(identificador=e["identificador"], motivo=e["motivo"])
            for e in errs
        ]
        if personas:
            filas = usuarios_repo.importar_varias(personas, perfil)
            importados = len(filas)

    resumen = (
        f"Se importaron {importados} de {len(carnets_unicos)} cuadros "
        f"({len(errores)} sin encontrar en el directorio)."
    )
    return ImportarCuadrosResponse(
        total_cuadros=len(carnets_unicos),
        importados=importados,
        ya_existian=len(carnets_unicos) - len(a_buscar),
        errores=errores,
        resumen=resumen,
    )


@app.put("/api/admin/usuarios/{carnet}/perfiles", response_model=UsuarioPortal)
def asignar_perfiles(
    carnet: str,
    body: AsignarPerfilesRequest,
    _admin: dict = Depends(exigir_admin),
) -> UsuarioPortal:
    """Reemplaza el conjunto de perfiles de un usuario.

    Es la vía por la que un superadministrador crea y edita administradores, así
    que hay que impedir que se quede a sí mismo (o a cualquier cuenta de
    arranque) sin el perfil que le permite administrar.
    """
    for codigo in body.perfiles:
        _validar_perfil(codigo)
    if carnet in permisos.superadmines_por_carnet() and "superadmin" not in body.perfiles:
        raise HTTPException(
            status_code=400,
            detail="El superadministrador del sistema no puede quedarse sin su perfil",
        )
    try:
        return UsuarioPortal(**usuarios_repo.establecer_perfiles(carnet, sorted(set(body.perfiles))))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado") from exc


@app.patch("/api/admin/usuarios/{carnet}/perfiles/{perfil}", response_model=UsuarioPortal)
def activar_perfil(
    carnet: str,
    perfil: str,
    body: ActivarPerfilRequest,
    _admin: dict = Depends(exigir_admin),
) -> UsuarioPortal:
    """Activa o desactiva un perfil que el usuario ya tiene asignado.

    Desactivar no borra la asignación: queda para poder reactivarla después.
    """
    _validar_perfil(perfil)
    if not body.activo and carnet in permisos.superadmines_por_carnet():
        raise HTTPException(
            status_code=400,
            detail="El superadministrador del sistema no puede perder su perfil",
        )
    try:
        fila = usuarios_repo.activar_perfil(carnet, perfil, body.activo)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado") from exc
    if perfil not in (fila.get("perfiles") or []):
        raise HTTPException(
            status_code=400, detail="El usuario no tiene asignado ese perfil"
        )
    return UsuarioPortal(**fila)


@app.patch("/api/admin/usuarios/{carnet}/activo", response_model=UsuarioPortal)
def activar_usuario(
    carnet: str,
    body: ActivarPerfilRequest,
    _admin: dict = Depends(exigir_admin),
) -> UsuarioPortal:
    """Desactiva o reactiva el acceso de una persona al portal.

    Desactivar no borra nada: la fila sigue con sus datos y perfiles, solo deja
    de poder iniciar sesión. Se usa cuando alguien se va de la institución.
    """
    if not body.activo and carnet in permisos.superadmines_por_carnet():
        raise HTTPException(
            status_code=400,
            detail="El superadministrador del sistema no puede desactivarse",
        )
    try:
        return UsuarioPortal(**usuarios_repo.establecer_activo(carnet, body.activo))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado") from exc


@app.get("/api/admin/usuarios", response_model=list[UsuarioPortal])
def listar_usuarios(
    q: str = "",
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _admin: dict = Depends(exigir_admin),
) -> list[UsuarioPortal]:
    return [UsuarioPortal(**r) for r in usuarios_repo.listar(q, limit, offset)]


@app.get("/api/admin/usuarios/total")
def total_usuarios(q: str = "", _admin: dict = Depends(exigir_admin)) -> dict:
    return {"total": usuarios_repo.contar(q)}


@app.get("/api/admin/usuarios/{carnet}", response_model=UsuarioPortal)
def obtener_usuario(carnet: str, _admin: dict = Depends(exigir_admin)) -> UsuarioPortal:
    row = usuarios_repo.obtener(carnet)
    if row is None:
        raise HTTPException(status_code=404, detail="Usuario no importado")
    return UsuarioPortal(**row)


@app.get("/api/admin/usuarios/{carnet}/foto")
def foto_usuario(carnet: str, _admin: dict = Depends(exigir_admin)):
    """Sirve la foto de perfil guardada en el portal (JPEG del AD).

    Es un binario, así que no lleva `response_model`. Se devuelve 404 cuando
    la persona no está o no tiene foto: el avatar del frontend cae entonces a
    sus iniciales con el gradiente derivado del nombre.
    """
    from fastapi.responses import Response

    try:
        foto = usuarios_repo.obtener_foto(carnet)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503, detail="No se pudo leer la foto del usuario"
        ) from exc
    if foto is None:
        raise HTTPException(status_code=404, detail="Usuario sin foto")
    return Response(content=foto, media_type="image/jpeg")


@app.delete("/api/admin/usuarios/{carnet}")
def eliminar_usuario(carnet: str, _admin: dict = Depends(exigir_admin)) -> dict:
    """Borra la fila del portal de una persona.

    Como la fila se vuelve a crear sola en su próximo ingreso (con perfil
    `invitado`), normalmente lo que se usa es `activo = false`.
    """
    if carnet in permisos.superadmines_por_carnet():
        raise HTTPException(
            status_code=400, detail="El superadministrador del sistema no puede borrarse"
        )
    if not usuarios_repo.eliminar(carnet):
        raise HTTPException(status_code=404, detail="Usuario no importado")
    return {"ok": True}