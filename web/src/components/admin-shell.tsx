"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/admin"],
  ["Projects", "/admin/projects"],
  ["Credentials", "/admin/credentials"],
  ["Inquiries", "/admin/inquiries"],
  ["Settings", "/admin/settings"],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="surface sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-5 md:px-8">
        <div><Link href="/admin" className="font-semibold">ARTKIN / CONTROL</Link><span className="mono-meta muted ml-4 hidden sm:inline">PRIVATE OPERATIONS</span></div>
        <Link href="/" className="mono-label accent">View public site →</Link>
      </header>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="surface min-w-0 max-w-full overflow-hidden border-b border-[var(--line)] p-4 md:min-h-[calc(100vh-64px)] md:border-b-0 md:border-r md:p-6">
          <nav className="flex w-full max-w-full gap-2 overflow-x-auto md:flex-col" aria-label="Admin navigation">
            {links.map(([label, href]) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              return <Link key={href} href={href} className={"mono-label min-h-11 whitespace-nowrap border-l-2 px-4 py-4 " + (active ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent ink-soft hover:text-[var(--accent)]")}>{label}</Link>;
            })}
          </nav>
          <div className="mono-meta muted mt-10 hidden md:block">AUTH STATUS<br /><span className="accent">UI MODE / NOT CONNECTED</span></div>
        </aside>
        <main className="min-w-0 p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}
