# CLAUDE.md — BASETRACK APP Developer Guide & Architectural Context

Este documento es la guía principal de contexto, arquitectura, comandos y reglas de negocio para **Claude Code** en este repositorio.

---

## 1. Visión del Proyecto y Stack Tecnológico

**BASETRACK APP** es una plataforma enterprise para monitoreo y control operacional de plantas industriales y mineras (presas de relaves, salas de bombeo slurry, clasificación en ciclones, relevo de guardias, mantenimiento industrial, checklists de camionetas y administración).

### Stack Tecnológico
- **Frontend**: Angular 19+ (Standalone Components, Signals, Router, SCSS modular, PWA offline con Service Worker).
  - Dev server: `http://localhost:4200`
- **Backend**: Node.js + Express + TypeScript con arquitectura en capas (rutas, controladores, servicios, base de datos).
  - Dev server: `http://localhost:3001`
- **Base de Datos**: SQLite relacional (`server/data/basetrack.db`) en modo **WAL (Write-Ahead Logging)** con migraciones automáticas y transacciones seguras.
- **Tiempo Real & Sincronización**: WebSockets bi-direccionales en `/ws` (`ws://localhost:3001/ws`), `BroadcastChannel` para multi-pestaña P2P, y cola de sincronización resiliente ante desconexión de red.

---

## 2. Comandos Esenciales de Desarrollo

Ejecutar siempre desde la raíz del proyecto:

```bash
# Verificación integral obligatoria (Tests + Build):
npm run verify

# Ejecutar suite de pruebas del backend (27 tests automatizados):
npm run backend:test

# Compilación de producción de Angular:
npm run build

# Iniciar servidor frontend de desarrollo:
npm start

# Iniciar servidor backend en desarrollo (TypeScript watch):
npm --prefix server run dev

# Re-sembrar base de datos limpia con administrador raíz:
npm run backend:seed
```

---

## 3. Reglas Inviolables de Arquitectura y Negocio

Cualquier cambio propuesto por Claude Code debe acatar estrictamente estas directrices:

### 3.1. Administrador de Sistema Único (Marckv)
- El único superadministrador raíz es **`Marckv`** (usuario: `Marckv`, credencial: `91209966`, email: `marckvizcarra@basetrack.com`).
- Es un **usuario fantasma de sistema**: no tiene DNI operativo (`document_id = ''`) y **NUNCA** debe figurar como supervisor de guardia, operador ni chofer de camioneta.

### 3.2. Cero Datos Mock Sintéticos
- Operamos exclusivamente con datos reales cargados por el usuario o vía importación masiva CSV en `/admin`.
- Prohibido reintroducir nombres falsos ("Juan Pérez", "Roberto Quispe", "Marco Velásquez", etc.) o fechas estáticas pasadas.

### 3.3. Prevención de Bucles de Eventos DOM y Sincronización (ADR-014 y ADR-015)
- **Separación de Eventos**:
  - `basetrack_local_change`: Para mutaciones locales que `CloudSyncService` replica externamente.
  - `basetrack_cloud_sync`: Exclusivo para eventos remotos entrantes (WebSocket / BroadcastChannel).
- **Caché GET con `skipBroadcast`**: Al cachear respuestas de peticiones HTTP GET en `saveRealtimeData()`, se debe pasar SIEMPRE `{ skipBroadcast: true }`. Jamás emitir un cambio local por solo leer datos del servidor.
- **Guardas en Componentes**: Todo `syncListener` de componentes debe iniciar con:
  ```typescript
  if (e.detail?.source === 'local') return;
  ```
- **Tope de Cola**: `CloudSyncService.flushQueue()` delimita lotes a máximo 50 eventos para respetar los límites del backend y purga automáticamente lotes corruptos que reciban `HTTP 400`.

### 3.4. Flujo Operacional Cerrado: Bombas ⇄ Mantenimiento
- Si una bomba pasa a estado **`Falla`**, el backend auto-crea de inmediato una Orden de Trabajo (`maintenance_requests`) con prioridad ALTA y bloquea la bomba.
- La bomba no puede volver a `Operativo` desde la planilla de bombas hasta que mantenimiento resuelva la OT emitiendo un **Pase Operativo** (`operational_pass_by`).

### 3.5. Normativa de Relaves y Presa (GISTM & D.S. 024-2016-EM)
- Borde libre reglamentario: mínimo 1.0 metro de margen de seguridad.
- Control de porcentaje de finos en arenas cicloneadas (% -200M) para prevenir licuefacción del muro.
- Monitoreo de presión de poros piezométrica en celdas de presa.

### 3.6. Seguridad de Base de Datos
- Queda estrictamente prohibido ejecutar `DROP TABLE`, `rm -rf`, o borrados masivos sin validación previa.

---

## 4. Memoria Central y Registro de Decisiones (ADRs)

Para comprender el histórico y contexto profundo de cada módulo, consultar:
- **`GLOBAL_STATE.md`**: Única fuente de verdad (SSOT) del estado y tareas completadas.
- **`.agents/brain/ADR_REGISTRY.md`**: Registro de Decisiones de Arquitectura (ADR-001 al ADR-015).
- **`.agents/brain/GOTCHAS_LOG.md`**: Errores conocidos y lecciones aprendidas para evitar regresiones.
- **`.agents/brain/DATA_MAP.md`**: Mapeo completo de tablas SQLite y contratos de datos.
- **`AGENTS.md`**: Operating System multiagente del repositorio.

---

## 5. Criterios de Aceptación para Entregables ("Done")

Una tarea sólo se considera terminada cuando:
1. `npm run backend:test` aprueba **27 / 27 tests** sin fallos.
2. `npm run build` compila limpiamente sin errores de tipos TypeScript ni violaciones de budgets.
3. Se documenta la modificación en el código preservando tipado estricto.
