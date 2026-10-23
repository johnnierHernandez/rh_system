"""
Áreas de reporte (Nóminas y Reportes).

Mapeo área -> unidades replicado exactamente del sistema anterior
(drh.cujae.edu.cu / pc10.php): las unidades de cada área son las que el
sistema viejo usaba, derivadas de su listado de trabajadores y cruzadas
con la BD actual ASSETS_RH (RSUMA14B). Los trabajadores se listan siempre
desde la BD actual.

`corto` es el nombre corto que el sistema viejo mostraba en UNIDAD:
se usa en la cabecera institucional de los reportes (y en prenómina se
parte en dos renglones si no cabe).
"""

# Unidades que están en la nómina vigente (RSUMA14B) y faltaban en el listado
# original. Se incorporaron por la descripción de la unidad para que el
# trabajador aparezca en el área que le corresponde:
#   J0300  Residencia Estudiantil, Edificio #200      -> área 17
#   QB000  Dirección Servicios Generales              -> área 120
#   S4000  Dirección de Alimentación, Suministro      -> área 10
#   T9000  Facultad de Arquitectura, Laboratorio      -> área 29
#   VIA300 Automática y Biomédica, Departamento Física -> área 106
AREAS_REPORTE: list[dict] = [
    {"id": 1, "nombre": "Rectorado", "corto": "Rectorado", "unidades": ["A0000", "A00001", "A000011", "A00007", "A000100"]},
    {"id": 2, "nombre": "Vicerrector A (Vicerrectoría Docente)", "corto": "Vicerrector A", "unidades": ["A00012", "A00013"]},
    {"id": 3, "nombre": "Vicerrector B (Vicerrectoría de Investigación y Postgrado)", "corto": "Vicerrector B", "unidades": ["A0002", "A00020", "A00021", "A00022", "A000221", "A00023", "A00024", "A00025"]},
    {"id": 4, "nombre": "Vicerrector D (Vicerrectoría Económica)", "corto": "Vicerrector D", "unidades": ["A0007", "A00071"]},
    {"id": 5, "nombre": "Dirección General de Servicios Generales", "corto": "Dir.Gral.Serv.Gen", "unidades": []},
    {"id": 6, "nombre": "Dirección General de Información, Comunicación e Informatización", "corto": "DGICI", "unidades": ["A0005", "A00050"]},
    {"id": 7, "nombre": "Vicerrector C (Vicerrectoría de Extensión Universitaria)", "corto": "Vicerrector C", "unidades": ["A0003", "A00032"]},
    {"id": 8, "nombre": "Dirección de Recursos Humanos", "corto": "RH", "unidades": ["H0000", "H0100", "H1100", "H1200", "H1300"]},
    {"id": 9, "nombre": "Dirección de Relaciones Internacionales", "corto": "DRI", "unidades": ["N0000", "N1000", "N2000", "N3000"]},
    {"id": 10, "nombre": "Dirección de Alimentación", "corto": "Alimentación", "unidades": ["S0000", "S0400", "S4000"]},
    {"id": 13, "nombre": "Dirección de Planificación(Economía)", "corto": "Economía", "unidades": ["OE000", "OE0100", "OE300"]},
    {"id": 14, "nombre": "Dirección de Contabilidad y Finanzas", "corto": "Contabilidad", "unidades": ["A00051", "PC000", "PC0100", "PC0300", "PC0400"]},
    {"id": 16, "nombre": "ICB. Dirección de Marxismo-Leninismo", "corto": "ICB. Marxismo", "unidades": ["Z1200"]},
    {"id": 17, "nombre": "Dirección de Residencia Estudiantil", "corto": "Residencia", "unidades": ["J0000", "J0300", "J1000", "J2000", "J3000", "J4000", "J5000", "J6000", "J7000", "J8000", "J9000", "J9100"]},
    {"id": 18, "nombre": "Dirección de Extensión Universitaria", "corto": "Ext. Univ.", "unidades": ["E0000", "E0100", "E0101", "E0200", "E0400"]},
    {"id": 19, "nombre": "Dirección de Alojamiento", "corto": "Hotel Cujae", "unidades": ["SDA00", "SDA10", "SDA20", "SDA30"]},
    {"id": 20, "nombre": "Dirección de Información Científico-Técnica", "corto": "DICT", "unidades": ["M0000", "M5000", "M6000", "M7000"]},
    {"id": 21, "nombre": "Dirección de Servicios TIC", "corto": "DISERTIC", "unidades": ["I00000", "I1000", "I2000"]},
    {"id": 22, "nombre": "Dirección de Educacion Fisica Deporte y Recreacion", "corto": "Cult. Física", "unidades": ["G0000"]},
    {"id": 23, "nombre": "Dirección de Defensa y Seguridad", "corto": "Prot. Física", "unidades": ["C1000", "C1100"]},
    {"id": 26, "nombre": "Centro de Referencia para la Educación de Avanzada", "corto": "CREA", "unidades": ["F0000", "F1000"]},
    {"id": 28, "nombre": "Facultad de Ingeniería Informática", "corto": "Informática", "unidades": ["WIF00", "WIF10", "WIF20", "WIF70", "WIF80"]},
    {"id": 29, "nombre": "Facultad de Arquitectura", "corto": "Arquitectura", "unidades": ["T0000", "T1000", "T3000", "T7000", "T9000"]},
    {"id": 30, "nombre": "Facultad de Ingeniería Civil", "corto": "Civil", "unidades": ["U0000", "U2000", "U4000", "U9000"]},
    {"id": 31, "nombre": "Facultad de Ingeniería Eléctrica", "corto": "Eléctrica", "unidades": ["VIE000", "VIE100", "VIE200", "VIE300", "VIE310", "VIE500"]},
    {"id": 32, "nombre": "Facultad de Ingeniería Industrial", "corto": "Industrial", "unidades": ["W0000", "W2000", "W5000", "W8000", "WA000"]},
    {"id": 33, "nombre": "Facultad de Ingeniería Mecánica", "corto": "Mecánica", "unidades": ["X0000", "X2000", "X3000", "XE000", "XF000", "XG000"]},
    {"id": 34, "nombre": "Facultad de Ingeniería Química", "corto": "Química", "unidades": ["Y0000", "Y2000", "Y3000", "Y4000", "Y4010", "Y6000", "YA000", "YA100"]},
    {"id": 35, "nombre": "Secretaría General", "corto": "Secretaría", "unidades": ["D1000"]},
    {"id": 38, "nombre": "Centros de Estudios CITI", "corto": "CITI", "unidades": ["A0008"]},
    {"id": 41, "nombre": "Dirección de Servicios a Equipos Informáticos", "corto": "Servicios Equipos Inf.", "unidades": ["A00052"]},
    {"id": 42, "nombre": "Dirección de Cuadros", "corto": "Cuadros", "unidades": ["HC000", "HC100"]},
    {"id": 43, "nombre": "Dirección de Comunicacion Institucional", "corto": "Comunicación", "unidades": ["K200", "K300", "k000", "k100"]},
    {"id": 47, "nombre": "Filial de 10 Octubre", "corto": "FCT 10/oct", "unidades": ["WIF50", "WIF60"]},
    {"id": 51, "nombre": "CIH", "corto": "CIH", "unidades": ["UA000", "UA200"]},
    {"id": 52, "nombre": "CIME", "corto": "CIME", "unidades": ["VIT2001", "VIT400", "VIT4150", "VIT420"]},
    {"id": 53, "nombre": "ICB. Departamento de Física", "corto": "ICB. FISICA", "unidades": []},
    {"id": 54, "nombre": "CECAT", "corto": "CECAT", "unidades": ["U3000", "U3100", "U3200", "U3300"]},
    {"id": 55, "nombre": "CETER", "corto": "CETER", "unidades": ["XC000"]},
    {"id": 57, "nombre": "ICB. Centro de Estudios de Matemáticos", "corto": "ICB. CEM", "unidades": ["Z1100", "Z1101"]},
    {"id": 58, "nombre": "Dirección de Calidad", "corto": "Calidad", "unidades": ["A0009"]},
    {"id": 90, "nombre": "ICB. Departamento de Enseñanza Militar", "corto": "ICB. EM", "unidades": ["Z1300"]},
    {"id": 102, "nombre": "Departamento de Gastronomía", "corto": "Dpto. Gastronomía", "unidades": []},
    {"id": 103, "nombre": "Comedor de Estudiantes", "corto": "C. Estudiantes", "unidades": ["S2000", "S2110", "S2111", "S2112", "S2113", "S2120", "S2121", "S2122", "S2123"]},
    {"id": 104, "nombre": "Comedor Cipel-Cime", "corto": "C. Cipel-Cime", "unidades": ["S6100", "S6200"]},
    {"id": 105, "nombre": "Comedor Trabajadores", "corto": "C. Trabajadores", "unidades": ["S5101", "S5102", "S5103"]},
    {"id": 106, "nombre": "Facultad de Automática y Biomédica", "corto": "Automática", "unidades": ["VIA000", "VIA200", "VIA300", "VIA400", "VIA600"]},
    {"id": 107, "nombre": "Facultad de Telecomunicaciones y Electrónica", "corto": "Telecomunicaciones", "unidades": ["VIT000", "VIT100", "VIT200", "VIT600", "VIT700"]},
    {"id": 109, "nombre": "Instituto de  Ciencias Básicas", "corto": "ICB", "unidades": ["Z0000", "Z0001"]},
    {"id": 111, "nombre": "ICB.Departamento Química Básica", "corto": "ICB. Química Básica", "unidades": []},
    {"id": 112, "nombre": "ICB. Departamento de Gráfica", "corto": "ICB. Gráfica", "unidades": ["Z1500"]},
    {"id": 113, "nombre": "ICB. Centro de Idioma", "corto": "ICB. Idioma", "unidades": ["Z1000"]},
    {"id": 114, "nombre": "Grupo de Capacitación Continua de la Comunidad Universitaria", "corto": "GCCCU", "unidades": ["H1400"]},
    {"id": 115, "nombre": "Dirección General de Logística", "corto": "Direcc. Gral. Logist.", "unidades": ["AB000", "AB030"]},
    {"id": 116, "nombre": "Abastecimiento Técnico Material", "corto": "A. T. M.", "unidades": ["OB000", "OB010", "OB020", "OB030"]},
    {"id": 117, "nombre": "Dirección Energética", "corto": "Direcc. Energética", "unidades": ["QENER00", "QENER10"]},
    {"id": 118, "nombre": "Dirección Infraestructura", "corto": "Infraestructura", "unidades": ["AC000", "AC1000", "AC1010", "AC1011", "AC1020", "AC1021", "AC1022", "AC1023", "AC2020", "AC2021", "AC2022", "AC3010", "AC3021"]},
    {"id": 119, "nombre": "Dirección Transporte", "corto": "Transporte", "unidades": ["QA000", "QA100", "QA101"]},
    {"id": 120, "nombre": "Dirección Servicios  Generales", "corto": "Servicios Generales", "unidades": ["QB000"]},
]

AREA_BY_ID: dict[int, dict] = {a["id"]: a for a in AREAS_REPORTE}