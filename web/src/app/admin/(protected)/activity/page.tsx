export default function ActivityAdminPage() {
  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ ACTIVITY_AND_EXPORT ]</p>
        <h1 className="mt-4 text-4xl font-semibold">Activity</h1>
      </div>
      <div className="module mt-8 p-8">
        <p className="mono-meta accent">AUDIT_STREAM / EMPTY</p>
        <p className="mt-5 leading-7 ink-soft">Meaningful publishing actions will appear here after Supabase is connected.</p>
      </div>
    </div>
  );
}
