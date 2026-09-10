"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { getTheme, initializeTheme, subscribeTheme, transitionTheme, type Theme } from "@/lib/theme";

const serverTheme = (): Theme => "light";

export function useTheme() {
  useLayoutEffect(initializeTheme, []);
  return useSyncExternalStore(subscribeTheme, getTheme, serverTheme);
}

export function ThemeControls() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-toggle" onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      transitionTheme(next, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    }} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
    </button>
  );
}
