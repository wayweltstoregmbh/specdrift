# SpecDrift — Verbindlicher Testplan (Positiv- und Negativ-Tests je Meilenstein)

Datum: 2026-06-11
Gilt für: ROADMAP.md M0–M9

## Konventionen

1. **Test-IDs:** `M<x>-P<nn>` = Positiv-Test, `M<x>-N<nn>` = Negativ-Test.
   Jede ID wird später exakt einer automatisierten Testdatei/-funktion
   zugeordnet (`tests/m3/M3-N04.test.js` o. ä.).
2. **Abnahmeregel:** Ein Meilenstein ist erst abgenommen, wenn ALLE seine
   Tests automatisiert in CI grün sind UND die kumulierte Regression
   (alle Tests der Vormeilensteine) grün bleibt. Manuelle Tests sind als
   `[manuell]` markiert und werden mit Datum + Prüfer im PR dokumentiert.
3. **Negativ-Pflicht:** Kein Feature wird gemerged, dessen Ablehnungs-,
   Fehler- und Missbrauchspfade nicht mindestens gleichwertig getestet sind
   wie seine Erfolgspfade.
4. **Determinismus-Regel:** Wo "byte-identisch" gefordert ist, sind
   Zeitstempel-Felder ausgenommen und werden separat auf Format geprüft.

---

## M0 — Produktfundament

### Positiv
- M0-P01: CI-Pipeline läuft auf Linux, macOS und Windows grün durch.
- M0-P02: `npx specdrift --version` gibt gültige SemVer aus, Exit 0.
- M0-P03: `npx specdrift --help` listet alle registrierten Kommandos mit
  Einzeilern, Exit 0.
- M0-P04: Lint- und Format-Check laufen in CI und lokal identisch.
- M0-P05: Alle Dateien unter `schemas/` parsen als gültiges JSON Schema
  (Meta-Schema-Validierung).

### Negativ
- M0-N01: Unbekanntes Kommando → Exit ≠ 0, Hinweis auf `--help`, kein
  Stacktrace.
- M0-N02: Unbekanntes Flag bei gültigem Kommando → Exit ≠ 0 mit Flag-Name.
- M0-N03: Meta-Test: ein absichtlich fehlschlagender Test lässt die
  CI-Pipeline tatsächlich fehlschlagen (CI-Wirksamkeitsnachweis, danach
  wieder entfernt). `[manuell]` einmalig.
- M0-N04: `npm audit` mit Critical-Findings bricht CI ab (Gate aktiv,
  geprüft mit bekannt-verwundbarer Dev-Dependency in einem Testbranch).
  `[manuell]` einmalig.

---

## M1 — Claim-Extraktion

### Positiv
- M1-P01: EN-Fixture-Spec → erwartete Claim-Anzahl, -Typen, -Stärken
  (goldener Snapshot).
- M1-P02: DE-Fixture-Spec → goldener Snapshot.
- M1-P03: Stichproben-Claims zeigen exakt auf die richtige Quellzeile
  (`source_line_start` gegen Fixture verifiziert).
- M1-P04: `source_hash` entspricht SHA-256 des Spec-Inhalts.
- M1-P05: Verschachtelte Überschriften → korrekte `section_path`-Hierarchie.
- M1-P06: Inhalte in Code-Fences erzeugen keine Claims.
- M1-P07: Claims in Non-Goal-Sektionen werden als `boundary` markiert.
- M1-P08: Kiro-`requirements.md` (EARS-Notation) wird als Quelle akzeptiert
  und liefert Claims mit Anker.
- M1-P09: Spec-Kit-/OpenSpec-Ordnerstruktur wird als Quelle akzeptiert
  (mehrere Dateien, ein Claim-Store, Anker pro Datei).
- M1-P10: Zwei Läufe auf identischem Input → identische Claim-IDs und
  Inhalte (Determinismus).
- M1-P11: 2.000-Zeilen-Spec wird in < 1 s extrahiert.
- M1-P12: Fuzzing-Korpus (100 reale READMEs/Specs) läuft ohne Crash durch;
  jede Datei endet mit Exit 0 oder sauberem Fehler.

