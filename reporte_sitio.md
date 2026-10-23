# Reporte de sitio — DRHnet (`rhsystem`)

**Fecha del análisis:** viernes 23 de octubre de 2026, 10:35–10:40 (CDT)
**Alcance:** contenedor LXC `7017` (`rhsystem`) sobre Proxmox VE `10.8.9.58` (`proxmoxcentral07`)
**Método:** acceso SSH al host Proxmox, inspección del contenedor con `pct exec 7017` y pruebas HTTP locales. **No se realizaron cambios** en el sistema.
**Credenciales:** usadas únicamente para el acceso; no se incluyen en este documento.

---

## 1. Resumen ejecutivo

El sitio **DRHnet** está **operativo y estable**: nginx, Next.js, FastAPI, PostgreSQL y el agente Zabbix están activos, sin unidades `systemd` fallidas, con respuesta HTTP `200` en la portada y `{"status":"ok","db":"connected"}` en `/api/health`.

Los riesgos principales no están en la disponibilidad sino en **operación y seguridad**:

| # | Hallazgo | Severidad |
|---|----------|-----------|
| 1 | Última copia de seguridad del CT: **10-oct-2026**. La política es **solo el primer sábado de cada mes** (próxima: 07-nov-2026) | **Alta** |
| 2 | **123 paquetes** del sistema operativo pendientes de actualizar, varios de seguridad | **Alta** |
| 3 | **No existe respaldo lógico de PostgreSQL** (`pg_dump`); solo el respaldo completo del contenedor | **Alta** |
| 4 | **Sin sincronización horaria** (NTP inactivo) y zona horaria `UTC` | **Alta** |
| 5 | SSH con **root + contraseña habilitados** y `ufw` inactivo en el contenedor | **Alta** |
| 6 | El CT solo sirve **HTTP:80**; no se pudo validar el HTTPS externo (el dominio apunta a `10.8.12.5`, no alcanzable desde este equipo) | **Alta** |
| 7 | Ausencia de cabeceras de seguridad HTTP (HSTS, CSP, X-Frame-Options, etc.) | Media |
| 8 | `/var/log` ocupa **463 MB** (455 MB de journal) sin límite configurado | Media |
| 9 | Servicios de aplicación ejecutados como **root** | Media |
| 10 | Backups diarios a `Salvas-P7-1` fallan (almacenamiento inaccesible); afecta al CT 7000, no al 7017 | Media |

---

## 2. Identificación del servicio

| Dato | Valor |
|------|-------|
| Nombre del sitio | DRHnet (portal de Recursos Humanos CUJAE) |
| Contenedor | `7017` — `rhsystem` (LXC, unprivileged) |
| Host Proxmox | `proxmoxcentral07` — `10.8.9.58:8006` |
| IP del contenedor | `10.8.1.58/24` (bridge `vmbr102`, gateway `10.8.1.1`) |
| Dominio | `drh.cujae.edu.cu` → resuelve a `10.8.12.5` (front reverso), no a la IP del CT |
| Acceso directo probado | `http://10.8.1.58/` → `200 OK` |
| DNS / dominio interno | `10.8.6.69`, `cujae.edu.cu` |
| Arranque automático | `onboot: 1` |
| Firewall Proxmox del CT | `firewall=1` (sin reglas propias en `/etc/pve/firewall/7017.fw`) |

> El dominio público no resuelve a la IP del contenedor. Se asume un proxy inverso/WAF en `10.8.12.5`, que **no fue alcanzable** desde la estación de análisis, por lo que la cadena HTTPS externa no pudo verificarse.

---

## 3. Arquitectura observada

```
Internet / Red CUJAE
        │
        ▼
10.8.12.5 (proxy/WAF, supuesto)  ──►  CT 7017 · 10.8.1.58:80 (nginx 1.24.0)
                                          │
                        ┌─────────────────┼──────────────────────────┐
                        ▼                 ▼                          ▼
                 Next.js :3000      FastAPI :8000              /docs/ (estático)
                 (rh-web.service)   (rh-api.service)           82 documentos
                        │                 │
                        │                 ├──► MSSQL 10.8.1.59:1433 (ASSETS_RH)
                        │                 ├──► PostgreSQL 16 local (rh_portal)
                        │                 └──► LDAP/AD ldaps://10.8.1.124:636
                        └──► /api/auth/* (rutas propias de sesión)
```

