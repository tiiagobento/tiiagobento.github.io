export function LoadingSkeleton() {
  const block = "animate-pulse rounded-xl border bg-gradient-to-r from-secondary/85 via-card to-secondary/70 bg-[length:200%_100%] shadow-sm shadow-slate-950/[0.035]";
  return (
    <div className="space-y-5">
      <div className={`${block} h-28`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={`${block} h-24`} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${block} h-80`} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={`${block} h-80`} />
        <div className={`${block} h-80`} />
      </div>
    </div>
  );
}
