import type { ReactNode } from "react";

export function SectionHeader({
  index,
  title,
  meta,
  action,
}: {
  index: string;
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2 className="mono-label">{index} — {title}</h2>
      {action ?? (meta ? <span className="mono-meta muted">{meta}</span> : null)}
    </div>
  );
}
