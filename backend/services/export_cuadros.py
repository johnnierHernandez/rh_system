"""
Exportación del listado de cuadros a PDF y a Excel.

El PDF se arma con `reportlab`, que ya está en el entorno. El Excel se
genera a mano con `zipfile` de la biblioteca estándar: un `.xlsx` es un ZIP
con XML dentro, así que no hace falta instalar nada nuevo (este servidor no
tiene salida a PyPI). El texto va en línea (`inlineStr`) para no depender de
la tabla de cadenas compartidas.

El listado exportado no lleva fotografías: solo nombre y apellidos, carné,
cargo y área, que es lo que se usa para el trabajo de oficina.
"""

from __future__ import annotations

import io
import zipfile
from datetime import date
from typing import Any, Iterable
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Columnas del informe, en el mismo orden que la vista del portal.
CABECERAS = ("Nombre y apellidos", "Carné", "Cargo", "Área")
ANCHOS_XLSX = (38, 14, 42, 34)


def _fila(cuadro: dict[str, Any]) -> tuple[str, str, str, str]:
    """Normaliza un cuadro a la tupla de las cuatro columnas del informe."""
    nombre = " ".join(
        str(cuadro.get(campo) or "").strip()
        for campo in ("Nombre", "Apellido_1", "Apellido_2")
        if str(cuadro.get(campo) or "").strip()
    )
    cargo = str(cuadro.get("Desc_Cargo") or "").strip()
    area = str(cuadro.get("Desc_Direccion") or "").strip() or str(
        cuadro.get("Id_Direccion") or ""
    ).strip()
    return (
        nombre or "—",
        str(cuadro.get("No_CI") or "").strip(),
        cargo or "—",
        area or "Sin área",
    )


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

VERDE = colors.HexColor("#006633")
GRIS_LINEA = colors.HexColor("#d4d4d8")


def generar_cuadros_pdf(cuadros: Iterable[dict[str, Any]]) -> bytes:
    """Devuelve el PDF del listado de cuadros, listo para descargar."""
    filas = [_fila(c) for c in cuadros]
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=15 * mm,
        title="Listado de cuadros",
        author="Dirección de Recursos Humanos",
    )

    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle(
        "titulo",
        parent=estilos["Title"],
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=2,
    )
    subtitulo = ParagraphStyle(
        "subtitulo",
        parent=estilos["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#52525b"),
    )
    celda = ParagraphStyle(
        "celda",
        parent=estilos["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1a1a1a"),
    )
    celda_cabecera = ParagraphStyle(
        "celda_cabecera",
        parent=estilos["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName="Helvetica-Bold",
    )

    elementos: list[Any] = [
        Paragraph("Listado de cuadros", titulo),
        Paragraph(
            f"Dirección de Recursos Humanos &middot; CUJAE &middot; "
            f"{len(filas)} cuadro{'s' if len(filas) != 1 else ''} &middot; "
            f"generado el {date.today().strftime('%d/%m/%Y')}",
            subtitulo,
        ),
        Spacer(1, 6 * mm),
    ]

    datos = [[Paragraph(c, celda_cabecera) for c in CABECERAS]]
    datos += [[Paragraph(v, celda) for v in fila] for fila in filas]

    tabla = Table(
        datos,
        colWidths=[62 * mm, 30 * mm, 70 * mm, 68 * mm],
        repeatRows=1,
    )
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), VERDE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, GRIS_LINEA),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f8f7")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elementos.append(tabla)

    doc.build(elementos)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Excel (xlsx mínimo, sin dependencias)
# ---------------------------------------------------------------------------

_XLSX_CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>"""

_XLSX_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

_XLSX_WORKBOOK = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Cuadros" sheetId="1" r:id="rId1"/></sheets>
</workbook>"""

_XLSX_WORKBOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

_XLSX_STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF006633"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>"""


def _columna(letra: str) -> str:
    return f"{letra}"


def _celda(ref: str, valor: str, estilo: int = 0) -> str:
    return (
        f'<c r="{ref}" t="inlineStr" s="{estilo}">'
        f'<is><t xml:space="preserve">{escape(valor)}</t></is></c>'
    )


def generar_cuadros_excel(cuadros: Iterable[dict[str, Any]]) -> bytes:
    """Devuelve el `.xlsx` con el listado de cuadros, listo para descargar."""
    filas = [_fila(c) for c in cuadros]
    buffer = io.BytesIO()

    partes: list[str] = []
    partes.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
    partes.append(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    )
    partes.append("<cols>")
    for indice, ancho in enumerate(ANCHOS_XLSX):
        letra = chr(ord("A") + indice)
        partes.append(
            f'<col min="{indice + 1}" max="{indice + 1}" width="{ancho}" customWidth="1"/>'
        )
    partes.append("</cols>")
    partes.append("<sheetData>")

    cabeceras = "".join(
        _celda(f"{chr(ord('A') + i)}1", texto, estilo=1)
        for i, texto in enumerate(CABECERAS)
    )
    partes.append(f'<row r="1" ht="22" customHeight="1">{cabeceras}</row>')

    for numero, fila in enumerate(filas, start=2):
        celdas = "".join(
            _celda(f"{chr(ord('A') + i)}{numero}", valor)
            for i, valor in enumerate(fila)
        )
        partes.append(f'<row r="{numero}">{celdas}</row>')

    partes.append("</sheetData>")
    partes.append("</worksheet>")
    hoja = "".join(partes)

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _XLSX_CONTENT_TYPES)
        zf.writestr("_rels/.rels", _XLSX_RELS)
        zf.writestr("xl/workbook.xml", _XLSX_WORKBOOK)
        zf.writestr("xl/_rels/workbook.xml.rels", _XLSX_WORKBOOK_RELS)
        zf.writestr("xl/styles.xml", _XLSX_STYLES)
        zf.writestr("xl/worksheets/sheet1.xml", hoja)

    return buffer.getvalue()
