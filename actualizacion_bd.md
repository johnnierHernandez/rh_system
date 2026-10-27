# Actualización diaria de la base de datos `ASSETS_RH`

## Objetivo

Mantener la base de datos `ASSETS_RH` del contenedor **CT 7016** (`bdrh`, `10.8.1.59`) sincronizada con el backup más reciente que se deposita en `/home/johnny/desarrollo/rh_system`.

Regla:

- Si el backup local es **más nuevo** que la versión cargada en el CT 7016 → **restaurar** el local sobre `ASSETS_RH`.
- Si el backup local es **igual o más antiguo** → **no hacer nada**.

---

## Entorno

| Elemento | Valor |
|----------|-------|
| Directorio local de backups | `/home/johnny/desarrollo/rh_system` |
| Patrón del archivo | `ASSETS_RH_backup_YYYY_MM_DD_HHMMSS_*.bak` |
| Host Proxmox | `10.8.9.58` (`proxmoxcentral07`) |
| Contenedor destino | `7016` — `bdrh` |
| IP del contenedor | `10.8.1.59` |
| Motor | Microsoft SQL Server 2022 Express |
| Base de datos | `ASSETS_RH` |
| Archivos de datos | `/var/opt/mssql/data/ASSETS_RH_2019.mdf` (`AssetsNomina_Data`) |
| Archivos de log | `/var/opt/mssql/data/ASSETS_RH_2019.ldf` (`AssetsNomina_Log`) |
| Directorio de backups en el CT | `/var/opt/mssql/backup` |
| Aplicación que consume la BD | CT `7017` (`rhsystem`), servicio `rh-api` |
| Credenciales SQL | se leen de `/opt/rh_app/backend/.env` en el CT 7017 (`MSSQL_USER` / `MSSQL_PASS`); **no se escriben en este documento** |

> El backup local se genera en otro servidor (`DESKTOP-TMKBH25`) y se copia aquí cada día. El CT 7016 es la copia que consume el portal.

---

## 1. Verificación diaria (solo lectura)

### 1.1. Localizar el backup local más reciente

```bash
LOCAL_DIR=/home/johnny/desarrollo/rh_system
BK=$(ls -1 "$LOCAL_DIR"/ASSETS_RH_backup_*.bak 2>/dev/null | sort -r | head -1)
echo "Backup local: $BK"
ls -lh "$BK"
```

La fecha que manda es la del **nombre del archivo** (`YYYY_MM_DD_HHMMSS`), no la fecha de modificación del fichero. Por eso se ordena por nombre (`sort -r`) y no con `ls -t`.

```bash
FECHA_LOCAL=$(basename "$BK" | sed -E 's/^ASSETS_RH_backup_([0-9]{4})_([0-9]{2})_([0-9]{2})_([0-9]{2})([0-9]{2})([0-9]{2})_.*/\1-\2-\3 \4:\5:\6/')
echo "Fecha local: $FECHA_LOCAL"
```

### 1.2. Consultar la versión cargada en el CT 7016

Se consulta `msdb`: fecha del backup que se restauró por última vez sobre `ASSETS_RH`.

```bash
ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077
  cat > /tmp/rh.env
  trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -Q "
      SET NOCOUNT ON;
      SELECT TOP 1
        b.backup_start_date  AS version_cargada,
        b.backup_finish_date AS fin_backup,
        r.restore_date       AS fecha_restauracion
      FROM msdb.dbo.restorehistory r
      JOIN msdb.dbo.backupset b ON b.backup_set_id = r.backup_set_id
      WHERE r.destination_database_name = CHAR(65)+CHAR(83)+CHAR(83)+CHAR(69)+CHAR(84)+CHAR(83)+CHAR(95)+CHAR(82)+CHAR(72)
      ORDER BY r.restore_date DESC;"
'
EOS
```

> `CHAR(...)` se usa solo para evitar problemas de comillas al pasar el SQL por SSH. Equivale a `'ASSETS_RH'`.

También se puede comprobar el estado de la base:

```bash
ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077; cat > /tmp/rh.env; trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -Q "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases ORDER BY name;"
'
EOS
```

### 1.3. Decisión

