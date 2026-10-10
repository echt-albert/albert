import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai";
import { createClient } from "npm:@supabase/supabase-js@2";

type Candidate = Record<string, unknown>;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" }
});
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const normalize = (v: unknown) => text(v).toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function validOfferUrl(value: unknown): string | null {
  try {
    const u = new URL(text(value));
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
    if (["localhost", "127.0.0.1"].includes(u.hostname)) return null;
    u.hash = "";
    return u.toString();
  } catch { return null; }
}
function candidatesFrom(raw: string): Candidate[] {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  let value: any;
  try { value = JSON.parse(cleaned); }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("RADAR: Keine strukturierte Gemini-Antwort.");
    value = JSON.parse(match[0]);
  }
  const arr = Array.isArray(value) ? value : Array.isArray(value?.candidates) ? value.candidates
    : value?.offer_url ? [value] : [];
  return arr.filter(x => x && typeof x === "object").slice(0, 12);
}
// URLs are syntactically checked, but not fetched from the server.
// Server-side arbitrary URL fetches would create an SSRF risk.
serve(async req => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ success: false, error: "POST only" }, 405);
  const key = Deno.env.get("GEMINI_API_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || !url || !secret) return reply({ success: false, error: "Research configuration missing" }, 500);
  // Only server-to-server invocations may trigger billable research.
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + secret)
    return reply({ success: false, error: "Unauthorized" }, 401);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  let runId: string | number | null = null;
  const stats = { candidates: 0, invalid: 0, dead: 0, duplicates: 0,
    alternative: 0, saved: 0, urlUnverified: 0, errors: 0 };
  try {
    const payload = await req.json().catch(() => ({}));
    const origin = payload.origin === "SOFORT" ? "SOFORT" : "PERMANENT";
    const query = text(payload.query).slice(0, 600) || "Finde reale B2B-Restposten.";
    const created = await db.from("research_runs").insert({ status: "running" }).select("id").single();
    if (created.error) throw created.error;
    runId = created.data.id;
    const ai = new GoogleGenAI({ apiKey: key });
    // One grounded model call; no unbounded retries or surprise cost multiplication.
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Du bist RADAR, eine B2B-Beschaffungsrecherche für deutschen B2C-Handel.
Auftrag: ${query}
Suche mit Google Search 6 bis 10 UNTERSCHIEDLICHE, konkrete öffentlich auffindbare B2B-Angebote in Europa.
Suche Restposten, Überbestände, Liquidationen, Sortimentswechsel und ungewöhnliche
langweilige Kategorien (z.B. Büro-Verbrauchsmaterial, Ersatzteile, Betriebsmittel).
Diversifiziere Quellen und Kategorien; keine erfundenen Produkte, Preise oder Links.
Kein B2C-Marktpreis und keine Wirtschaftlichkeit erfinden. Unbekannte Werte null.
Antworte ausschließlich als JSON-Objekt {"candidates":[{"product_name":null,
"brand":null,"ean_gtin":null,"mpn":null,"purchase_price":null,"currency":"EUR",
"quantity":null,"offer_url":null,"market_prices":[],"category":null,"sourcing_signal":null}]}.
Jeder Eintrag benötigt eine direkte konkrete Angebots-URL, keine Startseite.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    if (!response.text) throw new Error("RADAR: Leere Modellantwort.");
    const candidates = candidatesFrom(response.text);
    stats.candidates = candidates.length;
    const saved: any[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const offerUrl = validOfferUrl(candidate.offer_url);
      const productName = text(candidate.product_name).slice(0, 255);
      if (!offerUrl || !productName || seen.has(offerUrl)) { stats.invalid++; continue; }
      seen.add(offerUrl);
      const urlState = "unverified"; // Human/grounded verification is required.
      stats.urlUnverified++;
      const existing = await db.from("discoveries").select("id").eq("offer_url", offerUrl).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) { stats.duplicates++; continue; }
      // Do not equate the same product with a duplicate source: distinct sellers matter.
      // Keep identity deduplication as a later, evidence-based step.
      const purchase = typeof candidate.purchase_price === "number" && candidate.purchase_price >= 0
        ? candidate.purchase_price : null;
      const quantity = typeof candidate.quantity === "number" && candidate.quantity > 0
        ? Math.floor(candidate.quantity) : null;
      const row = {
        product_name: productName, brand: text(candidate.brand) || null,
        ean_gtin: text(candidate.ean_gtin) || null, mpn: text(candidate.mpn) || null,
        purchase_price: purchase, quantity, currency: text(candidate.currency) || "EUR",
        offer_url: offerUrl, category: text(candidate.category) || "Allgemein",
        market_prices: [], decision_grade: "B",
        decision_reason: "RADAR-Kandidat: Identität, EK, DE-Markt, Nachfrage und Vollkosten noch nicht verifiziert." +
          (urlState === "unverified" ? " URL technisch nicht verifizierbar." : ""),
        bucket: "DIVE", research_run_id: runId, hunt_origin: origin,
        discovered_at: new Date().toISOString()
      };
      const inserted = await db.from("discoveries").insert(row).select().single();
      if (inserted.error) { stats.errors++; console.error("candidate insert:", inserted.error.message); continue; }
      saved.push(inserted.data); stats.saved++;
    }
    await db.from("research_runs").update({ status: "completed",
      finished_at: new Date().toISOString(), finds_count: stats.saved }).eq("id", runId);
    return reply({ success: true, status: saved.length ? "new_saved" : "no_new_deals",
      saved_deal: saved[0] || null, saved_deals: saved, stats, run_id: runId });
  } catch (error) {
    if (runId != null) await db.from("research_runs").update({
      status: "failed", finished_at: new Date().toISOString() }).eq("id", runId);
    return reply({ success: false, error: String(error instanceof Error ? error.message : error),
      stats, run_id: runId }, 500);
  }
});
