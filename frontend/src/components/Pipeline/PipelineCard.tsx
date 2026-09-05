// frontend/src/components/Pipeline/PipelineCard.tsx
import type { Pipeline } from "../../types";

interface PipelineCardProps {
  pipeline: Pipeline;
  onClick: () => void;
  contactName: string;
}

export function PipelineCard({ pipeline, onClick, contactName }: PipelineCardProps) {
  const getProgress = () => {
    const completed = pipeline.stages.filter(s => s.status === 'complete').length;
    return Math.round((completed / pipeline.stages.length) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'archived': return 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
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

  const getDaysSince = (date: string) => {
    const days = Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : `${days} days ago`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{getProjectIcon(pipeline.projectType)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{pipeline.projectName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(pipeline.status)}`}>
                {pipeline.status}
              </span>
            </div>
            <p className="text-xs opacity-60 truncate">with {contactName}</p>
          </div>
        </div>
        <div className="text-right text-xs shrink-0 ml-2">
          <div className="opacity-60">{getDaysSince(pipeline.updatedAt)}</div>
          <div className="opacity-40">{pipeline.stages.length} stages</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-highlight transition-all duration-500"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <span className="text-xs font-medium w-8 text-right">{getProgress()}%</span>
      </div>

      {/* Stage preview */}
      <div className="mt-2 flex flex-wrap gap-1">
        {pipeline.stages.slice(0, 4).map((stage) => (
          <span
            key={stage.id}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              stage.status === 'complete' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              stage.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400'
            }`}
          >
            {stage.name}
          </span>
        ))}
        {pipeline.stages.length > 4 && (
          <span className="text-[10px] opacity-40">+{pipeline.stages.length - 4} more</span>
        )}
      </div>
    </button>
  );
}