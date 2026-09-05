// frontend/src/components/Shared/Skeleton.tsx

interface SkeletonProps {
    className?: string;
    count?: number;
  }
  
  export function Skeleton({ className = "", count = 1 }: SkeletonProps) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
          />
        ))}
      </>
    );
  }
  
  export function SkeletonCard() {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  
  export function SkeletonList({ count = 5 }: { count?: number }) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  
  export function SkeletonStats() {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-black/10 dark:border-white/10 p-4 text-center">
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto mt-1" />
          </div>
        ))}
      </div>
    );
  }