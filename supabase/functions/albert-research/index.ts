import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "https://esm.sh/@google/genai"
import { createClient } from "npm:@supabase/supabase-js@2"

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  let supabase;
  let runId = null;

  try {
    console.log("1. Starte Albert Research Kortex...");
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey) throw new Error("GEMINI_API_KEY ist nicht hinterlegt.");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase System-Variablen fehlen.");

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: runData, error: runError } = await supabase
      .from("research_runs")
      .insert([{ status: "running" }])
      .select("id")
      .single();

    if (runError) {
      console.error("Konnte research_run nicht anlegen:", runError);
    } else {
      runId = runData?.id;
      console.log("Research Run ID erstellt:", runId);
    }

    const { query } = await req.json().catch(() => ({ query: "" }));
    const requestedQuery = typeof query === "string" ? query.trim().slice(0, 600) : "";
    const ai = new GoogleGenAI({ apiKey });

    console.log("2. Rufe Gemini mit Google Search Grounding auf...");
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Du bist ausschließlich RADAR, die Beschaffungsdivision. Suche einen realen, aktuell verfügbaren B2B-Restposten in Europa für B2C-Verkauf in Deutschland.
      Auftrag: ${requestedQuery || "Finde einen neuen aktuellen B2B-Warenposten."}
      Verwende Google Search. Nenne nur nachweisbare Fakten. Keine erfundenen Preise, Mengen, EANs, URLs oder Nachfrage.
      Produktidentifikation, Marktverifikation, Wirtschaftlichkeitsrechnung und Kaufentscheidung erfolgen später durch CIPHER, ORACLE, QUANTUM und VERDICT.
      Marktpreise dürfen als unverifizierte Recherchehinweise mitgeliefert werden, aber keine Bewertung.
      Antworte ausschließlich mit einem JSON-Objekt mit diesen Feldern:
      {"product_name":null,"brand":null,"ean_gtin":null,"mpn":null,"purchase_price":null,"currency":"EUR","quantity":null,"offer_url":null,"market_prices":[],"category":null}
      Setze unbekannte Werte auf null, market_prices andernfalls auf [].
      Der offer_url muss auf das konkrete Angebot zeigen, nicht auf eine Portalstartseite.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response?.text;
    if (!rawText) throw new Error("Gemini hat keine Textantwort geliefert.");
    console.log("3. Gemini Antwort erhalten:", rawText.substring(0, 100) + "...");

    let dealData;
    try {
      const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      dealData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("JSON Parse Fehler:", parseErr);
      dealData = {
        product_name: rawText.substring(0, 255),
        brand: null,
        ean_gtin: null,
        mpn: null,
        purchase_price: null,
        currency: "EUR",
        quantity: null,
        offer_url: null,
        market_prices: [],
        category: "Allgemein"
      };
    }

    const targetUrl = typeof dealData?.offer_url === "string" ? dealData.offer_url.trim() : "";
    if (!/^https:\/\/[^\s/]+\/\S+/i.test(targetUrl)) throw new Error("RADAR: Konkrete Angebots-URL fehlt.");

    console.log("4. Prüfe URL auf Erreichbarkeit:", targetUrl);
    const isAlive = await checkUrl(targetUrl);
    if (!isAlive) {
      console.log("Toter Link erkannt – überspringe Deal:", targetUrl);
      if (runId && supabase) {
        await supabase.from("research_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", runId);
      }
      return new Response(
        JSON.stringify({ success: false, status: "dead_link_skipped", url: targetUrl }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("5. Führe Duplikat-Check aus für URL:", targetUrl);
    const selectRes = await supabase
      .from("discoveries")
      .select("id, offer_url")
      .eq("offer_url", targetUrl)
      .maybeSingle();

    if (selectRes?.error) {
      console.error("Supabase Select Fehler:", selectRes.error);
      throw new Error(selectRes.error.message);
    }

    if (selectRes?.data) {
      console.log("Deal bereits im Gedächtnis, überspringe.");
      if (runId) {
        await supabase.from("research_runs").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", runId);
      }
      return new Response(
        JSON.stringify({ success: true, status: "duplicate_skipped", deal: dealData }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("6. Speichere neuen Deal mit 5-Kacheln-Struktur in Supabase...");
    const insertRes = await supabase
      .from("discoveries")
      .insert([
        {
          product_name: dealData?.product_name || "Unbekanntes Produkt",
          brand: dealData?.brand || null,
          ean_gtin: dealData?.ean_gtin || null,
          mpn: dealData?.mpn || null,
          purchase_price: dealData?.purchase_price || null,
          currency: dealData?.currency || "EUR",
          quantity: dealData?.quantity || null,
          offer_url: targetUrl,
          category: dealData?.category || "Allgemein",
          market_prices: dealData?.market_prices || [],
          decision_grade: "B",
          decision_reason: "RADAR-Fund: Produktidentität, deutscher Markt, Nachfrage und Vollkosten müssen durch die Spezialdivisionen geprüft werden.",
          bucket: "DIVE",
          research_run_id: runId,
          discovered_at: new Date().toISOString()
        }
      ])
      .select();

    if (insertRes?.error) {
      console.error("Supabase Insert Fehler:", insertRes.error);
      throw new Error(insertRes.error.message);
    }

    if (runId) {
      await supabase.from("research_runs").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", runId);
    }

    console.log("7. Deal erfolgreich gespeichert und Run abgeschlossen!");
    return new Response(
      JSON.stringify({ success: true, status: "new_saved", saved_deal: dealData }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("FATALER FEHLER IN EDGE FUNCTION:", errorMessage);
    
    if (runId && supabase) {
      await supabase.from("research_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", runId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
})
