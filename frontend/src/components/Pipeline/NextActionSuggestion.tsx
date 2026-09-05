// frontend/src/components/Pipeline/NextActionSuggestion.tsx
import { useState } from "react";
import { processMessage } from "../../services/apiClient";
import type { Pipeline } from "../../types";

interface NextActionSuggestionProps {
  pipeline: Pipeline;
  threadId: string | null;
}

export function NextActionSuggestion({ pipeline, threadId }: NextActionSuggestionProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSuggestion = async () => {
    if (!threadId) {
      setError("No thread found to analyze.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Get current stage in progress
      const currentStage = pipeline.stages.find(s => s.status === 'in-progress');
      if (!currentStage) {
        const hasPending = pipeline.stages.some(s => s.status === 'pending');
        if (hasPending) {
          setSuggestion('The next stage is ready to start. Move the first pending stage to "In Progress".');
        } else {
          setSuggestion('🎉 All stages are complete! Great work!');
        }
        setLoading(false);
        return;
      }

      // Build context for AI
      const stageContext = `
Project: ${pipeline.projectName}
Current Stage: ${currentStage.name} (${currentStage.status})
Stage Description: ${currentStage.description || 'No description'}
Previous Stages: ${pipeline.stages.filter(s => s.status === 'complete').map(s => s.name).join(' → ') || 'None'}
`;

      // Get AI suggestion
      const result = await processMessage(
        `${stageContext}

Based on this project context, what is the specific next action the user should take for this stage?

Keep it brief and actionable (1-2 sentences). Focus on concrete tasks.`
      );

      setSuggestion(result.bulletPoints[0] || 'Review the conversation and determine the next logical step.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestion');
      setSuggestion('Try reviewing the conversation and identifying what needs to happen next.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">💡</span>
        <span className="text-sm font-medium">Next Action</span>
        <button
          onClick={getSuggestion}
          disabled={loading}
          className="ml-auto text-xs underline opacity-60 hover:opacity-100 disabled:opacity-30"
        >
          {loading ? 'Analyzing...' : 'Get Suggestion'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500 mt-1">{error}</div>
      )}

      {suggestion && !error && (
        <p className="text-sm mt-1 opacity-80">{suggestion}</p>
      )}

      {!suggestion && !loading && !error && (
        <p className="text-sm mt-1 opacity-40">
          Click "Get Suggestion" for AI-powered next action.
        </p>
      )}
    </div>
  );
}