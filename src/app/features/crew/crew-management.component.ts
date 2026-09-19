import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CrewService, CrewMember, CrewAreaAssignment, PositionKey, CrewPositionMeta } from '../../core/services/crew.service';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-crew-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ModalComponent],
  template: `
    <div class="crew-page animate-fade-in">
      <!-- Top Title & Global Controls -->
      <div class="page-top-bar">
        <div class="title-group">
          <div class="title-with-badge">
            <h2>Gestión de Cuadrilla & Asignación de Planta</h2>
            <span class="coverage-pill" [class.full-coverage]="coverageCount === positionsList.length">
              <span class="pulse-dot"></span>
              {{ coverageCount }} / {{ positionsList.length }} Posiciones Cubiertas ({{ (coverageCount / (positionsList.length || 1)) * 100 | number:'1.0-0' }}% Dotación)
            </span>
          </div>
          <p class="section-sub">
            Control en tiempo real de dotación operativa, verificación de EPP y charla de 5 minutos en todas las áreas de planta
          </p>
        </div>

        <div class="top-actions-cluster">
          <button type="button" class="btn btn-secondary" (click)="openCreatePositionModal()" title="Crear y agregar una nueva posición operativa al tablero">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span>+ Nueva Posición</span>
          </button>

          <button type="button" class="btn btn-secondary" (click)="validateAllEppAndTalk()" title="Validar EPP y Charla de 5 min en todas las posiciones">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Validar Todo EPP ({{ positionsList.length }}/{{ positionsList.length }})</span>
          </button>

          <button type="button" class="btn btn-primary" (click)="openCreateModal()" title="Registrar nuevo operador en la nómina general">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Nuevo Operador</span>
          </button>
        </div>
      </div>

      <!-- Shift Selector & Status Filter Bar -->
      <div class="shift-filter-panel glass-panel">
        <div class="filter-group">
          <label class="filter-label">Guardia Activa:</label>
          <div class="guard-tabs">
            <button
              type="button"
              class="guard-tab-btn"
              [class.active]="selectedShift === 'GUARDIA_A'"
              (click)="selectShift('GUARDIA_A')"
            >
              Guardia A
            </button>
            <button
              type="button"
              class="guard-tab-btn"
              [class.active]="selectedShift === 'GUARDIA_B'"
              (click)="selectShift('GUARDIA_B')"
            >
              Guardia B
            </button>
            <button
              type="button"
              class="guard-tab-btn"
              [class.active]="selectedShift === 'GUARDIA_C'"
              (click)="selectShift('GUARDIA_C')"
            >
              Guardia C
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Turno:</label>
          <div class="shift-type-tabs">
            <button
              type="button"
              class="type-tab-btn"
              [class.active]="selectedShiftType === 'DIA'"
              (click)="selectShiftType('DIA')"
            >
              ☀️ Día (07:00 - 19:00)
            </button>
            <button
              type="button"
              class="type-tab-btn"
              [class.active]="selectedShiftType === 'NOCHE'"
              (click)="selectShiftType('NOCHE')"
            >
              🌙 Noche (19:00 - 07:00)
            </button>
          </div>
        </div>

        <div class="filter-group date-picker-group">
          <label class="filter-label">Fecha de Turno:</label>
          <input
            type="date"
            class="filter-date-input"
            [(ngModel)]="selectedDate"
            (change)="onDateChange()"
          />
        </div>

        <div class="filter-kpi-block">
          <div class="kpi-mini-item">
            <span class="kpi-label">Personal Activo</span>
            <span class="kpi-val">{{ activeCrewCount }} en turno</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-label">Cumplimiento EPP</span>
            <span class="kpi-val text-success">{{ eppCompliancePercent }}%</span>
          </div>
        </div>
      </div>

      <!-- THE OPERATIONAL POSITIONS BOARD (PIZARRA INTERACTIVA) -->
      <div class="section-divider-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        <span>TABLERO DE ASIGNACIÓN EN TIEMPO REAL ({{ positionsList.length }} POSICIONES OPERATIVAS)</span>
      </div>

      <div class="positions-grid">
        <div
          *ngFor="let pos of positionsList"
          class="position-card glass-panel"
          [ngClass]="pos.badgeClass || 'card-custom'"
        >
          <!-- Card Header -->
          <div class="pos-card-header">
            <div class="pos-header-left">
              <span class="pos-icon" [innerHTML]="pos.iconSvg"></span>
              <div>
                <div class="pos-title-row">
                  <h3 class="pos-title">{{ pos.title }}</h3>
                  <span class="badge-custom-pill" *ngIf="pos.isCustom">NUEVA ÁREA</span>
                </div>
                <span class="pos-location">{{ getAssignment(pos.key)?.station_location || pos.defaultLocation }}</span>
              </div>
            </div>
            <span class="radio-pill" title="Canal de frecuencia de radio en planta">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"></path>
              </svg>
              {{ getAssignment(pos.key)?.radio_channel || pos.defaultRadio }}
            </span>
          </div>

          <!-- Titular Operator Selector -->
          <div class="pos-operator-select-box">
            <label class="operator-field-label">Operador Titular Asignado:</label>
            <div class="operator-dropdown-wrapper">
              <select
                class="operator-select"
                [ngModel]="getAssignment(pos.key)?.operator_id"
                (ngModelChange)="onAssignOperator(pos.key, $event)"
              >
                <option [ngValue]="null" disabled>-- Seleccionar Operador Titular --</option>
                <optgroup [label]="'Operadores ' + selectedShift + ' (En Turno Recomendados)'">
                  <option *ngFor="let m of activeShiftMembers" [value]="m.id">
                    {{ m.name }} ({{ formatRoleName(m.primary_role) }})
                  </option>
                </optgroup>
                <optgroup label="Todos los Operadores de Planta">
                  <option *ngFor="let m of otherShiftMembers" [value]="m.id">
                    {{ m.name }} ({{ formatRoleName(m.primary_role) }} - {{ m.shift_code }})
                  </option>
                </optgroup>
              </select>
            </div>

            <!-- Operator Profile Snapshot -->
            <div class="operator-snapshot" *ngIf="getOperator(getAssignment(pos.key)?.operator_id) as op">
              <img [src]="op.avatar_url" [alt]="op.name" class="operator-avatar" />
              <div class="operator-meta">
                <span class="op-name">{{ op.name }}</span>
                <span class="op-doc">DNI: {{ op.document_id }} | {{ op.phone_extension || 'Sin Anexo' }}</span>
              </div>
              <span class="op-status-badge" [class.en-turno]="op.status === 'EN_TURNO'">
                {{ op.status === 'EN_TURNO' ? 'En Puesto' : op.status }}
              </span>
            </div>
          </div>

          <!-- Backup / Relevo Operator Selector -->
          <div class="pos-backup-select-box" *ngIf="pos.key !== 'RELEVO'">
            <label class="operator-field-label">Operador de Soporte / Relevo:</label>
            <select
              class="operator-select-sm"
              [ngModel]="getAssignment(pos.key)?.backup_operator_id"
              (ngModelChange)="onAssignBackup(pos.key, $event)"
            >
              <option [ngValue]="null">-- Sin Relevo Asignado --</option>
              <optgroup [label]="'Personal ' + selectedShift">
                <option *ngFor="let m of activeShiftMembers" [value]="m.id">
                  {{ m.name }} ({{ formatRoleName(m.primary_role) }})
                </option>
              </optgroup>
              <optgroup label="Otros Operadores de Planta">
                <option *ngFor="let m of otherShiftMembers" [value]="m.id">
                  {{ m.name }} ({{ formatRoleName(m.primary_role) }} - {{ m.shift_code }})
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Check-in Toggles (EPP & 5 Min Safety Talk) -->
          <div class="pos-checks-row">
            <button
              type="button"
              class="check-pill"
              [class.checked]="getAssignment(pos.key)?.epp_verified === 1"
              (click)="toggleEpp(pos.key)"
              title="Confirmar inspección de EPP completo (Casco, lentes, botas, respirador, chaleco)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>🦺 EPP Verificado</span>
            </button>

            <button
              type="button"
              class="check-pill"
              [class.checked]="getAssignment(pos.key)?.safety_talk_completed === 1"
              (click)="toggleSafetyTalk(pos.key)"
              title="Confirmar participación en Charla de 5 minutos de inicio de guardia"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>📋 Charla 5 Min</span>
            </button>
          </div>

          <!-- Card Footer & Module Link -->
          <div class="pos-card-footer">
            <div class="pos-notes-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>{{ getAssignment(pos.key)?.notes || pos.description }}</span>
            </div>

            <div class="pos-footer-actions">
              <button
                type="button"
                class="btn-edit-notes"
                (click)="openEditAssignmentModal(pos.key)"
                title="Editar consignas o ubicación específica"
              >
                ✏️ Editar
              </button>

              <button
                *ngIf="pos.isCustom"
                type="button"
                class="btn-delete-pos"
                (click)="onDeletePosition(pos)"
                title="Eliminar esta posición personalizada de la cuadrilla"
              >
                🗑️ Eliminar
              </button>

              <a
                *ngIf="pos.routeLink"
                [routerLink]="pos.routeLink"
                class="module-direct-link"
              >
                <span>{{ pos.routeLabel }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- DIRECTORY OF CREW MEMBERS (NÓMINA DE PERSONAL) -->
      <div class="roster-section glass-panel">
        <div class="roster-header">
          <div class="roster-title-block">
            <h3>Directorio y Nómina de Cuadrilla ({{ filteredCrew.length }} Operadores)</h3>
            <p class="text-muted">Personal registrado para relevos, descansos médicos y asignaciones de guardia</p>
          </div>

          <div class="roster-filter-tabs">
            <button
              type="button"
              class="tab-btn"
              [class.active]="rosterFilter === 'ALL'"
              (click)="rosterFilter = 'ALL'"
            >
              Todos ({{ crewService.allMembers().length }})
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="rosterFilter === 'EN_TURNO'"
              (click)="rosterFilter = 'EN_TURNO'"
            >
              En Puesto / Turno
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="rosterFilter === 'DESCANSO'"
              (click)="rosterFilter = 'DESCANSO'"
            >
              Descanso
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="roster-table">
            <thead>
              <tr>
                <th>OPERADOR</th>
                <th>DNI / CÓDIGO</th>
                <th>ESPECIALIDAD / ROL</th>
                <th>GUARDIA</th>
                <th>CANAL DE RADIO</th>
                <th>ANEXO</th>
                <th>ESTADO</th>
                <th>PUESTO ASIGNADO</th>
                <th class="text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of filteredCrew">
                <td>
                  <div class="cell-operator">
                    <img [src]="m.avatar_url" [alt]="m.name" class="table-avatar" />
                    <div>
                      <span class="table-op-name">{{ m.name }}</span>
                    </div>
                  </div>
                </td>
                <td><code class="dni-badge">{{ m.document_id }}</code></td>
                <td>
                  <span class="role-badge">{{ formatRoleName(m.primary_role) }}</span>
                </td>
                <td>
                  <span class="guard-badge">{{ m.shift_code }}</span>
                </td>
                <td>
                  <span class="radio-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="2"></circle>
                      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
                      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
                    </svg>
                    {{ m.radio_channel }}
                  </span>
                </td>
                <td>{{ m.phone_extension || '---' }}</td>
                <td>
                  <select
                    class="table-status-select"
                    [ngModel]="m.status"
                    (ngModelChange)="onUpdateStatus(m.id, $event)"
                  >
                    <option value="EN_TURNO">En Turno</option>
                    <option value="DESCANSO">Descanso</option>
                    <option value="VACACIONES">Vacaciones</option>
                    <option value="PERMISO">Permiso</option>
                    <option value="CAPACITACION">Capacitación</option>
                  </select>
                </td>
                <td>
                  <span class="assigned-position-tag" *ngIf="getOperatorAssignedPosition(m.id) as posTitle">
                    {{ posTitle }}
                  </span>
                  <span class="text-muted" *ngIf="!getOperatorAssignedPosition(m.id)">
                    Sin asignar
                  </span>
                </td>
                <td class="text-right">
                  <button
                    type="button"
                    class="action-icon-btn delete-btn"
                    (click)="onDeleteOperator(m)"
                    title="Dar de baja de la nómina"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL: REGISTRAR NUEVO OPERADOR -->
    <app-modal
      [isOpen]="isCreateModalOpen"
      [title]="'Registrar Nuevo Operador en Cuadrilla'"
      [showFooter]="true"
      (close)="isCreateModalOpen = false"
    >
      <form class="modal-form" (ngSubmit)="saveNewOperator()">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre y Apellidos: *</label>
            <input
              type="text"
              class="form-control"
              placeholder="Ej. Juan Pérez Huamán"
              [(ngModel)]="newOperator.name"
              name="name"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">DNI / Documento de Identidad: *</label>
            <input
              type="text"
              class="form-control"
              placeholder="Ej. 70412893"
              [(ngModel)]="newOperator.document_id"
              name="document_id"
              required
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Posición / Rol Principal:</label>
            <select
              class="form-control"
              [(ngModel)]="newOperator.primary_role"
              name="primary_role"
              required
            >
              <option value="OPERADOR_BOMBAS">Operador de Bombas</option>
              <option value="OPERADOR_CICLONES">Operador de Ciclones</option>
              <option value="OPERADOR_DESCARGA">Operador de descarga</option>
              <option value="OPERADOR_MISCELANEOS">Operador Misceláneos</option>
              <option value="OPERADOR_RELEVO">Operador de Relevo</option>
              <option value="SUPERVISOR">Supervisor de Planta</option>
              <option *ngFor="let p of customPositionsList" [value]="p.key">
                {{ p.title }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Guardia Asignada:</label>
            <select
              class="form-control"
              [(ngModel)]="newOperator.shift_code"
              name="shift_code"
              required
            >
              <option value="GUARDIA_A">Guardia A</option>
              <option value="GUARDIA_B">Guardia B</option>
              <option value="GUARDIA_C">Guardia C</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Canal de Frecuencia Radial:</label>
            <select
              class="form-control"
              [(ngModel)]="newOperator.radio_channel"
              name="radio_channel"
            >
              <option value="Canal 1 Operaciones">Canal 1 Operaciones</option>
              <option value="Canal 2 Ciclones">Canal 2 Ciclones</option>
              <option value="Canal 3 Bombas">Canal 3 Bombas</option>
              <option value="Canal 4 Presa">Canal 4 Presa</option>
              <option value="Canal 5 Relevo/Móvil">Canal 5 Relevo/Móvil</option>
              <option value="Canal 6 Mantenimiento">Canal 6 Mantenimiento</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Anexo Telefónico:</label>
            <input
              type="text"
              class="form-control"
              placeholder="Ej. Ext. 4102"
              [(ngModel)]="newOperator.phone_extension"
              name="phone_extension"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Seleccionar Avatar / Fotografía:</label>
          <div class="avatar-presets">
            <img
              *ngFor="let av of avatarPresets"
              [src]="av"
              class="avatar-option"
              [class.selected]="newOperator.avatar_url === av"
              (click)="newOperator.avatar_url = av"
            />
          </div>
        </div>
      </form>

      <div footer class="modal-footer-actions">
        <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!newOperator.name || !newOperator.document_id"
          (click)="saveNewOperator()"
        >
          Guardar Operador
        </button>
      </div>
    </app-modal>

    <!-- MODAL: CREAR NUEVA POSICIÓN OPERATIVA EN PLANTA -->
    <app-modal
      [isOpen]="isCreatePositionModalOpen"
      [title]="'Crear Nueva Posición Operativa en Cuadrilla'"
      [showFooter]="true"
      (close)="isCreatePositionModalOpen = false"
    >
      <form class="modal-form" (ngSubmit)="saveNewPosition()">
        <div class="form-group">
          <label class="form-label">Nombre del Puesto / Cargo Operativo: *</label>
          <input
            type="text"
            class="form-control"
            placeholder="Ej. Operador de Espesadores, Operador de Filtros de Prensa..."
            [(ngModel)]="newPositionData.title"
            name="pos_title"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Área / Ubicación en Planta:</label>
            <input
              type="text"
              class="form-control"
              placeholder="Ej. Área de Espesadores & Clarificación"
              [(ngModel)]="newPositionData.defaultLocation"
              name="pos_location"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Canal Radial de Contacto:</label>
            <select
              class="form-control"
              [(ngModel)]="newPositionData.defaultRadio"
              name="pos_radio"
            >
              <option value="Canal 1 Operaciones">Canal 1 Operaciones</option>
              <option value="Canal 2 Ciclones">Canal 2 Ciclones</option>
              <option value="Canal 3 Bombas">Canal 3 Bombas</option>
              <option value="Canal 4 Presa">Canal 4 Presa</option>
              <option value="Canal 5 Relevo/Móvil">Canal 5 Relevo/Móvil</option>
              <option value="Canal 6 Mantenimiento">Canal 6 Mantenimiento</option>
              <option value="Canal 7 Emergencias">Canal 7 Emergencias</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Icono Representativo del Puesto:</label>
          <div class="icon-picker-grid">
            <button
              type="button"
              *ngFor="let opt of iconOptions"
              class="icon-picker-btn"
              [class.selected]="newPositionData.iconSvg === opt.icon"
              (click)="newPositionData.iconSvg = opt.icon"
            >
              <span class="icon-emoji">{{ opt.icon }}</span>
              <span class="icon-label">{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Asignar Operador Titular Inicial (Opcional):</label>
          <select
            class="form-control"
            [(ngModel)]="newPositionData.initialOperatorId"
            name="pos_operator"
          >
            <option value="">-- Sin asignar por ahora --</option>
            <optgroup [label]="'Operadores ' + selectedShift">
              <option *ngFor="let m of activeShiftMembers" [value]="m.id">
                {{ m.name }} ({{ formatRoleName(m.primary_role) }})
              </option>
            </optgroup>
            <optgroup label="Otros Operadores de Planta">
              <option *ngFor="let m of otherShiftMembers" [value]="m.id">
                {{ m.name }} ({{ formatRoleName(m.primary_role) }} - {{ m.shift_code }})
              </option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Consignas y Tareas Principales:</label>
          <textarea
            class="form-control"
            rows="3"
            placeholder="Responsabilidades específicas del puesto, controles periódicos y medidas de seguridad..."
            [(ngModel)]="newPositionData.description"
            name="pos_description"
          ></textarea>
        </div>
      </form>

      <div footer class="modal-footer-actions">
        <button type="button" class="btn btn-secondary" (click)="isCreatePositionModalOpen = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!newPositionData.title.trim()"
          (click)="saveNewPosition()"
        >
          Crear Posición
        </button>
      </div>
    </app-modal>

    <!-- MODAL: EDITAR ASIGNACIÓN & CONSIGNAS -->
    <app-modal
      [isOpen]="isEditAssignmentModalOpen"
      [title]="'Editar Consignas de ' + (activeEditPosition?.title || '')"
      [showFooter]="true"
      (close)="isEditAssignmentModalOpen = false"
    >
      <div class="modal-form" *ngIf="activeEditPosition">
        <div class="form-group">
          <label class="form-label">Ubicación Fina / Puesto:</label>
          <input
            type="text"
            class="form-control"
            [(ngModel)]="editAssignmentData.station_location"
            placeholder="Ej. Sentina Principal y Bombas PP-101"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Canal Radial Asignado:</label>
          <input
            type="text"
            class="form-control"
            [(ngModel)]="editAssignmentData.radio_channel"
            placeholder="Ej. Canal 3 Bombas"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Consignas & Tareas Específicas del Turno:</label>
          <textarea
            class="form-control"
            rows="4"
            [(ngModel)]="editAssignmentData.notes"
            placeholder="Instrucciones del supervisor, precauciones y tareas especiales para el operador..."
          ></textarea>
        </div>
      </div>

      <div footer class="modal-footer-actions">
        <button type="button" class="btn btn-secondary" (click)="isEditAssignmentModalOpen = false">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" (click)="saveAssignmentDetails()">
          Guardar Consignas
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .crew-page {
      padding: 0 0 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 12px;

        .title-group {
          width: 100%;
        }

        .title-with-badge h2 {
          font-size: 1.25rem;
        }

        .top-actions-cluster {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;

          button {
            width: 100%;
            padding: 9px 8px;
            font-size: 0.8rem;
          }
        }
      }
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;

      h2 {
        font-size: 1.55rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        margin: 0;
      }
    }

    .section-sub {
      color: var(--text-secondary);
      font-size: 0.88rem;
      margin-top: 4px;
    }

    .coverage-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border-radius: var(--radius-full);
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 0.8rem;
      font-weight: 700;

      &.full-coverage {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #047857;

        .pulse-dot {
          background: #059669;
          box-shadow: 0 0 6px #059669;
        }
      }
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: #d97706;
      box-shadow: 0 0 6px #d97706;
    }

    .top-actions-cluster {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Shift & Filter Panel */
    .shift-filter-panel {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
      box-shadow: var(--shadow-card);

      @media (max-width: 768px) {
        padding: 12px 14px;
        gap: 14px;

        .filter-group {
          width: 100%;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;

          .guard-tabs, .shift-type-tabs {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }

          .shift-type-tabs {
            grid-template-columns: 1fr 1fr;
          }
        }
      }
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .filter-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .guard-tabs, .shift-type-tabs {
      display: flex;
      background: #f1f5f9;
      border-radius: var(--radius-md);
      padding: 3px;
      gap: 3px;
    }

    .guard-tab-btn, .type-tab-btn {
      border: none;
      background: transparent;
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        background: #ffffff;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .filter-date-input {
      padding: 6px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      background: #ffffff;
      outline: none;

      &:focus {
        border-color: #031795;
      }
    }

    .filter-kpi-block {
      margin-left: auto;
      display: flex;
      gap: 16px;
      padding-left: 16px;
      border-left: 1px solid var(--border-subtle);

      @media (max-width: 900px) {
        margin-left: 0;
        border-left: none;
        padding-left: 0;
        width: 100%;
      }
    }

    .kpi-mini-item {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .kpi-val {
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--text-primary);
    }

    .text-success {
      color: #059669 !important;
    }

    /* Section divider */
    .section-divider-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      font-weight: 800;
      color: #031795;
      letter-spacing: 0.06em;
      margin-top: 6px;
    }

    /* Positions Grid */
    .positions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .position-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: var(--shadow-card);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
      }

      &.card-bombas::before {
        background: linear-gradient(90deg, #0284c7, #38bdf8);
      }
      &.card-ciclones::before {
        background: linear-gradient(90deg, #6366f1, #818cf8);
      }
      &.card-descarga::before {
        background: linear-gradient(90deg, #d97706, #fbbf24);
      }
      &.card-miscelaneos::before {
        background: linear-gradient(90deg, #475569, #94a3b8);
      }
      &.card-relevo::before {
        background: linear-gradient(90deg, #059669, #34d399);
      }
      &.card-custom::before {
        background: linear-gradient(90deg, #8b5cf6, #06b6d4);
      }
    }

    .pos-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .pos-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pos-icon {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.45rem;
      background: #f8fafc;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .pos-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pos-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .badge-custom-pill {
      font-size: 0.68rem;
      font-weight: 800;
      color: #031795;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      letter-spacing: 0.04em;
    }

    .pos-location {
      font-size: 0.78rem;
      color: var(--text-secondary);
      display: block;
      margin-top: 2px;
    }

    .radio-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: var(--radius-full);
      background: #f1f5f9;
      color: #475569;
      font-size: 0.74rem;
      font-weight: 700;
      white-space: nowrap;
      border: 1px solid #e2e8f0;
    }

    /* Operator Selection */
    .pos-operator-select-box, .pos-backup-select-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .operator-field-label {
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .operator-select, .operator-select-sm {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1.5px solid var(--border-subtle);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      background: #ffffff;
      outline: none;
      transition: var(--transition-smooth);

      &:focus {
        border-color: #031795;
        box-shadow: 0 0 0 3px rgba(3, 23, 149, 0.15);
      }
    }

    .operator-select-sm {
      padding: 6px 10px;
      font-size: 0.8rem;
      background: #f8fafc;
    }

    .operator-snapshot {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      margin-top: 4px;
    }

    .operator-avatar {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-full);
      object-fit: cover;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      flex-shrink: 0;
    }

    .operator-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .op-name {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .op-doc {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-family: monospace;
    }

    .op-status-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      background: #f1f5f9;
      color: #64748b;
      white-space: nowrap;

      &.en-turno {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
      }
    }

    /* Checks row */
    .pos-checks-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 2px;
    }

    .check-pill {
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.76rem;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      &.checked {
        background: #ecfdf5;
        border-color: #059669;
        color: #047857;
        box-shadow: 0 1px 4px rgba(5, 150, 105, 0.15);
      }
    }

    /* Footer */
    .pos-card-footer {
      border-top: 1px solid var(--border-subtle);
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pos-notes-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.76rem;
      color: var(--text-secondary);
      line-height: 1.4;

      svg {
        flex-shrink: 0;
        margin-top: 2px;
        color: var(--text-muted);
      }
    }

    .pos-footer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .btn-edit-notes {
      background: transparent;
      border: 1px solid var(--border-subtle);
      padding: 5px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #f1f5f9;
        color: var(--text-primary);
      }
    }

    .btn-delete-pos {
      background: none;
      border: 1px solid #fee2e2;
      color: #dc2626;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 5px 9px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: var(--transition-smooth);

      &:hover {
        background: #fef2f2;
        border-color: #fca5a5;
      }
    }

    .module-direct-link {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.76rem;
      font-weight: 700;
      color: #031795;
      text-decoration: none;
      transition: var(--transition-smooth);

      &:hover {
        color: #1e40af;
        text-decoration: underline;
      }
    }

    /* Roster Table Section */
    .roster-section {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .roster-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .roster-title-block h3 {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .roster-filter-tabs {
      display: flex;
      background: #f1f5f9;
      border-radius: var(--radius-md);
      padding: 3px;
      gap: 3px;
    }

    .tab-btn {
      border: none;
      background: transparent;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-smooth);

      &.active {
        background: #ffffff;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .roster-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        text-align: left;
        padding: 10px 12px;
        background: #f8fafc;
        color: var(--text-secondary);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-bottom: 1.5px solid var(--border-subtle);
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-subtle);
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #f8fafc;
      }
    }

    .cell-operator {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table-avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      object-fit: cover;
      flex-shrink: 0;
    }

    .table-op-name {
      font-weight: 700;
      color: var(--text-primary);
    }

    .dni-badge {
      background: #f1f5f9;
      padding: 3px 6px;
      border-radius: var(--radius-sm);
      font-size: 0.76rem;
      color: #334155;
    }

    .role-badge {
      font-weight: 600;
      color: #047857;
      background: #ecfdf5;
      padding: 3px 8px;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      border: 1px solid #a7f3d0;
    }

    .guard-badge {
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: var(--radius-full);
      font-size: 0.74rem;
    }

    .radio-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.76rem;
      color: #475569;
    }

    .table-status-select {
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-primary);
      background: #ffffff;
      outline: none;
    }

    .assigned-position-tag {
      font-weight: 700;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      font-size: 0.74rem;
    }

    .action-icon-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 5px;
      border-radius: var(--radius-sm);
      transition: var(--transition-smooth);

      &:hover {
        background: #fee2e2;
      }
    }

    /* Modal Form Styles */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 10px;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .form-control {
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      font-size: 0.88rem;
      color: var(--text-primary);
      outline: none;
      transition: var(--transition-smooth);

      &:focus {
        border-color: #059669;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
      }
    }

    /* Icon Picker Grid */
    .icon-picker-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;

      @media (max-width: 600px) {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .icon-picker-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: var(--transition-smooth);

      .icon-emoji {
        font-size: 1.4rem;
      }

      .icon-label {
        font-size: 0.68rem;
        color: var(--text-secondary);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      &:hover {
        background: #ffffff;
        border-color: #059669;
        transform: translateY(-1px);
      }

      &.selected {
        background: #ecfdf5;
        border-color: #059669;
        box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2);

        .icon-label {
          color: #047857;
          font-weight: 700;
        }
      }
    }

    .avatar-presets {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .avatar-option {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      object-fit: cover;
      cursor: pointer;
      border: 3px solid transparent;
      transition: var(--transition-smooth);

      &:hover {
        transform: scale(1.08);
      }

      &.selected {
        border-color: #059669;
        box-shadow: 0 0 8px rgba(5, 150, 105, 0.4);
      }
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `]
})
export class CrewManagementComponent implements OnInit {
  crewService = inject(CrewService);

