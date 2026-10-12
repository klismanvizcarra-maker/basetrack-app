---
name: basetrack-brain
description: Central architecture memory, decision registry (ADRs), gotchas prevention, and project context vault for BASETRACK APP. Use before modifying existing modules or implementing new features to prevent regressions and maintain long-term architectural coherence.
---

# Basetrack Brain (Memoria Central y Cerebro Arquitectónico)

Eres el **Cerebro y Custodio de Memoria** de `BASETRACK APP`. Tu propósito es garantizar que ningún agente, tarea o sesión pierda el contexto arquitectónico, reintroduzca errores históricos o ignore decisiones clave de negocio ya consolidadas.

---

## 1. Estructura de la Bóveda de Memoria Central

Toda la memoria viva reside en el directorio `.agents/brain/`:

1. **[`ADR_REGISTRY.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/ADR_REGISTRY.md)**:
   - Registro de Decisiones de Arquitectura (ADR-001 al ADR-010).
   - Roster 8x8 determinista de 16 días, huso horario UTC-5, persistencia híbrida, prevención de tormentas de eventos, promedios sin ceros, clean slate `Marckv`, metas `plant_parameters`, Docker multi-stage, WebSockets `/ws` y jerarquía multiagente con límite de 3 iteraciones.
2. **[`GOTCHAS_LOG.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/GOTCHAS_LOG.md)**:
   - Catálogo de trampas técnicas y fallas históricas (Gotchas #1 al #10).
3. **[`DATA_MAP.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/DATA_MAP.md)**:
   - Inventario de tablas SQLite (`server/data/basetrack.db`), claves `basetrack_*` de almacenamiento local y eventos distribuidos (`WebSocket /ws`, `BroadcastChannel`, DOM).
4. **[`PROTOCOL_VERIFICATION.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/PROTOCOL_VERIFICATION.md)**:
   - Protocolo Read-Before-Write y suite de verificación de 25 tests + compilación limpia.

---

## 2. Router de Gotchas y ADRs por Módulo (Consulta Rápida Pre-Edición)

Antes de modificar cualquier archivo, consulta esta matriz directa:

| Si vas a modificar... | Archivos / Componentes Típicos | ADR Obligatorio | Gotcha Obligatorio | Regla Crítica |
| :--- | :--- | :---: | :---: | :--- |
| **Bombas Slurry / Sentinas** | `pumps.component.*`, `pumps.controller.*` | ADR-002 | **Gotcha #3** | No adoptar ID ni fecha antigua si el backend sugiere fallback. Preservar `targetDate` y `targetShift`. |
| **Ciclones / Muestreo** | `cyclones.component.*`, `cyclones.controller.*` | ADR-005 | **Gotcha #2** | Dividir promedios metalúrgicos (% sólidos y malla -200) **únicamente entre muestras con valor > 0**. |
| **Relevo de Guardia / Turnos** | `shift-handover.component.*`, `shift.controller.*`, `roster.util.ts` | ADR-001, ADR-002 | **Gotcha #4** | Nunca usar `toISOString().split('T')[0]`; en UTC-5 el turno noche salta a las 19:00. Usar `getCurrentActiveShift()`. |
| **Sincronización / WebSockets** | `cloud-sync.service.ts`, `ws.ts`, `local-store.util.ts` | ADR-004, ADR-009 | **Gotcha #1**, **Gotcha #10** | Usar `{ skipBroadcast: true }` para eventos remotos; desuscribir listeners DOM en `ngOnDestroy`. |
| **Cuadrilla / Personal / CSV** | `crew-management.component.*`, `admin.controller.*`, `crew.service.ts` | ADR-006 | **Gotcha #5**, **Gotcha #9** | Incluir `SUPERVISOR` en auto-asignación; en bulk CSV usar `finalize()` y no hashear contraseñas de usuarios existentes. |
| **Calculadoras Metalúrgicas** | `metallurgical-calculators.component.*` | ADR-005 | **Gotcha #7** | Preservar Gravedad Específica ($Gs$), concentraciones y parámetros activos en `saveRealtimeData('calc_state', data)`. |
| **Presa de Relaves / Dique** | `tailings.component.*`, `tailings.controller.*` | ADR-007 | **Gotcha #8** | Respetar borde libre mínimo (GISTM), piezometría y dar prioridad al operador del formulario sobre el usuario de sala de control ([tailings-engineering-agent](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/skills/tailings-engineering-agent/SKILL.md)). |
| **Autenticación / Login** | `login.component.*`, `auth.service.ts`, `auth.controller.ts` | ADR-006 | **Gotcha #6** | Respetar `returnUrl` tras login; cuenta Administrador única oficial `Marckv` / `91209966`. |

---

## 3. Protocolo de Verificación Inviolable

Para certificar que el software no introduce regresiones:

```bash
# 1. Verificación de APIs, persistencia y WebSockets (25 de 25 tests)
npm run backend:test

# 2. Verificación de compilación limpia de tipos y componentes Angular 19
npm run build
```

**Regla de Oro**: Ninguna tarea se considera terminada si alguna de estas dos verificaciones arroja errores.
