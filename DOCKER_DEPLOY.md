# Despliegue en Docker/Koyeb

## Requisitos
- Docker instalado
- Docker Compose (opcional, para desarrollo local con PostgreSQL incluido)
- Base de datos PostgreSQL (para producción)

## Despliegue Rápido con Docker Compose

La forma más sencilla de ejecutar la aplicación localmente con todos los servicios:

```bash
# Reconstruir e iniciar (importante después de actualizaciones)
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Ver solo logs de la app
docker-compose logs -f app

# Detener
docker-compose down

# Limpiar todo (incluyendo datos)
docker-compose down -v
```

La aplicación estará disponible en `http://localhost:8000`

**Nota:** Las migraciones de base de datos se ejecutan automáticamente al iniciar.

## Construcción Manual

### Construir la imagen
```bash
docker build -t streaming-app .
```

### Ejecutar con base de datos externa
```bash
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  -v streams_data:/app/streams \
  streaming-app
```

## Despliegue en Koyeb

### Opción 1: Desde GitHub

1. Sube tu código a un repositorio de GitHub
2. En Koyeb, crea una nueva aplicación
3. Selecciona "GitHub" como fuente
4. Elige tu repositorio
5. Koyeb detectará automáticamente el Dockerfile
6. Configura las variables de entorno:
   - `DATABASE_URL`: Tu conexión a PostgreSQL (requerido)
   - `PORT`: 8000

### Opción 2: Desde Docker Registry

1. Construye y sube la imagen:
```bash
docker build -t tu-usuario/streaming-app .
docker push tu-usuario/streaming-app
```

2. En Koyeb, crea una nueva aplicación
3. Selecciona "Docker" como fuente
4. Ingresa la imagen: `tu-usuario/streaming-app`
5. Configura las variables de entorno

## Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| DATABASE_URL | Conexión PostgreSQL | Sí |
| PORT | Puerto de la aplicación | No (default: 8000) |
| NODE_ENV | Entorno de ejecución | No (default: production) |

## Configuración de Base de Datos

### Opciones Gratuitas

#### Neon (Recomendado)
1. Crea una cuenta en [neon.tech](https://neon.tech)
2. Crea un proyecto
3. Copia la connection string
4. Úsala como `DATABASE_URL`

#### Supabase
1. Crea una cuenta en [supabase.com](https://supabase.com)
2. Crea un proyecto
3. Ve a Settings > Database
4. Copia la connection string

### Base de datos incluida (solo desarrollo local)
El `docker-compose.yml` incluye PostgreSQL preconfigurado:
- Usuario: `streaming`
- Password: `streaming_password`
- Base de datos: `streaming_db`
- URL: `postgresql://streaming:streaming_password@postgres:5432/streaming_db`

## Recursos Recomendados

| Uso | CPU | RAM |
|-----|-----|-----|
| Mínimo | 1 | 512MB |
| Streaming activo | 2 | 1GB |
| Producción 24/7 | 2+ | 2GB+ |

## Health Check

El endpoint `/api/health` verifica el estado de la aplicación.

```bash
curl https://tu-app.koyeb.app/api/health
```

## Verificar Despliegue

```bash
# Health check
curl https://tu-app.koyeb.app/api/health

# Ver canales
curl https://tu-app.koyeb.app/api/channels

# Ver estadísticas
curl https://tu-app.koyeb.app/api/stats
```

## Solución de Problemas

### Error: relation "channels" does not exist
Las migraciones no se ejecutaron correctamente. Reconstruye la imagen:
```bash
docker-compose down
docker-compose up -d --build
```

### Error: DATABASE_URL not set
Verifica que la variable está correctamente configurada en docker-compose.yml o en tu comando docker run.

### Error: ffmpeg not found
Asegúrate de que la imagen Docker se construyó correctamente con ffmpeg instalado:
```bash
docker-compose build --no-cache
```

### Error: ECONNREFUSED database
- Verifica que `DATABASE_URL` es correcta
- Para docker-compose, asegúrate de usar `postgres` como host (no `localhost`)
- Espera a que PostgreSQL esté completamente iniciado

### Streams no funcionan
1. Verifica que las URLs de videos son accesibles públicamente
2. Revisa los logs: `docker-compose logs -f app`
3. El endpoint `/api/channels/:id/status` muestra errores específicos

### Container se reinicia constantemente
Revisa los logs para ver el error:
```bash
docker-compose logs --tail=100 app
```

### Actualizar después de cambios en el código
```bash
docker-compose down
docker-compose up -d --build
```