  selectedShift: 'GUARDIA_A' | 'GUARDIA_B' | 'GUARDIA_C' = 'GUARDIA_A';
  selectedShiftType: 'DIA' | 'NOCHE' = 'DIA';
  selectedDate: string = new Date().toISOString().split('T')[0];
  rosterFilter: 'ALL' | 'EN_TURNO' | 'DESCANSO' = 'ALL';

  // Modals
  isCreateModalOpen = false;
  isCreatePositionModalOpen = false;
  isEditAssignmentModalOpen = false;
  activeEditPosition: CrewPositionMeta | null = null;
  editAssignmentData: { station_location: string; radio_channel: string; notes: string } = {
    station_location: '',
    radio_channel: '',
    notes: ''
  };

  // Form: Create Position
  newPositionData = {
    title: '',
    defaultLocation: '',
    defaultRadio: 'Canal 1 Operaciones',
    iconSvg: '🏭',
    description: '',
    initialOperatorId: ''
  };

  iconOptions = [
    { icon: '🌊', label: 'Bombas' },
    { icon: '🌀', label: 'Ciclones' },
    { icon: '🏔️', label: 'Descarga/Presa' },
    { icon: '⚙️', label: 'Misceláneos' },
    { icon: '🔄', label: 'Relevo' },
    { icon: '🏭', label: 'Espesadores' },
    { icon: '🧪', label: 'Muestreo/Lab' },
    { icon: '⚡', label: 'Eléctrica' },
    { icon: '⛏️', label: 'Chancado' },
    { icon: '🛡️', label: 'Seguridad' },
    { icon: '🦺', label: 'Supervisión' },
    { icon: '🚒', label: 'Emergencias' }
  ];

