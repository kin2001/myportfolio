import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const secondaryPublicRoutes = ["/work", "/credentials", "/about", "/contact", "/privacy"] as const;
const publicRoutes = ["/", ...secondaryPublicRoutes] as const;
const responsiveRoutes = publicRoutes;
const approvedWidths = [360, 768, 1024, 1440] as const;

test.describe.configure({ mode: "serial", timeout: 120_000 });

async function firstPublishedDetailPath(
  page: Page,
  indexPath: "/work" | "/credentials",
) {
  const response = await page.goto(indexPath);
  expect(response?.ok()).toBe(true);
  const link = page.locator(`#main-content a[href^="${indexPath}/"]`).first();
  return (await link.count()) ? link.getAttribute("href") : null;
}

async function expectNoHorizontalOverflow(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - viewportWidth;
    const offenders = overflow > 1
      ? [...document.querySelectorAll<HTMLElement>("body *")]
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return { tag: element.tagName, className: element.className, left: bounds.left, right: bounds.right };
          })
          .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
          .slice(0, 8)
      : [];
    return { overflow, offenders };
  });
  expect(layout.overflow, JSON.stringify(layout.offenders)).toBeLessThanOrEqual(1);
}

async function expectGridColumns(page: Page, layout: string, count: number) {
  const grid = page.locator(`[data-phone-layout="${layout}"]`).first();
  await expect(grid).toBeVisible();
  expect(await grid.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.display === "grid"
      ? style.gridTemplateColumns.split(/\s+/).filter(Boolean).length
      : 0;
  })).toBe(count);
}

async function expectMobileTypeScale(page: Page) {
  const offenders = await page.evaluate(() => {
    const limits = [
      { selector: ".public-body, .public-prose, .text-sm", max: 12.1 },
      { selector: ".public-card-title, .text-lg", max: 14.5 },
      { selector: ".mono-label, .mono-meta, .hero-link, .button-primary, .button-secondary, .public-index-link", max: 8.1 },
    ];

    const main = document.querySelector("#main-content");
    if (!main) return [{ className: "", fontSize: 0, max: 0, text: "Missing main content" }];

    return limits.flatMap(({ selector, max }) =>
      [...main.querySelectorAll<HTMLElement>(selector)]
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 1 && bounds.height > 1;
        })
        .map((element) => ({
          className: element.className,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          max,
          text: element.textContent?.trim().slice(0, 48),
        }))
        .filter(({ fontSize, max: maximum }) => fontSize > maximum),
    );
  });

  expect(offenders, JSON.stringify(offenders)).toEqual([]);
}

