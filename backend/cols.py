import sys
sys.path.insert(0, "/opt/rh_app/backend")
import pymssql
from config import settings
conn = pymssql.connect(server=settings.mssql_host, user=settings.mssql_user,
                       password=settings.mssql_pass, database=settings.mssql_db, as_dict=True)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) filas, COUNT(DISTINCT Id_Direccion) distintos, "
            "SUM(CASE WHEN Baja=1 THEN 1 ELSE 0 END) dadas_de_baja "
            "FROM RH_Unidades_Organizativas")
print("RH_Unidades_Organizativas:", cur.fetchone())
cur.execute("SELECT Id_Direccion, COUNT(*) n FROM RH_Unidades_Organizativas "
            "GROUP BY Id_Direccion HAVING COUNT(*) > 1")
print("duplicados:", cur.fetchall())
conn.close()
