# SpecDrift — Produkt-Roadmap mit Meilensteinen, Tests und Abnahmekriterien

Datum: 2026-06-11
Status: Planungsstand vor M0
Quelle der Kernlogik: `LMA-2.0-ASF-Agent-Semantics-Lab` (Extraktion per Kopie,
keine geteilte Codebasis — das Lab bleibt unberührt)

---

## Teil 1: Painpoint-Analyse der Branche

Zielsegment: Teams und Einzelentwickler, die mit Coding-Agenten (Claude Code,
Cursor, Codex, Copilot) aus Spezifikationen Software bauen. Die Painpoints,
geordnet nach Schmerzintensität und Zahlungsbereitschaft:

| # | Painpoint | Wer leidet | Abgedeckt ab |
| --- | --- | --- | --- |
| P1 | **Stiller Anforderungsverlust**: Agent lässt Anforderungen beim Implementieren weg, niemand merkt es | alle Agent-Nutzer | M3 |
| P2 | **Anforderungs-Verfälschung**: Anforderung wird "ähnlich, aber anders" umgesetzt (Mechanismus-Substitution) | alle, v. a. bei technischen Vorgaben | M3 |
| P3 | **Über-Kompression**: große Spec kollabiert in flache Implementierung, Tiefe geht verloren | Teams mit großen Specs | M2 |
| P4 | **Non-Goal-Verletzung**: explizit Ausgeschlossenes wird trotzdem gebaut | alle (kostet Review-Zeit + Risiko) | M1 |
| P5 | **Scope-Halluzination**: Agent erfindet ungefragte Features | alle | M3 |
| P6 | **Fehlender Nachweis**: niemand kann belegen, was der Agent mit den Anforderungen getan hat | Leads, Agenturen, Reguliertes | M6 |
| P7 | **Review-Überlastung**: Menschen können Spec-Treue in PRs nicht manuell prüfen | Teams ab 2 Personen | M5 |
| P8 | **Session-Amnesie**: Agent vergisst Constraints über Sessions hinweg | alle Mehrtages-Projekte | M4 (Claim-Store als persistenter Vertrag) |
| P9 | **Spec-Veraltung (Rückwärts-Drift)**: Code entwickelt sich weiter, Spec stimmt nicht mehr | alle längeren Projekte | M5 (light: Änderungen ohne Spec-Deckung), M9 (voll) |
| P10 | **Anforderung-zu-Test-Lücke**: Tests existieren, aber niemand weiß, welche Anforderung sie beweisen | Teams, Reguliertes | M9 |
| P11 | **Multi-Agent-Inkonsistenz**: verschiedene Agenten/Entwickler interpretieren dieselbe Spec verschieden | Teams | M6 (geteilter Claim-Store) |
| P12 | **Compliance-Traceability**: Auditor verlangt Anforderung→Implementierung→Beweis-Matrix | regulierte Branchen | M6 (Matrix-Export), Jahr 2 (normenspezifisch) |
| P13 | **False-Positive-Müdigkeit**: gewollte Abweichungen von der Spec sehen aus wie Drift → Team schaltet das Tool ab | alle (Tool-Killer Nr. 1) | M3 (Waiver-Workflow) |

**Strategische Schlussfolgerung:** P1–P5 sind die Akquise-Painpoints (jeder
Agent-Nutzer hat sie diese Woche erlebt — sie tragen das kostenlose Tool).
P6/P7/P11 sind die Bezahl-Painpoints (Team-Schmerz → vServer-Produkt).
P9/P10/P12 sind die Ausbau-Painpoints (Differenzierung und Enterprise).

## Teil 2: Optimierungsanalyse — was das Produkt "optimal" macht

### 2.0 Stand der Technik (recherchiert 2026-06-11) — Positionierungs-Korrektur

Spec-Driven Development ist 2026 Mainstream: GitHub Spec Kit (~90k Stars),
OpenSpec (~52k Stars), AWS Kiro, Tessl, BMAD. "Drift" ist etabliertes
Vokabular. **SpecDrift darf deshalb nicht als SDD-Workflow-Tool positioniert
werden — da wäre es zu spät.** Die Recherche zeigt aber zugleich die reale
Lücke:

