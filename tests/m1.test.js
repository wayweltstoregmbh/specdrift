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
const { buildClaimStore, sha256 } = require(path.join(ROOT, "lib", "extract.js"));
const { generateCorpus } = require(path.join(__dirname, "helpers", "gen-corpus.js"));

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
}

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd: cwd || ROOT });
}

function extractTo(cwd, specPath) {
  const result = run(["extract", specPath, "--out", "claims.json", "--json"], cwd);
  return { result, store: result.status === 0 ? readClaims(cwd) : null };
}

function readClaims(cwd) {
  return JSON.parse(fs.readFileSync(path.join(cwd, "claims.json"), "utf8"));
}

test("M1-P01: EN fixture matches golden claim distribution", () => {
  const cwd = tmpDir("p01");
  const { result, store } = extractTo(cwd, path.join(FIXTURES, "en-spec.md"));
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(store.claims.length, 6);
  const byType = store.claims.map((claim) => claim.claim_type);
  assert.deepStrictEqual(
    byType,
    ["technical_must", "ui", "security_must", "forbidden", "boundary", "acceptance"]
  );
  assert.strictEqual(store.claims.filter((claim) => claim.contract_candidate).length, 4);
});

test("M1-P02: DE fixture matches golden claim distribution", () => {
  const cwd = tmpDir("p02");
  const { result, store } = extractTo(cwd, path.join(FIXTURES, "de-spec.md"));
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(store.claims.length, 5);
  const byStrength = store.claims.map((claim) => claim.strength);
  assert.deepStrictEqual(byStrength, ["must", "should", "must_not", "must_not", "acceptance"]);
  assert.strictEqual(store.claims.filter((claim) => claim.contract_candidate).length, 3);
  assert.strictEqual(store.claims[4].claim_type, "ui");
});

test("M1-P03: claims point at the exact source line", () => {
  const cwd = tmpDir("p03");
  const { store } = extractTo(cwd, path.join(FIXTURES, "en-spec.md"));
  const first = store.claims[0];
  assert.strictEqual(first.source_line_start, 5);
  assert.strictEqual(first.source_text, "The system must store every order in the database.");
  const fixtureLines = fs.readFileSync(path.join(FIXTURES, "en-spec.md"), "utf8").split(/\r?\n/);
  assert.ok(fixtureLines[first.source_line_start - 1].includes(first.source_text));
});

test("M1-P04: source hash equals SHA-256 of the spec content", () => {
  const cwd = tmpDir("p04");
  const { store } = extractTo(cwd, path.join(FIXTURES, "en-spec.md"));
  const text = fs.readFileSync(path.join(FIXTURES, "en-spec.md"), "utf8");
  assert.strictEqual(store.sources[0].hash, sha256(text));
  assert.strictEqual(store.claims[0].source_hash, sha256(text));
});

test("M1-P05: nested headings produce correct section paths", () => {
  const cwd = tmpDir("p05");
  const { store } = extractTo(cwd, path.join(FIXTURES, "en-spec.md"));
  const securityClaim = store.claims.find((claim) => claim.claim_type === "security_must");
  assert.deepStrictEqual(securityClaim.section_path, ["Demo Product Spec", "Security"]);
});

test("M1-P06: content inside code fences produces no claims", () => {
  const cwd = tmpDir("p06");
  const spec = [
    "# Fence Spec",
    "",
    "- The system must log every request to satisfy the audit requirement.",
    "",
    "```",
    "- The system must crash on purpose.",
    "```",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(cwd, "spec.md"), spec, "utf8");
  const { result, store } = extractTo(cwd, "spec.md");
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(store.claims.length, 1);
  assert.ok(!store.claims.some((claim) => claim.source_text.includes("crash")));
});

test("M1-P07: non-goal sections become boundary claims, never requirements", () => {
  const cwd = tmpDir("p07");
  const { store } = extractTo(cwd, path.join(FIXTURES, "en-spec.md"));
  const boundary = store.claims.find((claim) => claim.source_text.includes("Magic link"));
  assert.strictEqual(boundary.claim_type, "boundary");
  assert.strictEqual(boundary.binding_status, "boundary");
  assert.strictEqual(boundary.contract_candidate, false);
});

test("M1-P08: Kiro EARS requirements.md is accepted with anchored must claims", () => {
  const cwd = tmpDir("p08");
  const { result, store } = extractTo(cwd, path.join(FIXTURES, "kiro-requirements.md"));
  assert.strictEqual(result.status, 0, result.stderr);
  const shallClaim = store.claims.find((claim) => claim.source_text.includes("SHALL display"));
  assert.strictEqual(shallClaim.strength, "must");
  assert.strictEqual(shallClaim.source_line_start, 9);
  const shallNot = store.claims.find((claim) => claim.source_text.includes("SHALL NOT"));
  assert.strictEqual(shallNot.strength, "must_not");
  assert.strictEqual(shallNot.claim_type, "forbidden");
});

test("M1-P09: a spec folder yields one claim store with per-file anchors", () => {
  const cwd = tmpDir("p09");
  const { result, store } = extractTo(cwd, path.join(FIXTURES, "folder-spec"));
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(store.sources.length, 2);
  assert.strictEqual(store.claims.length, 2);
  assert.ok(store.claims[0].source_file.endsWith("a-overview.md"));
  assert.ok(store.claims[1].source_file.endsWith("b-data.md"));
  assert.strictEqual(store.claims[0].claim_id, "claim_001");
  assert.strictEqual(store.claims[1].claim_id, "claim_002");
  assert.strictEqual(store.claims[1].claim_type, "data");
});