  newOperator: Partial<CrewMember> = {
    name: '',
    document_id: '',
    primary_role: 'OPERADOR_BOMBAS',
    shift_code: 'GUARDIA_A',
    radio_channel: 'Canal 3 Bombas',
    phone_extension: '',
    status: 'EN_TURNO',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
  };

  avatarPresets = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80'
  ];

  get positionsList(): CrewPositionMeta[] {
    return this.crewService.positions();
  }

  get customPositionsList(): CrewPositionMeta[] {
    return this.crewService.positions().filter(p => p.isCustom);
  }

  get activeShiftMembers(): CrewMember[] {
    return this.crewService.allMembers().filter(m => m.shift_code === this.selectedShift);
  }

  get otherShiftMembers(): CrewMember[] {
    return this.crewService.allMembers().filter(m => m.shift_code !== this.selectedShift);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.crewService.loadPositions().subscribe();
    this.crewService.loadCrew(this.selectedShift).subscribe();
    this.crewService.loadAssignments(this.selectedDate, this.selectedShift, this.selectedShiftType).subscribe();
  }

  selectShift(shift: 'GUARDIA_A' | 'GUARDIA_B' | 'GUARDIA_C'): void {
    this.selectedShift = shift;
    this.loadData();
  }

  selectShiftType(type: 'DIA' | 'NOCHE'): void {
    this.selectedShiftType = type;
    this.loadData();
  }

  onDateChange(): void {
    this.loadData();
  }

  getAssignment(key: PositionKey): CrewAreaAssignment | undefined {
    return this.crewService.activeAssignments().find(a => a.position_key === key);
  }

  getOperator(operatorId?: string | null): CrewMember | undefined {
    if (!operatorId) return undefined;
    return this.crewService.allMembers().find(m => m.id === operatorId) ||
           this.crewService.crewMembers().find(m => m.id === operatorId);
  }

  get coverageCount(): number {
    return this.positionsList.filter(p => !!this.getAssignment(p.key)?.operator_id).length;
  }

  get activeCrewCount(): number {
    return this.crewService.allMembers().filter(m => m.shift_code === this.selectedShift && m.status === 'EN_TURNO').length;
  }

  get eppCompliancePercent(): number {
    const list = this.crewService.activeAssignments();
    if (list.length === 0) return 100;
    const verified = list.filter(a => a.epp_verified === 1).length;
    return Math.round((verified / list.length) * 100);
  }

  get filteredCrew(): CrewMember[] {
    const all = this.crewService.allMembers();
    if (this.rosterFilter === 'EN_TURNO') {
      return all.filter(m => m.status === 'EN_TURNO');
    }
    if (this.rosterFilter === 'DESCANSO') {
      return all.filter(m => m.status === 'DESCANSO');
    }
    return all;
  }

  formatRoleName(role: string): string {
    switch (role) {
      case 'OPERADOR_BOMBAS': return 'Operador de Bombas';
      case 'OPERADOR_CICLONES': return 'Operador de Ciclones';
      case 'OPERADOR_DESCARGA': return 'Operador de descarga';
      case 'OPERADOR_MISCELANEOS': return 'Operador Misceláneos';
      case 'OPERADOR_RELEVO': return 'Operador de Relevo';
      case 'SUPERVISOR': return 'Supervisor de Planta';
      default: {
        const custom = this.positionsList.find(p => p.key === role);
        return custom ? custom.title : role;
      }
    }
  }

  getOperatorAssignedPosition(operatorId: string): string | null {
    const assignment = this.crewService.activeAssignments().find(a => a.operator_id === operatorId);
    if (assignment) {
      return assignment.position_title || assignment.position_key;
    }
    const backup = this.crewService.activeAssignments().find(a => a.backup_operator_id === operatorId);
    if (backup) {
      return `Relevo (${backup.position_title || backup.position_key})`;
    }
    return null;
  }

  onAssignOperator(key: PositionKey, operatorId: string): void {
    const meta = this.positionsList.find(p => p.key === key);
    const existing = this.getAssignment(key);
    const operator = this.getOperator(operatorId);

    const payload: Partial<CrewAreaAssignment> = {
      ...existing,
      id: existing?.id || ('assign-' + key.toString().toLowerCase() + '-' + Date.now()),
      position_key: key,
      position_title: meta?.title || key,
      operator_id: operatorId,
      shift_code: this.selectedShift,
      shift_date: this.selectedDate,
      shift_type: this.selectedShiftType,
      radio_channel: existing?.radio_channel || operator?.radio_channel || meta?.defaultRadio,
      station_location: existing?.station_location || meta?.defaultLocation,
      notes: existing?.notes || meta?.description,
      epp_verified: existing?.epp_verified ?? 1,
      safety_talk_completed: existing?.safety_talk_completed ?? 1
    };

    this.crewService.saveAssignment(payload).subscribe();
  }

  onAssignBackup(key: PositionKey, backupId: string | null): void {
    const existing = this.getAssignment(key);
    if (!existing) return;

    const payload: Partial<CrewAreaAssignment> = {
      ...existing,
      backup_operator_id: backupId
    };

    this.crewService.saveAssignment(payload).subscribe();
  }

  toggleEpp(key: PositionKey): void {
    const assign = this.getAssignment(key);
    if (!assign) return;
    const nextVal = assign.epp_verified === 1 ? 0 : 1;
    this.crewService.checkin(assign.id, nextVal === 1, assign.safety_talk_completed === 1).subscribe();
  }

  toggleSafetyTalk(key: PositionKey): void {
    const assign = this.getAssignment(key);
    if (!assign) return;
    const nextVal = assign.safety_talk_completed === 1 ? 0 : 1;
    this.crewService.checkin(assign.id, assign.epp_verified === 1, nextVal === 1).subscribe();
  }

  validateAllEppAndTalk(): void {
    const list = this.crewService.activeAssignments();
    for (const a of list) {
      this.crewService.checkin(a.id, true, true).subscribe();
    }
  }

  openEditAssignmentModal(key: PositionKey): void {
    const meta = this.positionsList.find(p => p.key === key);
    if (!meta) return;
    this.activeEditPosition = meta;
    const assign = this.getAssignment(key);

    this.editAssignmentData = {
      station_location: assign?.station_location || meta.defaultLocation,
      radio_channel: assign?.radio_channel || meta.defaultRadio,
      notes: assign?.notes || meta.description
    };

    this.isEditAssignmentModalOpen = true;
  }

  saveAssignmentDetails(): void {
    if (!this.activeEditPosition) return;
    const key = this.activeEditPosition.key;
    const existing = this.getAssignment(key);
    if (!existing) return;

    const payload: Partial<CrewAreaAssignment> = {
      ...existing,
      station_location: this.editAssignmentData.station_location,
      radio_channel: this.editAssignmentData.radio_channel,
      notes: this.editAssignmentData.notes
    };

    this.crewService.saveAssignment(payload).subscribe(() => {
      this.isEditAssignmentModalOpen = false;
    });
  }

  // ===================================
  // Position Creation & Removal
  // ===================================
  openCreatePositionModal(): void {
    this.newPositionData = {
      title: '',
      defaultLocation: '',
      defaultRadio: 'Canal 1 Operaciones',
      iconSvg: '🏭',
      description: '',
      initialOperatorId: ''
    };
    this.isCreatePositionModalOpen = true;
  }

  saveNewPosition(): void {
    if (!this.newPositionData.title.trim()) return;

    this.crewService.createPosition({
      title: this.newPositionData.title.trim(),
      defaultLocation: this.newPositionData.defaultLocation.trim() || 'Planta Concentradora',
      defaultRadio: this.newPositionData.defaultRadio,
      iconSvg: this.newPositionData.iconSvg,
      description: this.newPositionData.description.trim() || 'Consignas y responsabilidades de puesto'
    }).subscribe(res => {
      const createdKey = res?.key;
      if (createdKey && this.newPositionData.initialOperatorId) {
        this.onAssignOperator(createdKey, this.newPositionData.initialOperatorId);
      }
      this.isCreatePositionModalOpen = false;
    });
  }

  onDeletePosition(pos: CrewPositionMeta): void {
    if (!pos.isCustom) return;
    if (confirm(`¿Confirma eliminar la posición "${pos.title}" del tablero de la cuadrilla?`)) {
      this.crewService.deletePosition(pos.key).subscribe();
    }
  }

  // ===================================
  // Operator Management
  // ===================================
  openCreateModal(): void {
    this.newOperator = {
      name: '',
      document_id: '',
      primary_role: 'OPERADOR_BOMBAS',
      shift_code: this.selectedShift,
      radio_channel: 'Canal 3 Bombas',
      phone_extension: '',
      status: 'EN_TURNO',
      avatar_url: this.avatarPresets[0]
    };
    this.isCreateModalOpen = true;
  }

  saveNewOperator(): void {
    if (!this.newOperator.name || !this.newOperator.document_id) return;

    this.crewService.createCrewMember(this.newOperator).subscribe(() => {
      this.isCreateModalOpen = false;
      this.loadData();
    });
  }

  onUpdateStatus(operatorId: string, newStatus: any): void {
    this.crewService.updateCrewMember(operatorId, { status: newStatus }).subscribe();
  }

  onDeleteOperator(operator: CrewMember): void {
    if (confirm(`¿Confirma dar de baja al operador ${operator.name} de la cuadrilla?`)) {
      this.crewService.deleteCrewMember(operator.id).subscribe();
    }
  }
}
