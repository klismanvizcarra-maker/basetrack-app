# ==============================================================================
# BASETRACK APP - Multi-Stage Production Dockerfile
# Plataforma Operacional Minera e Industrial (Angular 19 + Node 22 + SQLite WAL)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend (Angular SPA)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend

# Instalar dependencias del frontend con caché de capas
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copiar código fuente y compilar bundle de producción
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY src/ ./src/
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Backend (TypeScript -> JavaScript ES Modules)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS backend-builder
WORKDIR /build/backend

# Instalar dependencias del servidor
COPY server/package.json server/package-lock.json* ./
RUN npm ci || npm install

# Copiar código fuente y compilar con TypeScript
COPY server/tsconfig.json ./
COPY server/src/ ./src/
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Runner de Producción (Ultra-ligero, seguro y persistente)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

LABEL maintainer="BASETRACK Engineering Team <soporte@basetrack.app>"
LABEL description="BASETRACK APP - Monitoreo Operacional Minero"

WORKDIR /app

# Variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/basetrack.db
ENV CLIENT_DIST_PATH=/app/public

# Instalar dependencias del sistema para healthchecks y herramientas seguras
RUN apk add --no-cache curl tzdata

# Configurar zona horaria predeterminada a América/Lima (UTC-5) para faena minera
ENV TZ=America/Lima
RUN cp /usr/share/zoneinfo/America/Lima /etc/localtime && echo "America/Lima" > /etc/timezone

# Crear directorio de datos para el volumen SQLite
RUN mkdir -p /app/data /app/public

# Copiar package.json del backend e instalar únicamente dependencias de producción
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copiar el backend compilado (dist)
COPY --from=backend-builder /build/backend/dist ./dist

# Copiar el frontend compilado (browser assets)
COPY --from=frontend-builder /build/frontend/dist/frontend-temp/browser ./public

# Volumen persistente para la base de datos SQLite y respaldos
VOLUME ["/app/data"]

# Exponer el puerto operacional
EXPOSE 3001

# Healthcheck nativo para orquestadores Docker / Kubernetes / Portainer
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Ejecutar el servidor con Node 22 (con soporte nativo para node:sqlite DatabaseSync)
CMD ["node", "dist/index.js"]
