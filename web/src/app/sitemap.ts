import type { MetadataRoute } from "next";
import { projects } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticRoutes = ["", "/work", "/credentials", "/about", "/contact", "/privacy"];
  return [
    ...staticRoutes.map((route) => ({ url: base + route, lastModified: new Date(), changeFrequency: "monthly" as const, priority: route === "" ? 1 : 0.7 })),
    ...projects.filter((project) => project.status === "published").map((project) => ({ url: base + "/work/" + project.slug, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
