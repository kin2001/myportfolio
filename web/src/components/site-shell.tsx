"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const navigation = [
  ["01", "Projects", "/#projects", "work"],
  ["02", "Systems", "/#systems", "systems"],
  ["03", "AI Signal", "/#signal", "signal"],
  ["04", "Credentials", "/credentials", "credentials"],
  ["05", "About", "/about", "about"],
  ["06", "Contact", "/contact", "contact"],
] as const;

function NavLinks({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const [hash, setHash] = useState("#projects");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash || "#projects");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1">
      {navigation.map(([index, label, href, icon]) => {
        const active = href.startsWith("/#")
          ? (href === "/#projects" && pathname.startsWith("/work")) || (pathname === "/" && href === `/${hash}`)
          : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => {
              if (href.startsWith("/#")) setHash(href.slice(1));
              close?.();
            }}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 border-r-2 px-2 py-3 transition-colors ${active ? "border-[var(--accent)] font-bold text-[var(--accent)]" : "border-transparent font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"}`}
          >
            <Icon name={icon} className="h-[18px] w-[18px]" />
            <span className="mono-label">{index} {label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="surface sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-4 backdrop-blur sm:px-5 lg:hidden">
        <Link href="/" className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold tracking-normal">Artkin Carreon</Link>
        <div className="flex items-center gap-4 text-[var(--accent)]">
          <Icon name="systems" className="h-5 w-5" />
          <button onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center border border-[var(--line)]" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
            <Icon name={open ? "close" : "menu"} className="h-5 w-5" />
          </button>
        </div>
        {open ? (
          <div className="surface absolute left-0 right-0 top-16 border-b border-[var(--line)] p-5 shadow-none">
            <NavLinks close={() => setOpen(false)} />
          </div>
        ) : null}
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar)] flex-col justify-between border-r border-[var(--line)] bg-[var(--paper-pure)] px-8 py-8 lg:flex">
        <div className="space-y-12">
          <Link href="/" className="block">
            <div className="whitespace-nowrap font-[family-name:var(--font-geist-mono)] text-lg font-semibold leading-none tracking-normal">Artkin Carreon</div>
          </Link>
          <NavLinks />
        </div>
        <div className="space-y-8">
          <Link className="button-primary sidebar-download w-full" href="/about">Download CV</Link>
          <div className="space-y-4">
            <div className="mono-meta muted flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              SYSTEM READY
            </div>
            <div className="flex gap-4 text-[var(--ink-soft)]">
              <Link href="/contact" aria-label="Contact"><Icon name="link" className="h-[18px] w-[18px]" /></Link>
              <Link href="/work" aria-label="Project terminal"><Icon name="terminal" className="h-[18px] w-[18px]" /></Link>
              <Link href="/about" aria-label="About Artkin"><Icon name="share" className="h-[18px] w-[18px]" /></Link>
            </div>
          </div>
        </div>
      </aside>

      <main id="main-content" className="site-main" tabIndex={-1}>{children}</main>
    </>
  );
}
