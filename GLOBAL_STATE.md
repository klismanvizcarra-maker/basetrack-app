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
- **Referencia Visual**: Diseño UI Premium Dark-Violet (basado en CRAVEAT: `#13111c`, `#1e1b2e`, `#26223b`, acentos violeta/magenta/cian, widgets donut, curvas de gradiente y tarjetas KPI con badge circular).
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

---

## 5. Historial de Hand-offs Recientes

| Timestamp | De Agente | A Agente | Tarea ID | Resumen de Entrega |
| :--- | :--- | :--- | :--- | :--- |
| 2026-09-14 | Setup | Orchestrator | `TASK-000` | Inicialización de reglas y definición del equipo |
| 2026-09-16 | Orchestrator | Backend Agent | `TASK-001` | Asignación de diseño de base de datos, migraciones y APIs REST |
| 2026-09-16 | Backend Agent | Frontend Agent | `TASK-001` | Entrega de APIs REST, SQLite nativo, JWT RBAC y datos de prueba |
| 2026-09-16 | Frontend Agent | QA & Security Agent | `TASK-002/003` | Entrega de UI Angular, diseño CRAVEAT y módulos funcionales |
| 2026-09-16 | Orchestrator / Multi-Agent | QA & Security Agent | `TASK-006` | Entrega de tabla operativa 2da Estación Ciclones, endpoints, tests y UI de alta fidelidad |


---

## 6. Registro de Bloqueos y Alertas de Escalamiento a Humano

_Sin bloqueos activos. Autorización autónoma concedida por el Humano para completar las fases._
