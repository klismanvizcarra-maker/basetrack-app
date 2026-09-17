# Documento de Estado Global (Global State Document)

> **Única Fuente de Verdad (SSOT)**: Todos los agentes leen y actualizan su estado a través del Orchestrator en este documento para garantizar consistencia y evitar pérdida de contexto o alucinaciones.

---

## 1. Metadatos del Proyecto

- **Proyecto**: BASETRACK APP
- **Estado Actual**: `INITIALIZED`
- **Fase Actual**: `SYSTEM_SETUP`
- **Última Actualización**: 2026-09-14
- **Iteraciones Críticas Acumuladas**: 0 / 3

---

## 2. Visión del Proyecto y Alcance

**BASETRACK APP**: Sistema de control, bitácora y monitoreo operacional de plantas industriales y mineras (bombas, ciclones, relaves, cambio de guardia, mantenimiento y administración).
- **Referencia Visual**: Diseño UI Enterprise Blanco Puro (Clean Slate Light: `#ffffff`, `#f8fafc`, acentos índigo/esmeralda, alto contraste WCAG, widgets donut, tarjetas KPI modernas y elevación sutil).
- **Modo de Ejecución**: Orchestrator autónomo coordinando Frontend, Backend y QA/Seguridad con autorización integral concedida por el usuario.

---

## 3. Arquitectura y Contratos de Integración

- **Frontend Stack**: Angular 19+ (Standalone Components, Signals, Router, PrimeNG / Custom Wrappers, PWA/Offline Sync).
- **Backend Stack**: Node.js + Express + TypeScript con arquitectura limpia en capas (Controladores, Servicios, Repositorios).
- **Base de Datos**: SQLite relacional con esquema normalizado, migraciones automatizadas, índices y seeds operativos.
- **Seguridad**: Autenticación JWT, contraseñas hasheadas con bcrypt, RBAC (ADMIN, SUPERVISOR, OPERADOR), CORS seguro y cabeceras de protección.

---

## 4. Tablero de Tareas Activas