**Enrutamiento nginx** (`/etc/nginx/sites-available/drh`):

| Ruta | Destino |
|------|---------|
| `/` | `127.0.0.1:3000` (Next.js) |
| `/api/auth/` | `127.0.0.1:3000` (rutas de sesión de Next.js) |
| `/api/` | `127.0.0.1:8000` (FastAPI) |
| `/docs/` | alias estático `/opt/rh_app/docs/` (autoindex desactivado, `client_max_body_size 20M`) |

---

## 4. Infraestructura y recursos

| Recurso | Valor |
|---------|-------|
| Host | Proxmox VE 9.2.10, kernel `7.0.14-12-pve` |
| Host: CPU / RAM | 62 GiB RAM (31 GiB en uso), carga ~3.5 |
| CT: CPU / RAM / swap | 4 vCPU / 10 GiB / 2 GiB (swap sin uso) |
| CT: disco | 9.8 GiB, **5.0 GiB usados (54 %)**, 4.3 GiB libres |
| CT: uptime | ~1 día 1 h (reiniciado 22-oct-2026 13:02) |
| Host: uptime | ~2 días (reiniciado 21-oct-2026 08:14) |
| Red | `eth0` 10.8.1.58/24, gw 10.8.1.1, DNS 10.8.6.69 |

**Uso de disco por componente:**

| Directorio | Tamaño |
|------------|--------|
| `/opt/rh_app/admin/node_modules` | 763 MB |
| `/var/log` (journal: 455 MB) | 463 MB |
| `/opt/rh_app/admin/.next` | 387 MB |
| `/opt/rh_app/backend/venv` | 137 MB |
| `/opt/rh_app/docs` | 47 MB |

> La carga (`load average`) que muestra el CT es la del **host**, no la del contenedor (no hay `lxcfs`). No debe usarse como métrica del servicio.

---

## 5. Software y versiones

| Componente | Versión |
|------------|---------|
| Sistema operativo | Ubuntu 24.04.4 LTS (Noble) |
| nginx | 1.24.0 (Ubuntu) |
| Node.js | 20.20.2 |
| Next.js | 16.3.4 (React 19.2.8, next-intl 4.14.2, Tailwind 4) |
| Python | 3.12.3 (venv en `/opt/rh_app/backend/venv`) |
| FastAPI / Uvicorn | 0.141.1 / 0.53.0 |
| SQLAlchemy / psycopg2 | 2.0.54 / 2.9.13 |
| Pydantic | 2.13.5 |
| LDAP | ldap3 2.9.1 |
| PostgreSQL | 16.15 |
| Zabbix Agent | activo, servidor `10.8.1.63`, hostname `pmox7-LXC-rhsystem` |

**Servicios `systemd` activos:** `nginx`, `rh-api`, `rh-web`, `postgresql@16-main`, `ssh`, `cron`, `rsyslog`, `zabbix-agent`, `postfix`, `systemd-*`.
**Unidades fallidas:** 0.

---

## 6. Funcionalidad del sitio

**Rutas públicas** (sin sesión): `/areas`, `/descargas`, `/plantilla`, `/reportes`, `/servicios` (`recien-graduados`, `tarifa-horaria`, `scd`).
**Rutas privadas:** `/portal` (`trabajadores`, `cuadros`, `salarios`, `mi-nomina`, `tarifa-horaria`, `usuarios`, `plantilla`, `areas`, `numeros`, `cumpleanos`, `descargas`), `/login`.

**API principal (FastAPI):**

- Autenticación contra Active Directory, sesión firmada HMAC-SHA256, cookie httpOnly `rh_sesion` (TTL 8 h), impersonación y perfiles.
- Trabajadores, fotos, búsqueda, áreas, plantilla/plazas vacantes, cumpleaños, recién graduados.
- Nómina y salarios (`/api/mi-nomina`, `/api/salarios`, prenómina).
- Cuadros con exportación a PDF y Excel.
- Reportes: áreas, plazas vacantes, prenómina, tarifa horaria, sobrecarga.
- Tarifa horaria: consulta, guardado, edición, cierre de período.
- Administración: búsqueda LDAP, importación individual y por lote de usuarios, gestión de perfiles y activación.

