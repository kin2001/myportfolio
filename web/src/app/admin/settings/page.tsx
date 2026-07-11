export default function SettingsAdminPage() {
  return (
    <div className="max-w-5xl">
      <div className="border-b border-[var(--line)] pb-8"><p className="mono-meta accent">[ PROFILE_CONFIGURATION ]</p><h1 className="mt-4 text-4xl font-semibold">Settings</h1></div>
      <form className="mt-8 space-y-8">
        <section className="module p-7"><h2 className="mono-label">Public profile</h2><div className="mt-7 grid gap-7 md:grid-cols-2"><label><span className="mono-label muted">Name</span><input className="field mt-2" defaultValue="ARTKIN CARREON" /></label><label><span className="mono-label muted">Role</span><input className="field mt-2" defaultValue="AI Automation Specialist" /></label><label className="md:col-span-2"><span className="mono-label muted">Positioning</span><textarea className="field mt-2 min-h-24" defaultValue="I help small businesses reduce repetitive work and operational friction through reliable workflow automation and AI-assisted systems." /></label></div></section>
        <section className="module p-7"><h2 className="mono-label">Integrations</h2><div className="mt-6 divide-y divide-[var(--line)]">{[["Supabase", "Not connected"], ["FastAPI", "Not connected"], ["NVIDIA", "Not connected"], ["Resend", "Not connected"], ["Turnstile", "Not connected"], ["Netlify build hook", "Not connected"]].map(([name,status]) => <div className="flex items-center justify-between py-4" key={name}><span>{name}</span><span className="mono-label muted">{status}</span></div>)}</div></section>
        <div className="flex gap-4"><button type="button" className="button-primary">Save settings</button><button type="button" className="button-secondary">Export content</button></div>
      </form>
    </div>
  );
}
