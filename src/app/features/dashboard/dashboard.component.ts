import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { CircularGaugeComponent } from '../../shared/ui/circular-gauge.component';
import { DistributionDonutComponent } from '../../shared/ui/distribution-donut.component';
import { WeeklyBarChartComponent } from '../../shared/ui/weekly-bar-chart.component';
import { WaveAreaChartComponent } from '../../shared/ui/wave-area-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    StatCardComponent,
    CircularGaugeComponent,
    DistributionDonutComponent,
    WeeklyBarChartComponent,
    WaveAreaChartComponent
  ],
  template: `
    <div class="dashboard-page animate-fade-in">
      <!-- 1. Top Row: 5 KPI Cards (Matching CRAVEAT top row) -->
      <section class="kpi-grid">
        <app-stat-card
          *ngFor="let card of kpiCards"
          [title]="card.title"
          [value]="card.value"
          [trend]="card.trend"
          [isPositive]="card.isPositive"
        >
        </app-stat-card>
      </section>

      <!-- 2. Second Row: Order Summary (3 Gauges), Overview (Donut), Top Items (List) -->
      <section class="mid-grid">
        <!-- Order Summary equivalent: Resumen Operativo -->
        <div class="dashboard-card glass-panel summary-panel">
          <div class="card-head">
            <div class="head-titles">
              <h3>Resumen Operativo</h3>
              <p class="subtitle">Disponibilidad del circuito de bombeo</p>
            </div>
            <div class="filter-dropdown">
              <span>Hoy</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <div class="gauges-row">
            <app-circular-gauge
              *ngFor="let gauge of operationGauges"
              [percentage]="gauge.percentage"
              [label]="gauge.label"
              [color]="gauge.color"
            >
            </app-circular-gauge>
          </div>
        </div>

        <!-- Overview equivalent: Distribución de Guardias -->
        <div class="dashboard-card glass-panel overview-panel">
          <div class="card-head">
            <div class="head-titles">
              <h3>Visión General</h3>
              <p class="subtitle">Aporte volumétrico por guardia</p>
            </div>
            <span class="view-all-link">Ver Todo</span>
          </div>

          <app-distribution-donut
            [heroPercentage]="shiftDistribution.heroPercentage"
            [slices]="shiftDistribution.slices"
          >
          </app-distribution-donut>
        </div>

        <!-- Top Selling Items equivalent: Equipos Críticos & Telemetría -->
        <div class="dashboard-card glass-panel top-items-panel">
          <div class="card-head">
            <div class="head-titles">
              <h3>Equipos Críticos</h3>
              <p class="subtitle">Telemetría de mayor impacto</p>
            </div>
            <span class="view-all-link">Ver Todo</span>
          </div>

          <div class="items-list">
            <div *ngFor="let item of topEquipment" class="item-row">
              <img [src]="item.imageUrl" [alt]="item.name" class="item-thumb" />
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-system">{{ item.system }}</span>
              </div>
              <span class="item-metric">{{ item.metric }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Third Row: Customer Map (Bar Chart) & Total Revenue (Wave Curve) -->
      <section class="bottom-grid">
        <!-- Weekly Comparison equivalent (Customer Map) -->
        <div class="dashboard-card glass-panel chart-panel">
          <app-weekly-bar-chart
            [title]="'Monitoreo Semanal de Caudales'"
            [subtitle]="'Comparativa día a día (m³/h)'"
            [data]="weeklyComparisonData"
          >
          </app-weekly-bar-chart>
        </div>

        <!-- Annual Production Curve equivalent (Total Revenue) -->
        <div class="dashboard-card glass-panel chart-panel">
          <app-wave-area-chart
            [title]="'Tonelaje Procesado y Rendimiento Anual'"
            [points]="productionCurveData"
          >
          </app-wave-area-chart>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 24px;

      @media (max-width: 768px) {
        gap: 14px;
      }
    }

    /* 1. Top KPI Row */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 18px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;

        app-stat-card:last-child {
          grid-column: span 2;
        }
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
        app-stat-card:last-child {
          grid-column: span 1;
        }
      }
    }

    /* 2. Middle Row */
    .mid-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1.1fr;
      gap: 20px;

      @media (max-width: 1280px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    /* 3. Bottom Row */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    .dashboard-card {
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;

      @media (max-width: 768px) {
        padding: 16px 14px;
        border-radius: var(--radius-md);
      }
    }

    .card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .head-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;

      h3 {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .subtitle {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
    }

    .filter-dropdown {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }
    }

    .view-all-link {
      font-size: 0.75rem;
      color: var(--primary-lavender);
      cursor: pointer;
      font-weight: 600;

      &:hover {
        text-decoration: underline;
      }
    }

    .gauges-row {
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 16px;
      padding: 10px 0;

      @media (max-width: 520px) {
        gap: 8px;

        app-circular-gauge {
          transform: scale(0.88);
          transform-origin: center;
        }
      }
    }

    /* Items List */
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .item-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      transition: var(--transition-smooth);

      &:hover {
        background: var(--bg-card-hover);
      }
    }

    .item-thumb {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      object-fit: cover;
      border: 1px solid var(--border-subtle);
    }

    .item-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .item-system {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .item-metric {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-primary);
    }
  `]
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);

  kpiCards = [
    { title: 'Caudal Total Slurry', value: '3,420 m³/h', trend: '+4.5%', isPositive: true },
    { title: 'Tonelaje Procesado', value: '48.2 kTon', trend: '+2.8%', isPositive: true },
    { title: 'Disponibilidad Planta', value: '94.5 %', trend: '+1.2%', isPositive: true },
    { title: 'Bombas en Servicio', value: '5 / 6', trend: 'Normal', isPositive: true },
    { title: 'Personal en Turno', value: '24 Oper.', trend: 'Turno A', isPositive: true }
  ];

  operationGauges = [
    { label: 'En Standby', percentage: 25, color: '#047857' },
    { label: 'Bombeo Activo', percentage: 85, color: '#059669' },
    { label: 'Alertas', percentage: 7, color: '#d97706' }
  ];

  shiftDistribution = {
    heroPercentage: 52,
    slices: [
      { name: 'Guardia A (Día)', percentage: 52, color: '#031795' },
      { name: 'Guardia B (Noche)', percentage: 33, color: '#2563eb' },
      { name: 'Guardia C (Relevo)', percentage: 15, color: '#60a5fa' }
    ]
  };

  topEquipment = [
    {
      name: 'Bomba Slurry PP-101',
      system: 'Alimentación Ciclones 01',
      metric: '1,850 m³/h',
      imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=120&q=80'
    },
    {
      name: 'Bomba Relaves TL-201',
      system: 'Transporte a Presa Principal',
      metric: '2,150 m³/h',
      imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=120&q=80'
    },
    {
      name: 'Batería Cyclopac 01',
      system: 'Clasificación Molienda',
      metric: '18.5 PSI',
      imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=120&q=80'
    }
  ];

  weeklyComparisonData = [
    { day: 'Dom', current: 780, previous: 650 },
    { day: 'Lun', current: 510, previous: 480 },
    { day: 'Mar', current: 740, previous: 520 },
    { day: 'Mié', current: 410, previous: 490 },
    { day: 'Jue', current: 430, previous: 530 },
    { day: 'Vie', current: 670, previous: 620 },
    { day: 'Sáb', current: 820, previous: 690 }
  ];

  productionCurveData = [
    { label: 'ene', value: 18 },
    { label: 'feb', value: 22 },
    { label: 'mar', value: 20 },
    { label: 'abr', value: 26 },
    { label: 'may', value: 34 },
    { label: 'jun', value: 45 },
    { label: 'jul', value: 30 },
    { label: 'ago', value: 35 },
    { label: 'sep', value: 39 },
    { label: 'oct', value: 42 },
    { label: 'nov', value: 50 },
    { label: 'dic', value: 58 }
  ];

  ngOnInit(): void {
    this.fetchMetrics();
  }

  fetchMetrics(): void {
    this.http.get<any>('http://localhost:3001/api/dashboard/metrics').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          if (d.kpiCards) this.kpiCards = d.kpiCards;
          if (d.operationSummary?.gauges) this.operationGauges = d.operationSummary.gauges;
          if (d.shiftDistribution) this.shiftDistribution = d.shiftDistribution;
          if (d.topCriticalEquipment) this.topEquipment = d.topCriticalEquipment;
          if (d.weeklyComparison?.days) this.weeklyComparisonData = d.weeklyComparison.days;
          if (d.productionCurve?.points) this.productionCurveData = d.productionCurve.points;
        }
      },
      error: (err) => {
        console.warn('[Dashboard] Usando datos locales de telemetría (fallback PWA offline)');
      }
    });
  }
}