**Protección de datos:** los endpoints sensibles probados sin sesión (`/api/trabajadores`, `/api/mi-nomina`, `/api/salarios`, `/api/admin/usuarios`, `/api/cuadros`) responden **401**. Correcto.

---

## 7. Estado de salud y rendimiento

| Prueba | Resultado |
|--------|-----------|
| `GET /` | `200`, ~0.22 s, 81 KB |
| `GET /api/health` | `{"status":"ok","db":"connected"}` |
| Login con credenciales inválidas | `401` con mensaje controlado (no filtra detalles) |
| PostgreSQL | 6 conexiones activas, base `rh_portal` de 8 MB |
| Memoria de servicios | `rh-api` ~77 MB · `rh-web` ~107 MB |
| Reinicios inesperados | 0 (`NRestarts=0` en los tres servicios) |

**Tráfico reciente (nginx, 23-oct):** 490 peticiones en ~1 h 20 min; 418 × `200`, 43 × `307`, 19 × `404`, 7 × `401`, 1 × `422`. Origen principal: `10.8.2.116` y `10.8.2.117`. Tráfico bajo.

**Incidente puntual:** el 23-oct a las 13:29:07 UTC, `POST /api/auth/login` devolvió `500` por `AttributeError: 'DRHService' object has no attribute 'es_trabajador_activo'`. El servicio se reinició a las 13:29:28 y el método ya existe en el código; se trató de un despliegue a medio aplicar. **Actualmente el login responde correctamente.**

**404 recurrentes:** fotos de trabajadores (`/api/trabajadores/<carné>/foto`) y de usuarios (`/api/admin/usuarios/<carné>/foto`) para carnés sin imagen. También una petición a `/openpyxl.tar.gz` (sondeo).

---

## 8. Datos y respaldo

### Base de datos

| Aspecto | Valor |
|---------|-------|
| Motor | PostgreSQL 16.15, escucha solo en `127.0.0.1:5432` |
| Base del portal | `rh_portal` — 8 MB |
| Tablas | `tarifa_horaria_horas` (113 filas), `usuarios` (4), `tarifa_horaria_cierres` (0), `perfiles` (0) |
| Datos principales de RH | SQL Server externo `10.8.1.59:1433`, base `ASSETS_RH` |
| Respaldo lógico | **No existe** (no hay `pg_dump` programado ni volcados en disco) |

### Respaldo del contenedor (Proxmox Backup Server)

| Aspecto | Valor |
|---------|-------|
| Almacén | `Proxmox7` (PBS, activo, 31.9 % usado) |
| Política | `sat *-1..7 00:00` → **primer sábado de cada mes** |
| Última copia del CT 7017 | **10-oct-2026 03:04 UTC** (hace 13 días) |
| Próxima copia | **07-nov-2026 00:00** |
| Copia más antigua conservada | 02-may-2026 (otros CT) |

**Hallazgo adicional:** el job diario de las 21:00 para el CT 7000 (GLPI) falla desde hace días porque el almacén `Salvas-P7-1` (`10.8.9.23:8007`) no responde (`No route to host`). No afecta al 7017, pero indica un monitoreo de respaldos insuficiente.

---

## 9. Seguridad

| Control | Estado |
|---------|--------|
| HTTPS en el CT | **No** — solo `:80` (TLS no validable en el front `10.8.12.5`) |
| Cabeceras de seguridad | **Ausentes** (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) |
| SSH | `PermitRootLogin yes`, `PasswordAuthentication yes`, sin claves en `/root/.ssh` |
| Firewall local | `ufw` **inactivo**; en Proxmox solo `firewall=1` sin reglas propias |
| Actualizaciones | **123 paquetes** pendientes (incluye `bind9`, `apparmor`, `base-files`) |
| Usuarios de servicio | `rh-api` y `rh-web` corren como **root** |
| Secretos | `.env` con permisos `600 root` (correcto); no se imprimieron valores |
| Sesión | Token HMAC-SHA256 en cabecera `X-Sesion` + cookie httpOnly; no se guarda en `localStorage` |
| Monitoreo | Zabbix Agent activo hacia `10.8.1.63` |
| Exposición de documentos | `/docs/` público (82 archivos PDF/DOC/XLS/RAR), sin listado de directorio |

