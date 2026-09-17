import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WavePoint {
  label: string;
  value: number;
}

@Component({
  selector: 'app-wave-area-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wave-chart-card">
      <div class="chart-header">
        <span class="chart-title">{{ title }}</span>
      </div>

      <div class="chart-body">
        <div class="y-ticks">
          <span>50k</span>
          <span>40k</span>
          <span>30k</span>
          <span>20k</span>
          <span>10k</span>
        </div>

        <div class="svg-stage">
          <svg viewBox="0 0 500 180" preserveAspectRatio="none" class="wave-svg">
            <defs>
              <linearGradient id="emeraldWaveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#059669" stop-opacity="0.25" />
                <stop offset="60%" stop-color="#34d399" stop-opacity="0.1" />
                <stop offset="100%" stop-color="#059669" stop-opacity="0.0" />
              </linearGradient>
              <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#059669" flood-opacity="0.3" />
              </filter>
            </defs>

            <!-- Subtle horizontal grid lines -->
            <line x1="0" y1="36" x2="500" y2="36" stroke="#e2e8f0" stroke-width="1" />
            <line x1="0" y1="72" x2="500" y2="72" stroke="#e2e8f0" stroke-width="1" />
            <line x1="0" y1="108" x2="500" y2="108" stroke="#e2e8f0" stroke-width="1" />
            <line x1="0" y1="144" x2="500" y2="144" stroke="#e2e8f0" stroke-width="1" />

            <!-- Vertical peak marker line -->
            <line x1="250" y1="42" x2="250" y2="180" stroke="#94a3b8" stroke-dasharray="3,3" stroke-width="1" />
            <circle cx="250" cy="42" r="3.5" fill="#059669" filter="url(#waveGlow)" />

            <!-- Wave area fill -->
            <path
              d="M 0 170 C 50 165, 80 155, 120 120 C 160 85, 200 45, 250 42 C 300 40, 340 140, 390 120 C 440 100, 470 30, 500 20 L 500 180 L 0 180 Z"
              fill="url(#emeraldWaveGradient)"
            />

            <!-- Top glowing curve stroke -->
            <path
              d="M 0 170 C 50 165, 80 155, 120 120 C 160 85, 200 45, 250 42 C 300 40, 340 140, 390 120 C 440 100, 470 30, 500 20"
              fill="none"
              stroke="#059669"
              stroke-width="2.5"
            />

            <!-- Data dots on x-axis baseline -->
            <circle *ngFor="let dot of xDots" [attr.cx]="dot" cy="178" r="1.5" fill="rgba(255,255,255,0.25)" />
          </svg>
        </div>
      </div>

      <!-- X-axis labels (months) -->
      <div class="x-labels">
        <span *ngFor="let p of points">{{ p.label }}</span>
      </div>
    </div>
  `,
  styles: [`
    .wave-chart-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .chart-header {
      margin-bottom: 20px;
    }

    .chart-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .chart-body {
      display: flex;
      gap: 12px;
      height: 180px;
      position: relative;
    }

    .y-ticks {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 0.7rem;
      color: var(--text-muted);
      width: 25px;
      text-align: right;
    }

    .svg-stage {
      flex: 1;
      height: 100%;
    }

    .wave-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .x-labels {
      display: flex;
      justify-content: space-between;
      padding-left: 38px;
      padding-right: 6px;
      margin-top: 10px;
      font-size: 0.7rem;
      color: var(--text-muted);
    }
  `]
})
export class WaveAreaChartComponent {
  @Input() title: string = 'Total Revenue';
  @Input() points: WavePoint[] = [
    { label: 'jan', value: 18 },
    { label: 'feb', value: 22 },
    { label: 'mar', value: 20 },
    { label: 'apr', value: 26 },
    { label: 'may', value: 34 },
    { label: 'jun', value: 45 },
    { label: 'jul', value: 30 },
    { label: 'aug', value: 35 },
    { label: 'sep', value: 39 },
    { label: 'oct', value: 42 },
    { label: 'nov', value: 50 },
    { label: 'dec', value: 58 }
  ];

  xDots = [20, 60, 100, 140, 180, 220, 260, 300, 340, 380, 420, 460];
}
