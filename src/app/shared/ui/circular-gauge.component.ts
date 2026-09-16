import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-circular-gauge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gauge-item">
      <div class="svg-container">
        <svg viewBox="0 0 100 100" class="gauge-svg">
          <!-- Background track -->
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            stroke="#2e274c"
            stroke-width="9"
          />
          <!-- Foreground animated stroke -->
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            [attr.stroke]="color"
            stroke-width="9"
            stroke-linecap="round"
            [attr.stroke-dasharray]="dashArray"
            [attr.stroke-dashoffset]="dashOffset"
            transform="rotate(-90 50 50)"
            class="progress-ring"
          />
        </svg>
        <div class="gauge-center-text">
          <span class="gauge-percentage">{{ percentage }}%</span>
        </div>
      </div>
      <span class="gauge-label">{{ label }}</span>
    </div>
  `,
  styles: [`
    .gauge-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .svg-container {
      position: relative;
      width: 96px;
      height: 96px;
    }

    .gauge-svg {
      width: 100%;
      height: 100%;
      transform: rotate(0deg);
    }

    .progress-ring {
      transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .gauge-center-text {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gauge-percentage {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .gauge-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-align: center;
    }
  `]
})
export class CircularGaugeComponent {
  @Input() percentage: number = 0;
  @Input() label: string = '';
  @Input() color: string = '#a855f7';

  get dashArray(): string {
    const circumference = 2 * Math.PI * 38; // ~238.76
    return `${circumference}`;
  }

  get dashOffset(): number {
    const circumference = 2 * Math.PI * 38;
    return circumference - (this.percentage / 100) * circumference;
  }
}
