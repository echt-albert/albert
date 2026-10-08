// ============================================================
// ALBERT – QUANTUM V1.1
// Wirtschaftlichkeit und Kalkulation
// ============================================================

const QUANTUM = {

  name: "QUANTUM",

  description:
    "Berechnet Einkaufspreise, Margen, Marketingkosten, MAX-EK, Kapitalbedarf und wirtschaftliche Risiken.",

  async execute(input = {}) {

    console.log("[QUANTUM] Starte Wirtschaftlichkeitsrechnung");

    const product = input.product || {};

    const round = value =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    const positiveNumber = value =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
        ? value
        : null;

    const purchasePrice =
      positiveNumber(product.purchase_price);

    const quantity =
      Number.isSafeInteger(product.quantity) &&
      product.quantity > 0
        ? product.quantity
        : null;

    // Marktpreis stammt aus ORACLE.
    // Noch nicht unabhängig verifiziert.

    const sellingPrice =
      positiveNumber(input.oracle_provisional_vk);

    // Albert-Standard: 20 % Marketingbudget

    const marketingRate = 0.20;

    const marketingCost =
      sellingPrice !== null
        ? round(sellingPrice * marketingRate)
        : null;

    // Standard-CPC: 1,00 EUR

    const assumedCpc = 1.00;

    const possibleClicks =
      marketingCost !== null
        ? round(marketingCost / assumedCpc)
        : null;

    const requiredCvr =
      possibleClicks !== null && possibleClicks > 0
        ? round((1 / possibleClicks) * 100)
        : null;

    // Einkaufskapital:
    // Nur berechnen, wenn EK und Menge bekannt sind.

    const purchaseCapital =
      purchasePrice !== null && quantity !== null
        ? round(purchasePrice * quantity)
        : null;

    // Vorläufiger Deckungsbeitrag vor Versand,
    // Zahlungsgebühren, Retouren und weiteren Kosten.

    const contributionBeforeOtherCosts =
      sellingPrice !== null && purchasePrice !== null
        ? round(
            sellingPrice -
            purchasePrice -
            marketingCost
          )
        : null;

    // Vorläufige EK-Obergrenze:
    // Noch KEIN belastbarer MAX-EK, weil
    // wesentliche Kostenpositionen fehlen.

    const provisionalEkCeiling =
      sellingPrice !== null
        ? round(sellingPrice - marketingCost)
        : null;

    const missingInputs = [];

    if (purchasePrice === null) {
      missingInputs.push("purchase_price");
    }

    if (quantity === null) {
      missingInputs.push("quantity");
    }

    if (sellingPrice === null) {
      missingInputs.push("selling_price");
    }

    missingInputs.push(
      "verified_market_price",
      "shipping_cost",
      "payment_fees",
      "returns_allowance",
      "other_fulfillment_costs",
      "tax_basis"
    );

    const result = {

      quantum_status:
        purchasePrice !== null && sellingPrice !== null
          ? "PRELIMINARY_CALCULATION"
          : "INSUFFICIENT_DATA",

      quantum_verified: false,

      quantum_purchase_price: purchasePrice,

      quantum_quantity: quantity,

      quantum_provisional_vk: sellingPrice,

      quantum_marketing_rate: marketingRate,

      quantum_marketing_cost: marketingCost,

      quantum_assumed_cpc: assumedCpc,

      quantum_possible_clicks: possibleClicks,

      quantum_required_cvr_percent: requiredCvr,

      quantum_purchase_capital: purchaseCapital,

      quantum_contribution_before_other_costs:
        contributionBeforeOtherCosts,

      quantum_provisional_ek_ceiling:
        provisionalEkCeiling,

      // Kein echter MAX-EK ohne Vollkostenrechnung.
      quantum_max_ek: null,

      quantum_missing_inputs: missingInputs,

      quantum_message:
        "Vorläufige Kalkulation. Keine Kaufentscheidung ohne verifizierten Marktpreis und vollständige Kosten."
    };

    console.log(
      "[QUANTUM] Kalkulation abgeschlossen:",
      result.quantum_status
    );

    return result;
  }
};

module.exports = QUANTUM;
