// frontend/src/components/Pipeline/PipelineTimeline.tsx
import { useState } from "react";
import type { Pipeline, PipelineStage } from "../../types";
import { updatePipelineStage } from "../../services/apiClient";

interface PipelineTimelineProps {
  pipeline: Pipeline;
  onUpdate: () => void;
  onEmailSelect?: (threadId: string) => void;
}

export function PipelineTimeline({ pipeline, onUpdate, onEmailSelect }: PipelineTimelineProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'pending': return 'bg-gray-300 dark:bg-gray-600';
      default: return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'complete': return '✅';
      case 'in-progress': return '🔄';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete': return 'Complete';
      case 'in-progress': return 'In Progress';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Not started';
    const d = new Date(date);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDuration = (stage: PipelineStage) => {
    if (stage.duration !== undefined) return stage.duration;
    if (stage.startedAt && stage.completedAt) {
      const start = new Date(stage.startedAt);
      const end = new Date(stage.completedAt);
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (stage.startedAt) {
      const start = new Date(stage.startedAt);
      const now = new Date();
      return Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 0;
  };

  const handleStatusChange = async (stageId: string, newStatus: string) => {
    setUpdating(stageId);
    setError(null);
    try {
      await updatePipelineStage(pipeline.id, stageId, newStatus);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage');
    } finally {
      setUpdating(null);
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const order = ['pending', 'in-progress', 'complete'];
    const index = order.indexOf(currentStatus);
    if (index < order.length - 1) return order[index + 1];
    return null;
  };

  const isOverdue = (stage: PipelineStage) => {
    if (stage.status === 'complete') return false;
    if (!stage.dueDate) return false;
    return new Date(stage.dueDate) < new Date();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{pipeline.projectName}</h3>
          <div className="flex items-center gap-2 text-sm opacity-60">
            <span>{pipeline.contactName}</span>
            <span>•</span>
            <span className="capitalize">{pipeline.projectType}</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              pipeline.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              pipeline.status === 'archived' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {pipeline.status}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="opacity-60">Total Duration</div>
          <div className="font-medium">
            {pipeline.totalDuration !== undefined ? `${pipeline.totalDuration} days` : '—'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-highlight transition-all duration-500"
            style={{
              width: `${(sortedStages.filter(s => s.status === 'complete').length / sortedStages.length) * 100}%`
            }}
          />
        </div>
        <span className="text-xs opacity-60 whitespace-nowrap">
          {sortedStages.filter(s => s.status === 'complete').length}/{sortedStages.length}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative pl-8 space-y-0">
        {/* Vertical line */}
        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-300 dark:bg-gray-600" />

        {sortedStages.map((stage, index) => {
          const isLast = index === sortedStages.length - 1;
          const duration = getDuration(stage);
          const overdue = isOverdue(stage);

          return (
            <div key={stage.id} className="relative pb-6 last:pb-0">
              {/* Timeline Dot */}
              <div className="absolute -left-5 top-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${getStatusColor(stage.status)} text-white`}>
                  {getStatusEmoji(stage.status)}
                </div>
                {!isLast && (
                  <div className={`absolute top-6 left-1/2 w-0.5 h-8 -translate-x-1/2 ${
                    stage.status === 'complete' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>

              {/* Stage Content */}
              <div className={`ml-6 p-4 rounded-xl border ${
                stage.status === 'complete' 
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : stage.status === 'in-progress'
                  ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  : 'bg-surface-light dark:bg-surface-dark border-black/10 dark:border-white/10'
              }`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-medium ${
                        stage.status === 'complete' ? 'line-through opacity-60' : ''
                      }`}>
                        {stage.name}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        stage.status === 'complete' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : stage.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400'
                      }`}>
                        {getStatusLabel(stage.status)}
                      </span>
                      {overdue && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          ⚠️ Overdue
                        </span>
                      )}
                    </div>
                    {stage.description && (
                      <p className="text-sm opacity-60 mt-0.5">{stage.description}</p>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="text-xs opacity-60 text-right shrink-0 space-y-0.5">
                    {stage.startedAt && (
                      <div>Started: {formatDate(stage.startedAt)}</div>
                    )}
                    {stage.completedAt && (
                      <div>Completed: {formatDate(stage.completedAt)}</div>
                    )}
                    {stage.dueDate && (
                      <div className={overdue ? 'text-red-500 font-medium' : ''}>
                        Due: {formatDate(stage.dueDate)}
                      </div>
                    )}
                    {duration > 0 && (
                      <div className="opacity-40">Duration: {duration} day{duration !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>

                {/* Related Emails */}
                {stage.emailIds && stage.emailIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs opacity-40">Related emails:</span>
                    {stage.emailIds.map((emailId) => (
                      <button
                        key={emailId}
                        onClick={() => onEmailSelect?.(emailId)}
                        className="text-xs underline opacity-60 hover:opacity-100"
                      >
                        #{emailId.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {stage.status !== 'complete' && (
                    <button
                      onClick={() => handleStatusChange(stage.id, getNextStatus(stage.status) || 'complete')}
                      disabled={updating === stage.id}
                      className="text-xs px-3 py-1 rounded-full bg-highlight text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {updating === stage.id ? 'Updating...' : `Mark ${getNextStatus(stage.status) || 'Complete'}`}
                    </button>
                  )}
                  {stage.status === 'in-progress' && (
                    <button
                      onClick={() => handleStatusChange(stage.id, 'pending')}
                      disabled={updating === stage.id}
                      className="text-xs px-3 py-1 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    >
                      Move Back
                    </button>
                  )}
                  {stage.status === 'complete' && (
                    <button
                      onClick={() => handleStatusChange(stage.id, 'in-progress')}
                      disabled={updating === stage.id}
                      className="text-xs px-3 py-1 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}