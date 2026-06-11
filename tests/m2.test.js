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

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd });
}

function prepProject(label) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(cwd, "spec.md"));
  const result = run(["extract", "spec.md"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  return cwd;
}

function readJson(cwd, rel) {
  return JSON.parse(fs.readFileSync(path.join(cwd, rel), "utf8"));
}

function snapshotDir(cwd) {
  const out = {};
  for (const file of fs.readdirSync(cwd).sort()) {
    const abs = path.join(cwd, file);
    if (fs.statSync(abs).isFile()) out[file] = fs.readFileSync(abs, "utf8");
  }
  return out;
}

test("M2-P01: status on fresh claims reports ready_for_confirmation with correct counts", () => {
  const cwd = prepProject("p01");
  const result = run(["status", "--json"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.status, "warn");
  assert.strictEqual(output.coverage_status, "ready_for_confirmation");
  assert.strictEqual(output.claim_count, 6);
  assert.strictEqual(output.candidate_count, 4);
  assert.strictEqual(output.confirmed_count, 0);
  assert.ok(output.notes.some((note) => note.includes("--accept-current")));
});

test("M2-P02: confirm --accept-current writes contracts and coverage becomes confirmed", () => {
  const cwd = prepProject("p02");
  const confirm = run(["confirm", "--accept-current", "--json"], cwd);
  assert.strictEqual(confirm.status, 0, confirm.stderr);
  const contracts = readJson(cwd, "specdrift.contracts.json");
  assert.strictEqual(contracts.contracts.length, 4);
  assert.ok(contracts.contracts.every((contract) => contract.status === "confirmed"));
  const claims = readJson(cwd, "specdrift.claims.json");
  const confirmed = claims.claims.filter(
    (claim) => claim.binding_status === "confirmed_contract"
  );
  assert.strictEqual(confirmed.length, 4);
  const status = run(["status", "--json"], cwd);
  assert.strictEqual(status.status, 0);
  const output = JSON.parse(status.stdout);
  assert.strictEqual(output.status, "pass");
  assert.strictEqual(output.coverage_status, "confirmed");
  assert.strictEqual(output.confirmed_count, 4);
});

test("M2-P03: status is idempotent and performs no write operations", () => {
  const cwd = prepProject("p03");
  run(["confirm", "--accept-current"], cwd);
  const before = snapshotDir(cwd);
  const first = run(["status", "--json"], cwd);
  const second = run(["status", "--json"], cwd);
  assert.strictEqual(first.status, 0);
  assert.strictEqual(second.status, 0);
  assert.deepStrictEqual(snapshotDir(cwd), before);
});

test("M2-P04: critical-claims-bound gate passes on a clean store", () => {
  const cwd = prepProject("p04");
  const result = run(["status", "--json"], cwd);
  const output = JSON.parse(result.stdout);
  const gate = output.gates.find((entry) => entry.gate_id === "critical_claims_bound");
  assert.strictEqual(gate.status, "pass");
  assert.deepStrictEqual(output.unbound_critical_claim_ids, []);
});

test("M2-N01: confirm without --accept-current fails and writes nothing", () => {
  const cwd = prepProject("n01");
  const before = snapshotDir(cwd);
  const result = run(["confirm"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /--accept-current/);
  assert.ok(!fs.existsSync(path.join(cwd, "specdrift.contracts.json")));
  assert.deepStrictEqual(snapshotDir(cwd), before);
});

test("M2-N02: a changed spec makes status and confirm block as stale", () => {
  const cwd = prepProject("n02");
  fs.appendFileSync(path.join(cwd, "spec.md"), "\n- A new requirement appeared.\n");
  const status = run(["status", "--json"], cwd);
  assert.notStrictEqual(status.status, 0);
  const output = JSON.parse(status.stdout);
  assert.ok(output.blocking_findings.some((finding) => finding.includes("stale")));
  const confirm = run(["confirm", "--accept-current"], cwd);
  assert.notStrictEqual(confirm.status, 0);
  assert.match(confirm.stderr, /stale/);
  assert.ok(!fs.existsSync(path.join(cwd, "specdrift.contracts.json")));
});

test("M2-N03: schema-invalid claim store blocks with file path and schema error", () => {
  const cwd = prepProject("n03");
  const claims = readJson(cwd, "specdrift.claims.json");
  claims.claims[0].strength = "banana";
  fs.writeFileSync(
    path.join(cwd, "specdrift.claims.json"),
    JSON.stringify(claims, null, 2),
    "utf8"
  );
  const result = run(["status", "--json"], cwd);
  assert.notStrictEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(
    output.blocking_findings.some(
      (finding) => finding.includes("schema-invalid") && finding.includes("specdrift.claims.json")
    )
  );
});

test("M2-N04: tampered contracts are detected as integrity failure", () => {
  const cwd = prepProject("n04");
  run(["confirm", "--accept-current"], cwd);
  const contracts = readJson(cwd, "specdrift.contracts.json");
  contracts.contracts[0].statement = "The system must do something else entirely.";
  fs.writeFileSync(
    path.join(cwd, "specdrift.contracts.json"),
    JSON.stringify(contracts, null, 2),
    "utf8"
  );
  const result = run(["status", "--json"], cwd);
  assert.notStrictEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(output.blocking_findings.some((finding) => finding.includes("integrity")));
});

test("M2-N05: confirm without a claim store points at extract", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "specdrift-n05-"));
  const result = run(["confirm", "--accept-current"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /not found/);
  assert.match(result.stderr, /extract/);
});
