// Run with: node --test tests/brain-pipeline.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const Albert = require("../core/albert");
const RADAR = require("../divisions/radar");

test("five brains run in order and transfer data (offline)", async () => {
  const original = RADAR.execute;
  RADAR.execute = async () => ({
    radar_status: "TEST_FIXTURE",
    radar_verified: false,
    product: {
      product_name: "Testartikel",
      brand: "Testmarke",
      ean_gtin: "4006381333931",
      mpn: "TEST-123",
      purchase_price: 5,
      quantity: 100,
      market_prices: [20, 22, 25]
    }
  });
  try {
    const result = await Albert.run({ query: "offline test" });
    assert.equal(result.success, true);
    assert.deepEqual(result.executionLog.map(x => x.division),
      ["RADAR", "CIPHER", "ORACLE", "QUANTUM", "VERDICT"]);
    assert.equal(result.results.CIPHER.cipher_gtin_valid, true);
    assert.equal(result.results.ORACLE.oracle_provisional_vk, 16);
    assert.equal(result.results.QUANTUM.quantum_marketing_cost, 3.2);
    assert.equal(result.results.VERDICT.verdict_grade, "B");
    assert.equal(result.results.VERDICT.verdict_purchase_approved, false);
  } finally {
    RADAR.execute = original;
  }
});

test("failed brain stops pipeline", async () => {
  const original = RADAR.execute;
  RADAR.execute = async () => { throw new Error("simulated failure"); };
  try {
    const result = await Albert.run({});
    assert.equal(result.success, false);
    assert.equal(result.failedDivision, "RADAR");
    assert.equal(result.executionLog.length, 1);
  } finally {
    RADAR.execute = original;
  }
});
