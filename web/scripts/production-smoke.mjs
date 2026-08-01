import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const MAX_URLS = 100;
const CONCURRENCY = 5;
const TIMEOUT_MS = 15_000;
const MAX_FAILURE_DETAILS = 50;
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

function cleanMessage(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 500);
}

function addFailure(result, detail) {
  result.brokenCount += 1;
  if (result.failures.length < MAX_FAILURE_DETAILS) {
    result.failures.push({
      url: detail.url,
      source: detail.source,
      ...(Number.isInteger(detail.status) ? { status: detail.status } : {}),
      ...(detail.error ? { error: cleanMessage(detail.error) } : {}),
    });
  }
}

function sameOriginUrl(rawValue, sourceUrl, origin) {
  const raw = rawValue.trim().replaceAll("&amp;", "&");
  if (!raw || raw.startsWith("#") || /^(?:mailto|tel):/i.test(raw)) return null;

  try {
    const url = new URL(raw, sourceUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      return null;
    }
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

function pageError(text) {
  if (/Application error: a client-side exception has occurred/i.test(text)) {
    return "Application error page returned HTTP 200";
  }

  const title = text.match(/<title[^>]*>\s*([^<]{1,200})<\/title>/i)?.[1];
  if (title && /^(?:Internal Server Error|5\d\d\b)/i.test(title.trim())) {
    return `Error page returned HTTP 200: ${title.trim()}`;
  }

  return null;
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
  const result = { pagesChecked: 0, brokenCount: 0, failures: [] };

  const enqueue = (rawUrl, sourceUrl = baseUrl) => {
    const url = sameOriginUrl(rawUrl, sourceUrl, origin);
    if (!url || queued.has(url) || queued.size >= MAX_URLS) return;
    queued.add(url);
    queue.push({ url, source: sourceUrl.href ?? String(sourceUrl) });
  };

  for (const path of SEED_PATHS) enqueue(path);

  const check = async ({ url, source }) => {
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
        addFailure(result, {
          url,
          source,
          status,
          error: `HTTP ${status}`,
        });
        await response.body?.cancel();
        return;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/css")) {
        await response.body?.cancel();
        return;
      }

      const text = await response.text();
      const error = contentType.includes("text/html") ? pageError(text) : null;
      if (error) {
        addFailure(result, { url, source: url, status, error });
      }

      for (const candidate of extractUrls(text, contentType)) enqueue(candidate, url);
    } catch (error) {
      addFailure(result, {
        url,
        source,
        error:
          error?.name === "TimeoutError"
            ? "Request timed out after 15 seconds"
            : error?.message ?? error,
      });
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
    const context = await browser.newContext({
      extraHTTPHeaders: requestHeaders(bypassSecret),
    });
    for (const path of BROWSER_PATHS) {
      const page = await context.newPage();
      const url = new URL(path, baseUrl).href;
      page.on("pageerror", (failure) => {
        addFailure(result, { url, source: "pageerror", error: failure.message });
      });
      page.on("console", (entry) => {
        if (entry.type() === "error") {
          addFailure(result, { url, source: "console", error: entry.text() });
        }
      });
      try {
        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: TIMEOUT_MS,
        });
        if (!response || !response.ok()) {
          addFailure(result, {
            url,
            source: "browser",
            status: response?.status(),
            error: response ? `HTTP ${response.status()}` : "Navigation returned no response",
          });
        }
      } catch (error) {
        addFailure(result, {
          url,
          source: "browser",
          error: error?.message ?? error,
        });
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
    const detail = cleanMessage(await response.text());
    throw new Error(
      `Report ingestion returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  await response.body?.cancel();
}

function selfTest() {
  const source = new URL("https://example.com/start");
  assert.equal(
    sameOriginUrl("/work#details", source, source.origin),
    "https://example.com/work",
  );
  assert.equal(sameOriginUrl("mailto:test@example.com", source, source.origin), null);
  assert.equal(sameOriginUrl("https://outside.example/work", source, source.origin), null);

  const result = { pagesChecked: 0, brokenCount: 0, failures: [] };
  for (let index = 0; index < 51; index += 1) {
    addFailure(result, {
      url: `https://example.com/${index}`,
      source: "https://example.com/",
      status: 404,
    });
  }
  assert.equal(result.brokenCount, 51);
  assert.equal(result.failures.length, 50);

  assert.deepEqual(
    extractUrls('<a href="/work"><img srcset="/a.png 1x, /b.png 2x">', "text/html"),
    ["/work", "/a.png", "/b.png"],
  );
  console.log("production-smoke self-test passed");
}

async function main() {
  const deploymentUrl = requiredEnv("BASE_URL");
  const baseUrl = new URL(deploymentUrl);
  if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error("BASE_URL must be an HTTP(S) URL without credentials");
  }

  const secret = requiredEnv("DEPLOY_CHECK_SECRET");
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const endpoint = new URL("/api/internal/deployment-checks", baseUrl);
  const common = {
    version: 1,
    deploymentId: requiredEnv("DEPLOYMENT_ID"),
    projectId: requiredEnv("PROJECT_ID"),
    deploymentUrl,
    gitSha: requiredEnv("GIT_SHA"),
    runId: requiredEnv("RUN_ID"),
    runNumber: Number(requiredEnv("RUN_NUMBER")),
    runUrl: requiredEnv("RUN_URL"),
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
    failures: [],
  };

  try {
    await postReport(endpoint, secret, bypassSecret, running);
  } catch (error) {
    console.warn(`Running report failed: ${cleanMessage(error?.message ?? error)}`);
  }

  let result;
  try {
    result = await crawl(baseUrl, bypassSecret);
  } catch (error) {
    result = { pagesChecked: 0, brokenCount: 0, failures: [] };
    addFailure(result, {
      url: deploymentUrl,
      source: deploymentUrl,
      error: error?.message ?? error,
    });
  }
  try {
    await checkBrowser(baseUrl, bypassSecret, result);
  } catch (error) {
    addFailure(result, {
      url: deploymentUrl,
      source: "browser",
      error: error?.message ?? error,
    });
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
  } catch (error) {
    ingestionFailed = true;
    console.error(`Final report failed: ${cleanMessage(error?.message ?? error)}`);
  }

  const summary = `${result.pagesChecked} URLs checked, ${result.brokenCount} failures`;
  console[result.brokenCount === 0 ? "log" : "error"](`Production smoke: ${summary}`);
  if (result.brokenCount > 0 || ingestionFailed) process.exitCode = 1;
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  await main().catch((error) => {
    console.error(cleanMessage(error?.stack ?? error));
    process.exitCode = 1;
  });
}
