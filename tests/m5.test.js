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

const REQUIRED = ["claim_001", "claim_002", "claim_003", "claim_004", "claim_006"];

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd });
}

function prep(label, overrides = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(cwd, "spec.md"));
  fs.writeFileSync(path.join(cwd, "impl.js"), "line1\nline2\nline3\n", "utf8");
  assert.strictEqual(run(["extract", "spec.md"], cwd).status, 0);
  for (const id of REQUIRED) {
    if (overrides[id] === null) continue;
    const args = overrides[id] || ["covered", "--evidence", "impl.js:2"];
    const result = run(["verdict", "record", id, ...args], cwd);
    assert.strictEqual(result.status, 0, `${id}: ${result.stderr}`);
  }
  return cwd;
}

function gate(cwd, extra = []) {
  const result = run(
    ["gate", "--json", "--out", "gate.json", "--comment-out", "comment.md", ...extra],
    cwd
  );
  let output = null;
  try {
    output = JSON.parse(result.stdout);
  } catch {
    // leave null for negative parse cases
  }
  const comment = fs.existsSync(path.join(cwd, "comment.md"))
    ? fs.readFileSync(path.join(cwd, "comment.md"), "utf8")
    : "";
  return { result, output, comment };
}

test("M5-P01: full coverage passes the gate and emits a comment with the quote", () => {
  const cwd = prep("p01");
  const { result, output, comment } = gate(cwd);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.strictEqual(output.status, "pass");
  assert.match(comment, /## SpecDrift Report/);
  assert.match(comment, /coverage 100%/);
  assert.match(comment, /Covered: 5/);
});

test("M5-P02: fail-on thresholds demonstrably change the outcome", () => {
  const cwd = prep("p02", {
    claim_004: ["missing", "--reason", "password hash exposure guard never implemented"]
  });
  const lenient = gate(cwd, ["--fail-on", "distorted"]);
  assert.strictEqual(lenient.result.status, 0, lenient.result.stdout);
  const strict = gate(cwd, ["--fail-on", "missing"]);
  assert.notStrictEqual(strict.result.status, 0);
  const both = gate(cwd);
  assert.notStrictEqual(both.result.status, 0);
});

test("M5-P03: changed files without verdict evidence are listed as uncovered", () => {
  const cwd = prep("p03");
  const { result, output, comment } = gate(cwd, [
    "--changed", "impl.js,unrelated/new-feature.php,spec.md"
  ]);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.deepStrictEqual(output.uncovered_changes, ["unrelated/new-feature.php"]);
  assert.ok(output.warnings.some((warning) => warning.includes("new-feature.php")));
  assert.match(comment, /Changes without spec coverage/);
});

test("M5-P04: gate and action run without any secrets", () => {
  const cwd = prep("p04");
  const result = spawnSync(
    process.execPath,
    [BIN, "gate", "--json"],
    { encoding: "utf8", cwd, env: { PATH: process.env.PATH } }
  );
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  const action = fs.readFileSync(path.join(ROOT, "action.yml"), "utf8");
  assert.ok(
    !/\$\{\{\s*secrets\./.test(action),
    "action.yml must not consume any GitHub secrets"
  );
});

test("M5-P05: monorepo subdirectory projects gate independently", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "specdrift-p05-"));
  const sub = path.join(repo, "packages", "plugin-a");
  fs.mkdirSync(sub, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(sub, "spec.md"));
  fs.writeFileSync(path.join(sub, "impl.js"), "line1\n", "utf8");
  assert.strictEqual(run(["extract", "spec.md"], sub).status, 0);
  for (const id of REQUIRED) {
    run(["verdict", "record", id, "covered", "--evidence", "impl.js:1"], sub);
  }
  const { result, output } = gate(sub);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(output.status, "pass");
});

test("M5-N01: a missing claim fails the gate and the comment names claim and line", () => {
  const cwd = prep("n01", {
    claim_003: ["missing", "--reason", "two-factor authentication never implemented"]
  });
  const { result, output, comment } = gate(cwd);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(output.status, "fail");
  assert.match(comment, /claim_003/);
  assert.match(comment, /spec\.md:10/);
  assert.match(comment, /missing/);
});

test("M5-N02: a stale spec fails the gate", () => {
  const cwd = prep("n02");
  fs.appendFileSync(path.join(cwd, "spec.md"), "\n- Brand new requirement.\n");
  const { result, output } = gate(cwd);
  assert.notStrictEqual(result.status, 0);
  assert.ok(output.blocking_findings.some((finding) => finding.includes("stale")));
});

test("M5-N03: a distorted claim fails the gate under fail-on distorted", () => {
  const cwd = prep("n03", {
    claim_001: ["distorted", "--reason", "orders stored in a transient cache, not the database"]
  });
  const { result } = gate(cwd, ["--fail-on", "distorted"]);
  assert.notStrictEqual(result.status, 0);
});

test("M5-N04: corrupt verdicts can never produce a green gate", () => {
  const cwd = prep("n04");
  fs.writeFileSync(path.join(cwd, "specdrift.verdicts.json"), "{ not json", "utf8");
  const { result, output } = gate(cwd);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(output.status, "fail");
  assert.ok(output.blocking_findings.some((finding) => finding.includes("not valid JSON")));
});

test("M5-N05: action.yml guards fork PRs and keeps commenting non-fatal", () => {
  const action = fs.readFileSync(path.join(ROOT, "action.yml"), "utf8");
  assert.match(action, /head\.repo\.full_name == github\.repository/);
  assert.match(action, /continue-on-error: true/);
});

test("M5-N06: uncovered changes above --max-uncovered block the gate", () => {
  const cwd = prep("n06");
  const { result: warnOnly } = gate(cwd, ["--changed", "a.php,b.php"]);
  assert.strictEqual(warnOnly.status, 0);
  const { result, output } = gate(cwd, ["--changed", "a.php,b.php", "--max-uncovered", "1"]);
  assert.notStrictEqual(result.status, 0);
  assert.ok(
    output.blocking_findings.some((finding) => finding.includes("without spec coverage"))
  );
});