- Kiro erkennt Drift NICHT automatisch — manueller Sync, selbst zu
  konfigurierende Hooks, Property-Tests als "Sicherheitsnetz".
- Keines der führenden Tools macht Claim-Extraktion mit Quellenanker
  (Zeile/Hash), Pro-Anforderung-Verdicts, Audit-Evidenz oder CI-Blocking
  nach Anforderungsabdeckung. Ein unabhängiger 6-Tool-Vergleich nennt
  Traceability/Audit explizit "significant market opportunity unfilled".
- Klassische RTM-/ALM-Tools (Jama, Polarion, Parasoft/DO-178C) können
  Pro-Anforderung-Traceability mit Release-Gates seit Jahrzehnten — aber
  schwergewichtig, teuer, mit strukturiertem Anforderungsformat als
  Voraussetzung und ohne Agent-Workflow-Integration.

Konsequenzen (verbindlich):

1. **Positionierung: Komplement, nicht Konkurrent.** SpecDrift ist die
   Verifikations-/Evidenz-Schicht, die mit Spec Kit, Kiro und OpenSpec
   zusammenarbeitet — nicht der nächste SDD-Workflow.
2. **Fremdformate als Input (neu in M1):** Kiro `requirements.md` (EARS),
   Spec-Kit- und OpenSpec-Ordnerstrukturen werden als Spec-Quellen
   akzeptiert, nicht nur freies Markdown.
3. **Zeitfenster:** Die Großen sind eine Feature-Release von einer
   "Verify-Phase" entfernt. Verteidigung: Benchmark-Vorsprung, Hash-Ketten-
   Evidenz und Compliance-Tiefe, nicht Workflow-Features.

### 2.1 Design-Prinzipien (aus der Konkurrenzlücke abgeleitet)

Kein führendes SDD-Tool arbeitet auf **Claim-Ebene mit Quellenanker**
(Datei/Zeile/Hash pro Einzelanforderung) oder erzwingt Verdicts mit Evidenz;
Eval-Tools messen Modellqualität, nicht Anforderungstreue; ALM-RTM-Tools
können Traceability, aber nicht im Agent-Loop und nicht zu null
Adoptionskosten. Daraus folgen fünf Optimierungshebel:

1. **Null Adoptionskosten.** Funktioniert auf jeder vorhandenen
   Markdown-Spec. Kein Methodik-Buy-in, kein Format-Zwang, kein Account für
   das CLI. Das ist die wichtigste Einzeloptimierung — Frameworks sterben an
   Adoptionskosten.
2. **Deterministischer Kern, semantischer Arbeiter.** SpecDrift selbst ruft
   kein LLM auf. Die semantische Prüfung pro Claim macht der Host-Agent (via
   MCP); SpecDrift erzwingt Struktur: jeder Claim braucht ein Verdict mit
   Evidenz, hash-gebunden. Ergebnis: keine API-Kosten, keine Latenz, keine
   Provider-Abhängigkeit, reproduzierbare Enforcement-Schicht.
3. **Beide Drift-Richtungen.** Spec→Code (verloren/verfälscht) UND Code→Spec
   (Scope-Halluzination, veraltete Spec). Niemand sonst denkt bidirektional.
4. **Jede Oberfläche, ein Kern.** CLI, MCP, GitHub Action, REST-API teilen
   exakt dieselbe Kernbibliothek und dieselben Schemas — kein Verhaltens-Drift
   zwischen Kanälen.
5. **Messbare Qualität statt Behauptung.** Ein öffentliches
   **Drift-Benchmark** (Specs mit absichtlich eingepflanzten Auslassungen/
   Verfälschungen) misst Erkennungsrate. Das ist zugleich Qualitäts-Gate jeder
   Version und Marketing-Asset ("X % Seeded-Drift-Erkennung").

### 2.2 Qualitäts-KPIs (gelten ab M3 für jede Version)

- **Recall auf Seeded Drift:** ≥ 90 % der absichtlich entfernten/verfälschten
  Claims werden im Report als `missing`/`distorted` markiert.
