const sectionTypes = ["Documentation"];

export default function ProjectEditorPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="mono-meta accent">[ GUIDED_CASE_STUDY_BUILDER ]</p><h1 className="mt-4 text-4xl font-semibold">New project</h1></div><div className="flex gap-3"><button className="button-secondary" type="button">Preview</button><button className="button-primary" type="button">Save draft</button></div></div>
      <form className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section className="module p-7"><h2 className="mono-label">Project identity</h2><div className="mt-7 grid gap-7 md:grid-cols-2"><label><span className="mono-label muted">Title</span><input className="field mt-2" /></label><label><span className="mono-label muted">Slug</span><input className="field mt-2" /></label><label className="md:col-span-2"><span className="mono-label muted">Summary</span><textarea className="field mt-2 min-h-24" /></label><label><span className="mono-label muted">Role</span><input className="field mt-2" /></label><label><span className="mono-label muted">Timeline</span><input className="field mt-2" /></label></div></section>
          <section><div className="flex items-center justify-between"><h2 className="mono-label">Required sections</h2><span className="mono-meta muted">0 / {sectionTypes.length} complete</span></div><div className="mt-4 space-y-4">{sectionTypes.map((section,index) => <details className="module" key={section} open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between p-5"><span><span className="mono-meta accent mr-5">{String(index + 1).padStart(2,"0")}</span><strong>{section}</strong></span><span className="mono-label muted">Required</span></summary><div className="border-t border-[var(--line)] p-5"><textarea className="field min-h-32" placeholder={"Document the " + section.toLowerCase() + " using verified facts."} /></div></details>)}</div></section>
        </div>
        <aside className="space-y-5">
          <div className="module p-5"><h2 className="mono-label">Publish gate</h2><ul className="mono-meta muted mt-5 space-y-3"><li>○ Required sections</li><li>○ Verified technologies</li><li>○ Outcome evidence</li><li>○ Media permissions</li><li>○ Alt text</li></ul></div>
          <div className="module p-5"><h2 className="mono-label">Status</h2><select className="field mt-4"><option>Draft</option><option disabled>Published — validation required</option><option>Archived</option></select></div>
          <div className="module p-5"><h2 className="mono-label">Media</h2><button className="button-secondary mt-5 w-full" type="button">Upload asset</button><p className="mono-meta muted mt-4">JPEG, PNG, WebP, or AVIF. Alt text required.</p></div>
        </aside>
      </form>
    </div>
  );
}