test("M1-P10: extraction is deterministic apart from the timestamp", () => {
  const cwdA = tmpDir("p10a");
  const cwdB = tmpDir("p10b");
  const a = extractTo(cwdA, path.join(FIXTURES, "en-spec.md")).store;
  const b = extractTo(cwdB, path.join(FIXTURES, "en-spec.md")).store;
  delete a.extracted_at;
  delete b.extracted_at;
  assert.deepStrictEqual(a, b);
});

test("M1-P11: a 2000-line spec extracts in under 1 second", () => {
  const cwd = tmpDir("p11");
  const lines = ["# Big Spec"];
  for (let i = 0; i < 2000; i += 1) {
    lines.push(`- Requirement ${i}: the system must handle case ${i} in the database.`);
  }
  fs.writeFileSync(path.join(cwd, "big.md"), lines.join("\n"), "utf8");
  const started = process.hrtime.bigint();
  const store = buildClaimStore(path.join(cwd, "big.md"), "big.md");
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(store.claims.length >= 2000);
  assert.ok(elapsedMs < 1000, `extraction took ${elapsedMs}ms`);
});

test("M1-P12: 100-file fuzzing corpus never crashes the extractor", () => {
  const corpusDir = tmpDir("p12");
  const files = generateCorpus(corpusDir, 100);
  assert.strictEqual(files.length, 100);
  for (const file of files) {
    try {
      const store = buildClaimStore(path.join(corpusDir, file), file);
      assert.ok(Array.isArray(store.claims));
    } catch (err) {
      assert.ok(err instanceof Error, `non-Error thrown for ${file}`);
      assert.ok(err.message.length > 0, `empty error message for ${file}`);
    }
  }
});

test("M1-N01: missing path fails cleanly without writing an artifact", () => {
  const cwd = tmpDir("n01");
  const result = run(["extract", "does-not-exist.md", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /not found/);
  assert.ok(!fs.existsSync(path.join(cwd, "claims.json")));
});

test("M1-N02: empty file fails cleanly", () => {
  const cwd = tmpDir("n02");
  fs.writeFileSync(path.join(cwd, "empty.md"), "", "utf8");
  const result = run(["extract", "empty.md", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /empty/);
  assert.ok(!fs.existsSync(path.join(cwd, "claims.json")));
});

test("M1-N03: file under 80 chars fails cleanly", () => {
  const cwd = tmpDir("n03");
  fs.writeFileSync(path.join(cwd, "tiny.md"), "# Tiny\n- must work", "utf8");
  const result = run(["extract", "tiny.md", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /too small/);
  assert.ok(!fs.existsSync(path.join(cwd, "claims.json")));
});

test("M1-N04: binary file fails cleanly without crash", () => {
  const cwd = tmpDir("n04");
  fs.writeFileSync(path.join(cwd, "blob.md"), Buffer.from([0, 1, 2, 255, 0, 60, 100, 0, 9]));
  const result = run(["extract", "blob.md", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /binary/);
  assert.ok(!/\bat .+:\d+:\d+/.test(result.stderr));
  assert.ok(!fs.existsSync(path.join(cwd, "claims.json")));
});

test("M1-N05: directory without markdown spec files fails cleanly", () => {
  const cwd = tmpDir("n05");
  fs.mkdirSync(path.join(cwd, "empty-dir"));
  fs.writeFileSync(path.join(cwd, "empty-dir", "data.txt"), "not markdown", "utf8");
  const result = run(["extract", "empty-dir", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /no markdown spec files/);
});

test("M1-N06: unwritable output target fails cleanly without partial artifact", () => {
  const cwd = tmpDir("n06");
  fs.writeFileSync(path.join(cwd, "blocker"), "a file, not a directory", "utf8");
  const result = run(
    ["extract", path.join(FIXTURES, "en-spec.md"), "--out", "blocker/claims.json"],
    cwd
  );
  assert.notStrictEqual(result.status, 0);
  assert.ok(!fs.existsSync(path.join(cwd, "blocker", "claims.json")));
  assert.ok(!fs.existsSync(path.join(cwd, "blocker", "claims.json.tmp")));
});

test("M1-N07: headings-only spec yields zero claims with a warning, exit 0", () => {
  const cwd = tmpDir("n07");
  const spec = `${"## Section heading without any statements below it\n".repeat(6)}`;
  fs.writeFileSync(path.join(cwd, "headings.md"), spec, "utf8");
  const result = run(["extract", "headings.md", "--out", "claims.json", "--json"], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.claim_count, 0);
  assert.strictEqual(output.status, "warn");
  assert.ok(output.notes.some((note) => note.includes("no claims")));
});

test("M1-N08: broken UTF-8 fails as encoding error, not silent corruption", () => {
  const cwd = tmpDir("n08");
  const bytes = Buffer.alloc(200, 0xff);
  fs.writeFileSync(path.join(cwd, "broken.md"), bytes);
  const result = run(["extract", "broken.md", "--out", "claims.json"], cwd);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /UTF-8/);
  assert.ok(!fs.existsSync(path.join(cwd, "claims.json")));
});
