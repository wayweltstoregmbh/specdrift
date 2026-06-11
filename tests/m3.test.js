"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin", "specdrift.js");
const FIXTURES = path.join(__dirname, "fixtures");
const { buildClaimStore } = require(path.join(ROOT, "lib", "extract.js"));
const { judgeClaims } = require(path.join(ROOT, "lib", "judge-baseline.js"));
const { generateBenchmark } = require(path.join(__dirname, "helpers", "benchmark.js"));

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd });
}

function prep(label) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(cwd, "spec.md"));
  fs.writeFileSync(path.join(cwd, "impl.js"), "line1\nline2\nline3\nline4\n", "utf8");
  const result = run(["extract", "spec.md"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  return cwd;
}

// Required (non-boundary) claims in en-spec.md: 001, 002, 003, 004, 006.
const REQUIRED = ["claim_001", "claim_002", "claim_003", "claim_004", "claim_006"];

function recordAll(cwd, overrides = {}) {
  for (const id of REQUIRED) {
    if (overrides[id] === null) continue;
    const args = overrides[id] || ["covered", "--evidence", "impl.js:2"];
    const result = run(["verdict", "record", id, ...args], cwd);
    assert.strictEqual(result.status, 0, `${id}: ${result.stderr}`);
  }
}

function reportJson(cwd, extra = []) {
  const result = run(["report", "--json", ...extra], cwd);
  return { result, output: JSON.parse(result.stdout) };
}

test("M3-P01: covered verdict with evidence is stored hash-bound", () => {
  const cwd = prep("p01");
  const result = run(
    ["verdict", "record", "claim_001", "covered", "--evidence", "impl.js:2", "--json"],
    cwd
  );
  assert.strictEqual(result.status, 0, result.stderr);
  const file = JSON.parse(fs.readFileSync(path.join(cwd, "specdrift.verdicts.json"), "utf8"));
  assert.strictEqual(file.verdicts.length, 1);
  assert.strictEqual(file.verdicts[0].claim_id, "claim_001");
  assert.deepStrictEqual(file.verdicts[0].evidence, [{ file: "impl.js", line: 2 }]);
  assert.match(file.verdicts[0].source_hash, /^[a-f0-9]{64}$/);
});

test("M3-P02: full verdicts produce a complete report with correct totals", () => {
  const cwd = prep("p02");
  recordAll(cwd);
  const { result, output } = reportJson(cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(output.report_status, "complete");
  assert.strictEqual(output.totals.required, 5);
  assert.strictEqual(output.totals.covered, 5);
  assert.strictEqual(output.coverage_percent, 100);
  assert.strictEqual(output.unverdicted_claim_ids.length, 0);
});

test("M3-P03: distorted verdict appears in the drift section with source line", () => {
  const cwd = prep("p03");
  recordAll(cwd, {
    claim_003: ["distorted", "--reason", "uses sms code instead of two-factor app"]
  });
  const { output } = reportJson(cwd);
  assert.strictEqual(output.totals.distorted, 1);
  assert.strictEqual(output.drift.distorted[0].claim_id, "claim_003");
  assert.strictEqual(output.drift.distorted[0].source_line, 10);
  assert.match(output.drift.distorted[0].reason, /sms code/);
});

test("M3-P04: out-of-scope additions get their own report section", () => {
  const cwd = prep("p04");
  recordAll(cwd);
  const addition = run(
    ["verdict", "addition", "--evidence", "impl.js:4", "--note", "added an unrequested admin export"],
    cwd
  );
  assert.strictEqual(addition.status, 0, addition.stderr);
  const { output } = reportJson(cwd);
  assert.strictEqual(output.additions.length, 1);
  assert.match(output.additions[0].note, /unrequested admin export/);
});

test("M3-P05: accepted deviation is waived, visible and not counted as drift", () => {
  const cwd = prep("p05");
  recordAll(cwd, {
    claim_002: [
      "accepted_deviation",
      "--reason", "confirmation page replaced by inline banner per customer decision",
      "--approved-by", "info@lazylabor.de"
    ]
  });
  const { result, output } = reportJson(cwd, ["--strict"]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(output.totals.waived, 1);
  assert.strictEqual(output.totals.missing + output.totals.distorted, 0);
  assert.strictEqual(output.waived[0].claim_id, "claim_002");
  assert.strictEqual(output.waived[0].approved_by, "info@lazylabor.de");
  assert.strictEqual(output.coverage_percent, 100);
});

test("M3-P06: report output is deterministic apart from timestamps", () => {
  const cwd = prep("p06");
  recordAll(cwd);
  const first = reportJson(cwd).output;
  const second = reportJson(cwd).output;
  delete first.generated_at;
  delete second.generated_at;
  assert.deepStrictEqual(first, second);
});

test("M3-P07: seeded drift benchmark recall is at least 90 percent", () => {
  const scenarios = generateBenchmark(20);
  let seededDrift = 0;
  let detected = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specdrift-bench-"));
  scenarios.forEach((scenario, index) => {
    const specPath = path.join(tmp, `spec_${index}.md`);
    fs.writeFileSync(specPath, scenario.specText, "utf8");
    const store = buildClaimStore(specPath, `spec_${index}.md`);
    const suggestions = judgeClaims(store, scenario.implText);
    for (const suggestion of suggestions) {
      const claim = store.claims.find((c) => c.claim_id === suggestion.claim_id);
      const expected = scenario.truth.get(claim.source_text);
      if (expected === "missing" || expected === "distorted") {
        seededDrift += 1;
        if (suggestion.verdict === expected) detected += 1;
      }
    }
  });
  assert.ok(seededDrift >= 40, `benchmark too small: ${seededDrift} seeded drift cases`);
  const recall = detected / seededDrift;
  assert.ok(recall >= 0.9, `recall ${recall} below 0.9 (${detected}/${seededDrift})`);
});

test("M3-P08: seeded drift benchmark precision is at least 90 percent", () => {
  const scenarios = generateBenchmark(20);
  let judgedDrift = 0;
  let trulyDrift = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specdrift-bench2-"));
  scenarios.forEach((scenario, index) => {
    const specPath = path.join(tmp, `spec_${index}.md`);
    fs.writeFileSync(specPath, scenario.specText, "utf8");
    const store = buildClaimStore(specPath, `spec_${index}.md`);
    const suggestions = judgeClaims(store, scenario.implText);
    for (const suggestion of suggestions) {
      const claim = store.claims.find((c) => c.claim_id === suggestion.claim_id);
      const expected = scenario.truth.get(claim.source_text);
      if (suggestion.verdict === "missing" || suggestion.verdict === "distorted") {
        judgedDrift += 1;
        if (expected === "missing" || expected === "distorted") trulyDrift += 1;
      }
    }
  });
  assert.ok(judgedDrift > 0);
  const precision = trulyDrift / judgedDrift;
  assert.ok(precision >= 0.9, `precision ${precision} below 0.9 (${trulyDrift}/${judgedDrift})`);
});

test("M3-P09: strict report exits 0 when complete and drift-free", () => {
  const cwd = prep("p09");
  recordAll(cwd);
  const result = run(["report", "--strict"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
});

test("M3-N01: verdict for unknown claim id is rejected", () => {
  const cwd = prep("n01");
  const result = run(["verdict", "record", "claim_999", "covered", "--evidence", "impl.js"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /unknown claim id/);
});

test("M3-N02: verdict against a stale spec hash is rejected", () => {
  const cwd = prep("n02");
  fs.appendFileSync(path.join(cwd, "spec.md"), "\n- Something new.\n");
  const result = run(["verdict", "record", "claim_001", "covered", "--evidence", "impl.js"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /stale/);
});

test("M3-N03: covered without evidence is rejected", () => {
  const cwd = prep("n03");
  const result = run(["verdict", "record", "claim_001", "covered"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /requires --evidence/);
});

test("M3-N04: accepted_deviation without reason is rejected", () => {
  const cwd = prep("n04");
  const result = run(
    ["verdict", "record", "claim_001", "accepted_deviation", "--approved-by", "someone"],
    cwd
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /requires --reason/);
});

test("M3-N05: accepted_deviation without approver is rejected", () => {
  const cwd = prep("n05");
  const result = run(
    ["verdict", "record", "claim_001", "accepted_deviation", "--reason", "agreed change"],
    cwd
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /requires --approved-by/);
});

test("M3-N06: incomplete verdicts make the report incomplete and strict fail", () => {
  const cwd = prep("n06");
  recordAll(cwd, { claim_004: null });
  const { result, output } = reportJson(cwd);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(output.report_status, "incomplete");
  assert.deepStrictEqual(output.unverdicted_claim_ids, ["claim_004"]);
  const strict = run(["report", "--strict"], cwd);
  assert.notStrictEqual(strict.status, 0);
});

test("M3-N07: evidence path escaping the project root is rejected", () => {
  const cwd = prep("n07");
  const result = run(
    ["verdict", "record", "claim_001", "covered", "--evidence", "../outside.js:1"],
    cwd
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /escapes the project root/);
});

test("M3-N08: duplicate verdict requires --overwrite and records the replacement", () => {
  const cwd = prep("n08");
  run(["verdict", "record", "claim_001", "covered", "--evidence", "impl.js:1"], cwd);
  const duplicate = run(
    ["verdict", "record", "claim_001", "missing", "--reason", "second thoughts"],
    cwd
  );
  assert.notStrictEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /--overwrite/);
  const replace = run(
    ["verdict", "record", "claim_001", "missing", "--reason", "second thoughts", "--overwrite"],
    cwd
  );
  assert.strictEqual(replace.status, 0, replace.stderr);
  const file = JSON.parse(fs.readFileSync(path.join(cwd, "specdrift.verdicts.json"), "utf8"));
  assert.strictEqual(file.verdicts.length, 1);
  assert.strictEqual(file.verdicts[0].verdict, "missing");
  assert.strictEqual(file.verdicts[0].overwrote_previous, true);
});
