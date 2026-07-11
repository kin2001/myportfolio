export function SystemDiagram() {
  return (
    <div className="relative aspect-square w-full max-w-[470px]" aria-label="Workflow diagram connecting inputs, automation, AI review, and verified output" role="img">
      <svg viewBox="0 0 520 520" className="h-full w-full" fill="none">
        <defs>
          <pattern id="mini-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--line)" />
          </pattern>
        </defs>
        <rect x="32" y="54" width="456" height="404" fill="url(#mini-grid)" stroke="var(--line)" strokeWidth="1" />
        <path d="M92 154h92l38 44h82l44-52h80" stroke="var(--ink-soft)" strokeWidth="1" />
        <path d="M92 358h84l50-60h84l48 46h70" stroke="var(--ink-soft)" strokeWidth="1" />
        <path d="M184 154v144m120-100v100m54-152v198" stroke="var(--line)" strokeWidth="1" strokeDasharray="5 7" />
        <path d="M92 154h92l42 144h84l48 46h70" stroke="var(--accent)" strokeWidth="3" />
        {[
          [92,154,"INPUT"], [184,154,"MAP"], [226,298,"AUTOMATE"], [310,298,"AI REVIEW"], [358,344,"VERIFY"], [428,344,"OUTPUT"]
        ].map(([x,y,label]) => (
          <g key={String(label)}>
            <rect x={Number(x)-12} y={Number(y)-12} width="24" height="24" fill="var(--paper-pure)" stroke="var(--ink)" />
            <rect x={Number(x)-5} y={Number(y)-5} width="10" height="10" fill="var(--accent)" />
            <text x={Number(x)} y={Number(y)+32} textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9" letterSpacing="1">{label}</text>
          </g>
        ))}
        <text x="54" y="84" fill="var(--accent)" fontFamily="var(--font-geist-mono)" fontSize="10" letterSpacing="2">SYSTEM_FLOW / 001</text>
        <text x="466" y="438" textAnchor="end" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9">HUMAN APPROVAL REQUIRED</text>
      </svg>
    </div>
  );
}
