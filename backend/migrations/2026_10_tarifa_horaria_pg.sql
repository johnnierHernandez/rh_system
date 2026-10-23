-- Horas de tarifa horaria: fuente única en PostgreSQL (BD rh_portal).
--
-- El backend crea estas tablas al iniciar (services/tarifa_horaria.py); este
-- archivo deja el esquema documentado para restaurar o migrar la base.
--
-- Importante: las horas NO se leen del sistema anterior. Se cargan una sola
-- vez desde el Excel del pago y después las inserta la técnica en el portal.

CREATE TABLE IF NOT EXISTS tarifa_horaria_horas (
    id              BIGSERIAL PRIMARY KEY,
    ano             SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL,
    area_id         INTEGER NOT NULL,
    id_empleado     VARCHAR(15) NOT NULL,
    id_expediente   VARCHAR(15),
    no_ci           VARCHAR(15),
    nombre          VARCHAR(200) NOT NULL,
    unidad          VARCHAR(15),
    horas           NUMERIC(8,2) NOT NULL CHECK (horas > 0),
    baja            BOOLEAN NOT NULL DEFAULT FALSE,
    creado_por      VARCHAR(100),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_por VARCHAR(100),
    actualizado_en  TIMESTAMPTZ,
    CONSTRAINT uq_tarifa_horaria_periodo_empleado
        UNIQUE (ano, mes, id_empleado)
);

CREATE INDEX IF NOT EXISTS idx_tarifa_horaria_periodo_area
    ON tarifa_horaria_horas (ano, mes, area_id);

-- Cierre mensual: si existe la fila, el período es histórico y no admite
-- inserciones, modificaciones ni eliminaciones.
CREATE TABLE IF NOT EXISTS tarifa_horaria_cierres (
    ano         SMALLINT NOT NULL,
    mes         SMALLINT NOT NULL,
    cerrado_por VARCHAR(100),
    cerrado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ano, mes)
);
