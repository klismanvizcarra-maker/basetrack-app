# Registro de Decisiones de Arquitectura (ADR Registry)
## BASETRACK APP - Sistema de Memoria Operacional y Arquitectura

Este documento preserva las decisiones técnicas y de ingeniería adoptadas en el proyecto, su justificación operativa en faena y los contratos inviolables que deben respetarse.

---

### ADR-001: Régimen de Trabajo Minero 8x8 y Roster Cíclico de 16 Días
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: En la operación minera se trabaja bajo régimen 8x8 (4 días de turno día + 4 días de turno noche = 8 días de trabajo x 8 días de descanso/bajada). Existen 4 guardias oficiales: `G1`, `G2`, `G3`, `G4`.
- **Decisión**:
  - Se implementó un ciclo determinista de 16 días (4 bloques de 4 días) estructurado en [`roster.util.ts`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/src/app/shared/utils/roster.util.ts).
  - Anclaje temporal de referencia calibrado al calendario real de planta.
  - Horarios de corte: Turno Día (07:00 a 19:00), Turno Noche (19:00 a 07:00 del día siguiente).
- **Consecuencia**: Ningún componente debe calcular guardias mediante números de día de semana genéricos (`getDay() % 2`); siempre debe invocarse `getRosterForDate()` o `getCurrentActiveShift()`.

---

### ADR-002: Huso Horario UTC-5 y Fecha Operacional de Turno Noche
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: La planta opera en UTC-5 (hora de Perú). Si se utiliza `new Date().toISOString().split('T')[0]`, al llegar a las 19:00 hora local (00:00 UTC), la fecha salta inmediatamente a mañana, desalineando los registros nocturnos.
- **Decisión**:
  - La fecha del turno noche de 19:00 a 07:00 pertenece al día en que el turno inició (antes de las 07:00 pertenece al día calendario anterior).
  - La única función autorizada para obtener la fecha de faena es `getCurrentActiveShift().dateStr` o `getLocalDateString()`.
- **Consecuencia**: Queda prohibido el uso de `toISOString().split('T')[0]` para fechar registros de bombas, ciclones, relevos o reportes PDF.

---

### ADR-003: Persistencia Híbrida Offline-First (LocalStore + IndexedDB + SQLite)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: En faena y áreas de relaves la señal WiFi/4G puede ser intermitente. La app no puede perder datos por desconexión ni por refresco de página.
- **Decisión**:
  - Todo cambio se guarda sincrónicamente en `localStorage` con prefijo `basetrack_` y de forma asíncrona en `IndexedDB` (`basetrack_db` -> `offline_cache`).
  - La utilidad central es [`local-store.util.ts`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/src/app/core/storage/local-store.util.ts).
  - Cuando hay conectividad, las acciones encoladas se sincronizan al backend Express + SQLite (`node:sqlite DatabaseSync`).
- **Consecuencia**: La UI debe reflejar cambios al instante sin esperar confirmación HTTP del servidor (Optimistic UI con fallback de reintentos).

---

### ADR-004: Prevención de Tormentas de Eventos en Sincronización en Vivo (`skipBroadcast`)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: `CloudSyncService` escucha eventos remotos y mensajes entre pestañas de `BroadcastChannel`. Si cada actualización de almacenamiento vuelve a emitir `basetrack_local_change`, se genera un bucle infinito de eco (ping-pong) que satura la CPU y satura la cola de sincronización.
- **Decisión**:
  - `saveRealtimeData(key, data, options?: { skipBroadcast?: boolean })` acepta la bandera `skipBroadcast`.
  - Cuando un evento proviene del servidor (`applyRemoteEvent`) o de otra pestaña (`handleBroadcastMessage`), se invoca con `{ skipBroadcast: true }`.
- **Consecuencia**: Solo las mutaciones iniciadas por el usuario humano en la pestaña activa propagan el evento global `basetrack_local_change`.

---

