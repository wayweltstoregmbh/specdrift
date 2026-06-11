# SpecDrift

Deterministic spec-fidelity verification for AI coding agents: claim-level
provenance, enforced verdicts, drift reports.

SpecDrift answers one question that no spec-driven workflow answers today:
**which of my requirements did the agent silently lose, distort, or invent —
and can I prove it?**

- `specdrift extract <spec>` — split a free-form spec into claims with
  source anchors (file, line, hash).
- `specdrift status` / `specdrift confirm` — review and bind claims into
  confirmed requirement contracts (M2).
- `specdrift verdict record` / `specdrift report` — per-claim verdicts
  (covered / missing / distorted / out-of-scope / accepted deviation) with
  evidence, hash-bound drift reports (M3).
- MCP server and GitHub Action (M4/M5).

Status: pre-release, milestone M0. See `ROADMAP.md` and `TESTPLAN.md`.

License: Apache-2.0
