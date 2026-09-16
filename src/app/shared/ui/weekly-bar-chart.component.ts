import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DayComparison {
  day: string;
  current: number;
  previous: number;
}

@Component({
  selector: 'app-weekly-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bar-chart-card">
      <div class="chart-header">
        <div class="title-group">
          <span class="chart-title">{{ title }}</span>
          <span *ngIf="subtitle" class="chart-sub">{{ subtitle }}</span>
        </div>
        <div class="dropdown-filter">
          <span>Semanal</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <div class="chart-body">
        <div class="y-axis">
          <span>800</span>
          <span>600</span>
          <span>400</span>
          <span>200</span>
          <span>0</span>
        </div>

        <div class="bars-area">
          <!-- Grid lines -->
          <div class="grid-line" style="bottom: 80%;"></div>
          <div class="grid-line" style="bottom: 60%;"></div>
          <div class="grid-line" style="bottom: 40%;"></div>
          <div class="grid-line" style="bottom: 20%;"></div>
          <div class="grid-line" style="bottom: 0%;"></div>

          <!-- Day Columns -->
          <div class="day-columns">
            <div *ngFor="let item of data" class="day-group">
              <div class="bars-pair">
                <div
                  class="bar bar-current"
                  [style.height.%]="(item.current / maxVal) * 100"
                  [title]="'Actual: ' + item.current + ' m³/h'"
                ></div>
                <div
                  class="bar bar-previous"
                  [style.height.%]="(item.previous / maxVal) * 100"
                  [title]="'Anterior: ' + item.previous + ' m³/h'"
                ></div>
              </div>
              <span class="day-label">{{ item.day }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="chart-legend">
        <div class="legend-badge">
          <span class="dot purple"></span>
          <span>Turno Actual</span>
        </div>
        <div class="legend-badge">
          <span class="dot pink"></span>
          <span>Turno Anterior</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bar-chart-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .title-group {
      display: flex;
      flex-direction: column;
    }

    .chart-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .chart-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .dropdown-filter {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .chart-body {
      display: flex;
      gap: 12px;
      height: 200px;
      position: relative;
    }

    .y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 0.7rem;
      color: var(--text-muted);
      width: 25px;
      text-align: right;
      padding-bottom: 24px;
    }

    .bars-area {
      flex: 1;
      position: relative;
      padding-bottom: 24px;
    }

    .grid-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: rgba(255, 255, 255, 0.04);
    }

    .day-columns {
      position: absolute;
      top: 0;
      bottom: 24px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
    }

    .day-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      gap: 8px;
    }

    .bars-pair {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      height: 100%;
    }

    .bar {
      width: 14px;
      border-radius: 4px 4px 0 0;
      transition: height 0.6s ease;
      cursor: pointer;

      &:hover {
        opacity: 0.85;
      }
    }

    .bar-current {
      background: linear-gradient(180deg, #a855f7 0%, #7e22ce 100%);
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
    }

    .bar-previous {
      background: linear-gradient(180deg, #f472b6 0%, #db2777 100%);
      box-shadow: 0 0 10px rgba(244, 114, 182, 0.3);
    }

    .day-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      position: absolute;
      bottom: -22px;
    }

    .chart-legend {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 14px;
    }

    .legend-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);

      &.purple { background: #a855f7; }
      &.pink { background: #f472b6; }
    }
  `]
})
export class WeeklyBarChartComponent {
  @Input() title: string = 'Customer Map';
  @Input() subtitle?: string;
  @Input() data: DayComparison[] = [
    { day: 'Dom', current: 780, previous: 650 },
    { day: 'Lun', current: 510, previous: 480 },
    { day: 'Mar', current: 740, previous: 520 },
    { day: 'Mié', current: 410, previous: 490 },
    { day: 'Jue', current: 430, previous: 530 },
    { day: 'Vie', current: 670, previous: 620 },
    { day: 'Sáb', current: 820, previous: 690 }
  ];

  maxVal = 900;
}
