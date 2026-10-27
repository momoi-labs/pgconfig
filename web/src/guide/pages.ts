/* The MCP page is the repository's own document, read where it lives, so the
   guide and the repository cannot drift apart. */
import mcp from "../../../docs/mcp.md?guide";
import api from "./content/api.md?guide";
import environment from "./content/environment.md?guide";
import example from "./content/example.md?guide";
import index from "./content/index.md?guide";
import otherOptions from "./content/other-options.md?guide";

import type { RenderedCode } from "../lib/markdown.js";

export type GuidePage = {
  /** The path segment under /guide. The index has none. */
  slug: string;
  /** The name the navigation and the breadcrumb use. */
  title: string;
  /** The page's Markdown. */
  source: string;
  /** Its fenced blocks, rendered at build time. */
  code: RenderedCode;
};

export type GuideGroup = { label?: string; pages: GuidePage[] };

const introduction: GuidePage = { slug: "", title: "Introduction", ...index };

export const GUIDE_GROUPS: GuideGroup[] = [
  { pages: [introduction] },
  {
    label: "REST v1",
    pages: [
      { slug: "api", title: "Get a configuration", ...api },
      { slug: "environment", title: "Profiles", ...environment },
      { slug: "other-options", title: "Other endpoints", ...otherOptions },
      { slug: "example", title: "Example and rules", ...example },
    ],
  },
  {
    label: "AI agents",
    pages: [{ slug: "mcp", title: "MCP", ...mcp }],
  },
];

export const GUIDE_PAGES: GuidePage[] = GUIDE_GROUPS.flatMap((group) => group.pages);

export function guidePath(slug: string): string {
  return slug ? `/guide/${slug}` : "/guide";
}

export function findGuidePage(slug: string | undefined): GuidePage | undefined {
  return GUIDE_PAGES.find((page) => page.slug === (slug ?? ""));
}
