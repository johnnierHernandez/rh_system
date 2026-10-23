"""
Acceso a los datos de nómina de un expediente.

Los importes no viven en `Empleados_Gral` (que es la ficha de la persona) sino
en cuatro tablas `RH_*` que se identifican por `Id_Expediente`:

  * `RH_Empleados_Nomina`              -> salario vigente y sus componentes.
  * `RH_Historico_Nomina_Sueldo_Fijo`  -> evolución mes a mes del sueldo fijo.
  * `RH_Resumen_de_Cobros`             -> total devengado cada mes.
  * `RH_Historico_Nominilla`           -> pagos extraordinarios (estimulación,
                                          sobrecumplimiento...) de un período.

Una misma persona (mismo `No_CI`) puede tener más de un expediente: la plaza y,
por ejemplo, la docencia. Por eso el repositorio trabaja siempre con listas y
nunca asume un único registro.
"""

from __future__ import annotations

from db.adapter import clean_row, clean_rows
from repositories.base import BaseRepository


class NominaRepository(BaseRepository):
    def personas_por_carnet(self, no_ci: str) -> list[dict]:
        """Todos los expedientes de un carné, con cargo, área y categoría.

        Se ordenan primero los activos (`Baja=0 AND Alta=1`) y, dentro de cada
        grupo, por salario básico descendente: así el primero de la lista es el
        puesto principal y el resto quedan como alternativas. Los catálogos
        entran como LEFT JOIN para que un código que falte no esconda al
        expediente.
        """
        if not no_ci or not no_ci.strip():
            return []
        filas = self._fetchall(
            """
            SELECT e.Id_Expediente, RTRIM(e.No_CI) AS No_CI,
                   e.Nombre, e.Apellido_1, e.Apellido_2,
                   e.Plaza, RTRIM(e.Id_Cargo) AS Id_Cargo,
                   RTRIM(c.Desc_Cargo) AS Desc_Cargo,
                   RTRIM(e.Id_Direccion) AS Id_Direccion,
                   RTRIM(u.Desc_Direccion) AS Desc_Direccion,
                   RTRIM(co.Desc_Categoria) AS Desc_Categoria,
                   RTRIM(sc.Desc_Subcategoria) AS Desc_Subcategoria,
                   RTRIM(g.Desc_Grado_Cientifico) AS Desc_Grado_Cientifico,
                   e.Regimen_Salarial, e.Situacion, e.Baja,
                   ISNULL(n.Salario_Basico, 0) AS Salario_Basico
            FROM Empleados_Gral e
            LEFT JOIN RH_Cargos c ON c.Id_Cargo = e.Id_Cargo
            LEFT JOIN RH_Unidades_Organizativas u
              ON u.Id_Direccion = e.Id_Direccion
            LEFT JOIN RH_Categorias_Ocupacionales co
              ON co.Id_Categoria = e.Id_Categoria
            LEFT JOIN RH_Subcategorias_Ocupacionales sc
              ON sc.Id_Categoria = e.Id_Categoria
             AND sc.Id_Subcategoria = e.Id_Subcategoria
            LEFT JOIN RH_Grados_Cientificos g
              ON g.Id_Grado_Cientifico = e.Id_Grado_Cientifico
            LEFT JOIN RH_Empleados_Nomina n
              ON n.Id_Expediente = e.Id_Expediente
            WHERE RTRIM(e.No_CI) = %s
            ORDER BY e.Baja, ISNULL(n.Salario_Basico, 0) DESC,
                     CAST(e.Id_Expediente AS int)
            """,
            (no_ci.strip(),),
        )
        return clean_rows(filas)

    def periodo_referencia(self, no_ci: str) -> tuple[int, int] | None:
        """Último (año, mes) con datos de nómina, mirando todos los expedientes.

        Sirve de período para el resumen total: en pluriempleo interesa el mes
        más reciente en que cualquiera de los expedientes tenga movimiento, sea
        de sueldo fijo o de nominilla.
        """
        fila = self._fetchone(
            """
            SELECT TOP 1 Ano, Mes FROM (
                SELECT s.Ano, s.Mes
                FROM RH_Historico_Nomina_Sueldo_Fijo s
                JOIN Empleados_Gral e ON e.Id_Expediente = s.Id_Expediente
                WHERE RTRIM(e.No_CI) = %s
                UNION ALL
                SELECT n.Ano, n.Mes
                FROM RH_Historico_Nominilla n
                JOIN Empleados_Gral e ON e.Id_Expediente = n.Id_Expediente
                WHERE RTRIM(e.No_CI) = %s
            ) x
            ORDER BY Ano DESC, Mes DESC
            """,
            (no_ci, no_ci),
        )
        return (int(fila["Ano"]), int(fila["Mes"])) if fila else None

    def total_periodo(self, no_ci: str, ano: int, mes: int) -> dict:
        """Suma de sueldo fijo y nominilla de TODOS los expedientes de un carné.

        La entidad trata el pluriempleo como un solo sujeto a efectos de las
        retenciones (GOC-2023-271-EX20), así que el bruto y las deducciones se
        suman sin separar expedientes. Devuelve `Devengado` (base gravable) y
        `Deducciones` (solo las demás, no la seguridad social ni el impuesto).
        """
        fila = self._fetchone(
            """
            SELECT
                (SELECT ISNULL(SUM(s.Devengado), 0)
                   FROM RH_Historico_Nomina_Sueldo_Fijo s
                   JOIN Empleados_Gral e ON e.Id_Expediente = s.Id_Expediente
                  WHERE RTRIM(e.No_CI) = %s AND s.Ano = %s AND s.Mes = %s)
              + (SELECT ISNULL(SUM(n.Devengado), 0)
                   FROM RH_Historico_Nominilla n
                   JOIN Empleados_Gral e ON e.Id_Expediente = n.Id_Expediente
                  WHERE RTRIM(e.No_CI) = %s AND n.Ano = %s AND n.Mes = %s)
                AS Devengado,
                (SELECT ISNULL(SUM(s.Deducciones), 0)
                   FROM RH_Historico_Nomina_Sueldo_Fijo s
                   JOIN Empleados_Gral e ON e.Id_Expediente = s.Id_Expediente
                  WHERE RTRIM(e.No_CI) = %s AND s.Ano = %s AND s.Mes = %s)
              + (SELECT ISNULL(SUM(n.Deducciones), 0)
                   FROM RH_Historico_Nominilla n
                   JOIN Empleados_Gral e ON e.Id_Expediente = n.Id_Expediente
                  WHERE RTRIM(e.No_CI) = %s AND n.Ano = %s AND n.Mes = %s)
                AS Deducciones
            """,
            (no_ci, ano, mes, no_ci, ano, mes, no_ci, ano, mes, no_ci, ano, mes),
        )
        return clean_row(fila) if fila else {}

    def salario_actual(self, expediente: str) -> dict | None:
        """Componentes del salario vigente en `RH_Empleados_Nomina`."""
        fila = self._fetchone(
            """
            SELECT Tarifa, Tarifa_Diaria, Salario_Basico, Estimulo,
                   Porciento_Estimulo, Antiguedad, Plus, Salario_por_Cargo,
                   Otros, Retribucion_Complementaria, IETerritorial, ETSector,
                   Idoneidad_Fijo, Idoneidad_Movil, Estimulacion,
                   HorarioIrregular, Otras_CLA, Horas_Extra, Condiciones,
                   Dias_Acumulado, Salario_Acumulado,
                   RTRIM(Id_Tipo_Participacion) AS Id_Tipo_Participacion
            FROM RH_Empleados_Nomina
            WHERE Id_Expediente = %s
            """,
            (expediente,),
        )
        return clean_row(fila) if fila else None

    def historico(self, expediente: str) -> list[dict]:
        """Sueldo fijo declarado mes a mes (de lo más antiguo a lo más nuevo)."""
        filas = self._fetchall(
            """
            SELECT Ano, Mes, Salario_Basico, Salario_por_Cargo, Plus,
                   Antiguedad, Estimulo, Otros, Dias_Trabajados, Devengado
            FROM RH_Historico_Nomina_Sueldo_Fijo
            WHERE Id_Expediente = %s
            ORDER BY Ano, Mes
            """,
            (expediente,),
        )
        return clean_rows(filas)

    def cobros(self, expediente: str) -> list[dict]:
        """Total cobrado cada mes (incluye vacaciones y subsidios)."""
        filas = self._fetchall(
            """
            SELECT Ano, Mes, Salario, Dias_Trabajados, Vacaciones,
                   Dias_Vacaciones, Salario_para_Subsidio,
                   Dias_Trabajados_para_Subsidio, Subsidio, Maternidad
            FROM RH_Resumen_de_Cobros
            WHERE Id_Expediente = %s
            ORDER BY Ano, Mes
            """,
            (expediente,),
        )
        return clean_rows(filas)

    def nominilla(self, expediente: str) -> tuple[str | None, list[dict]]:
        """Pagos de la última nominilla con datos, como (periodo, filas).

        El período se devuelve en formato `AAAA-MM`. Si no hay nominillas, se
        devuelve `(None, [])`.
        """
        ultimo = self._fetchone(
            """
            SELECT TOP 1 Ano, Mes
            FROM RH_Historico_Nominilla
            WHERE Id_Expediente = %s
            ORDER BY Ano DESC, Mes DESC
            """,
            (expediente,),
        )
        if not ultimo:
            return None, []
        ano, mes = int(ultimo["Ano"]), int(ultimo["Mes"])
        filas = self._fetchall(
            """
            SELECT RTRIM(c.Desc_Clasif_Nominilla) AS Desc_Clasif_Nominilla,
                   h.Clasificacion, h.Salario_Basico, h.Plus, h.Antiguedad,
                   h.Otros, h.Dias_a_Pagar, h.Devengado, h.Acobrar,
                   h.Deducciones, h.Devengado_Tarjeta
            FROM RH_Historico_Nominilla h
            LEFT JOIN RH_Clasificacion_Nominillas_MS c
              ON c.Id_Clasif_Nominilla = h.Clasificacion
            WHERE h.Id_Expediente = %s AND h.Ano = %s AND h.Mes = %s
            ORDER BY h.Clasificacion, h.Item
            """,
            (expediente, ano, mes),
        )
        return f"{ano:04d}-{mes:02d}", clean_rows(filas)
