"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ThemeControls } from "@/components/theme-controls";

const navigation = [
  ["01", "Projects", "/work", "work"],
  ["02", "Credentials", "/credentials", "credentials"],
  ["03", "About", "/about", "about"],
  ["04", "Contact", "/contact", "contact"],
] as const;

function NavLinks({ close }: { close?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1">
      {navigation.map(([index, label, href, icon]) => {
        const active = href === "/work"
          ? pathname.startsWith("/work")
          : href === "/credentials"
            ? pathname.startsWith("/credentials")
            : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
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

export function SiteShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="surface sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-4 backdrop-blur sm:px-5 lg:hidden">
        <Link href="/" className="flex min-h-11 items-center font-[family-name:var(--font-geist-mono)] text-lg font-semibold tracking-normal">Artkin Carreon</Link>
        <div className="flex items-center gap-2 text-[var(--accent)] sm:gap-4">
          <ThemeControls />
          <button ref={menuButton} onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center border border-[var(--line)]" aria-label={open ? "Close navigation" : "Open navigation"} aria-controls="site-mobile-navigation" aria-expanded={open}>
            <Icon name={open ? "close" : "menu"} className="h-5 w-5" />
          </button>
        </div>
        {open ? (
          <div id="site-mobile-navigation" className="surface absolute left-0 right-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[var(--line)] p-5 shadow-none">
            <NavLinks close={closeMenu} />
            <a className="button-primary mt-5 w-full" href="/resume.pdf" download="Artkin-Carreon-CV.pdf" onClick={closeMenu}>Download CV</a>
          </div>
        ) : null}
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar)] flex-col justify-between gap-8 overflow-y-auto border-r border-[var(--line)] bg-[var(--paper-pure)] px-8 py-8 lg:flex">
        <div className="shrink-0 space-y-12">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <div className="whitespace-nowrap font-[family-name:var(--font-geist-mono)] text-lg font-semibold leading-none tracking-normal">Artkin Carreon</div>
          </Link>
          <NavLinks />
        </div>
        <div className="shrink-0 space-y-8">
          <a className="sidebar-cv" href="/resume.pdf" download="Artkin-Carreon-CV.pdf">Download CV <Icon name="download" className="h-4 w-4" /></a>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 text-[var(--ink-soft)]">
              <Link className="flex h-11 w-11 items-center justify-center transition-colors hover:text-[var(--accent)]" href="/contact" aria-label="Contact"><Icon name="link" className="h-[18px] w-[18px]" /></Link>
              <Link className="flex h-11 w-11 items-center justify-center transition-colors hover:text-[var(--accent)]" href="/work" aria-label="Project terminal"><Icon name="terminal" className="h-[18px] w-[18px]" /></Link>
              <Link className="flex h-11 w-11 items-center justify-center transition-colors hover:text-[var(--accent)]" href="/about" aria-label="About Artkin"><Icon name="share" className="h-[18px] w-[18px]" /></Link>
            </div>
            <ThemeControls />
          </div>
        </div>
      </aside>

      <div className="site-main">
        <main id="main-content" tabIndex={-1}>{children}</main>
        {footer}
      </div>
    </>
  );
}