- **Precision:** ≤ 10 % False-Positives auf dem Benchmark.
- **Extraktionsrobustheit:** kein Crash auf 100 realen READMEs/Specs aus
  öffentlichen Repos (Fuzzing-Korpus).
- **Performance:** Extraktion einer 2.000-Zeilen-Spec < 1 s; MCP-Tool-Antwort
  < 500 ms (ohne Host-LLM-Zeit).
- **Determinismus:** identischer Input → byte-identischer Output (außer
  Zeitstempeln).

### 2.3 Bewusste Nicht-Ziele (v1)

- Kein eigenes LLM / keine eigene Inferenz.
- Kein visueller Spec-Editor.
- Keine Jira/Linear-Synchronisation (erst nach Beta-Feedback).
- Keine Multi-Tenancy-Enterprise-Features (SSO, SCIM) vor zahlenden Kunden.
- Kein Versuch, das ganze LMA-Lab zu produktisieren.

---

## Teil 3: Roadmap

Arbeitsweise für ALLE Meilensteine (übernommen aus der Lab-Disziplin):

> Jeder Schritt: implementieren → Positiv-Tests → Negativ-Tests →
> Schema-Validierung des Outputs → Gesamtregression → erst dann nächster
> Schritt. Kein Meilenstein gilt als abgenommen, ohne dass alle Kriterien
> seiner Tabelle erfüllt und in CI reproduzierbar grün sind.

### M0 — Produktfundament (≈ 2–3 Tage)

Repo `specdrift/` (eigenständig, außerhalb des Labs), Lizenz Apache-2.0,
npm-Workspace mit `core/` (Bibliothek), `cli/`, `mcp/`, `schemas/`, `tests/`.
CI (GitHub Actions) für Linux/macOS/Windows. Namens-/Markencheck npm+GitHub.

| Abnahmekriterium | Test |
| --- | --- |
| CI läuft auf 3 Betriebssystemen grün | Pipeline-Run |
| `npx specdrift --version` und `--help` funktionieren | Positiv |
| Unbekanntes Kommando → Exit-Code ≠ 0 + Hilfetext | Negativ |
| Lizenz-/Namensfrage dokumentiert entschieden | Review |

### M1 — Claim-Extraktion standalone (≈ 2 Tage)

`specdrift extract <spec.md>` → `*.claims.json` mit Quellenanker (Datei,
Zeile, Hash, Originaltext), Klassifikation (must/must_not/should/acceptance ×
security/technical/data/ui/feature), Section-Pfade, **Non-Goal-Erkennung**
(P4: Non-Goal-Sektionen werden als Grenzen markiert, nie als Anforderungen).
Kernlogik per Kopie aus `07g-intake-claims-contracts.js`, entkoppelt von
LMA-Config.

| Abnahmekriterium | Test |
| --- | --- |
| DE- und EN-Fixture-Specs liefern erwartete Claim-Anzahl, -Typen, -Anker (goldene Snapshots) | Positiv |
| Code-Fences werden nicht als Claims extrahiert | Positiv |
| Non-Goal-Sektion: Claims als `boundary` markiert, nicht als Anforderung | Positiv |
| Leere Datei, < 80 Zeichen, Binärdatei, nicht existenter Pfad → sauberer Fehler, Exit ≠ 0, kein Artefakt geschrieben | Negativ |
| Identischer Input zweimal → identische Claim-IDs und Hashes | Determinismus |
| Output validiert gegen `claims.schema.json` | Schema |
| 100-Datei-Fuzzing-Korpus ohne Crash | Robustheit |

### M2 — Coverage, Confirm, Staleness (≈ 1–2 Tage)

`specdrift status` (Coverage-Report), `specdrift confirm --accept-current`
(Claims → bestätigte Contracts), Staleness-Gate (Spec-Hash geändert →
blockiert). Deckt P3-Grundlage ab: kritische Claims müssen Contract-Kandidaten
sein, sonst `blocked`.

