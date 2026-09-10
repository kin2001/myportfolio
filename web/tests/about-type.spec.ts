import { expect, test } from "@playwright/test";

test("About leads with a concise professional profile without repeated background sections", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-reveal]").first()).toHaveAttribute("data-reveal-state", "revealed", { timeout: 20_000 });
  await expect(page.getByText("OPEN FOR PROJECTS", { exact: true })).toBeVisible();
  await expect(page.getByText("OPEN TO FREELANCE", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-phone-layout="fact-row"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Engineering roots. Automation in practice." })).toHaveCount(0);
  const profile = page.locator('[data-phone-layout="about-hero"]');
  await expect(profile.getByRole("heading", { name: "Artkin Carreon", exact: true })).toBeVisible();
  await expect(profile).toContainText("AI Automation & GoHighLevel Specialist");
  await expect(page.getByText(/Computer Engineering graduate/)).toHaveCount(1);
  await expect(profile).toContainText("Jose Rizal Memorial State University, Dapitan City");
  await expect(page.getByRole("heading", { name: "Have a project in mind?" })).toHaveCount(1);
  const sizes: Record<number, number> = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await profile.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const columns = await profile.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(2);
      sizes[width] = await profile.locator("h1").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await profile.screenshot({ path: `../.impeccable/refresh-final/about-profile-${theme}-${width}.png` });
    }
    expect(sizes[360]).toBeLessThan(sizes[1440]);
  }
});
