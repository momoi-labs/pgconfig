import { readFile } from "node:fs/promises";
import { ExpressiveCode, loadShikiTheme } from "expressive-code";
import { toHtml } from "expressive-code/hast";
import { Marked, type Token } from "marked";
import type { Plugin } from "vite";

import { codeKey } from "./src/lib/markdown.ts";

const QUERY = "?guide";
const RUNTIME = "virtual:guide-code";

/**
 * Imports a guide page as `{ source, code }`. `code` holds each fenced block
 * of the page already rendered by Expressive Code, so the browser loads no
 * highlighter for the guide. The `virtual:guide-code` module brings the
 * styles and the copy button the blocks need.
 */
export function guideMarkdown(): Plugin {
  let engine: Promise<ExpressiveCode> | undefined;
  const expressiveCode = () =>
    (engine ??= Promise.all([loadShikiTheme("github-dark"), loadShikiTheme("github-light")]).then(
      (themes) =>
        new ExpressiveCode({
          themes,
          // No data-theme follows the system; an explicit choice narrows it.
          useDarkModeMediaQuery: true,
          themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
        }),
    ));
  const lexer = new Marked();

  return {
    name: "guide-markdown",
    resolveId(id) {
      if (id === RUNTIME) return `\0${RUNTIME}`;
    },
    async load(id) {
      if (id !== `\0${RUNTIME}` && !id.endsWith(QUERY)) return;
      const ec = await expressiveCode();

      if (id === `\0${RUNTIME}`) {
        const styles = (await ec.getBaseStyles()) + (await ec.getThemeStyles());
        const scripts = await ec.getJsModules();
        return [
          `const style = document.createElement("style");`,
          `style.textContent = ${JSON.stringify(styles)};`,
          `document.head.append(style);`,
          ...scripts,
        ].join("\n");
      }

      const file = id.slice(0, -QUERY.length);
      this.addWatchFile(file);
      const source = await readFile(file, "utf8");

      const blocks: Token[] = [];
      lexer.walkTokens(lexer.lexer(source), (token) => {
        if (token.type === "code") blocks.push(token);
      });

      const code: Record<string, string> = {};
      for (const block of blocks) {
        const info = (block.lang ?? "").trim();
        const [language = "text", ...meta] = info.split(/\s+/);
        const { renderedGroupAst, styles } = await ec.render({
          code: block.text,
          language: language || "text",
          meta: meta.join(" "),
        });
        const style = styles.size ? `<style>${[...styles].join("")}</style>` : "";
        code[codeKey(info, block.text)] = style + toHtml(renderedGroupAst);
      }

      return `export default ${JSON.stringify({ source, code })};`;
    },
  };
}
