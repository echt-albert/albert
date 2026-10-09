// ============================================================
// ALBERT – RADAR V2.1
// Live-Anbindung an Supabase Research
// ============================================================

const RADAR = {
  name: "RADAR",

  description:
    "Entdeckt reale B2B-Warenposten über die Albert Research Engine.",

  async execute(input = {}) {
    console.log("[RADAR] Starte Live-Recherche");

    if (input.product && typeof input.product === "object") {
      return { radar_status: "RESEARCH_HANDOFF", radar_verified: false, product: input.product };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "RADAR: Supabase-Zugangsdaten fehlen."
      );
    }

    const query =
      typeof input.query === "string"
        ? input.query.trim()
        : "";

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/albert-research`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey
        },

        body: JSON.stringify({ query }),

        signal: AbortSignal.timeout(50000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `RADAR: Recherche fehlgeschlagen (${response.status}): ${
          data.error || "Unbekannter Fehler"
        }`
      );
    }

    if (data.success !== true) {
      throw new Error(
        `RADAR: Recherche nicht erfolgreich: ${
          data.error || data.status || "Unbekannter Fehler"
        }`
      );
    }

    const product =
      data.saved_deal ||
      data.deal ||
      null;

    return {
      radar_status: data.status || "COMPLETED",
      radar_verified: false,
      product,
      research_response: data
    };
  }
};

module.exports = RADAR;
