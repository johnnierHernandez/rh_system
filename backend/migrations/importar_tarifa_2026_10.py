"""Carga inicial del Excel en la tabla PostgreSQL del portal.

Lee el XLSX `/root/fichero_tarifa.xlsx` (columnas A = número de cumplidor,
B = horas) y resuelve la ficha del trabajador en MSSQL solo para guardar
nombre, expediente, CI, unidad y baja. Las horas **no** se leen de ninguna
tabla del sistema anterior: salen del Excel y se guardan en
`tarifa_horaria_horas` (PostgreSQL).
"""

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

import psycopg2
import pymssql

sys.path.insert(0, "/opt/rh_app/backend")
from areas_reportes import AREAS_REPORTE  # noqa: E402
from config import settings  # noqa: E402

ANO, MES = 2026, 10
ARCHIVO = "/root/fichero_tarifa.xlsx"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

unidad_area: dict[str, int] = {}
for _area in AREAS_REPORTE:
    for _unidad in _area["unidades"]:
        unidad_area[_unidad.strip().upper()] = int(_area["id"])
# Unidades heredadas con descripción inequívoca.
unidad_area["D0000"] = 35   # Secretaría General
unidad_area["V0000"] = 31   # Facultad de Ingeniería Eléctrica


def cinco(nro: str) -> str:
    nro = str(nro).strip()
    return nro.zfill(5) if nro.isdigit() else nro


def leer_excel(path: str) -> list[tuple[str, float]]:
    """Lee A (número) y B (horas) de la primera hoja, sin openpyxl."""
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{NS}si"):
                shared.append(
                    "".join(t.text or "" for t in si.iter(f"{NS}t"))
                )
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        datos: list[tuple[str, float]] = []
        for row in root.find(f"{NS}sheetData").findall(f"{NS}row"):
            celdas: dict[str, str] = {}
            for c in row.findall(f"{NS}c"):
                ref = c.get("r") or ""
                col = re.match(r"([A-Z]+)", ref).group(1)
                v = c.find(f"{NS}v")
                if v is None:
                    continue
                valor = v.text
                if c.get("t") == "s":
                    valor = shared[int(valor)]
                if valor is not None:
                    celdas[col] = valor
            a = (celdas.get("A") or "").strip()
            b = (celdas.get("B") or "").strip()
            if not a or not b:
                continue
            try:
                datos.append((a, float(b.replace(",", "."))))
            except ValueError:
                continue
        return datos


pares = leer_excel(ARCHIVO)
print(f"filas leídas del Excel: {len(pares)}")
print(f"horas del Excel: {sum(h for _, h in pares):.2f}")

# MSSQL: solo identidad del trabajador (no horas).
mssql = pymssql.connect(
    server=settings.mssql_host,
    port=settings.mssql_port,
    user=settings.mssql_user,
    password=settings.mssql_pass,
    database=settings.mssql_db,
    tds_version="7.4",
    login_timeout=15,
    timeout=300,
)
mc = mssql.cursor(as_dict=True)
mc.execute(
    """
    SELECT RTRIM(e.Id_Empleado) AS id,
           RTRIM(e.Id_Expediente) AS exp,
           RTRIM(e.No_CI) AS ci,
           LTRIM(RTRIM(e.Nombre)) + ' ' + LTRIM(RTRIM(e.Apellido_1)) + ' '
               + LTRIM(RTRIM(e.Apellido_2)) AS nombre,
           COALESCE(
               NULLIF(RTRIM(r.UnidadOrganizativa), ''),
               RTRIM(e.Id_Direccion)
           ) AS dir,
           e.Baja
    FROM Empleados_Gral AS e
    LEFT JOIN RSUMA14B AS r
           ON RTRIM(r.Id_Empleado) = RTRIM(e.Id_Empleado)
    """
)
fichas = {r["id"]: r for r in mc.fetchall()}
print(f"fichas en Empleados_Gral: {len(fichas)}")

# PostgreSQL: tabla del portal.
dsn = (
    f"host={settings.pg_host} port={settings.pg_port} dbname={settings.pg_db} "
    f"user={settings.pg_user} password={settings.pg_pass} connect_timeout=5"
)
pg = psycopg2.connect(dsn)
pg.set_client_encoding("UTF8")
pc = pg.cursor()

# Un período cerrado ya está en el histórico y no admite cambios.
pc.execute(
    "SELECT 1 FROM tarifa_horaria_cierres WHERE ano = %s AND mes = %s",
    (ANO, MES),
)
if pc.fetchone():
    print(f"El período {ANO}-{MES} está cerrado; no se importa.")
    sys.exit(1)

procesadas = 0
sin_ficha: list[str] = []
sin_area: list[tuple] = []
por_area: dict[int, int] = defaultdict(int)
horas_area: dict[int, float] = defaultdict(float)

for nro, horas in pares:
    eid = cinco(nro)
    ficha = fichas.get(eid)
    if not ficha:
        sin_ficha.append(nro)
        continue
    area = unidad_area.get((ficha["dir"] or "").strip().upper(), 0)
    if not area:
        sin_area.append((nro, ficha["nombre"], ficha["dir"]))
        continue
    por_area[area] += 1
    horas_area[area] += horas
    pc.execute(
        """
        INSERT INTO tarifa_horaria_horas
            (ano, mes, area_id, id_empleado, id_expediente, no_ci,
             nombre, unidad, horas, baja, creado_por)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ano, mes, id_empleado) DO UPDATE SET
            area_id         = EXCLUDED.area_id,
            id_expediente   = EXCLUDED.id_expediente,
            no_ci           = EXCLUDED.no_ci,
            nombre          = EXCLUDED.nombre,
            unidad          = EXCLUDED.unidad,
            horas           = EXCLUDED.horas,
            baja            = EXCLUDED.baja,
            actualizado_por = EXCLUDED.creado_por,
            actualizado_en  = now()
        """,
        (
            ANO, MES, area, eid, ficha["exp"], ficha["ci"],
            ficha["nombre"], ficha["dir"], horas, bool(ficha["Baja"]),
            "importacion-excel",
        ),
    )
    procesadas += 1
pg.commit()

print(f"filas procesadas: {procesadas}")
print(f"sin ficha: {sin_ficha}")
print(f"sin área: {sin_area}")

pc.execute(
    """
    SELECT area_id, COUNT(*), SUM(horas)
    FROM tarifa_horaria_horas
    WHERE ano = %s AND mes = %s
    GROUP BY area_id
    ORDER BY area_id
    """,
    (ANO, MES),
)
print("\nresumen en PostgreSQL:")
for r in pc.fetchall():
    print(f"  área {r[0]:3d}: {r[1]:3d} trabajadores, {float(r[2]):8.2f} h")

pc.execute(
    "SELECT COUNT(*), SUM(horas) FROM tarifa_horaria_horas WHERE ano = %s AND mes = %s",
    (ANO, MES),
)
t = pc.fetchone()
print(f"\ntotal: {t[0]} filas, {float(t[1]):.2f} h")
