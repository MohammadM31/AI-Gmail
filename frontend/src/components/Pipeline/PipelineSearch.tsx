// frontend/src/components/Pipeline/PipelineSearch.tsx
import { useState, useEffect } from "react";

export interface PipelineFilters {
  search: string;
  type: string;
  status: string;
  dateRange: string;
}

interface PipelineSearchProps {
  onFilter: (filters: PipelineFilters) => void;
  initialFilters?: Partial<PipelineFilters>;
}

export function PipelineSearch({ onFilter, initialFilters = {} }: PipelineSearchProps) {
  const [filters, setFilters] = useState<PipelineFilters>({
    search: initialFilters.search || '',
    type: initialFilters.type || 'all',
    status: initialFilters.status || 'all',
    dateRange: initialFilters.dateRange || 'all',
  });

  // Auto-apply filters on change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilter(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleChange = (key: keyof PipelineFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      type: 'all',
      status: 'all',
      dateRange: 'all',
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[150px]">
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
            placeholder="Search pipelines..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
          />
        </div>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={filters.type}
          onChange={(e) => handleChange('type', e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="sales">💰 Sales</option>
          <option value="development">💻 Development</option>
          <option value="event">🎉 Event</option>
          <option value="job">💼 Job</option>
          <option value="general">📋 General</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">🔄 Active</option>
          <option value="completed">✅ Completed</option>
          <option value="archived">📦 Archived</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={filters.dateRange}
          onChange={(e) => handleChange('dateRange', e.target.value)}
        >
          <option value="all">Any Time</option>
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="90days">Last 90 days</option>
        </select>

        <button
          onClick={resetFilters}
          className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Reset
        </button>
      </div>

      {/* Active filters display */}
      {(filters.search || filters.type !== 'all' || filters.status !== 'all' || filters.dateRange !== 'all') && (
        <div className="flex flex-wrap gap-1 text-xs opacity-60">
          <span>Active filters:</span>
          {filters.search && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">"{filters.search}"</span>}
          {filters.type !== 'all' && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">{filters.type}</span>}
          {filters.status !== 'all' && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">{filters.status}</span>}
          {filters.dateRange !== 'all' && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">{filters.dateRange}</span>}
        </div>
      )}
    </div>
  );
}