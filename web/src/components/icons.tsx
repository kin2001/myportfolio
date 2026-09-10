import type { SVGProps } from "react";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    replay: <><path d="M3 4v6h6M3.5 10a9 9 0 1 1 1 8" /></>,
    work: <><path d="M3 7.5h18v11H3z"/><path d="M3 7.5 6 4.5h5l2 3"/></>,
    systems: <><circle cx="5" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="19" r="2"/><path d="m6.5 10.5 4-4m3 0 4 4m0 3-4 4m-3 0-4-4"/></>,
    experience: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    signal: <><path d="M8 9a5 5 0 0 0 0 6m8-6a5 5 0 0 1 0 6M5 6a9 9 0 0 0 0 12m14-12a9 9 0 0 1 0 12"/><circle cx="12" cy="12" r="1.5"/></>,
    credentials: <><circle cx="12" cy="10" r="6"/><path d="m8.5 15-1 6 4.5-2 4.5 2-1-6"/><path d="m9.5 10 1.6 1.6 3.6-3.6"/></>,
    about: <><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></>,
    contact: <><rect x="3" y="5" width="18" height="14"/><path d="m3 7 9 6 9-6"/></>,
    github: <><path d="M9 19c-4.3 1.3-4.3-2-6-2m12 5v-3.9a3.4 3.4 0 0 0-.9-2.7c3-.3 6.2-1.5 6.2-6.9a5.4 5.4 0 0 0-1.5-3.7 5 5 0 0 0-.1-3.7s-1.2-.4-3.8 1.4a13 13 0 0 0-6.9 0C5.4.7 4.2 1.1 4.2 1.1a5 5 0 0 0-.1 3.7 5.4 5.4 0 0 0-1.5 3.8c0 5.3 3.2 6.5 6.2 6.8a3.4 3.4 0 0 0-.9 2.6v4" /></>,
    linkedin: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 10v7M11.5 17v-7m0 3a3 3 0 0 1 6 0v4"/><circle cx="7.5" cy="7" r=".75" fill="currentColor" stroke="none"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></>,
    terminal: <><rect x="3" y="5" width="18" height="14"/><path d="m7 9 3 3-3 3m5 0h5"/></>,
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5m-8 7 8 5"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
