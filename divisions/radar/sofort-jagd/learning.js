"use strict";
/** Beobachtungen für ein späteres zentrales Gedächtnis standardisieren.
 * Keine autonome Lernfähigkeit behaupten: Persistenz ist noch nicht angeschlossen.
 */
function observation(plan, result) {
  return { query: plan.query, origin: plan.origin, outcome: result.status,
    newDeals: result.count, recordedAt: new Date().toISOString() };
}
module.exports = { observation };
