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
  return arr.filter(x => x && typeof x === "object").slice(0, 5);
}

// Buyer feedback is advisory discovery context, never a product rating or exclusion rule.
// Read only a bounded number of recent decisions; do not send buyer free-text to Gemini.
async function buyerDiscoveryMemory(db: any): Promise<string> {
  const { data, error } = await db.from("deal_feedback")
    .select("discovery_id,action,comment,id").order("id", { ascending: false }).limit(120);
  if (error || !data?.length) return "";
  // The latest decision per deal wins; repeated clicks must not amplify preferences.
  const latest = new Map<string, { action: string; comment: string }>();
  for (const row of data) {
    const id = String(row.discovery_id ?? "");
    if (!id || latest.has(id)) continue;
    latest.set(id, { action: text(row.action), comment: text(row.comment) });
  }
  const reasons = new Map<string, number>();
  const actions = new Map<string, number>();
  const allowed = new Set([
    "Interessante Produktkategorie", "Attraktive Einkaufsquelle", "Gute Marge / Preisabweichung",
    "Besonderes Risiko", "Grundsätzliche Einkaufsregel", "Einkaufspreis zu hoch",
    "Marge zu gering", "Nachfrage zu schwach", "Kapitalbindung zu hoch",
    "Versand / Retouren", "Compliance / Produktproblem", "Preis könnte noch fallen",
    "Nachfrage noch nicht belegt", "Weitere Marktprüfung nötig", "Lieferantenangebot abwarten"
  ]);
  for (const row of latest.values()) {
    if (!["LEARN", "REJECT", "WATCH", "DEEP_DIVE"].includes(row.action)) continue;
    actions.set(row.action, (actions.get(row.action) ?? 0) + 1);
    const reason = row.comment.startsWith("[Grund: ") ? row.comment.slice(8).split("]", 1)[0] : "";
    if (reason && allowed.has(reason)) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  if (!actions.size) return "";
  const top = [...reasons.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6)
    .map(([name,count]) => name + " (" + count + ")").join("; ");
  return "BISHERIGE EINKÄUFER-RÜCKMELDUNGEN (nur aggregierte Hinweise, keine Regeln): " +
    [...actions.entries()].map(([name,count]) => name + "=" + count).join(", ") +
    (top ? ". Häufige Gründe: " + top : "") +
    ". Nutze dies höchstens als Anregung für einzelne Suchrichtungen. " +
    "Entdecke weiterhin verschiedene Quellen und mindestens zwei neue/unübliche Kategorien. " +
    "Keine automatische Bewertung, Rangfolge, Ablehnung oder Ausfilterung aufgrund dieser Rückmeldungen.";
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
    const buyerMemory = await buyerDiscoveryMemory(db).catch(() => "");
    const ai = new GoogleGenAI({ apiKey: key });
    // One grounded model call; no unbounded retries or surprise cost multiplication.
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Du bist RADAR, ein erfahrener kategorieunabhängiger B2B-Schnäppchenjäger für den deutschen B2C-Handel.
Auftrag: ${query}
${buyerMemory}
ZIEL: Entdecke 3–5 unterschiedliche KONKRETE, öffentlich auffindbare B2B-Warenangebote mit nachvollziehbarer URL. Suche nach Verkäuferdruck, nicht nur nach Produktnamen.
SUCHE BREIT IN MEHREREN SUCHRICHTUNGEN:
1. Lagerüberhang, Overstock, Sortimentswechsel, Auftragsstorno und Distributor-Abverkauf.
2. Insolvenzverwertung, Geschäftsaufgabe, Lagerauflösung und Auktionen.
3. Großhändler, Hersteller, Liquidatoren und wenig sichtbare lokale Anbieter.
4. Lagerlisten/PDFs, Sonderpreislisten und schlecht präsentierte Bestände.
5. Berücksichtige auch ungewöhnliche Kategorien wie Bürobedarf oder Ersatzteile.
6. Nutze passende lokale Suchbegriffe aus Deutschland und höchstens einem weiteren europäischen Land je Lauf.
Variiere die Suchanfragen aktiv; gib nicht nur dieselben bekannten Portale aus. Bevorzuge konkrete Angebotsseiten gegenüber Startseiten, Branchenverzeichnissen oder reinen Informationsseiten.
Ein Angebot ist NICHT automatisch ein Schnäppchen: Keine erfundenen Marktpreise, EK, Mengen, EAN, Verfügbarkeit oder Begründungen.
Unterscheide price_type: fixed, auction_start, negotiable oder unknown. Unterscheide price_scope: unit, lot oder unknown. Gib quantity_unit als belegte Einheit (Stück, Boxen, Kartons, Paletten, m², kg) an. Startgebote sind niemals Festpreise. Die Angebotsmenge muss ausdrücklich belegt sein. Falls nicht auffindbar, quantity:null (kein erfundener Wert).
Für jeden Kandidaten gib sourcing_signal als EINEN präzisen, vorsichtigen Satz: Welche KONKRETE Angebotsinformation deutet auf eine Beschaffungschance hin? Z.B. belegte Lagerauflösung, ungewöhnliche Menge, klar ausgewiesener Abverkauf. Wenn nicht erkennbar: null. Keine UVP-Vergleiche ohne aktuelle Marktbelege.
Antworte ausschließlich mit JSON: {"candidates":[{"product_name":null,"brand":null,"ean_gtin":null,"mpn":null,"purchase_price":null,"currency":"EUR","quantity":null,"quantity_unit":null,"price_type":"unknown","price_scope":"unknown","offer_url":null,"market_prices":[],"category":null,"sourcing_signal":null}]}.
Jeder Eintrag benötigt eine konkrete https-Angebots-URL. Keine erfundenen Links.`,
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
      // Harte Einkaufsregel: ohne explizite positive ganzzahlige Postenmenge kein Deal.
      // Fehlende Mengen niemals schätzen oder aus Texten ableiten.
      if (typeof candidate.quantity !== "number" || !Number.isSafeInteger(candidate.quantity) || candidate.quantity <= 0) {
        stats.invalid++;
        continue;
      }
      seen.add(offerUrl);
      const urlState = "unverified"; // Human/grounded verification is required.
      stats.urlUnverified++;
      const existing = await db.from("discoveries").select("id").eq("offer_url", offerUrl).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) { stats.duplicates++; continue; }
      // Same identifiable product, different supplier: store as alternative, not a new deal.
      const ean = text(candidate.ean_gtin);
      const mpn = text(candidate.mpn);
      let identityQuery: any = null;
      if (ean) identityQuery = db.from("discoveries").select("id").eq("ean_gtin", ean).limit(1);
      else if (mpn && text(candidate.brand))
        identityQuery = db.from("discoveries").select("id").ilike("brand", text(candidate.brand)).ilike("mpn", mpn).limit(1);
      if (identityQuery) {
        const match = await identityQuery;
        if (match.error) throw match.error;
        if (match.data?.length) {
          const alternative = await db.from("discovered_alternative_offers").insert({
            discovery_id: match.data[0].id, offer_url: offerUrl, product_name: productName,
            purchase_price: typeof candidate.purchase_price === "number" ? candidate.purchase_price : null,
            currency: text(candidate.currency) || "EUR",
            quantity: typeof candidate.quantity === "number" ? candidate.quantity : null,
            detected_by: "RADAR"
          });
          if (alternative.error) {
            if (alternative.error.code === "23505") { stats.duplicates++; continue; }
            stats.errors++; continue;
          }
          stats.alternative++;
          continue;
        }
      }
      const purchase = typeof candidate.purchase_price === "number" && candidate.purchase_price >= 0
        ? candidate.purchase_price : null;
      const quantity = candidate.quantity as number;
      const row = {
        product_name: productName, brand: text(candidate.brand) || null,
        ean_gtin: text(candidate.ean_gtin) || null, mpn: text(candidate.mpn) || null,
        purchase_price: purchase, quantity, currency: text(candidate.currency) || "EUR",
        offer_url: offerUrl, category: text(candidate.category) || "Allgemein",
        market_prices: [], decision_grade: "B",
        decision_reason: "RADAR-Hinweis (ungeprüft): " + text(candidate.sourcing_signal).slice(0,250) + " · Preisart: " + text(candidate.price_type) + " · Preiseinheit: " + text(candidate.price_scope) + " · Mengeneinheit: " + text(candidate.quantity_unit) + " · Nicht verifiziert.",
        bucket: "WATCH", research_run_id: runId, hunt_origin: origin,
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