| Condición | Acción |
|-----------|--------|
| `FECHA_LOCAL` > `version_cargada` | Continuar con la actualización (sección 2) |
| `FECHA_LOCAL` ≤ `version_cargada` | **No hacer nada**. Registrar "sin cambios" y terminar |
| No hay backup local | **No hacer nada**. Registrar "sin backup local" |
| No hay historial de restauración | Usar como referencia el `.bak` más reciente de `/var/opt/mssql/backup` o, en su defecto, `sys.databases.create_date` |

Si el backup local es más antiguo, **nunca** se restaura: se estaría retrocediendo datos.

---

## 2. Procedimiento de actualización

> Ejecutar **solo** si la sección 1 concluyó que el backup local es más nuevo.

### 2.1. Comprobaciones previas

```bash
# CT encendido
ssh root@10.8.9.58 'pct status 7016'

# Espacio libre (deben quedar al menos 3 GB: el respaldo previo pesa ~1.1 GB)
ssh root@10.8.9.58 'pct exec 7016 -- df -h /'

# SQL Server activo
ssh root@10.8.9.58 'pct exec 7016 -- systemctl is-active mssql-server'
```

### 2.2. Copiar el backup al CT 7016

```bash
# Reutilizar BK de la sección 1.1; si no está definido:
LOCAL_DIR=${LOCAL_DIR:-/home/johnny/desarrollo/rh_system}
BK=$(ls -1 "$LOCAL_DIR"/ASSETS_RH_backup_*.bak | sort -r | head -1)
NAME=$(basename "$BK")

ssh root@10.8.9.58 "pct exec 7016 -- bash -c 'cat > /var/opt/mssql/backup/$NAME'" < "$BK"
ssh root@10.8.9.58 "pct exec 7016 -- chown mssql:mssql /var/opt/mssql/backup/$NAME"
```

### 2.3. Verificar que el backup es válido y completo

```bash
ssh root@10.8.9.58 "pct exec 7016 -- bash -c 'cat > /tmp/verificar.sql'" <<SQL
RESTORE HEADERONLY FROM DISK = '/var/opt/mssql/backup/$NAME';
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/$NAME';
RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/backup/$NAME';
SQL

ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077; cat > /tmp/rh.env; trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -i /tmp/verificar.sql
  rm -f /tmp/verificar.sql
'
EOS
```

Comprobar en la salida:

- `BackupType = 1` (backup completo de base de datos).
- `DatabaseName = ASSETS_RH`.
- `The backup set on file 1 is valid.`
- Nombres lógicos: `AssetsNomina_Data` y `AssetsNomina_Log`.

> Si `RESTORE FILELISTONLY` muestra otros nombres lógicos, ajustar los `MOVE` de la sección 2.6 antes de restaurar.

### 2.4. Respaldo de seguridad de la base actual

**Obligatorio antes de restaurar.** Nombre con la fecha del día:

```bash
FECHA_HOY=$(date +%F)
PREVIO=/var/opt/mssql/backup/ASSETS_RH_antes_${FECHA_HOY}.bak

ssh root@10.8.9.58 "pct exec 7016 -- bash -c 'cat > /tmp/backup_previo.sql'" <<SQL
BACKUP DATABASE ASSETS_RH
TO DISK = '$PREVIO'
WITH COPY_ONLY, INIT, STATS = 10;
SQL

ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077; cat > /tmp/rh.env; trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -i /tmp/backup_previo.sql
  rc=$?; rm -f /tmp/backup_previo.sql; exit $rc
'
EOS
```

Verificar que el `.bak` previo existe y tiene tamaño razonable:

```bash
ssh root@10.8.9.58 "pct exec 7016 -- ls -lh $PREVIO"
```

> **Importante:** SQL Server **Express** no soporta `BACKUP ... WITH COMPRESSION`; no agregar esa opción. El respaldo previo ocupará ~1.1 GB. Express sí puede **restaurar** backups comprimidos (el backup local lo está).
>
> Si el espacio libre baja de 3 GB después del respaldo previo, borrar el `ASSETS_RH_antes_*.bak` más antiguo antes de continuar.

### 2.5. Detener la aplicación que consume la BD

```bash
ssh root@10.8.9.58 'pct exec 7017 -- systemctl stop rh-api'
ssh root@10.8.9.58 'pct exec 7017 -- systemctl is-active rh-api'   # debe decir "inactive"
```

