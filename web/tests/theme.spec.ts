import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("system theme, saved override, and admin isolation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/admin/login");
  expect(await page.locator("html").evaluate((root) => getComputedStyle(root).getPropertyValue("--paper").trim())).toBe("#faf9f7");
  await page.goto("/about");
  await expect(page.locator(".portrait-dark")).toBeVisible();
  await expect(page.locator(".portrait-light")).toBeHidden();
});

test("mobile theme button supports keyboard interaction without opening the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  const currentBounds = await page.getByRole("button", { name: "Switch to light mode" }).boundingBox();
  expect(currentBounds?.width).toBeGreaterThanOrEqual(44);
  expect(currentBounds?.height).toBeGreaterThanOrEqual(44);
});

test("both themes keep approved responsive widths and readable public content", async ({ page }) => {
  test.setTimeout(120_000);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expect(page.locator(`.portrait-${colorScheme}`)).toBeVisible();
    }
  }
  expect((await new AxeBuilder({ page }).exclude('iframe[src*="challenges.cloudflare.com"]').analyze()).violations).toEqual([]);
});

test("home section surfaces follow the selected palette in light and dark themes", async ({ page }) => {
  test.setTimeout(120_000);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
    const colors = await page.evaluate(() => {
      const neutral = document.querySelector<HTMLElement>('[data-home-surface="neutral"]');
      const credentials = document.querySelector<HTMLElement>('#credentials[data-home-surface="plain"]');
      const tint = document.querySelector<HTMLElement>('#contact[data-home-surface="tint"]');
      const plain = document.querySelector<HTMLElement>("#projects");
      const projectCard = plain?.querySelector<HTMLElement>("[data-project-index-card]");
      const credentialCard = credentials?.querySelector<HTMLElement>("[data-credential-index-card]");
      if (!neutral || !credentials || !tint || !plain || !projectCard || !credentialCard) return null;
      return {
        canvas: getComputedStyle(document.body).backgroundColor,
        neutral: getComputedStyle(neutral).backgroundColor,
        credentials: getComputedStyle(credentials).backgroundColor,
        projectCard: getComputedStyle(projectCard).backgroundColor,
        tint: getComputedStyle(tint).backgroundColor,
        tintInk: getComputedStyle(tint).color,
        credentialCard: getComputedStyle(credentialCard).backgroundColor,
        credentialCardInk: getComputedStyle(credentialCard).color,
        plain: getComputedStyle(plain).backgroundColor,
      };
    });
    expect(colors).not.toBeNull();
    expect(colors?.tint).toBe(colorScheme === "light" ? "rgb(240, 241, 238)" : "rgb(32, 37, 34)");
    expect(colors?.tintInk).toBe(colorScheme === "light" ? "rgb(26, 28, 27)" : "rgb(241, 240, 236)");
    expect(colors?.credentialCard).toBe(colorScheme === "light" ? "rgb(255, 255, 255)" : "rgb(28, 31, 29)");
    expect(colors?.credentialCardInk).toBe(colorScheme === "light" ? "rgb(26, 28, 27)" : "rgb(241, 240, 236)");
    expect(colors?.projectCard).toBe(colorScheme === "light" ? "rgb(255, 255, 255)" : colors?.canvas);
    expect(colors?.credentials).toBe(colors?.plain);
    expect(colors?.neutral).toBe(colors?.plain);
    expect(colors?.tint).not.toBe(colors?.plain);
  }
});

test("homepage preserves its paired composition at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");

  const layout = await page.evaluate(() => {
    const projectCards = [...document.querySelectorAll<HTMLElement>("#projects article")].slice(0, 2);
    const credentialCards = [...document.querySelectorAll<HTMLElement>("#credentials article")].slice(0, 2);
    const projectGrid = projectCards[0]?.parentElement;
    const credentialGrid = credentialCards[0]?.parentElement;
    const approachGrid = document.querySelector<HTMLElement>("[data-approach-grid]");
    const hero = document.querySelector<HTMLElement>('[data-reveal="hero"]');
    const facts = document.querySelector<HTMLElement>('[data-home-surface="neutral"]');
    const projectBody = projectCards[0]?.querySelector<HTMLElement>(".public-body");
    const heroLink = hero?.querySelector<HTMLElement>(".hero-link");
    const columnCount = (element: HTMLElement | null | undefined) =>
      element ? getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
    const sameRow = (elements: HTMLElement[]) => {
      if (elements.length < 2) return false;
      return Math.abs(elements[0].getBoundingClientRect().top - elements[1].getBoundingClientRect().top) <= 1;
    };

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      projectColumns: columnCount(projectGrid),
      credentialColumns: columnCount(credentialGrid),
      approachColumns: columnCount(approachGrid),
      heroColumns: columnCount(hero),
      factColumns: columnCount(facts),
      projectSameRow: sameRow(projectCards),
      credentialSameRow: sameRow(credentialCards),
      projectBodySize: projectBody ? Number.parseFloat(getComputedStyle(projectBody).fontSize) : 0,
      heroLinkHeight: heroLink?.getBoundingClientRect().height ?? 0,
    };
  });

  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.projectColumns).toBe(2);
  expect(layout.credentialColumns).toBe(2);
  expect(layout.approachColumns).toBe(2);
  expect(layout.heroColumns).toBe(2);
  expect(layout.factColumns).toBe(4);
  expect(layout.projectSameRow).toBe(true);
  expect(layout.credentialSameRow).toBe(true);
  expect(layout.projectBodySize).toBeGreaterThanOrEqual(12);
  expect(layout.heroLinkHeight).toBeGreaterThanOrEqual(44);
});

test("switching the contact theme preserves the unsubmitted inquiry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  await page.goto("/contact");
  await page.getByLabel("Name *", { exact: true }).fill("Theme preview");
  await page.getByLabel("What would you like to automate? *").fill("This text must remain when the visitor changes the color theme.");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Name *", { exact: true })).toHaveValue("Theme preview");
  await expect(page.getByLabel("What would you like to automate? *")).toHaveValue("This text must remain when the visitor changes the color theme.");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
