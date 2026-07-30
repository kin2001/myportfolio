export default function CvAdminPage() {
  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ CV_VERSIONS ]</p>
        <h1 className="mt-4 text-4xl font-semibold">CV</h1>
      </div>
      <div className="module mt-8 p-8">
        <p className="mono-meta accent">VERSION_REGISTRY / EMPTY</p>
        <p className="mt-5 leading-7 ink-soft">Upload a verified PDF after R2 is connected. Previous versions will remain private.</p>
      </div>
    </div>
  );
}
