// ============================================================
// ALBERT – ORACLE V1.1
// Deutscher B2C-Markt, Preise und Nachfrage
// ============================================================

const ORACLE = {

  name: "ORACLE",

  description:
    "Analysiert Marktpreise, Nachfrage, Wettbewerb und Absatzchancen im deutschen B2C-Markt.",

  async execute(input = {}) {

    console.log("[ORACLE] Starte Marktanalyse");

    const product = input.product || null;

    if (!product || typeof product !== "object") {
      return {
        oracle_status: "NO_PRODUCT",
        oracle_verified: false,
        oracle_message: "Keine Produktdaten vorhanden."
      };
    }

    // Bereits recherchierte Marktpreise übernehmen
    const rawPrices = Array.isArray(product.market_prices)
      ? product.market_prices
      : [];

    // Nur plausible positive Zahlen berücksichtigen
    const marketPrices = rawPrices
      .filter(value =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
      )
      .sort((a, b) => a - b);

    const lowestPrice =
      marketPrices.length > 0
        ? marketPrices[0]
        : null;

    const highestPrice =
      marketPrices.length > 0
        ? marketPrices[marketPrices.length - 1]
        : null;

    const averagePrice =
      marketPrices.length > 0
        ? marketPrices.reduce((sum, price) => sum + price, 0) /
          marketPrices.length
        : null;

    // Alberts konservative VK-Regel:
    // Günstigster belastbarer Gesamtpreis minus 20 %
    //
    // Da die Quellen und Versandkosten hier noch nicht
    // verifiziert werden, ist der Wert nur vorläufig.

    const provisionalSellingPrice =
      lowestPrice !== null
        ? Math.round(lowestPrice * 0.8 * 100) / 100
        : null;

    const result = {

      oracle_status:
        marketPrices.length > 0
          ? "MARKET_DATA_AVAILABLE"
          : "MARKET_DATA_MISSING",

      oracle_verified: false,

      oracle_product_name:
        product.product_name || null,

      oracle_market_prices: marketPrices,

      oracle_price_count: marketPrices.length,

      oracle_lowest_price: lowestPrice,

      oracle_highest_price: highestPrice,

      oracle_average_price:
        averagePrice !== null
          ? Math.round(averagePrice * 100) / 100
          : null,

      oracle_provisional_vk: provisionalSellingPrice,

      oracle_shipping_included: null,

      oracle_demand_verified: false,

      oracle_competition_verified: false,

      oracle_message:
        marketPrices.length > 0
          ? "Vorhandene Marktpreise ausgewertet. Quellen, Versand und Nachfrage noch nicht verifiziert."
          : "Keine auswertbaren Marktpreise vorhanden."
    };

    console.log(
      "[ORACLE] Marktanalyse abgeschlossen:",
      result.oracle_status
    );

    return result;
  }
};

module.exports = ORACLE;
