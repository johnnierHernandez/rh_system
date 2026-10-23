"""Vuelca a Empleados_Gral.Foto las fotos que publica la intranet.

Fuente: http://intranet.cujae.edu.cu/Image.aspx?ci={carnet}
Solo guarda retratos reales (>1KB, los JPEG planos ~650B son el placeholder
de "sin foto"). Reanudable: ignora filas que ya tienen Foto.

Uso desde el ct (backend):
    venv/bin/python backfill_fotos.py --apply [--max N] [--espera S]
Sin --apply sólo cuenta cuántas faltan (dry-run).
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.parse
import urllib.request

import pymssql

from config import settings

INTRA = "http://intranet.cujae.edu.cu/Image.aspx?ci="
UMBRAL = 1024  # placeholder negro (JPEG plano) debajo de este tamaño


def foto_intranet(ci: str) -> bytes | None:
    url = f"{INTRA}{urllib.parse.quote(ci)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DRHnet-backfill/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            datos = r.read()
            tipo = r.headers.get("Content-Type", "")
        if datos and "image" in tipo and len(datos) > UMBRAL:
            return datos
    except Exception:  # noqa: BLE001
        pass
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="escribe en la base")
    ap.add_argument("--max", type=int, default=0, help="límite de carnés a procesar (0 = todos)")
    ap.add_argument("--espera", type=float, default=0.0, help="segundos de espera entre peticiones")
    opc = ap.parse_args()

    conn = pymssql.connect(
        server=settings.mssql_host,
        user=settings.mssql_user,
        password=settings.mssql_pass,
        database=settings.mssql_db,
    )
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT RTRIM(No_CI) AS ci
        FROM Empleados_Gral
        WHERE Foto IS NULL OR DATALENGTH(Foto) = 0
        """
    )
    carnes = [r[0] for r in cur.fetchall()]
    carnes = [c for c in carnes if c]
    if not carnes:
        print("No hay carnés sin foto. Nada que hacer.")
        return 0

    print(f"\nCarnés únicos sin foto: {len(carnes)}")
    if not opc.apply:
        ancho = max(len(c) for c in carnes)
        cur.execute("SELECT COUNT(*) FROM Empleados_Gral")
        filas = cur.fetchone()[0]
        print(f"(dry-run) filas totales en Empleados_Gral: {filas}")
        print("Ejecuta con --apply para escribir las fotos (primeros 10 carnés de muestra):")
        for c in carnes[:10]:
            print(f"  {c:<{ancho}} {foto_intranet(c) is not None}")
        return 0

    if opc.max:
        carnes = carnes[: opc.max]

    n_ok = n_placeholder = n_error = 0
    t0 = time.time()
    for i, ci in enumerate(carnes, 1):
        foto = foto_intranet(ci)
        if foto:
            cur.execute(
                "UPDATE Empleados_Gral SET Foto=%s WHERE RTRIM(No_CI)=%s",
                (pymssql.Binary(foto), ci),
            )
            n_ok += 1
        else:
            n_placeholder += 1
        if i % 200 == 0:
            conn.commit()
        if i % 1000 == 0 or i == len(carnes):
            trans = time.time() - t0
            print(
                f"{i}/{len(carnes)}  fotos={n_ok}  placeholders/sin={n_placeholder}  "
                f"errores={n_error}  {trans:.0f}s"
            )
            sys.stdout.flush()
        if opc.espera:
            time.sleep(opc.espera)

    conn.commit()
    conn.close()

    total = len(carnes)
    print("\nResumen")
    print("  carnés procesados:", total)
    print("  con foto guardada:", n_ok)
    print("  sin retrato (placeholder/404):", n_placeholder)
    print("  tiempo total:", f"{time.time() - t0:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())