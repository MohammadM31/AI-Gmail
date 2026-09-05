// frontend/src/components/Pipeline/PipelineNotifications.tsx
import { useEffect, useState } from "react";
import { getPipelineNotifications } from "../../services/apiClient";

interface Notification {
  type: 'overdue' | 'stuck';
  pipelineId: string;
  projectName: string;
  stageName: string;
  daysOverdue?: number;
  daysInProgress?: number;
}

export function PipelineNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const data = await getPipelineNotifications();
      const all: Notification[] = [
        ...data.overdue.map((n: any) => ({ ...n, type: 'overdue' as const })),
        ...data.stuck.map((n: any) => ({ ...n, type: 'stuck' as const })),
      ];
      setNotifications(all);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'overdue': return '⚠️';
      case 'stuck': return '🔄';
      default: return '📢';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'stuck': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const getMessage = (n: Notification) => {
    if (n.type === 'overdue') {
      return `"${n.stageName}" is ${n.daysOverdue} days overdue in "${n.projectName}"`;
    }
    return `"${n.stageName}" has been in progress for ${n.daysInProgress} days in "${n.projectName}"`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5"
      >
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-80 max-h-96 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark shadow-lg p-2">
            <div className="flex items-center justify-between px-2 py-1 border-b border-black/10 dark:border-white/10">
              <span className="text-sm font-medium">Notifications</span>
              <button
                onClick={loadNotifications}
                className="text-xs opacity-40 hover:opacity-100"
                disabled={loading}
              >
                {loading ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>

            {loading && (
              <div className="p-4 text-center text-sm opacity-40">Loading...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-4 text-center text-sm opacity-40">🎉 All caught up!</div>
            )}

            {notifications.map((n, i) => (
              <div
                key={i}
                className={`p-2 my-1 rounded-lg text-sm ${getColor(n.type)}`}
              >
                <div className="flex items-start gap-2">
                  <span>{getIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{n.projectName}</p>
                    <p className="text-xs">{getMessage(n)}</p>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length > 0 && (
              <div className="border-t border-black/10 dark:border-white/10 pt-1 mt-1">
                <button
                  onClick={() => {
                    // Navigate to first notification
                    setIsOpen(false);
                  }}
                  className="w-full text-center text-xs opacity-40 hover:opacity-100 py-1"
                >
                  View all pipelines
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}