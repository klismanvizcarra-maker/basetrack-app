# Bitácora de Trampas, Errores Históricos y Gotchas (Gotchas Log)
## BASETRACK APP - Catálogo de Regresiones Evitadas

Este documento contiene los errores sutiles, condiciones de carrera y trampas de lógica ya resueltos en el repositorio. **Cualquier agente debe consultar esta lista antes de modificar código para no volver a introducir estos fallos.**

---

### Gotcha #1: Bucle de Eco (Ping-Pong) en Sincronización en Tiempo Real
- **Síntoma**: Congelamiento de pestañas, ráfagas de 50+ peticiones por segundo en red local o saturación de la cola IndexedDB.
- **Causa Raíz**: `CloudSyncService.applyRemoteEvent()` o `handleBroadcastMessage()` llamaban a `saveRealtimeData()`, el cual disparaba el evento DOM `basetrack_local_change`. El listener local interpretaba este cambio como generado por el usuario y lo retransmitía por el `BroadcastChannel` y a la cola del servidor.
- **Solución Obligatoria**: Usar siempre `{ skipBroadcast: true }` cuando se persistan datos recibidos de fuentes remotas o de otras pestañas:
  ```ts
  saveRealtimeData(key, data, { skipBroadcast: true });
  ```

---

### Gotcha #2: Promedios Metalúrgicos Arrastrados a Cero por Slots Vacíos
- **Síntoma**: Un turno con excelente granulometría (ej. 81.5% -200M) mostraba 20.3% en el reporte de cierre de guardia.
- **Causa Raíz**: El método `computeAverages` dividía `sumaTotal / samples.length`. Si solo 2 de 8 muestras habían sido ensayadas en malla -200, las 6 celdas con 0 desvirtuaban el promedio aritmético.
- **Solución Obligatoria**: Contar de forma independiente para cada variable las muestras válidas (`val > 0`):
  ```ts
  const avg = count > 0 ? Number((total / count).toFixed(2)) : 0;
  ```

---

### Gotcha #3: Sobrescritura de la Planilla de Bombas de Ayer al Entrar Hoy
- **Síntoma**: Un operador empezaba a llenar la planilla del día actual y al guardar, destruía la planilla del turno anterior.
- **Causa Raíz**: Si para la fecha consultada (`?date=2026-10-09`) no había registro en la base de datos, el backend hacía un fallback a la última planilla disponible (`2026-10-08`) devolviendo el ID y fecha antigua. El frontend adoptaba ese ID y fecha, por lo que el autosave actualizaba el registro de ayer.
- **Solución Obligatoria**:
  - En backend: Si se usa fallback para sugerir estados de bombas, retornar `id: undefined`, `report_date: requestedDate`, `shift_code: requestedShift`.
  - En frontend: Preservar `targetDate` y `targetShift` seleccionados por el usuario y pasar `&shift=...` en la URL.

---

