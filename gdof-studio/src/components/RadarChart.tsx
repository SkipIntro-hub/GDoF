import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { GDoFCoefficients } from '../lib/llm';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface RadarChartProps {
  coefficients: GDoFCoefficients;
}

export const RadarChart: React.FC<RadarChartProps> = ({ coefficients }) => {
  const data = {
    labels: [
      'Alcance (T1)',
      'Profundidad (T2)',
      'Formato (T3)',
      'Estilo (R1)',
      'Lógica (R2)',
      'Rigor (R3)',
    ],
    datasets: [
      {
        label: 'Calibración GDoF',
        data: [
          coefficients.scope,
          coefficients.depth,
          coefficients.format,
          coefficients.style,
          coefficients.logic,
          coefficients.rigor,
        ],
        backgroundColor: 'rgba(139, 92, 246, 0.25)', // Purple glow fill
        borderColor: 'rgba(139, 92, 246, 1)', // Purple border
        borderWidth: 2,
        pointBackgroundColor: '#06b6d4', // Cyan points
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        pointRadius: 4.5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#ec4899', // Pink glow on hover
      },
    ],
  };

  const options: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          color: 'rgba(255, 255, 255, 0.4)',
          backdropColor: 'transparent',
          font: {
            family: 'Space Mono',
            size: 9,
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.15)',
        },
        pointLabels: {
          color: '#e5e7eb',
          font: {
            family: 'Orbitron',
            size: 10,
            weight: 'bold',
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false, // We hide the legend as we only have one dataset
      },
      tooltip: {
        callbacks: {
          label: (context) => ` Nivel: ${context.raw}/5`,
        },
        titleFont: {
          family: 'Orbitron',
        },
        bodyFont: {
          family: 'Space Mono',
        },
      },
    },
  };

  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <Radar data={data} options={options} />
    </div>
  );
};
