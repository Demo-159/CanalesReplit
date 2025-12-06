# Despliegue en Docker/Koyeb

## Requisitos
- Docker instalado
- Cuenta en Koyeb (o cualquier servicio de hosting con Docker)
- Base de datos PostgreSQL

## Construcción Local

### Construir la imagen
```bash
docker build -t streaming-app .
```

### Ejecutar localmente
```bash
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  streaming-app
```

### Con Docker Compose (incluye PostgreSQL)
```bash
# Crear archivo .env con:
# DATABASE_URL=postgresql://streaming:streaming_password@postgres:5432/streaming_db

docker-compose up -d
```

## Despliegue en Koyeb

### Opción 1: Desde GitHub

1. Sube tu código a un repositorio de GitHub
2. En Koyeb, crea una nueva aplicación
3. Selecciona "GitHub" como fuente
4. Elige tu repositorio
5. Koyeb detectará automáticamente el Dockerfile
6. Configura las variables de entorno:
   - `DATABASE_URL`: Tu conexión a PostgreSQL
   - `PORT`: 8000 (Koyeb lo configura automáticamente)

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

## Configuración de Koyeb

### Recursos Recomendados
- **Mínimo**: 1 CPU, 512MB RAM
- **Recomendado para streaming**: 2 CPU, 1GB RAM
- **Producción 24/7**: 2+ CPU, 2GB+ RAM

### Health Check
El endpoint `/api/health` está configurado para verificar el estado de la aplicación.

### Persistencia
Los segmentos HLS se almacenan temporalmente en `/app/streams`. Para producción 24/7, considera:
- Montar un volumen persistente
- O regenerar streams al reiniciar (comportamiento actual)

## Base de Datos

### Opción gratuita: Neon
1. Crea una cuenta en [neon.tech](https://neon.tech)
2. Crea un proyecto
3. Copia la connection string
4. Úsala como `DATABASE_URL`

### Opción gratuita: Supabase
1. Crea una cuenta en [supabase.com](https://supabase.com)
2. Crea un proyecto
3. Ve a Settings > Database
4. Copia la connection string

## Verificar Despliegue

```bash
# Health check
curl https://tu-app.koyeb.app/api/health

# Ver canales
curl https://tu-app.koyeb.app/api/channels
```

## Solución de Problemas

### Error: ffmpeg not found
Asegúrate de que la imagen Docker se construyó correctamente con ffmpeg instalado.

### Error: ECONNREFUSED database
Verifica que DATABASE_URL es correcta y la base de datos es accesible desde Koyeb.

### Streams no funcionan
1. Verifica que los videos URL son accesibles
2. Revisa los logs en Koyeb dashboard
3. El endpoint `/api/channels/:id/status` muestra errores específicos
