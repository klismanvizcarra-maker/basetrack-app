import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-card glass-panel animate-modal-in" (click)="$event.stopPropagation()">
        <div class="mobile-drag-pill"></div>
        <div class="modal-header">
          <h3 class="modal-title">{{ title }}</h3>
          <button type="button" class="close-btn" (click)="close.emit()" title="Cerrar modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <ng-content></ng-content>
        </div>

        <div class="modal-footer" *ngIf="showFooter">
          <ng-content select="[footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.52);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      transition: opacity 0.25s ease;

      @media (max-width: 640px) {
        align-items: flex-end;
        padding: 0;
      }
    }

    .modal-card {
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.16), 0 0 1px rgba(0, 0, 0, 0.1);
      border-radius: var(--radius-xl);
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;

      @media (max-width: 640px) {
        max-width: 100%;
        border-radius: 22px 22px 0 0;
        max-height: 92vh;
        border-bottom: none;
        padding-bottom: env(safe-area-inset-bottom, 8px);
      }
    }

    .mobile-drag-pill {
      display: none;
      width: 40px;
      height: 4px;
      background: #cbd5e1;
      border-radius: 9999px;
      margin: 8px auto 0;
      flex-shrink: 0;

      @media (max-width: 640px) {
        display: block;
      }
    }

    @keyframes modalInDesktop {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes modalInMobile {
      from { opacity: 0; transform: translateY(100%); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-modal-in {
      animation: modalInDesktop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;

      @media (max-width: 640px) {
        animation: modalInMobile 0.28s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
      }
    }

    .modal-header {
      padding: 16px 22px;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;

      @media (max-width: 640px) {
        padding: 12px 18px 14px;
      }
    }

    .modal-title {
      font-size: 1.12rem;
      font-weight: 700;
      color: var(--text-primary);

      @media (max-width: 640px) {
        font-size: 1rem;
      }
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: var(--radius-sm);
      transition: var(--transition-smooth);

      &:hover {
        color: var(--text-primary);
        background: var(--bg-card-hover);
      }
    }

    .modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;

      @media (max-width: 640px) {
        padding: 16px 18px 20px;
      }
    }

    .modal-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      background: var(--bg-card-subtle);

      @media (max-width: 640px) {
        padding: 12px 18px;
        flex-direction: column-reverse;
        gap: 8px;

        ::ng-deep button {
          width: 100%;
        }
      }
    }
  `]
})
export class ModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = '';
  @Input() showFooter: boolean = true;
  @Output() close = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent) {
    this.close.emit();
  }
}
