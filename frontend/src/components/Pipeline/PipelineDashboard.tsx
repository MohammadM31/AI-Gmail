// frontend/src/components/Pipeline/PipelineDashboard.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { getPipelineMetrics, listContacts } from "../../services/apiClient";
import { useUserStore } from "../../stores/userStore";
import type { Pipeline, PipelineMetrics, Contact } from "../../types";

interface PipelineWithContact extends Pipeline {
  contactName: string;
}

export function PipelineDashboard() {
  const [pipelines, setPipelines] = useState<PipelineWithContact[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load pipelines
      const { data: pipelineData, error: pipelineError } = await supabase
        .from("Pipeline")
        .select("*")
        .eq("userId", user?.id)
        .order("updatedAt", { ascending: false });

      if (pipelineError) throw pipelineError;

      // Load contacts for names
      const contacts = await listContacts();
      const contactMap = contacts.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);

      setPipelines((pipelineData || []).map((p: any) => ({
        ...p,
        contactName: contactMap[p.contactId] || 'Unknown Contact',
      })));

      // Load metrics
      const metricsData = await getPipelineMetrics();
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'archived': return 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const getProgress = (stages: any[]) => {
    const completed = stages.filter(s => s.status === 'complete').length;
    return Math.round((completed / stages.length) * 100);
  };

  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'sales': return '💰';
      case 'development': return '💻';
      case 'event': return '🎉';
      case 'job': return '💼';
      default: return '📋';
    }
  };

  const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) => (
    <div className={`rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs opacity-60">{label}</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                <div>
                  <div className="h-6 w-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-3 w-16 bg-gray-300 dark:bg-gray-700 rounded mt-1"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 p-4 text-red-500 text-sm">
        {error} <button className="underline" onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Active Projects"
          value={metrics?.activeCount || 0}
          icon="🚀"
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          label="Completed"
          value={metrics?.completedCount || 0}
          icon="✅"
          color="bg-green-100 dark:bg-green-900/30"
        />
        <StatCard
          label="Success Rate"
          value={`${metrics?.successRate || 0}%`}
          icon="📈"
          color="bg-purple-100 dark:bg-purple-900/30"
        />
        <StatCard
          label="Avg Duration"
          value={`${metrics?.avgCompletionDays || 0} days`}
          icon="⏱️"
          color="bg-yellow-100 dark:bg-yellow-900/30"
        />
      </div>

      {/* Pipeline List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Recent Pipelines</h3>
          <span className="text-xs opacity-40">{pipelines.length} total</span>
        </div>

        {pipelines.length === 0 && (
          <div className="text-center py-8 text-sm opacity-60 border border-dashed border-black/10 dark:border-white/10 rounded-xl">
            No pipelines yet. Create one from a contact's detail view!
          </div>
        )}

        {pipelines.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">{getProjectIcon(p.projectType)}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.projectName}</p>
                  <p className="text-xs opacity-60 truncate">with {p.contactName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(p.status)}`}>
                  {p.status}
                </span>
                <span className="text-xs opacity-40">
                  {p.stages.length} stages
                </span>
                <span className="text-xs font-medium w-10 text-right">
                  {getProgress(p.stages)}%
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-highlight rounded-full transition-all duration-500"
                style={{ width: `${getProgress(p.stages)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}