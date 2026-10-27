import { useMemo } from "react";
import { Alert, AlertContent, AlertTitle } from "@momoi-labs/kiso-react";

import { renderMarkdown, type RenderedCode } from "../lib/markdown.js";
import { parseMarkdownBlocks, type AlertType } from "../lib/parseMarkdownBlocks.js";
import { Icon, type IconName } from "./Icon.js";

/** How each GitHub-style alert reads in Kiso's four alert tones. */
const ALERTS: Record<
  AlertType,
  { title: string; variant: "info" | "success" | "warning" | "error"; icon: IconName }
> = {
  NOTE: { title: "Note", variant: "info", icon: "info" },
  TIP: { title: "Tip", variant: "success", icon: "lightbulb" },
  IMPORTANT: { title: "Important", variant: "info", icon: "message-square-warning" },
  WARNING: { title: "Warning", variant: "warning", icon: "triangle-alert" },
  CAUTION: { title: "Caution", variant: "error", icon: "circle-alert" },
};

/**
 * Renders Markdown the API or the guide wrote. Alert blocks become Kiso
 * Alerts; they are part of the text, not live status, so they carry the
 * `note` role instead of the Alert's own, and the rail appearance Kiso has
 * for notes inside reading content.
 */
export function MarkdownContent({
  source,
  breaks = false,
  code,
}: {
  source: string | undefined;
  breaks?: boolean;
  /** Fenced blocks already rendered at build time. */
  code?: RenderedCode;
}) {
  const blocks = useMemo(() => parseMarkdownBlocks(source), [source]);

  return (
    <div className="markdown stack">
      {blocks.map((block, index) => {
        const html = { __html: renderMarkdown(block.content, { breaks, code }) };
        if (block.type === "markdown") {
          return <div key={index} className="markdown-body" dangerouslySetInnerHTML={html} />;
        }
        const alert = ALERTS[block.alertType];
        return (
          <Alert key={index} variant={alert.variant} appearance="rail" role="note">
            <Icon name={alert.icon} />
            <AlertContent>
              <AlertTitle>{alert.title}</AlertTitle>
              {block.content && (
                <div className="alert-body markdown-body" dangerouslySetInnerHTML={html} />
              )}
            </AlertContent>
          </Alert>
        );
      })}
    </div>
  );
}
