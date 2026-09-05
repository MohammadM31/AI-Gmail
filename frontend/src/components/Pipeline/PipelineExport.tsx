// frontend/src/components/Pipeline/PipelineExport.tsx
import { useState } from "react";
import { exportPipelineToPDF, exportPipelineToCSV, exportPipelineToJSON } from "../../utils/pipelineExport";
import type { Pipeline } from "../../types";

interface PipelineExportProps {
  pipeline: Pipeline;
  contactName: string;
}

export function PipelineExport({ pipeline, contactName }: PipelineExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    setExporting(format);
    try {
      switch (format) {
        case 'pdf':
          exportPipelineToPDF(pipeline, contactName);
          break;
        case 'csv':
          exportPipelineToCSV(pipeline);
          break;
        case 'json':
          exportPipelineToJSON(pipeline);
          break;
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export pipeline: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
      >
        📤 Export
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-1 shadow-lg">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting === 'pdf'}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              {exporting === 'pdf' ? 'Exporting...' : '📄 Export as PDF'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting === 'csv'}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              {exporting === 'csv' ? 'Exporting...' : '📊 Export as CSV'}
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting === 'json'}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              {exporting === 'json' ? 'Exporting...' : '📋 Export as JSON'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}