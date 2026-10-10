"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { plan } = require("../divisions/radar/sofort-jagd/strategy");
const { classify } = require("../divisions/radar/sofort-jagd/filtering");
const { execute } = require("../divisions/radar/sofort-jagd");

test("bounded strategy with SOFORT origin", () => {
  const result = plan({ query: "X".repeat(900) });
  assert.equal(result.query.length, 600);
  assert.equal(result.origin, "SOFORT");
  assert.equal(result.maxResearchCalls, 1);
});
test("new result requires persisted database ID", () => {
  assert.equal(classify({ status: "new_saved", saved_deal: { product_name: "A" } }).status, "unverified");
  assert.equal(classify({ status: "new_saved", saved_deal: { id: 17 } }).count, 1);
});
test("duplicates and alternative offers are not new", () => {
  assert.equal(classify({ status: "duplicate_skipped" }).count, 0);
  assert.equal(classify({ status: "alternative_offer_saved" }).count, 0);
});
test("orchestrator uses one injected request and passes origin", async () => {
  let count = 0;
  const result = await execute({ query: "Test" }, {
    supabaseUrl: "https://example.org", supabaseKey: "test",
    fetch: async (_url, opts) => {
      count++;
      assert.equal(JSON.parse(opts.body).origin, "SOFORT");
      return { ok: true, json: async () => ({ success: true, status: "new_saved",
        saved_deal: { id: 1, product_name: "Test" } }) };
    }
  });
  assert.equal(count, 1);
  assert.equal(result.count, 1);
  assert.equal(result.observation.origin, "SOFORT");
});
test("missing credentials fail without a network request", async () => {
  await assert.rejects(() => execute({}, { supabaseUrl: "", supabaseKey: "" }));
});

test("multiple saved deals are counted individually", () => {
  const result = classify({ status: "new_saved", saved_deals: [
    { id: 11 }, { id: 12 }, { product_name: "without id" }
  ], stats: { candidates: 3, saved: 2 } });
  assert.equal(result.count, 2);
  assert.equal(result.deals.length, 2);
  assert.equal(result.stats.candidates, 3);
});
test("no new results are not confused with errors", () => {
  const result = classify({ status: "no_new_deals", saved_deals: [], stats: { duplicates: 6 } });
  assert.equal(result.count, 0);
  assert.equal(result.stats.duplicates, 6);
});
test("research request includes service bearer authorization", async () => {
  const { discover } = require("../divisions/radar/sofort-jagd/discovery");
  await discover({ query: "test" }, {
    supabaseUrl: "https://example.org", supabaseKey: "example-key",
    fetch: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer example-key");
      return { ok: true, json: async () => ({ success: true, status: "no_new_deals" }) };
    }
  });
});