El frontend (`rh-web`) puede seguir arriba; mostrará errores de API mientras dure la restauración.

### 2.6. Restaurar

```bash
ssh root@10.8.9.58 "pct exec 7016 -- bash -c 'cat > /tmp/restaurar.sql'" <<SQL
ALTER DATABASE ASSETS_RH SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

RESTORE DATABASE ASSETS_RH
FROM DISK = '/var/opt/mssql/backup/$NAME'
WITH REPLACE,
     MOVE 'AssetsNomina_Data' TO '/var/opt/mssql/data/ASSETS_RH_2019.mdf',
     MOVE 'AssetsNomina_Log'  TO '/var/opt/mssql/data/ASSETS_RH_2019.ldf',
     RECOVERY,
     STATS = 10;
GO

ALTER DATABASE ASSETS_RH SET MULTI_USER;
GO
SQL

ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077; cat > /tmp/rh.env; trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -i /tmp/restaurar.sql
  rc=$?; rm -f /tmp/restaurar.sql; exit $rc
'
EOS
```

### 2.7. Verificación posterior

```bash
ssh root@10.8.9.58 'bash -s' <<'EOS'
pct exec 7017 -- cat /opt/rh_app/backend/.env | pct exec 7016 -- bash -c '
  umask 077; cat > /tmp/rh.env; trap "rm -f /tmp/rh.env" EXIT
  set -a; . /tmp/rh.env; set +a
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U "$MSSQL_USER" -P "$MSSQL_PASS" \
    -C -W -s "|" -d ASSETS_RH -Q "
      SET NOCOUNT ON;
      SELECT name, state_desc FROM sys.databases WHERE name = CHAR(65)+CHAR(83)+CHAR(83)+CHAR(69)+CHAR(84)+CHAR(83)+CHAR(95)+CHAR(82)+CHAR(72);
      DBCC CHECKDB(ASSETS_RH) WITH PHYSICAL_ONLY, NO_INFOMSGS;
      SELECT COUNT(*) AS empleados FROM Empleados_Gral;"
'
EOS
```

Comprobar:

1. `state_desc = ONLINE`.
2. `DBCC CHECKDB` sin errores.
3. El conteo de `Empleados_Gral` es coherente (no cero).
4. La fecha de la versión cargada cambió al día del backup local:

```bash
# repetir la consulta de la sección 1.2
```

### 2.8. Arrancar la aplicación y probar

```bash
ssh root@10.8.9.58 'pct exec 7017 -- systemctl start rh-api'
ssh root@10.8.9.58 'pct exec 7017 -- systemctl is-active rh-api'   # active
ssh root@10.8.9.58 'pct exec 7017 -- curl -s http://127.0.0.1/api/health'
```

Debe responder:

```json
{"status":"ok","db":"connected"}
```

Y una consulta real del portal debe funcionar, por ejemplo:

```bash
ssh root@10.8.9.58 'pct exec 7017 -- curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/api/areas'
```

El login debe responder **401** con credenciales inválidas (no 500), lo que confirma que la autenticación y la conexión a la BD están sanas:

```bash
ssh root@10.8.9.58 'pct exec 7017 -- curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1/api/auth/login -H "Content-Type: application/json" -d "{\"identificador\":\"test\",\"clave\":\"test\"}"'
```

### 2.9. Limpieza y retención

- Conservar el backup recién restaurado en `/var/opt/mssql/backup`.
- Conservar el backup previo `ASSETS_RH_antes_<fecha>.bak` **hasta la siguiente actualización exitosa**.
- Mantener como máximo **2** backups previos (`ASSETS_RH_antes_*.bak`) y el backup fuente. Si el espacio libre baja de 3 GB, borrar el previo más antiguo:

```bash
ssh root@10.8.9.58 'pct exec 7016 -- ls -1t /var/opt/mssql/backup/*.bak'
```

---

## 3. Rollback (si algo falla)

Si la restauración falla o la verificación posterior no pasa, volver al backup previo:

