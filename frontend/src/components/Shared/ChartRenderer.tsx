import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData } from "../../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
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
        backgroundColor: ["#4a90e2", "#e94560", "#0f3460", "#16213e", "#f5a623"],
        borderColor: "#4a90e2",
      },
    ],
  };

  const options = { responsive: true, plugins: { legend: { display: chart.type === "pie" } } };

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{chart.title}</h3>
        <button
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => window.print()}
        >
          Download
        </button>
      </div>
      {chart.type === "bar" && <Bar data={data} options={options} />}
      {chart.type === "line" && <Line data={data} options={options} />}
      {chart.type === "pie" && <Pie data={data} options={options} />}
    </div>
  );
}
