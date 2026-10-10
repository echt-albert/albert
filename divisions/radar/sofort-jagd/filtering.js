"use strict";
/** Nur tatsächlich gespeicherte neue Deals zählen; andere Ergebnisse separat halten. */
function classify(response) {
  const status = response?.status || "unknown";
  if (status === "new_saved") {
    const deals = Array.isArray(response.saved_deals) ? response.saved_deals
      : [response.saved_deal].filter(Boolean);
    const persisted = deals.filter(deal => deal && deal.id != null);
    return { status: persisted.length ? "new" : "unverified",
      deal: persisted[0] || null, deals: persisted, count: persisted.length,
      stats: response.stats || {} };
  }
  if (status === "duplicate_skipped") return { status: "duplicate", count: 0 };
  if (status === "alternative_offer_saved") return { status: "alternative", count: 0 };
  return { status, count: 0, stats: response?.stats || {} };
}
module.exports = { classify };
