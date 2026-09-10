"use client";

import { animate, stagger } from "motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const revealSelector = "[data-reveal]";

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(revealSelector),
    );
    if (!elements.length) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;
    const headingAnimations = new WeakMap<HTMLElement, ReturnType<typeof animate>[]>();

    const resetHeading = (heading: HTMLElement) => {
      headingAnimations.get(heading)?.forEach((animation) => animation.stop());
      heading.querySelectorAll<HTMLElement>("[data-heading-word], [data-heading-rule]").forEach((part) => {
        part.style.removeProperty("opacity");
        part.style.removeProperty("transform");
        part.style.removeProperty("filter");
        part.style.removeProperty("clip-path");
      });
    };

    const animateHeading = (element: HTMLElement) => {
      const heading = element.querySelector<HTMLElement>("[data-animated-heading]");
      if (!heading) return;
      resetHeading(heading);
      if (motionPreference.matches) return;

      const words = heading.querySelectorAll<HTMLElement>("[data-heading-word]");
      const rule = heading.querySelector<HTMLElement>("[data-heading-rule]");
      const animations: ReturnType<typeof animate>[] = [];
      if (words.length) {
        animations.push(animate(words, {
          opacity: [0, 1],
          transform: ["translate3d(0, .68em, 0)", "translate3d(0, 0, 0)"],
          filter: ["blur(7px)", "blur(0px)"],
          clipPath: ["inset(0 0 58% 0)", "inset(0 0 0% 0)"],
        }, {
          delay: stagger(0.045, { startDelay: 0.04 }),
          duration: 0.72,
          ease: [0.16, 1, 0.3, 1],
        }));
      }
      if (rule) {
        animations.push(animate(rule, {
          opacity: [0, 1],
          transform: ["scaleX(0)", "scaleX(1)"],
        }, {
          delay: Math.min(words.length * 0.045 + 0.08, 0.42),
          duration: 0.62,
          ease: [0.16, 1, 0.3, 1],
        }));
      }
      headingAnimations.set(heading, animations);
    };

    const reveal = (element: HTMLElement) => {
      element.dataset.revealState = "revealed";
      animateHeading(element);
    };

    const revealAll = () => elements.forEach(reveal);

    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const pending = elements.filter((element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top <= window.innerHeight && bounds.bottom >= 0) {
        reveal(element);
        return true;
      }
      element.dataset.revealState = "waiting";
      return true;
    });

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting || motionPreference.matches) {
            reveal(element);
          } else if (!element.contains(document.activeElement)) {
            element.dataset.revealState = "waiting";
          }
        }
      },
      { rootMargin: "0px", threshold: 0.08 },
    );
    pending.forEach((element) => observer?.observe(element));

    const revealFocusedGroup = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const group = event.target.closest<HTMLElement>(revealSelector);
      if (group) reveal(group);
    };
    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) revealAll();
    };

    document.addEventListener("focusin", revealFocusedGroup);
    motionPreference.addEventListener("change", handleMotionChange);
    return () => {
      observer?.disconnect();
      elements.forEach((element) => {
        const heading = element.querySelector<HTMLElement>("[data-animated-heading]");
        if (heading) resetHeading(heading);
      });
      document.removeEventListener("focusin", revealFocusedGroup);
      motionPreference.removeEventListener("change", handleMotionChange);
    };
  }, [pathname]);

  return null;
}
