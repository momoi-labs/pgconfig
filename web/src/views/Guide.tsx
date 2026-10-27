import { useEffect, type MouseEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router";
import {
  Disclosure,
  Navigation,
  NavigationGroup,
  NavigationItem,
  NavigationLink,
  NavigationList,
} from "@momoi-labs/kiso-react";

import "virtual:guide-code";

import { MarkdownContent } from "../components/MarkdownContent.js";
import { GUIDE_GROUPS, findGuidePage, guidePath } from "../guide/pages.js";
import { DESKTOP, useMediaQuery } from "../lib/useMediaQuery.js";
import { NotFound } from "./NotFound.js";

/** One guide page beside the guide's own navigation. */
export function Guide() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const page = findGuidePage(slug);
  const isDesktop = useMediaQuery(DESKTOP);

  // A new page starts at its top, or at the heading the link names.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [slug, hash]);

  /* Markdown links are plain anchors. One that points into the guide is
     followed inside the app, so the page does not reload. */
  function followGuideLink(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest("a");
    if (!link || link.target || link.origin !== window.location.origin) return;
    if (link.pathname !== "/guide" && !link.pathname.startsWith("/guide/")) return;
    event.preventDefault();
    navigate(`${link.pathname}${link.search}${link.hash}`);
  }

  const navigation = (
    <Navigation aria-label="Guide" className="guide-nav">
      {GUIDE_GROUPS.map((group, index) => (
        <NavigationGroup key={group.label ?? index} label={group.label}>
          <NavigationList>
            {group.pages.map((entry) => (
              <NavigationItem key={entry.slug}>
                <NavigationLink asChild active={entry.slug === page?.slug}>
                  <RouterLink to={guidePath(entry.slug)}>{entry.title}</RouterLink>
                </NavigationLink>
              </NavigationItem>
            ))}
          </NavigationList>
        </NavigationGroup>
      ))}
    </Navigation>
  );

  return (
    <div className="page guide-page" id="content">
      {/* Stacked above the article on a narrow screen, the list stays folded
          so the page starts with its text. The key closes it on every page. */}
      {isDesktop ? (
        navigation
      ) : (
        <Disclosure key={slug ?? ""} summary="Guide pages">
          {navigation}
        </Disclosure>
      )}

      {page ? (
        <article className="guide-article" onClick={followGuideLink}>
          <MarkdownContent source={page.source} code={page.code} />
        </article>
      ) : (
        <NotFound />
      )}
    </div>
  );
}
