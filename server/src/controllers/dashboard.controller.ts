import { Request, Response } from 'express';
import { db } from '../database/db.js';

export function getDashboardMetrics(req: Request, res: Response) {
  try {
    // 1. Live aggregations from tables
    const pumps = db.prepare('SELECT * FROM pump_reports').all() as any[];
    const operatingPumps = pumps.filter(p => p.status === 'OPERATING').length;
    const totalPumps = pumps.length;
    const totalFlowRate = pumps.reduce((acc, p) => acc + (p.flow_rate_m3h || 0), 0);

    const cyclones = db.prepare('SELECT * FROM cyclone_reports').all() as any[];
    const avgFeedPressure = cyclones.length > 0 
      ? (cyclones.reduce((acc, c) => acc + c.feed_pressure_psi, 0) / cyclones.length).toFixed(1)
      : '18.2';

    const tailings = db.prepare('SELECT * FROM tailings_reports').all() as any[];
    const avgSolids = tailings.length > 0
      ? (tailings.reduce((acc, t) => acc + t.solids_percentage, 0) / tailings.length).toFixed(1)
      : '64.5';

    const maintTickets = db.prepare('SELECT * FROM maintenance_requests').all() as any[];
    const pendingTickets = maintTickets.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;

    const latestShift = db.prepare('SELECT * FROM shift_handovers ORDER BY created_at DESC LIMIT 1').get() as any;

    // 2. Format response matching CRAVEAT layout
    const response = {
      success: true,
      data: {
        kpiCards: [
          {
            id: 'flow_rate',
            title: 'Caudal Total Slurry',
            value: `${Math.round(totalFlowRate).toLocaleString()} m³/h`,
            trend: '+4.5%',
            isPositive: true,
            icon: 'waves'
          },
          {
            id: 'tonnage',
            title: 'Tonelaje Procesado',
            value: `${latestShift ? (latestShift.tonnage_processed / 1000).toFixed(1) : '48.2'} kTon`,
            trend: '+2.8%',
            isPositive: true,
            icon: 'weight'
          },
          {
            id: 'availability',
            title: 'Disponibilidad Planta',
            value: '94.5 %',
            trend: '+1.2%',
            isPositive: true,
            icon: 'activity'
          },
          {
            id: 'pumps_status',
            title: 'Bombas en Servicio',
            value: `${operatingPumps} / ${totalPumps}`,
            trend: 'Normal',
            isPositive: true,
            icon: 'cpu'
          },
          {
            id: 'operators',
            title: 'Personal en Guardia',
            value: '24 Oper.',
            trend: 'Turno A',
            isPositive: true,
            icon: 'users'
          }
        ],

        // Gauge indicators (Order Summary equivalent)
        operationSummary: {
          title: 'Resumen Operativo del Circuito',
          filter: 'Turno Actual',
          gauges: [
            { label: 'En Standby', percentage: 25, color: '#a855f7' },
            { label: 'Bombeo Activo', percentage: 85, color: '#8b5cf6' },
            { label: 'Alertas / Desvíos', percentage: 7, color: '#c084fc' }
          ]
        },

        // Shift distribution donut (Overview equivalent)
        shiftDistribution: {
          title: 'Distribución por Guardias',
          subtitle: 'Rendimiento volumétrico semanal',
          percentageHero: 52,
          slices: [
            { name: 'Guardia A (Día)', percentage: 52, color: '#a855f7' },
            { name: 'Guardia B (Noche)', percentage: 33, color: '#38bdf8' },
            { name: 'Guardia C (Relevo)', percentage: 15, color: '#f43f5e' }
          ]
        },

        // Top critical equipment (Top Selling Items equivalent)
        topCriticalEquipment: [
          {
            id: 'PP-101',
            name: 'Bomba Slurry PP-101',
            system: 'Alimentación Ciclones',
            metric: '1,850 m³/h',
            status: 'OPERATING',
            badgeColor: 'success',
            imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=120&q=80'
          },
          {
            id: 'TL-201',
            name: 'Bomba Relaves TL-201',
            system: 'Transporte Relaves',
            metric: '2,150 m³/h',
            status: 'OPERATING',
            badgeColor: 'success',
            imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=120&q=80'
          },
          {
            id: 'PP-102',
            name: 'Bomba Reserva PP-102',
            system: 'Standby / Vibración',
            metric: '4.8 mm/s',
            status: 'STANDBY',
            badgeColor: 'warning',
            imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=120&q=80'
          }
        ],

        // Weekly comparative bar chart (Customer Map equivalent)
        weeklyComparison: {
          title: 'Monitoreo Semanal de Caudales',
          subtitle: 'Caudal promedio diario en m³/h',
          series: [
            { name: 'Turno Actual', color: '#a855f7' },
            { name: 'Turno Anterior', color: '#f472b6' }
          ],
          days: [
            { day: 'Dom', current: 780, previous: 650 },
            { day: 'Lun', current: 510, previous: 480 },
            { day: 'Mar', current: 740, previous: 520 },
            { day: 'Mié', current: 410, previous: 490 },
            { day: 'Jue', current: 430, previous: 530 },
            { day: 'Vie', current: 670, previous: 620 },
            { day: 'Sáb', current: 820, previous: 690 }
          ]
        },

        // Production wave curve (Total Revenue equivalent)
        productionCurve: {
          title: 'Producción Acumulada y Presión de Transporte',
          subtitle: 'Histórico anual en kTon / bar',
          points: [
            { label: 'Ene', value: 18 },
            { label: 'Feb', value: 22 },
            { label: 'Mar', value: 20 },
            { label: 'Abr', value: 26 },
            { label: 'May', value: 34 },
            { label: 'Jun', value: 45 },
            { label: 'Jul', value: 30 },
            { label: 'Ago', value: 35 },
            { label: 'Sep', value: 39 },
            { label: 'Oct', value: 42 },
            { label: 'Nov', value: 50 },
            { label: 'Dic', value: 58 }
          ]
        }
      }
    };

    return res.json(response);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
