import Link from "next/link";
import { Icon } from "@/components/icons";

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Portfolio footer">
      <div><p className="mono-label">AI AUTOMATION / GOHIGHLEVEL</p><p className="mono-meta muted mt-3">© 2026 ARTKIN CARREON</p></div>
      <nav aria-label="Social and contact links" className="site-footer-links">
        <Link href="/contact" className="hero-link">Email <Icon name="arrow" /></Link>
        <a href="https://github.com/kin2001" className="hero-link" target="_blank" rel="noreferrer">GitHub <Icon name="arrow" /><span className="sr-only"> (opens in a new tab)</span></a>
        <a href="https://www.linkedin.com/in/artkin-carreon-8809b8421" className="hero-link" target="_blank" rel="noreferrer">LinkedIn <Icon name="arrow" /><span className="sr-only"> (opens in a new tab)</span></a>
        <Link href="/privacy" className="hero-link">Privacy</Link>
      </nav>
    </footer>
  );
}
