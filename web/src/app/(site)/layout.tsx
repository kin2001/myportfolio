import { Roboto } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteFooter } from "@/components/site-footer";

const publicSans = Roboto({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-public-sans",
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={publicSans.variable}>
      <SiteShell footer={<SiteFooter />}>{children}</SiteShell>
      <ScrollReveal />
    </div>
  );
}