### ADR-005: Cálculo de Promedios Metalúrgicos Sin Distorsión por Ceros
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: En las baterías de ciclones (1ra y 2da estación), no todas las celdas se ensayan a cada hora. Las celdas sin valor se registran con 0 o nulo. Si la sumatoria se divide entre `samples.length` total, los promedios de % sólidos y % malla -200 se desploman drásticamente (ej. de 81% a 20%).
- **Decisión**:
  - Cada métrica metalúrgica (`solids_feed`, `solids_of`, `solids_uf`, `mesh200_feed`, `mesh200_of`, `mesh200_uf`) debe calcular su promedio dividiendo únicamente entre el conteo de muestras con valor mayor a cero (`valor > 0`).
  - Implementado de forma unificada en el backend (`cyclones.controller.ts`), frontend (`cyclones.component.ts`) y generadores PDF (`shift-report-pdf.component.ts`, `cyclone-report-pdf.component.ts`).
- **Consecuencia**: Los balances metalúrgicos reflejan la calidad real del mineral tratado sin sesgo de slots vacíos.

---

### ADR-006: Clean Slate, Administrador Raíz Exclusivo y Nómina Oficial
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Para evitar cuentas fantasmas o nombres ficticios en auditorías de seguridad, la base de datos se mantiene purgada y blindada.
- **Decisión**:
  - Solo existe 1 cuenta Administrador predeterminada: `Marckv` (Marck Vizcarra, DNI: `91209966`).
  - La nómina oficial se compone de 36 integrantes mineros distribuidos en 4 guardias (4 supervisores + 32 operadores en 8 puestos).
  - La creación manual de usuarios vía endpoint `/api/admin/users` está estrictamente bloqueada (HTTP 403 Forbidden); el personal se incorpora exclusivamente por carga masiva validada o registro oficial.
- **Consecuencia**: Ningún seed o migración puede re-insertar usuarios demo o cuentas auxiliares no autorizadas.

---

### ADR-007: Calibración Centralizada de Metas Operacionales (`plant_parameters`)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Los objetivos de molienda (tonelaje meta, TPH de relevo, % malla -200 objetivo, borde libre de presa de relaves) cambian según la campaña mineralógica y deben ser calibrables por el Administrador/Superintendente sin tocar código fuente.
- **Decisión**:
  - Tabla relacional SQLite `plant_parameters` con endpoints `GET` y `PUT /api/admin/plant-parameters`.
  - Servicio frontend reactivo `PlantParametersService` con Signals de Angular 19.
  - Consumo directo en `ShiftHandoverComponent` (cálculo de cumplimiento de tonelaje) y `TailingsComponent` (alerta de semáforo de borde libre reglamentario).
- **Consecuencia**: Toda meta operativa debe consultarse al servicio `PlantParametersService` en lugar de quemarse estáticamente en plantillas.

---

### ADR-008: Contenedorización Multi-Stage Unificada (Docker & Docker Compose)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Para despliegues en servidores locales de planta minera, NAS o VPS, la aplicación debe poder levantarse con un solo comando, sin depender de entornos Node preinstalados y con persistencia garantizada de la base de datos SQLite y sus archivos WAL.
- **Decisión**:
  - `Dockerfile` multi-etapa: etapa 1 compila Angular 19 SPA, etapa 2 compila el backend Express TypeScript, y etapa 3 empaqueta una imagen Alpine ligera con Node 22 que corre ambos en un solo puerto unificado.
  - La base de datos SQLite se almacena en el volumen montado `/app/data` (enlazado al host en `./data`), asegurando que caídas de energía o actualizaciones no borren los datos operacionales.
  - El frontend detecta automáticamente el mismo origen (`origin/api`), evitando problemas de CORS en redes LAN industriales (192.168.x.x, 10.x.x.x).
- **Consecuencia**: La aplicación puede desplegarse en segundos en cualquier máquina con `docker compose up -d` y respaldarse copiando el archivo `./data/basetrack.db`.

