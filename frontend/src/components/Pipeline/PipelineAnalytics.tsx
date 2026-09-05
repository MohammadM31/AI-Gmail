// frontend/src/components/Pipeline/PipelineAnalytics.tsx
import { useEffect, useState } from "react";
import { getPipelineMetrics } from "../../services/apiClient";
import type { PipelineMetrics } from "../../types";

interface PipelineAnalyticsProps {
  userId: string;
}

export function PipelineAnalytics({ userId }: PipelineAnalyticsProps) {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [userId]);

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPipelineMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">
        {error || 'Failed to load analytics'}
      </div>
    );
  }

  const StatCard = ({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) => (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs opacity-60 mt-1">{label}</div>
      {subtext && <div className="text-xs opacity-40 mt-0.5">{subtext}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Average Duration" 
          value={`${metrics.avgCompletionDays} days`}
          subtext="Time to complete a project"
        />
        <StatCard 
          label="Success Rate" 
          value={`${metrics.successRate}%`}
          subtext={`${metrics.completedCount} completed / ${metrics.totalCount} total`}
        />
        <StatCard 
          label="Active Projects" 
          value={metrics.activeCount}
          subtext="Currently in progress"
        />
        <StatCard 
          label="Completed Projects" 
          value={metrics.completedCount}
          subtext="Successfully finished"
        />
      </div>

      {/* Bottleneck Stages */}
      {metrics.bottleneckStages.length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
          <h4 className="text-sm font-medium mb-3">🚧 Bottleneck Stages</h4>
          <div className="space-y-2">
            {metrics.bottleneckStages.map((stage, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-32 truncate">{stage.name}</span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full"
                    style={{ width: `${Math.min((stage.avgDuration / 30) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs opacity-60 w-20 text-right">
                  {stage.avgDuration} days avg
                </span>
                <span className="text-xs opacity-40 w-16 text-right">
                  ({stage.count} projects)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duration by Type */}
      {Object.keys(metrics.avgDurationByType).length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
          <h4 className="text-sm font-medium mb-3">📊 Average Duration by Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(metrics.avgDurationByType).map(([type, duration]) => (
              <div key={type} className="text-center p-2 rounded-lg bg-black/5 dark:bg-white/5">
                <div className="text-sm font-medium capitalize">{type}</div>
                <div className="text-xs opacity-60">{duration} days</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Trends */}
      {metrics.monthlyTrends.length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
          <h4 className="text-sm font-medium mb-3">📈 Monthly Trends</h4>
          <div className="flex items-end gap-2 h-32">
            {metrics.monthlyTrends.map((trend) => (
              <div key={trend.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-1 w-full">
                  <div 
                    className="flex-1 bg-green-500 rounded-t"
                    style={{ height: `${(trend.completed / Math.max(...metrics.monthlyTrends.map(t => t.completed + t.started), 1)) * 80}px` }}
                    title={`Completed: ${trend.completed}`}
                  />
                  <div 
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{ height: `${(trend.started / Math.max(...metrics.monthlyTrends.map(t => t.completed + t.started), 1)) * 80}px` }}
                    title={`Started: ${trend.started}`}
                  />
                </div>
                <span className="text-xs opacity-40">{trend.month}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded"></span> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded"></span> Started
            </span>
          </div>
        </div>
      )}
    </div>
  );
}