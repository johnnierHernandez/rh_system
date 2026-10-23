# DRHnet — Portal de Recursos Humanos CUJAE

Sistema de gestión de Recursos Humanos: consulta de trabajadores, plantilla, nómina y salarios, cuadros, reportes, tarifa horaria y administración de usuarios del portal. La autenticación se realiza contra el Active Directory de la CUJAE.

## Arquitectura

```
nginx (:80)
 ├── /            → Next.js 16  (:3000)   frontend/
 ├── /api/auth/   → Next.js 16  (:3000)   (rutas de sesión)
 ├── /api/        → FastAPI     (:8000)   backend/
 └── /docs/       → archivos estáticos (/opt/rh_app/docs)

FastAPI → SQL Server (ASSETS_RH)  ·  PostgreSQL (rh_portal)  ·  LDAP/AD
```

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, next-intl |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Uvicorn |
| Base de datos del portal | PostgreSQL 16 (`rh_portal`) |
| Datos de RR.HH. | SQL Server (`ASSETS_RH`) |
| Autenticación | LDAP / Active Directory (ldaps) |
| Servidor web | nginx 1.24 |

## Estructura del repositorio

```
.
├── backend/            API FastAPI
│   ├── main.py         Rutas HTTP
│   ├── config.py       Configuración por variables de entorno
│   ├── services/       Lógica de dominio (personal, salarios, reportes, tarifa)
│   ├── repositories/   Acceso a datos
│   ├── db/             Pool y adaptadores de base de datos
│   ├── migrations/     Scripts SQL y de migración
│   ├── fonts/          Tipografías para exportación a PDF
│   ├── requirements.txt
│   └── .env.example
├── frontend/           Aplicación Next.js
│   ├── src/app/        Rutas (público, portal, login, API de sesión)
│   ├── src/components/ Componentes
│   ├── public/         Recursos estáticos
│   └── package.json
├── deploy/             Configuración de despliegue
│   ├── nginx-drh.conf
│   ├── rh-api.service
│   └── rh-web.service
└── reporte_sitio.md    Reporte de estado del sitio en producción
```

## Requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 16
- Acceso a SQL Server y al LDAP/AD

## Puesta en marcha (desarrollo)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # completar credenciales
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev               # http://localhost:3000
```

El frontend consume la API a través de nginx; para desarrollo local se puede ajustar la URL base en `next.config.ts` o mediante un proxy.

## Variables de entorno

Todas las credenciales se leen de `backend/.env` (ver `backend/.env.example`). El backend **no arranca** si falta alguna variable obligatoria (`MSSQL_PASS`, `LDAP_PASSWORD`, `PG_PASS`, `SESSION_SECRET`). El archivo `.env` está excluido de Git.

## Base de datos

- **PostgreSQL** (`rh_portal`): usuarios y perfiles del portal, tarifa horaria. Los scripts de creación/migración están en `backend/migrations/`.
- **SQL Server** (`ASSETS_RH`): datos de trabajadores, nómina, plantilla y áreas. Es un sistema externo; este repositorio solo lo consume.

## Despliegue en producción

Los archivos de `deploy/` son la configuración usada en el contenedor `rhsystem`:

```bash
# nginx
cp deploy/nginx-drh.conf /etc/nginx/sites-available/drh
ln -s /etc/nginx/sites-available/drh /etc/nginx/sites-enabled/drh
nginx -t && systemctl reload nginx

# servicios systemd
cp deploy/rh-api.service deploy/rh-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rh-api rh-web
```

El frontend requiere compilarse antes de arrancar:

```bash
cd frontend && npm ci && npm run build
systemctl restart rh-web
```

## Seguridad

- No versionar `.env`, respaldos de bases de datos ni copias `*.bak`.
- Los datos de nómina y las fotos de trabajadores son datos personales: el repositorio debe ser **privado**.
- En producción, el sitio debe servirse por HTTPS y con cabeceras de seguridad (ver recomendaciones en `reporte_sitio.md`).
