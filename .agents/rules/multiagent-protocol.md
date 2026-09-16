# Protocolo Multiagente de BASETRACK APP

Este archivo formaliza los protocolos de comunicación, formato de traspaso (hand-off), ciclo de iteraciones y políticas de veto de calidad y seguridad.

---

## 1. Ciclo de Vida de una Tarea

```
[ BACKLOG / PENDING ]
         | (Orchestrator asigna con inputs completos)
         v
  [ IN_PROGRESS ] (Frontend o Backend implementan)
         |
         | (Hand-off con entregables y mocks listos)
         v
 [ IN_REVIEW_QA ] (QA Agent ejecuta suite de pruebas)
      /      \
 (Pasa)     (Falla: iteración++)
    /          \
   v            v
[ IN_REVIEW_SEC ]  -> Si iteración <= 3: Reasigna con Bug Report
   |                   -> Si iteración > 3: ESCALAR A HUMANO (STOP)
   | (Auditoría OWASP)
   v
 [ DONE ] (Validación final por Orchestrator)
```

---

## 2. Formato Estándar de Hand-off

Cada traspaso de código o información entre agentes debe documentarse con el siguiente esquema:

```json
{
  "taskId": "TASK-001",
  "fromAgent": "frontend-agent",
  "toAgent": "qa-security-agent",
  "timestamp": "2026-09-14T12:00:00Z",
  "inputsReceived": [
    "API mock contract v1.0",
    "Figma/Design token specifications"
  ],
  "outputsGenerated": [
    "src/components/Dashboard.jsx",
    "src/styles/dashboard.css"
  ],
  "verificationDone": "Component renders, responsive test passed on 375px and 1440px",
  "notesForNextAgent": "Se mockea el endpoint GET /api/v1/metrics en dev. Probar interacción de filtros.",
  "iterationNumber": 1
}
```

---

## 3. Protocolo de Veto (QA & Security)

1. **Rechazo por Defectos Funcionales (QA)**:
   - QA no repara el código directamente si la tarea está en fase de desarrollo por otro agente; emite un `Bug Report` con pasos de reproducción exactos, severidad y comportamiento esperado.
   - El Orchestrator suma `+1` al contador de iteraciones de la tarea.
2. **Rechazo por Vulnerabilidades (Security)**:
   - Cualquier detección de credenciales en duro, vulnerabilidades XSS, SQLi, CSRF o dependencias comprometidas otorga derecho de veto inmediato.
3. **Escalamiento Obligatorio por Deadlock**:
   - Si `iterationNumber > 3`, el Orchestrator bloquea la tarea (`BLOCKED`), genera un reporte comparativo del historial de fallos y notifica al usuario humano.

---

## 4. Políticas de Seguridad de Comandos (Sandbox)

- Quedan prohibidos comandos con impacto irreversible:
  - `rm -rf /` o borrados recursivos indiscriminados.
  - `DROP DATABASE` o `DROP TABLE` sin migración reversible y autorización expresa.
  - Publicación directa a ramas de producción o repositorios remotos sin confirmación.
