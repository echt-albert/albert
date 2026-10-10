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