### Negativ
- M1-N01: Nicht existenter Pfad → Exit ≠ 0, kein Artefakt geschrieben.
- M1-N02: Leere Datei → Exit ≠ 0, klare Meldung.
- M1-N03: Datei < 80 Zeichen → Exit ≠ 0 ("zu klein für loss-aware Intake").
- M1-N04: Binärdatei → Exit ≠ 0, kein Crash, kein Artefakt.
- M1-N05: Verzeichnis statt Datei (ohne erkanntes SDD-Format) → Exit ≠ 0.
- M1-N06: Nicht beschreibbares Output-Verzeichnis → Exit ≠ 0 mit Pfad,
  kein partielles Artefakt.
- M1-N07: Spec nur aus Überschriften → 0 Claims, Warnung, Exit 0, kein
  Crash.
- M1-N08: Kaputtes UTF-8 / Mixed Encoding → definierter Fehler statt
  stiller Korruption.

---

## M2 — Coverage, Confirm, Staleness

### Positiv
- M2-P01: `status` auf frisch extrahierten Claims →
  `ready_for_confirmation`, Zählwerte korrekt.
- M2-P02: `confirm --accept-current` schreibt Contracts; Coverage wird
  `confirmed`; Claim-Store-Status aktualisiert.
- M2-P03: Erneutes `status` nach Confirm → `confirmed`, idempotent ohne
  Schreiboperation.
- M2-P04: Alle kritischen Claims sind Contract-Kandidaten → Gate `pass`.

### Negativ
- M2-N01: `confirm` ohne `--accept-current` → Exit ≠ 0, keinerlei
  Schreiboperation (Verzeichnis-Hash vorher/nachher identisch).
- M2-N02: Spec nach Extraktion geändert → `status` UND `confirm`
  blockieren als stale mit Hash-Diff-Hinweis.
- M2-N03: Hand-editierte, schema-invalide `claims.json` → Blockierung mit
  Dateipfad und Schema-Fehlerpfad.
- M2-N04: Manipulierte Contracts-Datei (Claim-Hash stimmt nicht mehr) →
  Blockierung als Integritätsfehler.
- M2-N05: `confirm` ohne vorhandenen Claim-Store → sauberer Fehler mit
  Hinweis auf `extract`.

---

## M3 — Verdict-Protokoll, Drift-Report, Waiver, Benchmark

### Positiv
- M3-P01: `verdict record covered` mit Evidenz (Datei:Zeile) → gespeichert,
  an Claim- und Spec-Hash gebunden.
- M3-P02: Alle Claims mit Verdict → Report `complete`; Abdeckungsquote,
  Missing-/Distorted-Listen rechnerisch korrekt (Fixture mit bekannter
  Verteilung).
- M3-P03: `distorted` mit Begründung → erscheint in Verfälschungs-Sektion
  mit Quellzeile.
- M3-P04: `out_of_scope`-Zusätze → eigene Scope-Halluzinations-Sektion.
- M3-P05: `accepted_deviation` mit Begründung + Genehmiger → eigene
  Waiver-Kategorie, zählt nicht als Drift, bleibt sichtbar gelistet.
- M3-P06: Report ist deterministisch (zwei Läufe → identisch außer
  Zeitstempel).
- M3-P07: Seeded-Drift-Benchmark: Recall ≥ 90 % (eingepflanzte
  Auslassungen/Verfälschungen werden gefunden).
- M3-P08: Benchmark: Precision ≥ 90 % (saubere Claims werden nicht
  fälschlich als Drift gemeldet).
- M3-P09: `report --strict` mit vollständigen Verdicts über Schwellen →
  Exit 0.

### Negativ
- M3-N01: Verdict für unbekannte Claim-ID → abgelehnt.
- M3-N02: Verdict gegen veralteten Spec-Hash → abgelehnt mit
  Staleness-Meldung.
- M3-N03: `covered` ohne Evidenz-Referenz → abgelehnt.
- M3-N04: `accepted_deviation` ohne Begründung → abgelehnt.
- M3-N05: `accepted_deviation` ohne Genehmiger → abgelehnt.
- M3-N06: Unvollständige Verdicts → Report `incomplete`, fehlende
  Claim-IDs gelistet, `--strict` Exit ≠ 0.
