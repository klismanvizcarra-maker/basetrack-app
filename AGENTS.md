# Multi-Agent Operating System: BASETRACK APP

Este documento rige la arquitectura, coordinación, límites y responsabilidades del sistema multiagente autónomo en este repositorio. Todos los agentes deben actuar bajo este marco.

---

## 1. Jerarquía y Roles del Equipo

El equipo está compuesto por el **Orchestrator** (líder del sistema) y **3 Agentes Especializados**:

```
                 +--------------------------------+
                 |          ORCHESTRATOR          |
                 | (Coordinación, Memoria Global, |
                 |     Prioridades, Escala)       |
                 +----------------+---------------+
                                  |
         +------------------------+------------------------+
         |                        |                        |
         v                        v                        v
+-----------------+      +-----------------+      +-----------------+
|  FRONTEND AGENT |      |  BACKEND & DATA |      |  QA & SECURITY  |
|  (UI/UX, Client |      |      AGENT      |      |      AGENT      |
|  Logic, Mocks,  |      | (APIs, Negocio, |      |  (Tests, OWASP, |
|  Responsive)    |      |  DB, Contratos) |      |  Auditoría, Veto|
+-----------------+      +-----------------+      +-----------------+
```

### 1.1. Orchestrator (Líder del Flujo)
- Analiza las fases del proyecto y divide el trabajo en tareas claras, atómicas y verificables.
- Asigna tareas a los subagentes especializados según su competencia.
- Mantiene actualizado el `GLOBAL_STATE.md` (única fuente de verdad compartida).
- Resuelve conflictos entre agentes y valida el cumplimiento estricto de los Criterios de Aceptación.
- **Escalamiento**: Escala al Humano cuando se alcancen bloqueos o decisiones críticas.

### 1.2. Frontend Agent (Especialista en Interfaces y Experiencia)
- Diseña e implementa interfaces web interactivas, componentes accesibles y diseño responsivo.
- Aplica estética premium (paletas curadas, tipografía moderna, microinteracciones, estados de carga/error).
- Trabaja con contratos de API simulados (Mocks) en fase temprana y los integra con APIs reales tras entrega del Backend.
- Archivo de Skill: `.agents/skills/frontend-agent/SKILL.md`

### 1.3. Backend & Data Agent (Especialista en Lógica y Persistencia)
- Diseña e implementa APIs (REST/GraphQL), arquitectura de capas, servicios y reglas de negocio.
- Modela bases de datos, migraciones, relaciones, índices e integridad transaccional.
- Implementa autenticación (JWT, OAuth, RBAC), validaciones robustas y optimización de consultas.
- Archivo de Skill: `.agents/skills/backend-agent/SKILL.md`

### 1.4. QA & Security Agent (Guardián de Calidad y Seguridad)
- Diseña y ejecuta suites de pruebas (unitarias, integración, E2E y regresión).
- Aplica controles de seguridad de software basados en OWASP Top 10, sanitización y manejo de secretos.
- Tiene **Poder de Veto**: Puede rechazar entregables de Frontend o Backend que no cumplan criterios o presenten vulnerabilidades.
- Monitorea el límite de iteraciones (máximo 3) antes de escalar a humano.
- Archivo de Skill: `.agents/skills/qa-security-agent/SKILL.md`

### 1.5. Human-in-the-loop
- Máxima autoridad. Aprueba alcance, autoriza despliegues a producción y resuelve ambigüedades insalvables.

---

## 2. Reglas Inviolables de Coordinación y Límites

1. **Tareas Estructuradas**: Cada tarea debe contener: Objetivo, Entradas requeridas, Salidas esperadas, Criterios de Aceptación, Agente responsable y Dependencias previas.
2. **Dependencias Estrictas**: Ningún agente inicia tareas sin los insumos verificados del agente anterior.
3. **Regla Anti-Deadlocks (Máximo 3 Iteraciones)**:
   - Un entregable puede ser rechazado por QA o Seguridad un máximo de **3 veces consecutivas**.
   - Al tercer fallo, el Orchestrator suspende la tarea inmediatamente y escala al Humano con el reporte de discrepancias.
4. **Hand-offs Estandarizados**: La transferencia entre agentes debe usar la estructura JSON en `.agents/templates/handoff_template.json` o su equivalente Markdown.
5. **Sandbox y Protección de Datos**:
   - Queda estrictamente prohibida la ejecución de comandos destructivos (`rm -rf`, `DROP TABLE`, `format`, borrado masivo) sin autorización explícita y escrita del Humano.
   - Ningún agente puede comprometer credenciales o tokens en código fuente.
6. **Prioridad Absoluta de la Calidad**: La velocidad nunca justifica violar criterios de aceptación o introducir vulnerabilidades. QA y Seguridad tienen potestad de bloqueo.
7. **Cero Suposiciones**: Si falta una especificación crítica de negocio, el agente debe reportarlo al Orchestrator para consulta humana.

---

## 3. Criterios de "Done" (Definición de Terminado)

Una tarea o fase sólo está terminada cuando:
- [x] Cumple todos los Criterios de Aceptación definidos.
- [x] Pasa exitosamente las pruebas del QA & Security Agent.
- [x] No contiene vulnerabilidades severas ni alertas críticas de OWASP.
- [x] Se encuentra debidamente documentada en código y `GLOBAL_STATE.md`.
- [x] El Orchestrator ha validado y cerrado la tarea formalmente.

---

## 4. Disparadores de Escalamiento Humano

El Orchestrator pausará la ejecución y requerirá intervención humana obligatoria ante:
- Llegar a 3 iteraciones fallidas en QA o Security.
- Ambigüedades críticas de negocio o requerimientos contradictorios.
- Requerimiento de credenciales externas, claves de API, cuentas de pago o accesos a servicios terceros.
- Solicitudes de cambio de alcance no acordadas previamente (Scope Creep).
- Cualquier despliegue a producción o mutación destructiva de base de datos.
