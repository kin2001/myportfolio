import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const MAX_URLS = 100;
const CONCURRENCY = 5;
const TIMEOUT_MS = 15_000;
const MAX_FAILURES = 100;
const SEED_PATHS = [
  "/",
  "/work",
  "/credentials",
  "/about",
  "/contact",
  "/privacy",
  "/resume.pdf",
  "/api/health",
  "/robots.txt",
  "/sitemap.xml",
];
const BROWSER_PATHS = ["/", "/work", "/credentials", "/about", "/contact"];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function addFailure(result, category) {
  if (result.brokenCount >= MAX_FAILURES) return;
  result.brokenCount += 1;
  result.failureCounts[category] = (result.failureCounts[category] ?? 0) + 1;
}

function sameOriginUrl(rawValue, sourceUrl, origin) {
  const raw = rawValue.trim().replaceAll("&amp;", "&");
  if (!raw || raw.startsWith("#") || /^(?:mailto|tel):/i.test(raw)) return null;

  try {
    const url = new URL(raw, sourceUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function extractUrls(text, contentType) {
  const urls = [];

  if (contentType.includes("text/html")) {
    for (const match of text.matchAll(
      /\b(?:href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    )) {
      urls.push(match[1] ?? match[2] ?? match[3]);
    }

    for (const match of text.matchAll(
      /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    )) {
      const srcset = match[1] ?? match[2] ?? match[3];
      if (!/^\s*data:/i.test(srcset)) {
        urls.push(
          ...srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]),
        );
      }
    }
  }

  if (contentType.includes("text/html") || contentType.includes("text/css")) {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']+))\s*\)/gi)) {
      urls.push(match[1] ?? match[2] ?? match[3]);
    }
  }

  return urls;
}

function hasPageError(text) {
  if (/Application error: a client-side exception has occurred/i.test(text)) {
    return true;
  }

  const title = text.match(/<title[^>]*>\s*([^<]{1,200})<\/title>/i)?.[1];
  return Boolean(title && /^(?:Internal Server Error|5\d\d\b)/i.test(title.trim()));
}

function requestHeaders(bypassSecret) {
  return {
    accept: "text/html,application/xhtml+xml,text/css,*/*;q=0.8",
    "user-agent": "artkin-portfolio-production-smoke/1.0",
    ...(bypassSecret
      ? {
          "x-vercel-protection-bypass": bypassSecret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {}),
  };
}

async function crawl(baseUrl, bypassSecret) {
  const origin = baseUrl.origin;
  const queue = [];
  const queued = new Set();
  const result = { pagesChecked: 0, brokenCount: 0, failureCounts: {} };

  const enqueue = (rawUrl, sourceUrl = baseUrl) => {
    const url = sameOriginUrl(rawUrl, sourceUrl, origin);
    if (!url || queued.has(url) || queued.size >= MAX_URLS) return;
    queued.add(url);
    queue.push(url);
  };

  for (const path of SEED_PATHS) enqueue(path);

  const check = async (url) => {
    result.pagesChecked += 1;

    try {
      const response = await fetch(url, {
        headers: requestHeaders(bypassSecret),
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const status = response.status;

      if (status >= 300 && status < 400) {
        const location = response.headers.get("location");
        if (location) enqueue(location, url);
        await response.body?.cancel();
        return;
      }

      if (status < 200 || status >= 300) {
        addFailure(result, "http_error");
        await response.body?.cancel();
        return;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/css")) {
        await response.body?.cancel();
        return;
      }

      const text = await response.text();
      if (contentType.includes("text/html") && hasPageError(text)) {
        addFailure(result, "application_error");
      }

      for (const candidate of extractUrls(text, contentType)) enqueue(candidate, url);
    } catch (error) {
      addFailure(result, error?.name === "TimeoutError" ? "request_timeout" : "request_error");
    }
  };

  for (let cursor = 0; cursor < queue.length; cursor += CONCURRENCY) {
    await Promise.all(queue.slice(cursor, cursor + CONCURRENCY).map(check));
  }

  return result;
}

async function checkBrowser(baseUrl, bypassSecret, result) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    if (bypassSecret) {
      const response = await context.request.get(baseUrl.href, {
        headers: requestHeaders(bypassSecret),
        maxRedirects: 0,
        timeout: TIMEOUT_MS,
      });
      await response.dispose();
    }
    for (const path of BROWSER_PATHS) {
      const page = await context.newPage();
      const url = new URL(path, baseUrl).href;
      page.on("pageerror", () => {
        addFailure(result, "browser_page_error");
      });
      page.on("console", (entry) => {
        if (entry.type() === "error") {
          addFailure(result, "browser_console_error");
        }
      });
      try {
        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: TIMEOUT_MS,
        });
        if (!response || !response.ok()) {
          addFailure(result, "browser_navigation_error");
        }
      } catch {
        addFailure(result, "browser_navigation_error");
      } finally {
        await page.close();
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

function signature(secret, timestamp, body) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

async function postReport(endpoint, secret, bypassSecret, report) {
  const body = JSON.stringify(report);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...requestHeaders(bypassSecret),
      "content-type": "application/json",
      "x-deploy-check-timestamp": timestamp,
      "x-deploy-check-signature": `sha256=${signature(secret, timestamp, body)}`,
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Report ingestion returned HTTP ${response.status}`);
  }

  await response.body?.cancel();
}

function selfTest() {
  const source = new URL("https://example.com/start");
  assert.equal(
    sameOriginUrl("/work?email=private%40example.com#details", source, source.origin),
    "https://example.com/work",
  );
  assert.equal(sameOriginUrl("mailto:test@example.com", source, source.origin), null);
  assert.equal(sameOriginUrl("https://outside.example/work", source, source.origin), null);
  assert.equal(sameOriginUrl("https://user:secret@example.com/work", source, source.origin), null);

  const result = { pagesChecked: 0, brokenCount: 0, failureCounts: {} };
  for (let index = 0; index < 101; index += 1) {
    addFailure(result, index % 2 ? "http_error" : "browser_console_error");
  }
  assert.equal(result.brokenCount, 100);
  assert.deepEqual(result.failureCounts, {
    browser_console_error: 50,
    http_error: 50,
  });

  assert.deepEqual(
    extractUrls('<a href="/work"><img srcset="/a.png 1x, /b.png 2x">', "text/html"),
    ["/work", "/a.png", "/b.png"],
  );
  console.log("production-smoke self-test passed");
}

async function main() {
  const baseUrl = new URL(requiredEnv("BASE_URL"));
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("BASE_URL must be an HTTP(S) URL without credentials, query, or hash");
  }
  const runUrl = new URL(requiredEnv("RUN_URL"));
  if (
    runUrl.protocol !== "https:" ||
    runUrl.username ||
    runUrl.password ||
    runUrl.search ||
    runUrl.hash
  ) {
    throw new Error("RUN_URL must be an HTTPS URL without credentials, query, or hash");
  }

  const secret = requiredEnv("DEPLOY_CHECK_SECRET");
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const endpoint = new URL("/api/internal/deployment-checks", baseUrl);
  const common = {
    version: 1,
    deploymentId: requiredEnv("DEPLOYMENT_ID"),
    projectId: requiredEnv("PROJECT_ID"),
    deploymentUrl: baseUrl.href,
    gitSha: requiredEnv("GIT_SHA"),
    runId: requiredEnv("RUN_ID"),
    runNumber: Number(requiredEnv("RUN_NUMBER")),
    runUrl: runUrl.href,
  };
  if (!Number.isSafeInteger(common.runNumber) || common.runNumber < 1) {
    throw new Error("RUN_NUMBER must be a positive safe integer");
  }

  const running = {
    ...common,
    status: "running",
    checkedAt: new Date().toISOString(),
    pagesChecked: 0,
    brokenCount: 0,
    failureCounts: {},
  };

  try {
    await postReport(endpoint, secret, bypassSecret, running);
  } catch {
    console.warn("Initial smoke status could not be recorded; final ingestion will retry safely.");
  }

  let result;
  try {
    result = await crawl(baseUrl, bypassSecret);
  } catch {
    result = { pagesChecked: 0, brokenCount: 0, failureCounts: {} };
    addFailure(result, "request_error");
  }
  try {
    await checkBrowser(baseUrl, bypassSecret, result);
  } catch {
    addFailure(result, "browser_unavailable");
  }

  const final = {
    ...common,
    status: result.brokenCount === 0 ? "success" : "failure",
    checkedAt: new Date().toISOString(),
    ...result,
  };

  let ingestionFailed = false;
  try {
    await postReport(endpoint, secret, bypassSecret, final);
  } catch {
    ingestionFailed = true;
    console.error("Final smoke result could not be recorded.");
  }

  const summary = `${result.pagesChecked} URLs checked, ${result.brokenCount} failures`;
  console[result.brokenCount === 0 ? "log" : "error"](`Production smoke: ${summary}`);
  if (result.brokenCount > 0 || ingestionFailed) process.exitCode = 1;
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  await main().catch(() => {
    console.error("Production smoke could not run.");
    process.exitCode = 1;
  });
}