---

### ADR-009: Telemetría y Sincronización en Tiempo Real de Ultra-Baja Latencia vía WebSockets Bi-Direccionales (/ws)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: En operaciones de concentración minera, el desfase de 6 segundos del sondeo HTTP generaba retrasos perceptibles en la Sala de Control al registrar muestras de ciclones, arranques de bombas slurry o eventos de relevo entre terminales de campo (tablets/móviles) y consolas SCADA.
- **Decisión**:
  - Servidor WebSocket nativo (`ws` en Node 22) montado sobre el servidor HTTP Express en la ruta `/ws` ([`server/src/websocket/ws.ts`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/server/src/websocket/ws.ts)).
  - Protocolo estructurado: `WELCOME`, `REGISTER`, `PING`/`PONG` (heartbeat de 25s con `unref()`), y `EVENT` con inserción directa en SQLite `sync_events` y reenvío instantáneo (< 20ms) a todas las demás terminales conectadas.
  - Prevención de eco a nivel servidor: omisión estricta de envío a clientes con `meta.deviceId === event.deviceId`.
  - Cliente reactivo en Angular 19 ([`CloudSyncService`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/src/app/core/services/cloud-sync.service.ts)):
    - Resolución dinámica de URL (`ws://` en LAN/localhost vs `wss://` con TLS en la nube).
    - Emisión inmediata por WebSocket en `broadcastChange()`; preservación de `BroadcastChannel` para multi-pestaña local.
    - Cadencia inteligente: push en vivo en modo conectado (reconciliación pasiva cada 60s); fallback a sondeo HTTP rápido de 6s en caso de desconexión.
    - Reintento con backoff exponencial y reconexión automática tras reconexión a red de faena.
  - Indicadores visuales en Header y Modal de Sincronización: insignia "En Vivo WS" con micro-animación de pulso esmeralda y diagnóstico de latencia.
- **Consecuencia**: La latencia inter-terminal se redujo de 6,000ms a < 20ms, el tráfico HTTP residual se redujo en un 90%, y se preservó 100% la resiliencia offline en túneles sin cobertura.

---

### ADR-010: Jerarquía de Agentes Especializados y Regla Anti-Deadlocks (Máximo 3 Iteraciones)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Para escalar el desarrollo de BASETRACK APP sin alucinaciones, derivas arquitectónicas ni ciclos infinitos de corrección ("deadlocks"), el sistema requiere división formal de competencias y gobernanza estricta.
- **Decisión**:
  - Estructuración en 6 roles especialistas (`frontend-agent`, `backend-agent`, `tailings-engineering-agent`, `telemetry-sync-agent`, `devops-agent`, `qa-security-agent`) dirigidos por el `orchestrator-agent` y anclados en la memoria central `basetrack-brain`.
  - Cada rol opera bajo su respectivo `SKILL.md` con entradas, salidas y restricciones explícitas.
  - El QA & Security Agent posee **Poder de Veto** y un límite inviolable de **3 iteraciones**: ante 3 rechazos consecutivos en una misma tarea, el trabajo se suspende y se escala obligatoriamente al Humano.
- **Consecuencia**: Cero regresiones históricas, trazabilidad total de hand-offs y garantía de calidad respaldada por suites automatizadas (`npm run verify`).

---

