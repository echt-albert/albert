"use strict";
/** Ergebnisse ohne gespeicherte ID nicht als bestätigten Neufund ausgeben. */
function classify(response) {
  const status = response?.status || "unknown";
  if (status === "new_saved") {
    const deal = response.saved_deal;
    if (deal && deal.id != null) return { status: "new", deal, count: 1 };
    return { status: "unverified", deal: deal || null, count: 0 };
  }
  if (status === "duplicate_skipped") return { status: "duplicate", count: 0 };
  if (status === "alternative_offer_saved") return { status: "alternative", count: 0 };
  return { status, count: 0 };
}
module.exports = { classify };
