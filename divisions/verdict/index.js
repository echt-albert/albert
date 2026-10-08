// ============================================================
// ALBERT – VERDICT V1.1
// Bewertung und Einkaufsentscheidung
// ============================================================

const VERDICT = {

  name: "VERDICT",

  description:
    "Klassifiziert Warenposten nach A/B/C/X, bewertet Chancen und Risiken und formuliert begründete Einkaufsentscheidungen.",

  async execute(input = {}) {

    console.log("[VERDICT] Starte Einkaufsbewertung");

    const product = input.product || {};

    const productName =
      product.product_name || "Unbekanntes Produkt";

    const purchasePrice =
      input.quantum_purchase_price;

    const sellingPrice =
      input.quantum_provisional_vk;

    const contribution =
      input.quantum_contribution_before_other_costs;

    const identityComplete =
      input.cipher_identity_complete === true;

    const marketVerified =
      input.oracle_verified === true;

    const demandVerified =
      input.oracle_demand_verified === true;

    const economicsVerified =
      input.quantum_verified === true;

    const missingInputs = Array.isArray(
      input.quantum_missing_inputs
    )
      ? input.quantum_missing_inputs
      : [];

    const risks = [];
    const opportunities = [];

    // --------------------------------------------------------
    // CHANCEN
    // --------------------------------------------------------

    if (
      typeof contribution === "number" &&
      contribution > 0
    ) {
      opportunities.push(
        "Vorläufig positiver Deckungsbeitrag vor weiteren Kosten."
      );
    }

    if (identityComplete) {
      opportunities.push(
        "Produktidentität formal plausibel."
      );
    }

    // --------------------------------------------------------
    // RISIKEN
    // --------------------------------------------------------

    if (!identityComplete) {
      risks.push(
        "Produktidentität nicht ausreichend geklärt."
      );
    }

    if (!marketVerified) {
      risks.push(
        "Deutscher B2C-Marktpreis nicht unabhängig verifiziert."
      );
    }

    if (!demandVerified) {
      risks.push(
        "Nachfrage nicht nachgewiesen."
      );
    }

    if (!economicsVerified) {
      risks.push(
        "Vollständige Wirtschaftlichkeitsrechnung fehlt."
      );
    }

    if (
      typeof contribution === "number" &&
      contribution <= 0
    ) {
      risks.push(
        "Bereits vor weiteren Kosten kein positiver Deckungsbeitrag."
      );
    }

    // --------------------------------------------------------
    // A/B/C/X KLASSIFIZIERUNG
    // --------------------------------------------------------

    let grade = "B";
    let recommendation = "WEITER_PRUEFEN";

    // X nur bei ausdrücklich nachgewiesenen Ausschlussgründen.
    const exclusionConfirmed =
      input.compliance_exclusion_confirmed === true ||
      input.authenticity_exclusion_confirmed === true ||
      input.sales_restriction_confirmed === true;

    if (exclusionConfirmed) {

      grade = "X";
      recommendation = "NICHT_KAUFEN";

      risks.push(
        "Bestätigter Ausschlussgrund."
      );

    } else if (
      typeof contribution === "number" &&
      contribution <= 0
    ) {

      grade = "C";
      recommendation = "NICHT_KAUFEN";

    } else if (
      identityComplete &&
      marketVerified &&
      demandVerified &&
      economicsVerified &&
      typeof contribution === "number" &&
      contribution > 0
    ) {

      grade = "A";
      recommendation = "KAUFPRUEFUNG";

    }

    // --------------------------------------------------------
    // ERGEBNIS
    // --------------------------------------------------------

    const result = {

      verdict_status: "COMPLETED",

      verdict_product_name: productName,

      verdict_grade: grade,

      verdict_recommendation: recommendation,

      verdict_purchase_price:
        typeof purchasePrice === "number"
          ? purchasePrice
          : null,

      verdict_provisional_vk:
        typeof sellingPrice === "number"
          ? sellingPrice
          : null,

      verdict_provisional_contribution:
        typeof contribution === "number"
          ? contribution
          : null,

      verdict_opportunities: opportunities,

      verdict_risks: risks,

      verdict_missing_inputs: missingInputs,

      verdict_purchase_approved: false,

      verdict_message:
        grade === "A"
          ? "Kandidat für vertiefte Kaufprüfung."
          : grade === "B"
          ? "Interessanter oder noch nicht ausreichend geprüfter Posten."
          : grade === "C"
          ? "Wirtschaftlich derzeit nicht attraktiv."
          : "Ausschlussgrund festgestellt."
    };

    console.log(
      "[VERDICT] Bewertung abgeschlossen:",
      grade
    );

    return result;
  }
};

module.exports = VERDICT;
