-- OBSOLETO: esta tabla era el almacenamiento temporal en MSSQL.
-- La fuente actual de las horas es PostgreSQL (BD rh_portal):
-- ver 2026_10_tarifa_horaria_pg.sql.
-- Se conserva el archivo solo como referencia histórica; la tabla en MSSQL
-- fue eliminada el 2026-10-21 después de migrar las horas a PostgreSQL.

USE ASSETS_RH;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.RH_Tarifa_Horaria_Portal', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RH_Tarifa_Horaria_Portal (
        Id              INT IDENTITY(1,1) NOT NULL
                        CONSTRAINT PK_RH_Tarifa_Horaria_Portal PRIMARY KEY,
        Ano             SMALLINT NOT NULL,
        Mes             TINYINT NOT NULL,
        Id_Area         INT NOT NULL
                        CONSTRAINT DF_RH_THP_Area DEFAULT 0,
        Id_Empleado     CHAR(15) NOT NULL,
        Id_Expediente   CHAR(15) NULL,
        No_CI           CHAR(15) NULL,
        Nombre          VARCHAR(200) NOT NULL,
        Unidad          CHAR(15) NULL,
        Horas           NUMERIC(8,2) NOT NULL,
        Baja            BIT NOT NULL
                        CONSTRAINT DF_RH_THP_Baja DEFAULT 0,
        Creado_Por      VARCHAR(100) NULL,
        Creado_En       DATETIME NOT NULL
                        CONSTRAINT DF_RH_THP_Creado DEFAULT GETDATE(),
        Actualizado_Por VARCHAR(100) NULL,
        Actualizado_En  DATETIME NULL,
        CONSTRAINT UQ_RH_THP_Periodo_Empleado UNIQUE (Ano, Mes, Id_Empleado)
    );
    CREATE INDEX IX_RH_THP_Periodo_Area
        ON dbo.RH_Tarifa_Horaria_Portal (Ano, Mes, Id_Area);
    PRINT 'Tabla RH_Tarifa_Horaria_Portal creada.';
END
ELSE
    PRINT 'La tabla RH_Tarifa_Horaria_Portal ya existe.';

PRINT '=== columnas ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'RH_Tarifa_Horaria_Portal'
ORDER BY ORDINAL_POSITION;
GO
