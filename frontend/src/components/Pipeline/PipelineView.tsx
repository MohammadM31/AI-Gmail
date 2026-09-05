// frontend/src/components/Pipeline/PipelineView.tsx
import { useEffect, useState } from "react";
import { getPipeline, generatePipeline, updatePipeline } from "../../services/apiClient";
import { PipelineTimeline } from "./PipelineTimeline";
import { PipelineAnalytics } from "./PipelineAnalytics";
import type { Pipeline, PipelineStage } from "../../types";

interface PipelineViewProps {
  contactId: string;
  contactName: string;
  threadId: string | null;
  onClose?: () => void;
  onEmailSelect?: (threadId: string) => void;
}

const PROJECT_ICONS: Record<string, string> = {
  sales: '💰',
  development: '💻',
  event: '🎉',
  job: '💼',
  general: '📋'
};

export function PipelineView({ contactId, contactName, threadId, onClose, onEmailSelect }: PipelineViewProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "analytics">("timeline");

  useEffect(() => {
    if (contactId) {
      loadPipeline();
    }
  }, [contactId]);

  async function loadPipeline() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPipeline(contactId);
      if (data.exists) {
        setPipeline(data.pipeline);
      } else {
        setPipeline(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!threadId) {
      setError("No thread found to analyze. Please send an email first.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await generatePipeline(contactId, threadId);
      setPipeline(result.pipeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate pipeline");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdate() {
    if (!threadId) {
      setError("No thread found to analyze.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await updatePipeline(contactId, threadId);
      setPipeline(result.pipeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pipeline");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            {pipeline && (
              <span className="text-xl">{PROJECT_ICONS[pipeline.projectType] || '📋'}</span>
            )}
            <h3 className="font-semibold">
              {pipeline ? pipeline.projectName : 'Project Pipeline'}
            </h3>
          </div>
          <p className="text-xs opacity-60">
            {pipeline ? `With ${contactName} • ${pipeline.projectType}` : `With ${contactName}`}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      {pipeline && (
        <div className="flex border-b border-black/10 dark:border-white/10 mb-4">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "timeline"
                ? "border-b-2 border-highlight text-highlight"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "analytics"
                ? "border-b-2 border-highlight text-highlight"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            📊 Analytics
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {!pipeline && (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm opacity-60">
            No workflow detected for {contactName}.
          </p>
          <p className="text-xs opacity-40">
            The AI will analyze your conversation and extract the actual workflow.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || !threadId}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {generating ? "Analyzing conversation..." : "🤖 Analyze Workflow"}
          </button>
          {!threadId && (
            <p className="text-xs text-highlight">
              Send an email to {contactName} first to analyze the workflow.
            </p>
          )}
        </div>
      )}

      {pipeline && activeTab === "timeline" && (
        <PipelineTimeline
          pipeline={pipeline}
          onUpdate={loadPipeline}
          onEmailSelect={onEmailSelect}
        />
      )}

      {pipeline && activeTab === "analytics" && (
        <PipelineAnalytics userId={pipeline.userId || ''} />
      )}

      {pipeline && (
        <div className="flex gap-2 pt-4 mt-4 border-t border-black/10 dark:border-white/10">
          <button
            onClick={handleUpdate}
            disabled={generating || !threadId}
            className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
          >
            {generating ? "Analyzing..." : "🔄 Update Pipeline"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
          >
            🔄 Regenerate
          </button>
        </div>
      )}

      {/* Context note */}
      {pipeline && (
        <div className="text-[10px] opacity-40 text-center border-t border-black/10 dark:border-white/10 pt-2 mt-4">
          AI analyzed {pipeline.stages.length} stages from your conversation
        </div>
      )}
    </div>
  );
}