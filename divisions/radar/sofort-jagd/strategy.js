"use strict";
/** Ein begrenzter Rechercheauftrag, ohne automatische kostenpflichtige Wiederholung. */
function plan(input = {}) {
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 600) : "";
  return {
    query: query || "Finde neue konkrete B2B-Restposten und prüfe ungewöhnliche Kategorien.",
    origin: "SOFORT",
    maxResearchCalls: 1,
    // Geplante Erweiterung: Kategorienrotation und quellengestützte Suchplanung.
    categories: ["Bürobedarf", "Haushalt", "ungewöhnliche Industrieverbrauchsartikel"]
  };
}
module.exports = { plan };
