import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DonutSlice {
  name: string;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-distribution-donut',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="donut-container">
      <div class="donut-visual">
        <svg viewBox="0 0 120 120" class="donut-svg">
          <!-- Background circle track -->
          <circle cx="60" cy="60" r="44" fill="none" stroke="var(--gauge-track, #e2e8f0)" stroke-width="14" />

          <!-- Slices -->
          <circle
            *ngFor="let slice of calculatedSlices"
            cx="60" cy="60" r="44"
            fill="none"
            [attr.stroke]="slice.color"
            stroke-width="14"
            [attr.stroke-dasharray]="slice.dashArray"
            [attr.stroke-dashoffset]="slice.dashOffset"
            transform="rotate(-90 60 60)"
            class="donut-segment"
          />
        </svg>
        <div class="donut-center">
          <span class="center-val">{{ heroPercentage }}%</span>
        </div>
      </div>

      <!-- Legend items on right side -->
      <div class="donut-legend">
        <div *ngFor="let slice of slices" class="legend-row">
          <span class="legend-dot" [style.background-color]="slice.color"></span>
          <span class="legend-name">{{ slice.name }}</span>
          <span class="legend-pct">{{ slice.percentage }}%</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .donut-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 20px;
      padding: 10px 0;
    }

    .donut-visual {
      position: relative;
      width: 120px;
      height: 120px;
      flex-shrink: 0;
    }

    .donut-svg {
      width: 100%;
      height: 100%;
    }

    .donut-segment {
      transition: stroke-dashoffset 0.8s ease;
    }

    .donut-center {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .center-val {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }

    .legend-name {
      color: var(--text-secondary);
      min-width: 90px;
    }

    .legend-pct {
      color: var(--text-primary);
      font-weight: 600;
    }
  `]
})
export class DistributionDonutComponent {
  @Input() heroPercentage: number = 52;
  @Input() slices: DonutSlice[] = [
    { name: 'Guardia A', percentage: 52, color: '#059669' },
    { name: 'Guardia B', percentage: 33, color: '#10b981' },
    { name: 'Guardia C', percentage: 15, color: '#047857' }
  ];

  get calculatedSlices() {
    const circumference = 2 * Math.PI * 44; // ~276.46
    let accumulated = 0;

    return this.slices.map(slice => {
      const length = (slice.percentage / 100) * circumference;
      const offset = circumference - accumulated;
      accumulated += length;
      return {
        ...slice,
        dashArray: `${length} ${circumference}`,
        dashOffset: offset
      };
    });
  }
}
