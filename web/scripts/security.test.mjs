import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, env = {}, mocks = {}, fetcher = () => { throw new Error("Unexpected network request"); }) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, process: { env }, Buffer, Request, Response, URL, URLSearchParams, AbortSignal,
    fetch: fetcher,
    require: (name) => name === "server-only" ? {} : mocks[name] ?? require(name),
  });
  return exports;
}
const origin = "https://portfolio.example";
const env = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: origin, TURNSTILE_SECRET_KEY: "real-test-secret" };
const security = () => load("../src/lib/request-security.ts");
const request = (body, headers = {}) => new Request(`${origin}/api/booking`, {
  method: "POST", body: JSON.stringify(body),
  headers: { origin, "content-type": "application/json", ...headers },
});
const slot = new Date(Date.now() + 2 * 86400_000).toISOString();
const valid = { firstName: "Test", lastName: "Person", email: "test@example.invalid", phone: "+639000000000",
  company: "", project: "A test project description for this audit.", startTime: slot, consent: true, turnstileToken: "valid-token" };

test("bounded JSON rejects null, arrays, wrong media type and oversized bodies without Content-Length", async () => {
  const s = security();
  for (const body of [null, [], "string", 1]) await assert.rejects(s.readJsonObject(request(body), 100), { status: 400 });
  await assert.rejects(s.readJsonObject(request({}, { "content-type": "text/plain" }), 100), { status: 415 });
  await assert.rejects(s.readJsonObject(request({ text: "x".repeat(200) }), 100), { status: 413 });
  await assert.rejects(s.readJsonObject(request({ text: "é".repeat(60) }), 100), { status: 413 });
  assert.equal((await s.readJsonObject(request({ ok: true }), 100)).ok, true);
});

test("burst limiter rejects repeated requests and cross-origin requests fail", () => {
  const s = security();
  assert.equal(s.isSameOrigin(request({})), true);
  assert.equal(s.isSameOrigin(request({}, { origin: "https://attacker.invalid" })), false);
  assert.equal(s.isSameOrigin(request({}, { "sec-fetch-site": "cross-site" })), false);
  assert.equal(s.isSameOrigin(new Request('http://localhost:3101/api/booking', {
    headers: { host: '127.0.0.1:3101', origin: 'http://127.0.0.1:3101' },
  })), true);
  assert.equal(s.allowRequest(request({}), "test", 2), true);
  assert.equal(s.allowRequest(request({}), "test", 2), true);
  assert.equal(s.allowRequest(request({}), "test", 2), false);
});

function booking(verification, overrides = {}) {
  const calls = [];
  const ghl = {
    GhlApiError: class extends Error {},
    getFreeSlots: async () => { calls.push("slots"); return { date: [slot] }; },
    getOrCreateContact: async () => { calls.push("contact"); return "contact-id"; },
    createAppointment: async () => { calls.push("appointment"); return "appointment-id"; },
    ...overrides,
  };
  const route = load("../src/app/api/booking/route.ts", { ...env }, {
    "@/lib/request-security": security(), "@/lib/ghl": ghl,
  }, async () => { calls.push("verify"); if (verification instanceof Error) throw verification; return Response.json(verification); });
  return { route, calls };
}

test("booking rejects invalid payloads before external calls", async () => {
  for (const body of [null, [], {}, { ...valid, consent: false }, { ...valid, turnstileToken: "x".repeat(2049) },
    { ...valid, firstName: "<script>" }, { ...valid, startTime: "2099-01-01T09:00:00+08:00" }]) {
    const { route, calls } = booking({ success: true });
    assert.equal((await route.POST(request(body))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test("production Turnstile requires success, exact action and hostname and handles outages", async () => {
  for (const verification of [{ success: false }, { success: true },
    { success: true, action: "wrong", hostname: "portfolio.example" },
    { success: true, action: "portfolio_booking", hostname: "attacker.invalid" }, new Error("timeout")]) {
    const { route, calls } = booking(verification);
    assert.equal((await route.POST(request(valid))).status, 400);
    assert.equal(calls.join(), "verify");
  }
});

test("booking checks availability before touching CRM and books only a valid slot", async () => {
  const verified = { success: true, action: "portfolio_booking", hostname: "portfolio.example" };
  const unavailable = booking(verified, { getFreeSlots: async () => ({}) });
  assert.equal((await unavailable.route.POST(request(valid))).status, 409);
  assert.equal(unavailable.calls.join(), "verify");
  const available = booking(verified);
  assert.equal((await available.route.POST(request(valid))).status, 201);
  assert.equal(available.calls.join(), "verify,slots,contact,appointment");
});

test("existing GHL contacts are reused without edits; new contacts are created, never upserted", async () => {
  for (const exists of [true, false]) {
    const calls = [];
    const ghl = load("../src/lib/ghl.ts", {
      GHL_PRIVATE_INTEGRATION_TOKEN: "dummy", GHL_LOCATION_ID: "location", GHL_CALENDAR_ID: "calendar",
    }, {}, async (url, init) => {
      calls.push({ url, init });
      return Response.json(url.includes("search/duplicate")
        ? { contact: exists ? { id: "existing", email: valid.email, locationId: "location" } : undefined }
        : { contact: { id: "created" } });
    });
    assert.equal(await ghl.getOrCreateContact(valid), exists ? "existing" : "created");
    assert.equal(calls.length, exists ? 1 : 2);
    assert.equal(calls.some(({ url }) => url.includes("upsert")), false);
    if (!exists) assert.equal(calls[1].init.method, "POST");
  }
});

test("telemetry rejects invalid and oversized JSON before sending logs", async () => {
  const route = load("../src/app/api/client-errors/route.ts", {}, {
    "@/lib/request-security": security(),
    "@/lib/telemetry": { sendTelemetryError: () => { throw new Error("Should not send logs"); } },
  });
  assert.equal((await route.POST(request(null))).status, 400);
  assert.equal((await route.POST(request({ name: "x".repeat(2000) }))).status, 413);
});
