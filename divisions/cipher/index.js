// ============================================================
// ALBERT – CIPHER V1.1
// Produktidentifikation und Datenvalidierung
// ============================================================

const CIPHER = {

  name: "CIPHER",

  description:
    "Identifiziert Produkte anhand von EAN, GTIN, MPN und Herstellerdaten.",

  async execute(input = {}) {

    console.log("[CIPHER] Starte Produktidentifikation");

    // Produktdaten aus RADAR oder der Pipeline übernehmen
    const product = input.product || input.saved_deal || null;

    if (!product || typeof product !== "object") {
      return {
        cipher_status: "NO_PRODUCT",
        cipher_verified: false,
        cipher_message: "Keine Produktdaten vorhanden."
      };
    }

    const productName =
      typeof product.product_name === "string"
        ? product.product_name.trim()
        : null;

    const brand =
      typeof product.brand === "string"
        ? product.brand.trim()
        : null;

    const ean =
      product.ean_gtin != null
        ? String(product.ean_gtin).replace(/\D/g, "")
        : null;

    const mpn =
      product.mpn != null
        ? String(product.mpn).trim()
        : null;

    // GTIN-Prüfziffer kontrollieren
    function validGTIN(value) {

      if (!value || !/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) {
        return false;
      }

      const digits = value.split("").map(Number);
      const checkDigit = digits.pop();

      let sum = 0;

      for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
        sum += digits[i] * weight;
      }

      return (10 - (sum % 10)) % 10 === checkDigit;
    }

    const gtinValid = validGTIN(ean);

    const identityComplete = Boolean(
      productName &&
      brand &&
      (gtinValid || mpn)
    );

    const result = {
      cipher_status: identityComplete
        ? "IDENTITY_PLAUSIBLE"
        : "IDENTITY_INCOMPLETE",

      // Plausibilität ist keine externe Produktverifikation
      cipher_verified: false,

      cipher_product_name: productName,
      cipher_brand: brand,
      cipher_ean_gtin: ean,
      cipher_mpn: mpn,

      cipher_gtin_valid: gtinValid,
      cipher_identity_complete: identityComplete,

      cipher_message: identityComplete
        ? "Produktangaben formal plausibel. Externe Verifikation steht aus."
        : "Produktidentität unvollständig oder GTIN nicht plausibel."
    };

    console.log(
      "[CIPHER] Identitätsprüfung abgeschlossen:",
      result.cipher_status
    );

    return result;
  }
};

module.exports = CIPHER;