| Abnahmekriterium | Test |
| --- | --- |
| Confirm ohne `--accept-current` → Fehler, keine Schreiboperation | Negativ |
| Spec nach Extraktion geändert → `status` und `confirm` blockieren als stale | Negativ |
| Confirm bindet alle Kandidaten, Coverage wird `confirmed` | Positiv |
| Manuell editierte (schema-invalide) claims.json → Blockierung mit Pfadangabe | Negativ |
| Alle Outputs schema-valide; Regression M1 weiter grün | Schema/Regression |

### M3 — Verdict-Protokoll & Drift-Report — das Herzstück (≈ 3–4 Tage)

`specdrift verdict record` (pro Claim: `covered`/`missing`/`distorted`/
`out_of_scope`/`accepted_deviation`, mit Evidenz-Referenz Datei:Zeile oder
Begründung) und `specdrift report` (Drift-Report: Abdeckungsquote, verlorene
Claims, verfälschte Claims, **nicht angeforderte Zusätze** = P5). Verdicts
sind an Claim-Hash UND Spec-Hash gebunden.

**Waiver-Workflow (P13, Tool-Killer-Prävention):** `accepted_deviation` ist
die formale Genehmigung einer gewollten Abweichung — nur mit Begründung,
benanntem Genehmiger und Hash-Bindung, und sie erscheint im Report als eigene
Kategorie statt als Drift. Ohne diesen Pfad meldet das Tool jede absichtliche
Änderung als Fehler, das Team stumpft ab und deaktiviert das Gate — die
häufigste Todesursache von Enforcement-Tools (vgl. Linter-Müdigkeit).

Hier entsteht außerdem das **Seeded-Drift-Benchmark**
(20 Spec-Paare mit eingepflanzten Auslassungen/Verfälschungen).

| Abnahmekriterium | Test |
| --- | --- |
| Vollständige Verdicts → Report `complete`, Quoten korrekt berechnet | Positiv |
| Fehlende Verdicts → Report `incomplete`, fehlende Claim-IDs gelistet, Exit ≠ 0 im `--strict`-Modus | Negativ |
| Verdict gegen veralteten Spec-Hash → abgelehnt | Negativ |
| Verdict für unbekannte Claim-ID → abgelehnt | Negativ |
| Verdict ohne Evidenz bei `covered` → abgelehnt | Negativ |
| `accepted_deviation` ohne Begründung oder Genehmiger → abgelehnt | Negativ |
| Gewaiverter Claim erscheint im Report als Abweichung-genehmigt, zählt nicht als Drift, bleibt aber sichtbar | Positiv |
| **Benchmark: Recall ≥ 90 %, Precision ≥ 90 % auf Seeded Drift** | KPI-Gate |
| Report deterministisch und schema-valide | Schema |

### M4 — MCP-Server (≈ 2–3 Tage)

Stdio-MCP-Server mit Tools: `extract_claims`, `get_claims`, `check_coverage`,
`record_verdict`, `drift_report`. Der Host-Agent (Claude Code/Cursor) macht die
semantische Prüfung; SpecDrift erzwingt Vollständigkeit und Hash-Bindung.
Deckt P8: der Claim-Store wird persistenter Anforderungsvertrag über Sessions.

| Abnahmekriterium | Test |
| --- | --- |
| **End-to-End-Abnahme:** Agent implementiert Fixture-Spec über MCP; eine Anforderung wird absichtlich weggelassen → `drift_report` zeigt genau diesen Claim als `missing` | Positiv+Negativ kombiniert |
| Alle 5 Tools gegen MCP-Schema validiert; Inspector-Lauf dokumentiert | Schema |
| Ungültige Tool-Argumente → strukturierte MCP-Fehler, kein Crash | Negativ |
| Parallele Tool-Calls korrumpieren den Store nicht (Lock/Serialisierung) | Negativ |
| Setup-Doku: von `npm install` bis erstem Report in < 10 Minuten (an unbeteiligter Person getestet) | Usability |

### M5 — GitHub Action / CI-Gate (≈ 2 Tage)

Action: extrahiert/lädt Claims, prüft Drift-Report im Repo, kommentiert PR mit
Drift-Tabelle, **blockiert Merge** bei `missing`/`distorted` über
konfigurierbare Schwellen. Deckt P7.

