# Mapa de Datos, Almacenamiento y Contratos (Data Map)
## BASETRACK APP - Catálogo Técnico de Persistencia y Eventos

Este documento sirve como referencia rápida de las estructuras de datos, claves de almacenamiento local y eventos distribuidos para mantener la coherencia del sistema.

---

### 1. Tablas en SQLite (`server/data/basetrack.db`)

| Tabla | Clave Primaria | Propósito | Campos Clave |
| :--- | :--- | :--- | :--- |
| `users` | `id` (UUID) | Cuentas y credenciales de acceso | `username`, `password_hash`, `role` (ADMIN, SUPERVISOR, OPERADOR), `shift`, `full_name`, `document_id` |
| `crew_members` | `id` (string) | Nómina de personal oficial en faena | `name`, `document_id`, `primary_role`, `shift_code` (G1-G4), `radio_channel`, `status`, `avatar_url` |
| `area_assignments` | `id` (string) | Asignación activa por puesto/área | `shift_code`, `shift_date`, `shift_type` (DIA/NOCHE), `position_key`, `operator_id`, `epp_verified`, `safety_talk_completed` |
| `supervisor_operators` | `id` (UUID) | Vínculo jerárquico cuadrilla-supervisor | `supervisor_id`, `operator_id`, `created_at` |
| `cyclone_station_samples` | `id` (string) | Ensayos de 1ra y 2da Estación Ciclones | `station`, `sample_time`, `battery_tag`, `solids_feed`, `solids_of`, `solids_uf`, `mesh200_feed`, `mesh200_of`, `mesh200_uf`, `shift_code`, `date` |
| `cyclone_reports` | `id` (UUID) | Telemetría general de ciclones | `battery_tag`, `total_cyclones`, `active_cyclones`, `feed_pressure_psi`, `feed_density_kgm3`, `p80_microns`, `shift_code` |
| `pump_station_sheets` | `id` (UUID) | Bitácora de la estación de bombeo | `report_date`, `shift_code`, `operator_name`, `sentina_pumps_json`, `intermedia_pumps_json`, `torre5_pumps_json`, `levels_json`, `main_indicators_json` |
| `pumps` | `id` (UUID) | Estado individual de cada bomba | `tag`, `name`, `flow_rate`, `pressure`, `status` (RUNNING, STOPPED, MAINTENANCE) |
| `tailings_reports` | `id` (UUID) | Control de presa y descarga de relaves | `station_tag`, `flow_rate_m3h`, `solids_percentage`, `dam_level_meters`, `freeboard_meters`, `piezometer_kpa`, `turbidity_ntu`, `pumping_line_status`, `operator_name`, `shift_code` |
| `maintenance_tickets` | `id` (UUID) | Órdenes de trabajo y fallas mecánicas | `equipment_tag`, `priority` (LOW, MEDIUM, HIGH, CRITICAL), `description`, `photo_url`, `assigned_to`, `status` |
| `shift_handovers` | `id` (UUID) | Libro de acta oficial de relevo | `date`, `shift_code`, `shift_type`, `outgoing_supervisor`, `incoming_supervisor`, `safety_incidents`, `production_tons`, `is_accepted`, `crew_roster_json`, `operational_checklist_json` |
| `plant_parameters` | `id` (string) | Metas operacionales calibradas | `production_target_tons`, `target_tph`, `target_solids_pct`, `cyclones_target_mesh200_of`, `tailings_min_freeboard_meters`, `updated_at` |
| `vehicles` | `id` (string) | Padrón dinámico de camionetas mineras 4x4 | `plate` (UNIQUE), `tag`, `model`, `color`, `area`, `base_odometer`, `is_active`, `created_at`, `updated_at` |
| `vehicle_checklists` | `id` (string) | Inspección pre-uso de camionetas mineras 4x4 | `vehicle_plate` (vinculada a `vehicles.plate`), `date`, `shift`, `driver_name`, `driver_dni`, `items_json`, `operational_status` |
| `devices` | `id` (string) | Monitor de flota de terminales y tablets | `device_name`, `ip_address`, `user_agent`, `last_seen`, `is_revoked` |
| `role_permissions` | `role` (string) | Matriz RBAC base por rol del sistema | `role` (ADMIN, SUPERVISOR, OPERADOR), `permissions` (JSON), `updated_at` |
| `user_permission_overrides` | `user_id` (string) | Excepciones granulares de permisos por usuario | `user_id`, `permissions` (JSON), `updated_at` |
| `sync_events` | `id` (INTEGER) | Bitácora de eventos para replicación y reconexión | `device_id`, `entity`, `action`, `data` (JSON), `timestamp` |
| `audit_logs` | `id` (UUID) | Trazabilidad forense y auditoría SCADA | `user_id`, `username`, `action`, `resource`, `resource_id`, `details`, `ip_address`, `created_at` |

---

### 2. Catálogo de Claves de Almacenamiento Local (`basetrack_*`)

Todas las lecturas y escrituras locales deben gestionarse mediante `getRealtimeData()` y `saveRealtimeData()`.

| Clave | Formato / Tipo | Descripción |
| :--- | :--- | :--- |
| `basetrack_token` | `string` | JWT activo de la sesión del usuario |
| `basetrack_user` | `object` | Datos del usuario autenticado (id, username, role, shift, fullName) |
| `basetrack_permissions_matrix` | `object` | Matriz de permisos RBAC personalizada en cliente |
| `basetrack_device_id` | `string` | Identificador único de terminal para monitor de flota |
| `basetrack_device_name` | `string` | Nombre legible de terminal (ej. "PC Sala de Control", "Móvil Android") |
| `basetrack_calc_state` | `object` | Parámetros activos de Balanza Marcy, Floculante, Dilución y Parshall |
| `basetrack_pump_sheet_<date>` | `object` | Planilla de bombeo por fecha de turno |
| `basetrack_pump_sheet_latest` | `object` | Última planilla de bombas cargada (caché de arranque rápido) |
| `basetrack_pumps_telemetry` | `array` | Lecturas en tiempo real de bombas |
| `basetrack_active_theme` | `string` | Preferencia de tema visual (`'light'` o `'dark'`) |
| `basetrack_sync_queue` | `array` | Cola de mutaciones pendientes de envío al servidor (offline queue) |

---

### 3. Eventos Globales y Canales Distribuidos

| Canal / Evento | Ámbito | Disparador | Acción Requerida |
| :--- | :--- | :--- | :--- |
| `WebSocket ('/ws')` | Bi-direccional en vivo | Conexión cliente-servidor | Handshake (`WELCOME`), registro de dispositivo (`REGISTER`), latencia (`PING`/`PONG`) y telemetría (`EVENT` < 20ms) |
| `CustomEvent('basetrack_local_change')` | Pestaña activa (DOM) | `saveRealtimeData()` (cuando no tiene `skipBroadcast`) | Encola en `sync_queue` y transmite a `BroadcastChannel` |
| `BroadcastChannel('basetrack_sync_channel')` | Multi-pestaña P2P | Modificación local en cualquier pestaña del mismo navegador | Aplica con `{ skipBroadcast: true }` y sincroniza vistas |
| `CustomEvent('basetrack_cloud_sync')` | Pestaña activa (DOM) | Recepción de evento remoto (`/api/sync/pull`), WS o canal P2P | Componentes suscritos refrescan sus Signals o variables |
| `FORCE_LOGOUT` | Remoto / P2P / WS | Revocación de terminal desde el módulo Admin | Limpia token/usuario y redirige de inmediato a `/auth/login` |