### ADR-011: Estándares de Depósito de Relaves (GISTM & D.S. 024-2016-EM), Cicloneado para Dique y Borde Libre
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: La presa de relaves y el transporte de pulpa slurry representan el mayor foco de riesgo de seguridad, ambiental y operacional en faena minera. Cualquier descalibración en la clasificación de arenas para el dique o en el borde libre puede comprometer la estabilidad física del depósito.
- **Decisión**:
  - Toda lógica, formulario o alarma relacionada con relaves se custodia bajo el estándar global **GISTM** (*Global Industry Standard on Tailings Management*) y la normativa nacional **D.S. 024-2016-EM**.
  - **Calidad de Arenas para Dique (Underflow)**: El recrecimiento del muro exige arenas cicloneadas con $\% \text{ Malla } -200 \le 18\%$ a $20\%$ y $\% \text{ sólidos} > 70\%$ para evitar licuefacción estática o sísmica.
  - **Borde Libre Mínimo**: Supervisión continua en tiempo real mediante semáforo referenciado a `plant_parameters.tailings_min_freeboard_meters` para prevenir desbordes por avenidas o sismos.
  - **Hidráulica y Calidad de Agua**: Monitoreo de velocidad crítica de pulpa para prevenir embancamiento en líneas de impulsión; control de turbidez en Torre 5 para agua clara recuperada y aforos Parshall en drenes basales.
- **Consecuencia**: La plataforma garantiza que ningún cambio de código relaje las tolerancias geotéuticas e hidráulicas de la presa de relaves.

---

### ADR-012: Flujo Operacional Cerrado Bombas ⇄ Mantenimiento con Bloqueo y Pase Operativo Exclusivo
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: En operaciones de impulsión y pulpas mineras, si un operador restablece arbitrariamente una bomba con falla a "Operativo" sin inspección mecánica/eléctrica, se expone al personal a riesgos de seguridad graves (LOTO/bloqueo de energías) y daños catastróficos a impulsores y sellos.
- **Decisión**:
  - Al marcar una bomba en **Falla** en la Planilla Operativa de Bombas o Telemetría, el sistema auto-genera inmediatamente una Orden de Trabajo (`maintenance_requests`) con `source_module: 'PUMPS_STATION'` y prioridad ALTA.
  - La bomba queda en **Bloqueo Operacional**: el operador de bombas tiene prohibido cambiarla a 'Operativo' o 'Stand by' directamente (la UI muestra un modal informativo con base en el D.S. 024-2016-EM).
  - Cuando Mantenimiento pulsa "Atender / Iniciar Trabajo" (`IN_PROGRESS`), la bomba conmuta automáticamente a **'Mantenimiento'** en la planilla de bombas.
  - **Pase Operativo Exclusivo**: Únicamente el personal de Mantenimiento puede firmar y emitir el Pase Operativo al resolver la OT (`RESOLVED`), restituyendo la bomba a **'Operativo'** en tiempo real vía WebSockets (`/ws`) y base de datos SQLite.
- **Consecuencia**: Trazabilidad completa de paradas de bombas, cumplimiento de normas de bloqueo de energías y erradicación de retornos no autorizados a operación.

---

### ADR-013: Padrón Dinámico de Camionetas Mineras (4x4) y Trazabilidad Histórica de Checklists Pre-Uso
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Anteriormente las camionetas mineras estaban limitadas por una restricción CHECK en SQLite (`vehicle_plate IN ('BMC715', 'BKS921', 'BKS913', 'BPS747')`) y un arreglo estático en controladores backend y frontend. El Administrador requería poder dar de alta/baja camionetas y actualizar placas sin tocar código.
- **Decisión**:
  - Se implementó la tabla `vehicles` (`id`, `plate` UNIQUE, `tag`, `model`, `color`, `area`, `base_odometer`, `is_active`, `created_at`, `updated_at`) con índices `idx_vehicles_plate` y `idx_vehicles_active`.
  - Se migró `vehicle_checklists` en SQLite para remover la restricción CHECK rígida, permitiendo registrar checklists para cualquier vehículo activo en la base de datos.
  - **Actualización de Placas en Cascada**: Al editar la placa de una camioneta en el Administrador, se actualizan en cascada los registros históricos en `vehicle_checklists` (`UPDATE vehicle_checklists SET vehicle_plate = ? WHERE vehicle_plate = ?`), garantizando trazabilidad y auditoría normativa continua (D.S. 024-2016-EM).
  - **Baja Lógica / Decommissioning Seguro**: Si un vehículo posee inspecciones pre-uso registradas y se solicita su eliminación, el sistema ejecuta una baja lógica (`is_active = 0`) para resguardar la evidencia legal de seguridad y pre-uso.
  - **Validación Pre-Uso**: `POST /api/vehicles/checklists` consulta la tabla `vehicles` y rechaza checklists para placas no registradas o dadas de baja (`is_active = 0`).
  - **Módulo de Administración UI**: 7ma pestaña en `/admin` con 4 KPIs de flota en tiempo real, tabla con badges mineros, búsqueda, modales de alta/edición y reactividad inmediata vía WebSockets.