| Abnahmekriterium | Test |
| --- | --- |
| Demo-Repo: PR mit vollständiger Abdeckung → grün + Kommentar mit Quote | Positiv |
| PR mit fehlendem Claim → Check failed, Kommentar nennt Claim + Quellzeile | Negativ |
| PR mit verändertem Spec ohne Re-Extraktion → Staleness-Fail | Negativ |
| Schwellen konfigurierbar (`fail_on: missing|distorted|both`, `min_coverage`) | Positiv |
| **Uncovered-Change-Erkennung (P9 light):** PR-Dateien, die in keiner Verdict-Evidenz referenziert sind, werden als "Änderung ohne Spec-Deckung" gelistet (zunächst warnend, per Schwelle blockierend) | Positiv |
| Action läuft ohne Secrets (kein LLM-Call) | Architektur-Review |

**→ Ab hier ist das OSS-Produkt veröffentlichbar (v0.1 public). Launch-Gate:
alle KPI-Gates aus 2.2 grün + Doku + 3 Beispiel-Repos.**

### M6 — vServer: Hosted Evidence-API (≈ 4–6 Tage)

REST-API auf eurem vServer: Drift-Reports und Claim-Stores hochladen,
**unveränderlich** speichern (Hash-Kette: jeder Report referenziert
Vorgänger-Hash), Team-Workspaces, API-Keys, Share-Links für Kunden/Auditoren.
Deckt P6 + P11. Stack bewusst klein: Node + Fastify, SQLite (später Postgres),
Caddy als Reverse-Proxy mit TLS, tägliche Backups, EU-Hosting (DSGVO-Argument).

Architektur-Grenze (verbindlich): Die Evidence-API ist ein eigenständiger
Node-Dienst und bleibt es. Das WordPress-Portal (M7) ist reiner Konsument über
eine interne Provisioning-Schnittstelle. Kein geteilter DB-Zugriff, keine
Schlüssel im Klartext in WordPress. Ein kompromittiertes WordPress darf
Beweisdaten weder lesen noch fälschen können — nur Keys provisionieren und
widerrufen.

Zusätzlich in M6: interne Admin-/Provisioning-Endpoints (Key erstellen,
rotieren, widerrufen; Workspace anlegen/sperren), abgesichert über separates
internes Secret + IP-Bindung, als Vertrag für das M7-Portal.

| Abnahmekriterium | Test |
| --- | --- |
| API-Contract-Tests für alle Endpoints (Upload, List, Get, Share) | Positiv |
| Upload ohne/mit falschem API-Key → 401/403; fremder Workspace → 403 | Negativ (Security) |
| Manipulierter Report (Hash stimmt nicht) → abgelehnt, Vorfall geloggt | Negativ (Integrität) |
| Provisioning-Endpoint ohne internes Secret / von fremder IP → 403 | Negativ (Security) |
| Widerrufener Key verliert Zugriff in < 60 s auf allen Endpoints | Negativ |
| Hash-Kette: nachträgliche Änderung eines gespeicherten Reports ist erkennbar (Verifikations-Endpoint) | Positiv |
| Rate-Limiting greift (Test mit Burst) | Negativ |
| **Traceability-Matrix-Export (P12 vorgezogen):** Anforderung→Verdict→Evidenz als CSV/JSON-Export pro Workspace — das von der SOTA-Recherche bestätigte Alleinstellungsmerkmal, technisch nur ein Report-Format über vorhandenen Daten | Positiv |
| Backup → Restore auf frischem Server → Daten identisch (geprobt, nicht behauptet) | Betrieb |
| TLS-Konfiguration: SSL-Labs-Rating ≥ A | Betrieb |
| Lasttest: 50 parallele Uploads ohne Fehler/Datenverlust | Performance |

### M7 — WordPress-Portal: Registrierung, Bezahlung, Keys, Report-Viewer (≈ 5–7 Tage)

Kundenseite als WordPress-Site auf dem vServer (eure Kernkompetenz):
Marketing-Seiten, Registrierung/Login, Abo-Verwaltung und Bezahlung,
Key-Verwaltung und ein eingebetteter Read-only-Report-Viewer. Umgesetzt als
eigenes Plugin (`specdrift-portal`) nach eurem
`wordpress-shortcode-ui-standard`.

