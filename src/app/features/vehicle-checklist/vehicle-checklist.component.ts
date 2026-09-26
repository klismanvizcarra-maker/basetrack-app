import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleChecklistService, VehicleInfo, VehicleChecklist, InspectionCheckItem, DEFAULT_INSPECTION_ITEMS } from '../../core/services/vehicle-checklist.service';
import { AuthService } from '../../core/auth/auth.service';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-vehicle-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './vehicle-checklist.component.html',
  styleUrls: ['./vehicle-checklist.component.scss']
})
export class VehicleChecklistComponent implements OnInit {
  checklistService = inject(VehicleChecklistService);
  authService = inject(AuthService);

  // Modal State
  isCreateModalOpen = false;
  isDetailModalOpen = false;
  selectedChecklistDetail: VehicleChecklist | null = null;
  previewPhotoUrl: string | null = null;
  isSubmitting = false;
  successMessage = '';

  // Form State
  formVehiclePlate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747' = 'BMC715';
  formDate = new Date().toISOString().slice(0, 10);
  formTime = new Date().toTimeString().slice(0, 5);
  formShift: 'G1' | 'G2' | 'G3' | 'G4' = 'G1';
  formShiftType: 'DIA' | 'NOCHE' = 'DIA';
  formDriverName = '';
  formDriverDni = '';
  formDriverLicense = '';
  formOdometer = 0;
  formItems: InspectionCheckItem[] = [];
  formHasObservations = false;
  formObservationNotes = '';
  formPhotoUrl = '';
  formOperationalStatus: 'APTO' | 'OBSERVADO' | 'NO_APTO' = 'APTO';
  formSignatureAgreed = false;

  // Active Category filter in form
  activeCategory = 'TODAS';

  ngOnInit(): void {
    this.checklistService.refreshVehicles();
    this.checklistService.loadChecklistsForPlate(this.checklistService.selectedPlate());
  }

  get vehicles(): VehicleInfo[] {
    return this.checklistService.vehicles();
  }

  get selectedPlate(): 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747' {
    return this.checklistService.selectedPlate();
  }

  get currentVehicle(): VehicleInfo {
    return this.checklistService.currentVehicle();
  }

  get checklists(): VehicleChecklist[] {
    return this.checklistService.checklists();
  }

  get isLoading(): boolean {
    return this.checklistService.isLoading();
  }

  selectVehicle(plate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747'): void {
    this.checklistService.selectVehicle(plate);
  }

  openCreateModal(): void {
    const user = this.authService.currentUser();
    const currentVeh = this.currentVehicle;

    // Autocomplete driver information from logged-in user
    this.formVehiclePlate = currentVeh.plate;
    this.formDate = new Date().toISOString().slice(0, 10);
    this.formTime = new Date().toTimeString().slice(0, 5);
    
    // Auto-detect shift type based on hour
    const currentHour = new Date().getHours();
    this.formShiftType = (currentHour >= 7 && currentHour < 19) ? 'DIA' : 'NOCHE';
    
    // Auto-fill user shift or default to G1
    const userShift = (user?.shift || 'G1').toUpperCase();
    this.formShift = ['G1', 'G2', 'G3', 'G4'].includes(userShift) ? (userShift as any) : 'G1';
    
    this.formDriverName = user?.fullName || 'Conductor de Operaciones';
    this.formDriverDni = user?.document_id || '';
    this.formDriverLicense = user?.document_id ? `Q${user.document_id}` : '';
    
    // Set initial odometer suggested from vehicle current odometer + 10 km
    this.formOdometer = currentVeh.currentOdometer + 5;

    // Deep copy default items
    this.formItems = JSON.parse(JSON.stringify(DEFAULT_INSPECTION_ITEMS));
    this.formHasObservations = false;
    this.formObservationNotes = '';
    this.formPhotoUrl = '';
    this.formOperationalStatus = 'APTO';
    this.formSignatureAgreed = true;
    this.activeCategory = 'TODAS';

    this.isCreateModalOpen = true;
  }

  markAllItemsGood(): void {
    this.formItems.forEach(item => item.status = 'B');
    if (!this.formHasObservations) {
      this.formOperationalStatus = 'APTO';
    }
  }

  onItemStatusChange(): void {
    const hasBad = this.formItems.some(i => i.status === 'M');
    if (hasBad) {
      this.formHasObservations = true;
      if (this.formOperationalStatus === 'APTO') {
        this.formOperationalStatus = 'OBSERVADO';
      }
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          // Compress via Canvas to max 800px width/height and JPEG 0.7 quality (<60KB)
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            this.formPhotoUrl = compressed;
            this.formHasObservations = true;
            if (this.formOperationalStatus === 'APTO') {
              this.formOperationalStatus = 'OBSERVADO';
            }
          }
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.formPhotoUrl = '';
  }

  openDetailModal(checklist: VehicleChecklist): void {
    this.selectedChecklistDetail = checklist;
    this.isDetailModalOpen = true;
  }

  openPhotoPreview(url: string): void {
    this.previewPhotoUrl = url;
  }

  closePhotoPreview(): void {
    this.previewPhotoUrl = null;
  }

  submitChecklist(): void {
    if (!this.formDriverName || !this.formDriverDni) {
      alert('Por favor complete los datos obligatorios del conductor (Nombre y DNI).');
      return;
    }

    if (!this.formOdometer || this.formOdometer <= 0) {
      alert('Por favor ingrese un odómetro (kilometraje) válido.');
      return;
    }

    if (!this.formSignatureAgreed) {
      alert('Debe aceptar la declaración de conformidad antes de registrar el checklist.');
      return;
    }

    this.isSubmitting = true;

    this.checklistService.saveChecklist({
      vehicle_plate: this.formVehiclePlate,
      date: this.formDate,
      time: this.formTime,
      shift: this.formShift,
      shift_type: this.formShiftType,
      driver_name: this.formDriverName.trim().toUpperCase(),
      driver_dni: this.formDriverDni.trim(),
      driver_license: this.formDriverLicense.trim().toUpperCase() || undefined,
      odometer: Number(this.formOdometer),
      items: this.formItems,
      has_observations: this.formHasObservations,
      observation_notes: this.formObservationNotes.trim() || undefined,
      photo_url: this.formPhotoUrl || undefined,
      operational_status: this.formOperationalStatus
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isCreateModalOpen = false;
        const savedPlate = this.formVehiclePlate;
        this.selectVehicle(savedPlate);
        this.successMessage = `Checklist pre-uso para camioneta ${savedPlate} guardado exitosamente.`;
        setTimeout(() => this.successMessage = '', 6000);
      },
      error: () => {
        this.isSubmitting = false;
        this.isCreateModalOpen = false;
        const savedPlate = this.formVehiclePlate;
        this.selectVehicle(savedPlate);
        this.successMessage = `Checklist pre-uso para camioneta ${savedPlate} registrado en modo local.`;
        setTimeout(() => this.successMessage = '', 6000);
      }
    });
  }

  getCategories(): string[] {
    const cats = new Set(this.formItems.map(i => i.category));
    return ['TODAS', ...Array.from(cats)];
  }

  getFilteredItems(): InspectionCheckItem[] {
    if (this.activeCategory === 'TODAS') {
      return this.formItems;
    }
    return this.formItems.filter(i => i.category === this.activeCategory);
  }
}
