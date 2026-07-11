export type ProjectStatus = "draft" | "published" | "archived";

export type Project = {
  slug: string;
  title: string;
  summary: string;
  problem: string;
  solution: string;
  outcome?: string;
  tools: string[];
  status: ProjectStatus;
  featured: boolean;
};

export type Credential = {
  name: string;
  issuer: string;
  date: string;
  verificationUrl: string;
  relatedProject?: string;
};

export const profile = {
  name: "ARTKIN CARREON",
  role: "AI Automation Specialist",
  positioning:
    "I help small businesses reduce repetitive work and operational friction through reliable workflow automation and AI-assisted systems.",
  shortPositioning:
    "I design AI-powered workflows, automation systems, and practical digital tools that turn repetitive processes into reliable operations.",
};

// Publish only verified records. Empty arrays are intentional until evidence is supplied.
export const projects: Project[] = [];
export const credentials: Credential[] = [];

export const capabilities = [
  {
    code: "CAP_01",
    title: "Workflow architecture",
    description: "Map the real process, identify failure points, and design a maintainable automation before choosing tools.",
  },
  {
    code: "CAP_02",
    title: "Systems integration",
    description: "Connect APIs, business tools, data, and human review steps into one traceable operating flow.",
  },
  {
    code: "CAP_03",
    title: "AI-assisted operations",
    description: "Add classification, summarization, drafting, and decision support where AI creates measurable operational value.",
  },
];

export const processSteps = [
  ["01", "Discover", "Understand the process, people, constraints, and definition of success."],
  ["02", "Map", "Document the current workflow and design the future system."],
  ["03", "Build", "Implement the smallest reliable automation with clear ownership."],
  ["04", "Verify", "Test failure modes, measure the result, and improve from evidence."],
] as const;
