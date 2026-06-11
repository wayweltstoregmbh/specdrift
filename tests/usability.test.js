"use strict";

// Fixes from the blind usability test (see TESTPLAN.md, section "Usability-Fixes").

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin", "specdrift.js");
const FIXTURES = path.join(__dirname, "fixtures");

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd: cwd || ROOT });
}

function prep(label) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(cwd, "spec.md"));
  fs.writeFileSync(path.join(cwd, "impl.js"), "line1\nline2\n", "utf8");
  assert.strictEqual(run(["extract", "spec.md"], cwd).status, 0);
  return cwd;
}

test("UX-P01: claims list shows ids, types and source lines without opening JSON", () => {
  const cwd = prep("uxp01");
  const result = run(["claims", "list"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /claim_001\s+technical_must\s+must\s+spec\.md:5/);
  assert.match(result.stdout, /claim_005\s+boundary/);
  assert.match(result.stdout, /6 claim\(s\) from 1 source\(s\)/);
});

test("UX-N01: claims list without a store names extract as the next step", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "specdrift-uxn01-"));
  const result = run(["claims", "list"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /extract/);
});

test("UX-P02: --help works on every subcommand with usage line, exit 0", () => {
  for (const name of [["report"], ["gate"], ["verdict", "record"], ["claims", "list"]]) {
    const result = run([...name, "--help"]);
    assert.strictEqual(result.status, 0, `${name.join(" ")}: ${result.stderr}`);
    assert.match(result.stdout, /Usage: specdrift /);
  }
});

test("UX-N02: --help on an unknown command still fails with the help hint", () => {
  const result = run(["nonsense", "--help"]);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /unknown command/);
});

test("UX-P03: report and gate console output name drifted claims with source line", () => {
  const cwd = prep("uxp03");
  for (const id of ["claim_001", "claim_002", "claim_004", "claim_006"]) {
    run(["verdict", "record", id, "covered", "--evidence", "impl.js:1"], cwd);
  }
  run(["verdict", "record", "claim_003", "missing", "--reason", "2fa skipped"], cwd);
  const report = run(["report", "--strict"], cwd);
  assert.notStrictEqual(report.status, 0);
  assert.match(report.stdout, /^fail:/m);
  assert.match(report.stdout, /missing: claim_003 spec\.md:10/m);
  const gate = run(["gate"], cwd);
  assert.notStrictEqual(gate.status, 0);
  assert.match(gate.stdout, /missing: claim_003 spec\.md:10/m);
});

test("UX-N03: strict report on incomplete verdicts prints fail prefix, not warn", () => {
  const cwd = prep("uxn03");
  run(["verdict", "record", "claim_001", "covered", "--evidence", "impl.js:1"], cwd);
  const result = run(["report", "--strict"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stdout, /^fail: report incomplete/m);
});
