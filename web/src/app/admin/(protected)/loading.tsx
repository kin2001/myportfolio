export default function AdminLoading() {
  return (
    <div
      aria-live="polite"
      className="max-w-6xl"
      role="status"
    >
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent inline-flex items-center gap-3">
          <span className="loading-ring" aria-hidden="true" />
          Loading admin view
        </p>
        <div aria-hidden="true" className="mt-5 h-10 w-56 max-w-full bg-[var(--line)]" />
        <div aria-hidden="true" className="mt-5 h-4 w-[32rem] max-w-full bg-[var(--line)]" />
      </div>

      <div aria-hidden="true" className="module mt-8 p-6">
        <div className="h-4 w-40 bg-[var(--line)]" />
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          <div><div className="h-3 w-24 bg-[var(--line)]" /><div className="mt-3 h-11 w-full bg-[var(--line)]" /></div>
          <div><div className="h-3 w-32 bg-[var(--line)]" /><div className="mt-3 h-11 w-full bg-[var(--line)]" /></div>
        </div>
        <div className="mt-7 h-3 w-28 bg-[var(--line)]" />
        <div className="mt-3 h-28 w-full bg-[var(--line)]" />
      </div>
    </div>
  );
}
