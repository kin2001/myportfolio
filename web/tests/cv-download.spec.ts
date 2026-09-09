import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`CV button downloads the complete current PDF at ${width}px`, async ({ page, request }) => {
    test.setTimeout(90_000);
    const response = await request.get("/resume.pdf");
    test.skip(response.status() === 404, "No current CV is selected");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    const expectedPdf = await response.body();
    expect(expectedPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(expectedPdf.length).toBe(Number(response.headers()["content-length"]));

    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for the shared client effects before opening the React drawer.
    await expect(page.locator('[data-reveal-state="revealed"]').first()).toBeVisible();
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    }
    await expect(page.getByRole("link", { name: "Download CV", exact: true })).toBeVisible();
    const pending = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("link", { name: "Download CV", exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("Artkin-Carreon-CV.pdf");
    expect(await download.failure()).toBeNull();
    const stream = await download.createReadStream();
    const hash = createHash("sha256");
    let receivedBytes = 0;
    for await (const chunk of stream) {
      receivedBytes += chunk.length;
      hash.update(chunk);
    }
    expect(receivedBytes).toBe(expectedPdf.length);
    expect(hash.digest("hex")).toBe(createHash("sha256").update(expectedPdf).digest("hex"));
  });
}
