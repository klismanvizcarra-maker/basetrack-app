# Guía Oficial de Despliegue Industrial con Docker & Docker Compose
## BASETRACK APP - Servidor Local de Planta Minera, Synology NAS o VPS

Esta guía describe el procedimiento para desplegar **BASETRACK APP** como un contenedor autónomo, ultra-optimizado y con persistencia total de datos en disco.

---

## 1. Arquitectura del Contenedor

El contenedor utiliza una compilación multi-etapa (*multi-stage build*) sobre **Alpine Linux con Node 22**:

- **Etapa 1 (Frontend)**: Compila la SPA Angular 19 optimizada con tree-shaking y minificación.
- **Etapa 2 (Backend)**: Compila el servidor Express y TypeScript a módulos nativos ES.
- **Etapa 3 (Runner)**: Imagen final de menos de 180MB que corre el servidor Node 22 con soporte nativo de SQLite WAL (`node:sqlite DatabaseSync`) y sirve tanto la API `/api` como el frontend web en un solo puerto unificado.
- **Volumen Persistente (`/app/data`)**: Vinculado al directorio `./data` en el servidor anfitrión, garantizando que reinicios, caídas de energía o actualizaciones **nunca borren la base de datos ni los respaldos**.

---

## 2. Requisitos Previos

- **Docker Engine** (v24+) y **Docker Compose** (v2+).
- Puertos disponibles en el servidor: `3001` (por defecto) o `80` (para acceso directo sin especificar puerto en el navegador).

---

## 3. Despliegue Rápido en 3 Pasos

### Paso 1: Clonar o copiar el repositorio en el servidor
```bash
git clone <URL_DEL_REPOSITORIO> basetrack-app
cd basetrack-app
```

### Paso 2: Configurar variables (opcional)
Si deseas cambiar el puerto a 80 o definir una clave secreta personalizada:
```bash
cp .env.example .env
# Edita con tu editor favorito: nano .env
```

### Paso 3: Construir y levantar el contenedor en segundo plano
```bash
docker compose up -d --build
```

¡Listo! La aplicación estará inmediatamente disponible en la red local de la planta:
- Desde la misma máquina: `http://localhost:3001`
- Desde cualquier PC, tablet o celular en faena: `http://<IP_DEL_SERVIDOR>:3001` (ej. `http://192.168.1.100:3001`)

---

## 4. Gestión del Servicio y Comandos Frecuentes

### Ver el estado y healthcheck del contenedor:
```bash
docker compose ps
```

### Monitorear los logs en tiempo real (visitas, auditoría SCADA y estado HTTP):
```bash
docker compose logs -f
```

### Detener el servicio de forma segura:
```bash
docker compose down
```

### Reiniciar el servicio:
```bash
docker compose restart
```

---

## 5. Actualización a Nuevas Versiones sin Pérdida de Datos

Cuando se publiquen mejoras en el repositorio, la actualización no toca la base de datos montada en `./data`:

```bash
# 1. Bajar los cambios más recientes del código
git pull

# 2. Reconstruir la imagen y relanzar el contenedor (tiempo de inactividad: < 5 segundos)
docker compose up -d --build
```

---

## 6. Respaldos y Recuperación de la Base de Datos

La base de datos SQLite se encuentra en la carpeta física `./data/basetrack.db` en el servidor:

### Crear un respaldo manual en frío o caliente:
```bash
# Copia directa con fecha y hora
cp data/basetrack.db "data/backup_basetrack_$(date +%Y%m%d_%H%M%S).db"
```

### Restaurar desde un respaldo previo:
```bash
docker compose stop
cp "data/tu_archivo_de_respaldo.db" data/basetrack.db
docker compose start
```

---

## 7. Despliegue en Synology NAS / QNAP / Portainer

1. En **Container Station / Container Manager / Portainer**, selecciona **Crear Pila (Stack)**.
2. Pega el contenido de [`docker-compose.yml`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/docker-compose.yml).
3. Asegúrate de crear la carpeta compartida `/volume1/docker/basetrack/data` y mapearla en el volumen:
   ```yaml
   volumes:
     - /volume1/docker/basetrack/data:/app/data
   ```
4. Haz clic en **Deploy Stack**.