### Gotcha #4: Desfase UTC-5 a las 19:00 en Turno Noche Minero
- **Síntoma**: Muestras tomadas a las 20:00 o 23:00 quedaban registradas con la fecha de "mañana", rompiendo la trazabilidad del turno noche.
- **Causa Raíz**: En Perú (UTC-5), `new Date().toISOString().split('T')[0]` cambia de fecha a las 19:00 hora local porque en UTC ya son las 00:00 del día siguiente.
- **Solución Obligatoria**: Usar siempre `getCurrentActiveShift().dateStr` o `getLocalDateString()` de [`roster.util.ts`](file:///Users/klismanvizcarra/Desktop/PROYECTOS/BASETRACK%20APP/src/app/shared/utils/roster.util.ts).

---

### Gotcha #5: Auto-Asignación de Cuadrilla Dejaba al Supervisor sin Asignar
- **Síntoma**: Al hacer clic en "Limpiar Tablero" y luego "Auto-Asignar", las 8 posiciones de operadores se llenaban correctamente pero la tarjeta de Supervisor quedaba en blanco.
- **Causa Raíz**: El diccionario `roleMapping` en `crew-management.component.ts` solo iteraba sobre las 8 posiciones de campo, omitiendo `'SUPERVISOR': staff.supervisor.id`.
- **Solución Obligatoria**: Incluir `'SUPERVISOR'` explícitamente en el mapa de autoasignación.

---

### Gotcha #6: Descarte del Parámetro `returnUrl` en `LoginComponent`
- **Síntoma**: Si un usuario intentaba ingresar directo a `/calculators` o `/admin`, la app lo mandaba a `/login` pero tras autenticarse lo enviaba siempre a `/dashboard`.
- **Causa Raíz**: Navegación hardcodeada con `this.router.navigate(['/dashboard'])` sin leer `route.snapshot.queryParams['returnUrl']`.
- **Solución Obligatoria**: Inyectar `ActivatedRoute` y usar `this.router.navigateByUrl(this.route.snapshot.queryParams['returnUrl'] || '/dashboard')`.

---

### Gotcha #7: Parámetros Perdidos al Guardar y Cargar Calculadoras Metalúrgicas
- **Síntoma**: Al cambiar de pestaña en la calculadora, la Gravedad Específica (`Gs`) o la concentración madre volvían al valor por defecto, borrando la calibración del metalurgista.
- **Causa Raíz**: `flocGs`, `flocMotherConcPct` y `dilGs` estaban omitidos en `saveState()`, `loadSavedState()` y `resetActiveCalculator()`.
- **Solución Obligatoria**: Registrar y restaurar todas las propiedades activas de la vista en `saveRealtimeData('calc_state', data)`.

---

### Gotcha #8: Sobrescritura del Operador de Relaves por el Usuario de Sesión
- **Síntoma**: Un supervisor en Sala de Control ingresaba el reporte del operador de presa "Juan Quispe", pero el sistema guardaba el nombre del supervisor.
- **Causa Raíz**: El controlador `tailings.controller.ts` priorizaba `req.user?.fullName` sobre `req.body.operator_name`.
- **Solución Obligatoria**: Dar prioridad al operador explícito del formulario:
  ```ts
  const operatorName = req.body.operator_name || req.user?.fullName || 'Operador de Presa';
  ```

---

### Gotcha #9: Congelamiento de Botón y Modal en Carga Masiva de Personal CSV
- **Síntoma**: Al confirmar la importación del CSV, el botón quedaba indefinidamente en *"Importando y vinculando a supervisores..."*, el modal no se cerraba y la interfaz no respondía.
- **Causa Raíz**:
  1. Falta de `finalize()` en el observable RxJS: si ocurría timeout, cancelación o excepción, `isImporting` nunca regresaba a `false`.
  2. `openBulkModal()` no reseteaba `isImporting = false`, manteniendo el estado congelado si el modal se volvía a abrir tras un error.
  3. Ausencia de `ChangeDetectorRef.detectChanges()` tras la respuesta HTTP, haciendo que Angular no repintara el cierre del modal.
  4. En backend (`admin.controller.ts`), `bcrypt.hashSync` se ejecutaba 36 veces de forma síncrona en el bucle bloqueando el Event Loop por 2.5s, incluso para usuarios que ya existían y no requerían actualizar contraseña.
- **Solución Obligatoria**:
  1. Usar `pipe(timeout(10000), finalize(() => { this.isImporting = false; this.cdr.detectChanges(); }))`.
  2. Resetear siempre `this.isImporting = false` y `this.cdr.markForCheck()` dentro de `openBulkModal()`.
  3. Cachear el hash de la contraseña por defecto (`Basetrack2026!`) en el backend y no hashear contraseñas en usuarios existentes que solo se actualizan.

---

### Gotcha #10: Fuga de Memoria y Ráfagas Duplicadas por Listeners Huérfanos de `basetrack_cloud_sync`
- **Síntoma**: Al navegar repetidamente entre vistas operacionales (ej. Bombas -> Ciclones -> Relaves -> Bombas), cada evento WebSocket recibido disparaba 4 o más recargas simultáneas de la misma vista, degradando el rendimiento del cliente.
- **Causa Raíz**: En Angular SPA, los componentes que escuchan `window.addEventListener('basetrack_cloud_sync', handler)` retienen la referencia en el objeto global `window` si no la remueven explícitamente al destruirse.
- **Solución Obligatoria**: Guardar la referencia exacta de la función y desuscribirla en `ngOnDestroy`:
  ```ts
  private syncListener = () => this.refreshData();
  
  ngOnInit() {
    window.addEventListener('basetrack_cloud_sync', this.syncListener);
  }
  
  ngOnDestroy() {
    window.removeEventListener('basetrack_cloud_sync', this.syncListener);
  }
  ```

---

### Gotcha #11: Necesidad de Recargar la Página (F5) para Ver Cambios en Tiempo Real
- **Síntoma**: Al marcar una bomba en "Falla", o atender una orden en Mantenimiento, o emitir un Pase Operativo, la interfaz de la pestaña activa o de vistas adyacentes no se actualizaba automáticamente a menos que el usuario pulsara F5.
- **Causas Raíz Identificadas**:
  1. **Falta de difusión intra-pestaña**: `saveRealtimeData()` sólo emitía `basetrack_local_change` hacia `CloudSyncService` para enviar por WebSocket / BroadcastChannel a *otros* clientes. Como el servidor omite al emisor para evitar bucles de eco (`deviceId === event.deviceId`) y `BroadcastChannel` no notifica a la pestaña emisora, los componentes de la pestaña activa jamás recibían el evento `basetrack_cloud_sync`.
  2. **Ejecución fuera del Change Detection Loop (NgZone)**: Los listeners suscritos a eventos nativos del DOM (`window.addEventListener('basetrack_cloud_sync')`) y callbacks asíncronos se ejecutaban fuera de la zona reactiva de Angular, actualizando los datos en memoria JS pero sin forzar el re-renderizado del template visual.
  3. **Discrepancia en Formato de Fecha**: `pumps.component.ts` inicializaba `report_date: new Date().toLocaleDateString('es-PE')` (`"11/10/2026"`), mientras que Mantenimiento y SQLite consultaban en formato ISO (`"2026-10-11"`). Al sincronizar o recargar, las claves no coincidían y se sobreescribía con planillas vacías por defecto.
  4. **Omisión de persistencia HTTP en creación automática de OT**: Al pasar una bomba a falla, sólo se guardaba en el almacenamiento local sin enviar `POST /api/maintenance`, haciendo que cualquier consulta posterior a la BD sobreescribiera la lista borrando la OT.
- **Solución Obligatoria**:
  1. En `local-store.util.ts`: Emitir siempre `basetrack_cloud_sync` con `{ source: 'local' }` ante cualquier mutación local (notificación instantánea 0ms intra-pestaña).
  2. En todos los componentes reactivos (`PumpsComponent`, `MaintenanceComponent`, `DashboardComponent`, `TailingsComponent`, `CyclonesComponent`, `ShiftHandoverComponent`): Inyectar `ChangeDetectorRef` y `NgZone`, ejecutar `syncListener` dentro de `this.ngZone.run()` y llamar `this.cdr.markForCheck()` y `this.cdr.detectChanges()`.
  3. Normalizar todas las fechas al estándar ISO `YYYY-MM-DD` mediante `getCurrentActiveShift().dateStr`.
  4. En `pumps.controller.ts`: Normalizar `report_date` y `shift_code` en consultas y guardado para tolerar formatos con barra o desalineados.

---

### Gotcha #12: Truncamiento de Tabla de Bombas & Botones Grises por Sobrescritura de Arreglos en WebSocket Sync
- **Síntoma**: En la Planilla de Bombas (Sección A), PU001/PU011/PU021 aparecían en verde `Operativo`, mientras que PU002/PU012/PU022 se mostraban como óvalos grises sin texto y todas las filas siguientes (PU003 a PU008, PU013 a PU016, PU023 a PU030) desaparecían dejando celdas vacías, a pesar de que el chip inferior indicaba "7 / 8 Operando".
- **Causa Raíz**:
  1. **Sobrescritura de Arreglo por Objeto Individual**: Al crearse una orden de trabajo por falla de bomba, el backend emitía un evento WebSocket con `key: 'basetrack_maintenance_tickets'` y `data: { id: ..., ticket_number: ... }` (un objeto único). `CloudSyncService` guardaba este objeto directamente en `localStorage['basetrack_maintenance_tickets']`, sobreescribiendo el arreglo de tickets con un único objeto.
  2. **Error No Capturado en Template**: Al evaluar la fila 1 en el template (`isLockedByMaintenance(sheet.sentina_pumps[idx])`), la función leía `tickets = getRealtimeData('maintenance_tickets', [])`. Al ser un objeto y no un arreglo, `tickets.some(...)` arrojaba `TypeError: tickets.some is not a function`, lo que abortaba inmediatamente el ciclo de renderizado de Angular para el resto de la tabla.
  3. **Listas Truncadas en Pruebas**: Cuando suites de pruebas o clientes guardaban planillas con solo 1 o 2 bombas (ej. `sentina_pumps: [{ tag: 'PU001' }]`), el backend persistía listas incompletas.
- **Solución Obligatoria**:
  1. En `CloudSyncService`: Si `key` o `storageKey` incluye `'maintenance_tickets'`, verificar si `data` es un arreglo o un objeto individual; si es un objeto, fusionarlo/anteponerlo en el arreglo existente (`list.unshift(data)`), nunca reemplazar el arreglo por un objeto.
  2. En `pumps.controller.ts`: Fusionar siempre las bombas entrantes con las 24 bombas oficiales predeterminadas (`mergeWithDefaults`), garantizando siempre 8 en Sentina, 6 en Intermedia y 10 en Torre 5.
  3. En `pumps.component.ts`: Método `ensureCompletePumps()` ejecutado en `ngOnInit` y `loadOperationalSheet()` que auto-completa cualquier bomba ausente. `isLockedByMaintenance` con try/catch y auto-reparación de tipos corruptos en `localStorage`.
