import { Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter, Bubble } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData } from "../../types";

// ✅ Register all chart types
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend
);

export function ChartRenderer({ chart }: { chart: ChartData }) {
  const data = {
    labels: chart.labels,
    datasets: [
      {
        label: chart.title,
        data: chart.values,
        backgroundColor: ["#4a90e2", "#e94560", "#0f3460", "#16213e", "#f5a623", "#2ecc71", "#9b59b6"],
        borderColor: "#4a90e2",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: chart.type === "pie" || chart.type === "doughnut" || chart.type === "polarArea" },
    },
  };

  // ✅ Render based on chart type
  switch (chart.type) {
    case "bar":
      return <Bar data={data} options={options} />;
    case "line":
      return <Line data={data} options={options} />;
    case "pie":
      return <Pie data={data} options={options} />;
    case "doughnut":
      return <Doughnut data={data} options={options} />;
    case "radar":
      return <Radar data={data} options={options} />;
    case "polarArea":
      return <PolarArea data={data} options={options} />;
    case "scatter":
      return <Scatter data={data} options={options} />;
    case "bubble":
      return <Bubble data={data} options={options} />;
    default:
      return <Bar data={data} options={options} />;
  }
}