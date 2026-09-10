export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "portfolio-theme";
const SYSTEM_THEME = "(prefers-color-scheme: dark)";
const THEME_EVENT = "portfolio-theme-change";
let activeTransition: ViewTransition | undefined;

// Static, early head script: no request data, cookies, or new rendering dependency.
export const themeBootstrap = `(function(){var r=document.documentElement,p="system";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark")p=s}catch(e){}r.dataset.themePreference=p;r.dataset.theme=p==="system"?(window.matchMedia("${SYSTEM_THEME}").matches?"dark":"light"):p})()`;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function applyPreference(preference: Theme | "system") {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === "system"
    ? window.matchMedia(SYSTEM_THEME).matches ? "dark" : "light"
    : preference;
}

export function initializeTheme() {
  // React's development remount can clear the attributes set before hydration.
  const current = document.documentElement.dataset.themePreference;
  let preference: Theme | "system" = isTheme(current) ? current : "system";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    preference = isTheme(saved) ? saved : "system";
  } catch { /* The theme still works when browser storage is unavailable. */ }
  applyPreference(preference);
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  applyPreference(theme);
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep the choice for this page session. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function transitionTheme(theme: Theme, origin: { x: number; y: number }) {
  activeTransition?.skipTransition();
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTheme(theme);
    return;
  }
  const root = document.documentElement;
  const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
  root.style.setProperty("--theme-origin-x", `${origin.x}px`);
  root.style.setProperty("--theme-origin-y", `${origin.y}px`);
  root.style.setProperty("--theme-radius", `${Math.ceil(radius)}px`);
  root.dataset.themeTransition = "circle";
  const clearTransition = () => {
    delete root.dataset.themeTransition;
    for (const property of ["--theme-origin-x", "--theme-origin-y", "--theme-radius"]) root.style.removeProperty(property);
  };
  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(async () => {
      setTheme(theme);
      const portrait = document.querySelector<HTMLImageElement>(`.portrait-${theme}`);
      if (portrait && !portrait.complete) {
        portrait.loading = "eager";
        await portrait.decode().catch(() => undefined);
      }
    });
  } catch {
    activeTransition = undefined;
    clearTransition();
    setTheme(theme);
    return;
  }
  activeTransition = transition;
  // Skipping an interrupted animation rejects ready, but still applies its update.
  void transition.ready.catch(() => undefined);
  void transition.finished.catch(() => {
    if (activeTransition === transition) setTheme(theme);
  }).finally(() => {
    if (activeTransition !== transition) return;
    activeTransition = undefined;
    clearTransition();
  });
}

export function subscribeTheme(onChange: () => void) {
  const system = window.matchMedia(SYSTEM_THEME);
  const onSystemChange = () => {
    if (document.documentElement.dataset.themePreference !== "system") return;
    applyPreference("system");
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyPreference(isTheme(event.newValue) ? event.newValue : "system");
    onChange();
  };
  system.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    system.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}