**Observaciones:**

- El acceso SSH con contraseña de root está habilitado tanto en el host Proxmox como en el contenedor. Se recomienda migrar a claves y restringir por red.
- La aplicación maneja datos personales (nómina, fotos, carnés). La falta de HTTPS verificable en el origen y de cabeceras de seguridad incrementa el riesgo.
- Los `.bak` de código (`main.py.bak*`, `schemas.py.bak*`, `config.py.bak*`) permanecen en producción; pueden contener lógica o credenciales antiguas.
- Solo existe traducción `en.json`; la interfaz es en español. El journal registra `MISSING_MESSAGE: header.notifications` y `userDropdown`.

---

## 10. Recomendaciones priorizadas

### Alta

1. **Backups:** pasar el CT 7017 a respaldo **semanal** (o diario) y hacer una **prueba de restauración** documentada. Hoy la ventana de pérdida es de hasta un mes.
2. **Respaldo lógico de PostgreSQL:** programar `pg_dump` diario de `rh_portal` con retención y copia fuera del CT.
3. **Actualizar el sistema:** aplicar los 123 paquetes pendientes en ventana de mantenimiento; reiniciar si es necesario.
4. **Sincronización horaria:** habilitar `systemd-timesyncd`/NTP y definir zona horaria `America/Havana` (hoy `UTC` y reloj no sincronizado).
5. **Endurecer SSH:** deshabilitar `PermitRootLogin` con contraseña, usar claves, y activar `ufw` limitando 22/80 al segmento de administración.
6. **HTTPS:** confirmar el TLS en `10.8.12.5`, forzar redirección 80→443 y añadir HSTS.

### Media

7. Añadir **cabeceras de seguridad** en nginx (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
8. Limitar el journal (`SystemMaxUse=200M`) y revisar la retención de `/var/log`; libera ~250 MB.
9. Ejecutar `rh-api` y `rh-web` con **usuarios dedicados** sin privilegios.
10. **Monitorear el resultado de los backups** en Zabbix (hoy los fallos del job de 7000 pasan inadvertidos).
11. Limpiar `.bak`, `admin_rh_new.tgz`, `rh_api.tgz` y `descargas_site.tgz` de `/opt/rh_app`.
12. Completar las traducciones faltantes (`header.notifications`, `userDropdown`) y decidir si el portal debe ser solo español.

### Baja

13. Revisar las fotos faltantes que generan 404 y definir imagen por defecto.
14. Instalar `lxcfs` para que las métricas de CPU/memoria del CT sean reales.
15. Revisar la sensibilidad de los 82 documentos publicados en `/docs/`.
16. Evaluar reducir recursos del CT (4 vCPU / 10 GB) si el uso real se mantiene en ~250 MB de RAM.

---

## 11. Anexo — verificaciones realizadas

```bash
# Acceso e identificación
ssh root@10.8.9.58 'pveversion; pct list; pct config 7017'
ssh root@10.8.9.58 'pct exec 7017 -- bash -c "cat /etc/os-release; df -h; free -h"'

# Servicios y puertos
pct exec 7017 -- bash -c "systemctl list-units --type=service --state=running; ss -tulnp"

# Aplicación
pct exec 7017 -- bash -c "systemctl cat rh-api rh-web; cat /etc/nginx/sites-enabled/drh"
curl -s http://127.0.0.1/api/health
curl -sI http://127.0.0.1/

# Base de datos
pct exec 7017 -- bash -c "su - postgres -c 'psql -c \"SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;\"'"

# Respaldos
pvesh get /nodes/proxmoxcentral07/storage/Proxmox7/content --content backup --vmid 7017
pvesh get /cluster/backup

# Seguridad y mantenimiento
pct exec 7017 -- bash -c "apt list --upgradable; ufw status; sshd -T; journalctl --disk-usage"
```

**Conclusión:** el sitio funciona correctamente y sin errores activos, pero requiere atención inmediata en **respaldos, actualizaciones, hora del sistema y endurecimiento de acceso**. Con las acciones de prioridad alta cubiertas, el servicio quedaría en un estado operativo y de seguridad aceptable.
