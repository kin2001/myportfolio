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
  const project = page.getByRole("region", { name: "Clinic AI receptionist and appointment automation" });
  await expect(project.getByRole("list", { name: "Project capabilities" }).locator("li")).toHaveCount(3);
  await expect(project.getByText("SYSTEM_RECORD / 001")).toHaveCount(0);
  const projectLink = project.getByRole("link", { name: "View project" });
  await expect(projectLink).toHaveAttribute("href", "/work/clinic-ai-receptionist-and-appointment-automation");
  const sizes: Record<number, number> = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await profile.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const columns = await profile.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(2);
      const gap = await profile.evaluate(el => el.nextElementSibling!.getBoundingClientRect().top - el.getBoundingClientRect().bottom);
      expect(gap).toBeGreaterThanOrEqual(31);
      expect(gap).toBeLessThanOrEqual(49);
      sizes[width] = await profile.locator("h1").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await profile.screenshot({ path: `../.impeccable/refresh-final/about-profile-${theme}-${width}.png` });
      await project.scrollIntoViewIfNeeded();
      expect(await project.locator("ul").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(3);
      expect((await projectLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await project.screenshot({ path: `../.impeccable/refresh-final/about-project-${theme}-${width}.png` });
    }
    expect(sizes[360]).toBeLessThan(sizes[1440]);
  }
  await projectLink.click();
  await expect(page).toHaveURL(/\/work\/clinic-ai-receptionist-and-appointment-automation$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clinic AI Receptionist");
});
