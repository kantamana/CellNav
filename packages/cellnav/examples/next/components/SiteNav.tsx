"use client";
import { usePathname, useRouter } from "next/navigation";
import { CellNav } from "./CellNav";

const items = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function SiteNav() {
  const router = useRouter();
  const path = usePathname();
  // The id of an item is its label in lower case.
  const active = items.find((i) => i.href === path)?.label.toLowerCase();
  return (
    <CellNav
      items={items}
      active={active}
      onNavigate={({ href }) => router.push(href)}
      onError={(message) => console.warn("cellnav:", message)}
      stretch={2.8}
      seed={7}
      height={260}
      margin={6}
      padding={14}
      palette={["#ffbe0b", "#fb5607", "#ff006e", "#8338ec"]}
    />
  );
}