- M3-N07: Evidenz-Referenz auf Pfad außerhalb des Projekt-Roots →
  abgelehnt (Path-Traversal-Schutz).
- M3-N08: Zweites Verdict für denselben Claim ohne `--overwrite` →
  abgelehnt; mit `--overwrite` ersetzt und als Überschreibung protokolliert.

---

## M4 — MCP-Server

### Positiv
- M4-P01: Alle 5 Tools werden mit schema-validen Definitionen gelistet
  (MCP-Inspector-Lauf, Ergebnis archiviert).
- M4-P02: E2E: Agent implementiert Fixture-Spec über MCP, erfasst Verdicts,
  `drift_report` ist `complete`.
- M4-P03: E2E seeded: eine Anforderung wird absichtlich weggelassen →
  `drift_report` zeigt exakt diesen Claim als `missing` (Kern-Abnahme).
- M4-P04: Claim-Store überlebt Server-Neustart (Persistenz).
- M4-P05: Parallele Tool-Calls → Store konsistent (Serialisierung/Lock).
- M4-P06: `[manuell]` Unbeteiligte Person: Setup bis erster Report
  < 10 Minuten anhand der Doku.

### Negativ
- M4-N01: Ungültige Tool-Argumente → strukturierter MCP-Fehler, Server
  läuft weiter.
- M4-N02: `record_verdict` vor `extract_claims` → verständlicher Fehler
  mit nächstem Schritt.
- M4-N03: 10-MB-Spec → begrenzter Fehler ("zu groß"), kein OOM/Hänger.
- M4-N04: Path-Traversal in Datei-Parametern (`../../`) → abgelehnt.
- M4-N05: Prozess-Kill mitten im Schreibvorgang → Store nicht korrumpiert
  (atomare Writes; Test simuliert Abbruch).

---

## M5 — GitHub Action / CI-Gate

### Positiv
- M5-P01: Demo-Repo, PR mit vollständiger Abdeckung → Check grün,
  PR-Kommentar mit Quote und Tabelle.
- M5-P02: Schwellen (`fail_on`, `min_coverage`) wirken nachweislich
  (gleicher PR, verschiedene Configs → verschiedene Ergebnisse).
- M5-P03: Uncovered-Change-Erkennung: geänderte Datei ohne
  Verdict-Evidenz-Referenz erscheint als "Änderung ohne Spec-Deckung".
- M5-P04: Action läuft ohne Secrets (Workflow-Datei enthält keine, Lauf
  erfolgreich).
- M5-P05: Monorepo: Action arbeitet auf konfiguriertem Unterverzeichnis.

### Negativ
- M5-N01: PR mit fehlendem Claim → Check failed, Kommentar nennt Claim-ID
  und Quellzeile.
- M5-N02: Spec geändert ohne Re-Extraktion → Staleness-Fail.
- M5-N03: `distorted` Claim bei `fail_on: distorted` → Check failed.
- M5-N04: Schema-invalider Report im Repo → Action failed mit klarer
  Meldung; niemals fälschlich grün.
- M5-N05: Fork-PR ohne Schreibrechte → degradiert zu Annotation, kein
  Crash, kein fälschliches Grün.
- M5-N06: Uncovered Changes über Schwelle → Check failed.

---

## M6 — vServer Evidence-API

### Positiv
- M6-P01: API-Contract-Tests für alle Endpoints (Upload, List, Get,
  Verify, Export, Share, Provisioning) gegen OpenAPI-Definition.
- M6-P02: Upload → Get → Inhalt byte-identisch.
- M6-P03: Hash-Ketten-Verify-Endpoint bestätigt unveränderte Sequenz über
  ≥ 3 verkettete Reports.
- M6-P04: Traceability-Matrix-Export (CSV/JSON) stimmt mit gespeicherten
  Verdicts überein (Stichproben-Abgleich).
- M6-P05: Share-Link erlaubt Lesen ohne Account.
- M6-P06: Lasttest: 50 parallele Uploads ohne Fehler/Verlust.
- M6-P07: `[manuell]` Backup → Restore auf frischem Server → Verify über
  alle Ketten grün.
