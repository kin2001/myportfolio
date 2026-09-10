import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);

function setup({ saved, dark = false, blocked = false, reduced = false, motion = false, startFails = false } = {}) {
  const storage = new Map(saved === undefined ? [] : [["portfolio-theme", saved]]);
  const localStorage = {
    getItem(key) { if (blocked) throw new Error("Storage disabled"); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error("Storage disabled"); storage.set(key, value); },
  };
  const system = Object.assign(new EventTarget(), { matches: dark });
  const window = Object.assign(new EventTarget(), {
    localStorage, innerWidth: 1440, innerHeight: 900,
    matchMedia: (query) => query.includes("reduced-motion") ? { matches: reduced } : system,
  });
  const styles = new Map();
  const document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => styles.set(key, value), removeProperty: (key) => styles.delete(key) },
    },
    querySelector: () => null,
  };
  const transitions = [];
  if (motion) document.startViewTransition = (update) => {
    if (startFails) throw new Error("Snapshot unavailable");
    let finish;
    const ready = Promise.resolve().then(update);
    const transition = {
      ready, finished: ready.then(() => new Promise((resolve) => { finish = resolve; })),
      skipped: false,
      skipTransition() { this.skipped = true; finish?.(); },
      finish() { finish?.(); },
    };
    transitions.push(transition);
    return transition;
  };
  const exports = {};
  const context = createContext({ exports, document, window, localStorage, Event });
  runInContext(outputText, context);
  runInContext(exports.themeBootstrap, context);
  return { ...exports, document, storage, system, window, styles, transitions };
}

test("first paint follows the system unless a valid preference was saved", () => {
  assert.equal(setup().getTheme(), "light");
  assert.equal(setup({ dark: true }).getTheme(), "dark");
  assert.equal(setup({ dark: true, saved: "light" }).getTheme(), "light");
  assert.equal(setup({ saved: "dark" }).getTheme(), "dark");
  assert.equal(setup({ dark: true, saved: "invalid" }).getTheme(), "dark");
});

test("system changes update the default but never override a manual choice", () => {
  const env = setup();
  let updates = 0;
  const unsubscribe = env.subscribeTheme(() => updates++);
  env.system.matches = true;
  env.system.dispatchEvent(new Event("change"));
  assert.equal(env.getTheme(), "dark");
  env.setTheme("light");
  env.system.dispatchEvent(new Event("change"));
  assert.equal(env.getTheme(), "light");
  assert.equal(env.storage.get("portfolio-theme"), "light");
  assert.equal(updates, 2);
  unsubscribe();
});

test("all controls update together and listeners are removed on unmount", () => {
  const env = setup();
  let first = 0;
  let second = 0;
  const offFirst = env.subscribeTheme(() => first++);
  const offSecond = env.subscribeTheme(() => second++);
  env.setTheme("dark");
  assert.equal(first, 1);
  assert.equal(second, 1);
  offFirst();
  env.setTheme("light");
  assert.equal(first, 1);
  assert.equal(second, 2);
  offSecond();
});

test("another tab can change or clear the preference; unrelated storage is ignored", () => {
  const env = setup({ saved: "light", dark: true });
  const unsubscribe = env.subscribeTheme(() => {});
  const storageEvent = (key, newValue) => Object.assign(new Event("storage"), { key, newValue });
  env.window.dispatchEvent(storageEvent("unrelated", "dark"));
  assert.equal(env.getTheme(), "light");
  env.window.dispatchEvent(storageEvent("portfolio-theme", "dark"));
  assert.equal(env.getTheme(), "dark");
  env.window.dispatchEvent(storageEvent("portfolio-theme", null));
  assert.equal(env.document.documentElement.dataset.themePreference, "system");
  env.window.dispatchEvent(storageEvent(null, null));
  assert.equal(env.getTheme(), "dark");
  unsubscribe();
});

test("blocked storage does not break first paint or theme switching", () => {
  const env = setup({ dark: true, blocked: true });
  assert.equal(env.getTheme(), "dark");
  env.setTheme("light");
  env.initializeTheme();
  assert.equal(env.getTheme(), "light");
});

