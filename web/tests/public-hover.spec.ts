import { expect, test } from "@playwright/test";

test("public buttons and cards share themed hover, focus, and reduced-motion feedback", async ({ page, browser }) => {
  test.setTimeout(180_000);
  for (const route of ["/", "/work", "/credentials"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-reveal]").first()).toHaveAttribute("data-reveal-state", /waiting|revealed/, { timeout: 20_000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const card = page.locator(".public-record-link").first();
        await card.hover();
        await expect(card).toHaveCSS("translate", "0px -3px");
        await expect(card).toHaveCSS("box-shadow", "none");
        await expect(card.locator(".public-card-title")).toHaveCSS("color", theme === "light" ? "rgb(36, 56, 156)" : "rgb(168, 181, 255)");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        if (route === "/") await card.screenshot({ path: `../.impeccable/refresh-final/hover-card-${theme}-${width}.png` });
        await page.mouse.move(0, 0);
        await card.focus();
        await expect(card).toHaveCSS("outline-style", "solid");
        await expect(card).toHaveCSS("translate", "none");
        await card.evaluate(el => (el as HTMLElement).blur());
      }
      if (route === "/") {
        const button = page.getByRole("link", { name: "Explore my work", exact: true });
        await button.hover();
        await expect(button).toHaveCSS("translate", "0px -2px");
        await expect(button).toHaveCSS("background-color", theme === "light" ? "rgb(26, 28, 27)" : "rgb(241, 240, 236)");
        await expect(button).toHaveCSS("color", theme === "light" ? "rgb(250, 249, 247)" : "rgb(21, 23, 22)");
        await expect(button.locator("svg")).toHaveCount(1);
        await button.screenshot({ path: `../.impeccable/refresh-final/hover-button-${theme}.png` });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(button).toHaveCSS("translate", "none");
        await expect(button.locator("svg")).toHaveCSS("transform", "none");
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
    }
  }
  const touch = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  try {
    const phone = await touch.newPage();
    await phone.goto("/", { waitUntil: "domcontentloaded" });
    expect(await phone.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
    const card = phone.locator(".public-record-link").first();
    await card.hover();
    await expect(card).toHaveCSS("translate", "none");
    const button = phone.getByRole("link", { name: "Explore my work", exact: true });
    await button.hover();
    await expect(button).toHaveCSS("translate", "none");
    await expect(button).toHaveCSS("background-color", "rgb(36, 56, 156)");
  } finally {
    await touch.close();
  }
});
