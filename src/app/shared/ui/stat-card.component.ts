import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card glass-panel">
      <div class="stat-info">
        <span class="stat-value">{{ value }}</span>
        <span class="stat-title">{{ title }}</span>
        @if (trend) {
          <span class="stat-trend" [class.positive]="isPositive" [class.negative]="!isPositive">
            {{ trend }}
          </span>
        }
      </div>
      <div class="stat-icon-wrapper" [class.glow]="glow">
        <div class="icon-inner">
          <ng-content select="[icon]"></ng-content>
          <!-- Default SVG fallback if no icon projected -->
          <svg *ngIf="!hasProjectedIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      padding: 20px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      transition: var(--transition-smooth);
      position: relative;
      overflow: hidden;

      &:hover {
        transform: translateY(-2px);
        background: var(--bg-card-hover);
        border-color: var(--primary-border);
      }
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-value {
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .stat-title {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .stat-trend {
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 2px;
      display: inline-flex;
      align-items: center;

      &.positive { color: var(--success); }
      &.negative { color: var(--danger); }
    }

    .stat-icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-full);
      background: radial-gradient(circle at 30% 30%, #a855f7 0%, #7e22ce 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);
      flex-shrink: 0;
      border: 2px solid rgba(255, 255, 255, 0.18);

      &.glow {
        box-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
      }
    }

    .icon-inner {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class StatCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = '';
  @Input() trend?: string;
  @Input() isPositive: boolean = true;
  @Input() glow: boolean = true;
  @Input() hasProjectedIcon: boolean = false;
}
