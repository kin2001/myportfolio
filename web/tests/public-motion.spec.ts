import { expect, test } from "@playwright/test";

test("public motion replays on scroll, stays responsive, and reduces safely", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const details = await page.locator("#projects article a, #credentials article a").evaluateAll(links =>
    links.map(link => link.getAttribute("href")!).filter(Boolean));
  expect(details.length).toBeGreaterThan(0);

  for (const route of ["/", "/work", "/credentials", "/about", "/contact", "/privacy", ...details]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-animated-heading]")).toBeVisible();
    const groups = page.locator("[data-reveal]");
    // PDF detail pages can hydrate after DOMContentLoaded in development.
    await expect(groups.first()).toHaveAttribute("data-reveal-state", /waiting|revealed/, { timeout: 20_000 });
    for (const group of await groups.all()) {
      await group.evaluate(el => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await expect(group).toHaveAttribute("data-reveal-state", "revealed");
    }
    const card = page.locator("article[data-reveal] > .public-record-link").first();
    if (await card.count()) {
      await card.evaluate(el => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await expect(card.locator("..")).toHaveAttribute("data-reveal-state", "revealed");
      expect(await card.evaluate(el => getComputedStyle(el).animationName)).toBe("record-arrive");
    }

    if (route === "/" || route === "/about") {
      await expect(page.locator(".specialty-title")).toHaveText("GoHighLevel workflows. AI automation. Built around your business.");
      await expect(page.locator("[data-approach-item]")).toHaveCount(3);
    }
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 400 });
      for (let replay = 0; replay < 2; replay++) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await expect(groups.first()).toHaveAttribute("data-reveal-state", "revealed");
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
        await expect(groups.first()).toHaveAttribute("data-reveal-state", "waiting");
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await expect(groups.first()).toHaveAttribute("data-reveal-state", "revealed");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (route === "/") {
        for (const theme of ["light", "dark"]) {
          await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
          await page.locator("[data-approach-grid]").screenshot({ path: `../.impeccable/refresh-final/specialty-${theme}-${width}.png` });
        }
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator('[data-reveal-state="waiting"]')).toHaveCount(0);
    if (await card.count()) {
      expect(await card.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    }
    expect(await page.locator("[data-heading-word]").evaluateAll(words => words.every(word =>
      word.getAnimations().every(animation => animation.playState !== "running")))).toBe(true);
  }
});
