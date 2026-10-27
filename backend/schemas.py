"""
Esquemas de respuesta (dto) + Patrón Null Object:
objetos "vacíos" tipados en lugar de None, para evitar checks null en las capas
de presentación.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Trabajador(BaseModel):
    Id_Expediente: str | None = None
    No_CI: str | None = None
    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    Id_Cargo: str | None = None
    Desc_Cargo: str | None = None
    Sexo: str | None = None
    Docente: bool | None = None
    Investigador: bool | None = None
    Fecha_Contratacion: str | None = None
    Fecha_Baja: str | None = None
    Baja: int | None = None


class TrabajadorLista(BaseModel):
    total: int = 0
    items: list[Trabajador] = []


class Cuadro(BaseModel):
    """Un cuadro activo: categoría ocupacional 5 (`RH_Categorias_Ocupacionales`).

    No es una entidad propia en la base: un cuadro es simplemente una fila de
    `Empleados_Gral` con ese código en `Id_Categoria`. Cargo y área llegan
    resueltos desde sus catálogos.
    """

    No_CI: str | None = None
    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Id_Cargo: str | None = None
    Desc_Cargo: str | None = None
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    # Área de reporte a la que pertenece el `Id_Direccion` del cuadro. Solo se
    # rellena en la vista de administración (importación de cuadros), para poder
    # marcarlo como jefe de área y vincularlo de una vez.
    area_id: int | None = None
    # Estado en el portal (solo en la vista de administración): si ya tiene
    # cuenta importada y si está marcado como jefe de área de su `area_id`.
    en_portal: bool = False
    es_jefe: bool = False


class CuadroLista(BaseModel):
    total: int = 0
    items: list[Cuadro] = []


class Resumen(BaseModel):
    empleados_activos: int = 0
    empleados_baja: int = 0
    total_empleados: int = 0
    areas: int = 0
    cargos: int = 0

    @classmethod
    def empty(cls) -> "Resumen":
        """Null Object: resumen por defecto sin datos."""
        return cls()


class Area(BaseModel):
    Id_Direccion: str
    Desc_Direccion: str
    Id_DireccionPadre: str | None = None
    trabajadores: int = 0


class Plaza(BaseModel):
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    Id_Cargo: str | None = None
    Desc_Cargo: str | None = None
    Vacante: bool | None = None
    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Fecha_Contratacion: str | None = None
    Fecha_Cargo: str | None = None


class PlantillaArea(BaseModel):
    id: int
    nombre: str
    total: int = 0
    vacantes: int = 0


class PlantillaAreas(BaseModel):
    total: int = 0
    cubiertas: int = 0
    vacantes: int = 0
    areas: list[PlantillaArea] = Field(default_factory=list)

    @classmethod
    def empty(cls) -> "PlantillaAreas":
        return cls()


class PlazasVacantes(BaseModel):
    total: int = 0
    plazas: list[Plaza] = Field(default_factory=list)

    @classmethod
    def empty(cls) -> "PlazasVacantes":
        """Null Object: sin plazas vacantes."""
        return cls()


class PlazaVacante(BaseModel):
    Plaza: int | None = None
    Nivel: int | None = None
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    Id_Cargo: str | None = None
    Desc_Cargo: str | None = None
    Id_Categoria: str | None = None
    Desc_Categoria: str | None = None
    Salario_Basico: float | None = None
    Plus: float | None = None
    Estimulo: float | None = None
    Otros: float | None = None


class PlazasVacantesArea(BaseModel):
    area: str
    area_nombre: str = ""
    total: int = 0
    unidades: list[str] = Field(default_factory=list)
    plazas: list[PlazaVacante] = Field(default_factory=list)

    @classmethod
    def empty(cls, area: str = "") -> "PlazasVacantesArea":
        """Null Object: área sin plazas vacantes."""
        return cls(area=area)


class Cumpleanos(BaseModel):
    """Cumpleañero del día. Sin Id_Expediente ni No_CI: es un endpoint público."""

    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    Fecha_Nacimiento: str | None = None

    @classmethod
    def empty(cls) -> "Cumpleanos":
        """Null Object: cumpleañero por defecto."""
        return cls()


class RecienGraduado(BaseModel):
    """Adiestrado / recién graduado (contrato de adiestramiento) de un área."""

    Id_Expediente: str | None = None
    No_CI: str | None = None
    Nombre: str | None = None
    Desc_Cargo: str | None = None
    Desc_UnidadOrganizativa: str | None = None
    Fecha_Contratacion: str | None = None


class PersonaLDAP(BaseModel):
    """Persona tal como la devuelve el Active Directory de la CUJAE."""

    carnet_identidad: str | None = None
    usuario_internet: str | None = None
    nombre: str | None = None
    apellidos: str | None = None
    email_institucional: str | None = None
    area: str | None = None
    departamento: str | None = None
    es_estudiante: bool = False
    tiene_foto: bool = False


class UsuarioPortal(PersonaLDAP):
    """Usuario del portal: sus datos del AD más lo que se le asignó aquí."""

    activo: bool = True
    perfiles: list[str] = []
    perfiles_inactivos: list[str] = []
    perfil_activo: str | None = None
    creado: datetime | None = None
    actualizado: datetime | None = None


class PerfilCatalogo(BaseModel):
    """Un perfil del catálogo, con los permisos que concede."""

    codigo: str
    nombre: str
    descripcion: str | None = None
    permisos: list[str] = []
    prioridad: int = 0
    activo: bool = True


class ImportarUsuarioRequest(BaseModel):
    """Importa un usuario del AD y le asigna el perfil indicado."""

    identificador: str = Field(..., min_length=1, max_length=128)
    perfil: str = Field(..., min_length=1, max_length=50)


class ImportarLoteRequest(BaseModel):
    """Importa varios usuarios del AD en una sola operación.

    A diferencia del caso individual (`perfil` obligatorio), el perfil aquí es
    opcional: cada persona se sincroniza con su perfil `invitado` si no se
    indica. Cada identificador puede ser carné, usuario de internet, correo o
    UPN; el AD los resuelve igual que en la importación de uno en uno.
    """

    identificadores: list[str] = Field(..., min_length=1, max_length=200)
    perfil: str | None = Field(default=None, min_length=1, max_length=50)


class ImportarLoteError(BaseModel):
    """Un identificador que no se pudo importar y por qué."""

    identificador: str
    motivo: str


class ImportarLoteResponse(BaseModel):
    """Resultado de una importación en lote, con el detalle por persona."""

    importados: int = 0
    errores: list[ImportarLoteError] = Field(default_factory=list)
    resumen: str = ""


class AsignarPerfilesRequest(BaseModel):
    """Reemplaza el conjunto de perfiles de un usuario."""

    perfiles: list[str] = Field(..., max_length=10)


class ActivarPerfilRequest(BaseModel):
    """Activa o desactiva un perfil que ya tiene asignado."""

    activo: bool


class PerfilSeleccion(BaseModel):
    """Elige con qué perfil se opera. `null` vuelve al de mayor jerarquía."""

    perfil: str | None = None


class LoginRequest(BaseModel):
    """Credenciales del AD: usuario de internet (o carné) y clave."""

    identificador: str = Field(..., min_length=1, max_length=128)
    clave: str = Field(..., min_length=1, max_length=256)


class Identidad(BaseModel):
    """Identidad de la sesión en curso. Sin credenciales ni datos sensibles."""

    carnet_identidad: str
    usuario_internet: str | None = None
    nombre: str | None = None
    apellidos: str | None = None
    email_institucional: str | None = None
    area: str | None = None
    departamento: str | None = None
    perfiles: list[str] = []
    perfil_activo: str | None = None
    perfil_activo_nombre: str = ""
    permisos: list[str] = []
    perfiles_detalle: list[dict] = []
    # Carné de quien abrió esta sesión suplantando, si aplica.
    impersonando: str | None = None


class NumerosItem(BaseModel):
    """Métrica de la sección Números CUJAE: etiqueta, valor y porcentaje."""

    etiqueta: str
    valor: int
    porcentaje: float


class NumerosUnidad(BaseModel):
    """Unidad organizativa con personal activo."""

    id_direccion: str
    etiqueta: str
    valor: int


class Numeros(BaseModel):
    """Cifras de la plantilla activa para la sección Números CUJAE del home."""

    total_activos: int = 0
    docentes: int = 0
    no_docentes: int = 0
    unidades: int = 0
    fecha_corte: str | None = None
    sexo: list[NumerosItem] = Field(default_factory=list)
    contratos: list[NumerosItem] = Field(default_factory=list)
    categorias_docentes: list[NumerosItem] = Field(default_factory=list)
    ocupacional: list[NumerosItem] = Field(default_factory=list)
    top_unidades: list[NumerosUnidad] = Field(default_factory=list)

    @classmethod
    def empty(cls) -> "Numeros":
        """Null Object: cifras vacías si la base no responde."""
        return cls()


class SalarioComponentes(BaseModel):
    """Salario vigente y sus componentes (`RH_Empleados_Nomina`).

    Todos los importes son mensuales y en CUP. `Tarifa` es el valor de la hora
    (o del día, según `Calculo_por_tarifa_diaria`) y `Tarifa_Diaria` el del día.
    """

    Tarifa: float | None = None
    Tarifa_Diaria: float | None = None
    Salario_Basico: float | None = None
    Salario_por_Cargo: float | None = None
    Plus: float | None = None
    Antiguedad: float | None = None
    Estimulo: float | None = None
    Porciento_Estimulo: float | None = None
    Otros: float | None = None
    Retribucion_Complementaria: float | None = None
    IETerritorial: float | None = None
    ETSector: float | None = None
    Idoneidad_Fijo: float | None = None
    Idoneidad_Movil: float | None = None
    Estimulacion: float | None = None
    HorarioIrregular: float | None = None
    Otras_CLA: float | None = None
    Horas_Extra: float | None = None
    Condiciones: float | None = None
    Dias_Acumulado: float | None = None
    Salario_Acumulado: float | None = None
    Id_Tipo_Participacion: str | None = None


class SalarioHistorico(BaseModel):
    """Una fila del sueldo fijo declarado un mes (`RH_Historico_Nomina_Sueldo_Fijo`)."""

    Ano: int | None = None
    Mes: int | None = None
    Salario_Basico: float | None = None
    Salario_por_Cargo: float | None = None
    Plus: float | None = None
    Antiguedad: float | None = None
    Estimulo: float | None = None
    Otros: float | None = None
    Dias_Trabajados: float | None = None
    Devengado: float | None = None


class SalarioCobro(BaseModel):
    """Total cobrado un mes (`RH_Resumen_de_Cobros`)."""

    Ano: int | None = None
    Mes: int | None = None
    Salario: float | None = None
    Dias_Trabajados: float | None = None
    Vacaciones: float | None = None
    Dias_Vacaciones: float | None = None
    Salario_para_Subsidio: float | None = None
    Dias_Trabajados_para_Subsidio: float | None = None
    Subsidio: float | None = None
    Maternidad: float | None = None


class SalarioNominilla(BaseModel):
    """Concepto pagado en la última nominilla (`RH_Historico_Nominilla`).

    `Clasificacion` es el código (`RH_Clasificacion_Nominillas_MS`); el texto
    del concepto va en `Desc_Clasif_Nominilla`.
    """

    Clasificacion: int | None = None
    Desc_Clasif_Nominilla: str | None = None
    Salario_Basico: float | None = None
    Plus: float | None = None
    Antiguedad: float | None = None
    Otros: float | None = None
    Dias_a_Pagar: float | None = None
    Devengado: float | None = None
    Acobrar: float | None = None
    Deducciones: float | None = None
    Devengado_Tarjeta: float | None = None


class SalarioTotal(BaseModel):
    """Totales de nómina del conjunto de expedientes de una persona.

    En el pluriempleo dentro de una misma entidad la ley obliga a tratar al
    trabajador como un solo sujeto: se suman las remuneraciones de todos sus
    expedientes y sobre ese total se calculan las retenciones
    (`GOC-2023-271-EX20`, Resolución 41/2023, apartado NOVENO).

    `Devengado` es la base gravable del período de referencia (suma del sueldo
    fijo y la nominilla de todos los expedientes); `Seguridad_Social` y
    `Impuesto_Ingresos` son las retenciones que le corresponden según las
    escalas de esa Resolución, y `Neto` lo que queda tras descontarlas junto con
    `Otras_Deducciones`.
    """

    expedientes: int = 0
    periodo: str | None = None
    Salario_Basico: float = 0.0
    Devengado: float = 0.0
    Seguridad_Social: float = 0.0
    Impuesto_Ingresos: float = 0.0
    Otras_Deducciones: float = 0.0
    Total_Descuentos: float = 0.0
    Neto: float = 0.0


class SalarioExpediente(BaseModel):
    """Todos los datos de nómina de un expediente concreto.

    Una persona puede tener más de un expediente (plaza y docencia); el
    listado va con los activos primero y el principal delante.
    """

    Id_Expediente: str | None = None
    No_CI: str | None = None
    Nombre: str | None = None
    Apellido_1: str | None = None
    Apellido_2: str | None = None
    Id_Cargo: str | None = None
    Desc_Cargo: str | None = None
    Id_Direccion: str | None = None
    Desc_Direccion: str | None = None
    Desc_Categoria: str | None = None
    Desc_Subcategoria: str | None = None
    Desc_Grado_Cientifico: str | None = None
    Plaza: int | None = None
    Baja: int | None = None
    actual: SalarioComponentes | None = None
    historico: list[SalarioHistorico] = Field(default_factory=list)
    cobros: list[SalarioCobro] = Field(default_factory=list)
    nominilla_periodo: str | None = None
    nominilla: list[SalarioNominilla] = Field(default_factory=list)


class SalarioRespuesta(BaseModel):
    """Resultado de consultar el salario por carné o usuario de internet.

    `metodo` indica cómo se resolvió el identificador: `carnet` si ya era un
    carné, `usuario_internet` si hubo que resolverlo contra el AD.
    """

    consulta: str
    encontrado: bool = False
    metodo: str | None = None
    personas: list[SalarioExpediente] = Field(default_factory=list)
    total: SalarioTotal | None = None

    @classmethod
    def vacio(cls, consulta: str, metodo: str | None = None) -> "SalarioRespuesta":
        """Null Object: consulta resuelta pero sin nómina que mostrar."""
        return cls(consulta=consulta, encontrado=False, metodo=metodo)


class MiNominaMes(BaseModel):
    """Un mes de cobro de la persona, con todos sus expedientes sumados."""

    Ano: int | None = None
    Mes: int | None = None
    Salario: float = 0.0
    Dias_Trabajados: float = 0.0
    Vacaciones: float = 0.0
    Dias_Vacaciones: float = 0.0


class MiNomina(BaseModel):
    """Autoservicio «Mi nómina»: solo los datos de la persona autenticada.

    No lleva número de expediente ni datos de terceros: el carné sale de la
    sesión y el servicio no acepta otro identificador.
    """

    encontrado: bool = False
    carnet: str = ""
    nombre: str | None = None
    area: str | None = None
    cargo: str | None = None
    expedientes: int = 0
    periodo: str | None = None
    total: SalarioTotal | None = None
    dias_acumulados: float = 0.0
    salario_acumulado: float = 0.0
    dias_trabajados: float = 0.0
    periodo_dias: str | None = None
    ultimos_cobros: list[MiNominaMes] = Field(default_factory=list)
    mensaje: str | None = None


class TarifaHorariaItem(BaseModel):
    """Una fila de horas de tarifa horaria insertada por la técnica."""

    Id: int
    Id_Empleado: str
    Nombre: str
    Horas: float
    Baja: bool = False


class TarifaHorariaRespuesta(BaseModel):
    """Horas de tarifa horaria de un área para un período de trabajo."""

    ano: int
    mes: int
    area: int
    area_nombre: str
    items: list[TarifaHorariaItem] = Field(default_factory=list)
    total_horas: float = 0.0
    total_trabajadores: int = 0
    cerrado: bool = False
    cerrado_por: str | None = None
    cerrado_en: datetime | None = None


class TarifaHorariaItemAdmin(TarifaHorariaItem):
    """Fila del listado de gestión: incluye el área real del trabajador."""

    Id_Area: int
    area_nombre: str


class TarifaHorariaRespuestaAdmin(BaseModel):
    """Listado de todos los trabajadores con horas en un período."""

    ano: int
    mes: int
    area: int | None = None
    area_nombre: str | None = None
    items: list[TarifaHorariaItemAdmin] = Field(default_factory=list)
    total_horas: float = 0.0
    total_trabajadores: int = 0
    cerrado: bool = False
    cerrado_por: str | None = None
    cerrado_en: datetime | None = None


class TarifaHorariaEntrada(BaseModel):
    """Datos que teclea la técnica: área, período, número de cumplidor y horas."""

    area: int = Field(..., ge=0)
    ano: int | None = Field(default=None, ge=2000, le=2100)
    mes: int | None = Field(default=None, ge=1, le=12)
    Id_Empleado: str = Field(..., min_length=1, max_length=15)
    Horas: float = Field(..., gt=0, le=744)


class TarifaHorariaEdicion(BaseModel):
    """Edición de una fila existente: solo cambian las horas."""

    Horas: float = Field(..., gt=0, le=744)


class TarifaHorariaGuardada(BaseModel):
    """Resultado de insertar o actualizar una fila de tarifa horaria."""

    creado: bool
    item: TarifaHorariaItem


class TrabajadorTarifa(BaseModel):
    """Vista previa del trabajador resuelto por su número de cumplidor."""

    encontrado: bool = False
    Id_Empleado: str | None = None
    Id_Expediente: str | None = None
    No_CI: str | None = None
    Nombre: str | None = None
    Baja: bool = False
    Id_Area: int = 0
    area_nombre: str | None = None
    Horas: float | None = None
    mensaje: str | None = None


class CierreTarifaEntrada(BaseModel):
    """Período que la técnica cierra al terminar la entrada de horas."""

    ano: int = Field(..., ge=2000, le=2100)
    mes: int = Field(..., ge=1, le=12)


class CierreTarifa(BaseModel):
    """Estado del cierre de un período."""

    ano: int
    mes: int
    cerrado: bool = True
    cerrado_por: str | None = None
    cerrado_en: datetime | None = None


class PeriodoTarifa(BaseModel):
    """Un período del histórico mensual de tarifa horaria."""

    ano: int
    mes: int
    trabajadores: int = 0
    horas: float = 0.0
    cerrado: bool = False
    cerrado_por: str | None = None
    cerrado_en: datetime | None = None


class PeriodosTarifa(BaseModel):
    """Histórico de períodos con horas registradas."""

    periodos: list[PeriodoTarifa] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Áreas por usuario (jefes de área y sus delegados)
# ---------------------------------------------------------------------------


class AreaAsignada(BaseModel):
    """Un área de reporte autorizada para un usuario del portal."""

    area_id: int
    nombre: str | None = None
    es_jefe: bool = False
    otorgado_por: str | None = None
    creado: datetime | None = None


class AsignarAreaRequest(BaseModel):
    """Vincula a un usuario con un área de reporte.

    `es_jefe` marca al titular del área (el que puede designar delegados). Un
    delegado entra con `es_jefe=false`, designado por el jefe.
    """

    area_id: int = Field(..., ge=1)
    es_jefe: bool = False


class DelegarAreaRequest(BaseModel):
    """El jefe designa a una persona de su área como delegado.

    `identificador` puede ser carné o usuario de internet; el sistema lo
    resuelve en el LDAP y valida (regla de viajes) que sea de su área antes de
    autorizarlo.
    """

    identificador: str = Field(..., min_length=1, max_length=128)
    area_id: int = Field(..., ge=1)


class CuadroImportado(BaseModel):
    """Resultado de alta de un cuadro en el portal."""

    carnet_identidad: str
    area_id: int | None = None
    area_nombre: str | None = None
    es_jefe: bool = False
    estado: str = "importado"


class ImportarCuadrosRequest(BaseModel):
    """Importa los cuadros activos al portal.

    Si `solo_faltantes` es true solo da de alta los cuadros que aún no tienen
    fila en `usuarios`; si no, resincroniza todos. `perfiles` es el perfil que
    se les asigna a los recién importados (por defecto `jefe_area` si se marcan
    como jefes, si no `invitado`).
    """

    solo_faltantes: bool = True
    perfiles: list[str] = Field(default_factory=list, max_length=10)


class ImportarCuadrosResponse(BaseModel):
    """Resumen de la importación de cuadros."""

    total_cuadros: int = 0
    importados: int = 0
    ya_existian: int = 0
    errores: list[ImportarLoteError] = Field(default_factory=list)
    resumen: str = ""