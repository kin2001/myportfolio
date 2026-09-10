import type { ProjectDocumentBlock } from "@/lib/portfolio-types";

export type RenderedProjectAsset = {
  url: string;
  width: number;
  height: number;
};

export function projectSectionId(blockId: string) {
  return `project-section-${blockId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

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
      <pre
        aria-label={block.heading ? `${block.heading} code` : `Documentation block ${index + 1} code`}
        className="overflow-x-auto border border-[var(--line)] bg-[var(--paper-soft)] p-5"
        tabIndex={0}
      ><code className="text-sm">{block.body}</code></pre>
    ) : (
      <p className="whitespace-pre-line">{block.body}</p>
    );

  return (
    <section
      id={projectSectionId(block.id)}
      className="project-document-section grid scroll-mt-24 gap-6 border-t border-[var(--line)] py-8 md:py-12 lg:grid-cols-[minmax(180px,.65fr)_minmax(0,1.75fr)] lg:gap-10"
      data-phone-layout="document-row"
      data-reveal="record"
    >
      <div className="flex items-start gap-4 lg:block">
        <span className="mono-meta accent">{String(index + 1).padStart(2, "0")}</span>
        {block.heading ? (
          <h2 className="public-card-title lg:mt-4">{block.heading}</h2>
        ) : (
          <h2 className="public-card-title lg:mt-4">
            <span className="sr-only">Documentation block {index + 1}</span>
            <span aria-hidden="true">Documentation</span>
          </h2>
        )}
      </div>
      <div className="public-prose min-w-0 max-w-[68ch]">{content}</div>
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
  let textIndex = 0;
  return blocks.map((block) => {
    if (block.type === "text") {
      const index = textIndex++;
      return <TextBlock key={block.id} block={block} index={index} />;
    }
    const asset = assets[block.assetId];
    return asset ? (
      <figure
        key={block.id}
        className="border-t border-[var(--line)] py-10 md:py-14"
        data-reveal="media"
      >
        <div className="module mx-auto max-w-5xl overflow-hidden">
          <img
            src={asset.url}
            alt={block.alt}
            width={asset.width}
            height={asset.height}
            className="mx-auto max-h-[680px] h-auto w-auto max-w-full object-contain"
            loading="lazy"
          />
          {block.caption ? (
            <figcaption className="mono-meta muted border-t border-[var(--line)] px-5 py-4">
              {block.caption}
            </figcaption>
          ) : null}
        </div>
      </figure>
    ) : null;
  });
}
