import Link from "next/link";
import { Icon } from "@/components/icons";

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Portfolio footer">
      <div><p className="mono-label">AI AUTOMATION / GOHIGHLEVEL</p><p className="mono-meta muted mt-3">© 2026 ARTKIN CARREON</p></div>
      <nav aria-label="Social and contact links" className="site-footer-links">
        <Link href="/contact" className="social-icon-link" aria-label="Email" title="Email"><Icon name="contact" /></Link>
        <a href="https://github.com/kin2001" className="social-icon-link" target="_blank" rel="noreferrer" aria-label="GitHub (opens in a new tab)" title="GitHub"><Icon name="github" /></a>
        <a href="https://www.linkedin.com/in/artkin-carreon-8809b8421" className="social-icon-link" target="_blank" rel="noreferrer" aria-label="LinkedIn (opens in a new tab)" title="LinkedIn"><Icon name="linkedin" /></a>
        <Link href="/privacy" className="hero-link">Privacy</Link>
      </nav>
    </footer>
  );
}
