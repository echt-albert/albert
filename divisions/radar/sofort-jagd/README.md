# Sofort-Jagd 2.0 – RADAR-Submodul

**Status:** Entwicklungszweig, nicht produktiv aktiviert.

- `strategy.js`: begrenzter Rechercheauftrag und Suchdiversität
- `discovery.js`: einmaliger Aufruf der bestehenden Supabase Research API
- `filtering.js`: ausschließlich persistierte Deals mit ID zählen
- `learning.js`: normalisierte Beobachtung; **noch kein persistentes Lernen**
- `index.js`: Orchestrierung und Ergebnisvertrag

Die tatsächliche browserseitige Sofort-Jagd verwendet bislang `albert-jobs`
und dann `albert-research`. Der Node-Submodulcode ist noch nicht in diesem
Laufweg verdrahtet. Die neue Research-Funktion auf diesem Branch ist ein
Entwurf, kein Deployment. Sie liefert `saved_deal` **mit ID** und
`saved_deals` als Array sowie `stats` zurück. Der aktuelle Browser
analysiert nur den ersten Deal; die übrigen werden zunächst als B-Kandidaten
gespeichert und müssen später separat geprüft werden.

**Vor Produktion:** Supabase Schema und Berechtigungen prüfen, Gemini Modell
und Antwortform mit realem Test validieren, GET/HEAD-URL-Prüfung auf SSRF/
private DNS und Netzwerkzugriff härten, Kosten-/Laufzeitbudget testen,
E2E-Tests (Jobs -> Research -> UI) durchführen, B-Kandidaten-Workflow
einbinden, optionalen Lernspeicher entwerfen. Keine automatische Cron-Jagd
reaktivieren.
