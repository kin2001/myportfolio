import Link from "next/link";

const stats = [
  ["00", "Published projects"],
  ["00", "Draft projects"],
  ["00", "Credentials"],
  ["00", "CV versions"],
] as const;

export default function AdminDashboard() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="mono-meta accent">[ OPERATIONS_OVERVIEW ]</p><h1 className="mt-4 text-4xl font-semibold">Dashboard</h1></div><Link href="/admin/projects/new" className="button-primary">Create project</Link></div>
      <section className="mt-8 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">{stats.map(([value,label]) => <div className="surface p-6" key={label}><strong className="text-3xl">{value}</strong><span className="mono-label muted mt-3 block">{label}</span></div>)}</section>
      <section className="mt-12"><h2 className="mono-label">System readiness</h2><div className="module mt-5 divide-y divide-[var(--line)]">{[["Frontend", "READY", "Stitch-derived Next.js interface"], ["Supabase", "PENDING", "Environment and migration not connected"], ["FastAPI", "PENDING", "API service not connected"], ["Automation", "PENDING", "NVIDIA and email credentials required"]].map(([name,status,detail]) => <div className="grid gap-2 p-5 md:grid-cols-[160px_120px_1fr]" key={name}><strong>{name}</strong><span className={"mono-label " + (status === "READY" ? "accent" : "muted")}>{status}</span><span className="text-sm ink-soft">{detail}</span></div>)}</div></section>
    </div>
  );
}
