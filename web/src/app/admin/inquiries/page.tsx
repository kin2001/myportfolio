const columns = ["New", "Triaged", "Reviewing", "Replied", "Archived"];

export default function InquiriesAdminPage() {
  return (
    <div className="max-w-7xl">
      <div className="border-b border-[var(--line)] pb-8"><p className="mono-meta accent">[ INQUIRY_OPERATIONS ]</p><h1 className="mt-4 text-4xl font-semibold">Inbox</h1><p className="mt-3 ink-soft">AI analysis and reply drafts remain private until reviewed.</p></div>
      <div className="mt-8 grid gap-4 overflow-x-auto lg:grid-cols-5">{columns.map((column,index) => <section className="module min-h-72 min-w-52 p-5" key={column}><div className="flex items-center justify-between border-b border-[var(--line)] pb-4"><h2 className="mono-label">{column}</h2><span className="mono-meta muted">00</span></div>{index === 0 ? <div className="mt-5 border border-dashed border-[var(--line)] p-5"><p className="mono-meta muted">No inquiries</p><p className="mt-3 text-sm leading-6 ink-soft">New contact submissions will appear here before AI processing.</p></div> : null}</section>)}</div>
      <section className="module mt-8 p-6"><div className="grid gap-6 md:grid-cols-[180px_1fr_1fr]"><div><span className="mono-label muted">Reply protocol</span></div><div><h2 className="font-medium">AI prepares</h2><p className="mt-2 text-sm leading-6 ink-soft">Redacted message → intent, priority, summary, caution notes, and reply draft.</p></div><div><h2 className="font-medium">Artkin approves</h2><p className="mt-2 text-sm leading-6 ink-soft">Review, edit, explicitly approve, then send with an idempotency key.</p></div></div></section>
    </div>
  );
}