test("initialization restores attributes after a development remount", () => {
  const env = setup({ saved: "dark" });
  env.document.documentElement.dataset = {};
  env.initializeTheme();
  assert.equal(env.getTheme(), "dark");
});

test("returning from admin rereads changes made in another tab", () => {
  const env = setup({ saved: "dark" });
  env.storage.set("portfolio-theme", "light");
  env.initializeTheme();
  assert.equal(env.getTheme(), "light");
  env.storage.delete("portfolio-theme");
  env.initializeTheme();
  assert.equal(env.document.documentElement.dataset.themePreference, "system");
});

test("the circular reveal starts at the control and reaches every viewport corner", async () => {
  const env = setup({ motion: true });
  const portrait = { complete: false, loading: "lazy", decode: async () => {} };
  env.document.querySelector = () => portrait;
  env.transitionTheme("dark", { x: 100, y: 50 });
  const transition = env.transitions[0];
  await transition.ready;
  assert.equal(env.getTheme(), "dark");
  assert.equal(portrait.loading, "eager");
  assert.equal(env.styles.get("--theme-origin-x"), "100px");
  assert.equal(env.styles.get("--theme-origin-y"), "50px");
  assert.equal(env.styles.get("--theme-radius"), `${Math.ceil(Math.hypot(1340, 850))}px`);
  transition.finish();
  await transition.finished;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.document.documentElement.dataset.themeTransition, undefined);
  assert.equal(env.styles.size, 0);
});

test("reduced motion and older browsers switch immediately without a reveal", () => {
  for (const options of [{ motion: true, reduced: true }, { motion: false }]) {
    const env = setup(options);
    env.transitionTheme("dark", { x: 100, y: 50 });
    assert.equal(env.getTheme(), "dark");
    assert.equal(env.transitions.length, 0);
    assert.equal(env.styles.size, 0);
  }
});

test("a failed snapshot still changes the theme and clears transition styles", () => {
  const env = setup({ motion: true, startFails: true });
  env.transitionTheme("dark", { x: 100, y: 50 });
  assert.equal(env.getTheme(), "dark");
  assert.equal(env.document.documentElement.dataset.themeTransition, undefined);
  assert.equal(env.styles.size, 0);
});

test("a repeated toggle skips the older animation without clearing the new one", async () => {
  const env = setup({ motion: true });
  env.transitionTheme("dark", { x: 100, y: 50 });
  await env.transitions[0].ready;
  env.transitionTheme("light", { x: 100, y: 50 });
  await env.transitions[1].ready;
  assert.equal(env.transitions[0].skipped, true);
  assert.equal(env.getTheme(), "light");
  assert.equal(env.document.documentElement.dataset.themeTransition, "circle");
  env.transitions[1].finish();
  await env.transitions[1].finished;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.document.documentElement.dataset.themeTransition, undefined);
});

test("dark text, accent labels, and field boundaries have sufficient contrast", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const dark = css.match(/:root\[data-theme="dark"\]:has\(\.site-main, \[data-public-error\]\)\s*\{([^}]+)\}/)?.[1];
  assert.ok(dark, "The palette is scoped to public pages");
  const colors = Object.fromEntries([...dark.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(([, key, hex]) => [key, hex]));
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  }
  function contrast(a, b) {
    const values = [luminance(colors[a]), luminance(colors[b])].sort((x, y) => y - x);
    return (values[0] + .05) / (values[1] + .05);
  }
  for (const surface of ["paper", "paper-pure", "paper-soft"]) {
    for (const text of ["ink", "ink-soft", "muted", "accent", "danger"]) {
      assert.ok(contrast(text, surface) >= 4.5, `${text} on ${surface}`);
    }
    assert.ok(contrast("control-line", surface) >= 3, `Field boundary on ${surface}`);
  }
  assert.ok(contrast("accent-ink", "accent") >= 4.5);
});
