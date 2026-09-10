"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export function BackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/");
  }

  return (
    <button type="button" className="hero-link hero-link-back" onClick={goBack}>
      <span aria-hidden="true"><Icon name="arrow" className="rotate-180" /></span>
      Back
    </button>
  );
}
