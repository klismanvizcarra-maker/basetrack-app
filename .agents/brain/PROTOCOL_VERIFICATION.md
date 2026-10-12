# Protocolo de Verificación Pre-Edición y Criterio de Terminado
## BASETRACK APP - Reglas Inviolables del Cerebro de Proyecto

Cualquier agente (Frontend, Backend, QA o el propio Orchestrator) debe cumplir este protocolo de 4 pasos antes y después de cualquier intervención.

---

### Paso 1: Lectura Obligatoria de Contexto ("Read-Before-Write")
Antes de modificar cualquier archivo en un módulo:
1. **Verificar el Gotchas Log**: Revisar [`.agents/brain/GOTCHAS_LOG.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/GOTCHAS_LOG.md) para confirmar que la nueva modificación no reactiva un bug histórico.
2. **Consultar las Decisiones de Arquitectura**: Revisar [`.agents/brain/ADR_REGISTRY.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/ADR_REGISTRY.md) para respetar los patrones de turnos (8x8, UTC-5), persistencia y sincronización.
3. **Validar Claves y Contratos**: Revisar [`.agents/brain/DATA_MAP.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/.agents/brain/DATA_MAP.md) para utilizar exactamente las claves de almacenamiento y tipos de datos requeridos.

---

### Paso 2: Ejecución Segura
- Mantener intactos los comentarios, docstrings y formatos existentes.
- Utilizar siempre enlaces markdown clickeables con esquema `file://` para archivos y símbolos.
- **Prohibido terminantemente**:
  - Comandos destructivos (`rm -rf`, `DROP TABLE`, mutaciones masivas).
  - Hardcodear nombres de personas fuera del administrador raíz oficial (`Marckv` / `91209966`).
  - Bypass de autenticación o introducción de credenciales en texto plano.

---

### Paso 3: Suite de Control de Calidad y Cero Regresiones
Al finalizar cualquier cambio, es **obligatorio** ejecutar el protocolo unificado:
```bash
npm run verify
```
Este comando ejecuta de forma secuencial:
1. **Tests del Backend**: `npm run backend:test` (26 de 26 tests pasando al 100%, 0 errores).
2. **Compilación del Frontend**: `npm run build` (Compilación limpia de Angular 19, código de salida 0).

---

### Paso 4: Cierre y Actualización de Memoria
1. Registrar la tarea como `DONE` en [`GLOBAL_STATE.md`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK APP/GLOBAL_STATE.md).
2. Si se descubrió una nueva regla de negocio, agregar el ADR correspondiente en `ADR_REGISTRY.md`.
3. Si se corrigió una falla sutil o caso borde, registrar el aprendizaje en `GOTCHAS_LOG.md`.
