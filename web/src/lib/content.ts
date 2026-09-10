export const profile = {
  name: "ARTKIN CARREON",
  role: "AI Automation & GoHighLevel Specialist",
  positioning:
    "I help small businesses organize leads, automate follow-up, and connect daily operations through GoHighLevel and AI-powered workflows.",
  shortPositioning:
    "I build GoHighLevel workflows and AI automation that organize leads, automate follow-up, and connect the tools behind daily operations.",
};

export const capabilities = [
  {
    code: "CAP_01",
    title: "GoHighLevel systems",
    description: "Configure CRM pipelines, forms, calendars, and workflows around a clear customer process.",
  },
  {
    code: "CAP_02",
    title: "AI workflow automation",
    description: "Use AI for retrieval, triage, and drafting while keeping important actions under human review.",
  },
  {
    code: "CAP_03",
    title: "API and data integration",
    description: "Connect GoHighLevel, n8n, webhooks, and business tools so information moves without duplicate work.",
  },
];

export const processSteps = [
  ["01", "Discover", "Understand the process, people, constraints, and definition of success."],
  ["02", "Map", "Document the current workflow and design the future system."],
  ["03", "Build", "Implement the smallest reliable automation with clear ownership."],
  ["04", "Verify", "Test failure modes, measure the result, and improve from evidence."],
] as const;
