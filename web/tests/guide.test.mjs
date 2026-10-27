import assert from "node:assert/strict";
import { after, test } from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

import { guideMarkdown } from "../guideMarkdown.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";
import { parseMarkdownBlocks } from "../src/lib/parseMarkdownBlocks.ts";

// The guide imports its Markdown as raw text, which only Vite understands, so
// the registry is built the way the app builds it and then imported.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = await mkdtemp(join(root, ".guide-test-"));
after(() => rm(outDir, { recursive: true, force: true }));
await build({
  root,
  configFile: false,
  logLevel: "silent",
  plugins: [guideMarkdown()],
  build: {
    ssr: join(root, "src/guide/pages.ts"),
    outDir,
    rollupOptions: { output: { entryFileNames: "pages.mjs" } },
  },
});
const { GUIDE_GROUPS, GUIDE_PAGES, findGuidePage, guidePath } = await import(
  pathToFileURL(join(outDir, "pages.mjs"))
);

test("the guide carries the REST v1 pages and the MCP page", () => {
  assert.deepStrictEqual(
    GUIDE_PAGES.map((page) => page.slug),
    ["", "api", "environment", "other-options", "example", "mcp"],
  );
});

test("the guide index answers at /guide and every other page under it", () => {
  assert.strictEqual(guidePath(""), "/guide");
  assert.strictEqual(guidePath("mcp"), "/guide/mcp");
  assert.strictEqual(findGuidePage(undefined)?.slug, "");
  assert.strictEqual(findGuidePage("other-options")?.title, "Other endpoints");
  assert.strictEqual(findGuidePage("missing"), undefined);
});

test("the guide navigation reaches every page it lists exactly once", () => {
  const listed = GUIDE_GROUPS.flatMap((group) => group.pages.map((page) => page.slug));
  assert.deepStrictEqual(listed, ["", "api", "environment", "other-options", "example", "mcp"]);
  assert.strictEqual(listed.length, GUIDE_PAGES.length, "a page is missing from the navigation");
  for (const slug of listed) assert.ok(findGuidePage(slug), `no page for "${slug}"`);
});

test("the MCP page is the repository's own MCP document", async () => {
  const source = await readFile(join(root, "../docs/mcp.md"), "utf8");
  assert.strictEqual(findGuidePage("mcp").source, source);
});

test("every page opens with its title", () => {
  for (const page of GUIDE_PAGES) {
    assert.match(page.source, /^# \S/, `"${page.slug}" does not start with a heading`);
  }
});

test("no page carries VitePress front matter or containers", () => {
  for (const page of GUIDE_PAGES) {
    assert.ok(!page.source.startsWith("---"), `"${page.slug}" has front matter`);
    assert.doesNotMatch(page.source, /^:::/m, `"${page.slug}" has a VitePress container`);
  }
});

test("every link inside the site leads somewhere the site answers", () => {
  const routes = new Set(GUIDE_PAGES.map((page) => guidePath(page.slug)));
  // What the server answers itself: the REST API, the Swagger UI and MCP.
  const serverPaths = /^\/(v1|docs|mcp)(\/|$)/;
  for (const page of GUIDE_PAGES) {
    // Fenced code holds example URLs that are not links.
    const prose = page.source.replace(/```[\s\S]*?```/g, "");
    const targets = [...prose.matchAll(/\]\((\/[^)\s#]*)/g)].map((match) => match[1]);
    for (const target of targets) {
      const served = existsSync(join(root, "public", target));
      assert.ok(
        routes.has(target) || served || serverPaths.test(target),
        `"${page.slug}" links to ${target}, which is not a guide page, a public file or a server path`,
      );
    }
  }
});

test("no page describes what the API no longer does", () => {
  for (const page of GUIDE_PAGES) {
    for (const stale of ["2.0 beta", "/v1/generators/", "pkg/category", "pkg/rules", "V2 API proposal"]) {
      assert.ok(!page.source.includes(stale), `"${page.slug}" still mentions ${stale}`);
    }
  }
});

// The page as MarkdownContent renders it: alerts split out, then each block.
function renderPage({ source, code }) {
  return parseMarkdownBlocks(source)
    .map((block) => renderMarkdown(block.content, { code }))
    .join("");
}

test("every fenced block of the guide is rendered at build time", () => {
  for (const page of GUIDE_PAGES) {
    const fences = (page.source.match(/^```\S*/gm) ?? []).length / 2;
    const html = renderPage(page);
    assert.ok(!html.includes('class="hljs'), `"${page.slug}" has a block left to highlight.js`);
    assert.strictEqual(html.split('class="expressive-code"').length - 1, fences, page.slug);
  }
});

test("a block inside an alert or with a title is rendered at build time", async () => {
  const file = join(root, "tests/fixtures/code-blocks.md");
  const module = await guideMarkdown().load.call({ addWatchFile() {} }, `${file}?guide`);
  const page = JSON.parse(module.replace(/^export default /, "").replace(/;$/, ""));
  const html = renderPage(page);
  assert.ok(!html.includes('class="hljs'));
  assert.strictEqual(html.split('class="expressive-code"').length - 1, 2);
  assert.ok(html.includes("answer.json"));
});
