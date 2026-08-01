import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { getPublishedCredentials, getPublishedProjects } from "@/lib/public-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const staticRoutes = ["", "/work", "/credentials", "/about", "/contact", "/privacy"];
  const [projects, credentials] = await Promise.all([
    getPublishedProjects(),
    getPublishedCredentials(),
  ]);
  return [
    ...staticRoutes.map((route) => ({ url: base + route, changeFrequency: "monthly" as const, priority: route === "" ? 1 : 0.7 })),
    ...projects.map((project) => ({ url: base + "/work/" + project.slug, lastModified: new Date(project.publishedAt), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...credentials.map((credential) => ({ url: base + "/credentials/" + credential.slug, lastModified: new Date(credential.publishedAt), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
