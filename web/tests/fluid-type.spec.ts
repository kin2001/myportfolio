import { expect, test } from "@playwright/test";

test("footer socials use accessible icons at every public breakpoint", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.getByRole("contentinfo", { name: "Portfolio footer" });
  const links = footer.locator(".social-icon-link");
  await expect(links).toHaveCount(3);
  await expect(footer.getByRole("link", { name: "Email", exact: true })).toHaveAttribute("href", "/contact");
  await expect(footer.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/kin2001");
  await expect(footer.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://www.linkedin.com/in/artkin-carreon-8809b8421");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await footer.scrollIntoViewIfNeeded();
      for (const link of await links.all()) {
        await expect(link.locator("svg")).toBeVisible();
        await expect(link).toHaveText("");
        const box = await link.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        await link.focus();
        expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await footer.screenshot({ path: `../.impeccable/refresh-final/socials-${theme}-${width}.png` });
    }
  }
});

test("public type scales with content width without changing peer-card placement", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const details = await page.locator("#projects article a, #credentials article a").evaluateAll(links =>
    links.map(link => link.getAttribute("href")!).filter(Boolean));
  for (const route of ["/", "/work", "/credentials", "/about", "/contact", "/privacy", ...details]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const sizes: Record<number, number[]> = {};
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      sizes[width] = await page.locator("main h1, main .public-card-title, main .public-body, main .button-primary").evaluateAll(elements =>
        elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      for (const button of await page.locator("main .button-primary, main .button-secondary").all()) {
        if (!(await button.isVisible())) continue;
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(sizes[360].length).toBeGreaterThan(0);
    for (let i = 0; i < sizes[360].length; i++) {
      expect(sizes[360][i], `${route}, element ${i}`).toBeLessThan(sizes[1440][i]);
    }
  }
});
