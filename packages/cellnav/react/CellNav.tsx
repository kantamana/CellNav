"use client";
// A React / Next.js wrapper for the <cell-nav> tag. Copy this file into your app.
// It needs the plugin script served by your site (default /cellnav.iife.js, so put
// dist/cellnav.iife.js in Next's public/ folder). The script is added in the
// browser only, so nothing here touches the server: on the server (and until the
// script loads) the visitor gets the plain links.
import { createElement, useEffect, useRef, type CSSProperties } from "react";

export interface CellNavLink {
  label: string;
  href: string;
}

export interface CellNavNavigate {
  id: string;
  label: string;
  href: string;
}

export interface CellNavProps {
  /** The nav items. They are also rendered as plain links, which is what shows before the script loads. */
  items: CellNavLink[];
  /** The current item's id (its label in lower case, e.g. "about"). Pass this from your router; "auto" only follows full page loads. */
  active?: string;
  /**
   * Called when a cell is clicked. Giving this handler turns off the browser's own navigation,
   * so do the routing in it: `onNavigate={({ href }) => router.push(href)}`.
   */
  onNavigate?: (item: CellNavNavigate) => void;
  /** Called with the message when the tag rejects an attribute (bad shape name, ...). */
  onError?: (message: string) => void;
  width?: number;
  height?: number;
  stretch?: number;
  seed?: number | "random";
  margin?: number;
  padding?: number;
  palette?: string[];
  boundary?: string;
  background?: "cell" | "none";
  /** Defaults to 1 here; the house style. Pass 0 to turn it off. */
  cornerFill?: number;
  /** Defaults to "prevent-glitch" here; the house style. */
  cornerFillAt?: "all" | "smooth" | "prevent-glitch";
  textFlow?: "outline" | "spread";
  /**
   * Any other attribute of the tag, by its dashed name (see the README):
   * `attrs={{ noise: "wobble", "noise-on": "hover" }}`. `true` writes a bare attribute.
   */
  attrs?: Record<string, string | number | boolean | undefined>;
  /** Where the plugin script is served from. Default "/cellnav.iife.js". */
  scriptSrc?: string;
  className?: string;
  style?: CSSProperties;
}

/** Adds the plugin script once per page. */
function loadPlugin(src: string) {
  if (customElements.get("cell-nav") || document.querySelector(`script[data-cellnav="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.cellnav = src;
  document.head.appendChild(script);
}

const attr = (v: string | number | boolean | undefined) => (v === true ? "" : v === false || v === undefined ? undefined : String(v));

export function CellNav({
  items,
  active,
  onNavigate,
  onError,
  palette,
  cornerFill = 1,
  cornerFillAt = "prevent-glitch",
  textFlow,
  attrs,
  scriptSrc = "/cellnav.iife.js",
  className,
  style,
  width,
  height,
  stretch,
  seed,
  margin,
  padding,
  boundary,
  background,
}: CellNavProps) {
  const ref = useRef<HTMLElement>(null);
  // The tag does not watch its links, so a different list is a different tag.
  const key = items.map((i) => `${i.label}\n${i.href}`).join("\n\n");

  useEffect(() => loadPlugin(scriptSrc), [scriptSrc]);

  const handlers = useRef({ onNavigate, onError });
  handlers.current = { onNavigate, onError };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const navigate = (e: Event) => {
      const h = handlers.current.onNavigate;
      if (!h) return;
      e.preventDefault();
      h((e as CustomEvent<CellNavNavigate>).detail);
    };
    const error = (e: Event) => handlers.current.onError?.(String((e as CustomEvent).detail));
    el.addEventListener("cellnav-navigate", navigate);
    el.addEventListener("cellnav-error", error);
    return () => {
      el.removeEventListener("cellnav-navigate", navigate);
      el.removeEventListener("cellnav-error", error);
    };
  }, [key]);

  const props: Record<string, unknown> = {
    key,
    ref,
    class: className,
    style,
    width: attr(width),
    height: attr(height),
    stretch: attr(stretch),
    seed: attr(seed),
    margin: attr(margin),
    padding: attr(padding),
    active: attr(active),
    boundary,
    background,
    palette: palette?.join(","),
    "corner-fill": attr(cornerFill),
    "corner-fill-at": cornerFillAt,
    "text-flow": textFlow,
  };
  for (const [name, value] of Object.entries(attrs ?? {})) props[name] = attr(value);
  for (const name of Object.keys(props)) if (props[name] === undefined) delete props[name];

  return createElement(
    "cell-nav",
    props,
    items.map((i) => createElement("a", { key: i.href + i.label, href: i.href }, i.label)),
  );
}
