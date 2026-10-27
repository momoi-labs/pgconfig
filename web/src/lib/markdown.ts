import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import { Marked, type Tokens } from "marked";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Code as highlighted HTML. A language that is not registered is only escaped. */
export function highlightCode(code: string, language: string): string {
  if (!hljs.getLanguage(language)) return escapeHtml(code);
  return hljs.highlight(code, { language }).value;
}

function anchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** How a fenced block is found again among the blocks rendered at build time. */
export function codeKey(info: string, text: string): string {
  return `${info.trim()}\n${text}`;
}

/** Fenced blocks rendered at build time, by `codeKey`. */
export type RenderedCode = Record<string, string>;

function createRenderer(rendered: RenderedCode = {}) {
  const anchors = new Map<string, number>();
  const markdown = new Marked();

  markdown.use({
    renderer: {
      // Headings take Kiso's type roles and an anchor a link can point at.
      heading({ tokens, depth }: Tokens.Heading): string {
        const html = this.parser.parseInline(tokens);
        const base = anchor(html) || "section";
        const seen = anchors.get(base) ?? 0;
        anchors.set(base, seen + 1);
        const id = seen === 0 ? base : `${base}-${seen}`;
        const role = depth <= 3 ? ` class="t-h${depth}"` : "";
        return `<h${depth} id="${id}"${role}>${html}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code): string {
        const prebuilt = rendered[codeKey(lang ?? "", text)];
        if (prebuilt) return `${prebuilt}\n`;
        const language = (lang ?? "").trim().split(/\s+/)[0];
        const name = language ? ` language-${escapeHtml(language)}` : "";
        return `<pre><code class="hljs${name}">${highlightCode(text, language)}</code></pre>\n`;
      },
      // A link that leaves the site opens in a new tab, so the form survives.
      link({ href, title, tokens }: Tokens.Link): string {
        const text = this.parser.parseInline(tokens);
        const external = /^[a-z][a-z0-9+.-]*:/i.test(href);
        const attributes = [
          `href="${escapeHtml(href)}"`,
          title ? `title="${escapeHtml(title)}"` : "",
          external ? 'target="_blank" rel="noreferrer"' : "",
        ].filter(Boolean);
        return `<a ${attributes.join(" ")}>${text}</a>`;
      },
    },
  });

  return markdown;
}

/**
 * Markdown as HTML that uses Kiso's own classes. A table, written in Markdown
 * or as HTML, is put in Kiso's frame so a wide one scrolls in place.
 */
export function renderMarkdown(
  source: string,
  { breaks = false, code }: { breaks?: boolean; code?: RenderedCode } = {},
): string {
  if (!source) return "";
  const html = createRenderer(code).parse(source, { async: false, breaks });
  return html
    .replace(/<table[^>]*>/g, '<div class="table-wrap"><div class="table-scroll"><table class="table">')
    .replace(/<\/table>/g, "</table></div></div>");
}
