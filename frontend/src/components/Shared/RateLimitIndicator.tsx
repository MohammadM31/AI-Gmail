// frontend/src/components/Shared/RateLimitIndicator.tsx
import { useEffect, useState } from "react";

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export function RateLimitIndicator() {
  const [info, setInfo] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    // Read rate limit headers from responses
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.responseStatus === 429) {
          // Rate limit hit
        }
      }
    });
    observer.observe({ entryTypes: ["resource"] });

    return () => observer.disconnect();
  }, []);

  // You can also read from localStorage or store
  const stored = localStorage.getItem("rateLimitInfo");
  const data = stored ? JSON.parse(stored) : null;

  if (!data) return null;

  const percentage = (data.remaining / data.limit) * 100;
  const color = percentage < 20 ? "bg-red-500" : percentage < 50 ? "bg-yellow-500" : "bg-green-500";
  const textColor = percentage < 20 ? "text-red-500" : percentage < 50 ? "text-yellow-500" : "text-green-500";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-60">Rate Limit:</span>
      <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`${textColor} font-medium`}>
        {data.remaining}/{data.limit}
      </span>
      {data.reset && (
        <span className="opacity-40">
          resets {new Date(data.reset * 1000).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}