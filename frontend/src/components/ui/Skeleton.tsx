import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-200/60 rounded ${className}`} />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full">
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1 px-3 py-1">
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex border-b border-slate-50 p-2">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="flex-1 px-3 py-2">
              <Skeleton className={c === 0 ? "h-4 w-3/4" : "h-3 w-1/2"} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs w-full">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
};
