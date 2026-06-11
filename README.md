# SpecDrift

Deterministic spec-fidelity verification for AI coding agents: claim-level
provenance, enforced verdicts, drift reports. No LLM calls, no dependencies,
no secrets.

SpecDrift answers the question no spec-driven workflow answers today:
**which of my requirements did the agent silently lose, distort, or invent —
and can I prove it?**

## How it works

1. **Extract** — split any markdown spec (free-form, Kiro EARS, Spec-Kit or
   OpenSpec folders) into claims, each anchored to file, line and SHA-256
   source hash. Non-goal sections become boundaries, never requirements.
2. **Confirm** — review the claims, then bind them into confirmed
   requirement contracts. Stale specs (changed after extraction) block.
3. **Verdict** — for every claim, record `covered` (with evidence),
   `missing`, `distorted`, `out_of_scope` or `accepted_deviation` (waiver
   with reason + approver). Hash-bound; stale or unknown claims are rejected.
4. **Report & gate** — the drift report shows coverage, lost and distorted
   requirements, waivers and unrequested additions. The CI gate blocks
   merges on drift, low coverage or changed files without spec coverage.

## Quick start (CLI)

```bash
specdrift extract spec.md
specdrift status
specdrift confirm --accept-current
specdrift verdict record claim_001 covered --evidence src/orders.js:42
specdrift verdict record claim_002 accepted_deviation \
  --reason "banner instead of page, agreed with customer" --approved-by you@example.com
specdrift report --strict
```

## MCP server (for Claude Code, Cursor, etc.)

Register `mcp/server.js` as a stdio MCP server with your project as cwd.
Tools: `extract_claims`, `get_claims`, `check_coverage`, `record_verdict`,
`drift_report`. The host agent does the semantic judging; SpecDrift enforces
structure: every claim needs an evidence-backed verdict before the report is
complete.

```json
{
  "mcpServers": {
    "specdrift": {
      "command": "node",
      "args": ["/path/to/specdrift/mcp/server.js"]
    }
  }
}
```

## GitHub Action (CI gate)

```yaml
- uses: specdrift/specdrift@v0
  with:
    fail-on: both          # missing | distorted | both
    min-coverage: 90
    max-uncovered: 0       # block changed files without spec coverage
```

Posts a drift table as PR comment and fails the check on lost or distorted
requirements. Runs without secrets and without network calls.

## Guarantees

- **Deterministic:** identical input produces identical output; the gate can
  never go green on schema-invalid or corrupt inputs.
- **Hash-bound:** verdicts bind to claim and spec hashes; a changed spec
  invalidates stale verdicts instead of silently passing.
- **Benchmarked:** every release must hold >= 90% recall and precision on
  the seeded-drift benchmark (`tests/m3.test.js`).
- **Tested:** 73 automated positive/negative tests across all milestones
  (see `TESTPLAN.md`).

Status: pre-release (M0–M5 complete). See `ROADMAP.md` and `TESTPLAN.md`.

License: Apache-2.0
