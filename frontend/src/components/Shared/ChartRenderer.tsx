import { useEffect, useState } from "react";
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
import { getAttachmentUrl } from "../../services/apiClient";

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chart.imagePath) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    getAttachmentUrl(chart.imagePath)
      .then((result) => {
        if (!cancelled) setImageUrl(result.url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chart.imagePath]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={chart.title || "Infographic"}
        className="w-full max-w-xl rounded-xl border border-black/10 dark:border-white/10"
      />
    );
  }

  if (chart.type === "facts" && chart.facts && chart.facts.length > 0) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 max-w-xl">
        {chart.title && <h3 className="text-sm font-medium mb-2">{chart.title}</h3>}
        <ul className="space-y-1 text-sm">
          {chart.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!chart.labels?.length || !chart.values?.length) return null;

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