for (const route of publicRoutes) {
  test(`${route} has no automatically detectable accessibility violations`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

for (const width of approvedWidths) {
  test(`public indexes remain within the ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of responsiveRoutes) {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("collection indexes do not show inactive filter controls", async ({ page }) => {
  for (const route of ["/work", "/credentials"]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBe(true);
    await expect(page.locator("[data-collection-pill]")).toHaveCount(0);
  }
});

test("credential index uses a compact full-card registry grid", async ({ page }) => {
  for (const [width, columns] of [[360, 2], [1440, 3]] as const) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/credentials", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBe(true);
    await expectGridColumns(page, "card-grid", columns);

    const cards = page.locator("[data-credential-index-card]");
    if (await cards.count()) {
      const first = cards.first();
      await expect(first).toHaveAttribute("href", /^\/credentials\//);
      await expect(first.locator("h3")).toBeVisible();
      await expect(first.locator("time")).toBeVisible();
      await expect(first.getByRole("button")).toHaveCount(0);
      await first.focus();
      await expect(first).toBeFocused();
      await expect(first).toHaveCSS("outline-style", "solid");
    }

    await expectNoHorizontalOverflow(page);
  }
});

test("project index uses a compact full-card project grid", async ({ page }) => {
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/work", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBe(true);
    await expectGridColumns(page, "project-grid", 2);
    await expect(page.getByText("What clients can evaluate", { exact: true })).toHaveCount(0);

    const cards = page.locator("[data-project-index-card]");
    if (await cards.count()) {
      const first = cards.first();
      await expect(first).toHaveAttribute("href", /^\/work\//);
      await expect(first.locator("h3")).toBeVisible();
      await expect(first.locator("time")).toBeVisible();
      await expect(first.getByRole("button")).toHaveCount(0);
      await expect(first.getByText("View case study", { exact: true })).toHaveCount(0);
      await first.focus();
      await expect(first).toBeFocused();
      await expect(first).toHaveCSS("outline-style", "solid");
    }

    await expectNoHorizontalOverflow(page);
  }
});

test("secondary public pages start with a compact Back control", async ({ page }) => {
  const projectDetail = await firstPublishedDetailPath(page, "/work");
  const credentialDetail = await firstPublishedDetailPath(page, "/credentials");
  const detailRoutes = [projectDetail, credentialDetail].filter((path): path is string => Boolean(path));
  const routes = [...secondaryPublicRoutes, ...detailRoutes];

  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const back = page.getByRole("button", { name: "Back", exact: true });
      const layout = await back.evaluate((element) => {
        const next = element.nextElementSibling;
        const linkBounds = element.getBoundingClientRect();
        const nextBounds = next?.getBoundingClientRect();
        const textNode = [...element.childNodes].find(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        const range = textNode ? document.createRange() : null;
        if (range && textNode) range.selectNodeContents(textNode);
        const textBounds = range?.getBoundingClientRect();
        const availableTop = window.innerWidth < 1024 ? 64 : 0;
        return {
          height: linkBounds.height,
          topGap: textBounds ? textBounds.top - availableTop : null,
          nextGap: textBounds && nextBounds ? nextBounds.top - textBounds.bottom : null,
        };
      });
      expect(layout.height).toBeGreaterThanOrEqual(44);
      expect(layout.topGap).not.toBeNull();
      expect(layout.nextGap).not.toBeNull();
      expect(Math.abs((layout.topGap ?? 0) - (layout.nextGap ?? 0))).toBeLessThanOrEqual(2);
    }
  }

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

test("every public route preserves its desktop composition at phone width", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 360, height: 900 });

  const routeLayouts = [
    ["/work", [["project-grid", 2]]],
    ["/credentials", [["card-grid", 2]]],
    ["/about", [["about-hero", 2], ["fact-row", 4], ["content-pair", 2], ["toolkit-grid", 3]]],
    ["/contact", [["contact-hero", 2], ["form-grid", 2], ["service-grid", 3]]],
    ["/privacy", [["privacy-hero", 2], ["privacy-body", 2], ["indexed-copy", 2]]],
  ] as const;

  for (const [route, layouts] of routeLayouts) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBe(true);
    for (const [layout, columns] of layouts) {
      await expectGridColumns(page, layout, columns);
    }
    await expectMobileTypeScale(page);
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/credentials", { waitUntil: "domcontentloaded" });
  const credentialCards = page.locator('[data-phone-layout="card-grid"] > article');
  if (await credentialCards.count() >= 2) {
    const first = await credentialCards.nth(0).boundingBox();
    const second = await credentialCards.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first && second) expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
  }

  const projectDetail = await firstPublishedDetailPath(page, "/work");
  if (projectDetail) {
    await page.goto(projectDetail, { waitUntil: "domcontentloaded" });
    await expectGridColumns(page, "project-hero", 2);
    await expectGridColumns(page, "document-row", 2);
    const relatedGrid = page.locator('[data-phone-layout="card-grid"]');
    if (await relatedGrid.count()) await expectGridColumns(page, "card-grid", 2);
    await expectMobileTypeScale(page);
    await expectNoHorizontalOverflow(page);
  }

  const credentialDetail = await firstPublishedDetailPath(page, "/credentials");
  if (credentialDetail) {
    await page.goto(credentialDetail, { waitUntil: "domcontentloaded" });
    const facts = page.locator('[data-phone-layout^="facts-"]');
    const factLayout = await facts.getAttribute("data-phone-layout");
    await expectGridColumns(page, factLayout ?? "facts-three", factLayout === "facts-four" ? 4 : 3);
    await expectGridColumns(page, "credential-record", 2);
    await expectMobileTypeScale(page);
    await expectNoHorizontalOverflow(page);
  }

  const missingResponse = await page.goto("/responsive-layout-not-found", { waitUntil: "domcontentloaded" });
  expect(missingResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Back returns to the previous public page", async ({ page }) => {
  await page.goto("/");
  await page.locator('#main-content a[href="/work"]').first().click();
  await expect(page).toHaveURL(/\/work$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Back returns a project detail to the project list", async ({ page }) => {
  await page.goto("/");
  await page.locator('#main-content a[href="/work"]').first().click();
  await expect(page).toHaveURL(/\/work$/);
  const projectLink = page.locator('#main-content a[href^="/work/"]').first();
  test.skip(!(await projectLink.count()), "No published project is available");
  const projectPath = await projectLink.getAttribute("href");
  expect(projectPath).toMatch(/^\/work\//);
  await projectLink.click();
  await expect(page).toHaveURL(new RegExp(`${projectPath}$`));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
});

test("a published project detail is responsive and accessible", async ({ page }) => {
  const path = await firstPublishedDetailPath(page, "/work");
  test.skip(!path, "No published project is available");
  if (!path) return;

  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
  const relatedSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Related credentials", exact: true }),
  });
  if (await relatedSection.count()) {
    const relatedCard = relatedSection.locator("[data-credential-index-card]").first();
    await expect(relatedCard).toHaveAttribute("href", /^\/credentials\//);
    await expect(relatedCard.locator("time")).toBeVisible();
  }
  for (const width of approvedWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("a published credential detail is responsive, accessible, and keeps navigation state", async ({ page }) => {
  const path = await firstPublishedDetailPath(page, "/credentials");
  test.skip(!path, "No published credential is available");
  if (!path) return;

  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Back to credentials", exact: true })).toHaveCount(0);
  const verification = page.getByRole("link", { name: "Verify credential (opens in a new tab)", exact: true });
  if (await verification.count()) {
    await expect(verification).toHaveAttribute("target", "_blank");
  }
  for (const width of approvedWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (await verification.count()) {
      const rightGap = await verification.evaluate((element) => {
        const footer = element.closest("footer");
        return footer
          ? footer.getBoundingClientRect().right - element.getBoundingClientRect().right
          : Number.POSITIVE_INFINITY;
      });
      expect(Math.abs(rightGap)).toBeLessThanOrEqual(1);
    }
    await expectNoHorizontalOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  await expect(page.getByRole("link", { name: /02 Credentials/ })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const evidence = page.locator('section[aria-labelledby="credential-evidence-heading"]');
  const original = evidence.getByRole("link", { name: /Open original evidence/ });
  if (await original.count()) {
    const href = await original.getAttribute("href");
    if (/\.pdf(?:$|[?#])/i.test(href ?? "")) {
      const preview = evidence.locator('object[type="application/pdf"]');
      await expect(preview).toHaveCount(1);
      await expect(preview).toHaveAttribute("data", /#view=FitH/);
    } else if (/\.(?:avif|jpe?g|png|webp)(?:$|[?#])/i.test(href ?? "")) {
      await expect(evidence.locator("img")).toHaveCount(1);
    }
  }
  await expect(page.getByText("View evidence document", { exact: true })).toHaveCount(0);
});

test("reduced motion reveals project content without travel or fading", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const path = await firstPublishedDetailPath(page, "/work");
  test.skip(!path, "No published project is available");
  if (!path) return;

  await page.goto(path, { waitUntil: "domcontentloaded" });
  const reveals = page.locator("[data-reveal]");
  await expect(reveals.first()).toBeVisible();
  await expect(page.locator('[data-reveal-state="waiting"]')).toHaveCount(0);
  const finalStyle = await reveals.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, transform: style.transform };
  });
  expect(finalStyle).toEqual({ opacity: "1", transform: "none" });
});

test("unauthenticated admin access redirects to Google login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByText(/Continue with Google|Authentication not configured/),
  ).toBeVisible();
});

test("mobile navigation opens, closes with Escape, and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  const download = page.getByRole("link", { name: "Download CV" });
  await expect(download).toHaveAttribute(
    "href",
    "/resume.pdf",
  );
  await expect(download).toHaveAttribute(
    "download",
    "Artkin-Carreon-CV.pdf",
  );
  expect(await download.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("desktop CV action targets the current CV route", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("OPEN TO FREELANCE", { exact: true })).toHaveCount(0);
  const download = page.getByRole("link", { name: "Download CV" });
  await expect(download).toHaveAttribute(
    "href",
    "/resume.pdf",
  );
  await expect(download).toHaveAttribute(
    "download",
    "Artkin-Carreon-CV.pdf",
  );
  expect(await download.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test("public sans typography uses Roboto while technical labels stay monospace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Roboto/);
  await expect(page.locator(".mono-label").first()).toHaveCSS("font-family", /Geist Mono/);
});

test("other public pages replay the shared reveal system on re-entry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  const header = page.locator('[data-reveal="page-header"]');
  await expect(header).toHaveAttribute("data-reveal-state", "revealed");
  const finalSection = page.locator('[data-reveal="actions"]');
  await finalSection.scrollIntoViewIfNeeded();
  await expect(finalSection).toHaveAttribute("data-reveal-state", "revealed");
  await expect(header).toHaveAttribute("data-reveal-state", "waiting");
  await header.scrollIntoViewIfNeeded();
  await expect(header).toHaveAttribute("data-reveal-state", "revealed");
  await expect(finalSection).toHaveAttribute("data-reveal-state", "waiting");
  await finalSection.scrollIntoViewIfNeeded();
  await expect(finalSection).toHaveAttribute("data-reveal-state", "revealed");
});

test("every public page title uses the shared word-and-rule animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const route of publicRoutes) {
    await page.goto(route);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveAttribute("data-animated-heading", "true");
    await expect(heading.locator("[data-heading-word]").first()).toBeVisible();
    await expect(heading.locator("[data-heading-rule]")).toBeVisible();
  }
});

test("Home places the Approach section between credentials and project inquiry", async ({ page }) => {
  await page.goto("/");
  const order = await page.evaluate(() => {
    const credentials = document.querySelector("#credentials");
    const approach = document.querySelector('[data-reveal="approach"]');
    const inquiry = document.querySelector("#contact");
    if (!credentials || !approach || !inquiry) return null;
    return {
      credentialsBeforeApproach: Boolean(credentials.compareDocumentPosition(approach) & Node.DOCUMENT_POSITION_FOLLOWING),
      approachBeforeInquiry: Boolean(approach.compareDocumentPosition(inquiry) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(order).toEqual({ credentialsBeforeApproach: true, approachBeforeInquiry: true });
  await expect(page.getByRole("heading", { name: "03 — Approach" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View more details" })).toHaveAttribute("href", "/about");
});

test("Home replays on re-entry without hiding focused content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "AI Automation & GoHighLevel Specialist" });
  await expect(hero).toHaveCSS("margin-top", "0px");

  const card = page.locator("#projects article[data-reveal]").first();
  if (await card.count()) {
    await card.getByRole("link").focus();
    await expect(card).toHaveAttribute("data-reveal-state", "revealed");
    await expect(card).toHaveCSS("opacity", "1");
  }

  const credentials = page.locator('#credentials [data-reveal="rule"]');
  await credentials.scrollIntoViewIfNeeded();
  await expect(credentials).toHaveAttribute("data-reveal-state", "revealed");
  await expect(hero).toHaveAttribute("data-reveal-state", "waiting");
  if (await card.count()) {
    await expect(card).toHaveAttribute("data-reveal-state", "revealed");
  }
  await hero.scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute("data-reveal-state", "revealed");
  await expect(credentials).toHaveAttribute("data-reveal-state", "waiting");
  await credentials.scrollIntoViewIfNeeded();
  await expect(credentials).toHaveAttribute("data-reveal-state", "revealed");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await hero.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-reveal-state="waiting"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Start a project", exact: true })).toHaveCount(1);
});

test("Home reduced motion keeps content visible without entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-reveal]").first()).toHaveAttribute("data-reveal-state", "revealed");
  await expect(page.locator('[data-reveal-state="waiting"]')).toHaveCount(0);
  const hero = page.getByRole("region", { name: "AI Automation & GoHighLevel Specialist" });
  expect(await hero.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(hero.getByRole("heading")).toBeVisible();
});

test("Home motion finishes and the action fill preserves its accessible label", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "AI Automation & GoHighLevel Specialist" });
  await expect.poll(() => hero.evaluate((element) =>
    element.getAnimations({ subtree: true }).every((animation) => animation.playState === "finished"),
  )).toBe(true);

  const action = page.getByRole("link", { name: "Start a project", exact: true });
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action.locator('span[aria-hidden="true"]')).toHaveCSS("clip-path", "inset(0px)");
  await expect(action).toHaveAccessibleName("Start a project");
  await expect(action).toHaveAttribute("href", "/contact");
});

test("Home project cards are single full-card links with matching focus feedback", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const card = page.locator("#projects article").first();
  test.skip(!(await card.count()), "No published project is available");
  const title = card.getByRole("heading");
  const action = card.getByRole("link");
  await expect(action).toHaveCount(1);
  await expect(action).toHaveAttribute("data-project-index-card", "true");
  await expect(action).toHaveAccessibleName(await title.innerText());
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByText("View case study", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Published case study", { exact: true })).toHaveCount(0);
  await expect(action.locator("time")).toBeVisible();
  const restingSurface = await action.evaluate((element) => getComputedStyle(element).backgroundColor);
  await card.hover();
  await expect(title).toHaveCSS("text-decoration-color", "rgb(26, 28, 27)");
  await expect.poll(() => action.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingSurface);
  await page.mouse.move(0, 0);
  await expect(title).toHaveCSS("text-decoration-color", "rgba(0, 0, 0, 0)");
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action).toHaveCSS("outline-style", "solid");
  await expect(title).toHaveCSS("text-decoration-color", "rgb(26, 28, 27)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(action).toHaveCSS("background-color", "rgb(244, 243, 241)");
  for (const width of approvedWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    const cardBox = await card.boundingBox();
    const linkBox = await action.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    if (cardBox && linkBox) {
      expect(linkBox.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(cardBox.width - linkBox.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(cardBox.height - linkBox.height)).toBeLessThanOrEqual(2);
    }
  }
  const href = await action.getAttribute("href");
  expect(href).toMatch(/^\/work\//);
  await action.focus();
  await action.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("Home credential cards are single full-card registry links with direct feedback", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const card = page.locator("#credentials article").first();
  test.skip(!(await card.count()), "No published credential is available");
  const title = card.getByRole("heading");
  const action = card.getByRole("link");
  await card.scrollIntoViewIfNeeded();
  await expect(action).toHaveCount(1);
  await expect(action).toHaveAttribute("data-credential-index-card", "true");
  await expect(action).toHaveAccessibleName(await title.innerText());
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByText("View credential", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Public record", { exact: true })).toHaveCount(0);
  await expect(card.getByText(/CREDENTIAL_\d+/)).toHaveCount(0);
  await expect(action.locator("time")).toBeVisible();
  const restingSurface = await action.evaluate((element) => getComputedStyle(element).backgroundColor);
  await card.hover();
  await expect(title).toHaveCSS("text-decoration-color", "rgb(26, 28, 27)");
  await expect.poll(() => action.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingSurface);
  await page.mouse.move(0, 0);
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action).toHaveCSS("outline-style", "solid");
  await expect(title).toHaveCSS("text-decoration-color", "rgb(26, 28, 27)");
  await expect.poll(() => action.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingSurface);
  for (const width of approvedWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    const cardBox = await card.boundingBox();
    const linkBox = await action.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    if (cardBox && linkBox) {
      expect(linkBox.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(cardBox.width - linkBox.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(cardBox.height - linkBox.height)).toBeLessThanOrEqual(2);
    }
  }
  await expect(action).toHaveAttribute("href", /^\/credentials\//);
});

test("Home headline and portrait motion stay aligned at every approved width", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "AI Automation & GoHighLevel Specialist" });
  for (const width of approvedWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    await expect(hero.getByRole("heading")).toHaveText("AI Automation & GoHighLevel Specialist");
    const portrait = await hero.getByRole("img").boundingBox();
    const circuit = await hero.locator('svg[viewBox="0 0 1024 1024"]').boundingBox();
    expect(portrait).not.toBeNull();
    expect(circuit).not.toBeNull();
    if (portrait && circuit) {
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(portrait[dimension] - circuit[dimension])).toBeLessThan(1);
      }
    }
  }
});

test.describe("Home without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("content remains available", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('[data-reveal-state="waiting"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start a project", exact: true })).toBeVisible();
  });
});