```bash
# Usar el respaldo previo de la ejecución actual (definido en 2.4) o el más reciente:
PREVIO=${PREVIO:-/var/opt/mssql/backup/ASSETS_RH_antes_2026-10-23.bak}

ssh root@10.8.9.58 "pct exec 7016 -- bash -c 'cat > /tmp/rollback.sql'" <<SQL
ALTER DATABASE ASSETS_RH SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO
RESTORE DATABASE ASSETS_RH
FROM DISK = '$PREVIO'
WITH REPLACE,
     MOVE 'AssetsNomina_Data' TO '/var/opt/mssql/data/ASSETS_RH_2019.mdf',
     MOVE 'AssetsNomina_Log'  TO '/var/opt/mssql/data/ASSETS_RH_2019.ldf',
     RECOVERY, STATS = 10;
GO
ALTER DATABASE ASSETS_RH SET MULTI_USER;
GO
SQL
```

Ejecutar igual que en 2.6, luego arrancar `rh-api` y comprobar `/api/health`.

---

## 4. Criterios de aborto

No continuar y no tocar la base si:

- El CT 7016 no está encendido o SQL Server no está activo.
- Quedan menos de 3 GB libres en el CT 7016.
- No hay backup local.
- `FECHA_LOCAL` ≤ versión cargada.
- `RESTORE VERIFYONLY` falla o el backup no es `BackupType = 1`.
- `DatabaseName` del backup no es `ASSETS_RH`.
- El respaldo previo (`ASSETS_RH_antes_<fecha>.bak`) no se creó correctamente.
- Cualquier error durante `RESTORE`: ejecutar rollback y reportar.

---

## 5. Historial de ejecuciones

| Fecha | Backup local | Versión cargada antes | Acción | Resultado |
|-------|--------------|-----------------------|--------|-----------|
| 2026-10-23 | `ASSETS_RH_backup_2026_10_23_010004_4081660.bak` (23-oct 01:00) | 16-oct 01:00 | Actualización | **Exitosa** |

### Detalle de la ejecución del 2026-10-23

- **Backup aplicado:** `ASSETS_RH_backup_2026_10_23_010004_4081660.bak`; `BackupType=1`, `DatabaseName=ASSETS_RH`, comprimido, `RESTORE VERIFYONLY` correcto.
- **Fecha del backup:** 2026-10-23 01:00:27 (fin 01:00:39).
- **Versión cargada antes:** 2026-10-16 01:00:27.
- **Respaldo previo:** `/var/opt/mssql/backup/ASSETS_RH_antes_2026-10-23.bak` (1.1 GB, `RESTORE VERIFYONLY` correcto).
- **Restauración:** 2026-10-23 15:02:44; `ASSETS_RH` ONLINE; upgrade de versión 706 → 957.
- **Empleados:** 13 408.
- **Archivos:** `ASSETS_RH_2019.mdf` 959 MB; `ASSETS_RH_2019.ldf` 418 MB.
- **Aplicación:** `rh-api` active; `/api/health` → `{"status":"ok","db":"connected"}`; `/api/areas` → 200; login inválido → 401.
- **Espacio libre:** 4.0 GB.
- **Limpieza:** se eliminaron `ASSETS_RH_antes_2026-10-16.bak` y `ASSETS_RH_backup_2026_10_16_010004_5396555.bak` para liberar espacio; el respaldo previo del 23-oct los sustituye.

> Añadir una fila por cada ejecución diaria, incluso cuando la acción sea "sin cambios".

---

## 6. Notas

- La fecha de referencia es la del **nombre del backup** y la de `msdb.dbo.backupset.backup_start_date`; no usar `mtime` de los archivos.
- El backup local proviene de SQL Server 2012 (`DatabaseVersion 706`) y el destino es SQL Server 2022. La restauración se probó con éxito el **2026-10-23**: la BD se actualizó de versión 706 a 957 y quedó `ONLINE`.
- SQL Server **Express** no permite crear backups comprimidos (`BACKUP ... WITH COMPRESSION`), pero sí restaurarlos. El respaldo previo se crea sin compresión (~1.1 GB).
- La restauración requiere detener `rh-api`; el corte observado el 2026-10-23 fue de ~1 minuto. El frontend puede seguir arriba.
- La base es `SIMPLE` recovery; no se necesitan restores de log.
- El portal usa `ASSETS_RH` como fuente de solo lectura para trabajadores, nómina, plantilla y reportes; la escritura del portal (usuarios, tarifa horaria) está en PostgreSQL (`rh_portal`), por lo que esta restauración no afecta a esos datos.
- No guardar credenciales en este archivo ni en el repositorio.