| ID | Tarea | Agente Asignado | Dependencias | Estado | Iteraciones QA (Max 3) | Criterios de Aceptación |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `TASK-000` | Configuración del Sistema Multiagente | Orchestrator | Ninguna | `DONE` | 0/3 | Reglas, agentes, estado global y plantillas listos |
| `TASK-001` | Backend & Persistencia de Datos | Backend Agent | `TASK-000` | `DONE` | 0/3 | Express + TypeScript + SQLite, migraciones, modelos, seeds y endpoints REST funcionales |
| `TASK-002` | Frontend Core, Layout & Shared UI System | Frontend Agent | `TASK-000` | `DONE` | 0/3 | Estructura `src/app/`, diseño dark-violet CRAVEAT, layout, sidebar, header y shared UI |
| `TASK-003` | Frontend Features & Módulos Operativos | Frontend Agent | `TASK-001`, `TASK-002` | `DONE` | 0/3 | Dashboard, Shift-Handover, Pumps, Cyclones, Tailings, Maintenance, Admin conectados |
| `TASK-004` | QA, Pruebas Automatizadas & Auditoría OWASP | QA & Security Agent | `TASK-001`, `TASK-003` | `DONE` | 0/3 | Tests de endpoints, verificación de compilación, auditoría OWASP y cero secretos expuestos |
| `TASK-005` | Despliegue en Vercel & Pipeline CI/CD | Orchestrator | `TASK-002`, `TASK-003` | `DONE` | 0/3 | Repositorio GitHub conectado, vercel.json configurado y sincronización continua habilitada |
| `TASK-006` | Integración de Planilla Metalúrgica de 2da Estación de Ciclones | Frontend & Backend Agent | `TASK-001`, `TASK-003` | `DONE` | 0/3 | Tabla metalúrgica con % sólidos y % malla 200, réplica visual de plantilla, cálculo de promedios, persistencia y tests |
| `TASK-007` | Transformación Visual a Tema Blanco Puro Enterprise | Frontend Agent | `TASK-002`, `TASK-003`, `TASK-006` | `DONE` | 0/3 | Paleta blanca pura (#ffffff, #f8fafc), alto contraste slate (#0f172a), header/sidebar/modals/tablas/inputs claros |
| `TASK-008` | Persistencia y Precarga de Módulo Administración | Frontend & Backend Agent | `TASK-003`, `TASK-007` | `DONE` | 0/3 | Precarga de usuarios y logs SCADA, fallback localStorage, seeds SQLite y soporte offline |
| `TASK-009` | Módulo de Configuración de Cuenta & Perfil de Usuario | Frontend & Backend Agent | `TASK-007`, `TASK-008` | `DONE` | 0/3 | Edición de nombres, cambio seguro de contraseña, subida de foto/avatar, presets de planta y persistencia |
| `TASK-010` | Unificación Global de Paleta Verde Esmeralda & Menta Industrial | Frontend Agent | `TASK-007`, `TASK-009` | `DONE` | 0/3 | Paleta esmeralda (#059669/#047857), fondos menta (#ecfdf5/#e6f7ef), botones, tabs y gráficas unificados |
| `TASK-011` | PWA Completa & Modo Instalable en Celulares y Tablets | Frontend & QA Agent | `TASK-010` | `DONE` | 0/3 | Manifest web, Service Worker caching, iconos 192/512px, detección iOS/Android/Desktop, modal guía y botones de instalación nativa |
| `TASK-012` | Generador de Reportes en PDF Oficial de Turno & Modo Offline IndexedDB | Frontend & Backend Agent | `TASK-011` | `DONE` | 0/3 | Exportador PDF A4 oficial con consolidado de bombas, ciclones, descarga y firmas; motor IndexedDB local y sincronización en cola |
| `TASK-013` | Gestión de Cuadrilla & Asignación de Operadores por Área | Frontend & Backend Agent | `TASK-012` | `DONE` | 0/3 | Tablero de 5 posiciones críticas (Operador de Bombas, Ciclones, Descarga, Misceláneos, Relevo), check-in EPP/charla 5m, persistencia SQLite y offline |
| `TASK-014` | Carga Masiva de Personal por Lote desde Administración | Frontend & Backend Agent | `TASK-013` | `DONE` | 0/3 | Importación masiva vía archivo CSV y copy-paste desde Excel, validación en vivo, descarga de plantilla, transacción SQLite y sincronización dual con crew_members |
| `TASK-015` | Persistencia en Tiempo Real y Preservación de Fotos/Perfil | Frontend & Backend Agent | `TASK-014` | `DONE` | 0/3 | Utilidad local-store dual (LocalStorage+IndexedDB), compresión Canvas para fotos a 45KB, sincronización con cuadrilla y almacenamiento persistente en todos los módulos |
| `TASK-016` | Auditoría de Seguridad, Login Obligatorio y Cero Backdoors | QA & Security Agent | `TASK-015` | `DONE` | 0/3 | Eliminación de bypass de auto-login, campos vacíos obligatorios en login, remoción de accesos rápidos expuestos, eliminación de backdoor demo en backend, JWT estricto y pruebas automatizadas |
| `TASK-017` | Sincronización en la Nube Multi-Dispositivo (Cloud Realtime Sync) | Frontend & Backend Agent | `TASK-016` | `DONE` | 0/3 | Motor reactivo CloudSyncService, BroadcastChannel para multi-pestaña P2P, endpoints /api/sync/push y /api/sync/pull en SQLite, pill en header y gestor de flota en admin |

---

## 5. Historial de Hand-offs Recientes

| Timestamp | De Agente | A Agente | Tarea ID | Resumen de Entrega |
| :--- | :--- | :--- | :--- | :--- |
| 2026-09-14 | Setup | Orchestrator | `TASK-000` | Inicialización de reglas y definición del equipo |
| 2026-09-16 | Orchestrator | Backend Agent | `TASK-001` | Asignación de diseño de base de datos, migraciones y APIs REST |
| 2026-09-16 | Backend Agent | Frontend Agent | `TASK-001` | Entrega de APIs REST, SQLite nativo, JWT RBAC y datos de prueba |
| 2026-09-16 | Frontend Agent | QA & Security Agent | `TASK-002/003` | Entrega de UI Angular, diseño CRAVEAT y módulos funcionales |
| 2026-09-16 | Orchestrator / Multi-Agent | QA & Security Agent | `TASK-006` | Entrega de tabla operativa 2da Estación Ciclones, endpoints, tests y UI de alta fidelidad |
| 2026-09-16 | Frontend Agent | Orchestrator | `TASK-007` | Transformación global a tema blanco puro (#ffffff, #f8fafc), contraste WCAG y componentes unificados |
| 2026-09-16 | Frontend & QA Agent | Orchestrator | `TASK-011` | Implementación y verificación de PWA standalone, Service Worker con fallback offline, e instalación en dispositivos móviles y PC |
| 2026-09-16 | Multi-Agent Team | Orchestrator | `TASK-012` | Generador formal de Reportes en PDF A4 de cierre de guardia y motor IndexedDB con cola de sincronización |
| 2026-09-17 | Multi-Agent Team | Orchestrator | `TASK-013` | Módulo operacional de Gestión de Cuadrilla con asignación en tiempo real para las 5 posiciones críticas y control de EPP/charla de seguridad |
| 2026-09-17 | Multi-Agent Team | Orchestrator | `TASK-014` | Carga de personal por lote desde Administración con CSV/Excel, validación interactiva, sincronización dual users+cuadrilla y transacción SQLite |
| 2026-09-17 | Multi-Agent Team | Orchestrator | `TASK-015` | Persistencia en tiempo real unificada, compresión de fotos y retención en registro permanente |
| 2026-09-17 | QA & Security Agent | Orchestrator | `TASK-016` | Blindaje de seguridad: login obligatorio sin bypass, purga de backdoors, validación estricta de credenciales y tests de seguridad aprobados |
| 2026-09-17 | Multi-Agent Team | Orchestrator | `TASK-017` | Sincronización multi-dispositivo en la nube: BroadcastChannel instantáneo, cola offline y replicación central SQLite |

---

## 6. Registro de Bloqueos y Alertas de Escalamiento a Humano

_Sin bloqueos activos. Sistema de sincronización multi-dispositivo operativo y desplegado._
