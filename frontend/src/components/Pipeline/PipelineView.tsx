// frontend/src/components/Pipeline/PipelineView.tsx
import { useEffect, useState } from "react";
import { getPipeline, generatePipeline, updatePipeline } from "../../services/apiClient";
import type { Pipeline, PipelineStage } from "../../types";

interface PipelineViewProps {
  contactId: string;
  contactName: string;
  threadId: string | null;
  onClose?: () => void;
}

const PROJECT_ICONS: Record<string, string> = {
  sales: '💰',
  development: '💻',
  event: '🎉',
  job: '💼',
  general: '📋'
};

const STATUS_EMOJIS = {
  complete: '✅',
  'in-progress': '🔄',
  pending: '⏳'
};

export function PipelineView({ contactId, contactName, threadId, onClose }: PipelineViewProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function getStatusColor(status: string) {
    switch (status) {
      case 'complete':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-blue-500 animate-pulse';
      case 'pending':
        return 'bg-gray-300 dark:bg-gray-600';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  }

  function getStatusEmoji(status: string) {
    return STATUS_EMOJIS[status as keyof typeof STATUS_EMOJIS] || '⏳';
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

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* No pipeline state */}
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

      {/* Pipeline visualization */}
      {pipeline && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-highlight transition-all duration-500"
                style={{
                  width: `${(pipeline.stages.filter(s => s.status === 'complete').length / pipeline.stages.length) * 100}%`
                }}
              />
            </div>
            <span className="text-xs opacity-60 whitespace-nowrap">
              {pipeline.stages.filter(s => s.status === 'complete').length}/{pipeline.stages.length}
            </span>
          </div>

          {/* Stages - Context Specific */}
          <div className="space-y-3">
            {pipeline.stages.map((stage, index) => (
              <div
                key={stage.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  stage.status === 'in-progress' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : stage.status === 'complete'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {/* Status indicator */}
                <div className="relative flex items-center justify-center mt-0.5">
                  <div className={`w-4 h-4 rounded-full ${getStatusColor(stage.status)}`}>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px]">
                      {getStatusEmoji(stage.status)}
                    </div>
                  </div>
                  {index < pipeline.stages.length - 1 && (
                    <div className={`absolute top-4 left-1/2 w-0.5 h-6 ${
                      stage.status === 'complete' 
                        ? 'bg-green-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                </div>

                {/* Stage content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          stage.status === 'complete' ? 'line-through opacity-60' : ''
                        }`}>
                          {stage.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          stage.status === 'complete' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : stage.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400'
                        }`}>
                          {stage.status}
                        </span>
                      </div>
                      {stage.description && (
                        <p className="text-xs opacity-60 mt-0.5">{stage.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
            <button
              onClick={handleUpdate}
              disabled={generating || !threadId}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              {generating ? "Analyzing..." : "🔄 Update Status"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              🔄 Regenerate
            </button>
          </div>

          {/* Context note */}
          <div className="text-[10px] opacity-40 text-center border-t border-black/10 dark:border-white/10 pt-2">
            AI analyzed {pipeline.stages.length} stages from your conversation
          </div>
        </div>
      )}
    </div>
  );
}