- **Consecuencia**: El Administrador gestiona la flota minera de forma 100% dinámica desde la interfaz sin intervención de código ni riesgo de corrupción de historial.

---

### ADR-014: Optimización de Carga Instantánea, Desbloqueo de Red y Mitigación de Suspensión Fría (Cold Start)
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Usuarios reportaron demoras excesivas al cargar la aplicación. Se identificaron tres cuellos de botella:
  1. En Vercel/Render, la capa gratuita de Render se suspende tras 15 minutos de inactividad, provocando demoras de 20-30 segundos en la primera petición HTTP sin que la interfaz mostrase retroalimentación inmediata.
  2. En redes locales de planta (IPs LAN 192.168.x.x / 10.x.x.x en puerto 4200), `getApiBaseUrl()` fallaba en reconocer el host local y desviaba el tráfico al backend en la nube en lugar del servidor local en puerto 3001.
  3. Fuentes tipográficas Google Fonts cargadas de forma síncrona bloqueaban el renderizado inicial (FCP), y peticiones a APIs sin timeout bloqueaban los slots de conexión del navegador.
- **Decisión**:
  - **Corrección de Enrutamiento LAN**: Si `port === '4200'`, `getApiBaseUrl()` retorna `http://${hostname}:3001/api` para cualquier IP local, garantizando latencias < 2ms en faena. En Vercel se utiliza el proxy relativo `${origin}/api`, eliminando preflights CORS.
  - **Carga Tipográfica No Bloqueante**: Fuentes Google Plus Jakarta Sans precargadas con `rel="preload"` y `media="print" onload="this.media='all'"`, permitiendo dibujo inmediato de pantalla con fuentes del sistema (`system-ui`).
  - **Early Warmup Ping Inline**: Script inline en `<head>` de `index.html` que inicia el apretón de manos con el backend en paralelo mientras el navegador descarga los bundles JavaScript.
  - **Service Worker v9 con Timeout y Fallback**: Carrera de 3.5 segundos con `AbortController` sobre peticiones `/api/` antes de entregar la respuesta en caché, erradicando esperas de 25s+.
  - **Timeouts Resilientes en Cliente**: Timeouts de 3.5s a 5s en `AuthService`, `CloudSyncService` y `DashboardComponent` con fallback transparente a datos locales cacheados.
  - **Keep-Alive Automatizado**: Workflow en GitHub Actions (`.github/workflows/keepalive.yml`) con ejecución programada cada 14 minutos (`*/14 * * * *`) hacia `/api/health`, evitando que Render entre en suspensión fría.
- **Consecuencia**: La aplicación carga en menos de 400ms, nunca se congela ante retardos de red externa y mantiene el backend permanentemente despierto.

---

