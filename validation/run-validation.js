"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PROJECT = path.join(__dirname, "intake-shortcode");
const IMPL = "example-intake.php";
const { startServer, textOf } = require(path.join(ROOT, "tests", "helpers", "mcp-client.js"));

function markerLine(marker) {
  const lines = fs.readFileSync(path.join(PROJECT, IMPL), "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(marker));
  if (index === -1) throw new Error(`marker not found in implementation: ${marker}`);
  return index + 1;
}

const MARKERS = {
  claim_001: "add_shortcode( 'example_intake'",
  claim_002: "Plugin Name: Example Intake",
  claim_003: "add_shortcode( 'example_intake'",
  claim_004: "position: fixed",
  claim_005: "body.example-intake-active .site-header",
  claim_006: "no external APIs, no database persistence",
  claim_007: 'form id="example-intake-form"',
  claim_008: "interner Reviewer sichtet",
  claim_009: "Intake Request</h1>",
  claim_010: 'form id="example-intake-form"',
  claim_011: "intake_name",
  claim_012: "intake_email",
  claim_013: "intake_category",
  claim_014: "intake_message",
  claim_015: "Einschätzung anfordern",
  claim_017: "Details anzeigen",
  claim_018: 'classList.add("is-visible")',
  claim_019: 'var reference = "EI-"',
  claim_020: "Browser-Test aktiv",
  claim_021: "Nächster Schritt",
  claim_022: "Ihre Anfrage wurde aufgenommen",
  claim_023: "event.preventDefault()",
  claim_024: "--ei-color-accent: #2f5d50",
  claim_025: "Design tokens: single functional location",
  claim_026: "height: var(--ei-button-height)",
  claim_028: "Text-size hierarchy"
};

const BROWSER_CLAIMS = [
  "claim_027", "claim_029", "claim_030", "claim_031", "claim_033", "claim_034",
  "claim_035", "claim_036", "claim_037", "claim_039", "claim_040"
];

function buildCalls(run) {
  const calls = [];
  for (const [claimId, marker] of Object.entries(MARKERS)) {
    calls.push({
      claim_id: claimId,
      verdict: "covered",
      evidence: `${IMPL}:${markerLine(marker)}`,
      overwrite: run === "b"
    });
  }
  calls.push({
    claim_id: "claim_032",
    verdict: "out_of_scope",
    reason: "structural list introduction line, not a standalone requirement",
    overwrite: run === "b"
  });
  if (run === "a") {
    calls.push({
      claim_id: "claim_016",
      verdict: "missing",
      reason: 'secondary action "Status prüfen" was not implemented'
    });
    calls.push({
      claim_id: "claim_038",
      verdict: "distorted",
      reason: 'only one of two secondary actions exists; "Status prüfen" is absent'
    });
    for (const claimId of BROWSER_CLAIMS) {
      calls.push({
        claim_id: claimId,
        verdict: "missing",
        reason: "browser evidence not produced in this static validation run"
      });
    }
  } else {
    calls.push({
      claim_id: "claim_016",
      verdict: "covered",
      evidence: `${IMPL}:${markerLine("Status prüfen")}`,
      overwrite: true
    });
    calls.push({
      claim_id: "claim_038",
      verdict: "covered",
      evidence: `${IMPL}:${markerLine("Status prüfen")}`,
      overwrite: true
    });
    for (const claimId of BROWSER_CLAIMS) {
      calls.push({
        claim_id: claimId,
        verdict: "accepted_deviation",
        reason: "browser proof deferred to the WordPress integration test stage",
        approved_by: "validation-run (Claude Fable 5) — production waivers need a human approver",
        overwrite: true
      });
    }
  }
  return calls;
}

async function main() {
  const run = process.argv[2];
  if (!["a", "b"].includes(run)) throw new Error("usage: node run-validation.js <a|b>");
  const server = startServer(PROJECT);
  await server.init();
  if (run === "a") {
    const extract = await server.callTool("extract_claims", { spec_path: "spec.md" });
    process.stdout.write(`extract: ${textOf(extract).split("\n").slice(1, 5).join(" ").trim()}\n`);
  }
  let errors = 0;
  for (const call of buildCalls(run)) {
    const response = await server.callTool("record_verdict", call);
    if (response.result.isError) {
      errors += 1;
      process.stdout.write(`ERR ${call.claim_id}: ${textOf(response).split("\n")[0]}\n`);
    }
  }
  server.kill();
  process.stdout.write(`verdicts recorded, errors: ${errors}\n`);
  const gate = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "bin", "specdrift.js"), "gate", "--json",
      "--changed", IMPL,
      "--out", `gate-run-${run}.json`,
      "--comment-out", `comment-run-${run}.md`
    ],
    { encoding: "utf8", cwd: PROJECT }
  );
  const output = JSON.parse(gate.stdout);
  process.stdout.write(`gate exit=${gate.status} status=${output.status}\n`);
  for (const finding of output.blocking_findings) process.stdout.write(`  blocking: ${finding}\n`);
  if (output.report) {
    const totals = output.report.totals;
    process.stdout.write(
      `  totals: required=${totals.required} covered=${totals.covered} missing=${totals.missing} ` +
        `distorted=${totals.distorted} waived=${totals.waived} out_of_scope=${totals.out_of_scope}\n`
    );
    process.stdout.write(`  coverage: ${output.report.coverage_percent}%\n`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
);
