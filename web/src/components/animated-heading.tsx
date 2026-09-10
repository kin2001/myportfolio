import { Fragment, type CSSProperties } from "react";

type HeadingStyle = CSSProperties & { "--heading-word-index": number };

export function AnimatedHeading({
  text,
  className = "",
  id,
  accentWord,
}: {
  text: string | readonly string[];
  className?: string;
  id?: string;
  accentWord?: string;
}) {
  const lines = typeof text === "string" ? [text] : text;
  const label = lines.join(" ");
  let wordIndex = 0;

  return (
    <h1
      aria-label={label}
      className={`animated-heading ${className}`.trim()}
      data-animated-heading
      id={id}
    >
      {lines.map((line, lineIndex) => (
        <Fragment key={`${line}-${lineIndex}`}>
          <span aria-hidden="true" className="animated-heading-line">
            {line.trim().split(/\s+/).map((word, wordInLineIndex, words) => {
              const index = wordIndex++;
              return (
                <Fragment key={`${word}-${index}`}>
                  <span className="animated-heading-word-mask">
                    <span
                      className={`animated-heading-word${word === accentWord ? " accent" : ""}`}
                      data-heading-word
                      style={{ "--heading-word-index": index } as HeadingStyle}
                    >
                      {word}
                    </span>
                  </span>
                  {wordInLineIndex < words.length - 1 ? " " : null}
                </Fragment>
              );
            })}
          </span>
          {lineIndex < lines.length - 1 ? " " : null}
        </Fragment>
      ))}
      <span aria-hidden="true" className="animated-heading-rule" data-heading-rule />
    </h1>
  );
}
