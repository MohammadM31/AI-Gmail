// frontend/src/components/Pipeline/PipelineTemplate.tsx
import { useState } from "react";
import type { PipelineStage } from "../../types";

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  projectType: 'sales' | 'development' | 'event' | 'job' | 'general';
  industry: string;
  defaultStages: {
    name: string;
    description: string;
    estimatedDuration: number;
  }[];
}

export const DEFAULT_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'sales',
    name: 'Sales Pipeline',
    description: 'Standard sales process from lead to closed deal',
    projectType: 'sales',
    industry: 'General',
    defaultStages: [
      { name: 'Lead Identified', description: 'Initial contact made', estimatedDuration: 2 },
      { name: 'Qualification', description: 'Assessing fit and budget', estimatedDuration: 3 },
      { name: 'Proposal Sent', description: 'Proposal shared with client', estimatedDuration: 5 },
      { name: 'Negotiation', description: 'Terms and pricing discussion', estimatedDuration: 4 },
      { name: 'Contract Signed', description: 'Deal closed', estimatedDuration: 2 },
      { name: 'Onboarding', description: 'Client implementation', estimatedDuration: 7 },
    ]
  },
  {
    id: 'development',
    name: 'Development Sprint',
    description: 'Agile development workflow',
    projectType: 'development',
    industry: 'Software',
    defaultStages: [
      { name: 'Requirements', description: 'Gather and document requirements', estimatedDuration: 3 },
      { name: 'Design', description: 'Architecture and UI design', estimatedDuration: 4 },
      { name: 'Development', description: 'Implementation and coding', estimatedDuration: 10 },
      { name: 'Testing', description: 'QA and bug fixes', estimatedDuration: 5 },
      { name: 'Deployment', description: 'Release to production', estimatedDuration: 2 },
      { name: 'Review', description: 'Post-launch analysis', estimatedDuration: 2 },
    ]
  },
  {
    id: 'event',
    name: 'Event Planning',
    description: 'End-to-end event planning and execution',
    projectType: 'event',
    industry: 'Events',
    defaultStages: [
      { name: 'Concept', description: 'Define event concept and goals', estimatedDuration: 3 },
      { name: 'Venue & Date', description: 'Secure venue and finalize date', estimatedDuration: 5 },
      { name: 'Vendors', description: 'Book caterers, AV, entertainment', estimatedDuration: 7 },
      { name: 'Marketing', description: 'Promotion and ticket sales', estimatedDuration: 14 },
      { name: 'Execution', description: 'Event day operations', estimatedDuration: 1 },
      { name: 'Follow-up', description: 'Post-event thank you and survey', estimatedDuration: 3 },
    ]
  },
  {
    id: 'job',
    name: 'Job Search',
    description: 'Track job applications and interviews',
    projectType: 'job',
    industry: 'General',
    defaultStages: [
      { name: 'Application', description: 'Submitted application', estimatedDuration: 1 },
      { name: 'Phone Screen', description: 'Initial recruiter call', estimatedDuration: 3 },
      { name: 'Technical Interview', description: 'Skills assessment', estimatedDuration: 5 },
      { name: 'On-site Interview', description: 'In-person or virtual panel', estimatedDuration: 7 },
      { name: 'Offer Decision', description: 'Waiting for offer or rejection', estimatedDuration: 5 },
      { name: 'Negotiation', description: 'Salary and terms discussion', estimatedDuration: 3 },
    ]
  },
];

interface PipelineTemplateSelectorProps {
  onSelect: (template: PipelineTemplate) => void;
  onClose: () => void;
}

export function PipelineTemplateSelector({ onSelect, onClose }: PipelineTemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">📝 Choose a Pipeline Template</h3>
        <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">×</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEFAULT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedId(template.id)}
            className={`p-4 rounded-xl border text-left transition ${
              selectedId === template.id
                ? 'border-highlight ring-2 ring-highlight/20'
                : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{template.name}</h4>
              <span className="text-xs opacity-40">{template.industry}</span>
            </div>
            <p className="text-xs opacity-60 mt-1">{template.description}</p>
            <p className="text-xs opacity-40 mt-2">
              {template.defaultStages.length} stages
            </p>
          </button>
        ))}
      </div>

      {selectedId && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              const template = DEFAULT_TEMPLATES.find(t => t.id === selectedId);
              if (template) onSelect(template);
            }}
            className="flex-1 rounded-full bg-highlight px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Use This Template
          </button>
          <button
            onClick={() => setSelectedId(null)}
            className="px-4 py-2 text-sm rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}