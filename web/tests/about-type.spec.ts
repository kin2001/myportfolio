import { expect, test } from "@playwright/test";

test("About replaces fact boxes with a responsive background story", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-reveal]").first()).toHaveAttribute("data-reveal-state", "revealed", { timeout: 20_000 });
  await expect(page.getByText("OPEN FOR PROJECTS", { exact: true })).toBeVisible();
  await expect(page.getByText("OPEN TO FREELANCE", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-phone-layout="fact-row"]')).toHaveCount(0);
  const story = page.getByRole("region", { name: "Engineering roots. Automation in practice." });
  await expect(story.locator("time")).toHaveAttribute("dateTime", "2026-06-25");
  await expect(story).toContainText("Jose Rizal Memorial State University, Dapitan City");
  const sizes: Record<number, number> = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await story.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const columns = await story.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(2);
      sizes[width] = await story.locator("h2").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await story.screenshot({ path: `../.impeccable/refresh-final/about-background-${theme}-${width}.png` });
    }
    expect(sizes[360]).toBeLessThan(sizes[1440]);
  }
});
