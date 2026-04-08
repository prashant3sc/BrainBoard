interface Props {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 3, className = '' }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-full animate-pulse rounded-md bg-gray-200"
        />
      ))}
    </div>
  );
}
