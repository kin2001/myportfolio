export function SectionHeader({ index, title, meta }: { index: string; title: string; meta?: string }) {
  return (
    <div className="section-heading">
      <h2 className="mono-label">{index} — {title}</h2>
      {meta ? <span className="mono-meta muted">{meta}</span> : null}
    </div>
  );
}