Aufgabenteilung:

- **WordPress besitzt:** Benutzerkonten, Abos/Rechnungen, Portal-UI.
- **Evidence-API besitzt:** Workspaces, Keys (nur als Hash gespeichert),
  Reports, Hash-Kette. WordPress spricht ausschließlich die internen
  Provisioning-Endpoints aus M6 an.
- **Key-Fluss:** Abo aktiv → WP ruft Provisioning auf → Key wird dem Nutzer
  **genau einmal** angezeigt, danach existiert nur noch der Hash. Abo
  gekündigt/Zahlung fehlgeschlagen → automatischer Widerruf über denselben
  Weg.

Bezahlung — ENTSCHIEDEN (2026-06-11): **Option A, WooCommerce + Stripe.**
Begründung: minimale laufende Kosten (nur Stripe-Gebühren, kein ~5 %
MoR-Revenue-Share), volle Kontrolle, WooCommerce ist Kernkompetenz.
Konsequenz: USt-/Rechnungspflichten liegen bei euch und werden Teil der
M7-Abnahme. Kostenarme Umsetzung: WooCommerce + Stripe Gateway + Germanized
(kostenlose Version zuerst) für DE-konforme Rechnungen; EU-B2C über
OSS-Verfahren beim BZSt registrieren, bevor der erste nicht-deutsche
EU-Verkauf passiert.

Zusätzliche Abnahmekriterien aus Option A:

| Abnahmekriterium | Test |
| --- | --- |
| DE-Kauf: 19 % USt, Rechnungs-PDF korrekt (Anschrift, USt-ID, Nummernkreis) | Positiv |
| EU-B2B mit gültiger USt-ID (VIES-Prüfung): Reverse Charge, 0 % USt, Hinweis auf Rechnung | Positiv |
| EU-B2B mit ungültiger USt-ID → Standard-USt des Ziellandes statt 0 % | Negativ |
| EU-B2C: USt-Satz des Verbraucherlandes wird angewendet (OSS) | Positiv |
| Fehlgeschlagene Stripe-Zahlung → Abo nicht aktiv, kein Key provisioniert | Negativ |
| Stripe-Webhook-Ausfall: Abgleich-Job erkennt Abo-/Key-Diskrepanz | Negativ (Resilienz) |

| Abnahmekriterium | Test |
| --- | --- |
| Kompletter Happy Path als Browser-Test: Registrieren → Abo abschließen (Sandbox) → Key erzeugen → CLI-Upload mit diesem Key → Report im Portal sichtbar | Positiv (E2E) |
| Key wird nur einmal im Klartext angezeigt; danach weder in WP-DB noch im HTML auffindbar | Negativ (Security) |
| Abo gekündigt / Zahlung fehlgeschlagen (Sandbox-Event) → Key innerhalb 60 s widerrufen, Upload schlägt fehl | Negativ |
| Eingeloggter Nutzer A kann Workspace/Reports von Nutzer B nicht sehen (URL-/Parameter-Manipulation) | Negativ |
| Alle Portal-Formulare: Nonce- und Capability-Checks, Eingabe-Sanitizing (WP-Standard) | Negativ (Security) |
| Report-Viewer rendert M6-Report korrekt (Stichprobe gegen JSON); leerer Workspace, kaputter Report, 1.000-Claims-Report → definierte Zustände | Positiv + Edge |
| Portal funktioniert bei nicht erreichbarer Evidence-API mit klarer Fehlermeldung statt White-Screen | Negativ (Resilienz) |
| Registrierung mit Wegwerf-Spam abgefangen (Honeypot/Ratelimit), DSGVO-Seiten + Double-Opt-in vorhanden | Negativ/Compliance |

### M8 — Beta-Launch & Bezahlschranke (≈ 1–2 Wochen, parallel Feedback)

OSS-Launch-Kommunikation (Show HN, Dev-Communities), Hosted-Beta mit 5–10
externen Teams über das WordPress-Portal (Free: 1 Projekt / Team: pro
Workspace-Monat). Telemetrie nur opt-in.

