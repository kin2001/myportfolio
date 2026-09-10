import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Keep these Node-only checks outside Playwright's test directory.
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/components/scroll-reveal.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
);

function setup({ pathname = "/", reducedMotion = false, supported = true, withHeading = false } = {}) {
  class Element {
    dataset = {};
    constructor(top, bottom) { this.bounds = { top, bottom }; }
    getBoundingClientRect() { return this.bounds; }
    contains(target) { return target === this; }
    closest() { return this; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }
  const visible = new Element(0, 500);
  if (withHeading) {
    const word = { style: { removeProperty() {} } };
    const heading = { querySelectorAll: () => [word], querySelector: () => null };
    visible.querySelector = () => heading;
  }
  const offscreen = new Element(1_200, 1_600);
  const elements = [visible, offscreen];
  const listeners = new Map();
  const document = {
    activeElement: null,
    querySelectorAll: () => elements,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  const preference = {
    matches: reducedMotion,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  let observer;
  class IntersectionObserver {
    observed = new Set();
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      observer = this;
    }
    observe(element) { this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); }
    enter(element, isIntersecting) {
      if (this.observed.has(element)) this.callback([{ target: element, isIntersecting }]);
    }
  }
  let cleanup;
  const animations = [];
  const exports = {};
  runInNewContext(outputText, {
    exports, document, Element, IntersectionObserver,
    window: {
      innerHeight: 900,
      matchMedia: () => preference,
      ...(supported ? { IntersectionObserver } : {}),
    },
    require: (name) => {
      if (name === "motion") {
        return {
          animate: () => {
            const animation = { stopped: false, stop() { this.stopped = true; } };
            animations.push(animation);
            return animation;
          },
          stagger: () => 0,
        };
      }
      if (name === "next/navigation") return { usePathname: () => pathname };
      if (name === "react") return { useEffect: (effect) => { cleanup = effect(); } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  exports.ScrollReveal();
  return { visible, offscreen, observer, document, listeners, preference, cleanup, animations };
}

test("Home sections and the hero replay after every viewport exit", () => {
  const { visible, offscreen, observer } = setup();
  visible.dataset.reveal = "hero";
  assert.equal(visible.dataset.revealState, "revealed");
  assert.equal(offscreen.dataset.revealState, "waiting");
  assert.equal(observer.options.rootMargin, "0px");
  assert.equal(observer.observed.size, 2);
  for (let i = 0; i < 3; i++) {
    observer.enter(offscreen, true);
    assert.equal(offscreen.dataset.revealState, "revealed");
    observer.enter(offscreen, false);
    assert.equal(offscreen.dataset.revealState, "waiting");
  }
  observer.enter(visible, false);
  assert.equal(visible.dataset.revealState, "waiting");
  observer.enter(visible, true);
  assert.equal(visible.dataset.revealState, "revealed");
  assert.equal(observer.observed.size, 2);
});

test("Other public routes replay reading content on re-entry", () => {
  const { visible, offscreen, observer } = setup({ pathname: "/work" });
  assert.equal(observer.options.rootMargin, "0px");
  assert.equal(observer.observed.has(visible), true);
  observer.enter(offscreen, true);
  assert.equal(offscreen.dataset.revealState, "revealed");
  assert.equal(observer.observed.has(offscreen), true);
  observer.enter(offscreen, false);
  assert.equal(offscreen.dataset.revealState, "waiting");
  observer.enter(offscreen, true);
  assert.equal(offscreen.dataset.revealState, "revealed");
});

test("Media still replays its original entry motion", () => {
  const { offscreen, observer } = setup({ pathname: "/work/example" });
  offscreen.dataset.reveal = "media";
  observer.enter(offscreen, true);
  assert.equal(offscreen.dataset.revealState, "revealed");
  observer.enter(offscreen, false);
  assert.equal(offscreen.dataset.revealState, "waiting");
});

test("Keyboard focus reveals a group and prevents offscreen hiding", () => {
  const { offscreen, observer, document, listeners } = setup();
  document.activeElement = offscreen;
  listeners.get("focusin")({ target: offscreen });
  assert.equal(offscreen.dataset.revealState, "revealed");
  observer.enter(offscreen, false);
  assert.equal(offscreen.dataset.revealState, "revealed");
});

test("Reduced motion exposes all groups without an observer", () => {
  const { visible, offscreen, observer } = setup({ reducedMotion: true });
  assert.equal(visible.dataset.revealState, "revealed");
  assert.equal(offscreen.dataset.revealState, "revealed");
  assert.equal(observer, undefined);
});

test("Changing to reduced motion keeps groups visible after viewport exits", () => {
  const { visible, offscreen, observer, preference, listeners } = setup();
  preference.matches = true;
  listeners.get("change")({ matches: true });
  observer.enter(visible, false);
  observer.enter(offscreen, false);
  assert.equal(visible.dataset.revealState, "revealed");
  assert.equal(offscreen.dataset.revealState, "revealed");
});

test("Browsers without IntersectionObserver keep all content visible", () => {
  const { visible, offscreen, observer } = setup({ supported: false });
  assert.equal(visible.dataset.revealState, "revealed");
  assert.equal(offscreen.dataset.revealState, "revealed");
  assert.equal(observer, undefined);
});

test("Switching to reduced motion stops a running heading animation", () => {
  const { preference, listeners, animations } = setup({ withHeading: true });
  assert.equal(animations.length, 1);
  assert.equal(animations[0].stopped, false);
  preference.matches = true;
  listeners.get("change")({ matches: true });
  assert.equal(animations[0].stopped, true);
});

test("Heading motion resets offscreen and replays, but not while still visible", () => {
  const { visible, observer, animations } = setup({ withHeading: true });
  observer.enter(visible, true);
  assert.equal(animations.length, 1);
  observer.enter(visible, false);
  assert.equal(animations[0].stopped, true);
  assert.equal(visible.dataset.revealState, "waiting");
  observer.enter(visible, true);
  assert.equal(animations.length, 2);
});

test("Route cleanup removes the observer and event listeners", () => {
  const { observer, listeners, cleanup } = setup();
  cleanup();
  assert.equal(observer.observed.size, 0);
  assert.equal(listeners.size, 0);
});
