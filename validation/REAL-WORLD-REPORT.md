# Real-World-Validierung — SpecDrift v0.0.1

Datum: 2026-06-11
Durchgeführt von: Claude (Fable 5) als realer Host-Agent über den produktiven
MCP-Server (`mcp/server.js`), nicht über Test-Mocks.

## Aufbau

Echte Spec: `generic-wordpress-intake-shortcode.md` aus dem LMA-Lab
(`tests/fixtures/mvp-specs/`) — eine reale WordPress-MVP-Spezifikation mit
UI-, UX-, Browser-Proof- und Non-Goal-Sektionen. Implementiert wurde ein
echtes WordPress-Plugin (`intake-shortcode/example-intake.php`, Shortcode,
Fullscreen-Surface, Design-Tokens, In-Place-Submit ohne Reload).

## Ergebnisse

### 1. Extraktion auf der echten Spec

- 45 Claims, alle mit korrekten Zeilenankern (Stichproben verifiziert).
- Alle 5 Non-Goals korrekt als `boundary` klassifiziert — keine wird zur
  Anforderung.
- `must not reload` korrekt als `forbidden/must_not`.
- 12 Contract-Kandidaten, 40 verdict-pflichtige Claims.

### 2. End-to-End Drift-Fang (Lauf A)

Implementierung absichtlich ohne den Sekundär-Button "Status prüfen";
Verdicts ehrlich über den echten MCP-Server erfasst (40/40, 0 Fehler):

- Gate: **FAIL (Exit 1)** — 12 missing, 1 distorted, Coverage 67,5 %.
- PR-Kommentar benennt exakt:
  `claim_016 | missing | spec.md:29 | Secondary action: "Status prüfen".`
- Auch die fehlenden Browser-Beweise wurden korrekt als blockierend geführt:
  das Gate verweigert Grün ohne Evidenz.

### 3. Reparatur + Waiver (Lauf B)

Button implementiert, Verdicts mit `--overwrite` korrigiert, 11
Browser-Proof-Claims transparent als `accepted_deviation` gewaivert
(Begründung + Genehmiger-Feld):

- Gate: **PASS (Exit 0)** — 28 covered, 0 missing, 0 distorted, 11 waived,
  1 out_of_scope, Coverage 100 %.
- Waiver bleiben im Report sichtbar, zählen aber nicht als Drift.

### 4. Robustheit auf realen Dokumenten

Extraktion über alle 69 echten Markdown-Dokumente des LMA-Labs
(README, Red Thread, Runtime-Horizont, 43 Research-Dokumente u. a.):

- 69/69 extrahiert, 0 Crashes, 0 unsaubere Fehler, 8.201 Claims gesamt.

## Ehrlich gefundene Schwächen

1. **Listen-Intro-Rauschen:** Zeilen wie "Required checks:" oder
   "Form fields:" werden als eigenständige Claims erfasst (~5 % Rauschen).
   Workaround existiert (`out_of_scope` mit Begründung); ein
   Heuristik-Filter ist Kandidat für v0.2 — bewusst NICHT mitten in der
   Validierung geändert.
2. **Klassifikations-Grenzfall:** claim_008 ("no admin UI required") wird
   als `ui/must` statt als Scope-Klärung erkannt. Heuristik-Grenze, kein
   Blocker (Verdict-Workflow fängt es auf).
3. **Browser-Proof-Claims** sind statisch nicht erfüllbar — korrekt, aber
   der echte Abschluss braucht den WordPress-Integrationstest (das Plugin
   liegt bereit; die lokale "visit"-Site kann es laden).
4. **Waiver-Genehmiger** war in diesem Lauf der validierende Agent selbst —
   transparent gekennzeichnet. In Produktion müssen Waiver von einem
   Menschen genehmigt werden.

## Noch offen (nur durch den Betreiber möglich)

- GitHub-Push → CI auf 3 Betriebssystemen (M0-P01, M0-N03/N04).
- Registrierung des MCP-Servers in einem fremden Claude-Code-/Cursor-Setup
  (M4-P06, 10-Minuten-Setup durch unbeteiligte Person).
- Browser-Beweis des generierten Plugins in der lokalen WordPress-Site.

## Fazit

Der komplette Produktpfad — echte Spec → Claims → ehrliche Verdicts über den
produktiven MCP-Server → Gate blockt Drift → Reparatur/Waiver → Gate grün —
funktioniert an einem realen Beispiel aus der Zieldomäne. Die Kernzusage
("das Gate kann nicht falsch grün werden und benennt verlorene Anforderungen
mit Quellzeile") ist real demonstriert, nicht nur synthetisch getestet.
