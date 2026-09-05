// frontend/src/components/Pipeline/DraggablePipeline.tsx
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { Pipeline, PipelineStage } from "../../types";
import { useState } from "react";
import { updatePipelineStages } from "../../services/apiClient";

interface DraggablePipelineProps {
  pipeline: Pipeline;
  onUpdate: () => void;
  onStageClick?: (stage: PipelineStage) => void;
}

export function DraggablePipeline({ pipeline, onUpdate, onStageClick }: DraggablePipelineProps) {
  const [stages, setStages] = useState(pipeline.stages);
  const [isReordering, setIsReordering] = useState(false);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order property
    const updatedStages = items.map((stage, index) => ({
      ...stage,
      order: index
    }));

    setStages(updatedStages);
    setIsReordering(true);

    try {
      await updatePipelineStages(pipeline.id, updatedStages);
      onUpdate();
    } catch (err) {
      // Revert on error
      setStages(pipeline.stages);
      console.error("Failed to reorder stages:", err);
    } finally {
      setIsReordering(false);
    }
  };

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

  return (
    <div className="space-y-3">
      {isReordering && (
        <div className="text-xs opacity-60 animate-pulse">Reordering stages...</div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stages">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-2 transition-colors ${
                snapshot.isDraggingOver ? 'bg-black/5 dark:bg-white/5 rounded-lg p-2' : ''
              }`}
            >
              {stages.map((stage, index) => (
                <Draggable
                  key={stage.id}
                  draggableId={stage.id}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`p-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark transition-all ${
                        snapshot.isDragging
                          ? 'shadow-lg scale-105 ring-2 ring-highlight'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      onClick={() => onStageClick?.(stage)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Drag handle */}
                        <div className="text-xs opacity-30 cursor-grab select-none">
                          ⋮⋮
                        </div>

                        {/* Status dot */}
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(stage.status)}`} />

                        {/* Stage info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{stage.name}</span>
                            <span className="text-xs opacity-40">
                              {getStatusEmoji(stage.status)}
                            </span>
                          </div>
                          {stage.description && (
                            <p className="text-xs opacity-60 truncate">{stage.description}</p>
                          )}
                        </div>

                        {/* Duration */}
                        {stage.duration !== undefined && stage.duration > 0 && (
                          <div className="text-xs opacity-40 shrink-0">
                            {stage.duration}d
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}