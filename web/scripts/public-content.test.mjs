import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("public queries bypass persistent empty caches and preserve request headers", async () => {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/lib/public-content.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  );
  const exports = {};
  let options;
  let request;
  runInNewContext(outputText, {
    exports,
    fetch: async (input, init) => { request = { input, init }; },
    require: (name) => {
      if (name === "next/server") return { connection: async () => {} };
      if (name === "@/lib/env") return { getSupabasePublicConfig: () => ({ url: "https://example.test", publishableKey: "public" }) };
      if (name === "@supabase/supabase-js") return {
        createClient: (_url, _key, config) => {
          options = config;
          return { from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }) };
        },
      };
      return {};
    },
  });
  await exports.getPublishedCredentials();
  const headers = { Authorization: "Bearer public-test" };
  await options.global.fetch("https://example.test/records", { headers, cache: "force-cache" });
  assert.equal(request.init.cache, "no-store");
  assert.equal(request.init.headers, headers);
  assert.equal(request.input, "https://example.test/records");
});
