"""Cruza las horas importadas con la unidad actual del trabajador.

No modifica nada: solo informa si el área guardada en PostgreSQL coincide con
la unidad de `Empleados_Gral` y con la unidad vigente en `RSUMA14B` (nómina).
"""

import sys

import psycopg2
import pymssql

sys.path.insert(0, "/opt/rh_app/backend")
from areas_reportes import AREAS_REPORTE  # noqa: E402
from config import settings  # noqa: E402

ANO, MES = 2026, 10

unidad_area: dict[str, tuple[int, str]] = {}
for area in AREAS_REPORTE:
    for unidad in area["unidades"]:
        unidad_area[str(unidad).strip().upper()] = (int(area["id"]), area["nombre"])
for codigo, area_id in (("D0000", 35), ("V0000", 31)):
    nombre = next(a["nombre"] for a in AREAS_REPORTE if int(a["id"]) == area_id)
    unidad_area[codigo] = (area_id, nombre)


def area_de(unidad: str | None) -> tuple[int, str]:
    return unidad_area.get(str(unidad or "").strip().upper(), (0, "SIN ÁREA"))


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
    SELECT RTRIM(Id_Empleado) AS id,
           RTRIM(Id_Direccion) AS dir,
           LTRIM(RTRIM(Nombre)) + ' ' + LTRIM(RTRIM(Apellido_1)) + ' '
               + LTRIM(RTRIM(Apellido_2)) AS nombre,
           Baja
    FROM Empleados_Gral
    """
)
empleados = {r["id"]: r for r in mc.fetchall()}

mc.execute(
    """
    SELECT RTRIM(Id_Empleado) AS id,
           RTRIM(UnidadOrganizativa) AS unidad,
           LTRIM(RTRIM(Desc_UnidadOrganizativa)) AS desc_unidad
    FROM RSUMA14B
    """
)
ruma = {r["id"]: r for r in mc.fetchall()}

dsn = (
    f"host={settings.pg_host} port={settings.pg_port} dbname={settings.pg_db} "
    f"user={settings.pg_user} password={settings.pg_pass} connect_timeout=5"
)
pg = psycopg2.connect(dsn)
pg.set_client_encoding("UTF8")
pc = pg.cursor()
pc.execute(
    """
    SELECT id_empleado, nombre, unidad, area_id, horas
    FROM tarifa_horaria_horas
    WHERE ano = %s AND mes = %s
    ORDER BY area_id, nombre
    """,
    (ANO, MES),
)
filas = pc.fetchall()

mismatches_ruma = []
mismatches_emp = []
sin_ruma = []
for id_empleado, nombre, unidad, area_pg, horas in filas:
    emp = empleados.get(id_empleado)
    area_emp, nombre_emp = area_de(emp["dir"] if emp else unidad)
    if area_emp != area_pg:
        mismatches_emp.append(
            (id_empleado, nombre, horas, area_pg, area_emp, emp["dir"] if emp else "?")
        )
    r = ruma.get(id_empleado)
    if not r:
        sin_ruma.append((id_empleado, nombre, area_pg, horas))
        continue
    area_ruma, nombre_ruma = area_de(r["unidad"])
    if area_ruma != area_pg:
        mismatches_ruma.append(
            (
                id_empleado,
                nombre,
                horas,
                area_pg,
                area_ruma,
                r["unidad"],
                r["desc_unidad"],
            )
        )

print(f"filas PostgreSQL {ANO}-{MES}: {len(filas)}")
print(f"trabajadores en RSUMA14B: {len(ruma)}")
print(f"filas importadas que NO están en RSUMA14B: {len(sin_ruma)}")
print(f"mismatches contra Empleados_Gral: {len(mismatches_emp)}")
print(f"mismatches contra RSUMA14B: {len(mismatches_ruma)}")

if mismatches_emp:
    print("\n-- área PostgreSQL != área Empleados_Gral --")
    for m in mismatches_emp:
        print(m)

if mismatches_ruma:
    print("\n-- área PostgreSQL != área RSUMA14B (unidad vigente) --")
    for m in mismatches_ruma:
        print(m)

print("\n-- 58404 --")
print("Empleados_Gral:", empleados.get("58404"))
print("RSUMA14B:", ruma.get("58404"))
print("PostgreSQL:", [f for f in filas if f[0] == "58404"])
