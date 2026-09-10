import Link from "next/link";
import type { PublishedCredential } from "@/lib/portfolio-types";

type CredentialCardProps = {
  credential: Pick<PublishedCredential, "slug" | "name" | "issuer" | "issueDate">;
  ariaLabel?: string;
};

function monthYear(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function CredentialCard({ credential, ariaLabel = credential.name }: CredentialCardProps) {
  return (
    <Link
      href={`/credentials/${credential.slug}`}
      className="module public-record-link flex h-full min-h-[168px] min-w-0 flex-col rounded-[16px] p-4 sm:min-h-[188px] sm:p-6"
      data-credential-index-card
      aria-label={ariaLabel}
    >
      <h3 className="public-card-title break-words">{credential.name}</h3>
      <p className="public-body mt-2 break-words">{credential.issuer}</p>
      <p className="public-body muted mt-auto pt-6">
        <time dateTime={credential.issueDate}>{monthYear(credential.issueDate)}</time>
      </p>
    </Link>
  );
}
