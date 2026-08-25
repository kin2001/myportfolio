export default function AdminLoading() {
  return (
    <div
      aria-live="polite"
      className="max-w-6xl motion-safe:animate-pulse"
      role="status"
    >
      <span className="sr-only">Loading admin view.</span>
      <div className="border-b border-[var(--line)] pb-8">
        <div className="h-3 w-40 bg-[var(--line)]" />
        <div className="mt-5 h-10 w-56 max-w-full bg-[var(--line)]" />
        <div className="mt-5 h-4 w-[32rem] max-w-full bg-[var(--line)]" />
      </div>

      <div className="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="surface min-h-28 p-6" key={index}>
            <div className="h-7 w-20 bg-[var(--line)]" />
            <div className="mt-4 h-3 w-28 bg-[var(--line)]" />
          </div>
        ))}
      </div>

      <div className="module mt-10 p-6">
        <div className="h-3 w-32 bg-[var(--line)]" />
        <div className="mt-6 h-4 w-full bg-[var(--line)]" />
        <div className="mt-3 h-4 w-4/5 bg-[var(--line)]" />
        <div className="mt-3 h-4 w-3/5 bg-[var(--line)]" />
      </div>
    </div>
  );
}
