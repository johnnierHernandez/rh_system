"""
Generador de los reportes oficiales de Nóminas y Reportes:

  * Prenómina PC-10      (modelo M-10.05.03 / SC-4-05, código 223.0.6817)
  * Reporte de Tarifa Horaria
  * Reporte de Pago por Sobrecarga del Trabajo Docente (S.C.D.)

Replica el formato de los PDF del sistema anterior (DRHnet). Dibuja con el
canvas de reportlab para control exacto del diseño de formulario oficial.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from reportlab.lib import colors
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from areas_reportes import AREA_BY_ID

# Source Sans 3 (tipografía corporativa web CUJAE) para todos los reportes,
# alineada con la letra del sitio. Instancias estáticas de la variable fuente.
pdfmetrics.registerFont(TTFont(
    "SourceSans3",
    "/opt/rh_app/backend/fonts/SourceSans3-Regular.ttf"))
pdfmetrics.registerFont(TTFont(
    "SourceSans3-Bold",
    "/opt/rh_app/backend/fonts/SourceSans3-Bold.ttf"))
pdfmetrics.registerFont(TTFont(
    "SourceSans3-Italic",
    "/opt/rh_app/backend/fonts/SourceSans3-Italic.ttf"))
pdfmetrics.registerFont(TTFont(
    "SourceSans3-BoldItalic",
    "/opt/rh_app/backend/fonts/SourceSans3-BoldItalic.ttf"))
pdfmetrics.registerFontFamily("SourceSans3", normal="SourceSans3",
                              bold="SourceSans3-Bold",
                              italic="SourceSans3-Italic",
                              boldItalic="SourceSans3-BoldItalic")

PAGE_W, PAGE_H = 1008, 612  # pts exactos de los PDF originales

MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

CO_CATEGORIA = {
    "1": "T",
    "2": "A",
    "3": "S",
    "4": "O",
    "5": "D",
    "7": "D",
}

MARGEN_INF = 90  # y mínimo antes de pasar de hoja


def _dias_del_mes(anio: int, mes: int) -> int:
    if mes == 12:
        return 31
    return (date(anio, mes + 1, 1) - date(anio, mes, 1)).days


def _periodo_actual() -> tuple[int, int]:
    hoy = date.today()
    primero_del_mes = date(hoy.year, hoy.month, 1)
    ant = primero_del_mes - timedelta(days=1)
    return ant.year, ant.month


def _nombre_area(area_id: int | str) -> str:
    area = AREA_BY_ID.get(int(area_id))
    if not area:
        return f"Área {area_id}"
    return area.get("corto") or area["nombre"]


def _co(empleado: dict) -> str:
    return CO_CATEGORIA.get(str(empleado.get("Id_Categoria", "")).strip(), "")


def _text(c: pdf_canvas.Canvas, x: float, y: float, s: str, *, size: float = 8,
          bold: bool = False) -> None:
    c.saveState()
    c.setFont("SourceSans3-Bold" if bold else "SourceSans3", size)
    c.drawString(x, y, s)
    c.restoreState()


_ANCHO_UNIDAD = 79.5  # desde x=61.71 hasta antes de "ANOTADO POR:" (144.57)
_FIN_UNIDAD = 141.74  # borde derecho de la celda UNIDAD


def _unidad(c: pdf_canvas.Canvas, x: float, y: float, nombre: str) -> None:
    """Dibuja el nombre de la unidad en UNIDAD, en 1 o 2 renglones.

    Si el nombre (SourceSans3-Bold 10) excede el ancho disponible se parte en
    dos renglones ajustados al ancho, como el sistema viejo con nombres largos.
    Los nombres de una sola palabra demasiado anchos se corren a la izquierda
    para que terminen dentro de la celda.
    """
    from reportlab.pdfbase.pdfmetrics import stringWidth
    c.saveState()
    c.setFont("SourceSans3-Bold", 10)
    ancho = stringWidth(nombre, "SourceSans3-Bold", 10)
    if ancho <= _ANCHO_UNIDAD:
        c.drawString(x, y, nombre)
        c.restoreState()
        return
    palabras = nombre.split()
    if len(palabras) == 1:
        c.drawString(_FIN_UNIDAD - ancho - 1.0, y, nombre)
        c.restoreState()
        return
    l1 = ""
    for i, p in enumerate(palabras):
        candidato = (l1 + " " + p).strip()
        if l1 and stringWidth(candidato, "SourceSans3-Bold", 10) > _ANCHO_UNIDAD:
            l2 = " ".join(palabras[i:])
            c.drawString(x, y, l1)
            c.drawString(x, y - 12.0, l2)
            c.restoreState()
            return
        l1 = candidato
    c.drawString(x, y, l1)
    c.restoreState()


def _encabezado_general(c: pdf_canvas.Canvas, area_nombre: str, titulo: str,
                        con_modelo: bool, periodo: dict,
                        hoja: int = 1, hojas: int = 1,
                        titulo_x: float = 623.37,
                        con_etiquetas_cobro: bool = True) -> None:
    """Cabecera institucional (réplica exacta del original, SourceSans3 10).

    Posiciones (baselines en bottom-origin) y fuentes medidas sobre
    old_21.pdf: 6 filas de 14.17 separadas; etiquetas F1=SourceSans3 regular
    10, PRENOMINA F2=Bold 14 y el área F2=Bold 10.

    `titulo_x` reproduce la posición que cada reporte original fija para su
    título (623.37 prenómina, 558.42 tarifa, 440.57 sobrecarga), porque cada
    página PHP los colocaba en coordenadas distintas.

    `con_etiquetas_cobro` reproduce otro detalle del original: los rótulos
    A PAGAR / A DESCONTAR / REGULAR / HORAS EXTRAS solo aparecen en la
    prenómina (old_pc10.pdf, y=516.87) y en la tarifa (old_to.pdf, y=531.04);
    el reporte de sobrecarga (old_scd7.pdf) no los dibuja, aunque sí mantiene
    los cuatro cuadritos de check de la retícula.
    """
    y = 573.56
    if con_modelo:
        _text(c, 31.19, y, "M-10.05.03", size=10)
        _text(c, 952.06, y, "SC-4-05", size=10)
    y -= 14.17
    _text(c, 31.19, y, "ORGANISMO: MES", size=10)
    _text(c, 144.57, y, "CONFECCIONADO POR:", size=10)
    c.saveState()
    c.setFont("SourceSans3-Bold", 14)
    c.drawString(titulo_x, y - 1.2, titulo)
    c.restoreState()
    _text(c, 927.10, y, "HOJA No.", size=10)
    y -= 14.17
    _text(c, 31.19, y, "EMPRESA: CUJAE", size=10)
    _text(c, 144.57, y, "APROBADO POR:", size=10)
    if con_modelo:
        _text(c, 805.37, y, "Código   223.0.6817", size=10)
    _text(c, 925.57, y, str(hoja), size=10)
    _text(c, 961.97, y, str(hojas), size=10)
    y -= 14.17
    _text(c, 31.19, y, "UNIDAD:", size=10)
    _text(c, 144.57, y, "CHEQUEADO POR:", size=10)
    _text(c, 812.35, y, "PERÍODO A QUE CORRESPONDE", size=10)
    y -= 14.17
    _unidad(c, 61.71, y, area_nombre)
    _text(c, 144.57, y, "ANOTADO POR:", size=10)
    if con_etiquetas_cobro:
        _text(c, 434.60, y, "A PAGAR", size=10)
        _text(c, 506.04, y, "A DESCONTAR", size=10)
        _text(c, 603.63, y, "REGULAR", size=10)
        _text(c, 681.34, y, "HORAS EXTRAS", size=10)
    _text(c, 796.54, y, "DESDE", size=10)
    _text(c, 847.62, y, periodo["desde"].split()[0], size=10)
    _text(c, 898.20, y, periodo["desde"].split()[1], size=10)
    _text(c, 959.75, y, periodo["desde"].split()[2], size=10)
    y -= 14.17
    _text(c, 796.54, y, "HASTA", size=10)
    _text(c, 844.84, y, periodo["hasta"].split()[0], size=10)
    _text(c, 898.20, y, periodo["hasta"].split()[1], size=10)
    _text(c, 959.75, y, periodo["hasta"].split()[2], size=10)

    # La retícula de la cabecera institucional es parte de los tres reportes
    # originales (prenómina, tarifa y sobrecarga).
    _reticula_encabezado(c)


def _reticula_encabezado(c: pdf_canvas.Canvas) -> None:
    """Retícula del encabezado institucional (medida en old_21.pdf, 0.57pt).

    Reproduce los cuadros de HOJA No./Código 223.0.6817, los cuadritos de
    check a la derecha de A PAGAR/A DESCONTAR/REGULAR/HORAS EXTRAS y las
    celdas de PERÍODO/DESDE/HASTA con sus separadores.
    """
    c.saveState()
    c.setLineWidth(0.57)

    def celda(x, b, w):
        c.rect(x, b, w, 14.17, stroke=1, fill=0)

    # fila 1 (banda 555.31..569.48): ORGANISMO/CONFECCIONADO POR/SC-4-05
    for x, w in ((28.35, 113.39), (141.74, 283.46), (907.09, 85.04)):
        celda(x, 555.31, w)
    # fila 2 (541.13..555.30): EMPRESA/APROBADO POR/Código/HOJA No.
    for x, w in ((28.35, 113.39), (141.74, 283.46), (793.70, 113.39),
                 (907.09, 42.52), (949.61, 42.52)):
        celda(x, 541.13, w)
    # fila 3 (526.96..541.13): CHEQUEADO POR/PERÍODO
    for x, w in ((141.74, 283.46), (793.70, 198.43)):
        celda(x, 526.96, w)
    # fila 4 (512.78..526.96): checks + DESDE
    for x in (481.89, 581.11, 654.81, 762.52):
        celda(x, 512.78, 14.17)
    for x, w in ((793.70, 42.52), (836.22, 28.35), (864.57, 85.04),
                 (949.61, 42.52)):
        celda(x, 512.78, w)
    # fila 5 (498.61..512.78): HASTA
    for x, w in ((793.70, 42.52), (836.22, 28.35), (864.57, 85.04),
                 (949.61, 42.52)):
        celda(x, 498.61, w)

    # separadores verticales de las filas abiertas
    c.line(28.35, 541.13, 28.35, 498.61)
    c.line(141.74, 526.96, 141.74, 498.61)
    c.line(425.20, 526.96, 425.20, 498.61)
    # horizontales del borde inferior (fila 5)
    c.line(28.35, 498.61, 141.74, 498.61)
    c.line(141.74, 498.61, 425.20, 498.61)
    c.restoreState()


def _pie(c: pdf_canvas.Canvas, total: int, tipo: str, y_fin: float = 56.0,
         x_ini: float = 31.19) -> None:
    """Pie de página: total, leyenda y firma."""
    if tipo == "prenomina":
        # Réplica exacta del original: SourceSans3-Bold 12 bajo la última fila.
        c.saveState()
        c.setFont("SourceSans3-Bold", 12)
        c.drawString(31.19, y_fin - 19.19, f"Total: {total}")
        c.drawString(201.26, y_fin - 19.19, "MT:Modalidad de Trabajo")
        c.drawString(428.04, y_fin - 19.19, "TT:Teletrabajo")
        c.drawString(598.11, y_fin - 19.19, "TD:Trabajo a distancia")
        c.drawString(768.19, y_fin - 19.19, "TP:Trabajo presencial")
        c.drawString(31.19, y_fin - 47.54, "Chequeado y revisado por:     DRH")
        c.drawString(314.65, y_fin - 47.54, "Nombre:")
        c.drawString(654.81, y_fin - 47.54, "Firma:")
        c.restoreState()
        ahora = datetime.now()
        ampm = "AM" if ahora.hour < 12 else "PM"
        hh = ahora.hour % 12 or 12
        fecha = (f"{ahora.day} de {MESES_ES[ahora.month - 1]} de {ahora.year} "
                 f"{hh}:{ahora.minute:02d} {ampm}")
        c.saveState()
        c.setFont("SourceSans3-Italic", 8)
        c.drawString(31.19, 33.03, fecha)
        c.restoreState()
        return
    # Tarifa y sobrecarga (réplica del original): el Total va justo bajo la
    # tabla, alineado con su extremo izquierdo; solo la sobrecarga conserva el
    # bloque de firma (la leyenda MT/TT/TD/TP es exclusiva de la prenómina) y
    # la fecha siempre abajo a la izquierda, nunca junto a la firma.
    c.saveState()
    c.setFont("SourceSans3-Bold", 12)
    c.drawString(x_ini, y_fin, f"Total: {total}")
    c.restoreState()
    if tipo == "sobrecarga":
        y = y_fin - 14.17
        c.saveState()
        c.setFont("SourceSans3-Bold", 12)
        c.drawString(31.19, y, "Chequeado y revisado por:     DRH")
        c.drawString(314.65, y, "Nombre:")
        c.drawString(654.81, y, "Firma:")
        c.restoreState()
    ahora = datetime.now()
    ampm = "AM" if ahora.hour < 12 else "PM"
    hh = ahora.hour % 12 or 12
    fecha = (f"{ahora.day} de {MESES_ES[ahora.month - 1]} de {ahora.year} "
             f"{hh}:{ahora.minute:02d} {ampm}")
    _text(c, 31.19, 33.03, fecha, size=8)


def _rect(c: pdf_canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    c.rect(x, y, w, h, stroke=1, fill=0)
    c.setLineWidth(1)


# ---------------------------------------------------------------------------
# PRENÓMINA PC-10
# ---------------------------------------------------------------------------

# Geometría réplica del PDF original (medida sobre old_21.pdf).
_X0 = 28.35
_SUB_H = 14.17  # sub-fila de 14.17 en cabecera y dentro de cada renglón de 28.35
_COLS_PRENOMINA = [45.35, 221.11, 22.67, 22.68]  # NRO, NOMBRE, CO, MT
_COL_DIA = 22.68  # 16 celdas: 340.16..703.04 ≈ 703.00
_COL_DESC, _COL_AJEN, _COL_CANT, _COL_TIEMP = 87.87, 90.71, 42.52, 66.61
_COL_RESUMEN = [_COL_DESC, _COL_AJEN]  # 703.00..881.58
_TOTAL_W = 963.78  # 28.35..992.13 (borde derecho real del formulario)
_X_DER = 992.13


def _cabecera_prenomina(c: pdf_canvas.Canvas, dias: int, y: float,
                        fila_h: float) -> float:
    """Dibuja la cabecera (réplica del original) y devuelve y del primer renglón.

    y llega al borde superior del marco de la tabla (498.61 en el original).
    En reportlab (bottom-origin) las celdas se dibujan desde su base (yp) hacia
    arriba; por eso cada fila usa ('yp', alto): franja vacía (498.61..484.44),
    fila A rótulos de grupo (484.44..470.26), fila B (470.26..456.09) y fila C
    (456.09..441.92). Los rects crean menos bordes que las líneas del original,
    así que los separadores finos se añaden como segmentos de recta ("m/l").
    """
    x0 = _X0
    nro, nombre, co, mt = _COLS_PRENOMINA
    d0 = x0 + nro + nombre + co + mt            # 340.16
    w_dias = _COL_DIA * 16
    sub = fila_h

    def celda(xp, yp, w, h, texto="", size=10, bold=False):
        _rect(c, xp, yp, w, h)
        if texto:
            c.saveState()
            c.setFont("SourceSans3-Bold" if bold else "SourceSans3", size)
            c.drawCentredString(xp + w / 2, yp + h / 2 - 3.0, texto)
            c.restoreState()

    def vline(xp, ya, yb):
        c.saveState()
        c.setLineWidth(0.57)
        c.line(xp, ya, xp, yb)
        c.restoreState()

    # franja superior vacía (484.44..498.61) = borde superior del formulario
    _rect(c, x0, y - sub, _TOTAL_W, sub)

    # fila A: rótulos de grupo (484.44..470.26)
    ya = y - 2 * sub
    celda(d0, ya, w_dias, sub, "DISTRIBUCIÓN DE TIEMPO")
    celda(d0 + w_dias, ya, _COL_DESC + _COL_AJEN, sub,
          "RESUMEN NO TRABAJADO")
    # IMPUNTUALIDAD llega hasta el borde derecho real (992.13): 110.55
    celda(d0 + w_dias + _COL_DESC + _COL_AJEN, ya,
          _X_DER - (d0 + w_dias + _COL_DESC + _COL_AJEN), sub,
          "IMPUNTUALIDAD")

    # NRO/NOMBRE/CO/MT abarcan las 3 filas (texto centrado en la fila B)
    yleft = y - 4 * sub                        # 441.92 (base común a las 3)
    celda(x0, yleft, nro, 3 * sub, "NRO")
    celda(x0 + nro, yleft, nombre, 3 * sub, "NOMBRE Y APELLIDOS")
    celda(x0 + nro + nombre, yleft, co, 3 * sub, "CO")
    celda(x0 + nro + nombre + co, yleft, mt, 3 * sub, "MT")

    # fila B (456.09..470.26): días 1..15 + 16ª celda vacía + resumen
    yb = y - 3 * sub
    xo = d0
    for d in range(15):
        celda(xo, yb, _COL_DIA, sub, str(d + 1))
        xo += _COL_DIA
    _rect(c, xo, yb, _COL_DIA, sub)  # celda vacía del día 16 (doble renglón)
    xo += _COL_DIA
    celda(xo, yb, _COL_DESC, sub, "DESCUENTOS")
    xo += _COL_DESC
    celda(xo, yb, _COL_AJEN, sub, "AJENAS")
    xo += _COL_AJEN
    celda(xo, yb, _COL_CANT, sub, "CANT")
    xo += _COL_CANT
    celda(xo, yb, _COL_TIEMP, sub, "TIEMPO")

    # fila C (441.92..456.09): días 16..31
    yc = y - 4 * sub
    xo = d0
    for d in range(15, 31):
        celda(xo, yc, _COL_DIA, sub, str(d + 1))
        xo += _COL_DIA

    # borde inferior de la cabecera: RESUMEN completo (sin subdividir) y
    # CANT/TIEMPO hasta 990.71 (el original, en 441.92, usa estos 4 tramos).
    xb = d0 + w_dias
    c.saveState()
    c.setLineWidth(0.57)
    c.line(xb, yc, xb + _COL_DESC, yc)
    c.line(xb + _COL_DESC, yc, xb + _COL_DESC + _COL_AJEN, yc)
    c.line(xb + _COL_DESC + _COL_AJEN, yc, xb + _COL_DESC + _COL_AJEN + _COL_CANT, yc)
    c.line(xb + _COL_DESC + _COL_AJEN + _COL_CANT, yc,
           xb + _COL_DESC + _COL_AJEN + _COL_CANT + _COL_TIEMP, yc)
    c.restoreState()

    return y - 4 * sub


def _nueva_pagina(c: pdf_canvas.Canvas, area_id: int | str, periodo: dict,
                  n_hoja: int, n_hojas: int) -> float:
    """Crea una nueva hoja de prenómina (con su cabecera) y devuelve y."""
    c.showPage()
    _encabezado_general(c, _nombre_area(area_id), "PRENOMINA", True, periodo,
                        n_hoja, n_hojas)
    return _cabecera_prenomina(c, _dias_del_mes(*periodo["_am"]), 498.61,
                               _SUB_H)


def _partir_nombre(tr: dict, size: float = 12.0) -> tuple[str, str]:
    """Divide el nombre en (línea1, línea2).

    Con SourceSans3 12 se calibra a 160 pt: la CARIDAD más ancha de una línea
    mide 158.04 y la YAMILE más corta de dos líneas 162.18 (mismos cortes
    de línea que el sistema original con SourceSans3 14 / 225 pt).
    """
    n = (tr.get("Nombre") or "").strip()
    a1 = (tr.get("Apellido_1") or "").strip()
    a2 = (tr.get("Apellido_2") or "").strip()
    if not a1 and not a2:
        return n, ""
    full = " ".join(x for x in (n, a1, a2) if x)
    from reportlab.pdfbase.pdfmetrics import stringWidth
    if stringWidth(full, "SourceSans3", size) <= 160.0:
        return full, ""
    return (" ".join(x for x in (n, a1) if x), a2)


def generar_prenomina(filename: str, area_id: int | str,
                      trabajadores: list[dict]) -> None:
    anio, mes = _periodo_actual()
    dias = _dias_del_mes(anio, mes)
    periodo = {
        "desde": f"1 {MESES_ES[mes - 1]} {anio}",
        "hasta": f"{dias} {MESES_ES[mes - 1]} {anio}",
        "_am": (anio, mes),
    }
    c = pdf_canvas.Canvas(filename, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Prenómina PC-10 - RH CUJAE")

    nro, nombre, co, mt = _COLS_PRENOMINA
    d0 = _X0 + nro + nombre + co + mt      # 340.16 (inicio zona de días)
    w_dias = _COL_DIA * 16
    fila_h = 2 * _SUB_H                    # 28.35 por renglón de trabajador
    top = 498.61                           # borde superior del marco de tabla

    # Estimar el total de hojas para "HOJA No. X / Y" (como el original).
    y_inicio = top - 4 * _SUB_H  # y del primer renglón (441.93)
    por_hoja = max(1, int((y_inicio - MARGEN_INF) / fila_h))
    n_hojas = max(1, (len(trabajadores) + por_hoja - 1) // por_hoja)

    n_hoja = 1
    _encabezado_general(c, _nombre_area(area_id), "PRENOMINA", True, periodo,
                        n_hoja, n_hojas)
    y = _cabecera_prenomina(c, dias, top, _SUB_H)

    # sub-columnas de la zona RESUMEN (DESCUENTOS+AJENAS) dentro de cada
    # renglón: 10 columnas iguales de (87.87+90.71)/10 = 17.858, que en el
    # original recorren el alto completo del renglón (28.35).
    resumen_ancho = _COL_DESC + _COL_AJEN
    n_resumen = 10
    resumen_paso = resumen_ancho / n_resumen
    x_resumen_ini = d0 + w_dias       # 703.0
    x_cant = x_resumen_ini + resumen_ancho    # 881.58
    x_tiemp = x_cant + _COL_CANT               # 924.10
    x_fin = _X_DER                             # 992.13 (borde derecho)
    x_resumen = [x_resumen_ini + k * resumen_paso for k in range(n_resumen + 1)]
    x_tabla = [28.35, 73.70, 294.81, 317.48, 340.16]
    x_der = [703.0, _X_DER]

    def vline(xp, ya, yb):
        c.setLineWidth(0.57)
        c.line(xp, ya, xp, yb)

    for tr in trabajadores:
        if y - fila_h < MARGEN_INF:
            n_hoja += 1
            y = _nueva_pagina(c, area_id, periodo, n_hoja, n_hojas)

        # rejilla del renglón (réplica del original: rects SÓLO en las 16
        # celdas de día por sub-fila; el resto son segmentos de línea).
        # El renglón va de y (tope, ej. 441.92) hacia abajo hasta y-fila_h:
        # la sub-fila superior ocupa [y-sub, y] y la inferior [y-fila_h, y-sub],
        # luego en reportlab se dibujan desde su base yy = y-sub-sf*sub.
        for sf in range(2):
            yy = y - _SUB_H - sf * _SUB_H
            for d in range(16):
                _rect(c, d0 + d * _COL_DIA, yy, _COL_DIA, _SUB_H)

        # separadores verticales (por sub-fila en el original; aquí recorren
        # el renglón completo, que al ser dos tramos colineales es idéntico)
        c.saveState()
        c.setLineWidth(0.57)
        for xp in x_tabla:                          # 28.35, 73.70, 294.81, 317.48, 340.16
            c.line(xp, y - fila_h, xp, y)
        for xp in x_der:                            # 703.0 y 992.13
            c.line(xp, y - fila_h, xp, y)
        for xp in x_resumen[1:]:                    # RESumen sub-columnas
            c.line(xp, y - fila_h, xp, y)
        vline(x_cant, y - fila_h, y)                # 881.58 | AJENAS~CANT
        vline(x_tiemp, y - fila_h, y)               # 924.10 | CANT~TIEMPO
        c.restoreState()

        # borde inferior del renglón (16 segmentos como el original):
        # NRO|NOMBRE|CO|MT + 10 sub-columnas RESUMEN + CANT + TIEMPO al
        # borde derecho real (992.13). La arista superior la aporta la fila
        # anterior/cabecera.
        c.saveState()
        c.setLineWidth(0.57)
        for i in range(len(x_tabla) - 1):
            c.line(x_tabla[i], y - fila_h, x_tabla[i + 1], y - fila_h)
        for i in range(n_resumen):
            c.line(x_resumen[i], y - fila_h, x_resumen[i + 1], y - fila_h)
        c.line(x_cant, y - fila_h, x_tiemp, y - fila_h)
        c.line(x_tiemp, y - fila_h, x_der[1], y - fila_h)
        c.restoreState()

        # textos de datos a 12 pt en SourceSans3, alineación del original
        l1, l2 = _partir_nombre(tr)  # nombre en 1 ó 2 líneas
        nro_txt = str(tr.get("Id_Empleado") or "").strip()
        co_txt = _co(tr)
        ancho_nom = nombre - 6.0
        size_nom = min(
            _size_ajustado(l1, ancho_nom, 12.0, padding=0.0),
            _size_ajustado(l2, ancho_nom, 12.0, padding=0.0) if l2 else 12.0,
        )
        c.saveState()
        c.setFont("SourceSans3", _size_ajustado(nro_txt, nro - 6.0, 12.0,
                                             padding=0.0))
        if nro_txt:
            c.drawString(_X0 + 3.22, y - 11.29, nro_txt)
        c.setFont("SourceSans3", size_nom)
        if l1:
            c.drawString(_X0 + nro + 2.84, y - 11.29, l1)
        if l2:
            c.drawString(_X0 + nro + 2.84, y - 11.29 - 14.18, l2)
        c.setFont("SourceSans3", _size_ajustado(co_txt, co - 2.0, 12.0,
                                             padding=0.0))
        if co_txt:
            c.drawCentredString(_X0 + nro + nombre + co / 2, y - 11.29, co_txt)
        c.restoreState()

        y -= fila_h

    _pie(c, len(trabajadores), "prenomina", y)
    c.save()


def _size_ajustado(texto: str, ancho: float, size: float, bold: bool = False,
                   minimo: float = 5.0, padding: float = 6.0) -> float:
    """Reduce el cuerpo de letra hasta que el texto quepa en la celda.

    Los anchos de columna son los del formulario original (algunos de 22.68 pt
    para las HTA) y los valores reales (apellidos largos, categorías, co) no
    siempre caben al cuerpo nominal; se mide con la métrica de la fuente y se
    baja de medio punto en medio punto hasta que entra. `padding` es el
    respiro total que se deja a los bordes (3 pt por lado).
    """
    if not texto:
        return size
    fuente = "SourceSans3-Bold" if bold else "SourceSans3"
    disponible = ancho - padding
    if disponible <= 0:
        return minimo
    s = float(size)
    while s > minimo and pdfmetrics.stringWidth(texto, fuente, s) > disponible:
        s -= 0.5
    return s


def _partir_en_lineas(texto: str, ancho: float, size: float,
                      lineas: int = 2, bold: bool = False,
                      padding: float = 6.0, alto: float | None = None
                      ) -> tuple[list[str], float]:
    """Reparte el texto en hasta `lineas` renglones que quepan en la celda.

    Devuelve (líneas, cuerpo). Si el texto entra en un solo renglón al cuerpo
    nominal, se queda así (12 pt en el S.C.D., como el original); si no, se
    parte por espacios y se reduce el cuerpo lo justo, que es lo que evita
    que las categorías largas del formulario de 110 pt queden a 7 pt. `alto` es
    el alto de la celda: acota el cuerpo para que las líneas quepan en vertical.
    """
    if not texto:
        return [], size
    fuente = "SourceSans3-Bold" if bold else "SourceSans3"
    disponible = ancho - padding

    def cabe(t: str, s: float) -> bool:
        return pdfmetrics.stringWidth(t, fuente, s) <= disponible

    if cabe(texto, size):
        return [texto], size

    # Necesita más de un renglón: el alto de la celda acota el cuerpo para que
    # las dos líneas quepan en vertical (1.2 de interlineado, 3 pt de aire).
    if lineas > 1 and alto:
        size = min(size, (alto - 3.0) / (lineas * 1.2))
    for s in [size - 0.5 * k for k in range(1, 15)]:
        if s < 5.0:
            break
        if lineas < 2:
            if cabe(texto, s):
                return [texto], s
            continue
        palabras = texto.split()
        for corte in range(len(palabras) - 1, 0, -1):
            l1 = " ".join(palabras[:corte])
            l2 = " ".join(palabras[corte:])
            if cabe(l1, s) and cabe(l2, s):
                return [l1, l2], s
    return [texto], _size_ajustado(texto, ancho, size, bold=bold)


def _celda(c, xp, yp, w, h, texto="", size=7, align=None, bold=False,
           lineas=1):
    _rect(c, xp, yp, w, h)
    if not texto:
        return
    if lineas > 1:
        partes, size = _partir_en_lineas(texto, w, size, lineas, bold, alto=h)
    else:
        partes, size = [texto], _size_ajustado(texto, w, size, bold=bold)
    c.saveState()
    c.setFont("SourceSans3-Bold" if bold else "SourceSans3", size)
    paso = size * 1.2
    y0 = yp + h / 2 - size / 2.2 + (len(partes) - 1) * paso / 2
    for i, t in enumerate(partes):
        if align == "center":
            c.drawCentredString(xp + w / 2, y0 - i * paso, t)
        else:
            c.drawString(xp + 3, y0 - i * paso, t)
    c.restoreState()


# ---------------------------------------------------------------------------
# TARIFA HORARIA
# ---------------------------------------------------------------------------

# Anchos proporcionales a los del original (reporte_to.php), escalados para
# ocupar el mismo ancho que la cabecera institucional (_X0 .. _X0 + _TOTAL_W)
# como en la prenómina.
_CABECERAS_TARIFA = [
    ("NRO", 56, "center"),
    ("NOMBRE Y APELLIDOS", 363, None),
    ("HORAS CONTRATADAS", 126, "center"),
    ("HORAS A DESCONTAR", 126, "center"),
    ("FECHA DE BAJA", 126, "center"),
    ("OBSERVACIONES", 166.78, None),
]


def _nueva_pagina_tarifa(c: pdf_canvas.Canvas, area_id: int | str,
                         periodo: dict, n_hoja: int, n_hojas: int) -> float:
    c.showPage()
    _encabezado_general(c, _nombre_area(area_id), "REPORTE DE TARIFA HORARIA",
                        False, periodo, n_hoja, n_hojas, titulo_x=558.42)
    # La fila de títulos es la base de la celda (reportlab dibuja hacia
    # arriba): su tope queda en 498.61, pegado al borde inferior de la
    # cabecera, como en la prenómina.
    return _cabecera_tarifa(c, 498.61 - 16, 16)


def _cabecera_tarifa(c: pdf_canvas.Canvas, y: float, fila_h: float) -> float:
    ancho_tabla = sum(a for _, a, _ in _CABECERAS_TARIFA)
    x0 = _X0
    _rect(c, x0, y, ancho_tabla, fila_h)
    x = x0
    for nombre, ancho, align in _CABECERAS_TARIFA:
        size = _size_ajustado(nombre, ancho, 6.5, bold=True, padding=2.0)
        c.saveState()
        c.setFont("SourceSans3-Bold", size)
        if align == "center":
            c.drawCentredString(x + ancho / 2, y + fila_h / 2 - size / 2.4, nombre)
        else:
            c.drawString(x + 3, y + fila_h / 2 - size / 2.4, nombre)
        c.restoreState()
        x += ancho
    return y - fila_h


def generar_tarifa_horaria(filename: str, area_id: int | str,
                           filas: list[dict],
                           ano: int | None = None,
                           mes: int | None = None) -> None:
    # El período es el de las horas insertadas (el mes que se paga al mes
    # siguiente), no el mes anterior que usa la prenómina.
    if not ano or not mes:
        hoy = date.today()
        ano, mes = hoy.year, hoy.month
    dias = _dias_del_mes(ano, mes)
    periodo = {
        "desde": f"1 {MESES_ES[mes - 1]} {ano}",
        "hasta": f"{dias} {MESES_ES[mes - 1]} {ano}",
    }
    c = pdf_canvas.Canvas(filename, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Reporte de Tarifa Horaria - RH CUJAE")

    x0 = _X0  # alineada con la cabecera institucional, como en la prenómina
    fila_h = 16
    top = 498.61                       # la tabla arranca bajo la cabecera
    y_inicio = top - fila_h
    por_hoja = max(1, int((y_inicio - MARGEN_INF) / fila_h))
    # El número de renglones se corresponde con el de trabajadores; si no
    # hay ninguno, se dibuja una sola rejilla (renglón vacío).
    total_renglones = max(1, len(filas))
    n_hojas = max(1, (total_renglones + por_hoja - 1) // por_hoja)

    n_hoja = 1
    _encabezado_general(c, _nombre_area(area_id), "REPORTE DE TARIFA HORARIA",
                        False, periodo, n_hoja, n_hojas, titulo_x=558.42)
    y = _cabecera_tarifa(c, top - fila_h, fila_h)

    for i in range(total_renglones):
        if y - fila_h < MARGEN_INF:
            n_hoja += 1
            y = _nueva_pagina_tarifa(c, area_id, periodo, n_hoja, n_hojas)
        if i < len(filas):
            f = filas[i]
            horas = f.get("Horas")
            celda_txt = f"{float(horas):g}" if horas is not None else ""
            celdas = [
                (str(f.get("Id_Empleado") or "").strip(), "center"),
                ((f.get("Nombre") or "").strip(), None),
                (celda_txt, "center"),
                ("", "center"),
                ("", "center"),
                ("", None),
            ]
        else:
            celdas = [
                ("", "center"),
                ("", None),
                ("", "center"),
                ("", "center"),
                ("", "center"),
                ("", None),
            ]
        x = x0
        for (txt, align), (_, ancho, _al) in zip(celdas, _CABECERAS_TARIFA):
            _celda(c, x, y, ancho, fila_h, txt, align=align)
            x += ancho
        y -= fila_h

    _pie(c, len(filas), "tarifa", y - 24.86, x0)
    c.save()


# ---------------------------------------------------------------------------
# SOBRECARGA (S.C.D.)
# ---------------------------------------------------------------------------

# Geometría tomada del original (sobrecarga.php): la tabla ocupa el mismo ancho
# que la cabecera institucional, 28.35..992.13, y arranca justo debajo de ella.
# Las 14 columnas HTA miden 22.68 pt cada una, como en el PDF del sistema viejo.
_COL_HTA = 22.68
_ANCHO_IZQ_SCD = 45.0 + 200.0 + 110.0 + 27.63          # 382.63
_ANCHO_TOTAL_SCD = 150.24
_ANCHO_SOBRECARGA_SCD = 113.39
_TOP_SCD = 498.61          # la tabla arranca bajo la cabecera institucional
_FILA_CAB_SCD = 14.17       # bandas del encabezado, como en el original
_FILA_SCD = 28.35           # alto del renglón de docente (2 bandas en el original)

_CABECERAS_SCD = (
    [
        ("NRO", 45.0, "center"),
        ("NOMBRE Y APELLIDOS", 200.0, None),
        ("CATEGORIA DOCENTE", 110.0, None),
        ("CO", 27.63, "center"),
    ]
    + [(str(i + 1), _COL_HTA, "center") for i in range(14)]
    + [
        ("TOTAL HORAS TRABAJADAS", _ANCHO_TOTAL_SCD, "center"),
        ("HORAS SOBRECARGA", _ANCHO_SOBRECARGA_SCD, "center"),
    ]
)


def _cabecera_sobrecarga(c: pdf_canvas.Canvas, y: float, fila_cab: float,
                        fila_datos: float) -> float:
    """Encabezado del S.C.D.: banda HTA + rótulos de columna + grupo
    'DOCENTES Y CUADROS', igual que en el original. Devuelve la base del
    primer renglón de docente."""
    x_hta = _X0 + _ANCHO_IZQ_SCD                 # 410.98
    x_fin_hta = x_hta + _COL_HTA * 14            # 728.50
    x_fin_total = x_fin_hta + _ANCHO_TOTAL_SCD   # 878.74

    # Franja vacía (484.44..498.61): borde superior del formulario, como en el
    # original, que separa la cabecera institucional de la tabla.
    _rect(c, _X0, y + fila_cab, _TOTAL_W, fila_cab)

    # Banda 1: rótulo del bloque HTA y las dos columnas de resumen.
    _rect(c, _X0, y, _ANCHO_IZQ_SCD, fila_cab)
    _celda(c, x_hta, y, _COL_HTA * 14, fila_cab,
           "HORAS/MES TRABAJADAS POR ACTIVIDADES (HTA)",
           size=10, align="center")
    _celda(c, x_fin_hta, y, _ANCHO_TOTAL_SCD, fila_cab, "TOTAL HORAS TRABAJADAS",
           size=10, align="center")
    _celda(c, x_fin_total, y, _ANCHO_SOBRECARGA_SCD, fila_cab, "HORAS SOBRECARGA",
           size=10, align="center")

    # Banda 2: rótulos de columna (NRO, NOMBRE, CATEGORÍA, CO y las 14 de HTA).
    y2 = y - fila_cab
    x = _X0
    for nombre, ancho, align in _CABECERAS_SCD[:4]:
        _celda(c, x, y2, ancho, fila_cab, nombre, size=10, align=align)
        x += ancho
    for i in range(14):
        _celda(c, x, y2, _COL_HTA, fila_cab, str(i + 1), size=10, align="center")
        x += _COL_HTA

    # Banda 3: grupo de docentes (ocupa el bloque HTA, como en el original).
    y3 = y2 - fila_cab
    _rect(c, _X0, y3, _ANCHO_IZQ_SCD, fila_cab)
    _celda(c, x_hta, y3, _COL_HTA * 14, fila_cab, "DOCENTES Y CUADROS",
           size=10, align="center")
    _rect(c, x_fin_hta, y3, _ANCHO_TOTAL_SCD, fila_cab)
    _rect(c, x_fin_total, y3, _ANCHO_SOBRECARGA_SCD, fila_cab)
    return y3 - fila_datos


def _nueva_pagina_sobre(c: pdf_canvas.Canvas, area_id: int | str,
                        periodo: dict, n_hoja: int, n_hojas: int) -> float:
    c.showPage()
    _encabezado_general(c, _nombre_area(area_id),
                        "REPORTE DE PAGO POR SOBRECARGA DEL TRABAJO DOCENTE",
                        True, periodo, n_hoja, n_hojas, titulo_x=440.57,
                        con_etiquetas_cobro=False)
    return _cabecera_sobrecarga(c, _TOP_SCD - 2 * _FILA_CAB_SCD,
                                 _FILA_CAB_SCD, _FILA_SCD)


def generar_sobrecarga(filename: str, area_id: int | str,
                       filas: list[dict]) -> None:
    anio, mes = _periodo_actual()
    dias = _dias_del_mes(anio, mes)
    periodo = {
        "desde": f"1 {MESES_ES[mes - 1]} {anio}",
        "hasta": f"{dias} {MESES_ES[mes - 1]} {anio}",
    }
    c = pdf_canvas.Canvas(filename, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Reporte de pago por sobrecarga del trabajo docente - RH CUJAE")

    fila_h = _FILA_SCD
    y_inicio = _TOP_SCD - 2 * _FILA_CAB_SCD - _FILA_CAB_SCD - fila_h
    por_hoja = max(1, int((y_inicio - MARGEN_INF) / fila_h))
    # Un renglón por docente; si el área no tiene docentes se dibuja una sola
    # rejilla, igual que en la tarifa horaria.
    total_renglones = max(1, len(filas))
    n_hojas = max(1, (total_renglones + por_hoja - 1) // por_hoja)

    n_hoja = 1
    _encabezado_general(c, _nombre_area(area_id),
                        "REPORTE DE PAGO POR SOBRECARGA DEL TRABAJO DOCENTE",
                        True, periodo, n_hoja, n_hojas, titulo_x=440.57,
                        con_etiquetas_cobro=False)
    y = _cabecera_sobrecarga(c, _TOP_SCD - 2 * _FILA_CAB_SCD,
                             _FILA_CAB_SCD, _FILA_SCD)

    for i in range(total_renglones):
        if y - fila_h < MARGEN_INF:
            n_hoja += 1
            y = _nueva_pagina_sobre(c, area_id, periodo, n_hoja, n_hojas)
        f = filas[i] if i < len(filas) else {}
        hta = f.get("Horas_HTA") or []
        celdas = [
            (str(f.get("Id_Empleado") or "").strip(), "center"),
            ((f.get("Nombre") or "").strip(), None),
            ((f.get("Categoria_Docente") or "").strip(), None),
            (_co(f) if f else "", "center"),
        ]
        celdas += [(str(hta[j]) if j < len(hta) else "", "center")
                   for j in range(14)]
        celdas += [
            (str(f.get("Total_Horas") or ""), "center"),
            (str(f.get("Horas_Sobrecarga") or ""), "center"),
        ]
        x = _X0
        for i, ((txt, align), (_, ancho, _al)) in enumerate(
                zip(celdas, _CABECERAS_SCD)):
            if 4 <= i < 18:
                # Bloque HTA: el original divide cada casilla en dos
                # sub-renglones de 14.17 y el valor va en el de arriba.
                _celda(c, x, y + fila_h / 2, ancho, fila_h / 2, txt, size=12,
                       align="center")
                _celda(c, x, y, ancho, fila_h / 2, "", size=12)
            else:
                _celda(c, x, y, ancho, fila_h, txt, size=12, align=align,
                       lineas=2)
            x += ancho
        y -= fila_h

    # El original deja 19.18 pt entre el último renglón y el Total.
    _pie(c, len(filas), "sobrecarga", y - 19.18, _X0)
    c.save()