| Abnahmekriterium | Test |
| --- | --- |
| 5 externe Nutzer durchlaufen Setup→Report ohne Support-Eingriff | Usability-Abnahme |
| ≥ 500 Installs ODER ≥ 20 qualifizierte Feedbacks in 8 Wochen (Stufe-1-Kriterium aus der Strategie) | Markt-Gate |
| Zahlung: Test-Abo abschließen, kündigen, Rechnung korrekt | Positiv/Negativ |
| Abuse-Fall: gekündigter Account verliert Schreibzugriff, behält Export | Negativ |
| Feedback klassifiziert → priorisierte M9-Liste | Review |

### M9 — Ausbau nach Beta-Daten (Reihenfolge durch Feedback bestimmt)

Kandidaten, jeweils mit eigenem Pos/Neg-Testpaket vor Merge:

- **Rückwärts-Drift** (P9): Code-Änderungen ohne Spec-Deckung erkennen
  (`specdrift reverse --diff <range>`).
- **Test-Traceability** (P10): Verdicts können Test-IDs referenzieren;
  Report zeigt Anforderung→Test-Matrix.
- **Compliance-Exporte** (P12): Traceability-Matrix als PDF/CSV für Audits.
- Mehrsprachige/Format-Heuristiken (reStructuredText, AsciiDoc, Notion-Export).

---

## Teil 4: Querschnitts-Regeln

1. **Kleinschrittigkeit:** kein Schritt > 1 Tag ohne Zwischen-Commit mit
   grüner Regression. Jeder Commit: Positiv-Tests + Negativ-Tests + Schema-
   Validierung.
1a. **Verbindlicher Testplan:** `TESTPLAN.md` definiert pro Meilenstein alle
   Positiv-/Negativ-Tests mit IDs (`M<x>-P<nn>` / `M<x>-N<nn>`). Ein
   Meilenstein gilt erst als abgenommen, wenn alle seine Test-IDs
   automatisiert in CI grün sind (manuelle Ausnahmen sind dort markiert)
   UND die kumulierte Regression aller Vormeilensteine grün bleibt.
   Abnahmetabellen in dieser Roadmap sind Zusammenfassungen; bei
   Abweichungen gilt der Testplan.
2. **Negativ-Tests sind Pflicht, nicht Kür:** jede neue Funktion braucht
   mindestens so viele Negativ- wie Positiv-Tests (Ablehnungen, Staleness,
   kaputte Inputs, Berechtigungen). Das ist die Produkt-DNA — ein
   Enforcement-Tool, dessen eigene Ablehnungspfade ungetestet sind, ist
   unglaubwürdig.
3. **Benchmark als Release-Gate:** keine Version shipped, wenn Recall/
   Precision auf dem Seeded-Drift-Benchmark unter die KPI fällt.
4. **Kein Lab-Code wird verändert.** Extraktion per Kopie; das Lab bleibt
   `scaffold_source`-rein und entwickelt sich unabhängig weiter.
5. **Zeitbudget:** SpecDrift max. ~50 % der Wochenzeit; die übrige Zeit
   Stufe P (Lieferprojekte) und Lab-Runtime, damit der Fabrik-Fortschritt
   nicht stirbt.

## Teil 5: Zeitachse (realistisch, Teilzeit)

| Phase | Kalenderzeit | Ergebnis |
| --- | --- | --- |
| M0–M3 | Woche 1–3 | Kern + Benchmark, intern nutzbar |
| M4–M5 | Woche 3–5 | MCP + CI-Gate, **OSS-Launch v0.1** |
| M6–M7 | Woche 5–9 | vServer-API + WordPress-Portal (Konto, Bezahlung, Keys), Hosted-Beta |
| M8 | Woche 8–14 | Beta, erste Zahlungen, Markt-Gate-Entscheidung |
| M9 | ab Woche 14 | Ausbau nach Daten, nicht nach Bauchgefühl |

Gesamtaufwand bis Hosted-Beta: **~25–35 Entwicklungstage**, davon der größte
Einzelblock der vServer-Teil (M6) — dort liegen auch die meisten
Sicherheits-Abnahmekriterien, weil ab da fremde Daten verwaltet werden.
