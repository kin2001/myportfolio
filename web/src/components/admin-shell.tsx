"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

const links = [
  ["Dashboard", "/admin"],
  ["Projects", "/admin/projects"],
  ["CV", "/admin/cv"],
  ["Credentials", "/admin/credentials"],
  ["Activity & Export", "/admin/activity"],
] as const;

function NavigationPendingIndicator({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        aria-hidden="true"
        className={`ml-auto h-1.5 w-1.5 shrink-0 bg-current transition-opacity delay-100 motion-reduce:transition-none ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="sr-only" role="status">{pending ? `Loading ${label}.` : ""}</span>
    </>
  );
}

function AdminNav({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Admin navigation">
      {links.map(([label, href]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center border-r-2 px-3 py-3 transition-colors ${
              active
                ? "border-[var(--accent)] font-bold text-[var(--accent)]"
                : "border-transparent font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            <span className="mono-label">{label}</span>
            <NavigationPendingIndicator label={label} />
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  accountLabel,
  children,
}: {
  accountLabel: string;
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <a href="#admin-main" className="skip-link">Skip to admin content</a>
      <header className="surface sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-4 lg:hidden">
        <Link href="/admin" className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold">ARTKIN / CONTROL</Link>
        <button
          ref={menuButton}
          className="flex h-11 w-11 items-center justify-center border border-[var(--line)] text-[var(--accent)]"
          type="button"
          aria-controls="admin-mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "Close admin navigation" : "Open admin navigation"}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} className="h-5 w-5" />
        </button>
        {open ? (
          <div id="admin-mobile-navigation" className="surface absolute left-0 right-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[var(--line)] p-5">
            <AdminNav close={() => setOpen(false)} />
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <p className="mono-meta muted break-all">{accountLabel}</p>
              <div className="mt-4 flex flex-wrap gap-5">
                <Link href="/" className="mono-label accent inline-flex min-h-11 items-center" onClick={() => setOpen(false)}>Public site</Link>
                <form action="/auth/logout" method="post"><button className="mono-label accent inline-flex min-h-11 items-center" type="submit">Log out</button></form>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar)] flex-col justify-between border-r border-[var(--line)] bg-[var(--paper-pure)] px-8 py-8 lg:flex">
        <div className="space-y-12">
          <Link href="/admin" className="block font-[family-name:var(--font-geist-mono)] text-lg font-semibold">ARTKIN / CONTROL</Link>
          <AdminNav />
        </div>
        <div className="space-y-5 border-t border-[var(--line)] pt-6">
          <p className="mono-meta muted break-all">{accountLabel}</p>
          <Link href="/" className="mono-label accent block min-h-11 py-3">View public site</Link>
          <form action="/auth/logout" method="post">
            <button className="button-secondary w-full" type="submit">Log out</button>
          </form>
        </div>
      </aside>

      <main id="admin-main" className="min-h-screen min-w-0 p-5 sm:p-8 lg:ml-[var(--sidebar)] lg:p-10" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