- M6-P08: `[manuell]` TLS-Konfiguration: SSL-Labs-Rating ≥ A.

### Negativ
- M6-N01: Request ohne API-Key → 401.
- M6-N02: Falscher API-Key → 403.
- M6-N03: Gültiger Key, fremder Workspace → 403, Zugriff geloggt.
- M6-N04: Manipulierter Report (Hash stimmt nicht) → Upload abgelehnt,
  Vorfall geloggt.
- M6-N05: Nachträglich in der DB veränderter Report → Verify-Endpoint
  erkennt Kettenbruch.
- M6-N06: Burst über Rate-Limit → 429 mit Retry-After.
- M6-N07: Überlanger Payload → 413, Server stabil.
- M6-N08: Share-Link kann nicht schreiben (alle Mutations-Endpoints 403).
- M6-N09: Widerrufener Key verliert Zugriff in < 60 s auf allen Endpoints.
- M6-N10: Provisioning-Endpoint ohne internes Secret oder von fremder
  IP → 403.
- M6-N11: Injection-Versuche (SQL/JSON/Header) in allen Parametern →
  sauber abgewiesen (automatisierte Security-Suite).

---

## M7 — WordPress-Portal

### Positiv
- M7-P01: E2E-Browser-Test Happy Path: Registrieren → Sandbox-Abo →
  Key erzeugen → CLI-Upload mit Key → Report im Portal sichtbar.
- M7-P02: DE-Kauf: 19 % USt, Rechnungs-PDF korrekt (Anschrift, USt-ID,
  Nummernkreis).
- M7-P03: EU-B2B mit gültiger USt-ID (VIES) → Reverse Charge 0 % mit
  Rechnungshinweis.
- M7-P04: EU-B2C → USt-Satz des Verbraucherlandes (OSS), zwei
  Stichprobenländer.
- M7-P05: Key-Rotation: neuer Key funktioniert, alter ist tot.
- M7-P06: Report-Viewer rendert M6-Report korrekt (Stichprobe gegen
  JSON).
- M7-P07: 1.000-Claims-Report → paginierte Darstellung, kein Timeout.

### Negativ
- M7-N01: Key nach Erstanzeige weder in WP-Datenbank noch im HTML/JS
  irgendeiner Seite auffindbar (automatisierter Scan).
- M7-N02: Abo gekündigt / Zahlung fehlgeschlagen (Sandbox-Event) → Key in
  < 60 s widerrufen, CLI-Upload schlägt fehl.
- M7-N03: Nutzer A erreicht Workspace/Reports von Nutzer B nicht — auch
  nicht per URL-/Parameter-Manipulation (IDOR-Testreihe).
- M7-N04: Alle Portal-Formulare: fehlender/falscher Nonce → abgelehnt;
  fehlende Capability → abgelehnt; XSS-Payload in Eingaben → escaped.
- M7-N05: Ungültige USt-ID → Standard-USt statt 0 % (kein stilles
  Reverse Charge).
- M7-N06: Evidence-API nicht erreichbar → verständliche Fehlermeldung,
  kein White-Screen, keine PHP-Fatals im Log.
- M7-N07: Spam-Registrierung (Honeypot/Ratelimit) wird abgefangen.
- M7-N08: Stripe-Webhook-Ausfall simuliert → Abgleich-Job meldet
  Abo-/Key-Diskrepanz innerhalb eines Laufs.
- M7-N09: Plugin deaktivieren/reaktivieren → keine Fatals, Daten intakt.

---

## M8 — Beta-Launch & Bezahlschranke

### Positiv
- M8-P01: `[manuell]` 5 externe Nutzer durchlaufen Setup → erster Report
  ohne Support-Eingriff (Protokoll je Nutzer).
- M8-P02: Abo abschließen → kündigen → Rechnung und Status korrekt
  (Sandbox-Zyklus automatisiert).
- M8-P03: Telemetrie sendet erst nach explizitem Opt-in (Netzwerk-Mitschnitt
  vor/nach Opt-in).
