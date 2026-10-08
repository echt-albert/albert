// ============================================================
// ALBERT – 5 BRAINS INTEGRATION TEST
// ============================================================

const Albert = require("./albert");

async function main() {

  console.log("\n====================================");
  console.log("ALBERT INTELLIGENCE NETWORK");
  console.log("5 BRAINS INTEGRATION TEST");
  console.log("====================================\n");

  // Prüfen, ob alle fünf Brains ausführbar sind.

  const status = Albert.getStatus();

  console.log("SYSTEMSTATUS:");
  console.log(JSON.stringify(status, null, 2));

  if (status.status !== "READY") {
    throw new Error(
      "Nicht alle fünf Brains sind ausführbar."
    );
  }

  // Kontrollierter Testdatensatz.
  // Keine echten Marktpreise oder Kaufempfehlungen.

  const testProduct = {
    product_name: "Albert Testprodukt",
    brand: "Testmarke",
    ean_gtin: null,
    mpn: "TEST-001",
    purchase_price: 10,
    quantity: 100,
    market_prices: [25, 28, 30],
    offer_url: null
  };

  let input = {
    product: testProduct
  };

  const results = {};

  // RADAR wird hier nicht aufgerufen:
  // Der Live-Aufruf würde eine neue Recherche auslösen.
  // Wir testen seine Schnittstelle separat.

  console.log("\nRADAR: Live-Aufruf bewusst übersprungen");

  const divisionNames = [
    "CIPHER",
    "ORACLE",
    "QUANTUM",
    "VERDICT"
  ];

  for (const name of divisionNames) {

    console.log(`\n--- ${name} ---`);

    const result = await Albert.executeDivision(
      name,
      input
    );

    results[name] = result;

    input = {
      ...input,
      ...result
    };

    console.log(JSON.stringify(result, null, 2));
  }

  if (
    !results.CIPHER ||
    !results.ORACLE ||
    !results.QUANTUM ||
    !results.VERDICT
  ) {
    throw new Error("Mindestens ein Brain fehlt.");
  }

  console.log("\n====================================");
  console.log("TEST ERFOLGREICH");
  console.log("4 ANALYSE-BRAINS AUSGEFÜHRT");
  console.log("RADAR LIVE-SCHNITTSTELLE VORHANDEN");
  console.log("====================================\n");
}

main().catch(error => {
  console.error("TEST FEHLGESCHLAGEN:", error);
  process.exitCode = 1;
});
