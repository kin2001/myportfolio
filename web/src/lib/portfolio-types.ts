export type ProjectDocumentBlock =
  | {
      id: string;
      type: "text";
      heading?: string;
      body: string;
      format: "paragraph" | "bullets" | "numbered" | "code";
      language?: string;
    }
  | {
      id: string;
      type: "image";
      assetId: string;
      alt: string;
      caption?: string;
    };

export type ProjectLink = {
  id: string;
  label: string;
  url: string;
  kind: "github" | "demo" | "video" | "file" | "documentation" | "other";
};

export type PublishedAsset = {
  assetId: string;
  objectKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  checksumSha256?: string;
  alt?: string;
};

export type PublishedProject = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  document: ProjectDocumentBlock[];
  cover: PublishedAsset | null;
  links: ProjectLink[];
  assetManifest: Record<string, PublishedAsset>;
  publishedAt: string;
  displayOrder: number;
};

export type PublishedCredential = {
  id: string;
  slug: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  skills: string[];
  relatedProjectId: string | null;
  verificationUrl: string | null;
  evidenceVisibility: "none" | "private" | "public";
  evidence: PublishedAsset | null;
  publishedAt: string;
};

export type MutationError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type MutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: MutationError };