- M8-P04: Markt-Gate-Metriken (Installs, aktive Workspaces, Feedbacks)
  werden korrekt erfasst und sind abrufbar.

### Negativ
- M8-N01: Gekündigter Account: Schreibzugriff weg, Datenexport bleibt
  möglich.
- M8-N02: Massenhafte Workspace-Erstellung → Rate-Limit greift.
- M8-N03: Ohne Opt-in: nachweislich null Telemetrie-Requests
  (Netzwerk-Mitschnitt über kompletten Testlauf).
- M8-N04: DSGVO-Prozess: Auskunfts- und Löschanfrage (Art. 15/17) wird
  durchgespielt — Export vollständig, Löschung wirksam, Hash-Ketten-Umgang
  dokumentiert (Löschung durch Schwärzung + Ketten-Vermerk statt stillem
  Kettenbruch). `[manuell]` einmalig.

---

## M9 — Ausbau (Regel + Beispielpakete)

Verbindliche Regel: **Kein M9-Feature wird gemerged ohne eigenes
Positiv-/Negativ-Testpaket nach diesem Schema.** Beispiel-Vorlagen:

### Rückwärts-Drift voll (`specdrift reverse --diff <range>`)
- Positiv: Commit mit Code-Änderung ohne Claim-Bezug → als ungedeckte
  Änderung gemeldet; Änderung mit Claim-Bezug → sauber zugeordnet.
- Negativ: ungültige Diff-Range → sauberer Fehler; Binärdatei im Diff →
  übersprungen mit Hinweis; umbenannte Datei → keine Falschmeldung.

### Test-Traceability (Verdict → Test-ID)
- Positiv: Verdict mit Test-Referenz → Matrix zeigt Anforderung→Test;
  Report listet Anforderungen ohne Testbezug.
- Negativ: Referenz auf nicht existenten Test → abgelehnt; Test gelöscht
  nach Verdict → Staleness-Warnung im Report.

### Compliance-Export (PDF)
- Positiv: PDF-Matrix stimmt mit CSV/JSON-Export überein (Stichproben).
- Negativ: Workspace mit Kettenbruch → Export verweigert mit Begründung
  statt schöngerechneter Matrix.

---

## Usability-Fixes (aus dem Blind-Test 2026-06-12)

Ein Subagent ohne Vorwissen durchlief Setup→Drift-Report nur mit der README
(M4-P06-Proxy: bestanden) und meldete 7 Friction-Punkte. Daraus abgeleitete
Tests:

### Positiv
- UX-P01: `claims list` zeigt IDs, Typen und Quellzeilen ohne JSON-Lektüre.
- UX-P02: `--help` funktioniert auf jedem Subkommando mit Usage-Zeile.
- UX-P03: Report- und Gate-Konsolenausgabe benennen gedriftete Claims mit
  Claim-ID und Quellzeile (nicht nur Summen).

### Negativ
- UX-N01: `claims list` ohne Store → Fehler nennt `extract` als nächsten
  Schritt.
- UX-N02: `--help` auf unbekanntem Kommando → weiterhin Fehler mit Hinweis.
- UX-N03: `report --strict` bei unvollständigen Verdicts → `fail:`-Präfix,
  nicht `warn:`.

Dokumentations-Fixes ohne Testbedarf: Installations-/Aufrufabschnitt,
`--json`-Dokumentation, Hinweis auf Verdict-Pflicht für context-Claims
(`out_of_scope` mit Begründung). Offen für v0.2: Verdict-Vokabular für rein
beschreibende Zeilen, Report-Datei-Default.

## Zähltafel

| Meilenstein | Positiv | Negativ |
| --- | --- | --- |
| M0 | 5 | 4 |
| M1 | 12 | 8 |
| M2 | 4 | 5 |
| M3 | 9 | 8 |
| M4 | 6 | 5 |
| M5 | 5 | 6 |
| M6 | 8 | 11 |
| M7 | 7 | 9 |
| M8 | 4 | 4 |
| **Summe** | **60** | **60** |

Die 1:1-Parität von Positiv- und Negativ-Tests ist beabsichtigt und wird bei
Erweiterungen gehalten oder zugunsten der Negativ-Seite verschoben.