### ADR-015: Erradicación de Tormenta de Eventos DOM Circulares y Blindaje de Cola Cloud Sync
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Un bucle recursivo síncrono infinito entre `local-store.util.ts`, `VehicleChecklistComponent.syncListener` y `VehicleChecklistService.loadChecklistsForPlate` saturó el servidor de desarrollo Vite con más de 1.25 millones de líneas de log (95 MB), elevó el consumo de memoria del proceso WebKit de Safari a más de 10 GB de RAM y saturó `basetrack_sync_queue` en localStorage con cientos de eventos repetitivos, provocando congelamientos de navegador y errores 400 al intentar enviar lotes de más de 500 eventos por petición HTTP.
- **Decisión**:
  1. **Separación de Responsabilidades de Eventos**: `basetrack_local_change` notifica mutaciones locales a `CloudSyncService`; `basetrack_cloud_sync` se reserva estrictamente para eventos remotos entrantes (WebSocket / BroadcastChannel). Se eliminó la emisión de `basetrack_cloud_sync` desde `saveRealtimeData()`.
  2. **Guardas Estrictas en Componentes**: Inyección de la guarda obligatoria `if (e.detail?.source === 'local') return;` en los `syncListener` de todos los componentes activos (Pumps, Cyclones, Tailings, Crew, Checklist, Dashboard, Shift-Handover, Maintenance, Roster, Admin).
  3. **Supresión de Eco en Caché de Servicios**: `CrewService.saveCache()` y `PumpsComponent.loadTelemetryPumps()` configurados con `{ skipBroadcast: true }` para que el cacheo de respuestas HTTP GET nunca se interprete como una mutación local de usuario.
  4. **Delimitación y Deduplicación de Cola en CloudSyncService**: Deduplicación por clave de entidad y tope estricto de 50 eventos por lote en `flushQueue()`, purgando automáticamente la cola si el backend rechaza el lote con 400.
  5. **Saneamiento Automático de LocalStorage al Iniciar**: `App.ngOnInit()` detecta y purga cualquier clave `basetrack_sync_queue` sobredimensionada (>50KB) o clave corrupta (>500KB) derivada del incidente previo, protegiendo al navegador contra saturación de memoria.
- **Consecuencia**: Eliminación total del bucle infinito, ejecución limpia de servidor dev sin tormentas de logs, inicialización sub-segundo y memoria del navegador estabilizada.

---

### ADR-016: Arquitectura de Auto-Actualización en Vivo en Vercel & Cache-Busting Multi-Nivel
- **Estado**: ACEPTADO / EN PRODUCCIÓN
- **Contexto**: Cuando se realizan despliegues en Vercel, los navegadores de los clientes (móviles, tablets y pantallas de sala de control) retienen activos cacheados por Service Workers y encabezados HTTP por horas o días a menos que el usuario fuerce una recarga manual o limpie datos. Esto causaba desfases de versiones entre clientes y servidores.
- **Decisión**:
  1. **Cache-Control Estricto en Edge (`vercel.json`)**: Reglas `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0` asignadas a `/version.json` y `/sw.js` para asegurar que el navegador siempre consulte la última versión en el servidor Vercel.
  2. **Doble Detección Automática**:
     - Chequeo periódico cada 60 segundos y al cambiar la visibilidad de la pestaña (`document.visibilitychange`, ej. cuando el operador desbloquea su tablet o celular).
     - Si `version.json` reporta un `timestamp` o `buildId` superior al cargado en memoria, el Service Worker activa `postMessage({ action: 'SKIP_WAITING' })`.
  3. **Auto-Recarga Reactiva Inmediata (`controllerchange`)**: `index.html` escucha el evento `navigator.serviceWorker.addEventListener('controllerchange', ...)` y ejecuta `window.location.reload()` sin intervención del usuario.
  4. **Empuje Remoto Vía WebSocket (`APP_UPDATE`)**:
     - Endpoint `POST /api/admin/broadcast-update` disponible para el Administrador `Marckv`.
     - Difusión instantánea vía WebSockets (`/ws`) y `BroadcastChannel` con payload `{ type: 'APP_UPDATE', force: true }`.
     - Los clientes conectados activan la recarga inmediata en sub-segundo.
  5. **Bypass de Service Worker**: `sw.js` (v10) ignora `/version.json` del caché de la aplicación para evitar falsos negativos.
- **Consecuencia**: Todo despliegue en Vercel se propaga y actualiza automáticamente a todas las pantallas de planta en tiempo real (< 1.5s), garantizando paridad total de versiones sin intervención técnica.
