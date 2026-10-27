import { readFile } from "node:fs/promises";
import { ExpressiveCode, ExpressiveCodeTheme } from "expressive-code";
import { toHtml } from "expressive-code/hast";
import { Marked, type Token } from "marked";
import type { Plugin } from "vite";

import { codeKey } from "./src/lib/markdown.ts";

const QUERY = "?guide";
const RUNTIME = "virtual:guide-code";

/* Syntax colours in Kiso's text roles, as the highlight.js rules in app.css
   use them. Kiso builds these on CSS light-dark(), so one theme follows the
   system and the theme the visitor picks. Expressive Code needs hex for the
   editor colours; the style overrides below replace them. */
const kiso = new ExpressiveCodeTheme({
  name: "kiso",
  type: "light",
  colors: { "editor.background": "#ffffff", "editor.foreground": "#000000" },
  tokenColors: [
    { settings: { foreground: "var(--color-foreground)" } },
    { scope: ["comment"], settings: { foreground: "var(--color-muted-foreground)" } },
    {
      scope: ["keyword", "storage", "support", "entity.name", "variable.parameter"],
      settings: { foreground: "var(--color-link)" },
    },
    { scope: ["string"], settings: { foreground: "var(--color-success)" } },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "var(--color-warning)" },
    },
  ],
});

/**
 * Imports a guide page as `{ source, code }`. `code` holds each fenced block
 * of the page already rendered by Expressive Code, so Shiki stays out of the
 * browser bundle. The `virtual:guide-code` module adds the styles and the
 * copy button the blocks need.
 */
export function guideMarkdown(): Plugin {
  const ec = new ExpressiveCode({
    themes: [kiso],
    // Expressive Code cannot measure contrast on a CSS variable. Kiso's roles
    // already have enough.
    minSyntaxHighlightingColorContrast: 0,
    styleOverrides: {
      borderRadius: "var(--radius-surface)",
      borderColor: "var(--color-border)",
      codeBackground: "var(--color-muted)",
      codeForeground: "var(--color-foreground)",
      codeFontFamily: "var(--font-mono)",
      codeFontSize: "var(--type-size-label)",
      codeLineHeight: "var(--type-line-height-relaxed)",
      codeSelectionBackground: "var(--color-selected)",
      uiFontFamily: "var(--font-body)",
      uiSelectionBackground: "var(--color-selected)",
      uiSelectionForeground: "var(--color-selected-foreground)",
      focusBorder: "var(--color-focus)",
      frames: {
        frameBoxShadowCssValue: "none",
        editorBackground: "var(--color-muted)",
        editorTabBarBackground: "var(--color-muted)",
        editorTabBarBorderBottomColor: "var(--color-border)",
        editorActiveTabBackground: "var(--color-muted)",
        editorActiveTabForeground: "var(--color-muted-foreground)",
        terminalBackground: "var(--color-muted)",
        terminalTitlebarBackground: "var(--color-muted)",
        terminalTitlebarForeground: "var(--color-muted-foreground)",
        terminalTitlebarBorderBottomColor: "var(--color-border)",
        terminalTitlebarDotsForeground: "var(--color-muted-foreground)",
        inlineButtonForeground: "var(--color-muted-foreground)",
        inlineButtonBorder: "var(--color-border)",
        tooltipSuccessBackground: "var(--color-success-surface)",
        tooltipSuccessForeground: "var(--color-success)",
      },
    },
  });
  const lexer = new Marked();

  return {
    name: "guide-markdown",
    resolveId(id) {
      if (id === RUNTIME) return `\0${RUNTIME}`;
    },
    async load(id) {
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

      if (!id.endsWith(QUERY)) return;
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
