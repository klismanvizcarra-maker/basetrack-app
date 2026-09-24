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
| `TASK-018` | Corrección de Posicionamiento y Centrado de Modales | Frontend Agent | `TASK-017` | `DONE` | 0/3 | Centrado vertical en viewport (desktop y móvil), desacople de containing-block de animaciones transform, z-index 99999 y cierre de admin-page previo a modales |
| `TASK-019` | Posiciones Dinámicas y Creación de Nuevos Puestos en Cuadrilla | Frontend & Backend Agent | `TASK-018` | `DONE` | 0/3 | Modal de creación de posiciones con selector de emojis, canal radial y consignas; asignación multi-guardia optgroup; migración de schema SQLite sin restricción CHECK; persistencia local y backend |
| `TASK-020` | Exportación de Reportes PDF en 1 Hoja (Bombas, Ciclones, Descarga) | Frontend Agent | `TASK-019` | `DONE` | 0/3 | Botón "Exportar PDF (1 Hoja)" en cada módulo individual, maquetación A4 portrait estricta de 1 página con membrete, KPIs, tablas, notas y firmas oficiales |
| `TASK-021` | Generación y Descarga Directa de PDF sin Diálogos del Navegador | Frontend Agent | `TASK-020` | `DONE` | 0/3 | Motor cliente con jsPDF y html2canvas (PdfExportService); auto-descarga directa de archivo .pdf al abrir modal; botón "Descargar PDF Directo" prioritario y supresión de botones |
| `TASK-022` | Auditoría Integral de Fallas y Mejoras (Test Suite 100%, Auth Robusto, Backup & Restore Total) | Orchestrator & Multi-Agent | `TASK-021` | `DONE` | 0/3 | Resolución de fallas de login y seeds idempotentes, 10/10 tests backend aprobados, build Angular sin advertencias CommonJS, exportación e importación/restauración total de backup JSON |
| `TASK-023` | Gestión Avanzada de Usuarios (Toolbar, Filtros, Acciones Rápidas) y Monitor de Terminales (Fleet Manager) | Multi-Agent Team | `TASK-022` | `DONE` | 0/3 | Barra de búsqueda reactiva, filtros por guardia y rol, edición modal de rol/guardia con sync cuadrilla, restablecimiento de contraseña, suspensión/activación de cuenta, monitor de flota en tiempo real y revocación remota de sesión con FORCE_LOGOUT |
| `TASK-024` | Ficha Operacional de Planta en Mi Perfil (DNI, Canal de Radio, Anexo, Especialidad y Sync Cuadrilla) | Multi-Agent Team | `TASK-023` | `DONE` | 0/3 | Ficha de guardia en Mi Perfil, DNI oficial, canal radial walkie-talkie, anexo/celular de emergencia, especialidad en planta, tarjeta lateral "Ficha Rápida", propagación bidireccional a crew_members y prueba unitaria backend #13 aprobada |
| `TASK-025` | Unificación del Color de Identidad Institucional a Azul Cobalto Real (#031795) | Frontend Agent | `TASK-024` | `DONE` | 0/3 | Adopción de #031795 como color de identidad oficial; tokens CSS, layout, header, sidebar, mobile bar, login, profile, admin, reportes PDF y gráficas unificados; semáforos operacionales de planta preservados; compilación y tests 100% aprobados |
| `TASK-026` | Integración Exhaustiva del Color de Marca en Toda la Aplicación | Frontend Agent | `TASK-025` | `DONE` | 0/3 | Barrido integral en componentes (Sidebar PWA badge, Header Sync modal y notificaciones, Ciclones tablas y modales, Bombas vista y tarjetas, Cuadrilla pizarras y avatares, Admin cloud sync card y dropzone CSV, Perfil sincronización, Reportes PDF sellos oficiales de firma, Gráficos Wave y clases globales) |
| `TASK-027` | Auditoría Integral de Fallas y Resiliencia de Red / Offline / CORS | Multi-Agent Team | `TASK-026` | `DONE` | 0/3 | Resolución de URLs hardcodeadas a getApiBaseUrl() dinámico para soporte local/móvil/PWA, CORS dinámico para red local de planta (192.168.x, 10.x), descarte inteligente de errores 4xx en cola IndexedDB para prevenir deadlocks, compilación 100% limpia y 13/13 tests backend aprobados |
| `TASK-028` | Integración del Isotipo y Logotipo Oficial BASETRACK en Toda la Aplicación | Frontend Agent | `TASK-027` | `DONE` | 0/3 | Despliegue global del isotipo oficial BASETRACK (piocha, montaña y flecha naranja) en favicon, PWA, sidebar, login, modal de instalación y encabezados de reportes PDF |
| `TASK-029` | Reestructuración Operacional a 4 Guardias (G1-G4) y 8 Puestos Oficiales de Planta | Multi-Agent Team | `TASK-028` | `DONE` | 0/3 | Modelo de 4 guardias (G1, G2, G3, G4) con 8 posiciones fijas por guardia (1 Supervisor + 7 Operadores: Bombas, Ciclones 1, Ciclones 2, Distribuidor, Descarga 1, Descarga 2, Misceláneos), 32 trabajadores oficiales en faena, migraciones SQLite v3 sin restricciones CHECK, compatibilidad hacia atrás y sincronización total en Cuadrilla, Admin, Relevo, Perfil y Reportes PDF |

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
| 2026-09-17 | Frontend Agent | Orchestrator | `TASK-020` | Integración de botón de exportación PDF (1 hoja) en Bombas, Ciclones y Descarga con maquetación A4 de página única garantizada |
| 2026-09-17 | Frontend Agent | Orchestrator | `TASK-021` | Motor de exportación y descarga directa a archivo PDF mediante jsPDF y html2canvas sin pasar por diálogos de impresión |
| 2026-09-18 | Orchestrator & QA Agent | Orchestrator | `TASK-022` | Auditoría de fallas y entrega de mejoras: suite de pruebas al 100% (10/10), autenticación tolerante a fallas, restauración de backup en Admin y build optimizado |
| 2026-09-18 | Multi-Agent Team | Orchestrator | `TASK-023` | Entrega de Puntos 1 y 5 en Admin: Gestión Avanzada de Usuarios (búsqueda, filtros guardia/rol, edición rápida, restablecer clave, suspender/activar) y Monitor de Flota de Terminales con revocación remota de sesión |
| 2026-09-19 | Multi-Agent Team | Orchestrator | `TASK-024` | Entrega de Ficha Operacional de Planta en Mi Perfil (DNI, Canal Radial, Anexo Telefónico, Especialidad en Planta, Ficha Rápida lateral y sincronización dual con cuadrilla) |
| 2026-09-19 | Frontend Agent | Orchestrator | `TASK-025` | Unificación de identidad de marca al azul cobalto #031795 en layout, auth, dashboard, administración, reportes A4 y componentes UI con preservación de semáforos operacionales |
| 2026-09-19 | Multi-Agent Team | Orchestrator | `TASK-027` | Auditoría de fallas y robustez: API dinámico, CORS multi-IP para red de planta y manejo resiliente de colas offline |
| 2026-09-19 | Frontend Agent | Orchestrator | `TASK-028` | Despliegue global del isotipo oficial BASETRACK (piocha, montaña y flecha naranja) en favicon, PWA, sidebar, login, modal de instalación y encabezados de reportes PDF |
| 2026-09-20 | Multi-Agent Team | Orchestrator | `TASK-029` | Reestructuración operacional completa a 4 guardias (G1-G4) de 8 personas cada una (1 Supervisor + 7 Operadores específicos: Bombas, Ciclones 1, Ciclones 2, Distribuidor, Descarga 1, Descarga 2, Misceláneos), 32 trabajadores oficiales en plantilla, migraciones SQLite v3 automáticas y compatibilidad total en Cuadrilla, Admin, Relevos, Perfil y Reportes PDF |
| `TASK-030` | Auditoría integral de seguridad y resiliencia lógica | Multi-Agent Team | `TASK-029` | `DONE` | 0/3 | Blindaje de auth, validación en changePassword, compresión canvas y 15/15 tests backend |
| `TASK-031` | Depuración Total de Guardia Activa y Migración Completa a G1–G4 | Multi-Agent Team | `TASK-030` | `DONE` | 0/3 | Purga absoluta de 'Guardia A/B/C' en DB SQLite, controladores, servicios frontend, persistencia local y reportes PDF; normalización automática de caché; 15/15 tests backend y build Angular impecables |
| `TASK-032` | Módulo de Calculadora Metalúrgica y de Operaciones en Terreno | Frontend Agent | `TASK-031` | `DONE` | 0/3 | Módulo con 4 calculadoras de campo (Balanza Marcy, Dosificación de Floculante en L/min y L/h, Dilución de Pulpa y Aforador Parshall), presets de minerales, slider interactivo, guardado local y copia rápida |
| `TASK-033` | Sistema Integral de Modo Oscuro y Diseño Industrial Nocturno | Frontend Agent | `TASK-032` | `DONE` | 0/3 | Arquitectura ThemeService con señales y persistencia; conmutador en Header, Sidebar y Mi Perfil; paleta obsidiana/azul cobalto adaptativa en todo el sistema sin alterar la impresión PDF A4 |

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
| 2026-09-17 | Frontend Agent | Orchestrator | `TASK-020` | Integración de botón de exportación PDF (1 hoja) en Bombas, Ciclones y Descarga con maquetación A4 de página única garantizada |
| 2026-09-17 | Frontend Agent | Orchestrator | `TASK-021` | Motor de exportación y descarga directa a archivo PDF mediante jsPDF y html2canvas sin pasar por diálogos de impresión |
| 2026-09-18 | Orchestrator & QA Agent | Orchestrator | `TASK-022` | Auditoría de fallas y entrega de mejoras: suite de pruebas al 100% (10/10), autenticación tolerante a fallas, restauración de backup en Admin y build optimizado |
| 2026-09-18 | Multi-Agent Team | Orchestrator | `TASK-023` | Entrega de Puntos 1 y 5 en Admin: Gestión Avanzada de Usuarios (búsqueda, filtros guardia/rol, edición rápida, restablecer clave, suspender/activar) y Monitor de Flota de Terminales con revocación remota de sesión |
| 2026-09-19 | Multi-Agent Team | Orchestrator | `TASK-024` | Entrega de Ficha Operacional de Planta en Mi Perfil (DNI, Canal Radial, Anexo Telefónico, Especialidad en Planta, Ficha Rápida lateral y sincronización dual con cuadrilla) |
| 2026-09-19 | Frontend Agent | Orchestrator | `TASK-025` | Unificación de identidad de marca al azul cobalto #031795 en layout, auth, dashboard, administración, reportes A4 y componentes UI con preservación de semáforos operacionales |
| 2026-09-19 | Multi-Agent Team | Orchestrator | `TASK-027` | Auditoría de fallas y robustez: API dinámico, CORS multi-IP para red de planta y manejo resiliente de colas offline |
| 2026-09-19 | Frontend Agent | Orchestrator | `TASK-028` | Despliegue global del isotipo oficial BASETRACK (piocha, montaña y flecha naranja) en favicon, PWA, sidebar, login, modal de instalación y encabezados de reportes PDF |
| 2026-09-20 | Multi-Agent Team | Orchestrator | `TASK-029` | Reestructuración operacional completa a 4 guardias (G1-G4) de 8 personas cada una (1 Supervisor + 7 Operadores específicos: Bombas, Ciclones 1, Ciclones 2, Distribuidor, Descarga 1, Descarga 2, Misceláneos), 32 trabajadores oficiales en plantilla, migraciones SQLite v3 automáticas y compatibilidad total en Cuadrilla, Admin, Relevos, Perfil y Reportes PDF |
| 2026-09-23 | QA, Backend & Frontend | Orchestrator | `TASK-030` | Auditoría integral de seguridad y resiliencia lógica: eliminación de bypass de clave en login/offline auth, verificación estricta de contraseña actual en changePassword, saneamiento de fallbacks de guardia y fecha a G1 e ISO dinámico, unificación de telemetría viva para G1-G4 (32 operadores) en Dashboard, compresión cliente Canvas de fotos de mantenimiento, 15/15 tests automatizados y build de producción exitoso |
| 2026-09-23 | Multi-Agent Team | Orchestrator | `TASK-031` | Saneamiento y purga definitiva de nomenclaturas antiguas (Guardia A, B, C) en DB SQLite, controladores API, servicios Angular, modales de gestión de cuadrilla, reportes PDF y migración de memoria caché de cliente |
| 2026-09-24 | Frontend Agent | Orchestrator | `TASK-032` | Módulo de Calculadora Metalúrgica y de Terreno (/calculators) integrado en Sidebar, con 4 herramientas de planta: Balanza Marcy, Floculante en L/min y L/h, Dilución de Pulpa y Aforador Parshall |
| 2026-09-24 | Frontend Agent | Orchestrator | `TASK-033` | Modo Oscuro / Nocturno industrial con ThemeService reactivo, persistencia en localStorage, conmutador rápido en Header, interruptor en Sidebar, selector en Mi Perfil y diseño adaptativo sin romper reportes PDF A4 |

---

## 6. Registro de Bloqueos y Alertas de Escalamiento a Humano


