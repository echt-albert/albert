"use strict";
/** Einzige Schnittstelle zum bestehenden Supabase-Recherchedienst. */
async function discover(plan, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const url = options.supabaseUrl || process.env.SUPABASE_URL;
  const key = options.supabaseKey || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Sofort-Jagd: Supabase-Zugangsdaten fehlen.");
  const response = await fetchImpl(url.replace(/\/$/, "") + "/functions/v1/albert-research", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + key },
    body: JSON.stringify({ query: plan.query, origin: "SOFORT" }),
    signal: AbortSignal.timeout(140000)
  });
  const data = await response.json();
  if (!response.ok || data.success !== true) {
    throw new Error("Sofort-Jagd: " + (data.error || data.status || "Recherche fehlgeschlagen"));
  }
  return data;
}
module.exports = { discover };
