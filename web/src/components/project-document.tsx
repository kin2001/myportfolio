import type { ProjectDocumentBlock } from "@/lib/portfolio-types";

export type RenderedProjectAsset = {
  url: string;
  width: number;
  height: number;
};

function TextBlock({
  block,
  index,
}: {
  block: Extract<ProjectDocumentBlock, { type: "text" }>;
  index: number;
}) {
  const lines = block.body.split(/\r?\n/).filter((line) => line.trim());
  const content =
    block.format === "bullets" ? (
      <ul className="list-disc space-y-2 pl-5">{lines.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul>
    ) : block.format === "numbered" ? (
      <ol className="list-decimal space-y-2 pl-5">{lines.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ol>
    ) : block.format === "code" ? (
      <pre className="overflow-x-auto border border-[var(--line)] bg-[var(--paper-soft)] p-5"><code className="text-sm">{block.body}</code></pre>
    ) : (
      <p className="whitespace-pre-line">{block.body}</p>
    );

  return (
    <section className="grid gap-6 border-t border-[var(--line)] py-12 md:grid-cols-[120px_1fr_2fr]">
      <span className="mono-meta accent">{String(index + 1).padStart(2, "0")}</span>
      {block.heading ? (
        <h2 className="text-2xl font-medium">{block.heading}</h2>
      ) : (
        <p className="text-2xl font-medium">
          <span className="sr-only">Documentation block {index + 1}</span>
          <span aria-hidden="true">Documentation</span>
        </p>
      )}
      <div className="leading-8 ink-soft">{content}</div>
    </section>
  );
}

export function ProjectDocument({
  blocks,
  assets,
}: {
  blocks: ProjectDocumentBlock[];
  assets: Record<string, RenderedProjectAsset>;
}) {
  return blocks.map((block, index) => {
    if (block.type === "text") {
      return <TextBlock key={block.id} block={block} index={index} />;
    }
    const asset = assets[block.assetId];
    return asset ? (
      <figure key={block.id} className="border-t border-[var(--line)] py-12">
        <img
          src={asset.url}
          alt={block.alt}
          width={asset.width}
          height={asset.height}
          className="h-auto w-full object-contain"
          loading="lazy"
        />
        {block.caption ? <figcaption className="mono-meta muted mt-4">{block.caption}</figcaption> : null}
      </figure>
    ) : null;
  });
}
